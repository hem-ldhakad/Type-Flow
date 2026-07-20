import prisma from '../prisma.js';
import { generateParagraph } from '../services/paragraphService.js';

/**
 * GET /api/matches
 * Fetches paginated match history for the logged-in user.
 */
export const getUserMatches = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 15;
        const skip = (page - 1) * limit;

        if (page < 1 || limit < 1) {
            return res.status(400).json({
                success: false,
                message: 'Page and limit parameters must be positive integers.'
            });
        }

        // Execute parallel queries for performance
        const [results, total] = await Promise.all([
            prisma.result.findMany({
                where: { userId },
                orderBy: {
                    match: {
                        startedAt: 'desc'
                    }
                },
                skip,
                take: limit,
                include: {
                    match: {
                        include: {
                            paragraph: {
                                select: {
                                    id: true,
                                    text: true,
                                    source: true,
                                    category: true,
                                    wordCount: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.result.count({ where: { userId } })
        ]);

        // Format the outcomes structure
        const history = results.map((r) => ({
            resultId: r.id,
            matchId: r.matchId,
            wpm: r.wpm,
            accuracy: r.accuracy,
            position: r.position,
            startedAt: r.match.startedAt,
            endedAt: r.match.endedAt,
            paragraph: r.match.paragraph
        }));

        return res.status(200).json({
            success: true,
            data: {
                matches: history,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/matches/paragraph/random
 * Fetches a random typing paragraph.
 */
export const getRandomParagraph = async (req, res, next) => {
    try {
        const wordCount = parseInt(req.query.wordCount, 10) || null;
        const paragraph = await generateParagraph(wordCount);
        return res.status(200).json({
            success: true,
            data: { paragraph }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/matches/solo
 * Stores a solo match test outcome, calculates speed XP and increments player levels.
 */
export const submitSoloMatch = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { paragraphId, wpm, accuracy, wpmHistory, keystrokeHistory } = req.body;

        if (!paragraphId || wpm === undefined || accuracy === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Missing required match results parameters.'
            });
        }

        const paragraph = await prisma.paragraph.findUnique({ where: { id: paragraphId } });
        if (!paragraph) {
            return res.status(404).json({
                success: false,
                message: 'Paragraph not found.'
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create a Match record without a roomId
            const match = await tx.match.create({
                data: {
                    paragraphId,
                    startedAt: new Date(Date.now() - (wpm > 0 ? (paragraph.wordCount / wpm) * 60 * 1000 : 30 * 1000)),
                    endedAt: new Date(),
                }
            });

            // 2. Create the associated Result log
            const newResult = await tx.result.create({
                data: {
                    matchId: match.id,
                    userId: userId,
                    wpm: parseInt(wpm, 10),
                    accuracy: parseFloat(accuracy),
                    position: 1, // Only user playing
                    wpmHistory: JSON.stringify(wpmHistory || []),
                    keystrokeHistory: JSON.stringify(keystrokeHistory || [])
                }
            });

            // 3. Increment User progression / XP stats
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { xp: true, level: true }
            });

            let rewardXP = 0;
            let newXp = 0;
            let newLevel = 1;

            if (user) {
                const baseXP = 20; // Solo test base experience
                const speedXP = Math.floor(wpm / 5);
                rewardXP = baseXP + speedXP;

                newXp = user.xp + rewardXP;
                newLevel = user.level;

                while (newXp >= newLevel * 100) {
                    newXp -= newLevel * 100;
                    newLevel += 1;
                }

                await tx.user.update({
                    where: { id: userId },
                    data: { xp: newXp, level: newLevel }
                });
            }

            return {
                matchId: match.id,
                resultId: newResult.id,
                xpGained: rewardXP,
                currentXp: newXp,
                currentLevel: newLevel
            };
        });

        return res.status(201).json({
            success: true,
            message: 'Solo match saved.',
            data: result
        });
    } catch (err) {
        next(err);
    }
};

import prisma from '../prisma.js';

/**
 * GET /api/users/:id/stats
 * Compiles and returns profile typing stats and live progression summaries.
 */
export const getUserStats = async (req, res, next) => {
    try {
        const { id: targetUserId } = req.params;

        // Resolve target identity and performance history in parallel
        const [userProfile, matchResults] = await Promise.all([
            prisma.user.findUnique({
                where: { id: targetUserId },
                select: {
                    id: true,
                    username: true,
                    level: true,
                    xp: true,
                    createdAt: true
                }
            }),
            prisma.result.findMany({
                where: { userId: targetUserId }
            })
        ]);

        if (!userProfile) {
            return res.status(404).json({
                success: false,
                message: `User with ID '${targetUserId}' not found.`
            });
        }

        const totalRaces = matchResults.length;
        let averageWpm = 0;
        let averageAccuracy = 0;
        let peakWpm = 0;
        let wins = 0;

        if (totalRaces > 0) {
            const sumWpm = matchResults.reduce((acc, curr) => acc + curr.wpm, 0);
            const sumAccuracy = matchResults.reduce((acc, curr) => acc + curr.accuracy, 0);

            averageWpm = Math.round(sumWpm / totalRaces);
            averageAccuracy = Math.round((sumAccuracy / totalRaces) * 10) / 10;
            peakWpm = Math.max(...matchResults.map(r => r.wpm));
            wins = matchResults.filter(r => r.position === 1).length;
        }

        // Expose stats payload
        return res.status(200).json({
            success: true,
            data: {
                userId: userProfile.id,
                username: userProfile.username,
                level: userProfile.level,
                xp: userProfile.xp,
                joinedAt: userProfile.createdAt,
                statistics: {
                    totalRaces,
                    wins,
                    winRatio: totalRaces > 0 ? Math.round((wins / totalRaces) * 100) : 0,
                    averageWpm,
                    averageAccuracy,
                    peakWpm
                }
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/users/leaderboard?period=all|week
 * Returns top-50 players ranked by average WPM. Public endpoint.
 */
export const getLeaderboard = async (req, res, next) => {
    try {
        const period = req.query.period || 'all';

        // Build optional date filter for weekly leaderboard
        const dateFilter = {};
        if (period === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            dateFilter.match = { startedAt: { gte: weekAgo } };
        }

        // Fetch all qualifying match results with user info
        const results = await prisma.result.findMany({
            where: dateFilter,
            include: {
                user: {
                    select: { id: true, username: true, level: true, xp: true }
                }
            }
        });

        // Aggregate per-player stats
        const playerMap = new Map();
        for (const r of results) {
            if (!r.user) continue;
            const uid = r.user.id;
            if (!playerMap.has(uid)) {
                playerMap.set(uid, {
                    userId: uid,
                    username: r.user.username,
                    level: r.user.level,
                    xp: r.user.xp,
                    totalRaces: 0,
                    wins: 0,
                    totalWpm: 0,
                    peakWpm: 0,
                });
            }
            const p = playerMap.get(uid);
            p.totalRaces++;
            if (r.position === 1) p.wins++;
            p.totalWpm += r.wpm;
            if (r.wpm > p.peakWpm) p.peakWpm = r.wpm;
        }

        // Build sorted leaderboard array
        const leaderboard = Array.from(playerMap.values())
            .filter((p) => p.totalRaces > 0)
            .map((p) => ({
                ...p,
                avgWpm: Math.round(p.totalWpm / p.totalRaces),
            }))
            .sort((a, b) => b.avgWpm - a.avgWpm || b.totalRaces - a.totalRaces)
            .slice(0, 50)
            .map((p, i) => ({ ...p, rank: i + 1 }));

        return res.status(200).json({ success: true, data: { leaderboard, period } });
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/users/:id
 * Deletes user account and cascades all related data.
 */
export const deleteUser = async (req, res, next) => {
    try {
        const { id: targetUserId } = req.params;

        // Ensure user is deleting their own account
        if (req.user.id !== targetUserId) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to delete this account.'
            });
        }

        // Delete user
        await prisma.user.delete({
            where: { id: targetUserId }
        });

        return res.status(200).json({
            success: true,
            message: 'Account deleted successfully.'
        });
    } catch (err) {
        next(err);
    }
};


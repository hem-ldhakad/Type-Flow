import prisma from '../prisma.js';

async function main() {
    console.log("Starting DB capitalization fix...");
    const paragraphs = await prisma.paragraph.findMany();
    let updatedCount = 0;

    for (const p of paragraphs) {
        const text = p.text;
        if (!text) continue;

        let lowered = text.toLowerCase();
        let formatted = lowered.replace(/(^\s*|[.!?]\s+)([a-z])/g, (match, separator, letter) => separator + letter.toUpperCase());
        formatted = formatted.replace(/\b(i|i'm)\b/g, (match) => match.charAt(0).toUpperCase() + match.slice(1));

        if (p.text !== formatted) {
            console.log(`Updating ID ${p.id} from: "${p.text.slice(0, 30)}..." to: "${formatted.slice(0, 30)}..."`);
            await prisma.paragraph.update({
                where: { id: p.id },
                data: { text: formatted }
            });
            updatedCount++;
        }
    }
    console.log(`Finished fixing casing. Updated ${updatedCount} out of ${paragraphs.length} paragraphs.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

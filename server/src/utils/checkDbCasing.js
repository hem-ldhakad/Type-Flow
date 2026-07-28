import prisma from '../prisma.js';

async function main() {
    console.log("Checking DB paragraphs for wrong casing...");
    const paragraphs = await prisma.paragraph.findMany();
    let badCount = 0;

    for (const p of paragraphs) {
        const text = p.text;
        if (!text) continue;

        // Find if there are capitalized words in the middle of sentences
        if (/[A-Z][a-z]+ [A-Z]/.test(text)) {
            badCount++;
            console.log(`BAD WORD CASING (ID: ${p.id}): "${text.slice(0, 100)}..."`);
        }
    }
    console.log(`Total bad paragraphs found: ${badCount} out of ${paragraphs.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

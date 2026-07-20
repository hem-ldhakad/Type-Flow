// prisma/seed.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const paragraphs = [
    {
        text: "The quick brown fox jumps over the lazy dog. A swift movement of the small panda of the wild forests makes a very cute photo.",
        source: "Typing Test Classic",
        category: "english",
        wordCount: 25
    },
    {
        text: "In the heart of the bamboo forest, a young panda named Pip loved to practice typing. He knew that speed and accuracy were key to mastering TypeFlow.",
        source: "Panda Tales",
        category: "english",
        wordCount: 27
    },
    {
        text: "JavaScript is a high-level, single-threaded, garbage-collected, interpreted or just-in-time compiled, prototype-based, multi-paradigm, dynamic language.",
        source: "MDN Web Docs",
        category: "code",
        wordCount: 16
    },
    {
        text: "To function is to be. To type is to flow. Speed is nothing without accuracy, and accuracy is nothing without a calm mind and a steady hand.",
        source: "Zen of Typing",
        category: "english",
        wordCount: 28
    },
    {
        text: "Focus on the present moment. Each keystroke should be precise, clear, and intentional. The rhythm of your typing will guide you to high speed.",
        source: "Typing Mastery Guide",
        category: "english",
        wordCount: 26
    }
];

async function main() {
    console.log("Seeding database...");

    // Clear any existing paragraphs
    await prisma.paragraph.deleteMany();

    // Insert paragraphs
    for (const p of paragraphs) {
        const created = await prisma.paragraph.create({ data: p });
        console.log(`Created paragraph: [${created.category}] "${created.text.slice(0, 30)}..."`);
    }

    console.log("Database seeded successfully!");
}

main()
    .catch((e) => {
        console.error("Seeding failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

import prisma from '../prisma.js';

/**
 * Fetches a random quote from dummyjson.com — free, no auth, truly random each call.
 */
async function fetchDummyJson() {
    const res = await fetch('https://dummyjson.com/quotes/random', { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`DummyJSON responded with status ${res.status}`);
    const data = await res.json();
    if (!data?.quote) throw new Error('DummyJSON returned empty quote');
    return { text: data.quote, source: data.author || 'DummyJSON' };
}

/**
 * Fetches from type.fit — returns a large static list, we pick a random one.
 */
async function fetchTypeFit() {
    const res = await fetch('https://type.fit/api/quotes', { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`type.fit responded with status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('type.fit returned empty list');
    const quote = data[Math.floor(Math.random() * data.length)];
    return { text: quote.text, source: quote.author || 'type.fit' };
}

/**
 * Fetches a random quote from api.quotable.io
 */
async function fetchQuotable() {
    const res = await fetch('https://api.quotable.io/random', { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Quotable responded with status ${res.status}`);
    const data = await res.json();
    return { text: data.content, source: data.author || 'Quotable' };
}

/**
 * Tries APIs in order: DummyJSON → type.fit → Quotable → local DB.
 * Returns { text, source }.
 */
async function fetchRandomQuote() {
    const apis = [fetchDummyJson, fetchTypeFit, fetchQuotable];
    for (const fn of apis) {
        try {
            const result = await fn();
            if (result?.text?.trim()) return result;
        } catch (err) {
            console.warn(`[paragraphService] ${fn.name} failed:`, err.message);
        }
    }
    // Final fallback — pick from local DB
    const count = await prisma.paragraph.count();
    if (count > 0) {
        const skip = Math.floor(Math.random() * count);
        const p = await prisma.paragraph.findFirst({ skip });
        return { text: p.text, source: p.source || 'Local DB' };
    }
    return { text: 'The quick brown fox jumps over the lazy dog.', source: 'Default' };
}

/**
 * Builds a paragraph that meets targetWordCount by concatenating quotes from the API,
 * always ending at a complete sentence boundary (never cuts mid-sentence).
 * @param {number} [targetWordCount]
 */
export const generateParagraph = async (targetWordCount) => {
    let text = '';
    let source = '';

    if (!targetWordCount || targetWordCount <= 0) {
        // No target — just return one random quote
        const q = await fetchRandomQuote();
        text = q.text.trim();
        source = q.source;
    } else {
        // Collect quotes until we have at least targetWordCount words,
        // then stop — the last sentence will be complete because each quote is already a sentence.
        const sentences = [];
        const sources = new Set();
        let wordCount = 0;
        let attempts = 0;

        while (wordCount < targetWordCount && attempts < 10) {
            attempts++;
            const q = await fetchRandomQuote();
            const sentence = q.text.trim();
            if (!sentence) continue;

            // Avoid duplicate sentences
            if (sentences.includes(sentence)) continue;

            sentences.push(sentence);
            sources.add(q.source);
            wordCount += sentence.split(/\s+/).length;
        }

        text = sentences.join(' ');
        source = Array.from(sources).join(', ') || 'Quote API';
    }

    if (!text) {
        text = 'The quick brown fox jumps over the lazy dog.';
        source = 'Default';
    }

    const finalWordCount = text.split(/\s+/).length;

    // Upsert into DB for referential integrity (Match requires a paragraphId)
    let dbParagraph = await prisma.paragraph.findFirst({ where: { text } });
    if (!dbParagraph) {
        dbParagraph = await prisma.paragraph.create({
            data: { text, source, category: 'quotes', wordCount: finalWordCount }
        });
    }

    return dbParagraph;
};

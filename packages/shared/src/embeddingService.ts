import { GoogleGenerativeAI } from '@google/generative-ai';

export interface NoteData {
    content: string;
    links?: { title?: string; url: string }[];
}

export class EmbeddingService {
    private genAI: GoogleGenerativeAI;
    private model: any;
    private lastCallTime: number = 0;
    private readonly MIN_DELAY_MS = 60; // Rate limit delay

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error('GOOGLE_AI_API_KEY is required for EmbeddingService');
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
    }

    /**
     * Generates an embedding vector for the given text.
     * Handles rate limiting automatically.
     */
    async generateEmbedding(text: string): Promise<number[]> {
        await this.enforceRateLimit();

        try {
            // Truncate to ~2000 chars to be safe (limit is 2048 tokens)
            const truncatedText = text.slice(0, 2000);

            const result = await this.model.embedContent(truncatedText);
            const embedding = result.embedding;
            return embedding.values;
        } catch (error) {
            console.error('Error generating embedding:', error);
            throw error;
        }
    }

    /**
     * Generates embeddings for multiple texts.
     * Processes them sequentially to respect rate limits.
     */
    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        const embeddings: number[][] = [];
        for (const text of texts) {
            embeddings.push(await this.generateEmbedding(text));
        }
        return embeddings;
    }

    /**
     * Prepares a note's text for embedding by combining content and link metadata.
     */
    prepareNoteText(note: NoteData): string {
        let text = note.content;

        if (note.links && note.links.length > 0) {
            const linkTexts = note.links
                .map(link => {
                    if (link.title) return `${link.title} (${link.url})`;
                    return link.url;
                })
                .join(', ');

            text += `\nLinks: ${linkTexts}`;
        }

        return text;
    }

    /**
     * Enforces a minimum delay between API calls to avoid hitting rate limits.
     */
    private async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastCallTime;

        if (timeSinceLastCall < this.MIN_DELAY_MS) {
            const waitTime = this.MIN_DELAY_MS - timeSinceLastCall;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.lastCallTime = Date.now();
    }
}

import { GoogleGenerativeAI } from '@google/generative-ai';
import { SupabaseClient } from '@supabase/supabase-js';

export interface NoteData {
    content: string;
    links?: { title?: string; description?: string; url: string }[];
}

export interface NoteWithId extends NoteData {
    id: number;
}

export interface BatchEmbeddingResult {
    id: number;
    embedding?: number[];
    error?: string;
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
                    const parts = [];
                    if (link.title) parts.push(link.title);
                    if (link.description) parts.push(link.description);
                    parts.push(link.url);
                    return parts.join(' | ');
                })
                .join('\n');

            text += `\nLinks:\n${linkTexts}`;
        }

        return text;
    }

    /**
     * Generates embeddings for multiple note objects with links.
     * Returns results with success/error status for each note.
     * Processes sequentially to respect rate limits.
     */
    async batchGenerateForNotes(notes: NoteWithId[]): Promise<BatchEmbeddingResult[]> {
        const results: BatchEmbeddingResult[] = [];

        for (const note of notes) {
            try {
                const text = this.prepareNoteText(note);
                const embedding = await this.generateEmbedding(text);
                results.push({ id: note.id, embedding });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.push({ id: note.id, error: errorMessage });
            }
        }

        return results;
    }

    /**
     * Generates embeddings and updates them directly in the database.
     * Returns statistics about successful updates and errors.
     */
    async batchUpdateNoteEmbeddings(
        supabase: SupabaseClient,
        notes: NoteWithId[]
    ): Promise<{ successful: number; failed: number; results: BatchEmbeddingResult[] }> {
        const results: BatchEmbeddingResult[] = [];
        let successful = 0;
        let failed = 0;

        for (const note of notes) {
            try {
                // Generate embedding
                const text = this.prepareNoteText(note);
                const embedding = await this.generateEmbedding(text);

                // Update database
                const { error: updateError } = await supabase
                    .from('z_notes')
                    .update({ embedding })
                    .eq('id', note.id);

                if (updateError) {
                    results.push({ id: note.id, error: updateError.message });
                    failed++;
                } else {
                    results.push({ id: note.id, embedding });
                    successful++;
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.push({ id: note.id, error: errorMessage });
                failed++;
            }
        }

        return { successful, failed, results };
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

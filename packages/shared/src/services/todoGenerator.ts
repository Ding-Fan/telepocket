import Groq from 'groq-sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export interface TodoGenerationResult {
  success: boolean;
  todoMarkdown?: string;
  notesAnalyzed?: number;
  error?: string;
}

interface Note {
  note_id: string;
  note_content: string;
  created_at: string;
}

// Zod schema for AI response validation
const TodoItemSchema = z.object({
  task: z.string(),
  sourceNoteId: z.string(),
  deadline: z.string().optional()
});

const CategorySchema = z.object({
  name: z.string(),
  emoji: z.string(),
  todos: z.array(TodoItemSchema)
});

const AIResponseSchema = z.object({
  categories: z.array(CategorySchema)
});

type AIResponse = z.infer<typeof AIResponseSchema>;

/**
 * Generate a todo list from user's recent notes using AI
 *
 * @param supabase - Supabase client instance
 * @param userId - Telegram user ID
 * @param apiKey - Groq API key
 * @param maxNotes - Maximum number of notes to analyze (default: 60)
 * @returns TodoGenerationResult with markdown or error
 */
export async function generateTodosFromNotes(
  supabase: SupabaseClient,
  userId: number,
  apiKey: string,
  maxNotes: number = 60
): Promise<TodoGenerationResult> {
  try {
    // Step 1: Fetch recent notes from database
    const { data: notes, error: fetchError } = await supabase.rpc('get_notes_with_pagination', {
      telegram_user_id_param: userId,
      page_number: 1,
      page_size: maxNotes
    });

    if (fetchError) {
      console.error('Failed to fetch notes:', fetchError);
      return {
        success: false,
        error: 'Failed to fetch your notes'
      };
    }

    // Step 2: Handle edge case - no notes
    if (!notes || notes.length === 0) {
      return {
        success: false,
        error: 'No notes found to generate todos from. Start adding notes first!'
      };
    }

    // Step 2.5: Filter out AI-generated todo lists to prevent recursion
    const filteredNotes = notes.filter((note: Note) => {
      return !note.note_content.includes('#ai-generated');
    });

    if (filteredNotes.length === 0) {
      return {
        success: false,
        error: 'No notes found after filtering AI-generated todos. Add some notes first!'
      };
    }

    // Step 3: Prepare notes for AI processing with IDs
    const notesAnalyzed = filteredNotes.length;
    const notesWithIds = filteredNotes.map((note: Note, idx: number) => {
      // Truncate very long notes to prevent token overflow
      const content = note.note_content.length > 500
        ? note.note_content.substring(0, 500) + '...'
        : note.note_content;

      const date = new Date(note.created_at).toLocaleDateString();
      return {
        id: note.note_id,
        index: idx + 1,
        date,
        content
      };
    });

    // Step 4: Build AI prompt for JSON output
    const prompt = buildTodoExtractionPrompt(notesWithIds, notesAnalyzed);

    // Step 5: Call Groq API with timeout
    const groq = new Groq({
      apiKey: apiKey
    });

    const TIMEOUT_MS = 30000; // 30 seconds
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI processing timeout')), TIMEOUT_MS)
    );

    let aiResponse: AIResponse;
    try {
      const result = await Promise.race([
        groq.chat.completions.create({
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.7, // Increased for more creative extraction
          max_tokens: 4096, // Doubled to allow more todos
          response_format: { type: 'json_object' } // Request JSON output
        }),
        timeoutPromise
      ]);

      const rawContent = result.choices[0]?.message?.content || '{}';

      // Step 6: Parse and validate JSON response
      try {
        const parsed = JSON.parse(rawContent);
        aiResponse = AIResponseSchema.parse(parsed);
      } catch (parseError) {
        console.error('Failed to parse/validate AI response:', parseError);
        return {
          success: false,
          error: 'AI returned invalid format. Please try again.'
        };
      }

    } catch (error) {
      console.error('Groq API error:', error);

      if (error instanceof Error && error.message.includes('timeout')) {
        return {
          success: false,
          error: 'AI processing took too long. Please try again.'
        };
      }

      return {
        success: false,
        error: 'AI service temporarily unavailable. Please try again later.'
      };
    }

    // Step 7: Convert JSON to markdown with clickable links
    const markdown = buildMarkdownFromAIResponse(aiResponse, notesAnalyzed);

    return {
      success: true,
      todoMarkdown: markdown,
      notesAnalyzed
    };

  } catch (error) {
    console.error('Unexpected error in todo generation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
}

/**
 * Build the AI prompt for todo extraction (JSON output)
 */
function buildTodoExtractionPrompt(
  notes: Array<{ id: string; index: number; date: string; content: string }>,
  notesCount: number
): string {
  const currentDate = new Date().toLocaleDateString();
  const currentDateTime = new Date().toLocaleString();

  const notesJson = JSON.stringify(notes, null, 2);

  return `You are a task extraction assistant. Analyze the following ${notesCount} notes and extract ALL possible action items, tasks, goals, and todos.

EXTRACTION PHILOSOPHY:
Be INCLUSIVE and COMPREHENSIVE. Extract anything that could be turned into an actionable task, even if it's implicit or aspirational.

WHAT TO EXTRACT (with examples):
1. **Explicit todos**: "TODO:", "Need to", "Must", "Should", "Have to", "Don't forget to"
   - "Need to fix the bug" → "Fix the bug"
   - "Should review the PR" → "Review the PR"

2. **Implicit tasks**: "Planning to", "Going to", "Will", "Want to", "Idea:", "Consider", "Think about", "Maybe"
   - "Planning to learn React" → "Learn React"
   - "Want to read that book" → "Read that book"
   - "Thinking about redesigning the homepage" → "Redesign the homepage"

3. **Questions as tasks**: Questions often imply investigation or research tasks
   - "How does authentication work?" → "Research authentication mechanisms"
   - "What's the best database for this?" → "Research and choose database"

4. **Projects and goals**: Break down projects into actionable first steps
   - "Build a chatbot" → "Build a chatbot" (keep as-is)
   - "Launch new feature" → "Launch new feature"

5. **Learning materials**: Links to articles, videos, courses imply "read/watch/take"
   - Article link with title → "Read [article title]"
   - Video link → "Watch [video title]"
   - Course mention → "Take [course name]"

6. **Purchases or acquisitions**: "Get", "Buy", "Purchase", "Order"
   - "Get the new MacBook" → "Get the new MacBook"
   - "Order groceries" → "Order groceries"

7. **Communications**: "Email", "Call", "Message", "Contact", "Reply to", "Follow up with"
   - "Email the client" → "Email the client"
   - "Follow up with John" → "Follow up with John"

8. **Reviews and decisions**: "Decide", "Choose", "Pick", "Evaluate", "Review", "Compare"
   - "Decide on the framework" → "Decide on the framework"
   - "Review candidate profiles" → "Review candidate profiles"

EXTRACTION GUIDELINES:
- Extract AT LEAST 1-2 tasks per note that contains any actionable content
- Convert passive observations into active tasks when possible
- Include both short-term and long-term goals
- Preserve specific details (names, technologies, deadlines)
- Extract deadlines if mentioned (e.g., "by Friday", "this week", "next month", "2026")
- Organize by logical categories (Work, Personal, Learning, Shopping, Health, Goals, Calls, Writing, Research, etc.)
- For each todo, include the "sourceNoteId" from which it was extracted
- Deduplicate ONLY if tasks are truly identical (same wording and context)

NOTES TO ANALYZE:
${notesJson}

OUTPUT FORMAT (JSON):
Return a valid JSON object with this exact structure:

{
  "categories": [
    {
      "name": "Work",
      "emoji": "🏢",
      "todos": [
        {
          "task": "Fix the login bug before launch",
          "sourceNoteId": "the-note-id-from-input",
          "deadline": "before launch"
        }
      ]
    },
    {
      "name": "Learning",
      "emoji": "📚",
      "todos": [
        {
          "task": "Read TypeScript handbook chapter 5",
          "sourceNoteId": "another-note-id",
          "deadline": ""
        }
      ]
    }
  ]
}

IMPORTANT RULES:
- Return ONLY valid JSON, no markdown formatting, no code blocks
- Each todo MUST have a "sourceNoteId" matching the "id" field from the input notes
- Use emojis for category icons (🏢 Work, 🏠 Personal, 📚 Learning, 🛒 Shopping, 💪 Health, 🎯 Goals, 📞 Calls, 📝 Writing, 🔬 Research)
- Deadline can be empty string "" if not mentioned
- If NO clear todos found after thorough extraction, return: {"categories": []}
- Aim for THOROUGHNESS - extract as many actionable items as reasonably possible

Extract generously. When in doubt, extract it as a todo.`;
}

/**
 * Convert AI JSON response to markdown with clickable links
 */
function buildMarkdownFromAIResponse(
  response: AIResponse,
  notesAnalyzed: number
): string {
  const currentDate = new Date().toLocaleDateString();
  const currentDateTime = new Date().toLocaleString();

  // Handle empty response (no todos found)
  if (!response.categories || response.categories.length === 0) {
    return `# 📋 No Clear Todos Found

Your recent notes don't contain explicit action items.

Consider reviewing your notes to identify any implicit tasks or goals.

---

*Analyzed ${notesAnalyzed} notes • Generated on ${currentDateTime} • #ai-generated*`;
  }

  // Build markdown with links
  let markdown = `# 📋 Todo List

> Auto-generated from your last ${notesAnalyzed} notes on ${currentDate}

`;

  for (const category of response.categories) {
    if (category.todos.length === 0) continue;

    markdown += `## ${category.emoji} ${category.name}\n`;

    for (const todo of category.todos) {
      const link = `/notes/${todo.sourceNoteId}`;
      const deadlineText = todo.deadline ? ` (${todo.deadline})` : '';
      markdown += `- [ ] ${todo.task}${deadlineText} [→](${link})\n`;
    }

    markdown += '\n';
  }

  markdown += `---

*Analyzed ${notesAnalyzed} notes • Generated on ${currentDateTime} • #ai-generated*`;

  return markdown;
}

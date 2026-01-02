import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface ScriptGenerationInput {
    bookContent: string;
    bookTitle: string;
    bookAuthor?: string;
    episodeTitle: string;
    podcasterName: string;
    podcasterPersonality: {
        tone: number;
        communicationStyle: number;
        humorLevel: number;
        conversationalDepth: number;
        chaosFactor: number;
        intellectualAngle: string;
        expertiseTags: string[];
    };
    episodeType: 'MONOLOGUE' | 'DUO' | 'GROUP';
    episodeTheme: 'LECTURE' | 'DISCUSSION' | 'DEBATE';
    targetLengthMin: number;
    targetLengthMax: number;
}

export interface ScriptGenerationResult {
    script: string;
    estimatedDuration: number;
}

@Injectable()
export class ScriptGenerationService {
    private readonly logger = new Logger(ScriptGenerationService.name);
    private readonly huggingFaceApiUrl = 'https://api-inference.huggingface.co/models';

    constructor(private databaseService: DatabaseService) {}

    /**
     * Generate a podcast script based on book content and podcaster personality
     */
    async generateScript(input: ScriptGenerationInput): Promise<ScriptGenerationResult> {
        const apiKey = process.env.HUGGINGFACE_API_KEY;

        if (!apiKey) {
            this.logger.warn('HuggingFace API key not configured, using fallback script generation');
            return this.generateFallbackScript(input);
        }

        try {
            const prompt = this.buildPrompt(input);
            const script = await this.callHuggingFaceAPI(prompt, apiKey);
            const estimatedDuration = this.estimateDuration(script);

            return {
                script,
                estimatedDuration,
            };
        } catch (error) {
            this.logger.error('HuggingFace API call failed, using fallback', error);
            return this.generateFallbackScript(input);
        }
    }

    /**
     * Build the prompt for script generation
     */
    private buildPrompt(input: ScriptGenerationInput): string {
        const personalityDescription = this.describePersonality(input.podcasterPersonality);
        const formatDescription = this.describeFormat(input.episodeType, input.episodeTheme);
        const targetWords = this.calculateTargetWords(input.targetLengthMin, input.targetLengthMax);

        return `You are an expert podcast script writer. Generate a podcast script based on the following:

BOOK INFORMATION:
Title: ${input.bookTitle}
Author: ${input.bookAuthor || 'Unknown'}

BOOK CONTENT TO DISCUSS:
${input.bookContent.substring(0, 8000)}

EPISODE DETAILS:
Title: ${input.episodeTitle}
Host: ${input.podcasterName}

HOST PERSONALITY:
${personalityDescription}

FORMAT:
${formatDescription}

TARGET LENGTH: Approximately ${targetWords} words (${input.targetLengthMin}-${input.targetLengthMax} minutes when spoken)

INSTRUCTIONS:
1. Create an engaging podcast script that discusses the key ideas from the book content
2. Match the host's personality traits in tone and style
3. Include natural transitions and engaging hooks
4. For ${input.episodeType} format: ${this.getFormatInstructions(input.episodeType)}
5. Theme approach: ${this.getThemeInstructions(input.episodeTheme)}

Generate the script now:`;
    }

    /**
     * Describe the podcaster personality for the prompt
     */
    private describePersonality(personality: ScriptGenerationInput['podcasterPersonality']): string {
        const toneDesc = personality.tone <= 3 ? 'calm and measured' : personality.tone >= 7 ? 'energetic and enthusiastic' : 'balanced';
        const styleDesc = personality.communicationStyle <= 3 ? 'storytelling and narrative-driven' : personality.communicationStyle >= 7 ? 'analytical and data-focused' : 'mixed storytelling and analysis';
        const humorDesc = personality.humorLevel <= 3 ? 'serious with minimal humor' : personality.humorLevel >= 7 ? 'comedic and witty' : 'occasional light humor';
        const depthDesc = personality.conversationalDepth <= 3 ? 'surface-level and accessible' : personality.conversationalDepth >= 7 ? 'deep philosophical exploration' : 'moderately in-depth';
        const chaosDesc = personality.chaosFactor <= 3 ? 'structured and predictable' : personality.chaosFactor >= 7 ? 'spontaneous with tangents' : 'mostly structured with some spontaneity';

        return `- Tone: ${toneDesc}
- Communication style: ${styleDesc}
- Humor: ${humorDesc}
- Depth: ${depthDesc}
- Flow: ${chaosDesc}
- Intellectual angle: ${personality.intellectualAngle}
- Areas of expertise: ${personality.expertiseTags.join(', ')}`;
    }

    /**
     * Describe the episode format
     */
    private describeFormat(episodeType: string, episodeTheme: string): string {
        const typeDesc = {
            MONOLOGUE: 'Single host speaking directly to the audience',
            DUO: 'Two hosts having a conversation',
            GROUP: 'Panel discussion with multiple voices',
        };

        const themeDesc = {
            LECTURE: 'Educational and informative, like a lecture or lesson',
            DISCUSSION: 'Exploratory conversation examining different aspects',
            DEBATE: 'Presenting and defending different viewpoints',
        };

        return `Type: ${typeDesc[episodeType] || typeDesc.MONOLOGUE}
Theme: ${themeDesc[episodeTheme] || themeDesc.LECTURE}`;
    }

    /**
     * Get specific format instructions
     */
    private getFormatInstructions(episodeType: string): string {
        const instructions = {
            MONOLOGUE: 'Write as a single voice addressing the audience directly. Use "you" to engage listeners.',
            DUO: 'Create a natural dialogue between HOST1 and HOST2. Include back-and-forth exchanges and reactions.',
            GROUP: 'Include 3-4 distinct voices (HOST, GUEST1, GUEST2, etc.) with different perspectives.',
        };
        return instructions[episodeType] || instructions.MONOLOGUE;
    }

    /**
     * Get theme-specific instructions
     */
    private getThemeInstructions(episodeTheme: string): string {
        const instructions = {
            LECTURE: 'Present information clearly with examples. Build understanding progressively.',
            DISCUSSION: 'Explore multiple angles. Ask rhetorical questions. Consider implications.',
            DEBATE: 'Present contrasting viewpoints. Play devil\'s advocate. Examine counterarguments.',
        };
        return instructions[episodeTheme] || instructions.LECTURE;
    }

    /**
     * Calculate target word count based on duration (roughly 150 words per minute)
     */
    private calculateTargetWords(minMinutes: number, maxMinutes: number): number {
        const avgMinutes = (minMinutes + maxMinutes) / 2;
        return Math.round(avgMinutes * 150);
    }

    /**
     * Call HuggingFace Inference API
     */
    private async callHuggingFaceAPI(prompt: string, apiKey: string): Promise<string> {
        // Using Mistral-7B-Instruct as it's available on free tier
        const model = process.env.HUGGINGFACE_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';

        const response = await fetch(`${this.huggingFaceApiUrl}/${model}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_new_tokens: 4000,
                    temperature: 0.7,
                    top_p: 0.9,
                    do_sample: true,
                    return_full_text: false,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`HuggingFace API error: ${response.status} - ${error}`);
        }

        const result = await response.json();

        if (Array.isArray(result) && result[0]?.generated_text) {
            return result[0].generated_text;
        }

        throw new Error('Unexpected API response format');
    }

    /**
     * Fallback script generation when API is unavailable
     */
    private generateFallbackScript(input: ScriptGenerationInput): ScriptGenerationResult {
        const intro = this.generateIntro(input);
        const mainContent = this.generateMainContent(input);
        const outro = this.generateOutro(input);

        const script = `${intro}\n\n${mainContent}\n\n${outro}`;
        const estimatedDuration = this.estimateDuration(script);

        return {
            script,
            estimatedDuration,
        };
    }

    /**
     * Generate introduction section
     */
    private generateIntro(input: ScriptGenerationInput): string {
        const greetings = [
            `Welcome back to another episode! I'm ${input.podcasterName}, and today we're diving deep into "${input.bookTitle}"${input.bookAuthor ? ` by ${input.bookAuthor}` : ''}.`,
            `Hey everyone, ${input.podcasterName} here. Today's episode is all about "${input.bookTitle}" - a book that's been making waves in the ${input.podcasterPersonality.expertiseTags[0] || 'literary'} world.`,
            `Hello and welcome! I'm ${input.podcasterName}, and in this episode titled "${input.episodeTitle}", we're exploring the fascinating ideas from "${input.bookTitle}".`,
        ];

        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    /**
     * Generate main content section based on book content
     */
    private generateMainContent(input: ScriptGenerationInput): string {
        // Extract key sentences from book content
        const sentences = input.bookContent
            .split(/[.!?]+/)
            .filter(s => s.trim().length > 50)
            .slice(0, 10);

        const sections: string[] = [];

        // Create discussion points from extracted content
        sentences.forEach((sentence, index) => {
            const trimmed = sentence.trim();
            if (trimmed) {
                const commentary = this.generateCommentary(trimmed, input, index);
                sections.push(commentary);
            }
        });

        return sections.join('\n\n');
    }

    /**
     * Generate commentary for a piece of content
     */
    private generateCommentary(content: string, input: ScriptGenerationInput, index: number): string {
        const transitionPhrases = [
            'Now, here\'s where it gets interesting.',
            'Let me break this down for you.',
            'This is a crucial point.',
            'Think about this for a moment.',
            'Here\'s what I find fascinating.',
        ];

        const analysisStarters = [
            'The author argues that',
            'We can see here that',
            'This passage illustrates',
            'What stands out to me is',
            'The key insight here is',
        ];

        const transition = index > 0 ? transitionPhrases[index % transitionPhrases.length] + ' ' : '';
        const starter = analysisStarters[index % analysisStarters.length];

        return `${transition}${starter} ${content.toLowerCase()}. And when you think about it in the context of ${input.podcasterPersonality.expertiseTags[0] || 'modern life'}, this takes on even greater significance.`;
    }

    /**
     * Generate outro section
     */
    private generateOutro(input: ScriptGenerationInput): string {
        const outros = [
            `That wraps up our exploration of "${input.bookTitle}" for today. I hope you found some valuable insights to take away. Until next time, keep reading, keep thinking, and keep growing.`,
            `And there you have it - the key ideas from "${input.bookTitle}". If this resonated with you, I'd love to hear your thoughts. Thanks for listening, and I'll catch you in the next episode.`,
            `So that's "${input.bookTitle}" through my lens. Remember, the real magic happens when you apply these ideas to your own life. Thanks for joining me today - see you next time!`,
        ];

        return outros[Math.floor(Math.random() * outros.length)];
    }

    /**
     * Estimate duration in seconds based on word count (150 words per minute)
     */
    private estimateDuration(script: string): number {
        const wordCount = script.split(/\s+/).length;
        const minutes = wordCount / 150;
        return Math.round(minutes * 60);
    }

    /**
     * Get book content for script generation
     */
    async getBookContent(
        bookId: string,
        contentCoverage: 'ENTIRE_BOOK' | 'MULTIPLE_CHAPTERS' | 'SINGLE_CHAPTER',
        chapters: number[],
    ): Promise<string> {
        if (contentCoverage === 'ENTIRE_BOOK') {
            // Get all chapters
            const allChapters = await this.databaseService.chapter.findMany({
                where: { bookId },
                orderBy: { chapterNumber: 'asc' },
            });
            return allChapters.map(c => c.extractedText || '').join('\n\n');
        }

        // Get specific chapters
        const selectedChapters = await this.databaseService.chapter.findMany({
            where: {
                bookId,
                chapterNumber: { in: chapters },
            },
            orderBy: { chapterNumber: 'asc' },
        });

        return selectedChapters.map(c => c.extractedText || '').join('\n\n');
    }
}

import { config } from '../config/config.js';

function debugLog(component, message, data) {
    console.log(`[${component}] ${message}`, data || '');
}

export class GptService {
    async analyzeTranscript(transcript) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [{
                        role: "system",
                        content: "You are a helpful assistant that creates titles and descriptions for journal entries."
                    }, {
                        role: "user",
                        content: `Create a title (max 5 words) and brief description (max 2 sentences) for this journal entry:\n\n${transcript}\n\nFormat your response as JSON with 'title' and 'description' fields.`
                    }]
                })
            });

            const data = await response.json();
            return JSON.parse(data.choices[0].message.content);
        } catch (error) {
            console.error('Error analyzing transcript:', error);
            throw error;
        }
    }

    async generateFollowUpQuestions(transcript) {
        try {
            debugLog('GPT', 'Generating follow-up questions');
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system",
                            content: "You are an expert journal coach. Generate three thoughtful follow-up questions that would help the user reflect more deeply on their journal entry. The questions should be specific to the content shared, encourage introspection, and help them gain insights."
                        },
                        {
                            role: "user",
                            content: `Here is my journal entry. Please generate three follow-up questions to help me reflect more deeply:\n\n${transcript}`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 250,
                    top_p: 1.0,
                    frequency_penalty: 0.0,
                    presence_penalty: 0.0
                })
            });
            
            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }
            
            const data = await response.json();
            const content = data.choices[0].message.content;
            
            // Extract questions (assuming they come numbered or as a list)
            const questions = content
                .split(/\d+\.|\n-|\n•/)
                .filter(line => line.trim().length > 0 && line.trim().endsWith('?'))
                .map(question => question.trim());
            
            // If parsing failed, return the whole content split by newlines
            if (questions.length === 0) {
                return content
                    .split('\n')
                    .filter(line => line.trim().length > 0)
                    .slice(0, 3);
            }
            
            return questions;
        } catch (error) {
            console.error('Error generating follow-up questions:', error);
            return [
                "What more can you share about this topic?",
                "How did this experience make you feel?",
                "What insights have you gained from this reflection?"
            ];
        }
    }
}

export const gptService = new GptService(); 
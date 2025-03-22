import { config } from '../config/config.js';

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
}

export const gptService = new GptService(); 
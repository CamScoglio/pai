import { gptService } from '../../voicepal proj/src/js/gptService.js';

export class TranscriptManager {
    constructor() {
        this.transcriptHistory = [];
    }

    async processTranscript(transcript, audioBlob, audioUrl) {
        try {
            // Get title and description from GPT
            const { title, description } = await gptService.analyzeTranscript(transcript);
            
            const entry = {
                title,
                description,
                text: transcript,
                timestamp: new Date().toLocaleString(),
                audioUrl,
                audioBlob
            };

            this.transcriptHistory.push(entry);
            return entry;
        } catch (error) {
            console.error('Error processing transcript:', error);
            throw error;
        }
    }

    getHistory() {
        return this.transcriptHistory;
    }
} 
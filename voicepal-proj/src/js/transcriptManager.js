import { gptService } from './gptService.js';

export class TranscriptManager {
    constructor() {
        this.transcriptHistory = [];
        this.nextPrompt = null;
    }

    async processTranscript(transcript, audioBlob, audioUrl) {
        try {
            let prompt = this.nextPrompt;
            this.nextPrompt = null; // Clear the prompt after using it
            
            // If there's a prompt, include it in the analysis
            const contextualTranscript = prompt 
                ? `Question: ${prompt}\n\nResponse: ${transcript}`
                : transcript;
            
            // Get title and description from GPT
            const { title, description } = await gptService.analyzeTranscript(contextualTranscript);
            
            const entry = {
                title,
                description,
                text: transcript,
                contextPrompt: prompt, // Store the prompt if there was one
                timestamp: new Date().toLocaleString(),
                audioUrl,
                audioBlob,
                id: Date.now().toString(), // Add a unique ID for referencing entries
                // Add conversation structure
                messages: [
                    // Add prompt message if there was one
                    ...(prompt ? [{
                        type: 'prompt',
                        content: prompt,
                        timestamp: new Date().toLocaleString(),
                        isPrompt: true
                    }] : []),
                    // Add the user's message
                    {
                        type: 'user',
                        content: transcript,
                        timestamp: new Date().toLocaleString(),
                        audioUrl
                    }
                ]
            };

            this.transcriptHistory.push(entry);
            return entry;
        } catch (error) {
            console.error('Error processing transcript:', error);
            
            // Create a basic entry even if GPT processing fails
            const entry = {
                title: "Journal Entry",
                description: "An entry from your journal.",
                text: transcript,
                timestamp: new Date().toLocaleString(),
                audioUrl,
                audioBlob,
                id: Date.now().toString(),
                messages: [
                    {
                        type: 'user',
                        content: transcript,
                        timestamp: new Date().toLocaleString(),
                        audioUrl
                    }
                ]
            };
            
            this.transcriptHistory.push(entry);
            return entry;
        }
    }

    async addMessageToEntry(entryId, transcript, audioBlob, audioUrl, prompt = null) {
        const entry = this.getEntryById(entryId);
        if (!entry) return null;
        
        // Initialize messages array if it doesn't exist
        if (!entry.messages) {
            entry.messages = [];
            
            // If this is the first time we're adding messages, 
            // create the initial message from the entry's text
            if (entry.contextPrompt) {
                entry.messages.push({
                    type: 'prompt',
                    content: entry.contextPrompt,
                    timestamp: entry.timestamp,
                    isPrompt: true
                });
            }
            
            entry.messages.push({
                type: 'user',
                content: entry.text,
                timestamp: entry.timestamp,
                audioUrl: entry.audioUrl
            });
        }
        
        // Add the new prompt message if provided
        if (prompt) {
            entry.messages.push({
                type: 'prompt',
                content: prompt,
                timestamp: new Date().toLocaleString(),
                isPrompt: true
            });
        }
        
        // Add the user's message
        entry.messages.push({
            type: 'user',
            content: transcript,
            timestamp: new Date().toLocaleString(),
            audioUrl
        });
        
        // Update the text field to contain all user messages for compatibility
        entry.text = entry.messages
            .filter(msg => msg.type === 'user')
            .map(msg => msg.content)
            .join('\n\n');
        
        // Update the timestamp to the latest
        entry.timestamp = new Date().toLocaleString();
        
        this.updateEntry(entry);
        return entry;
    }

    getHistory() {
        return this.transcriptHistory;
    }
    
    getEntryById(id) {
        return this.transcriptHistory.find(entry => entry.id === id);
    }
    
    updateEntry(updatedEntry) {
        const index = this.transcriptHistory.findIndex(entry => entry.id === updatedEntry.id);
        if (index !== -1) {
            this.transcriptHistory[index] = updatedEntry;
        }
    }
    
    setNextPrompt(prompt) {
        this.nextPrompt = prompt;
    }
} 
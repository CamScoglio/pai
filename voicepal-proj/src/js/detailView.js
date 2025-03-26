import { gptService } from './gptService.js';

export class DetailView {
    constructor(transcriptManager) {
        this.transcriptManager = transcriptManager;
        this.currentEntry = null;
        this.container = document.getElementById('detail-view-container');
        this.backButton = document.getElementById('back-to-home-button');
        this.titleElement = document.getElementById('detail-title');
        this.timestampElement = document.getElementById('detail-timestamp');
        this.descriptionElement = document.getElementById('detail-description');
        this.conversationContainer = document.getElementById('conversation-messages');
        this.followUpSection = document.getElementById('follow-up-section');
        this.questionsContainer = document.getElementById('follow-up-questions');
        this.recordButton = document.getElementById('detail-record-button');
        this.stopButton = document.getElementById('detail-stop-button');
        this.transcriptPreview = document.getElementById('detail-transcript-preview');
        this.recordingIndicator = document.querySelector('.detail-recording-indicator');
        
        // Recording state
        this.recognition = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.currentTranscript = '';
        this.currentPrompt = null;
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        this.backButton.addEventListener('click', () => {
            // Stop any recording in progress
            if (this.isRecording) {
                this.stopRecording();
            }
            this.hide();
        });
        
        this.recordButton.addEventListener('click', () => {
            this.startRecording();
        });
        
        this.stopButton.addEventListener('click', () => {
            this.stopRecording();
        });
    }
    
    async showEntry(entry) {
        this.currentEntry = entry;
        
        // Set entry details
        this.titleElement.textContent = entry.title || 'Journal Entry';
        this.timestampElement.textContent = entry.timestamp;
        this.descriptionElement.textContent = entry.description || '';
        
        // Reset recording UI
        this.resetRecordingUI();
        
        // Display conversation messages
        this.renderConversation();
        
        // Generate follow-up questions if they don't exist
        if (!entry.followUpQuestions) {
            try {
                this.questionsContainer.innerHTML = '<div class="loading">Generating questions...</div>';
                const questions = await gptService.generateFollowUpQuestions(entry.text);
                entry.followUpQuestions = questions;
                // Save the updated entry
                this.transcriptManager.updateEntry(entry);
            } catch (error) {
                console.error('Failed to generate follow-up questions:', error);
                entry.followUpQuestions = [
                    "What more can you share about this topic?",
                    "How did this experience make you feel?",
                    "What insights have you gained from this reflection?"
                ];
            }
        }
        
        // Display follow-up questions
        this.renderFollowUpQuestions(entry.followUpQuestions);
        
        // Show the detail view
        this.container.classList.remove('hidden');
    }
    
    renderConversation() {
        this.conversationContainer.innerHTML = '';
        
        if (!this.currentEntry.messages) {
            // Convert older entries to the new format
            this.currentEntry.messages = [];
            
            // If there was a context prompt, add it
            if (this.currentEntry.contextPrompt) {
                this.currentEntry.messages.push({
                    type: 'prompt',
                    content: this.currentEntry.contextPrompt,
                    timestamp: this.currentEntry.timestamp,
                    isPrompt: true
                });
            }
            
            // Add the main transcript message
            this.currentEntry.messages.push({
                type: 'user',
                content: this.currentEntry.text,
                timestamp: this.currentEntry.timestamp,
                audioUrl: this.currentEntry.audioUrl
            });
            
            // Update the entry in the manager
            this.transcriptManager.updateEntry(this.currentEntry);
        }
        
        // Render all messages
        this.currentEntry.messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${message.type}-message`;
            
            // Message content
            const contentElement = document.createElement('div');
            contentElement.className = 'message-content';
            contentElement.textContent = message.content;
            messageElement.appendChild(contentElement);
            
            // Message timestamp
            if (message.timestamp) {
                const timestampElement = document.createElement('div');
                timestampElement.className = 'message-timestamp';
                timestampElement.textContent = message.timestamp;
                messageElement.appendChild(timestampElement);
            }
            
            // Audio player if available
            if (message.audioUrl) {
                const audioElement = document.createElement('div');
                audioElement.className = 'message-audio';
                
                const playButton = document.createElement('button');
                playButton.className = 'play-button';
                playButton.textContent = '▶️ Play';
                
                playButton.addEventListener('click', () => {
                    this.playAudio(message.audioUrl, playButton);
                });
                
                audioElement.appendChild(playButton);
                messageElement.appendChild(audioElement);
            }
            
            this.conversationContainer.appendChild(messageElement);
        });
        
        // Scroll to the bottom
        this.conversationContainer.scrollTop = this.conversationContainer.scrollHeight;
    }
    
    renderFollowUpQuestions(questions) {
        this.questionsContainer.innerHTML = '';
        
        questions.forEach(question => {
            const questionElement = document.createElement('div');
            questionElement.className = 'follow-up-question';
            questionElement.textContent = question;
            
            // Add click event to start recording with this question
            questionElement.addEventListener('click', () => {
                // Set the question as context for the next recording
                this.currentPrompt = question;
                
                // Hide follow-up questions while recording
                this.followUpSection.classList.add('hidden');
                
                // Start a new recording
                this.startRecording();
            });
            
            this.questionsContainer.appendChild(questionElement);
        });
    }
    
    setupSpeechRecognition() {
        // Check if browser supports speech recognition
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Speech recognition is not supported in this browser. Try Chrome or Edge.');
            return null;
        }
        
        // Create speech recognition instance
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognitionInstance = new SpeechRecognition();
        
        // Configure recognition
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = true;
        recognitionInstance.lang = 'en-US'; // Set language
        
        // Set up event handlers
        recognitionInstance.onresult = (event) => {
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    this.currentTranscript += result[0].transcript + ' ';
                } else {
                    interimTranscript += result[0].transcript;
                }
            }
            
            // Update the transcript preview in real-time
            this.transcriptPreview.innerHTML = 'Transcript: ' + this.currentTranscript + 
                (interimTranscript ? '<i style="color: #999"> ' + interimTranscript + '</i>' : '');
        };
        
        recognitionInstance.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isRecording = false;
            this.updateRecordingUI();
        };
        
        recognitionInstance.onend = () => {
            if (this.isRecording) {
                try {
                    recognitionInstance.start();
                } catch (error) {
                    console.error('Error restarting speech recognition:', error);
                    this.isRecording = false;
                    this.updateRecordingUI();
                }
            }
        };
        
        return recognitionInstance;
    }
    
    async setupAudioRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            return mediaRecorder;
        } catch (error) {
            alert('Could not access your microphone. Please check permissions and try again.');
            return null;
        }
    }
    
    async startRecording() {
        this.currentTranscript = '';
        this.audioChunks = [];
        
        // Setup speech recognition if not already
        if (!this.recognition) {
            this.recognition = this.setupSpeechRecognition();
            if (!this.recognition) return;
        }
        
        // Setup audio recording if not already
        if (!this.mediaRecorder) {
            this.mediaRecorder = await this.setupAudioRecording();
            if (!this.mediaRecorder) return;
        }
        
        // If there's a prompt, add it to the conversation first
        if (this.currentPrompt) {
            const promptMessage = document.createElement('div');
            promptMessage.className = 'message prompt-message';
            
            const contentElement = document.createElement('div');
            contentElement.className = 'message-content';
            contentElement.textContent = this.currentPrompt;
            promptMessage.appendChild(contentElement);
            
            const timestampElement = document.createElement('div');
            timestampElement.className = 'message-timestamp';
            timestampElement.textContent = new Date().toLocaleString();
            promptMessage.appendChild(timestampElement);
            
            this.conversationContainer.appendChild(promptMessage);
            this.conversationContainer.scrollTop = this.conversationContainer.scrollHeight;
        }
        
        // Update UI to show recording
        this.isRecording = true;
        this.updateRecordingUI();
        
        // Start recording
        try {
            this.recognition.start();
            this.mediaRecorder.start();
        } catch (error) {
            console.error('Error starting recording:', error);
            this.isRecording = false;
            this.updateRecordingUI();
        }
    }
    
    stopRecording() {
        // Stop speech recognition
        if (this.recognition) {
            this.recognition.stop();
        }
        
        // Capture the final transcript
        const finalTranscript = this.currentTranscript.trim();
        
        // Stop the audio recording
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            
            // Process the recording when it stops
            this.mediaRecorder.onstop = async () => {
                if (finalTranscript) {
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    
                    // Add this message to the current entry
                    await this.transcriptManager.addMessageToEntry(
                        this.currentEntry.id,
                        finalTranscript,
                        audioBlob,
                        audioUrl,
                        this.currentPrompt
                    );
                    
                    // Clear the current prompt
                    this.currentPrompt = null;
                    
                    // Update the current entry
                    this.currentEntry = this.transcriptManager.getEntryById(this.currentEntry.id);
                    
                    // Render the updated conversation
                    this.renderConversation();
                    
                    // Show follow-up questions again
                    this.followUpSection.classList.remove('hidden');
                }
                
                // Reset recording state
                this.audioChunks = [];
                this.currentTranscript = '';
                this.transcriptPreview.innerHTML = 'Transcript: ';
                
                // Reset UI
                this.isRecording = false;
                this.updateRecordingUI();
            };
        } else {
            // No audio recording, just reset UI
            this.isRecording = false;
            this.updateRecordingUI();
            
            // Show follow-up questions
            this.followUpSection.classList.remove('hidden');
        }
    }
    
    updateRecordingUI() {
        if (this.isRecording) {
            this.recordButton.classList.add('hidden');
            this.stopButton.classList.remove('hidden');
            this.recordingIndicator.classList.remove('hidden');
        } else {
            this.recordButton.classList.remove('hidden');
            this.stopButton.classList.add('hidden');
            this.recordingIndicator.classList.add('hidden');
        }
    }
    
    resetRecordingUI() {
        this.isRecording = false;
        this.currentTranscript = '';
        this.transcriptPreview.innerHTML = 'Transcript: ';
        this.updateRecordingUI();
        this.followUpSection.classList.remove('hidden');
    }
    
    playAudio(audioUrl, buttonElement) {
        const audio = new Audio(audioUrl);
        
        // Reset all buttons first
        document.querySelectorAll('.play-button').forEach(btn => {
            btn.textContent = '▶️ Play';
        });
        
        if (buttonElement.textContent === '▶️ Play') {
            buttonElement.textContent = '⏸️ Pause';
            audio.play();
            
            audio.onended = () => {
                buttonElement.textContent = '▶️ Play';
            };
        } else {
            buttonElement.textContent = '▶️ Play';
            audio.pause();
        }
    }
    
    hide() {
        // Stop any playing audio
        document.querySelectorAll('.play-button').forEach(btn => {
            if (btn.textContent === '⏸️ Pause') {
                btn.click(); // Trigger the pause behavior
            }
        });
        
        // Stop any recording in progress
        if (this.isRecording) {
            this.stopRecording();
        }
        
        // Hide the container
        this.container.classList.add('hidden');
    }
}

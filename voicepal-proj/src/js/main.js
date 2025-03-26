//import API keys
let recognition;
let transcript = '';
let transcriptHistory = [];
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let currentAudio = null;

import { config } from '../config/config.js';
import { TranscriptManager } from './transcriptManager.js';
import { DetailView } from './detailView.js';

// Global variable to store the media stream
let globalMediaStream = null;

// Initialize a single instance
const transcriptManager = new TranscriptManager();
const detailView = new DetailView(transcriptManager);

// Enhanced debugging
function debugLog(component, action, data = null) {
    const timestamp = new Date().toISOString().substr(11, 12);
    const message = `[${timestamp}] [${component}] ${action}`;
    
    if (data) {
        console.log(message, data);
    } else {
        console.log(message);
    }
}

// Override console.error for better visibility
const originalError = console.error;
console.error = function(msg, ...args) {
    debugLog('ERROR', msg, ...args);
    originalError.apply(console, [msg, ...args]);
}; 

// Debug function to check if elements exist
function checkElements() {
    console.log('Checking elements:');
    console.log('transcript-history exists:', !!document.getElementById('transcript-history'));
    console.log('transcript exists:', !!document.getElementById('transcript'));
    console.log('toggleRecording exists:', !!document.getElementById('toggleRecording'));
    console.log('Current history length:', transcriptHistory.length);
}

// Call this immediately
window.onload = function() {
    checkElements();
    console.log('Page loaded');
    
    // Force display of any existing history
    if (transcriptHistory.length > 0) {
        console.log('Displaying existing history on load');
        updateTranscriptHistory();
    }
};

function setupSpeechRecognition() {
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
                transcript += result[0].transcript + ' ';
            } else {
                interimTranscript += result[0].transcript;
            }
        }
        
        // Update the transcript display in real-time
        document.getElementById('transcript').innerHTML = 'Transcript: ' + transcript + 
            (interimTranscript ? '<i style="color: #999"> ' + interimTranscript + '</i>' : '');
    };
    
    recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        document.querySelector('.loader-container').style.display = 'none';
        document.getElementById('status').textContent = 'Error: ' + event.error;
        isRecording = false;
        updateRecordButton();
    };
    
    recognitionInstance.onend = () => {
        if (isRecording) {
            try {
                recognitionInstance.start();
            } catch (error) {
                console.error('Error restarting speech recognition:', error);
                isRecording = false;
                updateRecordButton();
            }
        }
    };
    
    return recognitionInstance;
}

// Function to get user media with permissions
async function getUserMedia() {
    if (globalMediaStream) {
        return globalMediaStream;
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        globalMediaStream = stream;
        return stream;
    } catch (error) {
        document.getElementById('status').textContent = 'Microphone access denied';
        throw error;
    }
}

// Setup audio recording
async function setupAudioRecording() {
    try {
        const stream = await getUserMedia();
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            const savedTranscript = mediaRecorder._finalTranscript;
            
            if (savedTranscript && savedTranscript.trim() !== '') {
                try {
                    // Process transcript with TranscriptManager
                    const processedEntry = await transcriptManager.processTranscript(
                        savedTranscript, 
                        audioBlob, 
                        audioUrl
                    );
                    
                    // Update the global transcriptHistory array
                    transcriptHistory = transcriptManager.getHistory();
                    
                    // Update UI
                    updateTranscriptHistory();
                } catch (error) {
                    console.error('Failed to process transcript:', error);
                    
                    // Fallback to simple entry
                    const now = new Date();
                    transcriptHistory.push({
                        text: savedTranscript,
                        timestamp: now.toLocaleString(),
                        audioUrl: audioUrl,
                        audioBlob: audioBlob,
                        id: Date.now().toString()
                    });
                    
                    updateTranscriptHistory();
                }
            }
        };
        
        return true;
    } catch (error) {
        alert('Could not access your microphone. Please check permissions and try again.');
        return false;
    }
}

// Function to toggle recording state
function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

async function startRecording() {
    debugLog('RECORDING', 'Starting recording process');
    
    // Setup speech recognition
    if (!recognition) {
        debugLog('SPEECH', 'Setting up speech recognition');
        recognition = setupSpeechRecognition();
        if (!recognition) {
            debugLog('SPEECH', 'Failed to set up speech recognition');
            return; // Exit if speech recognition isn't supported
        }
    }
    
    // Setup audio recording
    if (!mediaRecorder) {
        debugLog('AUDIO', 'Setting up audio recording');
        const success = await setupAudioRecording();
        if (!success) {
            debugLog('AUDIO', 'Failed to set up audio recording');
            return; // Exit if audio recording setup failed
        }
    }
    
    // Clear current transcript (but keep history)
    transcript = '';
    document.getElementById('transcript').innerHTML = 'Transcript: ';
    
    // Show recording indicator
    document.querySelector('.loader-container').style.display = 'flex';
    document.getElementById('status').textContent = 'Recording...';
    
    // Reset audio chunks for new recording
    audioChunks = [];
    
    // Start recognition and recording
    try {
        debugLog('SPEECH', 'Starting speech recognition');
        recognition.start();
        debugLog('AUDIO', 'Starting media recorder');
        mediaRecorder.start();
        debugLog('RECORDING', 'Speech recognition and audio recording started');
        isRecording = true;
        updateRecordButton();
    } catch (error) {
        debugLog('ERROR', 'Error starting recording', error);
        // Hide recording indicator if start fails
        document.querySelector('.loader-container').style.display = 'none';
        document.getElementById('status').textContent = 'Error starting recording';
        isRecording = false;
        updateRecordButton();
    }
    
    debugLog('RECORDING', 'Recording started');
}

function stopRecording() {
    // Stop speech recognition first to ensure final transcript is captured
    if (recognition) {
        debugLog('SPEECH', 'Stopping speech recognition');
        recognition.stop();
    }
    
    // Small delay to ensure final transcripts are processed
    setTimeout(() => {
        // Now store the transcript after speech recognition has stopped
        const finalTranscript = transcript;
        debugLog('TRANSCRIPT', 'Final transcript captured', finalTranscript);
        
        // Hide recording indicator
        document.querySelector('.loader-container').style.display = 'none';
        document.getElementById('status').textContent = 'Ready to record';
        
        isRecording = false;
        updateRecordButton();
        
        // Only proceed if we have a non-empty transcript
        if (finalTranscript && finalTranscript.trim() !== '') {
            // Stop audio recording - the saving will happen in the onstop event
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                // We'll use the stored transcript in the onstop handler
                mediaRecorder._finalTranscript = finalTranscript;
                mediaRecorder.stop();
                debugLog('AUDIO', 'Audio recording stopped with transcript');
            } else {
                debugLog('AUDIO', 'MediaRecorder not active, saving transcript without audio');
                // Save transcript without audio
                const now = new Date();
                const dateTimeStr = now.toLocaleString();
                
                transcriptHistory.push({
                    text: finalTranscript,
                    timestamp: dateTimeStr
                });
                
                debugLog('HISTORY', 'Added to history without audio', transcriptHistory.length);
                updateTranscriptHistory();
            }
        } else {
            debugLog('TRANSCRIPT', 'Empty transcript, not saving');
            // Still stop the recorder
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                debugLog('AUDIO', 'Audio recording stopped (empty transcript)');
            }
        }
        
        debugLog('RECORDING', 'Recording stopped');
    }, 500); // 500ms delay to ensure transcript is fully processed
}

function updateRecordButton() {
    const recordButton = document.getElementById('toggleRecording');
    if (recordButton) {
        recordButton.textContent = isRecording ? 'Stop Recording' : 'Start Recording';
        recordButton.classList.toggle('recording', isRecording);
    }
}

function playAudio(audioUrl, buttonElement) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
        document.querySelectorAll('.play-button').forEach(btn => {
            btn.textContent = '▶️ Play';
            btn.classList.remove('playing');
        });
    }
    
    if (buttonElement.classList.contains('playing')) {
        return;
    }
    
    const audio = new Audio(audioUrl);
    currentAudio = audio;
    buttonElement.textContent = '⏸️ Pause';
    buttonElement.classList.add('playing');
    audio.play();
    
    audio.onended = () => {
        buttonElement.textContent = '▶️ Play';
        buttonElement.classList.remove('playing');
        currentAudio = null;
    };
    
    audio.onpause = () => {
        buttonElement.textContent = '▶️ Play';
        buttonElement.classList.remove('playing');
    };
}

function updateTranscriptHistory() {
    const historyContainer = document.getElementById('transcript-history');
    if (!historyContainer) return;
    
    historyContainer.innerHTML = transcriptHistory.length === 0 ? 
        '<p>No transcripts recorded yet.</p>' : '';
    
    if (transcriptHistory.length === 0) return;
    
    transcriptHistory.slice().reverse().forEach(entry => {
        const transcriptCard = document.createElement('div');
        transcriptCard.className = 'transcript-card';
        transcriptCard.dataset.entryId = entry.id; // Store the ID for reference
        
        // Make the card clickable to open detail view
        transcriptCard.addEventListener('click', (event) => {
            // Don't open detail view if clicking the play button
            if (event.target.classList.contains('play-button')) return;
            
            // Show the entry detail
            detailView.showEntry(entry);
        });
        
        // Add title if available (from GPT)
        if (entry.title) {
            const titleElement = document.createElement('h3');
            titleElement.className = 'transcript-title';
            titleElement.textContent = entry.title;
            transcriptCard.appendChild(titleElement);
        }
        
        const timestampElement = document.createElement('div');
        timestampElement.className = 'timestamp';
        timestampElement.textContent = entry.timestamp;
        
        // Add a preview of the text instead of the full transcript
        const textPreview = entry.text.length > 100 
            ? entry.text.substring(0, 100) + '...' 
            : entry.text;
            
        const textElement = document.createElement('div');
        textElement.className = 'transcript-preview';
        textElement.textContent = textPreview;
        
        transcriptCard.appendChild(timestampElement);
        
        // Add description if available (from GPT)
        if (entry.description) {
            const descriptionElement = document.createElement('div');
            descriptionElement.className = 'transcript-description';
            descriptionElement.textContent = entry.description;
            transcriptCard.appendChild(descriptionElement);
        }
        
        transcriptCard.appendChild(textElement);
        
        if (entry.audioUrl) {
            const audioControls = document.createElement('div');
            audioControls.className = 'audio-controls';
            
            const playButton = document.createElement('button');
            playButton.className = 'play-button';
            playButton.textContent = '▶️ Play';
            playButton.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent card click
                playAudio(entry.audioUrl, this);
            });
            
            audioControls.appendChild(playButton);
            transcriptCard.appendChild(audioControls);
        }
        
        historyContainer.appendChild(transcriptCard);
    });
}

// Set up the toggle button event listener when the page loads
document.addEventListener('DOMContentLoaded', function() {
    debugLog('INIT', 'DOM fully loaded');
    
    const toggleButton = document.getElementById('toggleRecording');
    if (toggleButton) {
        debugLog('INIT', 'Found recording button, adding event listener');
        toggleButton.addEventListener('click', function(event) {
            debugLog('UI', 'Button clicked');
            toggleRecording();
        });
    } else {
        debugLog('ERROR', 'Recording button not found in DOM');
    }

    updateRecordButton();
    
    // Request microphone permission early
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            stream.getTracks().forEach(track => track.stop());
        })
        .catch(error => {
            console.error('Microphone permission denied:', error);
        });
});

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (globalMediaStream) {
        globalMediaStream.getTracks().forEach(track => track.stop());
    }
});


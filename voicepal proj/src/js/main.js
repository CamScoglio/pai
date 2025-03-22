//import API keys
let recognition;
let transcript = '';
let transcriptHistory = [];
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let currentAudio = null;

import { config } from '../config/config.js';
import { Recorder } from './recorder.js';
import { TranscriptManager } from './transcriptManager.js';
import { ui } from './ui.js';

const recorder = new Recorder();
const transcriptManager = new TranscriptManager();


// Global variable to store the media stream
let globalMediaStream = null;

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
        
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            const savedTranscript = mediaRecorder._finalTranscript;
            
            if (savedTranscript && savedTranscript.trim() !== '') {
                const now = new Date();
                const dateTimeStr = now.toLocaleString();
                
                transcriptHistory.push({
                    text: savedTranscript,
                    timestamp: dateTimeStr,
                    audioUrl: audioUrl,
                    audioBlob: audioBlob
                });
                
                updateTranscriptHistory();
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
    if (!recognition) {
        recognition = setupSpeechRecognition();
        if (!recognition) return;
    }
    
    if (!mediaRecorder) {
        const success = await setupAudioRecording();
        if (!success) return;
    }
    
    transcript = '';
    document.getElementById('transcript').innerHTML = 'Transcript: ';
    document.querySelector('.loader-container').style.display = 'flex';
    document.getElementById('status').textContent = 'Recording...';
    audioChunks = [];
    
    try {
        recognition.start();
        mediaRecorder.start();
        isRecording = true;
        updateRecordButton();
    } catch (error) {
        console.error('Error starting recording:', error);
        document.querySelector('.loader-container').style.display = 'none';
        document.getElementById('status').textContent = 'Error starting recording';
        isRecording = false;
        updateRecordButton();
    }
}

function stopRecording() {
    // Stop and cleanup speech recognition
    if (recognition) {
        recognition.stop();
        recognition = null;
    }
    
    // Stop and cleanup mediaRecorder
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder._finalTranscript = transcript;
        mediaRecorder.stop();
    }
    
    // Update UI state
    document.querySelector('.loader-container').style.display = 'none';
    document.getElementById('status').textContent = 'Ready to record';
    isRecording = false;
    updateRecordButton();
    
    // Save transcript if we have content
    if (transcript && transcript.trim()) {
        const now = new Date();
        const dateTimeStr = now.toLocaleString();
        
        // The audio will be saved in the mediaRecorder's onstop handler
        // If mediaRecorder wasn't active, save without audio
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            transcriptHistory.push({
                text: transcript,
                timestamp: dateTimeStr
            });
            updateTranscriptHistory();
        }
    }
    
    // Cleanup
    mediaRecorder = null;
    audioChunks = [];
    transcript = '';
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
        
        const timestampElement = document.createElement('div');
        timestampElement.className = 'timestamp';
        timestampElement.textContent = entry.timestamp;
        
        const textElement = document.createElement('div');
        textElement.className = 'transcript-text';
        textElement.textContent = entry.text;
        
        transcriptCard.appendChild(timestampElement);
        transcriptCard.appendChild(textElement);
        
        if (entry.audioUrl) {
            const audioControls = document.createElement('div');
            audioControls.className = 'audio-controls';
            
            const playButton = document.createElement('button');
            playButton.className = 'play-button';
            playButton.textContent = '▶️ Play';
            playButton.addEventListener('click', function() {
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
    const toggleButton = document.getElementById('toggleRecording');
    if (toggleButton) {
        toggleButton.addEventListener('click', toggleRecording);
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
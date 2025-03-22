import { config } from '../config/config.js';

export class Recorder {
    constructor() {
        this.recognition = null;
        this.mediaRecorder = null;
        this.globalMediaStream = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.transcript = '';
    }

    async setupSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            throw new Error('Speech recognition is not supported in this browser. Try Chrome or Edge.');
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = config.SPEECH_RECOGNITION_LANGUAGE;
        
        return this.recognition;
    }

    async getUserMedia() {
        if (this.globalMediaStream) {
            return this.globalMediaStream;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.globalMediaStream = stream;
            return stream;
        } catch (error) {
            throw new Error('Microphone access denied');
        }
    }

    async setupAudioRecording() {
        const stream = await this.getUserMedia();
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];
        return this.mediaRecorder;
    }

    cleanup() {
        if (this.globalMediaStream) {
            this.globalMediaStream.getTracks().forEach(track => track.stop());
        }
        this.recognition = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.transcript = '';
    }
} 
export class UI {
    constructor() {
        this.currentAudio = null;
    }

    updateTranscriptDisplay(transcript, interimTranscript = '') {
        document.getElementById('transcript').innerHTML = 'Transcript: ' + transcript + 
            (interimTranscript ? '<i style="color: #999"> ' + interimTranscript + '</i>' : '');
    }

    updateRecordButton(isRecording) {
        const recordButton = document.getElementById('toggleRecording');
        if (recordButton) {
            recordButton.textContent = isRecording ? 'Stop Recording' : 'Start Recording';
            recordButton.classList.toggle('recording', isRecording);
        }
    }

    updateTranscriptHistory(entries) {
        const historyContainer = document.getElementById('transcript-history');
        if (!historyContainer) return;
        
        historyContainer.innerHTML = entries.length === 0 ? 
            '<p>No transcripts recorded yet.</p>' : '';
        
        if (entries.length === 0) return;
        
        entries.slice().reverse().forEach(entry => this.createTranscriptCard(entry, historyContainer));
    }

    createTranscriptCard(entry, container) {
        const card = document.createElement('div');
        card.className = 'transcript-card';
        
        // Add title
        const titleElement = document.createElement('h3');
        titleElement.className = 'title';
        titleElement.textContent = entry.title;
        
        // Add description
        const descriptionElement = document.createElement('p');
        descriptionElement.className = 'description';
        descriptionElement.textContent = entry.description;
        
        // Add timestamp and transcript
        const timestampElement = document.createElement('div');
        timestampElement.className = 'timestamp';
        timestampElement.textContent = entry.timestamp;
        
        const textElement = document.createElement('div');
        textElement.className = 'transcript-text';
        textElement.textContent = entry.text;
        
        card.appendChild(titleElement);
        card.appendChild(descriptionElement);
        card.appendChild(timestampElement);
        card.appendChild(textElement);
        
        if (entry.audioUrl) {
            this.addAudioControls(card, entry.audioUrl);
        }
        
        container.appendChild(card);
    }

    addAudioControls(card, audioUrl) {
        const audioControls = document.createElement('div');
        audioControls.className = 'audio-controls';
        
        const playButton = document.createElement('button');
        playButton.className = 'play-button';
        playButton.textContent = '▶️ Play';
        playButton.addEventListener('click', () => this.playAudio(audioUrl, playButton));
        
        audioControls.appendChild(playButton);
        card.appendChild(audioControls);
    }

    playAudio(audioUrl, buttonElement) {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
            document.querySelectorAll('.play-button').forEach(btn => {
                btn.textContent = '▶️ Play';
                btn.classList.remove('playing');
            });
        }
        
        if (buttonElement.classList.contains('playing')) {
            return;
        }
        
        const audio = new Audio(audioUrl);
        this.currentAudio = audio;
        buttonElement.textContent = '⏸️ Pause';
        buttonElement.classList.add('playing');
        audio.play();
        
        audio.onended = () => {
            buttonElement.textContent = '▶️ Play';
            buttonElement.classList.remove('playing');
            this.currentAudio = null;
        };
        
        audio.onpause = () => {
            buttonElement.textContent = '▶️ Play';
            buttonElement.classList.remove('playing');
        };
    }
}

export const ui = new UI();
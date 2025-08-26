// UIController - Manages all user interface interactions
class UIController {
    constructor() {
        this.audioEngine = null;
        this.playlist = [];
        this.currentIndex = -1;
        this.currentTrack = null;
        
        // DOM elements
        this.elements = {};
        
        // Initialize after DOM is ready
        this.initializeElements();
        this.bindEvents();
    }
    
    setAudioEngine(audioEngine) {
        this.audioEngine = audioEngine;
    }
    
    async initialize() {
        try {
            await this.loadFileList();
            this.updateSystemStatus('UI Controller initialized');
            this.updateControls(false, false);
            this.updateVolume(0.5);
            return true;
        } catch (error) {
            this.updateSystemStatus('UI initialization failed: ' + error.message);
            throw error;
        }
    }
    
    initializeElements() {
        // Cache DOM elements
        this.elements = {
            fileList: document.getElementById('fileList'),
            trackTitle: document.getElementById('trackTitle'),
            trackInfo: document.getElementById('trackInfo'),
            currentTime: document.getElementById('currentTime'),
            totalTime: document.getElementById('totalTime'),
            progressBar: document.getElementById('progressBar'),
            progressFill: document.getElementById('progressFill'),
            volumeSlider: document.getElementById('volumeSlider'),
            volumeFill: document.getElementById('volumeFill'),
            volumeDisplay: document.getElementById('volumeDisplay'),
            systemStatus: document.getElementById('systemStatus'),
            uploadArea: document.getElementById('uploadArea'),
            fileInput: document.getElementById('fileInput'),
            
            // Control buttons
            playBtn: document.getElementById('playBtn'),
            pauseBtn: document.getElementById('pauseBtn'),
            stopBtn: document.getElementById('stopBtn'),
            prevBtn: document.getElementById('prevBtn'),
            nextBtn: document.getElementById('nextBtn')
        };
    }
    
    bindEvents() {
        // Control buttons
        if (this.elements.playBtn) {
            this.elements.playBtn.addEventListener('click', () => this.handlePlay());
        }
        if (this.elements.pauseBtn) {
            this.elements.pauseBtn.addEventListener('click', () => this.handlePause());
        }
        if (this.elements.stopBtn) {
            this.elements.stopBtn.addEventListener('click', () => this.handleStop());
        }
        if (this.elements.prevBtn) {
            this.elements.prevBtn.addEventListener('click', () => this.previousTrack());
        }
        if (this.elements.nextBtn) {
            this.elements.nextBtn.addEventListener('click', () => this.nextTrack());
        }
        
        // Volume control
        if (this.elements.volumeSlider) {
            this.elements.volumeSlider.addEventListener('click', (e) => {
                const rect = e.target.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const width = rect.width;
                const volume = x / width;
                this.setVolume(volume);
            });
        }
        
        // Progress bar
        if (this.elements.progressBar) {
            this.elements.progressBar.addEventListener('click', (e) => {
                if (this.audioEngine && this.audioEngine.isPlaying && this.audioEngine.getDuration() > 0) {
                    const rect = e.target.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const width = rect.width;
                    const time = (x / width) * this.audioEngine.getDuration();
                    this.seek(time);
                }
            });
        }
        
        // File upload
        this.bindUploadEvents();
        
        // Keyboard shortcuts
        this.bindKeyboardEvents();
    }
    
    bindUploadEvents() {
        const uploadArea = this.elements.uploadArea;
        const fileInput = this.elements.fileInput;
        
        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', () => fileInput.click());
            
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                this.handleFiles(e.dataTransfer.files);
            });
            
            fileInput.addEventListener('change', (e) => {
                this.handleFiles(e.target.files);
            });
        }
    }
    
    bindKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            // Prevent default only for our hotkeys
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.togglePlayPause();
                    break;
                case 'ArrowRight':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.nextTrack();
                    }
                    break;
                case 'ArrowLeft':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.previousTrack();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.handleStop();
                    break;
            }
        });
    }
    
    async loadFileList() {
        try {
            const response = await fetch('/api/music-files');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const files = await response.json();
            this.playlist = files;
            this.renderFileList();
            
            this.updateSystemStatus(`Loaded ${files.length} files`);
        } catch (error) {
            console.error('Error loading file list:', error);
            this.showError('Failed to load file list: ' + error.message);
            this.renderFileList(); // Render empty list
        }
    }
    
    renderFileList() {
        if (!this.elements.fileList) return;
        
        if (this.playlist.length === 0) {
            this.elements.fileList.innerHTML = '<div style="text-align: center; padding: 20px; color: #00aa00;">No music files found</div>';
            return;
        }
        
        this.elements.fileList.innerHTML = this.playlist.map((file, index) => {
            const icon = this.getFileIcon(file.type);
            return `
                <div class="file-item" data-index="${index}" onclick="uiController.selectTrack(${index})">
                    ${icon} ${file.filename} (${file.displaySize})
                </div>
            `;
        }).join('');
        
        // Re-select current track if it exists
        if (this.currentIndex >= 0) {
            this.highlightTrack(this.currentIndex);
        }
    }
    
    getFileIcon(type) {
        switch (type) {
            case 'tracker': return '♪';
            case 'midi': return '♫';
            case 'soundfont': return '♬';
            default: return '♪';
        }
    }
    
    selectTrack(index) {
        if (index < 0 || index >= this.playlist.length) {
            console.warn('Invalid track index:', index);
            return;
        }
        
        // Update selection
        this.currentIndex = index;
        this.currentTrack = this.playlist[index];
        
        // Update UI
        this.highlightTrack(index);
        this.updateTrackInfo();
        
        this.updateSystemStatus(`Selected: ${this.currentTrack.filename}`);
    }
    
    highlightTrack(index) {
        // Remove all highlights
        document.querySelectorAll('.file-item').forEach(item => {
            item.classList.remove('selected', 'playing');
        });
        
        // Add selection highlight
        const fileItem = document.querySelector(`[data-index="${index}"]`);
        if (fileItem) {
            fileItem.classList.add('selected');
            
            // Add playing highlight if currently playing
            if (this.audioEngine && this.audioEngine.isPlaying) {
                fileItem.classList.add('playing');
            }
        }
    }
    
    updateTrackInfo() {
        if (!this.currentTrack) return;
        
        if (this.elements.trackTitle) {
            this.elements.trackTitle.textContent = this.currentTrack.filename;
        }
        
        if (this.elements.trackInfo) {
            const info = `Type: ${this.currentTrack.type.toUpperCase()} | Size: ${this.currentTrack.displaySize} | Modified: ${new Date(this.currentTrack.modified).toLocaleDateString()}`;
            this.elements.trackInfo.textContent = info;
        }
    }
    
    async handlePlay() {
        if (!this.currentTrack) {
            this.showError('Please select a track first');
            return;
        }
        
        if (!this.audioEngine) {
            this.showError('Audio engine not available');
            return;
        }
        
        try {
            await this.audioEngine.playTrack(this.currentTrack);
            this.highlightTrack(this.currentIndex); // Update playing status
        } catch (error) {
            this.showError('Playback error: ' + error.message);
        }
    }
    
    handlePause() {
        if (this.audioEngine) {
            this.audioEngine.pause();
        }
    }
    
    handleStop() {
        if (this.audioEngine) {
            this.audioEngine.stop();
        }
        
        // Remove playing highlights
        document.querySelectorAll('.file-item').forEach(item => {
            item.classList.remove('playing');
        });
    }
    
    togglePlayPause() {
        if (!this.audioEngine) return;
        
        const state = this.audioEngine.getPlayState();
        
        if (state.isPlaying) {
            this.handlePause();
        } else if (state.isPaused) {
            this.audioEngine.resume();
        } else {
            this.handlePlay();
        }
    }
    
    seek(time) {
        if (this.audioEngine) {
            this.audioEngine.seek(time);
        }
    }
    
    setVolume(level) {
        const volume = Math.max(0, Math.min(1, level));
        
        if (this.audioEngine) {
            this.audioEngine.setVolume(volume);
        }
        
        this.updateVolumeUI(volume);
    }
    
    updateVolumeUI(volume) {
        if (this.elements.volumeFill) {
            this.elements.volumeFill.style.width = (volume * 100) + '%';
        }
        if (this.elements.volumeDisplay) {
            this.elements.volumeDisplay.textContent = Math.round(volume * 100) + '%';
        }
    }
    
    previousTrack() {
        if (this.currentIndex > 0) {
            this.selectTrack(this.currentIndex - 1);
            if (this.audioEngine && this.audioEngine.isPlaying) {
                this.handlePlay();
            }
        }
    }
    
    nextTrack() {
        if (this.currentIndex < this.playlist.length - 1) {
            this.selectTrack(this.currentIndex + 1);
            if (this.audioEngine && this.audioEngine.isPlaying) {
                this.handlePlay();
            }
        } else {
            // End of playlist
            this.handleStop();
        }
    }
    
    updateControls(isPlaying, isPaused) {
        if (this.elements.playBtn) {
            this.elements.playBtn.disabled = isPlaying;
        }
        if (this.elements.pauseBtn) {
            this.elements.pauseBtn.disabled = !isPlaying;
        }
        if (this.elements.stopBtn) {
            this.elements.stopBtn.disabled = !isPlaying && !isPaused;
        }
        
        // Update playing highlight
        if (isPlaying && this.currentIndex >= 0) {
            this.highlightTrack(this.currentIndex);
        } else if (!isPlaying) {
            document.querySelectorAll('.file-item').forEach(item => {
                item.classList.remove('playing');
            });
        }
    }
    
    updateProgress(currentTime, duration) {
        if (duration > 0) {
            const progress = (currentTime / duration) * 100;
            if (this.elements.progressFill) {
                this.elements.progressFill.style.width = progress + '%';
            }
        }
        
        if (this.elements.currentTime) {
            this.elements.currentTime.textContent = this.formatTime(currentTime);
        }
        if (this.elements.totalTime) {
            this.elements.totalTime.textContent = this.formatTime(duration);
        }
    }
    
    updateVolume(volume) {
        this.updateVolumeUI(volume);
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    async handleFiles(files) {
        const uploadResults = [];
        
        for (let file of files) {
            const formData = new FormData();
            formData.append('musicFile', file);
            
            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    const result = await response.json();
                    uploadResults.push(`✓ ${file.name}`);
                    this.updateSystemStatus(`Uploaded: ${file.name}`);
                } else {
                    const error = await response.json();
                    uploadResults.push(`✗ ${file.name}: ${error.error || 'Upload failed'}`);
                }
            } catch (error) {
                uploadResults.push(`✗ ${file.name}: ${error.message}`);
                console.error('Upload error:', error);
            }
        }
        
        // Show results
        if (uploadResults.length > 0) {
            const summary = uploadResults.join('\n');
            this.showMessage('Upload Results:\n' + summary);
        }
        
        // Reload file list
        await this.loadFileList();
    }
    
    showError(message) {
        console.error('UI Error:', message);
        this.updateSystemStatus(`ERROR: ${message}`);
        
        // Show visual error indication
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message;
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '20px';
        errorDiv.style.right = '20px';
        errorDiv.style.zIndex = '9999';
        errorDiv.style.maxWidth = '300px';
        
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }
    
    showMessage(message) {
        console.log('UI Message:', message);
        this.updateSystemStatus(message);
    }
    
    updateSystemStatus(message) {
        const timestamp = new Date().toLocaleTimeString();
        const statusMessage = `[${timestamp}] ${message}`;
        
        if (this.elements.systemStatus) {
            this.elements.systemStatus.textContent = statusMessage;
        }
        
        console.log('System:', statusMessage);
    }
    
    // Public methods for external access
    getCurrentTrack() {
        return this.currentTrack;
    }
    
    getPlaylist() {
        return this.playlist;
    }
    
    getCurrentIndex() {
        return this.currentIndex;
    }
}

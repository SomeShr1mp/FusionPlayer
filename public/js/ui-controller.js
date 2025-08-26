// Enhanced UIController - Manages all user interface interactions with improved error handling
class UIController {
    constructor() {
        this.elements = {};
        this.audioEngine = null;
        this.playlist = [];
        this.currentTrack = null;
        this.currentIndex = -1;
        this.volumeValue = 0.5;
        
        // Enhanced state tracking
        this.isInitialized = false;
        this.dragAndDropEnabled = false;
        this.keyboardShortcutsEnabled = false;
        this.lastProgressUpdate = 0;
        
        // Error handling
        this.errorDisplayTimeout = null;
        this.statusUpdateQueue = [];
        
        // UI state
        this.uiState = {
            isPlaying: false,
            isPaused: false,
            volume: 0.5,
            currentTime: 0,
            duration: 0
        };
        
        console.log('🎛️ UIController v2.0 initialized');
    }
    
    async initialize() {
        try {
            this.updateSystemStatus('Initializing UI controller...');
            
            // Get all DOM elements with error handling
            this.initializeElements();
            
            // Setup event listeners with enhanced error handling
            this.setupEventListeners();
            
            // Initialize drag and drop
            this.initializeDragAndDrop();
            
            // Load initial file list
            await this.loadFileList();
            
            // Setup keyboard shortcuts
            this.initializeKeyboardShortcuts();
            
            // Initialize volume control
            this.initializeVolumeControl();
            
            // Setup progress bar interaction
            this.initializeProgressControl();
            
            this.isInitialized = true;
            this.updateSystemStatus('UI controller ready ✓');
            console.log('✅ UIController initialized successfully');
            
        } catch (error) {
            console.error('UIController initialization failed:', error);
            this.showError('UI initialization failed: ' + error.message);
            throw error;
        }
    }
    
    initializeElements() {
        const elementIds = [
            'fileList', 'uploadArea', 'fileInput',
            'trackTitle', 'trackInfo', 'progressBar', 'progressFill',
            'currentTime', 'totalTime', 'volumeSlider', 'volumeFill', 'volumeDisplay',
            'playBtn', 'pauseBtn', 'stopBtn', 'prevBtn', 'nextBtn',
            'systemStatus', 'systemMode',
            'audioContextStatus', 'audioWorkletStatus', 'openmptStatus', 'fluidsynthStatus',
            'errorDisplay', 'errorMessage', 'errorClose'
        ];
        
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.elements[id] = element;
            } else {
                console.warn(`⚠️ Element not found: ${id}`);
            }
        });
        
        // Validate critical elements
        const criticalElements = ['fileList', 'playBtn', 'systemStatus'];
        const missingCritical = criticalElements.filter(id => !this.elements[id]);
        
        if (missingCritical.length > 0) {
            throw new Error(`Critical UI elements missing: ${missingCritical.join(', ')}`);
        }
        
        console.log('✅ UI elements initialized');
    }
    
    setupEventListeners() {
        try {
            // Enhanced button event handlers with error boundaries
            if (this.elements.playBtn) {
                this.elements.playBtn.addEventListener('click', () => this.safeExecute(() => this.handlePlay()));
            }
            if (this.elements.pauseBtn) {
                this.elements.pauseBtn.addEventListener('click', () => this.safeExecute(() => this.handlePause()));
            }
            if (this.elements.stopBtn) {
                this.elements.stopBtn.addEventListener('click', () => this.safeExecute(() => this.handleStop()));
            }
            if (this.elements.prevBtn) {
                this.elements.prevBtn.addEventListener('click', () => this.safeExecute(() => this.handlePrev()));
            }
            if (this.elements.nextBtn) {
                this.elements.nextBtn.addEventListener('click', () => this.safeExecute(() => this.handleNext()));
            }
            
            // File input handler
            if (this.elements.fileInput) {
                this.elements.fileInput.addEventListener('change', (e) => {
                    this.safeExecute(() => this.handleFiles(Array.from(e.target.files)));
                });
            }
            
            // Upload area click handler
            if (this.elements.uploadArea) {
                this.elements.uploadArea.addEventListener('click', () => {
                    this.safeExecute(() => {
                        if (this.elements.fileInput) {
                            this.elements.fileInput.click();
                        }
                    });
                });
            }
            
            // Error close handler
            if (this.elements.errorClose) {
                this.elements.errorClose.addEventListener('click', () => {
                    this.hideError();
                });
            }
            
            console.log('✅ Event listeners setup complete');
            
        } catch (error) {
            console.error('Event listener setup failed:', error);
            throw error;
        }
    }
    
    initializeDragAndDrop() {
        if (!this.elements.uploadArea) return;
        
        try {
            const uploadArea = this.elements.uploadArea;
            
            // Enhanced drag and drop with visual feedback
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                uploadArea.classList.add('drag-over');
            });
            
            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                uploadArea.classList.remove('drag-over');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                uploadArea.classList.remove('drag-over');
                
                const files = Array.from(e.dataTransfer.files);
                this.safeExecute(() => this.handleFiles(files));
            });
            
            this.dragAndDropEnabled = true;
            console.log('✅ Drag and drop initialized');
            
        } catch (error) {
            console.warn('Drag and drop initialization failed:', error);
        }
    }
    
    initializeKeyboardShortcuts() {
        try {
            document.addEventListener('keydown', (e) => {
                // Only handle shortcuts when not typing in input fields
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                
                this.safeExecute(() => {
                    switch (e.code) {
                        case 'Space':
                            e.preventDefault();
                            if (this.uiState.isPlaying && !this.uiState.isPaused) {
                                this.handlePause();
                            } else {
                                this.handlePlay();
                            }
                            break;
                        case 'ArrowLeft':
                            e.preventDefault();
                            this.handlePrev();
                            break;
                        case 'ArrowRight':
                            e.preventDefault();
                            this.handleNext();
                            break;
                        case 'Escape':
                            e.preventDefault();
                            this.handleStop();
                            break;
                        case 'ArrowUp':
                            e.preventDefault();
                            this.adjustVolume(0.1);
                            break;
                        case 'ArrowDown':
                            e.preventDefault();
                            this.adjustVolume(-0.1);
                            break;
                    }
                });
            });
            
            this.keyboardShortcutsEnabled = true;
            console.log('✅ Keyboard shortcuts initialized');
            
        } catch (error) {
            console.warn('Keyboard shortcuts initialization failed:', error);
        }
    }
    
    initializeVolumeControl() {
        if (!this.elements.volumeSlider) return;
        
        try {
            const volumeSlider = this.elements.volumeSlider;
            let isDragging = false;
            
            const updateVolumeFromEvent = (e) => {
                const rect = volumeSlider.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percentage = Math.max(0, Math.min(1, x / rect.width));
                
                this.volumeValue = percentage;
                this.updateVolumeUI(percentage);
                
                if (this.audioEngine) {
                    this.audioEngine.setVolume(percentage);
                }
            };
            
            volumeSlider.addEventListener('mousedown', (e) => {
                isDragging = true;
                updateVolumeFromEvent(e);
            });
            
            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    updateVolumeFromEvent(e);
                }
            });
            
            document.addEventListener('mouseup', () => {
                isDragging = false;
            });
            
            // Touch support for mobile
            volumeSlider.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                updateVolumeFromEvent(touch);
            });
            
            volumeSlider.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                updateVolumeFromEvent(touch);
            });
            
            console.log('✅ Volume control initialized');
            
        } catch (error) {
            console.warn('Volume control initialization failed:', error);
        }
    }
    
    initializeProgressControl() {
        if (!this.elements.progressBar) return;
        
        try {
            const progressBar = this.elements.progressBar;
            
            progressBar.addEventListener('click', (e) => {
                if (!this.audioEngine || !this.uiState.isPlaying) return;
                
                const rect = progressBar.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percentage = x / rect.width;
                const seekTime = percentage * this.uiState.duration;
                
                if (this.audioEngine.seekTo) {
                    this.audioEngine.seekTo(seekTime);
                }
            });
            
            console.log('✅ Progress control initialized');
            
        } catch (error) {
            console.warn('Progress control initialization failed:', error);
        }
    }
    
    setAudioEngine(audioEngine) {
        this.audioEngine = audioEngine;
        console.log('✅ Audio engine connected to UI controller');
    }
    
    async loadFileList() {
        try {
            this.updateSystemStatus('Loading file list...');
            
            const response = await fetch('/api/music-files');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const files = await response.json();
            this.playlist = files;
            this.renderFileList();
            
            this.updateSystemStatus(`Loaded ${files.length} files ✓`);
            console.log(`✅ File list loaded: ${files.length} files`);
            
        } catch (error) {
            console.error('Error loading file list:', error);
            this.showError('Failed to load file list: ' + error.message);
            this.renderFileList(); // Render empty list
        }
    }
    
    renderFileList() {
        if (!this.elements.fileList) return;
        
        try {
            if (this.playlist.length === 0) {
                this.elements.fileList.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #00aa00;">
                        <div>No music files found</div>
                        <div style="font-size: 10px; margin-top: 10px; color: #888;">
                            Upload files or check the /music directory
                        </div>
                    </div>
                `;
                return;
            }
            
            this.elements.fileList.innerHTML = this.playlist.map((file, index) => {
                const icon = this.getFileIcon(file.type);
                const sizeInfo = file.displaySize || 'Unknown size';
                const typeInfo = file.type ? file.type.toUpperCase() : 'UNKNOWN';
                
                return `
                    <div class="file-item" data-index="${index}" onclick="uiController.selectTrack(${index})" title="${file.filename}">
                        <div class="file-main">
                            <span class="file-icon">${icon}</span>
                            <span class="file-name">${file.filename}</span>
                            <span class="file-size">(${sizeInfo})</span>
                        </div>
                        <div class="file-meta">
                            <span class="file-type">${typeInfo}</span>
                            ${file.modified ? `<span class="file-date">${new Date(file.modified).toLocaleDateString()}</span>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
            
            // Re-select current track if it exists
            if (this.currentIndex >= 0 && this.currentIndex < this.playlist.length) {
                this.highlightTrack(this.currentIndex);
            }
            
            console.log(`✅ File list rendered: ${this.playlist.length} items`);
            
        } catch (error) {
            console.error('Error rendering file list:', error);
            this.showError('Failed to render file list: ' + error.message);
        }
    }
    
    getFileIcon(type) {
        const icons = {
            'tracker': '♪',
            'midi': '♫',
            'soundfont': '♬',
            'audio': '🎵',
            'unknown': '?'
        };
        
        return icons[type] || icons.unknown;
    }
    
    selectTrack(index) {
        try {
            if (index < 0 || index >= this.playlist.length) {
                console.warn(`Invalid track index: ${index}`);
                return;
            }
            
            // Update selection
            this.currentIndex = index;
            this.currentTrack = this.playlist[index];
            
            // Update UI
            this.highlightTrack(index);
            this.updateTrackInfo();
            
            this.updateSystemStatus(`Selected: ${this.currentTrack.filename}`);
            console.log(`✅ Track selected: ${this.currentTrack.filename}`);
            
        } catch (error) {
            console.error('Error selecting track:', error);
            this.showError('Failed to select track: ' + error.message);
        }
    }
    
    highlightTrack(index) {
        try {
            // Remove all highlights
            document.querySelectorAll('.file-item').forEach(item => {
                item.classList.remove('selected', 'playing');
            });
            
            // Add selection highlight
            const fileItem = document.querySelector(`[data-index="${index}"]`);
            if (fileItem) {
                fileItem.classList.add('selected');
                
                // Add playing highlight if currently playing
                if (this.uiState.isPlaying) {
                    fileItem.classList.add('playing');
                }
                
                // Scroll into view if needed
                fileItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            
        } catch (error) {
            console.error('Error highlighting track:', error);
        }
    }
    
    updateTrackInfo() {
        try {
            if (!this.currentTrack) return;
            
            if (this.elements.trackTitle) {
                this.elements.trackTitle.textContent = this.currentTrack.filename;
            }
            
            if (this.elements.trackInfo) {
                const parts = [];
                if (this.currentTrack.type) parts.push(`Type: ${this.currentTrack.type.toUpperCase()}`);
                if (this.currentTrack.displaySize) parts.push(`Size: ${this.currentTrack.displaySize}`);
                if (this.currentTrack.modified) parts.push(`Modified: ${new Date(this.currentTrack.modified).toLocaleDateString()}`);
                
                this.elements.trackInfo.textContent = parts.join(' | ');
            }
            
        } catch (error) {
            console.error('Error updating track info:', error);
        }
    }
    
    async handlePlay() {
        try {
            if (!this.currentTrack) {
                this.showError('Please select a track first');
                return;
            }
            
            if (!this.audioEngine) {
                this.showError('Audio engine not available');
                return;
            }
            
            // If paused, resume instead of restarting
            if (this.uiState.isPaused) {
                this.audioEngine.resume();
                return;
            }
            
            this.updateSystemStatus(`Starting playback: ${this.currentTrack.filename}...`);
            
            await this.audioEngine.playTrack(this.currentTrack);
            
            this.highlightTrack(this.currentIndex); // Update playing status
            console.log(`✅ Playback started: ${this.currentTrack.filename}`);
            
        } catch (error) {
            console.error('Playback error:', error);
            this.showError('Playback error: ' + error.message);
            this.updateSystemStatus('Playback failed');
        }
    }
    
    handlePause() {
        try {
            if (this.audioEngine && this.uiState.isPlaying) {
                this.audioEngine.pause();
                console.log('⏸️ Playback paused');
            }
        } catch (error) {
            console.error('Pause error:', error);
            this.showError('Pause error: ' + error.message);
        }
    }
    
    handleStop() {
        try {
            if (this.audioEngine) {
                this.audioEngine.stop();
                console.log('⏹️ Playback stopped');
            }
            
            // Remove playing highlights
            document.querySelectorAll('.file-item').forEach(item => {
                item.classList.remove('playing');
            });
            
        } catch (error) {
            console.error('Stop error:', error);
            this.showError('Stop error: ' + error.message);
        }
    }
    
    handlePrev() {
        try {
            if (this.playlist.length === 0) return;
            
            let newIndex = this.currentIndex - 1;
            if (newIndex < 0) newIndex = this.playlist.length - 1;
            
            this.selectTrack(newIndex);
            
            // Auto-play if currently playing
            if (this.uiState.isPlaying) {
                setTimeout(() => this.handlePlay(), 100);
            }
            
        } catch (error) {
            console.error('Previous track error:', error);
            this.showError('Failed to go to previous track: ' + error.message);
        }
    }
    
    handleNext() {
        try {
            if (this.playlist.length === 0) return;
            
            let newIndex = this.currentIndex + 1;
            if (newIndex >= this.playlist.length) newIndex = 0;
            
            this.selectTrack(newIndex);
            
            // Auto-play if currently playing
            if (this.uiState.isPlaying) {
                setTimeout(() => this.handlePlay(), 100);
            }
            
        } catch (error) {
            console.error('Next track error:', error);
            this.showError('Failed to go to next track: ' + error.message);
        }
    }
    
    handleTrackEnd() {
        try {
            console.log('🎵 Track ended');
            this.updateSystemStatus('Track ended');
            
            // Auto-advance to next track
            setTimeout(() => {
                this.handleNext();
            }, 1000);
            
        } catch (error) {
            console.error('Track end handling error:', error);
        }
    }
    
    adjustVolume(delta) {
        const newVolume = Math.max(0, Math.min(1, this.volumeValue + delta));
        this.volumeValue = newVolume;
        this.updateVolumeUI(newVolume);
        
        if (this.audioEngine) {
            this.audioEngine.setVolume(newVolume);
        }
    }
    
    updatePlaybackState(isPlaying, isPaused) {
        this.uiState.isPlaying = isPlaying;
        this.uiState.isPaused = isPaused;
        
        // Update button states
        if (this.elements.playBtn) {
            this.elements.playBtn.disabled = isPlaying && !isPaused;
        }
        if (this.elements.pauseBtn) {
            this.elements.pauseBtn.disabled = !isPlaying || isPaused;
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
        try {
            this.uiState.currentTime = currentTime;
            this.uiState.duration = duration;
            
            // Throttle progress updates to avoid excessive DOM manipulation
            const now = performance.now();
            if (now - this.lastProgressUpdate < 100) return;
            this.lastProgressUpdate = now;
            
            if (duration > 0 && this.elements.progressFill) {
                const progress = (currentTime / duration) * 100;
                this.elements.progressFill.style.width = Math.min(100, Math.max(0, progress)) + '%';
            }
            
            if (this.elements.currentTime) {
                this.elements.currentTime.textContent = this.formatTime(currentTime);
            }
            if (this.elements.totalTime) {
                this.elements.totalTime.textContent = this.formatTime(duration);
            }
            
        } catch (error) {
            console.warn('Progress update error:', error);
        }
    }
    
    updateVolume(volume) {
        this.volumeValue = volume;
        this.updateVolumeUI(volume);
    }
    
    updateVolumeUI(volume) {
        try {
            const percentage = Math.round(volume * 100);
            
            if (this.elements.volumeFill) {
                this.elements.volumeFill.style.width = percentage + '%';
            }
            if (this.elements.volumeDisplay) {
                this.elements.volumeDisplay.textContent = percentage + '%';
            }
            
        } catch (error) {
            console.warn('Volume UI update error:', error);
        }
    }
    
    formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) return '00:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    async handleFiles(files) {
        try {
            const uploadResults = [];
            
            this.updateSystemStatus('Uploading files...');
            
            for (let file of files) {
                try {
                    const formData = new FormData();
                    formData.append('musicFile', file);
                    
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
                        uploadResults.push(`✗ ${file.name}: ${error.message || 'Upload failed'}`);
                    }
                    
                } catch (error) {
                    uploadResults.push(`✗ ${file.name}: ${error.message}`);
                }
            }
            
            // Show upload results
            const successCount = uploadResults.filter(r => r.startsWith('✓')).length;
            const message = `Upload complete: ${successCount}/${files.length} files`;
            this.updateSystemStatus(message);
            
            // Reload file list
            await this.loadFileList();
            
        } catch (error) {
            console.error('File upload error:', error);
            this.showError('Upload failed: ' + error.message);
        }
    }
    
    showError(message) {
        try {
            console.error('🚨 UI Error:', message);
            
            if (this.elements.errorDisplay && this.elements.errorMessage) {
                this.elements.errorMessage.textContent = message;
                this.elements.errorDisplay.style.display = 'block';
                
                // Auto-hide error after 10 seconds
                if (this.errorDisplayTimeout) {
                    clearTimeout(this.errorDisplayTimeout);
                }
                this.errorDisplayTimeout = setTimeout(() => {
                    this.hideError();
                }, 10000);
            }
            
            // Also update system status
            this.updateSystemStatus('ERROR: ' + message);
            
        } catch (error) {
            console.error('Error showing error:', error);
        }
    }
    
    hideError() {
        try {
            if (this.elements.errorDisplay) {
                this.elements.errorDisplay.style.display = 'none';
            }
            if (this.errorDisplayTimeout) {
                clearTimeout(this.errorDisplayTimeout);
                this.errorDisplayTimeout = null;
            }
        } catch (error) {
            console.error('Error hiding error:', error);
        }
    }
    
    updateSystemStatus(message) {
        try {
            if (this.elements.systemStatus) {
                // Add timestamp to status messages
                const timestamp = new Date().toLocaleTimeString();
                this.elements.systemStatus.textContent = `[${timestamp}] ${message}`;
            }
            
            console.log('📊 Status:', message);
            
        } catch (error) {
            console.warn('Status update error:', error);
        }
    }
    
    // Enhanced status update methods for different components
    updateAudioContextStatus(status) {
        if (this.elements.audioContextStatus) {
            this.elements.audioContextStatus.textContent = status;
            this.elements.audioContextStatus.className = 'value ' + (status === 'running' ? 'status-good' : 'status-pending');
        }
    }
    
    updateAudioWorkletStatus(status) {
        if (this.elements.audioWorkletStatus) {
            this.elements.audioWorkletStatus.textContent = status;
            const statusClass = status === 'ready' ? 'status-good' : 
                               status === 'failed' || status === 'not supported' ? 'status-error' : 'status-pending';
            this.elements.audioWorkletStatus.className = 'value ' + statusClass;
        }
    }
    
    updateOpenMPTStatus(status) {
        if (this.elements.openmptStatus) {
            this.elements.openmptStatus.textContent = status;
            const statusClass = status === 'ready' ? 'status-good' : 
                               status === 'failed' ? 'status-error' : 'status-pending';
            this.elements.openmptStatus.className = 'value ' + statusClass;
        }
    }
    
    updateFluidSynthStatus(status) {
        if (this.elements.fluidsynthStatus) {
            this.elements.fluidsynthStatus.textContent = status;
            const statusClass = status === 'ready' ? 'status-good' : 
                               status === 'failed' ? 'status-error' : 'status-pending';
            this.elements.fluidsynthStatus.className = 'value ' + statusClass;
        }
    }
    
    // Utility method for safe execution with error boundaries
    safeExecute(fn) {
        try {
            return fn();
        } catch (error) {
            console.error('Safe execution error:', error);
            this.showError('Operation failed: ' + error.message);
        }
    }
    
    // Public API methods
    getState() {
        return {
            ...this.uiState,
            currentTrack: this.currentTrack,
            currentIndex: this.currentIndex,
            playlistLength: this.playlist.length,
            isInitialized: this.isInitialized
        };
    }
    
    // Diagnostic methods
    runDiagnostics() {
        const diagnostics = {
            initialization: {
                isInitialized: this.isInitialized,
                elementsFound: Object.keys(this.elements).length,
                dragAndDropEnabled: this.dragAndDropEnabled,
                keyboardShortcutsEnabled: this.keyboardShortcutsEnabled
            },
            playlist: {
                totalFiles: this.playlist.length,
                currentIndex: this.currentIndex,
                currentTrack: this.currentTrack?.filename || 'none'
            },
            ui: {
                volume: this.volumeValue,
                ...this.uiState
            }
        };
        
        console.log('🔍 UI Controller Diagnostics:', diagnostics);
        return diagnostics;
    }
}

// Enhanced UIController with SpessaSynth support - Manages all user interface interactions
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
        
        console.log('🎛️ Enhanced UIController v2.5.1 initialized (SpessaSynth support)');
    }
    
    async initialize() {
        try {
            this.updateSystemStatus('Initializing Enhanced UI controller...');
            
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
            
            // Initialize SpessaSynth-specific UI
            this.initializeSpessaSynthUI();
            
            this.isInitialized = true;
            this.updateSystemStatus('Enhanced UI controller ready ✓');
            console.log('✅ Enhanced UIController initialized successfully');
            
        } catch (error) {
            console.error('Enhanced UIController initialization failed:', error);
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
            'synthSelectBtn', 'soundfontBtn', 'synthInfo',
            'currentSynthEngine', 'currentSoundFont', 'activeVoices',
            'systemStatus'
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
        
        console.log('✅ Enhanced UI elements initialized');
    }
    
    setupEventListeners() {
        try {
            // Enhanced button event handlers
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
            
            // SpessaSynth-specific buttons
            if (this.elements.synthSelectBtn) {
                this.elements.synthSelectBtn.addEventListener('click', () => this.safeExecute(() => this.showSynthSelector()));
            }
            if (this.elements.soundfontBtn) {
                this.elements.soundfontBtn.addEventListener('click', () => this.safeExecute(() => this.showSoundfontSelector()));
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
            
            console.log('✅ Enhanced event listeners setup complete');
            
        } catch (error) {
            console.error('Event listener setup failed:', error);
            throw error;
        }
    }
    
    initializeSpessaSynthUI() {
        try {
            // Initialize synth info display
            this.updateSynthInfo();
            
            console.log('✅ SpessaSynth UI initialized');
            
        } catch (error) {
            console.warn('SpessaSynth UI initialization failed:', error);
        }
    }
    
    async showSynthSelector() {
        try {
            const engines = [];
            
            if (this.audioEngine && this.audioEngine.spessaSynth) {
                engines.push({ id: 'spessasynth', name: 'SpessaSynth (Advanced)' });
            }
            if (this.audioEngine && this.audioEngine.tinySynth) {
                engines.push({ id: 'tinysynth', name: 'TinySynth (Fallback)' });
            }
            
            if (engines.length === 0) {
                this.showError('No MIDI synthesizers available');
                return;
            }
            
            // Create simple selection dialog
            const selectedEngine = await this.showSelectionDialog(
                'Select MIDI Synthesizer',
                engines,
                this.audioEngine.currentSynthEngine
            );
            
            if (selectedEngine && selectedEngine !== this.audioEngine.currentSynthEngine) {
                await this.audioEngine.switchSynthEngine(selectedEngine);
                this.updateSynthInfo();
                this.updateSystemStatus(`Switched to ${selectedEngine} synthesizer`);
            }
            
        } catch (error) {
            this.showError(`Synth selection failed: ${error.message}`);
        }
    }
    
    async showSoundfontSelector() {
        try {
            if (!this.audioEngine || !this.audioEngine.spessaSynth) {
                this.showError('SpessaSynth not available for SoundFont selection');
                return;
            }
            
            // Get available soundfonts
            const response = await fetch('/api/soundfonts');
            const soundfonts = await response.json();
            
            if (soundfonts.length === 0) {
                this.showError('No SoundFont files available. Please upload .sf2 files.');
                return;
            }
            
            const soundfontOptions = soundfonts.map(sf => ({
                id: sf.filename,
                name: `${sf.filename} (${sf.displaySize})`
            }));
            
            const selectedSF = await this.showSelectionDialog(
                'Select SoundFont',
                soundfontOptions,
                this.audioEngine.currentSoundFont
            );
            
            if (selectedSF && selectedSF !== this.audioEngine.currentSoundFont) {
                await this.loadSoundFont(selectedSF);
            }
            
        } catch (error) {
            this.showError(`SoundFont selection failed: ${error.message}`);
        }
    }
    
    async loadSoundFont(filename) {
        try {
            this.updateSystemStatus(`Loading SoundFont: ${filename}...`);
            
            const response = await fetch(`/soundfonts/${filename}`);
            if (!response.ok) {
                throw new Error(`Failed to load SoundFont: ${response.status}`);
            }
            
            const soundFontData = await response.arrayBuffer();
            await this.audioEngine.loadSoundFont(soundFontData, filename);
            
            this.updateSynthInfo();
            this.updateSystemStatus(`SoundFont loaded: ${filename} ✓`);
            
        } catch (error) {
            this.showError(`SoundFont loading failed: ${error.message}`);
        }
    }
    
    async showSelectionDialog(title, options, currentValue) {
        return new Promise((resolve) => {
            // Create modal dialog
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                font-family: 'Share Tech Mono', monospace;
            `;
            
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: #000;
                border: 2px solid #00ff00;
                padding: 20px;
                min-width: 300px;
                max-width: 500px;
                color: #00ff00;
            `;
            
            dialog.innerHTML = `
                <h3 style="margin-bottom: 15px; color: #00ffff;">${title}</h3>
                <div id="optionsList" style="margin-bottom: 15px;"></div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancelBtn" class="btn">Cancel</button>
                    <button id="selectBtn" class="btn">Select</button>
                </div>
            `;
            
            modal.appendChild(dialog);
            document.body.appendChild(modal);
            
            // Add options
            const optionsList = dialog.querySelector('#optionsList');
            let selectedValue = currentValue;
            
            options.forEach(option => {
                const optionDiv = document.createElement('div');
                optionDiv.style.cssText = `
                    padding: 8px;
                    cursor: pointer;
                    border: 1px solid #004400;
                    margin: 2px 0;
                    background: ${option.id === currentValue ? 'rgba(0,255,0,0.2)' : 'rgba(0,34,0,0.3)'};
                `;
                optionDiv.textContent = option.name;
                
                optionDiv.addEventListener('click', () => {
                    // Remove previous selection
                    optionsList.querySelectorAll('div').forEach(div => {
                        div.style.background = 'rgba(0,34,0,0.3)';
                    });
                    // Highlight selected
                    optionDiv.style.background = 'rgba(0,255,0,0.2)';
                    selectedValue = option.id;
                });
                
                optionsList.appendChild(optionDiv);
            });
            
            // Event handlers
            dialog.querySelector('#cancelBtn').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(null);
            });
            
            dialog.querySelector('#selectBtn').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(selectedValue);
            });
            
            // Close on background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve(null);
                }
            });
        });
    }
    
    updateSynthInfo() {
        try {
            if (!this.audioEngine) return;
            
            const status = this.audioEngine.getStatus();
            
            if (this.elements.currentSynthEngine) {
                const engineName = status.currentSynthEngine === 'spessasynth' ? 'SpessaSynth' :
                                status.currentSynthEngine === 'tinysynth' ? 'TinySynth' :
                                status.currentSynthEngine === 'auto' ? 'Auto' : 'None';
                this.elements.currentSynthEngine.textContent = engineName;
            }
            
            if (this.elements.currentSoundFont) {
                this.elements.currentSoundFont.textContent = status.currentSoundFont || 'None';
            }
            
            if (this.elements.activeVoices) {
                this.elements.activeVoices.textContent = status.activeVoices.toString();
            }
            
        } catch (error) {
            console.warn('Synth info update error:', error);
        }
    }
    
    // Include all the previous UIController methods (initializeDragAndDrop, etc.)
    // ... [Previous methods from the original ui-controller.js] ...
    
    initializeDragAndDrop() {
        if (!this.elements.uploadArea) return;
        
        try {
            const uploadArea = this.elements.uploadArea;
            
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                uploadArea.classList.add('dragover');
            });
            
            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                uploadArea.classList.remove('dragover');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                uploadArea.classList.remove('dragover');
                
                const files = Array.from(e.dataTransfer.files);
                this.safeExecute(() => this.handleFiles(files));
            });
            
            this.dragAndDropEnabled = true;
            console.log('✅ Enhanced drag and drop initialized');
            
        } catch (error) {
            console.warn('Drag and drop initialization failed:', error);
        }
    }
    
    initializeKeyboardShortcuts() {
        try {
            document.addEventListener('keydown', (e) => {
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
                        case 'KeyS':
                            if (e.ctrlKey || e.metaKey) {
                                e.preventDefault();
                                this.showSynthSelector();
                            }
                            break;
                        case 'KeyF':
                            if (e.ctrlKey || e.metaKey) {
                                e.preventDefault();
                                this.showSoundfontSelector();
                            }
                            break;
                    }
                });
            });
            
            this.keyboardShortcutsEnabled = true;
            console.log('✅ Enhanced keyboard shortcuts initialized');
            
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
            
            // Touch support
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
            
            console.log('✅ Enhanced volume control initialized');
            
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
            
            console.log('✅ Enhanced progress control initialized');
            
        } catch (error) {
            console.warn('Progress control initialization failed:', error);
        }
    }
    
    setAudioEngine(audioEngine) {
        this.audioEngine = audioEngine;
        console.log('✅ Enhanced audio engine connected to UI controller');
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
            this.renderFileList();
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
                    <div class="file-item" data-index="${index}" title="${file.filename}" onclick="uiController.selectTrack(${index})">
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
            console.log(`Attempting to select track at index: ${index}`);
            
            if (index < 0 || index >= this.playlist.length) {
                console.warn(`Invalid track index: ${index}, playlist length: ${this.playlist.length}`);
                this.showError(`Invalid track selection: ${index}`);
                return;
            }
            
            this.currentIndex = index;
            this.currentTrack = this.playlist[index];
            
            console.log(`Selected track: ${this.currentTrack.filename} (type: ${this.currentTrack.type})`);
            
            this.highlightTrack(index);
            this.updateTrackInfo();
            
            this.updateSystemStatus(`Selected: ${this.currentTrack.filename}`);
            console.log(`✅ Track selected successfully: ${this.currentTrack.filename}`);
            
        } catch (error) {
            console.error('Error selecting track:', error);
            this.showError('Failed to select track: ' + error.message);
        }
    }
    
    highlightTrack(index) {
        try {
            document.querySelectorAll('.file-item').forEach(item => {
                item.classList.remove('selected', 'playing');
            });
            
            const fileItem = document.querySelector(`[data-index="${index}"]`);
            if (fileItem) {
                fileItem.classList.add('selected');
                
                if (this.uiState.isPlaying) {
                    fileItem.classList.add('playing');
                }
                
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
            
            if (this.uiState.isPaused) {
                this.audioEngine.resume();
                return;
            }
            
            this.updateSystemStatus(`Starting playback: ${this.currentTrack.filename}...`);
            
            await this.audioEngine.playTrack(this.currentTrack);
            
            this.highlightTrack(this.currentIndex);
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
        
        if (this.elements.playBtn) {
            this.elements.playBtn.disabled = isPlaying && !isPaused;
        }
        if (this.elements.pauseBtn) {
            this.elements.pauseBtn.disabled = !isPlaying || isPaused;
        }
        if (this.elements.stopBtn) {
            this.elements.stopBtn.disabled = !isPlaying && !isPaused;
        }
        
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
            
            const successCount = uploadResults.filter(r => r.startsWith('✓')).length;
            const message = `Upload complete: ${successCount}/${files.length} files`;
            this.updateSystemStatus(message);
            
            await this.loadFileList();
            
        } catch (error) {
            console.error('File upload error:', error);
            this.showError('Upload failed: ' + error.message);
        }
    }
    
    showError(message) {
        try {
            console.error('🚨 UI Error:', message);
            this.updateSystemStatus('ERROR: ' + message);
            
        } catch (error) {
            console.error('Error showing error:', error);
        }
    }
    
    safeExecute(fn) {
        try {
            return fn();
        } catch (error) {
            console.error('Safe execution error:', error);
            this.showError('Operation failed: ' + error.message);
        }
    }
    
    updateSystemStatus(message) {
        try {
            if (this.elements.systemStatus) {
                const timestamp = new Date().toLocaleTimeString();
                this.elements.systemStatus.textContent = `[${timestamp}] ${message}`;
            }
            
            console.log('📊 Status:', message);
            
        } catch (error) {
            console.warn('Status update error:', error);
        }
    }
    
    getState() {
        return {
            ...this.uiState,
            currentTrack: this.currentTrack,
            currentIndex: this.currentIndex,
            playlistLength: this.playlist.length,
            isInitialized: this.isInitialized
        };
    }
    
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
            },
            spessasynth: {
                hasSpessaSynth: !!(this.audioEngine && this.audioEngine.spessaSynth),
                currentSynthEngine: this.audioEngine?.currentSynthEngine || 'unknown',
                currentSoundFont: this.audioEngine?.currentSoundFont || 'unknown',
                activeVoices: this.audioEngine?.activeVoices || 0
            }
        };
        
        console.log('🔍 Enhanced UI Controller Diagnostics:', diagnostics);
        return diagnostics;
    }
}
// SpessaSynth Audio Engine - High-quality MIDI synthesis
class SpessaSynthEngine {
    constructor() {
        this.synth = null;
        this.audioContext = null;
        this.isReady = false;
        this.currentMidi = null;
        this.volume = 0.5;
        
        console.log('🎹 SpessaSynth Engine v1.0 initialized');
    }
    
    async initialize(audioContext) {
        try {
            this.audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
            
            // Check if SpessaSynth is loaded
            if (typeof SpessaSynth === 'undefined') {
                throw new Error('SpessaSynth library not loaded');
            }
            
            console.log('Initializing SpessaSynth...');
            
            // Create SpessaSynth instance
            this.synth = new SpessaSynth.Synthesizer(
                this.audioContext.destination,
                {
                    // Use better quality settings
                    voiceCap: 128,
                    useReverb: true,
                    useChorus: true
                }
            );
            
            // Try to load a soundfont
            await this.loadSoundFont();
            
            this.isReady = true;
            console.log('✅ SpessaSynth initialized successfully');
            
            return true;
            
        } catch (error) {
            console.error('SpessaSynth initialization failed:', error);
            throw error;
        }
    }
    
    async loadSoundFont() {
        const soundFontPaths = [
            '/soundfonts/spessasynth/gm.sf2',
            '/soundfonts/spessasynth/GeneralUserGS.sf2',
            '/soundfonts/default.sf2',
            // Try CDN fallback
            'https://cdn.jsdelivr.net/npm/@soundfonts/fluid-gm@latest/FluidR3_GM.sf2'
        ];
        
        for (const path of soundFontPaths) {
            try {
                console.log(`Attempting to load soundfont: ${path}`);
                const response = await fetch(path);
                
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    await this.synth.loadSoundFont(arrayBuffer);
                    console.log(`✅ Soundfont loaded: ${path}`);
                    return true;
                }
            } catch (error) {
                console.warn(`Failed to load soundfont ${path}:`, error);
            }
        }
        
        console.warn('⚠️ No soundfont loaded - using default synthesis');
        return false;
    }
    
    async loadMidiFile(url) {
        if (!this.isReady) {
            throw new Error('SpessaSynth not ready');
        }
        
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            
            // Parse MIDI file
            this.currentMidi = new SpessaSynth.MIDI(arrayBuffer);
            
            // Load into synthesizer
            this.synth.loadMIDI(this.currentMidi);
            
            console.log('✅ MIDI file loaded into SpessaSynth');
            
            return true;
            
        } catch (error) {
            console.error('Failed to load MIDI file:', error);
            throw error;
        }
    }
    
    play() {
        if (!this.isReady || !this.currentMidi) {
            throw new Error('SpessaSynth not ready or no MIDI loaded');
        }
        
        this.synth.play();
        console.log('▶️ SpessaSynth playback started');
    }
    
    pause() {
        if (this.synth) {
            this.synth.pause();
            console.log('⏸️ SpessaSynth paused');
        }
    }
    
    stop() {
        if (this.synth) {
            this.synth.stop();
            this.currentMidi = null;
            console.log('⏹️ SpessaSynth stopped');
        }
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        
        if (this.synth) {
            this.synth.setMainVolume(Math.floor(this.volume * 127));
        }
    }
    
    getCurrentTime() {
        if (this.synth && this.synth.currentTime !== undefined) {
            return this.synth.currentTime;
        }
        return 0;
    }
    
    getDuration() {
        if (this.currentMidi && this.currentMidi.duration !== undefined) {
            return this.currentMidi.duration;
        }
        return 0;
    }
    
    getStatus() {
        return {
            isReady: this.isReady,
            hasMidi: !!this.currentMidi,
            isPlaying: this.synth ? this.synth.isPlaying : false,
            currentTime: this.getCurrentTime(),
            duration: this.getDuration()
        };
    }
}

// Make globally available
window.SpessaSynthEngine = SpessaSynthEngine;

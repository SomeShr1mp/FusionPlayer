// SpessaSynth Wrapper – Uses npm package spessasynth_lib (CommonJS)

const SpessaSynth = require('spessasynth_lib');

class SpessaSynthWrapper {
  constructor() {
    this.audioContext = null;
    this.audioNode = null;
    this.synthesizer = null;
    this.isReady = false;
    this.currentInstrument = 0;
    this.volume = 1.0;
  }

  /**
   * Initialize SpessaSynth with the given AudioContext
   * @param {AudioContext} audioContext
   * @returns {Promise<boolean>}
   */
  async initialize(audioContext) {
    this.audioContext =
      audioContext || new (window.AudioContext || window.webkitAudioContext)();

    this.audioNode = this.audioContext.createGain();
    this.audioNode.gain.value = this.volume;
    this.audioNode.connect(this.audioContext.destination);

    // Create synthesizer (adjust constructor if API differs)
    if (typeof SpessaSynth.Synthesizer === 'function') {
      this.synthesizer = new SpessaSynth.Synthesizer(this.audioNode, {
        voiceCount: 64,
        sampleRate: this.audioContext.sampleRate,
        reverbEnabled: false,
      });
    } else if (typeof SpessaSynth.SoundFont2Synth === 'function') {
      this.synthesizer = new SpessaSynth.SoundFont2Synth(this.audioNode, {
        voiceCount: 64,
        sampleRate: this.audioContext.sampleRate,
        reverbEnabled: false,
      });
    } else {
      throw new Error('Unsupported SpessaSynth module structure');
    }

    // Some builds require an explicit init step
    if (typeof this.synthesizer.init === 'function') {
      await this.synthesizer.init(this.audioContext);
    }

    await this.loadDefaultSoundFont();

    this.isReady = true;
    console.log('✅ SpessaSynth initialized successfully');
    return true;
  }

  /**
   * Load a default soundfont (adjust file path as needed)
   */
  async loadDefaultSoundFont() {
    try {
      const response = await fetch('/soundfonts/default.sf2');
      if (!response.ok) {
        throw new Error(`Failed to load soundfont: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();

      if (typeof this.synthesizer.loadSFont === 'function') {
        await this.synthesizer.loadSFont(arrayBuffer);
      } else if (typeof this.synthesizer.loadSoundFont === 'function') {
        await this.synthesizer.loadSoundFont(arrayBuffer);
      } else {
        throw new Error('No loadSoundFont method found in SpessaSynth');
      }

      console.log('🎹 Default soundfont loaded');
    } catch (error) {
      console.error('❌ Error loading default soundfont:', error);
    }
  }

  /**
   * Play a note
   * @param {number} midiNote
   * @param {number} velocity
   * @param {number} channel
   */
  noteOn(midiNote, velocity = 100, channel = 0) {
    if (!this.isReady || !this.synthesizer) return;

    if (typeof this.synthesizer.noteOn === 'function') {
      this.synthesizer.noteOn(channel, midiNote, velocity);
    } else if (typeof this.synthesizer.playNote === 'function') {
      this.synthesizer.playNote(channel, midiNote, velocity);
    }
  }

  /**
   * Stop a note
   * @param {number} midiNote
   * @param {number} channel
   */
  noteOff(midiNote, channel = 0) {
    if (!this.isReady || !this.synthesizer) return;

    if (typeof this.synthesizer.noteOff === 'function') {
      this.synthesizer.noteOff(channel, midiNote);
    } else if (typeof this.synthesizer.stopNote === 'function') {
      this.synthesizer.stopNote(channel, midiNote);
    }
  }

  /**
   * Change instrument/program
   * @param {number} program
   * @param {number} channel
   */
  programChange(program, channel = 0) {
    if (!this.isReady || !this.synthesizer) return;

    if (typeof this.synthesizer.programChange === 'function') {
      this.synthesizer.programChange(channel, program);
    } else if (typeof this.synthesizer.setProgram === 'function') {
      this.synthesizer.setProgram(channel, program);
    }

    this.currentInstrument = program;
  }

  /**
   * Set master volume
   * @param {number} volume (0.0 - 1.0)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audioNode) {
      this.audioNode.gain.value = this.volume;
    }
  }

  /**
   * Stop all playing notes
   */
  allNotesOff() {
    if (this.isReady && this.synthesizer?.allNotesOff) {
      this.synthesizer.allNotesOff();
    }
  }
}

module.exports = SpessaSynthWrapper;

// Optional: expose globally if bundled for the browser
if (typeof window !== 'undefined') {
  window.SpessaSynthWrapper = SpessaSynthWrapper;
}

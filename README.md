#  FUSION MUSIC PLAYER v2.1.0
*"It works! (Nobody is more surprised than I am)"*

[![Docker](https://img.shields.io/badge/Docker-Surprisingly%20Works-blue)](https://docker.com)
[![JavaScript](https://img.shields.io/badge/JavaScript-Held%20Together%20With%20Duct%20Tape-yellow)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio-Actually%20Makes%20Sound-green)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

A retro CRT-style music player that somehow manages to play tracker modules and MIDI files without completely falling apart. Built with the coding skills of someone who definitely Googled "how to JavaScript" more times than they'd care to admit.

![Screenshot](https://via.placeholder.com/800x600/000000/00FF00?text=FUSION+MUSIC+PLAYER+v2.0)

##  Features That Actually Work

- **Tracker Module Support**: Plays .MOD, .XM, .IT, .S3M files (thanks to people much smarter than me)
- **MIDI Playback**: Handles .MID/.MIDI files (again, not my code doing the heavy lifting)
- **Retro CRT Interface**: Because modern UIs are for people with actual design skills
- **Docker Support**: Containerized chaos for your convenience
- **Drag & Drop**: Upload files by dragging them around like a caveman - Sort of...
- **Volume Control**: Goes from 0 to 100, just like my anxiety while coding this

##  What Makes This Special

This project is a masterclass in "just keep adding libraries until something works." It features:

- **5 different audio libraries** because I couldn't figure out how to make one work properly
- **3 fallback systems** for when the main system inevitably fails
- **Error handling** that mostly consists of `console.log("oh no")`
- **Comments** written by someone who clearly forgot what their code does 5 minutes after writing it
- **Variable names** like `thingy`, `audioStuff`, and `whyIsThisBroken`

##  Built With The Help Of

Since I'm basically just duct-taping other people's brilliant work together:

### Audio Libraries (The Real MVPs)
- **[ChiptuneJS](https://github.com/deskjet/chiptune2.js)** by [@deskjet](https://github.com/deskjet) - For making tracker modules actually play instead of just making computer noises
- **[libOpenMPT](https://lib.openmpt.org/)** - The WASM magic that I definitely don't understand but am grateful exists
- **[WebAudio-TinySynth](https://github.com/g200kg/webaudio-tinysynth)** by [@g200kg](https://github.com/g200kg) - For MIDI synthesis that doesn't sound like a dying robot
- **[JS-Synthesizer](https://github.com/jet2jet/js-synthesizer)** by [@jet2jet](https://github.com/jet2jet) - Alternative MIDI synthesis for when the first one doesn't cooperate

### Technologies I Pretend To Understand
- **Docker** - Because "it works on my machine" is a valid deployment strategy
- **Node.js & Express** - For serving files and pretending to be a real backend
- **Web Audio API** - The browser API that does all the actual work
- **CSS Grid & Flexbox** - For layouts that look intentional
- **Promises/Async/Await** - For handling the chaos asynchronously

### Need to update Docker compose



##  Installation (Docker - Recommended for Hiding My Mistakes)

```bash
# Clone this beautiful disaster
git clone https://github.com/SomeShr1mp/FusionPlayer.git
cd FusionPlayer

# Build the container (pray it works)
docker-compose build

# Run it (hold your breath)
docker-compose up -d --build

# Podman also works flawlessly for some godforsaken reason for building & running the project.

# Access at http://localhost:3043
# (Port 3043 because 3000 was "too mainstream".... you can use port 3000 when running with npm though)
```

### Installation - Pt.2: Electric Boogaloo (This time with NPM)

```bash
#Clone this pile of garbadge
git clone https://github.com/SomeShr1mp/FusionPlayer.git
cd FusionPlayer

# Now time for NPM to do it's thing
npm i

# Hopefully nothing broke, let's start it
npm start


###  File Structure (Organized Chaos)

```
fusion-music-player/
├── server.js                    # Express server that somehow works
├── public/
│   ├── index.html              # The main page (surprisingly functional)
│   ├── index-fallback.html     # For when the main page inevitably breaks
│   ├── module-test.html        # For testing the various modules and making sure various API's work
│   ├── wasm-test.html          # For testing wasm loading... a lot more useful than expected
│   ├── midi-test.html          # The first iteration of the page... only go if you like MIDI test chords
│   ├── css/styles.css          # CRT effects that make bugs look intentional
│   ├── music/                  # Exactly what it says on the tin, use the provided test files or make your own!
│   └── js/
│       ├── audio-engine.js     # The "main" engine (uses fallback anyway)
│       ├── fallback-audio-engine.js  # The one that actually works
│       ├── ui-controller.js    # UI logic held together with hope
│       ├── openmpt-loader.js   # PLEASE GOD DO NOT LET THIS BREAK - IT BREAKS EVERYTHING
│       └── midi-parser.js      # MIDI parsing that mostly works
├── docker-compose.yml          # Container config for the brave
└── Dockerfile                  # Multi-stage build because I read it was "best practice"

```

##  Usage (If You Dare)

1. **Upload Files**: Drag music files onto the upload area or click to browse - Need to fix file permission issues & upload issues
2. **Select Track**: Click on a file in the list (revolutionary UX)
3. **Play Music**: Hit the play button and hope for the best
4. **Control Playback**: Use the buttons that look like they're from 1985
5. **Adjust Volume**: Slider goes left and right (groundbreaking)

### Supported Formats
- **Tracker Modules**: .mod, .xm, .it, .s3m (the classics)
- **MIDI Files**: .mid, .midi (because who doesn't love GM patches)
- **SoundFonts ---- SOOON **: .sf2 (for when built-in MIDI sounds aren't terrible enough)

##  Configuration (Good Luck)

Environment variables you can set (if you're feeling adventurous):

```bash
NODE_ENV=production          # Hides some of the debugging shame
PORT=3000                    # Change if you hate yourself
HOST=0.0.0.0                # For Docker networking magic
AUDIO_ENGINE_VERSION=2.0     # Because versioning makes me look professional
MAX_UPLOAD_SIZE=200MB        # For those 4-hour epic tracker modules
```

##  Known Issues (AKA "Features")

- **Occasional Audio Glitches**: Sometimes sounds like R2-D2 having a breakdown
- **File Loading**: May take a few seconds because WebAssembly is magic - Uploads don't really work due to File permissions
- **Browser Compatibility**: Works in Chrome, probably crashes in IE, Works in Firefox and it's offspring
- **Mobile Support**: Exists in theory, works in practice about 60% of the time
- **Error Messages**: Range from cryptic to completely unhelpful
- **Memory Leaks**: The browser might get hungry after playing 50+ files

##  Contributing (Please Help)

If you're brave enough to dive into this codebase:

1. **Fork it** (you'll regret this)
2. **Create a branch** (`git checkout -b fix-the-terrible-code`)
3. **Make changes** (try to make it worse, I dare you)
4. **Test thoroughly** (by which I mean "run it once and hope")
5. **Submit PR** (prepare for existential crisis during code review)

### Code Style
- **Indentation**: 4 spaces because I'm not a monster
- **Semicolons**: Sometimes yes, sometimes no, always inconsistent
- **Variable Names**: Should be descriptive or entertainingly bad
- **Comments**: Explain why, not what (mostly "why did I do this to myself")

##  License

GPLv3 License - Feel free to copy this disaster and make it your own disaster.

##  Acknowledgments

- **Stack Overflow** - For basically writing 80% of this code
- **MDN Web Docs** - For explaining Web APIs to someone who clearly didn't listen in CS class 
- **Letal ammounts of Caffine and Achohol ** - The real MVP
- **Rubber Duck Debugging** - My most patient collaborator
- **The Chiptune/Demoscene Community** - For keeping tracker music alive
- **Every Developer** who made the libraries that actually work
- **My Past Self** - For leaving comments that present me could understand 

##  Support

If it breaks (when it breaks), try:
1. **Refreshing the page** (classic IT solution)
2. **Clearing browser cache** (modern problems require modern solutions)
3. **Restarting Docker** (when in doubt, restart everything)
4. **Crying softly** (therapeutic and realistic)
5. **Opening an issue** (so we can cry and scream together)
6. **Gaze into the void** (Most realistic option)
7. **When in doubt, apply holy oils to the blessed machine and recite the prayers of repair** (When all else fails)

---

*"WAAAAAAAAAAAAAAAAAAAAAAAAAAAAGGH!" - Ghazghkull Mag Uruk Thraka*

*(This README is longer than some of my actual code files, which probably says something about my priorities)*

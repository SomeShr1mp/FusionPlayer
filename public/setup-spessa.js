// setup-spessa.js - Copy SpessaSynth files to public directory
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

async function setupSpessaSynth() {
    console.log('🎵 Setting up SpessaSynth...');
    
    try {
        // Create directories
        const spessaDir = path.join(__dirname, 'public', 'js', 'spessasynth');
        const soundfontsDir = path.join(__dirname, 'public', 'soundfonts');
        
        if (!fsSync.existsSync(spessaDir)) {
            await fs.mkdir(spessaDir, { recursive: true });
            console.log('✓ Created SpessaSynth directory');
        }
        
        if (!fsSync.existsSync(soundfontsDir)) {
            await fs.mkdir(soundfontsDir, { recursive: true });
            console.log('✓ Created SoundFonts directory');
        }
        
        // Copy SpessaSynth library files
        const spessaSrcDir = path.join(__dirname, 'node_modules', 'spessasynth_lib', 'dist');
        
        if (fsSync.existsSync(spessaSrcDir)) {
            const files = await fs.readdir(spessaSrcDir);
            
            for (const file of files) {
                if (file.endsWith('.js') || file.endsWith('.wasm') || file.endsWith('.map')) {
                    const srcPath = path.join(spessaSrcDir, file);
                    const destPath = path.join(spessaDir, file);
                    
                    try {
                        await fs.copyFile(srcPath, destPath);
                        console.log(`✓ Copied ${file}`);
                    } catch (err) {
                        console.warn(`⚠️  Could not copy ${file}: ${err.message}`);
                    }
                }
            }
        } else {
            console.warn('⚠️  SpessaSynth source directory not found - run npm install first');
        }
        
        // Download a basic SoundFont if none exists
        const defaultSF = path.join(soundfontsDir, 'default.sf2');
        if (!fsSync.existsSync(defaultSF)) {
            console.log('📦 Downloading default SoundFont...');
            try {
                // This is a placeholder - in reality you'd download a real SF2
                await fs.writeFile(defaultSF + '.placeholder', 'Download a SoundFont file and rename it to default.sf2');
                console.log('✓ SoundFont placeholder created - please add a real SF2 file');
            } catch (err) {
                console.warn('⚠️  Could not create SoundFont placeholder:', err.message);
            }
        }
        
        console.log('🎉 SpessaSynth setup complete!');
        
    } catch (error) {
        console.error('❌ SpessaSynth setup failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    setupSpessaSynth();
}

module.exports = { setupSpessaSynth };

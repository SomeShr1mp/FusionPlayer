const fs = require('fs');
const path = require('path');

// Copy SpessaSynth files to public directory
const sourceDir = path.join(__dirname, '..', 'node_modules', 'spessasynth_lib', 'dist');
const targetDir = path.join(__dirname, '..', 'public', 'js', 'spessasynth');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

// Files to copy
const filesToCopy = [
    'spessasynth_lib.js',
    'spessasynth_lib.js.map'
];

filesToCopy.forEach(file => {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    
    if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✅ Copied ${file} to public/js/spessasynth/`);
    } else {
        console.warn(`⚠️ ${file} not found in node_modules`);
    }
});

// Also copy the soundfont if available
const soundfontSource = path.join(__dirname, '..', 'node_modules', 'spessasynth_lib', 'soundfonts');
const soundfontTarget = path.join(__dirname, '..', 'public', 'soundfonts', 'spessasynth');

if (fs.existsSync(soundfontSource)) {
    if (!fs.existsSync(soundfontTarget)) {
        fs.mkdirSync(soundfontTarget, { recursive: true });
    }
    
    // Copy soundfont files
    fs.readdirSync(soundfontSource).forEach(file => {
        if (file.endsWith('.sf2') || file.endsWith('.sf3')) {
            fs.copyFileSync(
                path.join(soundfontSource, file),
                path.join(soundfontTarget, file)
            );
            console.log(`✅ Copied soundfont ${file}`);
        }
    });
}

console.log('SpessaSynth setup complete!');

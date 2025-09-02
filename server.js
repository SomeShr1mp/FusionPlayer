const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// CRITICAL: Set proper MIME types for WASM files
express.static.mime.types['wasm'] = 'application/wasm';
express.static.mime.types['mem'] = 'application/octet-stream';

// Middleware
app.use(cors());

// IMPORTANT: Serve SpessaSynth from node_modules
app.use('/js/spessasynth', express.static(path.join(__dirname, 'node_modules', 'spessasynth_lib', 'dist'), {
    setHeaders: (res, filepath) => {
        if (filepath.endsWith('.wasm')) {
            res.set('Content-Type', 'application/wasm');
        } else if (filepath.endsWith('.js')) {
            res.set('Content-Type', 'application/javascript');
        }
        // Allow WASM compilation
        res.set('Cross-Origin-Embedder-Policy', 'require-corp');
        res.set('Cross-Origin-Opener-Policy', 'same-origin');
    }
}));

// Serve static files with proper headers for WASM
app.use('/js', express.static(path.join(__dirname, 'public', 'js'), {
    setHeaders: (res, filepath) => {
        if (filepath.endsWith('.mem')) {
            res.set('Content-Type', 'application/octet-stream');
        } else if (filepath.endsWith('.wasm')) {
            res.set('Content-Type', 'application/wasm');
        } else if (filepath.endsWith('.js')) {
            res.set('Content-Type', 'application/javascript');
        }
        // Allow WASM compilation
        res.set('Cross-Origin-Embedder-Policy', 'require-corp');
        res.set('Cross-Origin-Opener-Policy', 'same-origin');
    }
}));

// Serve other static files
app.use(express.static('public'));
app.use(express.json());

// Enhanced logging with better error handling
const log = async (message, level = 'INFO') => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level}: ${message}`;
    console.log(logMessage);
    
    try {
        const logsDir = path.join(__dirname, 'logs');
        if (!fsSync.existsSync(logsDir)) {
            await fs.mkdir(logsDir, { recursive: true });
        }
        await fs.appendFile(path.join(logsDir, 'app.log'), logMessage + '\n');
    } catch (err) {
        if (level === 'ERROR') {
            console.error(`⚠️ Log write failed (${err.code}): Check directory permissions for /app/logs/`);
        }
    }
};

// Initialize directories
const initDirectories = async () => {
    const dirs = [
        path.join(__dirname, 'public', 'music'),
        path.join(__dirname, 'public', 'soundfonts'),
        path.join(__dirname, 'public', 'js'),
        path.join(__dirname, 'public', 'css'),
        path.join(__dirname, 'logs')
    ];
    
    for (const dir of dirs) {
        try {
            if (!fsSync.existsSync(dir)) {
                await fs.mkdir(dir, { recursive: true });
                await log(`Created directory: ${dir}`);
            }
        } catch (error) {
            await log(`Failed to create directory ${dir}: ${error.message}`, 'ERROR');
        }
    }
};

// Check SpessaSynth installation
const checkSpessaSynth = async () => {
    const spessaSynthPath = path.join(__dirname, 'node_modules', 'spessasynth_lib', 'dist');
    
    if (!fsSync.existsSync(spessaSynthPath)) {
        await log('SpessaSynth not found in node_modules. Run: npm install', 'WARN');
        return false;
    }
    
    // Check for key files
    const requiredFiles = ['spessasynth.js', 'worklet_processor.min.js'];
    let allFilesPresent = true;
    
    for (const file of requiredFiles) {
        const filePath = path.join(spessaSynthPath, file);
        if (!fsSync.existsSync(filePath)) {
            await log(`SpessaSynth file missing: ${file}`, 'WARN');
            allFilesPresent = false;
        }
    }
    
    if (allFilesPresent) {
        await log('✅ SpessaSynth npm package found and verified');
    }
    
    return allFilesPresent;
};

// API endpoint to list music files with better error handling
app.get('/api/music-files', async (req, res) => {
    try {
        const musicDir = path.join(__dirname, 'public', 'music');
        
        if (!fsSync.existsSync(musicDir)) {
            await log('Music directory does not exist, creating it...', 'WARN');
            await fs.mkdir(musicDir, { recursive: true });
            return res.json([]);
        }
        
        const files = await fs.readdir(musicDir);
        const allowedExtensions = ['.mod', '.xm', '.it', '.s3m', '.mid', '.midi', '.sf2', '.sf3'];
        
        const musicFiles = [];
        
        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (allowedExtensions.includes(ext)) {
                try {
                    const filePath = path.join(musicDir, file);
                    const stats = await fs.stat(filePath);
                    
                    let fileType = 'unknown';
                    if (['.mod', '.xm', '.it', '.s3m'].includes(ext)) {
                        fileType = 'tracker';
                    } else if (['.sf2', '.sf3'].includes(ext)) {
                        fileType = 'soundfont';
                    } else if (['.mid', '.midi'].includes(ext)) {
                        fileType = 'midi';
                    }
                    
                    musicFiles.push({
                        filename: file,
                        size: stats.size,
                        modified: stats.mtime,
                        type: fileType,
                        displaySize: formatFileSize(stats.size)
                    });
                } catch (statError) {
                    if (statError.code === 'EACCES') {
                        await log(`Permission denied accessing ${file}. Check file permissions.`, 'WARN');
                        musicFiles.push({
                            filename: file,
                            size: 0,
                            modified: new Date(),
                            type: 'unknown',
                            displaySize: 'Permission denied',
                            error: 'EACCES'
                        });
                    } else {
                        await log(`Error getting stats for ${file}: ${statError.message}`, 'WARN');
                    }
                }
            }
        }
        
        musicFiles.sort((a, b) => a.filename.localeCompare(b.filename));
        await log(`Found ${musicFiles.length} music files`);
        res.json(musicFiles);
        
    } catch (error) {
        await log(`Error scanning music directory: ${error.message}`, 'ERROR');
        res.status(500).json({ error: 'Unable to scan music directory' });
    }
});

// API endpoint to check library status including SpessaSynth
app.get('/api/library-check', async (req, res) => {
    try {
        const jsDir = path.join(__dirname, 'public', 'js');
        const spessaSynthDir = path.join(__dirname, 'node_modules', 'spessasynth_lib', 'dist');
        
        const libraries = {
            'libopenmpt.js': false,
            'libopenmpt.js.mem': false,
            'libopenmpt.wasm': false,
            'chiptune2.js': false,
            'webaudio-tinysynth.js': false,
            'spessasynth-wrapper.js': false,
            'spessasynth (npm)': false
        };
        
        // Check public/js files
        for (const file of Object.keys(libraries)) {
            if (file !== 'spessasynth (npm)') {
                if (fsSync.existsSync(path.join(jsDir, file))) {
                    const stats = await fs.stat(path.join(jsDir, file));
                    libraries[file] = { exists: true, size: stats.size };
                }
            }
        }
        
        // Check SpessaSynth npm package
        if (fsSync.existsSync(spessaSynthDir)) {
            const spessaFiles = await fs.readdir(spessaSynthDir);
            libraries['spessasynth (npm)'] = {
                exists: true,
                files: spessaFiles.filter(f => f.endsWith('.js') || f.endsWith('.wasm')),
                path: '/js/spessasynth/'
            };
        }
        
        res.json({
            libraries: libraries,
            spessaSynthInstalled: !!libraries['spessasynth (npm)'].exists,
            headers: {
                'Cross-Origin-Embedder-Policy': res.get('Cross-Origin-Embedder-Policy'),
                'Cross-Origin-Opener-Policy': res.get('Cross-Origin-Opener-Policy')
            }
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to get file info
app.get('/api/file-info/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, 'public', 'music', filename);
        
        if (!fsSync.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const stats = await fs.stat(filePath);
        const ext = path.extname(filename).toLowerCase();
        
        let fileType = 'unknown';
        if (['.mod', '.xm', '.it', '.s3m'].includes(ext)) {
            fileType = 'tracker';
        } else if (['.sf2', '.sf3'].includes(ext)) {
            fileType = 'soundfont';
        } else if (['.mid', '.midi'].includes(ext)) {
            fileType = 'midi';
        }
        
        res.json({
            filename,
            size: stats.size,
            displaySize: formatFileSize(stats.size),
            modified: stats.mtime,
            type: fileType
        });
        
    } catch (error) {
        await log(`Error getting file info: ${error.message}`, 'ERROR');
        res.status(500).json({ error: 'Unable to get file info' });
    }
});

// API endpoint to list soundfonts
app.get('/api/soundfonts', async (req, res) => {
    try {
        const soundfontsDir = path.join(__dirname, 'public', 'soundfonts');
        
        if (!fsSync.existsSync(soundfontsDir)) {
            return res.json([]);
        }
        
        const files = await fs.readdir(soundfontsDir);
        const soundfonts = [];
        
        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (ext === '.sf2' || ext === '.sf3') {
                try {
                    const filePath = path.join(soundfontsDir, file);
                    const stats = await fs.stat(filePath);
                    
                    soundfonts.push({
                        filename: file,
                        size: stats.size,
                        displaySize: formatFileSize(stats.size),
                        modified: stats.mtime,
                        isDefault: file === 'default.sf2' || file === 'default.sf3'
                    });
                } catch (statError) {
                    await log(`Error getting stats for ${file}: ${statError.message}`, 'WARN');
                }
            }
        }
        
        // Sort with default first
        soundfonts.sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return a.filename.localeCompare(b.filename);
        });
        
        res.json(soundfonts);
        
    } catch (error) {
        await log(`Error listing soundfonts: ${error.message}`, 'ERROR');
        res.status(500).json({ error: 'Unable to list soundfonts' });
    }
});

// List available synthesizers
app.get('/api/synthesizers', (req, res) => {
    const spessaSynthInstalled = fsSync.existsSync(
        path.join(__dirname, 'node_modules', 'spessasynth_lib')
    );
    
    res.json({
        synthesizers: [
            {
                id: 'spessasynth',
                name: 'SpessaSynth',
                description: 'High-quality MIDI synthesis with SF2/SF3 support (npm version)',
                features: ['SoundFont support', 'High quality', '64+ voices', 'Full GM/GS/XG support', 'Effects'],
                available: spessaSynthInstalled,
                recommended: true
            },
            {
                id: 'tinysynth',
                name: 'TinySynth',
                description: 'Lightweight Web Audio synthesizer',
                features: ['Fast loading', 'Low CPU usage', 'Built-in sounds', 'No downloads needed'],
                available: true,
                recommended: false
            }
        ],
        defaultSynth: spessaSynthInstalled ? 'spessasynth' : 'tinysynth',
        autoSelectCriteria: 'SpessaSynth if available and SoundFont loaded, otherwise TinySynth'
    });
});

// Upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        
        let destDir;
        if (ext === '.sf2' || ext === '.sf3') {
            destDir = path.join(__dirname, 'public', 'soundfonts');
        } else {
            destDir = path.join(__dirname, 'public', 'music');
        }
        
        if (!fsSync.existsSync(destDir)) {
            fsSync.mkdirSync(destDir, { recursive: true });
        }
        cb(null, destDir);
    },
    filename: (req, file, cb) => {
        const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, sanitized);
    }
});

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.mod', '.xm', '.it', '.s3m', '.mid', '.midi', '.sf2', '.sf3'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowedExtensions.includes(ext));
    },
    limits: { fileSize: 200 * 1024 * 1024 }
});

app.post('/api/upload', upload.single('musicFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded or invalid format' });
    }
    
    const ext = path.extname(req.file.filename).toLowerCase();
    let fileType = 'music';
    
    if (ext === '.sf2' || ext === '.sf3') {
        fileType = 'soundfont';
    }
    
    await log(`File uploaded: ${req.file.filename} (${formatFileSize(req.file.size)}) - Type: ${fileType}`);
    
    res.json({ 
        message: 'File uploaded successfully', 
        filename: req.file.filename,
        size: req.file.size,
        displaySize: formatFileSize(req.file.size),
        type: fileType
    });
});

// Delete file endpoint
app.delete('/api/delete/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const ext = path.extname(filename).toLowerCase();
        
        let filePath;
        if (ext === '.sf2' || ext === '.sf3') {
            filePath = path.join(__dirname, 'public', 'soundfonts', filename);
        } else {
            filePath = path.join(__dirname, 'public', 'music', filename);
        }
        
        if (!fsSync.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        await fs.unlink(filePath);
        await log(`File deleted: ${filename}`);
        res.json({ message: 'File deleted successfully' });
        
    } catch (error) {
        await log(`Error deleting file: ${error.message}`, 'ERROR');
        res.status(500).json({ error: 'Unable to delete file' });
    }
});

// SoundFont management endpoint
app.post('/api/set-default-soundfont/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const soundfontPath = path.join(__dirname, 'public', 'soundfonts', filename);
        
        if (!fsSync.existsSync(soundfontPath)) {
            return res.status(404).json({ error: 'SoundFont not found' });
        }
        
        const ext = path.extname(filename).toLowerCase();
        const defaultPath = path.join(__dirname, 'public', 'soundfonts', `default${ext}`);
        
        // Remove old default if it exists
        const oldDefaults = ['default.sf2', 'default.sf3'];
        for (const oldDefault of oldDefaults) {
            const oldPath = path.join(__dirname, 'public', 'soundfonts', oldDefault);
            if (fsSync.existsSync(oldPath) && oldPath !== soundfontPath) {
                await fs.unlink(oldPath);
            }
        }
        
        // Copy to default
        if (soundfontPath !== defaultPath) {
            await fs.copyFile(soundfontPath, defaultPath);
        }
        
        await log(`Default SoundFont set to: ${filename}`);
        res.json({ message: `Default SoundFont set to ${filename}` });
        
    } catch (error) {
        await log(`Error setting default SoundFont: ${error.message}`, 'ERROR');
        res.status(500).json({ error: 'Unable to set default SoundFont' });
    }
});

// Get synthesizer status
app.get('/api/synthesizer-status', async (req, res) => {
    try {
        const soundfontsDir = path.join(__dirname, 'public', 'soundfonts');
        let defaultSoundFont = null;
        let soundFontCount = 0;
        
        if (fsSync.existsSync(soundfontsDir)) {
            const files = await fs.readdir(soundfontsDir);
            const sf2Files = files.filter(f => f.endsWith('.sf2') || f.endsWith('.sf3'));
            soundFontCount = sf2Files.length;
            
            if (sf2Files.includes('default.sf2')) {
                defaultSoundFont = 'default.sf2';
            } else if (sf2Files.includes('default.sf3')) {
                defaultSoundFont = 'default.sf3';
            } else if (sf2Files.length > 0) {
                defaultSoundFont = sf2Files[0];
            }
        }
        
        const spessaSynthInstalled = fsSync.existsSync(
            path.join(__dirname, 'node_modules', 'spessasynth_lib')
        );
        
        res.json({
            spessasynth: {
                available: spessaSynthInstalled,
                version: spessaSynthInstalled ? require('spessasynth_lib/package.json').version : null,
                soundFontsAvailable: soundFontCount,
                defaultSoundFont: defaultSoundFont
            },
            tinysynth: {
                available: true,
                builtInSounds: true
            }
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve main page with proper CORS headers for WASM
app.get('/', (req, res) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const musicDir = path.join(__dirname, 'public', 'music');
        const soundfontsDir = path.join(__dirname, 'public', 'soundfonts');
        const jsDir = path.join(__dirname, 'public', 'js');
        const spessaSynthNpm = path.join(__dirname, 'node_modules', 'spessasynth_lib');
        
        const musicDirExists = fsSync.existsSync(musicDir);
        const soundfontsDirExists = fsSync.existsSync(soundfontsDir);
        const jsDirExists = fsSync.existsSync(jsDir);
        const spessaSynthInstalled = fsSync.existsSync(spessaSynthNpm);
        
        let musicFileCount = 0;
        let soundfontCount = 0;
        let jsFileCount = 0;
        
        if (musicDirExists) {
            try {
                const musicFiles = await fs.readdir(musicDir);
                musicFileCount = musicFiles.filter(f => 
                    ['.mod', '.xm', '.it', '.s3m', '.mid', '.midi'].includes(path.extname(f).toLowerCase())
                ).length;
            } catch (err) {
                await log(`Error counting music files: ${err.message}`, 'WARN');
            }
        }
        
        if (soundfontsDirExists) {
            try {
                const sfFiles = await fs.readdir(soundfontsDir);
                soundfontCount = sfFiles.filter(f => 
                    f.endsWith('.sf2') || f.endsWith('.sf3')
                ).length;
            } catch (err) {
                await log(`Error counting soundfont files: ${err.message}`, 'WARN');
            }
        }
        
        if (jsDirExists) {
            try {
                const jsFiles = await fs.readdir(jsDir);
                jsFileCount = jsFiles.length;
            } catch (err) {
                await log(`Error counting JS files: ${err.message}`, 'WARN');
            }
        }
        
        // Check for critical JS and WASM files
        const criticalFiles = [
            'libopenmpt.js',
            'libopenmpt.js.mem',
            'chiptune2.js',
            'fallback-audio-engine.js',
            'spessasynth-wrapper.js'
        ];
        
        const missingFiles = [];
        for (const file of criticalFiles) {
            if (!fsSync.existsSync(path.join(jsDir, file))) {
                missingFiles.push(file);
            }
        }
        
        const isHealthy = musicDirExists && soundfontsDirExists && jsDirExists && 
                         missingFiles.length === 0 && spessaSynthInstalled;
        
        const healthData = { 
            status: isHealthy ? 'healthy' : 'degraded', 
            timestamp: new Date().toISOString(),
            uptime: Math.floor(process.uptime()),
            host: HOST,
            port: PORT,
            directories: {
                music: musicDirExists,
                soundfonts: soundfontsDirExists,
                javascript: jsDirExists
            },
            counts: {
                musicFiles: musicFileCount,
                soundfonts: soundfontCount,
                jsFiles: jsFileCount
            },
            missingCriticalFiles: missingFiles,
            version: '2.2.0',
            engines: {
                openmpt: missingFiles.includes('libopenmpt.js') ? 'missing' : 'available',
                spessasynth: spessaSynthInstalled ? 'installed (npm)' : 'missing',
                tinysynth: 'built-in'
            }
        };
        
        res.status(isHealthy ? 200 : 503).json(healthData);
        
    } catch (error) {
        await log(`Health check error: ${error.message}`, 'ERROR');
        res.status(503).json({ 
            status: 'unhealthy', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// System info endpoint
app.get('/api/system-info', async (req, res) => {
    const musicDir = path.join(__dirname, 'public', 'music');
    const soundfontsDir = path.join(__dirname, 'public', 'soundfonts');
    const spessaSynthNpm = path.join(__dirname, 'node_modules', 'spessasynth_lib');
    
    const musicStats = fsSync.existsSync(musicDir) ? await fs.readdir(musicDir) : [];
    const soundfontStats = fsSync.existsSync(soundfontsDir) ? 
        (await fs.readdir(soundfontsDir)).filter(f => f.endsWith('.sf2') || f.endsWith('.sf3')) : [];
    
    let spessaSynthVersion = 'not installed';
    if (fsSync.existsSync(spessaSynthNpm)) {
        try {
            const packageJson = require('spessasynth_lib/package.json');
            spessaSynthVersion = packageJson.version;
        } catch (e) {
            spessaSynthVersion = 'unknown version';
        }
    }
    
    res.json({
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version,
        host: HOST,
        port: PORT,
        totalMusicFiles: musicStats.length,
        totalSoundfonts: soundfontStats.length,
        musicDiskUsage: await getDiskUsage(musicDir),
        soundfontsDiskUsage: await getDiskUsage(soundfontsDir),
        audioEngines: {
            openmpt: {
                status: 'available',
                formats: ['.mod', '.xm', '.it', '.s3m']
            },
            spessasynth: {
                status: spessaSynthVersion !== 'not installed' ? 'available' : 'not installed',
                version: spessaSynthVersion,
                formats: ['.mid', '.midi'],
                soundfonts: soundfontStats.length,
                features: ['SF2/SF3 support', 'High quality', 'Full GM/GS/XG', 'Effects', 'npm package']
            },
            tinysynth: {
                status: 'available',
                formats: ['.mid', '.midi'],
                features: ['Lightweight', 'Built-in sounds']
            }
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    log(`Server error: ${err.message}`, 'ERROR');
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    log(`404 - ${req.method} ${req.url}`, 'WARN');
    res.status(404).json({ error: 'Not found' });
});

// Utility functions
function formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

async function getDiskUsage(dir) {
    try {
        if (!fsSync.existsSync(dir)) return { totalSize: 0, fileCount: 0 };
        
        const files = await fs.readdir(dir);
        let totalSize = 0;
        
        for (const file of files) {
            try {
                const filePath = path.join(dir, file);
                const stats = await fs.stat(filePath);
                totalSize += stats.size;
            } catch (error) {
                // Skip files we can't read
            }
        }
        
        return {
            totalSize: totalSize,
            displaySize: formatFileSize(totalSize),
            fileCount: files.length
        };
    } catch (error) {
        return { totalSize: 0, fileCount: 0, error: error.message };
    }
}

// Server startup with proper initialization
const startServer = async () => {
    try {
        await initDirectories();
        await log('🎵 Initializing Fusion Music Player Server v2.2.0...');
        
        // Check SpessaSynth installation
        const spessaSynthReady = await checkSpessaSynth();
        if (!spessaSynthReady) {
            await log('⚠️ SpessaSynth not properly installed. Run: npm install', 'WARN');
        }
        
        const server = app.listen(PORT, HOST, async () => {
            await log(`🌐 Server running on ${HOST}:${PORT}`);
            await log(`🐳 Docker mode: ${process.env.NODE_ENV === 'production' ? 'YES' : 'NO'}`);
            await log(`🔗 Access URLs:`);
            await log(`   Local:    http://localhost:${PORT}`);
            await log(`   Network:  http://${HOST}:${PORT}`);
            await log(`📦 WASM Support: Enabled with proper MIME types`);
            await log(`🎹 Synthesizers: SpessaSynth (${spessaSynthReady ? 'npm' : 'missing'}) + TinySynth`);
            
            // Log initial file counts
            try {
                const musicDir = path.join(__dirname, 'public', 'music');
                const soundfontsDir = path.join(__dirname, 'public', 'soundfonts');
                
                if (fsSync.existsSync(musicDir)) {
                    const musicFiles = await fs.readdir(musicDir);
                    await log(`💿 Found ${musicFiles.length} files in music directory`);
                }
                
                if (fsSync.existsSync(soundfontsDir)) {
                    const soundfontFiles = await fs.readdir(soundfontsDir);
                    const sf2Files = soundfontFiles.filter(f => f.endsWith('.sf2') || f.endsWith('.sf3'));
                    await log(`🎼 Found ${sf2Files.length} SoundFont files`);
                }
                
            } catch (error) {
                await log(`Error during initial scan: ${error.message}`, 'ERROR');
            }
        });
        
        // Handle server errors
        server.on('error', async (err) => {
            if (err.code === 'EADDRINUSE') {
                await log(`❌ Port ${PORT} is already in use`, 'ERROR');
                process.exit(1);
            } else {
                await log(`❌ Server error: ${err.message}`, 'ERROR');
                throw err;
            }
        });
        
    } catch (error) {
        await log(`Failed to start server: ${error.message}`, 'ERROR');
        process.exit(1);
    }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    await log(`🛑 Received ${signal}, shutting down gracefully`);
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', async (err) => {
    await log(`Uncaught Exception: ${err.message}`, 'ERROR');
    console.error(err.stack);
    process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
    await log(`Unhandled Rejection at: ${promise} reason: ${reason}`, 'ERROR');
});

// Start the server
startServer();

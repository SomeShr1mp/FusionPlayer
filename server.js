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

// IMPORTANT: Serve static files with proper headers for WASM
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
        const allowedExtensions = ['.mod', '.xm', '.it', '.s3m', '.mid', '.midi', '.sf2'];
        
        const musicFiles = [];
        
        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (allowedExtensions.includes(ext)) {
                try {
                    const filePath = path.join(musicDir, file);
                    const stats = await fs.stat(filePath);
                    
                    musicFiles.push({
                        filename: file,
                        size: stats.size,
                        modified: stats.mtime,
                        type: ['.mod', '.xm', '.it', '.s3m'].includes(ext) ? 'tracker' : 
                              ext === '.sf2' ? 'soundfont' : 'midi',
                        displaySize: formatFileSize(stats.size)
                    });
                } catch (statError) {
                    if (statError.code === 'EACCES') {
                        await log(`Permission denied accessing ${file}. Check file permissions.`, 'WARN');
                        musicFiles.push({
                            filename: file,
                            size: 0,
                            modified: new Date(),
                            type: ['.mod', '.xm', '.it', '.s3m'].includes(ext) ? 'tracker' : 
                                  ext === '.sf2' ? 'soundfont' : 'midi',
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

// API endpoint to check WASM support
app.get('/api/wasm-check', async (req, res) => {
    try {
        const jsDir = path.join(__dirname, 'public', 'js');
        const wasmFiles = {
            'libopenmpt.js': false,
            'libopenmpt.js.mem': false,
            'libopenmpt.wasm': false,
            'libfluidsynth-2.3.0.js': false,
            'libfluidsynth-2.3.0.wasm': false
        };
        
        for (const file of Object.keys(wasmFiles)) {
            if (fsSync.existsSync(path.join(jsDir, file))) {
                wasmFiles[file] = true;
                const stats = await fs.stat(path.join(jsDir, file));
                wasmFiles[file] = { exists: true, size: stats.size };
            }
        }
        
        res.json({
            wasmSupported: true,
            files: wasmFiles,
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
        
        res.json({
            filename,
            size: stats.size,
            displaySize: formatFileSize(stats.size),
            modified: stats.mtime,
            type: ['.mod', '.xm', '.it', '.s3m'].includes(ext) ? 'tracker' : 
                  ext === '.sf2' ? 'soundfont' : 'midi'
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
            if (path.extname(file).toLowerCase() === '.sf2') {
                try {
                    const filePath = path.join(soundfontsDir, file);
                    const stats = await fs.stat(filePath);
                    
                    soundfonts.push({
                        filename: file,
                        size: stats.size,
                        displaySize: formatFileSize(stats.size),
                        modified: stats.mtime
                    });
                } catch (statError) {
                    await log(`Error getting stats for ${file}: ${statError.message}`, 'WARN');
                }
            }
        }
        
        res.json(soundfonts);
        
    } catch (error) {
        await log(`Error listing soundfonts: ${error.message}`, 'ERROR');
        res.status(500).json({ error: 'Unable to list soundfonts' });
    }
});

// Upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        
        let destDir;
        if (ext === '.sf2') {
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
        const allowedExtensions = ['.mod', '.xm', '.it', '.s3m', '.mid', '.midi', '.sf2'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowedExtensions.includes(ext));
    },
    limits: { fileSize: 200 * 1024 * 1024 }
});

app.post('/api/upload', upload.single('musicFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded or invalid format' });
    }
    
    const fileType = path.extname(req.file.filename).toLowerCase() === '.sf2' ? 'soundfont' : 'music';
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
        if (ext === '.sf2') {
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
        
        const defaultPath = path.join(__dirname, 'public', 'soundfonts', 'default.sf2');
        
        if (fsSync.existsSync(defaultPath)) {
            await fs.unlink(defaultPath);
        }
        
        await fs.copyFile(soundfontPath, defaultPath);
        
        await log(`Default SoundFont set to: ${filename}`);
        res.json({ message: `Default SoundFont set to ${filename}` });
        
    } catch (error) {
        await log(`Error setting default SoundFont: ${error.message}`, 'ERROR');
        res.status(500).json({ error: 'Unable to set default SoundFont' });
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
        
        const musicDirExists = fsSync.existsSync(musicDir);
        const soundfontsDirExists = fsSync.existsSync(soundfontsDir);
        const jsDirExists = fsSync.existsSync(jsDir);
        
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
                soundfontCount = sfFiles.filter(f => f.endsWith('.sf2')).length;
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
            'audio-worklet-processor.js',
            'libopenmpt.js',
            'libopenmpt.js.mem',
            'chiptune2.js'
        ];
        
        const missingFiles = [];
        for (const file of criticalFiles) {
            if (!fsSync.existsSync(path.join(jsDir, file))) {
                missingFiles.push(file);
            }
        }
        
        const isHealthy = musicDirExists && soundfontsDirExists && jsDirExists && missingFiles.length === 0;
        
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
            version: '2.0.0',
            engines: {
                openmpt: missingFiles.includes('libopenmpt.js') ? 'missing' : 'available',
                audioWorklet: missingFiles.includes('audio-worklet-processor.js') ? 'missing' : 'available'
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
    
    const musicStats = fsSync.existsSync(musicDir) ? await fs.readdir(musicDir) : [];
    const soundfontStats = fsSync.existsSync(soundfontsDir) ? 
        (await fs.readdir(soundfontsDir)).filter(f => f.endsWith('.sf2')) : [];
    
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
            fluidsynth: {
                status: soundfontStats.length > 0 ? 'available' : 'no_soundfonts',
                formats: ['.mid', '.midi'],
                soundfonts: soundfontStats.length
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
        await log('🎵 Initializing Fusion Music Player Server v2.0...');
        
        const server = app.listen(PORT, HOST, async () => {
            await log(`🌐 Server running on ${HOST}:${PORT}`);
            await log(`🐳 Docker mode: ${process.env.NODE_ENV === 'production' ? 'YES' : 'NO'}`);
            await log(`🔗 Access URLs:`);
            await log(`   Local:    http://localhost:${PORT}`);
            await log(`   Network:  http://${HOST}:${PORT}`);
            await log(`📦 WASM Support: Enabled with proper MIME types`);
            
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
                    const sf2Files = soundfontFiles.filter(f => f.endsWith('.sf2'));
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

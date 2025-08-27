// OpenMPT Loader - Fixes the global variable issue between libopenmpt and chiptune2
// This file MUST be loaded BEFORE chiptune2.js but AFTER libopenmpt.js

(function() {
    'use strict';
    
    console.log('[OpenMPT Loader] Initializing...');
    
    // Store original Module if it exists
    let originalModule = null;
    if (typeof Module !== 'undefined') {
        originalModule = Module;
        console.log('[OpenMPT Loader] Found existing Module object');
    }
    
    // Configuration for Emscripten Module
    const moduleConfig = {
        preRun: [],
        postRun: [],
        print: function(text) {
            console.log('[OpenMPT]', text);
        },
        printErr: function(text) {
            console.error('[OpenMPT Error]', text);
        },
        locateFile: function(filename) {
            // Help the module find its .mem file
            if (filename.endsWith('.mem') || filename.endsWith('.wasm')) {
                console.log('[OpenMPT Loader] Locating file:', filename);
                return '/js/' + filename;
            }
            return filename;
        },
        onRuntimeInitialized: function() {
            console.log('[OpenMPT Loader] Runtime initialized');
            
            // CRITICAL: Set up the global libopenmpt object that chiptune2.js expects
            if (typeof Module !== 'undefined') {
                window.libopenmpt = Module;
                console.log('[OpenMPT Loader] Set window.libopenmpt = Module');
                
                // Verify critical functions exist
                const criticalFunctions = [
                    '_openmpt_module_create_from_memory',
                    '_openmpt_module_read_float_stereo', 
                    '_openmpt_module_destroy',
                    '_openmpt_module_get_duration_seconds',
                    '_openmpt_module_get_position_seconds',
                    '_malloc',
                    '_free'
                ];
                
                let allFunctionsAvailable = true;
                for (const func of criticalFunctions) {
                    if (typeof Module[func] !== 'function') {
                        console.error('[OpenMPT Loader] Missing critical function:', func);
                        allFunctionsAvailable = false;
                    }
                }
                
                if (allFunctionsAvailable) {
                    console.log('[OpenMPT Loader] ✅ All critical functions available');
                    
                    // Fire a custom event to signal that OpenMPT is ready
                    const event = new CustomEvent('openmptReady', { 
                        detail: { module: Module, version: 'libopenmpt' }
                    });
                    window.dispatchEvent(event);
                } else {
                    console.error('[OpenMPT Loader] ❌ Some critical functions are missing');
                }
                
                // Also ensure UTF8ToString and writeAsciiToMemory are available globally
                if (Module.UTF8ToString && !window.UTF8ToString) {
                    window.UTF8ToString = Module.UTF8ToString;
                    console.log('[OpenMPT Loader] Exposed UTF8ToString globally');
                }
                
                if (Module.writeAsciiToMemory && !window.writeAsciiToMemory) {
                    window.writeAsciiToMemory = Module.writeAsciiToMemory;
                    console.log('[OpenMPT Loader] Exposed writeAsciiToMemory globally');
                }
            }
        },
        // Memory settings for better compatibility
        INITIAL_MEMORY: 33554432, // 32MB
        ALLOW_MEMORY_GROWTH: 1,
        MAXIMUM_MEMORY: 536870912, // 512MB max
        // Disable some features that might cause issues
        ENVIRONMENT: 'web',
        // Ensure WASM is preferred over asm.js
        wasmBinary: undefined // Let it load from file
    };
    
    // Set Module config globally before libopenmpt.js loads
    if (typeof Module === 'undefined') {
        console.log('[OpenMPT Loader] Creating Module configuration');
        window.Module = moduleConfig;
    } else {
        console.log('[OpenMPT Loader] Extending existing Module configuration');
        // Merge configurations
        for (let key in moduleConfig) {
            if (!Module.hasOwnProperty(key)) {
                Module[key] = moduleConfig[key];
            }
        }
        
        // Ensure callbacks are chained properly
        const originalOnRuntimeInitialized = Module.onRuntimeInitialized;
        Module.onRuntimeInitialized = function() {
            if (originalOnRuntimeInitialized) {
                originalOnRuntimeInitialized.call(this);
            }
            moduleConfig.onRuntimeInitialized.call(this);
        };
    }
    
    // Also handle the case where libopenmpt might already be loaded
    if (typeof Module !== 'undefined' && Module._openmpt_module_create_from_memory) {
        console.log('[OpenMPT Loader] Module already loaded, setting up libopenmpt now');
        window.libopenmpt = Module;
        
        // Ensure helper functions are available
        if (Module.UTF8ToString && !window.UTF8ToString) {
            window.UTF8ToString = Module.UTF8ToString;
        }
        if (Module.writeAsciiToMemory && !window.writeAsciiToMemory) {
            window.writeAsciiToMemory = Module.writeAsciiToMemory;
        }
        
        // Fire ready event
        const event = new CustomEvent('openmptReady', { 
            detail: { module: Module, version: 'libopenmpt' }
        });
        window.dispatchEvent(event);
    }
    
    console.log('[OpenMPT Loader] Configuration complete');
})();

// Additional helper to verify OpenMPT status
window.checkOpenMPTStatus = function() {
    const status = {
        moduleExists: typeof Module !== 'undefined',
        libopenmptExists: typeof libopenmpt !== 'undefined',
        hasCreateFunction: false,
        hasReadFunction: false,
        hasDestroyFunction: false,
        hasMalloc: false,
        hasFree: false,
        hasUTF8ToString: false,
        hasWriteAscii: false
    };
    
    if (typeof Module !== 'undefined') {
        status.hasCreateFunction = typeof Module._openmpt_module_create_from_memory === 'function';
        status.hasReadFunction = typeof Module._openmpt_module_read_float_stereo === 'function';
        status.hasDestroyFunction = typeof Module._openmpt_module_destroy === 'function';
        status.hasMalloc = typeof Module._malloc === 'function';
        status.hasFree = typeof Module._free === 'function';
        status.hasUTF8ToString = typeof Module.UTF8ToString === 'function';
        status.hasWriteAscii = typeof Module.writeAsciiToMemory === 'function';
    }
    
    if (typeof libopenmpt !== 'undefined') {
        // Double-check libopenmpt has the same functions
        if (!status.hasCreateFunction) {
            status.hasCreateFunction = typeof libopenmpt._openmpt_module_create_from_memory === 'function';
        }
    }
    
    const isReady = status.moduleExists && status.libopenmptExists && 
                    status.hasCreateFunction && status.hasReadFunction && 
                    status.hasDestroyFunction && status.hasMalloc && status.hasFree;
    
    return {
        ...status,
        ready: isReady,
        message: isReady ? 'OpenMPT is ready' : 'OpenMPT is not fully loaded'
    };
};

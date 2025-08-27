// OpenMPT Loader - Fixes the global variable issue between libopenmpt and chiptune2
// This file MUST be loaded AFTER libopenmpt.js but BEFORE chiptune2.js

(function() {
    'use strict';
    
    console.log('[OpenMPT Loader] Initializing helper functions...');
    
    // Check if Module exists (from libopenmpt.js)
    if (typeof Module === 'undefined') {
        console.error('[OpenMPT Loader] ERROR: Module not found - libopenmpt.js must be loaded first!');
        return;
    }
    
    // Add UTF8ToString if not available
    if (typeof UTF8ToString === 'undefined') {
        window.UTF8ToString = function(ptr) {
            if (!ptr) return '';
            
            let u8 = Module.HEAPU8;
            let str = '';
            let i = ptr;
            
            while (u8[i]) {
                let c = u8[i++];
                if (c < 128) {
                    str += String.fromCharCode(c);
                } else if ((c & 0xE0) === 0xC0) {
                    str += String.fromCharCode(((c & 0x1F) << 6) | (u8[i++] & 0x3F));
                } else if ((c & 0xF0) === 0xE0) {
                    str += String.fromCharCode(((c & 0x0F) << 12) | ((u8[i++] & 0x3F) << 6) | (u8[i++] & 0x3F));
                } else if ((c & 0xF8) === 0xF0) {
                    let codePoint = ((c & 0x07) << 18) | ((u8[i++] & 0x3F) << 12) | ((u8[i++] & 0x3F) << 6) | (u8[i++] & 0x3F);
                    // Handle surrogate pairs for codepoints > 0xFFFF
                    if (codePoint > 0xFFFF) {
                        codePoint -= 0x10000;
                        str += String.fromCharCode(0xD800 | (codePoint >> 10));
                        str += String.fromCharCode(0xDC00 | (codePoint & 0x3FF));
                    } else {
                        str += String.fromCharCode(codePoint);
                    }
                }
            }
            
            return str;
        };
        console.log('[OpenMPT Loader] UTF8ToString helper added');
    }
    
    // Add writeAsciiToMemory if not available
    if (typeof writeAsciiToMemory === 'undefined') {
        window.writeAsciiToMemory = function(str, buffer, dontAddNull) {
            for (let i = 0; i < str.length; ++i) {
                Module.HEAP8[buffer + i] = str.charCodeAt(i);
            }
            if (!dontAddNull) {
                Module.HEAP8[buffer + str.length] = 0;
            }
        };
        console.log('[OpenMPT Loader] writeAsciiToMemory helper added');
    }
    
    // Make sure libopenmpt is globally accessible
    if (typeof libopenmpt === 'undefined' && typeof Module !== 'undefined') {
        window.libopenmpt = Module;
        console.log('[OpenMPT Loader] libopenmpt global reference created');
    }
    
    // Add Module to libopenmpt if not present
    if (typeof libopenmpt !== 'undefined' && !libopenmpt._openmpt_module_create_from_memory) {
        // Copy Module functions to libopenmpt
        const functionsToCopy = [
            '_openmpt_module_create_from_memory',
            '_openmpt_module_create_from_memory2',
            '_openmpt_module_destroy',
            '_openmpt_module_read_float_stereo',
            '_openmpt_module_read_interleaved_float_stereo',
            '_openmpt_module_get_duration_seconds',
            '_openmpt_module_get_position_seconds',
            '_openmpt_module_set_position_seconds',
            '_openmpt_module_get_metadata',
            '_openmpt_module_get_metadata_keys',
            '_openmpt_module_set_repeat_count',
            '_openmpt_module_set_render_param',
            '_openmpt_module_get_current_row',
            '_openmpt_module_get_current_pattern',
            '_openmpt_module_get_current_order',
            '_openmpt_module_get_num_orders',
            '_openmpt_module_get_num_patterns',
            '_openmpt_module_ctl_set',
            '_malloc',
            '_free'
        ];
        
        functionsToCopy.forEach(func => {
            if (Module[func] && !libopenmpt[func]) {
                libopenmpt[func] = Module[func];
            }
        });
        
        // Copy HEAP arrays
        ['HEAP8', 'HEAPU8', 'HEAP16', 'HEAPU16', 'HEAP32', 'HEAPU32', 'HEAPF32', 'HEAPF64'].forEach(heap => {
            if (Module[heap] && !libopenmpt[heap]) {
                libopenmpt[heap] = Module[heap];
            }
        });
        
        console.log('[OpenMPT Loader] Module functions copied to libopenmpt');
    }
    
    // Ensure ccall is available
    if (typeof libopenmpt !== 'undefined' && !libopenmpt.ccall && Module.ccall) {
        libopenmpt.ccall = Module.ccall;
        console.log('[OpenMPT Loader] ccall added to libopenmpt');
    }
    
    // Diagnostic check
    const checkStatus = {
        moduleExists: typeof Module !== 'undefined',
        libopenmptExists: typeof libopenmpt !== 'undefined',
        hasCreateFunction: !!(window.libopenmpt && window.libopenmpt._openmpt_module_create_from_memory),
        hasReadFunction: !!(window.libopenmpt && window.libopenmpt._openmpt_module_read_float_stereo),
        hasDestroyFunction: !!(window.libopenmpt && window.libopenmpt._openmpt_module_destroy),
        hasMalloc: !!(window.libopenmpt && window.libopenmpt._malloc),
        hasFree: !!(window.libopenmpt && window.libopenmpt._free),
        hasUTF8ToString: typeof UTF8ToString !== 'undefined',
        hasWriteAscii: typeof writeAsciiToMemory !== 'undefined'
    };
    
    const allReady = Object.values(checkStatus).every(v => v === true);
    
    console.log('[OpenMPT Loader] Status check:', checkStatus);
    console.log('[OpenMPT Loader] Ready:', allReady ? 'YES' : 'NO');
    
    // Set a flag to indicate loader is ready
    window.OpenMPTLoaderReady = allReady;
    
})();

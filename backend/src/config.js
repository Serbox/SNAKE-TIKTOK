const fs   = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

let _cache = null;

function load() {
    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        _cache = JSON.parse(raw);
        console.log('[config] Cargado desde', CONFIG_PATH);
    } catch (e) {
        console.error('[config] Error leyendo config.json:', e.message);
        _cache = _defaults();
    }
    return _cache;
}

function get() {
    if (!_cache) load();
    return _cache;
}

function save(data) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
    _cache = data;
    console.log('[config] Guardado.');
}

function _defaults() {
    return {
        username: '',
        events: {
            follower:  { enabled: true,  icon: '❤️', message: '¡nuevo seguidor!' },
            like:      { enabled: true,  threshold: 50, icon: '👍', message: '¡{count} likes!' },
            chat: {
                speedUp:    { enabled: true, icon: '⚡', message: '¡más rápido!' },
                speedDown:  { enabled: true, icon: '🐢', message: '¡más lento!' },
                foodEmojis: { enabled: true, cooldown: 20000 }
            }
        },
        gifts: []
    };
}

module.exports = { load, get, save };

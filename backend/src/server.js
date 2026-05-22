require('dotenv').config();

const express                   = require('express');
const http                      = require('http');
const path                      = require('path');
const { Server }                = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');
const cfg                       = require('./config');

// Cargar config.json (contiene username, eventos y regalos)
cfg.load();

// ── Servidor HTTP + Socket.IO ─────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 3000;

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── API ───────────────────────────────────────────────────────────────────

app.get('/api/config', (_req, res) => {
    res.json(cfg.get());
});

app.post('/api/config', (req, res) => {
    const newCfg       = req.body;
    const prevUsername = cfg.get().username;
    cfg.save(newCfg);

    // Actualizar leyenda y narrador en todos los frontends conectados
    io.emit('gift-config',     newCfg.gifts    || []);
    io.emit('narrator-config', newCfg.narrator || {});

    const reconnecting = newCfg.username && newCfg.username !== prevUsername;
    if (reconnecting) {
        console.log(`[server] Username cambiado → reconectando a @${newCfg.username}`);
        connectTikTok(newCfg.username);
    }

    res.json({ ok: true, reconnecting });
});

app.get('/api/status', (_req, res) => {
    res.json({
        connected: !!tiktokClient,
        username:  cfg.get().username || null,
        error:     lastError || null
    });
});

// ── Socket.IO ─────────────────────────────────────────────────────────────
io.on('connection', socket => {
    console.log(`[socket] conectado id=${socket.id}`);
    const c = cfg.get();
    socket.emit('tiktok-status',  { connected: !!tiktokClient, username: c.username });
    socket.emit('gift-config',     c.gifts    || []);
    socket.emit('narrator-config', c.narrator || {});
    socket.on('disconnect', () => console.log(`[socket] desconectado id=${socket.id}`));
});

// ── Cola de efectos ───────────────────────────────────────────────────────
// Los regalos se encolan y se procesan de a uno cada 700 ms.
// Así, si varios usuarios envían regalos al mismo tiempo, todos se aplican.
const QUEUE_DELAY = 700;
const effectQueue = [];
let   draining    = false;

function enqueue(fn) {
    effectQueue.push(fn);
    if (!draining) drainQueue();
}

function drainQueue() {
    if (effectQueue.length === 0) { draining = false; return; }
    draining = true;
    effectQueue.shift()();
    setTimeout(drainQueue, QUEUE_DELAY);
}

// Cooldown solo para efectos únicos (freeze, obstacle, mega)
const _cd = new Map();
function inCooldown(key, ms) {
    if (!ms) return false;
    const now = Date.now();
    if (_cd.has(key) && now - _cd.get(key) < ms) return true;
    _cd.set(key, now);
    return false;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function sendAlert(payload) {
    console.log(`[alert] ${payload.icon}  @${payload.user} — ${payload.message}`);
    io.emit('alert', payload);
}

function applyGiftEffect(gift, user) {
    // Efectos únicos: si hay cooldown activo, ignorar
    const uniqueEffects = ['freeze', 'obstacle', 'mega'];
    if (uniqueEffects.includes(gift.effect)) {
        if (inCooldown(`uniq:${gift.id}`, gift.cooldown || 15_000)) return;
    }

    enqueue(() => {
        switch (gift.effect) {
            case 'grow':
                io.emit('snake-grow', { user, amount: gift.amount });
                break;
            case 'shrink':
                io.emit('snake-shrink', { user, amount: gift.amount });
                break;
            case 'rainbow':
                io.emit('snake-rainbow', { user, duration: gift.duration });
                break;
            case 'freeze':
                io.emit('snake-freeze', { user, duration: gift.duration });
                break;
            case 'bonus-food':
                io.emit('bonus-food', { user });
                break;
            case 'obstacle':
                io.emit('obstacle', { user, duration: gift.duration });
                break;
            case 'grow-bonus':
                io.emit('snake-grow', { user, amount: gift.amount });
                io.emit('bonus-food', { user });
                break;
            case 'mega':
                io.emit('snake-grow',    { user, amount: gift.amount });
                io.emit('snake-rainbow', { user, duration: gift.duration });
                break;
        }

        sendAlert({ type: 'gift', icon: gift.icon, user, message: gift.label });
    });
}

// ── TikTok Live ───────────────────────────────────────────────────────────
let tiktokClient = null;
let lastError    = null;
let likeAccum    = 0;

function connectTikTok(username) {
    if (!username) return;

    if (tiktokClient) {
        try { tiktokClient.disconnect(); } catch (_) {}
        tiktokClient = null;
    }

    console.log(`[tiktok] Conectando a @${username}...`);
    lastError = null;

    tiktokClient = new WebcastPushConnection(username, {
        processInitialData: false,
        enableExtendedGiftInfo: true
    });

    tiktokClient.connect()
        .then(state => {
            console.log(`[tiktok] ✓ Conectado  roomId=${state.roomId}`);
            lastError = null;
            io.emit('tiktok-status', { connected: true, username });
        })
        .catch(err => {
            console.error(`[tiktok] ✗ ${err.message}`);
            lastError = err.message;
            io.emit('tiktok-status', { connected: false, error: err.message });
            setTimeout(() => connectTikTok(cfg.get().username), 30_000);
        });

    // ── Nuevos seguidores ─────────────────────────────────────────────────
    tiktokClient.on('social', data => {
        const ev = cfg.get().events?.follower;
        if (!ev?.enabled) return;
        if (!data.displayType?.includes('follow')) return;
        sendAlert({ type: 'follow', icon: ev.icon || '❤️', user: data.uniqueId, message: ev.message || '¡nuevo seguidor!' });
    });

    // ── Likes (acumulados) ────────────────────────────────────────────────
    tiktokClient.on('like', data => {
        const ev = cfg.get().events?.like;
        if (!ev?.enabled) return;
        likeAccum += data.likeCount ?? 1;
        const threshold = ev.threshold || 50;
        if (likeAccum >= threshold) {
            const msg = (ev.message || '¡{count} likes!').replace('{count}', likeAccum);
            sendAlert({ type: 'like', icon: ev.icon || '👍', user: data.uniqueId, message: msg });
            likeAccum = 0;
        }
    });

    // ── Chat ──────────────────────────────────────────────────────────────
    tiktokClient.on('chat', data => {
        const raw   = (data.comment || '').trim();
        const msg   = raw.toLowerCase();
        const user  = data.uniqueId;
        const chat  = cfg.get().events?.chat || {};

        if (msg === '!rapido' && chat.speedUp?.enabled && !inCooldown('speed-up', 15_000)) {
            io.emit('speed-change', { delta: -25 });
            sendAlert({ type: 'speed', icon: chat.speedUp.icon || '⚡', user, message: chat.speedUp.message || '¡más rápido!' });
            return;
        }

        if (msg === '!lento' && chat.speedDown?.enabled && !inCooldown('speed-down', 15_000)) {
            io.emit('speed-change', { delta: +35 });
            sendAlert({ type: 'speed', icon: chat.speedDown.icon || '🐢', user, message: chat.speedDown.message || '¡más lento!' });
            return;
        }

        const food = chat.foodEmojis;
        if (food?.enabled) {
            const FOOD_EMOJIS = ['🍕','🌮','🍔','🌯','🍣','🍜','🍩','🍎','🍰','🍇','🎂'];
            if (FOOD_EMOJIS.some(e => raw.includes(e)) && !inCooldown('bonus-food-chat', food.cooldown || 20_000)) {
                io.emit('bonus-food', { user });
                sendAlert({ type: 'food', icon: '🌟', user, message: '¡comida especial!' });
            }
        }

        // ── Narrador: leer el comentario en voz alta (sin el nombre) ──────────
        const nar = cfg.get().narrator;
        if (nar?.enabled !== false && raw.length >= 2) {
            io.emit('narrate', { text: raw });
        }
    });

    // ── Regalos ───────────────────────────────────────────────────────────
    tiktokClient.on('gift', data => {
        if (data.giftType === 1 && data.repeatEnd === 0) return;

        const rawName  = data.giftName || 'regalo';
        const name     = rawName.toLowerCase();
        const diamonds = data.diamondCount ?? 0;
        const user     = data.uniqueId;

        // Alerta genérica para TODOS los regalos
        sendAlert({ type: 'gift', icon: '🎁', user, message: `envió ${rawName}${diamonds ? ` (${diamonds} 💎)` : ''}` });

        // Buscar si el regalo tiene un efecto configurado
        const gifts   = cfg.get().gifts || [];
        const matched = gifts.find(g =>
            g.match.split(',').map(m => m.trim()).some(m => m && name.includes(m))
        );

        if (matched) {
            applyGiftEffect(matched, user);
        }
    });

    // ── Desconexión ───────────────────────────────────────────────────────
    tiktokClient.on('disconnected', () => {
        console.warn('[tiktok] Desconectado. Reintentando en 30 s...');
        io.emit('tiktok-status', { connected: false });
        tiktokClient = null;
        setTimeout(() => connectTikTok(cfg.get().username), 30_000);
    });

    tiktokClient.on('error', err =>
        console.error('[tiktok] Error:', err?.message ?? err)
    );
}

// ── Arranque ──────────────────────────────────────────────────────────────
server.listen(PORT, () => {
    console.log(`\n🐍 Snake TikTok AFK`);
    console.log(`   Panel de control → http://localhost:${PORT}`);
    console.log(`   Frontend del juego → abrir frontend/index.html en el navegador\n`);

    const username = cfg.get().username || process.env.TIKTOK_USERNAME || '';
    if (username) {
        // Sincronizar username del .env al config si no está seteado
        if (!cfg.get().username && process.env.TIKTOK_USERNAME) {
            const c = cfg.get();
            c.username = process.env.TIKTOK_USERNAME;
            cfg.save(c);
        }
        connectTikTok(username);
    } else {
        console.warn('⚠️  Usuario TikTok no configurado.');
        console.warn('   Abrí http://localhost:' + PORT + ' para configurarlo.\n');
    }
});

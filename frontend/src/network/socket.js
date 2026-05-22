/**
 * Socket.IO — cliente del frontend
 *
 * Recibe eventos del servidor y los convierte en:
 *   - Alertas visuales en #alert-container
 *   - Custom DOM events que main.js escucha para afectar el juego
 *
 * Eventos DOM que dispara (window):
 *   snake-speed-change  → detail: { speed: number }
 *   snake-bonus-food    → detail: { user: string }
 *   snake-obstacle      → detail: { user: string, duration: number }
 */

(function () {
    'use strict';

    const SERVER_URL = 'http://localhost:3000';

    // Intentamos conectar; si el servidor no corre, el juego funciona igual
    const socket = io(SERVER_URL, {
        autoConnect:    true,
        reconnection:   true,
        reconnectionDelay: 3000,
        timeout:        5000
    });

    // ── Estado de conexión ────────────────────────────────────────────────
    socket.on('connect', () => {
        console.log('[socket] conectado al servidor ✓');
    });

    socket.on('connect_error', () => {
        console.warn('[socket] no se pudo conectar al servidor — el juego funciona offline');
    });

    socket.on('tiktok-status', data => {
        if (data.connected) {
            console.log(`[tiktok] en vivo como @${data.username ?? data.user}`);
        } else {
            console.warn('[tiktok] desconectado', data.error ?? '');
        }
    });

    // ── Leyenda de regalos ────────────────────────────────────────────────
    socket.on('gift-config', gifts => renderGiftLegend(gifts));

    // ── Narrador de comentarios ───────────────────────────────────────────
    let narEnabled  = true;
    let narVolume   = 0.8;
    let narRate     = 1.1;
    let narLang     = 'es';
    const narQueue  = [];
    let   narBusy   = false;
    const NAR_MAX   = 6;   // máximo comentarios encolados

    socket.on('narrator-config', ncfg => {
        narEnabled = ncfg.enabled ?? true;
        narVolume  = ncfg.volume  ?? 0.8;
        narRate    = ncfg.rate    ?? 1.1;
        narLang    = ncfg.lang    ?? 'es';
    });

    socket.on('narrate', ({ text }) => {
        if (!narEnabled || narVolume === 0) return;
        if (!text || text.trim().length < 2) return;
        if (narQueue.length >= NAR_MAX) return;   // descartar si la cola está llena
        narQueue.push(text.trim());
        if (!narBusy) drainNarrator();
    });

    function drainNarrator() {
        if (narQueue.length === 0) { narBusy = false; return; }
        narBusy = true;
        const text = narQueue.shift();
        const utt  = new SpeechSynthesisUtterance(text);
        utt.lang   = narLang;
        utt.volume = narVolume;
        utt.rate   = narRate;
        utt.onend  = drainNarrator;
        utt.onerror = drainNarrator;
        window.speechSynthesis.speak(utt);
    }

    // ── Alertas visuales ──────────────────────────────────────────────────
    socket.on('alert', data => showAlert(data));

    function showAlert({ icon = '💬', user = '', message = '' }) {
        const container = document.getElementById('alert-container');
        if (!container) return;

        const el = document.createElement('div');
        el.className = 'game-alert';
        el.innerHTML =
            `<span class="alert-icon">${icon}</span>` +
            `<span class="alert-text"><strong>@${user}</strong> ${message}</span>`;

        container.prepend(el);               // las nuevas van arriba
        requestAnimationFrame(() => el.classList.add('visible'));

        // Desaparecer tras 3.5 s
        setTimeout(() => {
            el.classList.remove('visible');
            setTimeout(() => el.remove(), 350);
        }, 3500);

        // Limitar a 5 alertas visibles simultáneas
        const alerts = container.querySelectorAll('.game-alert');
        if (alerts.length > 5) alerts[alerts.length - 1].remove();
    }

    // ── Cambio de velocidad ───────────────────────────────────────────────
    socket.on('speed-change', ({ delta }) => {
        window.dispatchEvent(new CustomEvent('snake-speed-change', { detail: { delta } }));
    });

    // ── Comida bonus ──────────────────────────────────────────────────────
    socket.on('bonus-food', ({ user }) => {
        window.dispatchEvent(new CustomEvent('snake-bonus-food', { detail: { user } }));
    });

    // ── Obstáculo (food al punto más lejano + flash rojo) ─────────────────
    socket.on('obstacle', ({ user, duration }) => {
        window.dispatchEvent(new CustomEvent('snake-obstacle', { detail: { user, duration } }));
    });

    // ── Crecer ────────────────────────────────────────────────────────────
    socket.on('snake-grow', ({ user, amount }) => {
        window.dispatchEvent(new CustomEvent('snake-grow', { detail: { user, amount } }));
    });

    // ── Encoger ───────────────────────────────────────────────────────────
    socket.on('snake-shrink', ({ user, amount }) => {
        window.dispatchEvent(new CustomEvent('snake-shrink', { detail: { user, amount } }));
    });

    // ── Arcoíris ──────────────────────────────────────────────────────────
    socket.on('snake-rainbow', ({ user, duration }) => {
        window.dispatchEvent(new CustomEvent('snake-rainbow', { detail: { user, duration } }));
    });

    // ── Congelar ──────────────────────────────────────────────────────────
    socket.on('snake-freeze', ({ user, duration }) => {
        window.dispatchEvent(new CustomEvent('snake-freeze', { detail: { user, duration } }));
    });

    // ── Leyenda de regalos ────────────────────────────────────────────────
    function effectDesc(g) {
        switch (g.effect) {
            case 'grow':       return `+${g.amount} segmentos`;
            case 'shrink':     return `−${g.amount} segmentos`;
            case 'rainbow':    return `Arcoíris · ${g.duration / 1000}s`;
            case 'freeze':     return `Congela · ${g.duration / 1000}s`;
            case 'bonus-food': return `Manzana dorada`;
            case 'obstacle':   return `Comida lejos + flash`;
            case 'grow-bonus': return `+${g.amount} seg + manzana`;
            case 'mega':       return `+${g.amount} seg · arcoíris ${g.duration / 1000}s`;
            default:           return g.effect;
        }
    }

    const EFFECT_COLORS = {
        'grow':       '#00c845',
        'grow-bonus': '#00c845',
        'mega':       '#00dd55',
        'shrink':     '#e05555',
        'rainbow':    '#dd88ff',
        'freeze':     '#66aaff',
        'bonus-food': '#ffcc00',
        'obstacle':   '#ff8833',
    };

    function renderGiftLegend(gifts) {
        const container = document.getElementById('legend-items');
        if (!container) return;

        if (!gifts || gifts.length === 0) {
            container.innerHTML = '<p class="legend-empty">Sin regalos<br>configurados</p>';
            return;
        }

        container.innerHTML = gifts.map(g => `
            <div class="legend-item">
                <span class="legend-icon">${g.icon}</span>
                <div class="legend-text">
                    <span class="legend-name">${g.name}</span>
                    <span class="legend-desc" style="color:${EFFECT_COLORS[g.effect] || '#aaa'}">${effectDesc(g)}</span>
                </div>
            </div>
        `).join('');
    }
})();

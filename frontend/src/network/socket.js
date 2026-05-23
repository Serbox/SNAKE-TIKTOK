/**
 * Socket.IO — cliente del frontend
 *
 * Recibe eventos del servidor y los convierte en:
 *   - Alertas visuales en #alert-container
 *   - Custom DOM events que main.js escucha para afectar el juego
 *
 * Eventos DOM que dispara (window):
 *   snake-speed-change      → detail: { delta }
 *   snake-bonus-food        → detail: { user }
 *   snake-obstacle          → detail: { user, duration }
 *   snake-grow              → detail: { user, displayName, amount }
 *   snake-shrink            → detail: { user, displayName, amount }
 *   snake-rainbow           → detail: { user, displayName, duration }
 *   snake-freeze            → detail: { user, displayName, duration }
 *   snake-blocks            → detail: { user, displayName, amount, duration }
 *   snake-fire              → detail: { user, displayName, duration }
 *   snake-reset-progress    → detail: { user, displayName }
 *   snake-minus-wins        → detail: { user, displayName, amount }
 *   snake-plus-wins         → detail: { user, displayName, amount }
 *   snake-donor-popup       → detail: { displayName, icon, label }
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
        narVolume  = Math.max(0, Math.min(1, ncfg.volume ?? 0.8));
        narRate    = Math.max(0.5, Math.min(3, ncfg.rate ?? 1.1));
        narLang    = ncfg.lang ?? 'es-ES';
    });

    socket.on('narrate', ({ text }) => {
        if (!narEnabled || narVolume <= 0) return;
        if (!text || text.trim().length < 2) return;
        if (narQueue.length >= NAR_MAX) return;
        narQueue.push(text.trim());
        if (!narBusy) drainNarrator();
    });

    function drainNarrator() {
        if (narQueue.length === 0) { narBusy = false; setNarIcon(false); return; }
        narBusy = true;
        setNarIcon(true);

        // Chrome bug: a veces queda "paused" — forzar resume antes de hablar
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();

        const text = narQueue.shift();
        const utt  = new SpeechSynthesisUtterance(text);
        utt.lang   = narLang;
        utt.volume = narVolume;
        utt.rate   = narRate;

        let done = false;
        const advance = () => { if (done) return; done = true; drainNarrator(); };

        utt.onend   = advance;
        utt.onerror = (e) => { console.warn('[narrator]', e.error); advance(); };

        window.speechSynthesis.speak(utt);

        // Safety timeout: Chrome a veces no dispara onend
        const palabras       = text.split(/\s+/).length;
        const tiempoEstimado = ((palabras / narRate) * 500) + 2500;
        setTimeout(advance, tiempoEstimado);
    }

    // Chrome bug: speechSynthesis se puede "congelar" en mitad de una frase.
    setInterval(() => {
        if (!narBusy) return;
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }, 2000);

    function setNarIcon(on) {
        const el = document.getElementById('nar-indicator');
        if (el) el.style.opacity = on ? '1' : '0';
    }

    window.testNarrador = () => {
        narQueue.unshift('¡Narrador funcionando correctamente!');
        if (!narBusy) drainNarrator();
    };

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

        container.prepend(el);
        requestAnimationFrame(() => el.classList.add('visible'));

        setTimeout(() => {
            el.classList.remove('visible');
            setTimeout(() => el.remove(), 350);
        }, 3500);

        const alerts = container.querySelectorAll('.game-alert');
        if (alerts.length > 5) alerts[alerts.length - 1].remove();
    }

    // ── Popup del donador (apodo visible, no username) ────────────────────
    socket.on('donor-popup', ({ displayName, icon, label }) => {
        window.dispatchEvent(new CustomEvent('snake-donor-popup', {
            detail: { displayName, icon, label }
        }));
    });

    // ── Cambio de velocidad ───────────────────────────────────────────────
    socket.on('speed-change', ({ delta }) => {
        window.dispatchEvent(new CustomEvent('snake-speed-change', { detail: { delta } }));
    });

    // ── Comida bonus ──────────────────────────────────────────────────────
    socket.on('bonus-food', ({ user }) => {
        window.dispatchEvent(new CustomEvent('snake-bonus-food', { detail: { user } }));
    });

    // ── Obstáculo ─────────────────────────────────────────────────────────
    socket.on('obstacle', ({ user, duration }) => {
        window.dispatchEvent(new CustomEvent('snake-obstacle', { detail: { user, duration } }));
    });

    // ── Crecer ────────────────────────────────────────────────────────────
    socket.on('snake-grow', ({ user, displayName, amount }) => {
        window.dispatchEvent(new CustomEvent('snake-grow', { detail: { user, displayName, amount } }));
    });

    // ── Encoger ───────────────────────────────────────────────────────────
    socket.on('snake-shrink', ({ user, displayName, amount }) => {
        window.dispatchEvent(new CustomEvent('snake-shrink', { detail: { user, displayName, amount } }));
    });

    // ── Arcoíris ──────────────────────────────────────────────────────────
    socket.on('snake-rainbow', ({ user, displayName, duration }) => {
        window.dispatchEvent(new CustomEvent('snake-rainbow', { detail: { user, displayName, duration } }));
    });

    // ── Congelar ──────────────────────────────────────────────────────────
    socket.on('snake-freeze', ({ user, displayName, duration }) => {
        window.dispatchEvent(new CustomEvent('snake-freeze', { detail: { user, displayName, duration } }));
    });

    // ── Bloques en el mapa ────────────────────────────────────────────────
    socket.on('snake-blocks', ({ user, displayName, amount, duration }) => {
        window.dispatchEvent(new CustomEvent('snake-blocks', { detail: { user, displayName, amount, duration } }));
    });

    // ── Fuego ─────────────────────────────────────────────────────────────
    socket.on('snake-fire', ({ user, displayName, duration }) => {
        window.dispatchEvent(new CustomEvent('snake-fire', { detail: { user, displayName, duration } }));
    });

    // ── Resetear progreso ─────────────────────────────────────────────────
    socket.on('snake-reset-progress', ({ user, displayName }) => {
        window.dispatchEvent(new CustomEvent('snake-reset-progress', { detail: { user, displayName } }));
    });

    // ── Quitar victoria ───────────────────────────────────────────────────
    socket.on('snake-minus-wins', ({ user, displayName, amount }) => {
        window.dispatchEvent(new CustomEvent('snake-minus-wins', { detail: { user, displayName, amount } }));
    });

    // ── Sumar victoria ────────────────────────────────────────────────────
    socket.on('snake-plus-wins', ({ user, displayName, amount }) => {
        window.dispatchEvent(new CustomEvent('snake-plus-wins', { detail: { user, displayName, amount } }));
    });

    // ── Leyenda de regalos ────────────────────────────────────────────────
    function effectDesc(g) {
        switch (g.effect) {
            case 'grow':            return `+${g.amount} segmentos`;
            case 'shrink':          return `−${g.amount} segmentos`;
            case 'rainbow':         return `Arcoíris · ${g.duration / 1000}s`;
            case 'freeze':          return `Congela · ${g.duration / 1000}s`;
            case 'bonus-food':      return `Manzana dorada`;
            case 'obstacle':        return `Comida lejos + flash`;
            case 'grow-bonus':      return `+${g.amount} seg + manzana`;
            case 'mega':            return `+${g.amount} seg · arcoíris ${g.duration / 1000}s`;
            case 'speed-up':        return `Turbo · acelera`;
            case 'blocks':          return `${g.amount} bloques · ${g.duration / 1000}s`;
            case 'freeze-shrink':   return `Congela · −${g.amount} seg`;
            case 'fire':            return `Fuego · ${g.duration / 1000}s`;
            case 'reset-progress':  return `Borra el progreso`;
            case 'minus-wins':      return `−${g.amount} victoria`;
            case 'plus-wins':       return `+${g.amount} victoria`;
            default:                return g.effect;
        }
    }

    const EFFECT_COLORS = {
        'grow':           '#00c845',
        'grow-bonus':     '#00c845',
        'mega':           '#00dd55',
        'shrink':         '#e05555',
        'rainbow':        '#dd88ff',
        'freeze':         '#66aaff',
        'freeze-shrink':  '#88ccff',
        'bonus-food':     '#ffcc00',
        'obstacle':       '#ff8833',
        'speed-up':       '#ffee00',
        'blocks':         '#cc4444',
        'fire':           '#ff6622',
        'reset-progress': '#ff2222',
        'minus-wins':     '#ff5555',
        'plus-wins':      '#44ff88',
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

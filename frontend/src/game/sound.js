/**
 * SoundManager
 * Usa Web Audio API para sonidos procedurales (no necesita archivos .mp3).
 * También carga los sonidos existentes de clic y comer si están disponibles.
 */
class SoundManager {
    constructor() {
        this._ctx = null;

        // Sonidos de archivo (existentes) — fallback si fallan, no bloquean
        this._click = this._loadAudio('assets/sounds/click.mp3', 0.2);
        this._eat   = this._loadAudio('assets/sounds/eat.mp3',   0.7);
    }

    _loadAudio(src, vol) {
        try {
            const a = new Audio(src);
            a.volume = vol;
            return a;
        } catch (_) { return null; }
    }

    // Inicializa (o reanuda) el AudioContext — debe llamarse tras una interacción
    _ctx_get() {
        if (!this._ctx) {
            try {
                this._ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (_) { return null; }
        }
        if (this._ctx.state === 'suspended') this._ctx.resume();
        return this._ctx;
    }

    // Oscilador simple con envelope de volumen
    _tone(freq, type, vol, dur, startFreq = null) {
        const ctx = this._ctx_get();
        if (!ctx) return;
        const t   = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.connect(g);
        g.connect(ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(startFreq ?? freq, t);
        if (startFreq !== null) osc.frequency.exponentialRampToValueAtTime(freq, t + dur * 0.8);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t);
        osc.stop(t + dur + 0.05);
    }

    // Ráfaga de ruido blanco (para fuego, crash)
    _noise(vol, dur, filterFreq = 400) {
        const ctx = this._ctx_get();
        if (!ctx) return;
        const bufLen = Math.floor(ctx.sampleRate * dur);
        const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data   = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
        const src    = ctx.createBufferSource();
        src.buffer   = buf;
        const filt   = ctx.createBiquadFilter();
        filt.type    = 'bandpass';
        filt.frequency.value = filterFreq;
        filt.Q.value = 0.5;
        const g      = ctx.createGain();
        src.connect(filt); filt.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(vol, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        src.start();
        src.stop(ctx.currentTime + dur + 0.05);
    }

    // ── Sonidos de juego ──────────────────────────────────────────────────

    playClick() {
        if (this._click) { this._click.currentTime = 0; this._click.play().catch(() => {}); }
    }

    playEat() {
        if (this._eat) { this._eat.currentTime = 0; this._eat.play().catch(() => {}); }
        // Refuerzo sintético suave
        this._tone(880, 'sine', 0.12, 0.1);
    }

    // ── Efectos de regalos ────────────────────────────────────────────────

    playGrow() {
        // Arpeggio ascendente alegre
        [330, 440, 550, 660].forEach((f, i) =>
            setTimeout(() => this._tone(f, 'sine', 0.22, 0.18), i * 60)
        );
    }

    playShrink() {
        // Glissando descendente
        this._tone(200, 'sawtooth', 0.25, 0.5, 700);
        setTimeout(() => this._tone(120, 'sine', 0.12, 0.3), 200);
    }

    playFreeze() {
        // Campanitas frías
        [1200, 900, 1500, 700].forEach((f, i) =>
            setTimeout(() => this._tone(f, 'sine', 0.18, 0.35), i * 90)
        );
    }

    playFire() {
        // Ruido crepitante + tono grave
        this._noise(0.45, 0.7, 180);
        this._tone(110, 'sawtooth', 0.18, 0.5);
        setTimeout(() => this._noise(0.3, 0.5, 220), 300);
    }

    playBlocks() {
        // Golpes sordos
        this._tone(140, 'square', 0.30, 0.25);
        setTimeout(() => this._tone(100, 'square', 0.25, 0.30), 180);
        this._noise(0.2, 0.3, 150);
    }

    playFreezeAndShrink() {
        this.playFreeze();
        setTimeout(() => this.playShrink(), 400);
    }

    playReset() {
        // Crash dramático
        this._noise(0.55, 0.9, 300);
        this._tone(180, 'sawtooth', 0.35, 0.7, 700);
        setTimeout(() => this._tone(80, 'square', 0.28, 0.5), 250);
    }

    playWinAdd() {
        // Fanfarria breve
        [523, 659, 784, 1047].forEach((f, i) =>
            setTimeout(() => this._tone(f, 'sine', 0.25, 0.22), i * 85)
        );
    }

    playWinRemove() {
        // Bajada triste
        [523, 440, 349, 262].forEach((f, i) =>
            setTimeout(() => this._tone(f, 'sawtooth', 0.22, 0.28), i * 85)
        );
    }

    playSpeedUp() {
        this._tone(600, 'sine', 0.2, 0.15, 300);
        setTimeout(() => this._tone(900, 'sine', 0.18, 0.15), 120);
    }

    playDonor() {
        // Fanfarria llamativa para el popup del donador
        [523, 659, 784].forEach((f, i) =>
            setTimeout(() => this._tone(f, 'sine', 0.28, 0.2), i * 90)
        );
        setTimeout(() => this._tone(1047, 'sine', 0.32, 0.4), 290);
    }
}

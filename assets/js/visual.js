/**
 * visual.js — Activity 1
 * Feat 1 : Z-axis value → background color mapping (HSL: blue → green → red)
 * Feat 2 : Canvas-based real-time Z-axis waveform graph
 * Note   : X/Y axes are recorded in CSV but not displayed here
 */

const VisualModule = (() => {

    // ── Config ───────────────────────────────────────────────────
    const WINDOW_SEC = 10;   // seconds of data shown on graph
    const MAX_Z      = 3;    // |acc_z| ceiling for color mapping (m/s²)
    const Z_COLOR    = '#00d2d3';
    const GRID_COLOR = '#2e2e2e';
    const BG_CANVAS  = '#1c1c1c';

    // ── State ────────────────────────────────────────────────────
    const buffer = [];   // [{ ts, z }]

    // ── DOM refs ─────────────────────────────────────────────────
    let bodyEl  = null;
    let labelEl = null;
    let canvas  = null;
    let ctx     = null;

    function _initDOM() {
        bodyEl  = document.getElementById('activity-body');
        labelEl = document.getElementById('magnitude-label');
        canvas  = document.getElementById('waveChart');
        if (canvas) {
            ctx = canvas.getContext('2d');
            _startLoop();
        }
    }

    // ── Color mapping ─────────────────────────────────────────────
    // |acc_z| 0 → hue 240 (blue) … MAX_Z → hue 0 (red)
    function _zToHSL(z) {
        const ratio = Math.min(Math.abs(z) / MAX_Z, 1);
        const hue   = Math.round(240 - ratio * 240);
        return `hsl(${hue}, 80%, 25%)`;
    }

    // ── Rendering loop ────────────────────────────────────────────
    function _startLoop() {
        function draw() {
            requestAnimationFrame(draw);
            _drawWaveform();
        }
        draw();
    }

    function _drawWaveform() {
        if (!ctx || !canvas) return;

        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width  = w;
            canvas.height = h;
        }

        ctx.fillStyle = BG_CANVAS;
        ctx.fillRect(0, 0, w, h);

        if (buffer.length < 2) return;

        const now    = buffer[buffer.length - 1].ts;
        const oldest = now - WINDOW_SEC * 1000;
        const range  = MAX_Z;
        const midY   = h / 2;
        const yScale = h / (range * 2);

        _drawGrid(w, h, midY, range, yScale);

        // Z-axis waveform
        ctx.beginPath();
        ctx.strokeStyle = Z_COLOR;
        ctx.lineWidth   = 2;
        ctx.lineJoin    = 'round';

        let first = true;
        for (const pt of buffer) {
            if (pt.ts < oldest) continue;
            const px = ((pt.ts - oldest) / (WINDOW_SEC * 1000)) * w;
            const py = midY - pt.z * yScale;
            if (first) { ctx.moveTo(px, py); first = false; }
            else          ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Label
        ctx.fillStyle = Z_COLOR;
        ctx.font      = 'bold 11px sans-serif';
        ctx.fillText('Z', 8, 14);
    }

    function _drawGrid(w, h, midY, range, yScale) {
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth   = 1;

        for (let v = -range; v <= range; v += 1) {
            const y = midY - v * yScale;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();

            if (v !== 0) {
                ctx.fillStyle = '#555';
                ctx.font      = '10px sans-serif';
                ctx.fillText(v, 4, y - 2);
            }
        }

        // Center line
        ctx.strokeStyle = '#444';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(w, midY);
        ctx.stroke();
    }

    function _trimBuffer() {
        if (buffer.length === 0) return;
        const cutoff = buffer[buffer.length - 1].ts - (WINDOW_SEC + 2) * 1000;
        while (buffer.length > 0 && buffer[0].ts < cutoff) buffer.shift();
    }

    // ── Public API ────────────────────────────────────────────────

    function update(data) {
        if (!bodyEl) _initDOM();

        buffer.push({ ts: Date.now(), z: data.acc_z });
        _trimBuffer();

        // Background color based on Z-axis
        if (bodyEl)  bodyEl.style.backgroundColor = _zToHSL(data.acc_z);

        // Label shows Z value
        if (labelEl) labelEl.textContent = data.acc_z.toFixed(3);
    }

    function reset() {
        buffer.length = 0;
        if (bodyEl)  bodyEl.style.backgroundColor = '';
        if (labelEl) labelEl.textContent = '0.000';
    }

    return { update, reset };
})();

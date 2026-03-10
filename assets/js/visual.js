/**
 * visual.js — Activity 1
 * Feat 1 : Z-axis value → background color mapping (HSL: blue → green → red)
 * Feat 2 : Canvas-based real-time Z-axis waveform graph
 * Note   : X/Y axes are recorded in CSV but not displayed here
 */

const VisualModule = (() => {

    // ── Config ───────────────────────────────────────────────────
    const WINDOW_SEC  = 10;    // seconds of data shown on graph
    const MAX_Z       = 1.5;   // |acc_z| ceiling for background color mapping (m/s²)
    const MIN_RANGE   = 0.5;   // minimum Y-axis half-range (m/s²)
    const DECAY_RATE  = 0.997; // per-frame peak decay (slower = stays zoomed out longer)
    const Z_COLOR     = '#00d2d3';
    const GRID_COLOR  = '#2e2e2e';
    const BG_CANVAS   = '#1c1c1c';

    // ── State ────────────────────────────────────────────────────
    const buffer = [];      // [{ ts, z }]
    let _peakZ   = MIN_RANGE; // current auto-scale peak (m/s²)

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
        return `hsl(${hue}, 90%, 45%)`;
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

        const now     = buffer[buffer.length - 1].ts;
        const elapsed = now - buffer[0].ts;
        const windowMs = WINDOW_SEC * 1000;

        // Anchor left until window is full; then slide
        const timeStart = elapsed < windowMs ? buffer[0].ts : now - windowMs;
        const timeEnd   = elapsed < windowMs ? buffer[0].ts + windowMs : now;

        // ── Auto-scale Y axis ─────────────────────────────────────
        // Find max |z| in visible window
        let maxAbsZ = 0;
        for (const pt of buffer) {
            if (pt.ts >= timeStart && Math.abs(pt.z) > maxAbsZ)
                maxAbsZ = Math.abs(pt.z);
        }
        // Scale up immediately, decay slowly
        if (maxAbsZ * 1.2 > _peakZ) {
            _peakZ = maxAbsZ * 1.2;
        } else {
            _peakZ = Math.max(_peakZ * DECAY_RATE, MIN_RANGE);
        }

        const range  = _peakZ;
        const midY   = h / 2;
        const yScale = h / (range * 2);

        _drawGrid(w, h, midY, range, yScale);

        // Z-axis waveform — smooth quadratic bezier through each data point
        // (pure rendering change: data values are unmodified)
        ctx.beginPath();
        ctx.strokeStyle = Z_COLOR;
        ctx.lineWidth   = 2;
        ctx.lineJoin    = 'round';

        let prevPx = null, prevPy = null;
        for (const pt of buffer) {
            if (pt.ts < timeStart) continue;
            const px = ((pt.ts - timeStart) / windowMs) * w;
            const py = midY - pt.z * yScale;
            if (prevPx === null) {
                ctx.moveTo(px, py);
            } else {
                const midX = (prevPx + px) / 2;
                const midY2 = (prevPy + py) / 2;
                ctx.quadraticCurveTo(prevPx, prevPy, midX, midY2);
            }
            prevPx = px; prevPy = py;
        }
        if (prevPx !== null) ctx.lineTo(prevPx, prevPy);
        ctx.stroke();
        _drawTimeAxis(w, h, timeStart, timeEnd, windowMs);

        // Label
        ctx.fillStyle = Z_COLOR;
        ctx.font      = 'bold 11px sans-serif';
        ctx.fillText('Z', 8, 14);
    }

    function _drawGrid(w, h, midY, range, yScale) {
        // Pick a round grid step based on current range
        const step = range <= 1   ? 0.25
                   : range <= 3   ? 0.5
                   : range <= 10  ? 1
                   : range <= 30  ? 5
                   : 10;

        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth   = 1;

        for (let v = -range; v <= range; v += step) {
            const vR = Math.round(v * 1000) / 1000; // float precision fix
            const y  = midY - vR * yScale;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();

            if (vR !== 0) {
                ctx.fillStyle = '#555';
                ctx.font      = '10px sans-serif';
                ctx.fillText(vR.toFixed(2), 4, y - 2);
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

    function _drawTimeAxis(w, h, timeStart, timeEnd, windowMs) {
        const stepMs = 2000; // 2-second tick interval
        ctx.fillStyle   = '#555';
        ctx.font        = '9px sans-serif';
        ctx.strokeStyle = '#2e2e2e';
        ctx.lineWidth   = 1;

        const firstTick = Math.ceil(timeStart / stepMs) * stepMs;
        for (let t = firstTick; t <= timeEnd; t += stepMs) {
            const x      = ((t - timeStart) / windowMs) * w;
            const relSec = Math.round((t - timeEnd) / 1000);
            const label  = relSec === 0 ? '0s' : `${relSec}s`;
            ctx.beginPath();
            ctx.moveTo(x, h - 14);
            ctx.lineTo(x, h);
            ctx.stroke();
            ctx.fillText(label, x + 2, h - 2);
        }
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
        if (labelEl) labelEl.textContent = data.acc_z.toFixed(6);
    }

    function reset() {
        buffer.length = 0;
        _peakZ = MIN_RANGE;
        if (bodyEl)  bodyEl.style.backgroundColor = '';
        if (labelEl) labelEl.textContent = '0.000000';
    }

    return { update, reset };
})();

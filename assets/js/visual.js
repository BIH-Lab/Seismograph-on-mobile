/**
 * visual.js
 * Role   : Visualize sensor data
 * Feat 1 : magnitude → background color mapping (HSL: blue → green → red)
 * Feat 2 : Canvas-based real-time waveform graph (X · Y · Z axes)
 */

const VisualModule = (() => {

    // ── Config ───────────────────────────────────────────────────
    const WINDOW_SEC  = 10;       // seconds of data shown on graph
    const MAX_MAG     = 3;        // magnitude ceiling for color mapping (m/s²) — calibrated values are near 0 at rest
    const AXIS_COLORS = {
        x: '#ff6b6b',   // red
        y: '#2ed573',   // green
        z: '#00d2d3',   // cyan
    };
    const GRID_COLOR  = '#2e2e2e';
    const BG_CANVAS   = '#1c1c1c';

    // ── State ────────────────────────────────────────────────────
    const buffer = [];   // [{ timestamp_ms, acc_x, acc_y, acc_z }]

    // ── DOM refs (resolved lazily on first update) ───────────────
    let bodyEl      = null;
    let labelEl     = null;
    let canvas      = null;
    let ctx         = null;
    let rafId       = null;

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
    // magnitude 0 → hue 240 (blue)
    // magnitude MAX_MAG → hue 0 (red)
    // saturation/lightness fixed for dark theme readability
    function _magToHSL(magnitude) {
        const ratio = Math.min(magnitude / MAX_MAG, 1);
        const hue   = Math.round(240 - ratio * 240);   // 240 → 0
        return `hsl(${hue}, 80%, 25%)`;
    }

    // ── Canvas rendering loop ─────────────────────────────────────
    function _startLoop() {
        function draw() {
            rafId = requestAnimationFrame(draw);
            _drawWaveform();
        }
        draw();
    }

    function _drawWaveform() {
        if (!ctx || !canvas) return;

        // Match canvas resolution to CSS size
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width  = w;
            canvas.height = h;
        }

        // Clear
        ctx.fillStyle = BG_CANVAS;
        ctx.fillRect(0, 0, w, h);

        if (buffer.length < 2) return;

        const now     = buffer[buffer.length - 1].ts;
        const oldest  = now - WINDOW_SEC * 1000;

        // Draw grid lines (center + ±range)
        const range  = 3;    // ±3 m/s² display range (calibrated values)
        const midY   = h / 2;
        const yScale = h / (range * 2);

        _drawGrid(w, h, midY, range, yScale);

        // Draw each axis
        for (const axis of ['x', 'y', 'z']) {
            ctx.beginPath();
            ctx.strokeStyle = AXIS_COLORS[axis];
            ctx.lineWidth   = 1.5;
            ctx.lineJoin    = 'round';

            let first = true;
            for (const pt of buffer) {
                if (pt.ts < oldest) continue;

                const px = ((pt.ts - oldest) / (WINDOW_SEC * 1000)) * w;
                const py = midY - pt[axis] * yScale;

                if (first) { ctx.moveTo(px, py); first = false; }
                else         ctx.lineTo(px, py);
            }
            ctx.stroke();
        }

        // Legend
        _drawLegend(w);
    }

    function _drawGrid(w, h, midY, range, yScale) {
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth   = 1;

        // Horizontal lines at 0, ±1, ±2, ±3
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

        // Center line (thicker)
        ctx.strokeStyle = '#444';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(w, midY);
        ctx.stroke();
    }

    function _drawLegend(w) {
        const labels = [['X', 'x'], ['Y', 'y'], ['Z', 'z']];
        let x = 8;
        ctx.font = 'bold 11px sans-serif';
        for (const [label, axis] of labels) {
            ctx.fillStyle = AXIS_COLORS[axis];
            ctx.fillText(label, x, 14);
            x += 20;
        }
    }

    // ── Trim buffer to WINDOW_SEC + small margin ──────────────────
    function _trimBuffer() {
        if (buffer.length === 0) return;
        const cutoff = buffer[buffer.length - 1].ts - (WINDOW_SEC + 2) * 1000;
        while (buffer.length > 0 && buffer[0].ts < cutoff) {
            buffer.shift();
        }
    }

    // ── Public API ────────────────────────────────────────────────

    /**
     * Called by activity1/index.html for every sensor data point.
     * @param {{ timestamp, acc_x, acc_y, acc_z, magnitude }} data
     */
    function update(data) {
        if (!bodyEl) _initDOM();

        // Store in buffer
        buffer.push({
            ts : Date.now(),
            x  : data.acc_x,
            y  : data.acc_y,
            z  : data.acc_z,
        });
        _trimBuffer();

        // Background color
        if (bodyEl) {
            bodyEl.style.backgroundColor = _magToHSL(data.magnitude);
        }

        // Magnitude label
        if (labelEl) {
            labelEl.textContent = data.magnitude.toFixed(3);
        }
    }

    /** Reset visuals when measurement stops. */
    function reset() {
        buffer.length = 0;
        if (bodyEl)  bodyEl.style.backgroundColor = '';
        if (labelEl) labelEl.textContent = '0.000';
    }

    return { update, reset };
})();

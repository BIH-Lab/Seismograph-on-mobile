/**
 * visual.js — Activity 1
 * Feat 1 : Z-axis value → MMI-based background color mapping
 * Feat 2 : Canvas-based real-time Z-axis waveform graph
 * Feat 3 : Color lock (freeze at peak MMI), full buffer for review mode
 */

const VisualModule = (() => {

    // ── Config ───────────────────────────────────────────────────
    const WINDOW_SEC  = 10;    // seconds of data shown on graph
    const MIN_RANGE   = 0.5;   // minimum Y-axis half-range (m/s²)
    const DECAY_RATE  = 0.997; // per-frame peak decay
    const Z_COLOR     = '#00d2d3';
    const GRID_COLOR  = '#2e2e2e';
    const BG_CANVAS   = '#1c1c1c';

    // ── MMI Scale (KMA, PGA m/s²) ────────────────────────────────
    const MMI_LEVELS = [
        { level: 'I',    name: '무감',     pgaMin: 0,      pgaMax: 0.0017,   color: '#303060' },
        { level: 'II',   name: '미감',     pgaMin: 0.0017, pgaMax: 0.014,    color: '#1a6b8a' },
        { level: 'III',  name: '약진',     pgaMin: 0.014,  pgaMax: 0.039,    color: '#1e90b0' },
        { level: 'IV',   name: '경진',     pgaMin: 0.039,  pgaMax: 0.092,    color: '#2ecc71' },
        { level: 'V',    name: '중진',     pgaMin: 0.092,  pgaMax: 0.18,     color: '#a0c820' },
        { level: 'VI',   name: '강진',     pgaMin: 0.18,   pgaMax: 0.34,     color: '#f0d800' },
        { level: 'VII',  name: '심한강진', pgaMin: 0.34,   pgaMax: 0.65,     color: '#f39c12' },
        { level: 'VIII', name: '격진',     pgaMin: 0.65,   pgaMax: 1.24,     color: '#e74c3c' },
        { level: 'IX',   name: '극렬',     pgaMin: 1.24,   pgaMax: 2.37,     color: '#c0392b' },
        { level: 'X+',   name: '완전파괴', pgaMin: 2.37,   pgaMax: Infinity, color: '#7b241c' },
    ];

    // ── State ────────────────────────────────────────────────────
    const buffer      = [];      // [{ ts, z }] — trimmed live buffer for waveform
    const _fullBuffer = [];      // [{ ts, z }] — untrimmed, for review mode
    let _peakZ        = MIN_RANGE; // auto-scale peak (m/s²)
    let _peakMmiZ     = 0;         // max |acc_z| for MMI color (separate from _peakZ)
    let _smoothZ      = 0;         // asymmetric EMA: fast up, slow down
    let _colorLocked  = false;
    let _startTs      = null;      // timestamp of first sample

    // ── DOM refs ─────────────────────────────────────────────────
    let bodyEl      = null;
    let labelEl     = null;
    let mmiLevelEl  = null;
    let canvas      = null;
    let ctx         = null;

    function _initDOM() {
        bodyEl     = document.getElementById('activity-body');
        labelEl    = document.getElementById('magnitude-label');
        mmiLevelEl = document.getElementById('mmi-level-text');
        canvas     = document.getElementById('waveChart');
        if (canvas) {
            ctx = canvas.getContext('2d');
            _startLoop();
        }
    }

    // ── MMI mapping ───────────────────────────────────────────────
    function _zToMMI(absZ) {
        for (let i = MMI_LEVELS.length - 1; i >= 0; i--) {
            if (absZ >= MMI_LEVELS[i].pgaMin) return MMI_LEVELS[i];
        }
        return MMI_LEVELS[0];
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

        const now      = buffer[buffer.length - 1].ts;
        const elapsed  = now - buffer[0].ts;
        const windowMs = WINDOW_SEC * 1000;

        // Anchor left until window is full; then slide
        const timeStart = elapsed < windowMs ? buffer[0].ts : now - windowMs;
        const timeEnd   = elapsed < windowMs ? buffer[0].ts + windowMs : now;

        // ── Auto-scale Y axis ─────────────────────────────────────
        let maxAbsZ = 0;
        for (const pt of buffer) {
            if (pt.ts >= timeStart && Math.abs(pt.z) > maxAbsZ)
                maxAbsZ = Math.abs(pt.z);
        }
        if (maxAbsZ * 1.2 > _peakZ) {
            _peakZ = maxAbsZ * 1.2;
        } else {
            _peakZ = Math.max(_peakZ * DECAY_RATE, MIN_RANGE);
        }

        const range  = _peakZ;
        const midY   = h / 2;
        const yScale = h / (range * 2);

        _drawGrid(w, h, midY, range, yScale);

        // Z-axis waveform
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
                const midX  = (prevPx + px) / 2;
                const midY2 = (prevPy + py) / 2;
                ctx.quadraticCurveTo(prevPx, prevPy, midX, midY2);
            }
            prevPx = px; prevPy = py;
        }
        if (prevPx !== null) ctx.lineTo(prevPx, prevPy);
        ctx.stroke();
        _drawTimeAxis(w, h, timeStart, timeEnd, windowMs);

        ctx.fillStyle = Z_COLOR;
        ctx.font      = 'bold 11px sans-serif';
        ctx.fillText('Z', 8, 14);
    }

    function _drawGrid(w, h, midY, range, yScale) {
        const step = range <= 1   ? 0.25
                   : range <= 3   ? 0.5
                   : range <= 10  ? 1
                   : range <= 30  ? 5
                   : 10;

        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth   = 1;

        for (let v = -range; v <= range; v += step) {
            const vR = Math.round(v * 1000) / 1000;
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

        ctx.strokeStyle = '#444';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(w, midY);
        ctx.stroke();
    }

    function _drawTimeAxis(w, h, timeStart, timeEnd, windowMs) {
        if (!_startTs) return;
        const stepMs = 2000;
        ctx.fillStyle   = '#555';
        ctx.font        = '9px sans-serif';
        ctx.strokeStyle = '#2e2e2e';
        ctx.lineWidth   = 1;

        const firstTick = Math.ceil(timeStart / stepMs) * stepMs;
        for (let t = firstTick; t <= timeEnd; t += stepMs) {
            const x          = ((t - timeStart) / windowMs) * w;
            const elapsedSec = Math.round((t - _startTs) / 1000);
            if (elapsedSec < 0) continue;
            const label = `${elapsedSec}s`;
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

        const now = Date.now();
        if (!_startTs) _startTs = now;
        buffer.push({ ts: now, z: data.acc_z });
        _fullBuffer.push({ ts: now, z: data.acc_z });
        _trimBuffer();

        const absZ = Math.abs(data.acc_z);
        if (absZ > _peakMmiZ) _peakMmiZ = absZ;

        // Asymmetric EMA: fast up, slow down (suppresses stationary noise)
        _smoothZ = absZ > _smoothZ ? absZ : _smoothZ * 0.92 + absZ * 0.08;

        if (!_colorLocked) {
            const mmi = _zToMMI(_smoothZ);
            if (bodyEl)     bodyEl.style.backgroundColor = mmi.color;
            if (mmiLevelEl) mmiLevelEl.textContent = `진도 ${mmi.level} ${mmi.name}`;
        }

        if (labelEl) labelEl.textContent = data.acc_z.toFixed(6);
    }

    function reset() {
        buffer.length      = 0;
        _fullBuffer.length = 0;
        _peakZ        = MIN_RANGE;
        _peakMmiZ     = 0;
        _smoothZ      = 0;
        _colorLocked  = false;
        _startTs      = null;
        if (bodyEl)     bodyEl.style.backgroundColor = '';
        if (labelEl)    labelEl.textContent = '0.000000';
        if (mmiLevelEl) mmiLevelEl.textContent = '';
    }

    // Color lock: freeze background at current peak MMI
    function setColorLock(locked) {
        _colorLocked = locked;
        if (locked) {
            const mmi = _zToMMI(_peakMmiZ);
            if (bodyEl)     bodyEl.style.backgroundColor = mmi.color;
            if (mmiLevelEl) mmiLevelEl.textContent = `진도 ${mmi.level} ${mmi.name} (고정)`;
        }
    }

    // Return MMI color for a given |acc_z| (used by ReviewModule)
    function getMmiColor(absZ) {
        return _zToMMI(absZ).color;
    }

    // Return MMI level info for a given |acc_z|
    function getMmiInfo(absZ) {
        return _zToMMI(absZ);
    }

    // Return MMI_LEVELS array for info modal table
    function getMmiLevels() {
        return MMI_LEVELS;
    }

    // Return snapshot of full buffer for review mode
    function startReview() {
        return _fullBuffer.slice();
    }

    return { update, reset, setColorLock, getMmiColor, getMmiInfo, getMmiLevels, startReview };
})();

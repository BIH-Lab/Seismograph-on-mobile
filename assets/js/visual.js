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

    // ── MMI Scale (KMA 2018, PGA m/s²) ──────────────────────────
    // Source: 기상청 수정 메르칼리 진도등급 고시 (2018.11.28.)
    // Conversion: 1 %g = 0.0981 m/s²  (g = 9.81 m/s²)
    // XII는 PGV 기준만 정의 → PGA 검출 불가, XI+로 병합
    const MMI_LEVELS = [
        { level: 'I',    name: '무감',     desc: '대부분 사람들은 느낄 수 없으나, 지진계에는 기록된다.',                                                           pgaMin: 0,        pgaMax: 0.00687,  color: '#303060' },
        { level: 'II',   name: '미감',     desc: '조용한 상태나 건물 위층에 있는 소수의 사람만 느낀다. 매달린 물체가 약하게 흔들린다.',                             pgaMin: 0.00687,  pgaMax: 0.02256,  color: '#1a6b8a' },
        { level: 'III',  name: '약진',     desc: '실내, 특히 건물 위층에 있는 사람이 현저하게 느끼며, 정지하고 있는 차가 약간 흔들린다.',                           pgaMin: 0.02256,  pgaMax: 0.07456,  color: '#1e90b0' },
        { level: 'IV',   name: '경진',     desc: '실내에서 많은 사람이 느끼고, 밤에는 잠에서 깨기도 하며, 그릇과 창문 등이 흔들린다.',                              pgaMin: 0.07456,  pgaMax: 0.25114,  color: '#2ecc71' },
        { level: 'V',    name: '중진',     desc: '거의 모든 사람이 진동을 느끼고, 그릇·창문 등이 깨지기도 하며, 불안정한 물체는 넘어진다.',                          pgaMin: 0.25114,  pgaMax: 0.67297,  color: '#a0c820' },
        { level: 'VI',   name: '강진',     desc: '모든 사람이 느끼고, 일부 무거운 가구가 움직이며, 벽의 석회가 떨어지기도 한다.',                                    pgaMin: 0.67297,  pgaMax: 1.44471,  color: '#f0d800' },
        { level: 'VII',  name: '심한강진', desc: '일반 건물에 약간의 피해가 발생하며, 부실한 건물에는 상당한 피해가 발생한다.',                                       pgaMin: 1.44471,  pgaMax: 3.10585,  color: '#f39c12' },
        { level: 'VIII', name: '격진',     desc: '일반 건물에 부분적 붕괴 등 상당한 피해가 발생하며, 부실한 건물에는 심각한 피해가 발생한다.',                        pgaMin: 3.10585,  pgaMax: 6.67178,  color: '#e74c3c' },
        { level: 'IX',   name: '극렬',     desc: '잘 설계된 건물에도 상당한 피해가 발생하며, 일반 건축물에는 붕괴 등 큰 피해가 발생한다.',                            pgaMin: 6.67178,  pgaMax: 14.3363,  color: '#c0392b' },
        { level: 'X',    name: '대격진',   desc: '대부분의 석조 및 골조 건물이 파괴되고, 기차선로가 휘어진다.',                                                       pgaMin: 14.3363,  pgaMax: 30.8034,  color: '#922b21' },
        { level: 'XI+',  name: '완전파괴', desc: '남아있는 구조물이 거의 없으며, 다리가 무너지고 기차선로가 심각하게 휘어진다.',                                      pgaMin: 30.8034,  pgaMax: Infinity, color: '#7b241c' },
    ];

    // ── State ────────────────────────────────────────────────────
    const buffer      = [];      // [{ ts, z }] — trimmed live buffer for waveform
    const _fullBuffer = [];      // [{ ts, z }] — untrimmed, for review mode
    let _peakZ        = MIN_RANGE; // auto-scale peak (m/s²)
    let _peakMmiZ        = 0;         // max |acc_z| for MMI color (separate from _peakZ)
    let _colorLocked     = false;
    let _renderingPaused = false;    // true while ReviewModule owns the canvas
    let _startTs         = null;     // timestamp of first sample

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
        if (_renderingPaused) return;
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

        const absZ      = Math.abs(data.acc_z);
        const isNewPeak = absZ > _peakMmiZ;
        if (isNewPeak) _peakMmiZ = absZ;

        // Sliding window PGA: max |acc_z| over last 300 ms
        const WINDOW_MS = 300;
        const cutoff    = now - WINDOW_MS;
        let pgaZ = absZ;
        for (const pt of buffer) {
            if (pt.ts >= cutoff && Math.abs(pt.z) > pgaZ) pgaZ = Math.abs(pt.z);
        }

        if (_colorLocked) {
            // Peak-hold mode: update display only when a new all-time peak is detected
            if (isNewPeak) {
                const mmi = _zToMMI(_peakMmiZ);
                if (bodyEl)     bodyEl.style.backgroundColor = mmi.color;
                if (mmiLevelEl) mmiLevelEl.textContent = `진도 ${mmi.level} (고정)`;
            }
        } else {
            // Real-time mode: update display with 300ms sliding window PGA
            const mmi = _zToMMI(pgaZ);
            if (bodyEl)     bodyEl.style.backgroundColor = mmi.color;
            if (mmiLevelEl) mmiLevelEl.textContent = `진도 ${mmi.level}`;
        }

        if (labelEl) labelEl.textContent = data.acc_z.toFixed(6);
    }

    function reset() {
        buffer.length      = 0;
        _fullBuffer.length = 0;
        _peakZ           = MIN_RANGE;
        _peakMmiZ        = 0;
        _colorLocked     = false;
        _renderingPaused = false;
        _startTs         = null;
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
            if (mmiLevelEl) mmiLevelEl.textContent = `진도 ${mmi.level} (고정)`;
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

    // Return snapshot of full buffer for review mode; pause live rendering
    function startReview() {
        _renderingPaused = true;
        return _fullBuffer.slice();
    }

    return { update, reset, setColorLock, getMmiColor, getMmiInfo, getMmiLevels, startReview };
})();

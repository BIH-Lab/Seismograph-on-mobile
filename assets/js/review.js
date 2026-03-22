/**
 * review.js — Activity 1 Review Mode
 * After measurement stops, renders full waveform on canvas with a
 * fixed center window (2 s). User pans the waveform left/right by
 * dragging to explore present → past. Window's peak |acc_z| is
 * reported via onRegion callback for MMI display.
 */

const ReviewModule = (() => {

    // ── Config ────────────────────────────────────────────────────
    const WINDOW_SEC  = 10;     // seconds visible on canvas at once
    const REGION_SEC  = 1.0;    // center highlight window width (seconds)
    const Z_COLOR     = '#00d2d3';
    const GRID_COLOR  = '#2e2e2e';
    const BG_CANVAS   = '#1c1c1c';
    const REGION_FILL   = 'rgba(255,255,255,0.12)';
    const REGION_BORDER = 'rgba(255,255,255,0.55)';

    // ── State ─────────────────────────────────────────────────────
    let _canvas      = null;
    let _ctx         = null;
    let _data        = [];      // [{ts, z}] snapshot from VisualModule
    let _viewCenter  = 0;       // center timestamp of current viewport (ms)
    let _isDragging  = false;
    let _dragStartX  = 0;
    let _dragStartVC = 0;       // _viewCenter at drag start
    let _onRegion    = null;    // callback(maxAbsZ, level, name, timeLabel)
    let _rafId       = null;
    let _dirty       = true;

    // ── Init / Destroy ────────────────────────────────────────────

    function init(canvasEl, data, onRegion) {
        _canvas   = canvasEl;
        _data     = data;
        _onRegion = onRegion;

        // Start at beginning: region covers the first REGION_SEC of data
        if (_data.length > 0) {
            _viewCenter = Math.min(
                _data[0].ts + REGION_SEC * 500,
                _data[_data.length - 1].ts
            );
        }

        _canvas.style.touchAction = 'none';  // prevent passive scroll conflict
        _attachEvents();
        _loop();
        _reportRegion();
    }

    function destroy() {
        _detachEvents();
        if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null; }
        if (_canvas) _canvas.style.touchAction = '';
        _canvas  = null;
        _ctx     = null;
        _data    = [];
        _onRegion = null;
    }

    // ── Render loop ───────────────────────────────────────────────

    function _loop() {
        _rafId = requestAnimationFrame(_loop);
        if (!_dirty) return;
        _dirty = false;
        _draw();
    }

    function _draw() {
        if (!_canvas || _data.length < 2) return;

        const w = _canvas.clientWidth;
        const h = _canvas.clientHeight;
        if (_canvas.width !== w || _canvas.height !== h) {
            _canvas.width  = w;
            _canvas.height = h;
        }
        if (!_ctx) _ctx = _canvas.getContext('2d');

        const windowMs = WINDOW_SEC * 1000;
        const timeStart = _viewCenter - windowMs / 2;
        const timeEnd   = _viewCenter + windowMs / 2;

        _ctx.fillStyle = BG_CANVAS;
        _ctx.fillRect(0, 0, w, h);

        // ── Auto-scale Y based on visible data ───────────────────
        let maxAbsZ = 0.5;
        for (const pt of _data) {
            if (pt.ts >= timeStart && pt.ts <= timeEnd) {
                if (Math.abs(pt.z) > maxAbsZ) maxAbsZ = Math.abs(pt.z);
            }
        }
        const range  = maxAbsZ * 1.2;
        const midY   = h / 2;
        const yScale = h / (range * 2);

        _drawGrid(w, h, midY, range, yScale);
        _drawWave(w, midY, yScale, timeStart, windowMs);
        _drawRegion(w, h, timeStart, windowMs);
        _drawTimeAxis(w, h, timeStart, timeEnd, windowMs);

        _ctx.fillStyle = Z_COLOR;
        _ctx.font      = 'bold 11px sans-serif';
        _ctx.fillText('Z (리뷰)', 8, 14);
    }

    function _drawGrid(w, h, midY, range, yScale) {
        const step = range <= 1   ? 0.25
                   : range <= 3   ? 0.5
                   : range <= 10  ? 1
                   : range <= 30  ? 5 : 10;

        _ctx.strokeStyle = GRID_COLOR;
        _ctx.lineWidth   = 1;
        for (let v = -range; v <= range; v += step) {
            const vR = Math.round(v * 1000) / 1000;
            const y  = midY - vR * yScale;
            _ctx.beginPath();
            _ctx.moveTo(0, y);
            _ctx.lineTo(w, y);
            _ctx.stroke();
            if (vR !== 0) {
                _ctx.fillStyle = '#555';
                _ctx.font      = '10px sans-serif';
                _ctx.fillText(vR.toFixed(2), 4, y - 2);
            }
        }
        _ctx.strokeStyle = '#444';
        _ctx.lineWidth   = 1.5;
        _ctx.beginPath();
        _ctx.moveTo(0, midY);
        _ctx.lineTo(w, midY);
        _ctx.stroke();
    }

    function _drawWave(w, midY, yScale, timeStart, windowMs) {
        _ctx.beginPath();
        _ctx.strokeStyle = Z_COLOR;
        _ctx.lineWidth   = 2;
        _ctx.lineJoin    = 'round';

        let prevPx = null, prevPy = null;
        for (const pt of _data) {
            const px = ((pt.ts - timeStart) / windowMs) * w;
            if (px < -4 || px > w + 4) { prevPx = null; continue; }
            const py = midY - pt.z * yScale;
            if (prevPx === null) {
                _ctx.moveTo(px, py);
            } else {
                const mx  = (prevPx + px) / 2;
                const my  = (prevPy + py) / 2;
                _ctx.quadraticCurveTo(prevPx, prevPy, mx, my);
            }
            prevPx = px; prevPy = py;
        }
        if (prevPx !== null) _ctx.lineTo(prevPx, prevPy);
        _ctx.stroke();
    }

    function _drawRegion(w, h, timeStart, windowMs) {
        // Center window: fixed at canvas center
        const regionMs = REGION_SEC * 1000;
        const rX = (w / 2) - (regionMs / windowMs * w / 2);
        const rW = regionMs / windowMs * w;

        _ctx.fillStyle = REGION_FILL;
        _ctx.fillRect(rX, 0, rW, h);

        _ctx.strokeStyle = REGION_BORDER;
        _ctx.lineWidth   = 1.5;
        _ctx.beginPath();
        _ctx.moveTo(rX, 0); _ctx.lineTo(rX, h);
        _ctx.moveTo(rX + rW, 0); _ctx.lineTo(rX + rW, h);
        _ctx.stroke();
    }

    function _drawTimeAxis(w, h, timeStart, timeEnd, windowMs) {
        if (_data.length === 0) return;
        const originTs = _data[0].ts;
        const stepMs   = 2000;
        _ctx.fillStyle   = '#555';
        _ctx.font        = '9px sans-serif';
        _ctx.strokeStyle = '#2e2e2e';
        _ctx.lineWidth   = 1;

        const firstTick = Math.ceil(timeStart / stepMs) * stepMs;
        for (let t = firstTick; t <= timeEnd; t += stepMs) {
            const x   = ((t - timeStart) / windowMs) * w;
            const sec = ((t - originTs) / 1000).toFixed(0);
            _ctx.beginPath();
            _ctx.moveTo(x, h - 14);
            _ctx.lineTo(x, h);
            _ctx.stroke();
            _ctx.fillText(`${sec}s`, x + 2, h - 2);
        }
    }

    // ── Region reporting ──────────────────────────────────────────

    function _reportRegion() {
        if (!_onRegion || _data.length === 0) return;
        const regionMs  = REGION_SEC * 1000;
        const rStart    = _viewCenter - regionMs / 2;
        const rEnd      = _viewCenter + regionMs / 2;
        let maxAbsZ     = 0;
        for (const pt of _data) {
            if (pt.ts >= rStart && pt.ts <= rEnd) {
                if (Math.abs(pt.z) > maxAbsZ) maxAbsZ = Math.abs(pt.z);
            }
        }
        const mmi      = VisualModule.getMmiInfo(maxAbsZ);
        const originTs = _data[0].ts;
        const s1       = ((rStart - originTs) / 1000).toFixed(1);
        const s2       = ((rEnd   - originTs) / 1000).toFixed(1);
        const timeLabel = `구간: ${s1}s ~ ${s2}s`;
        _onRegion(maxAbsZ, mmi.level, mmi.name, timeLabel);
    }

    // ── Drag / Pan ────────────────────────────────────────────────

    function _clampViewCenter(vc) {
        if (_data.length < 2) return vc;
        const minVC = _data[0].ts;
        const maxVC = _data[_data.length - 1].ts;
        return Math.max(minVC, Math.min(maxVC, vc));
    }

    function _onDragStart(clientX) {
        _isDragging  = true;
        _dragStartX  = clientX;
        _dragStartVC = _viewCenter;
    }

    function _onDragMove(clientX) {
        if (!_isDragging || !_canvas) return;
        const w       = _canvas.clientWidth;
        const windowMs = WINDOW_SEC * 1000;
        // Dragging right = moving into the past (negative delta)
        const dxMs    = -(clientX - _dragStartX) / w * windowMs;
        _viewCenter   = _clampViewCenter(_dragStartVC + dxMs);
        _dirty        = true;
        _reportRegion();
    }

    function _onDragEnd() {
        _isDragging = false;
    }

    // ── Event listeners ───────────────────────────────────────────

    function _mouseDown(e)  { _onDragStart(e.clientX); }
    function _mouseMove(e)  { _onDragMove(e.clientX); }
    function _touchStart(e) { e.preventDefault(); _onDragStart(e.touches[0].clientX); }
    function _touchMove(e)  { e.preventDefault(); _onDragMove(e.touches[0].clientX); }

    function _attachEvents() {
        _canvas.addEventListener('mousedown',  _mouseDown);
        _canvas.addEventListener('mousemove',  _mouseMove);
        _canvas.addEventListener('mouseup',    _onDragEnd);
        _canvas.addEventListener('mouseleave', _onDragEnd);
        _canvas.addEventListener('touchstart', _touchStart, { passive: false });
        _canvas.addEventListener('touchmove',  _touchMove,  { passive: false });
        _canvas.addEventListener('touchend',   _onDragEnd);
    }

    function _detachEvents() {
        if (!_canvas) return;
        _canvas.removeEventListener('mousedown',  _mouseDown);
        _canvas.removeEventListener('mousemove',  _mouseMove);
        _canvas.removeEventListener('mouseup',    _onDragEnd);
        _canvas.removeEventListener('mouseleave', _onDragEnd);
        _canvas.removeEventListener('touchstart', _touchStart);
        _canvas.removeEventListener('touchmove',  _touchMove);
        _canvas.removeEventListener('touchend',   _onDragEnd);
    }

    return { init, destroy };
})();

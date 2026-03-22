/**
 * review2.js — Activity 2 review mode
 * Displays full waveform after measurement stops.
 * Two draggable markers (start/end) let user select a time range for CSV export.
 * Supports both Z-only and 3-axis data from VisualModule.startReview().
 */

const Review2Module = (() => {

    // ── Config ────────────────────────────────────────────────────
    const WINDOW_SEC    = 10;
    const MIN_RANGE     = 0.1;
    const MARKER_HIT_PX = 24;
    const MARKER_COLOR  = 'rgba(255, 200, 60, 0.9)';
    const RANGE_FILL    = 'rgba(255, 200, 60, 0.08)';
    const BG_CANVAS     = '#1c1c1c';
    const Z_COLOR       = '#00d2d3';
    const GRID_COLOR    = '#2e2e2e';

    // ── State ─────────────────────────────────────────────────────
    let _canvas    = null;
    let _ctx       = null;
    let _data      = [];
    let _has3axis  = false;

    let _viewStart = 0;        // leftmost visible timestamp (ms)
    let _markerA   = 0;        // start marker (ms)
    let _markerB   = 0;        // end marker (ms)

    let _onRange   = null;
    let _rafId     = null;

    // Drag state
    let _dragTarget     = null;   // null | 'markerA' | 'markerB' | 'pan'
    let _dragStartX     = 0;
    let _dragStartView  = 0;
    let _dragStartTs    = 0;

    // ── Helpers ───────────────────────────────────────────────────
    function _windowMs() { return WINDOW_SEC * 1000; }

    function _pxOf(ts) {
        const w = _canvas.clientWidth || _canvas.width;
        return (ts - _viewStart) / _windowMs() * w;
    }

    function _tsPerPx() {
        const w = _canvas.clientWidth || _canvas.width;
        return _windowMs() / w;
    }

    function _clampView(vs) {
        if (_data.length < 2) return _data[0]?.ts ?? 0;
        const dataLen = _data[_data.length - 1].ts - _data[0].ts;
        if (dataLen <= _windowMs()) return _data[0].ts;
        return Math.max(_data[0].ts, Math.min(_data[_data.length - 1].ts - _windowMs(), vs));
    }

    function _fmt(ts) {
        const d  = new Date(ts);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        const ms = String(d.getMilliseconds()).padStart(3, '0');
        return `${hh}:${mm}:${ss}.${ms}`;
    }

    // ── Hit test ──────────────────────────────────────────────────
    function _hitTest(localX) {
        const w    = _canvas.clientWidth || _canvas.width;
        const pxA  = _pxOf(_markerA);
        const pxB  = _pxOf(_markerB);
        const dA   = Math.abs(localX - pxA);
        const dB   = Math.abs(localX - pxB);
        const visA = pxA >= -4 && pxA <= w + 4;
        const visB = pxB >= -4 && pxB <= w + 4;
        if (visA && dA < MARKER_HIT_PX && dA <= dB) return 'markerA';
        if (visB && dB < MARKER_HIT_PX)              return 'markerB';
        return 'pan';
    }

    // ── Range report ──────────────────────────────────────────────
    function _reportRange() {
        if (!_onRange) return;
        let count = 0;
        for (const pt of _data) {
            if (pt.ts >= _markerA && pt.ts <= _markerB) count++;
        }
        _onRange(_markerA, _markerB, count);
    }

    // ── Draw ──────────────────────────────────────────────────────
    function _drawLine(pts, field, color, lw) {
        _ctx.beginPath();
        _ctx.strokeStyle = color;
        _ctx.lineWidth   = lw;
        _ctx.lineJoin    = 'round';
        const w         = _canvas.width;
        const h         = _canvas.height;
        const midY      = h / 2;
        const viewEnd   = _viewStart + _windowMs();
        let ppx = null, ppy = null;

        for (const pt of pts) {
            if (pt.ts < _viewStart || pt.ts > viewEnd) continue;
            const px = (pt.ts - _viewStart) / _windowMs() * w;
            const py = midY - pt[field] * _yScale;
            if (ppx === null) { _ctx.moveTo(px, py); }
            else {
                const mx = (ppx + px) / 2, my = (ppy + py) / 2;
                _ctx.quadraticCurveTo(ppx, ppy, mx, my);
            }
            ppx = px; ppy = py;
        }
        if (ppx !== null) _ctx.lineTo(ppx, ppy);
        _ctx.stroke();
    }

    let _yScale = 1;

    function _drawFrame() {
        if (!_canvas || !_ctx) return;

        const w = _canvas.clientWidth;
        const h = _canvas.clientHeight;
        if (_canvas.width !== w || _canvas.height !== h) {
            _canvas.width  = w;
            _canvas.height = h;
        }

        _ctx.fillStyle = BG_CANVAS;
        _ctx.fillRect(0, 0, w, h);

        if (_data.length < 2) return;

        const viewEnd = _viewStart + _windowMs();

        // ── Y-axis scale ─────────────────────────────────────────
        let maxAbs = MIN_RANGE;
        for (const pt of _data) {
            if (pt.ts < _viewStart || pt.ts > viewEnd) continue;
            if (_has3axis) {
                maxAbs = Math.max(maxAbs, Math.abs(pt.mag), Math.abs(pt.x), Math.abs(pt.y), Math.abs(pt.z));
            } else {
                maxAbs = Math.max(maxAbs, Math.abs(pt.z));
            }
        }
        // Fall back to full-data range if window has no visible data
        if (maxAbs <= MIN_RANGE) {
            for (const pt of _data) {
                maxAbs = Math.max(maxAbs, _has3axis ? Math.abs(pt.mag) : Math.abs(pt.z));
            }
        }
        const range  = maxAbs * 1.2;
        const midY   = h / 2;
        _yScale      = (h / 2) / range;

        // ── Grid ─────────────────────────────────────────────────
        const step = range <= 1   ? 0.25
                   : range <= 3   ? 0.5
                   : range <= 10  ? 1
                   : range <= 30  ? 5
                   : 10;
        _ctx.strokeStyle = GRID_COLOR;
        _ctx.lineWidth   = 1;
        for (let v = -range; v <= range; v += step) {
            const vR = Math.round(v * 1000) / 1000;
            const y  = midY - vR * _yScale;
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
        // Zero line
        _ctx.strokeStyle = '#444';
        _ctx.lineWidth   = 1.5;
        _ctx.beginPath();
        _ctx.moveTo(0, midY);
        _ctx.lineTo(w, midY);
        _ctx.stroke();

        // ── Waveform ─────────────────────────────────────────────
        if (_has3axis) {
            _drawLine(_data, 'x',   'rgba(255,80,80,0.45)',  1);
            _drawLine(_data, 'y',   'rgba(80,255,80,0.45)',  1);
            _drawLine(_data, 'z',   'rgba(80,160,255,0.45)', 1);
            _drawLine(_data, 'mag', '#f0f0f0',               2.5);
            _ctx.fillStyle = '#f0f0f0';
            _ctx.font      = 'bold 11px sans-serif';
            _ctx.fillText('3축', 8, 14);
        } else {
            _drawLine(_data, 'z', Z_COLOR, 2);
            _ctx.fillStyle = Z_COLOR;
            _ctx.font      = 'bold 11px sans-serif';
            _ctx.fillText('Z', 8, 14);
        }

        // ── Range fill ───────────────────────────────────────────
        const pxA = _pxOf(_markerA);
        const pxB = _pxOf(_markerB);
        const fillLeft  = Math.max(0, Math.min(pxA, pxB));
        const fillRight = Math.min(w, Math.max(pxA, pxB));
        if (fillRight > fillLeft) {
            _ctx.fillStyle = RANGE_FILL;
            _ctx.fillRect(fillLeft, 0, fillRight - fillLeft, h - 20);
        }

        // ── Markers ───────────────────────────────────────────────
        _drawMarker(pxA, '시작', _markerA, w, h, true);
        _drawMarker(pxB, '종료', _markerB, w, h, false);

        // ── Time axis ─────────────────────────────────────────────
        const stepMs   = 2000;
        const firstTick = Math.ceil(_viewStart / stepMs) * stepMs;
        const dataStart = _data[0].ts;
        _ctx.fillStyle   = '#555';
        _ctx.font        = '9px sans-serif';
        _ctx.strokeStyle = '#2e2e2e';
        _ctx.lineWidth   = 1;
        for (let t = firstTick; t <= viewEnd; t += stepMs) {
            const x          = (t - _viewStart) / _windowMs() * w;
            const elapsedSec = Math.round((t - dataStart) / 1000);
            if (elapsedSec < 0) continue;
            _ctx.beginPath();
            _ctx.moveTo(x, h - 14);
            _ctx.lineTo(x, h);
            _ctx.stroke();
            _ctx.fillText(`${elapsedSec}s`, x + 2, h - 2);
        }
    }

    function _drawMarker(px, label, ts, w, h, isStart) {
        // Only draw if on screen
        if (px < -60 || px > w + 60) return;

        _ctx.strokeStyle = MARKER_COLOR;
        _ctx.lineWidth   = 1.5;
        _ctx.setLineDash([4, 3]);
        _ctx.beginPath();
        _ctx.moveTo(px, 0);
        _ctx.lineTo(px, h - 20);
        _ctx.stroke();
        _ctx.setLineDash([]);

        // Label
        const timeStr = _fmt(ts);
        _ctx.font      = '9px sans-serif';
        _ctx.fillStyle = MARKER_COLOR;
        const labelX   = isStart ? Math.max(2, px + 3) : Math.min(w - 80, px - 3);
        const align    = isStart ? 'left' : 'right';
        _ctx.textAlign = align;
        _ctx.fillText(label, labelX + (isStart ? 0 : 0), h - 34);
        _ctx.font      = 'bold 11px sans-serif';
        _ctx.fillStyle = 'rgba(255,255,255,0.9)';
        _ctx.fillText(timeStr, labelX, h - 22);
        _ctx.textAlign = 'left';
    }

    // ── RAF loop ──────────────────────────────────────────────────
    function _loop() {
        _drawFrame();
        _rafId = requestAnimationFrame(_loop);
    }

    // ── Pointer events ────────────────────────────────────────────
    function _localX(e) {
        const rect = _canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        return clientX - rect.left;
    }

    function _onPointerDown(e) {
        e.preventDefault();
        const x     = _localX(e);
        _dragTarget = _hitTest(x);
        _dragStartX     = x;
        _dragStartView  = _viewStart;
        _dragStartTs    = _dragTarget === 'markerA' ? _markerA : _markerB;
    }

    function _onPointerMove(e) {
        if (!_dragTarget) return;
        e.preventDefault();
        const x   = _localX(e);
        const dx  = x - _dragStartX;
        const dtMs = dx * _tsPerPx();

        if (_dragTarget === 'pan') {
            _viewStart = _clampView(_dragStartView - dtMs);
        } else if (_dragTarget === 'markerA') {
            const last = _data[_data.length - 1].ts;
            _markerA = Math.max(_data[0].ts, Math.min(_dragStartTs + dtMs, _markerB - 100));
            _reportRange();
        } else if (_dragTarget === 'markerB') {
            _markerB = Math.max(_markerA + 100, Math.min(_dragStartTs + dtMs, _data[_data.length - 1].ts));
            _reportRange();
        }
    }

    function _onPointerUp(e) {
        _dragTarget = null;
    }

    function _attachEvents() {
        _canvas.style.touchAction = 'none';
        _canvas.addEventListener('pointerdown',  _onPointerDown, { passive: false });
        _canvas.addEventListener('pointermove',  _onPointerMove, { passive: false });
        _canvas.addEventListener('pointerup',    _onPointerUp);
        _canvas.addEventListener('pointercancel', _onPointerUp);
    }

    function _detachEvents() {
        _canvas.removeEventListener('pointerdown',   _onPointerDown);
        _canvas.removeEventListener('pointermove',   _onPointerMove);
        _canvas.removeEventListener('pointerup',     _onPointerUp);
        _canvas.removeEventListener('pointercancel', _onPointerUp);
        _canvas.style.touchAction = '';
    }

    // ── Public API ────────────────────────────────────────────────

    /**
     * Initialize review mode.
     * @param {HTMLCanvasElement} canvasEl
     * @param {Array} data  [{ts, z, x?, y?, mag?}] from VisualModule.startReview()
     * @param {Function} onRange  (startTs, endTs, count) callback
     */
    function init(canvasEl, data, onRange) {
        _canvas   = canvasEl;
        _ctx      = canvasEl.getContext('2d');
        _data     = data;
        _onRange  = onRange;
        _has3axis = data.length > 0 && (data[0].mag !== undefined) && (data[0].mag !== 0 || data[0].x !== 0);

        _markerA   = _data[0].ts;
        _markerB   = _data[_data.length - 1].ts;
        _viewStart = _clampView(_data[0].ts);

        _attachEvents();
        _rafId = requestAnimationFrame(_loop);
        _reportRange();
    }

    function destroy() {
        if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
        if (_canvas) { _detachEvents(); }
        _canvas  = null;
        _ctx     = null;
        _data    = [];
        _onRange = null;
    }

    return { init, destroy };

})();

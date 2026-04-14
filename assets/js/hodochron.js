/**
 * hodochron.js  v1.1
 * Role   : Travel-time curve (hodochron) Canvas renderer
 *          + manual line drawing with draggable handles
 *
 * Auto mode  : setData → setSplit(distM) → linear regression {V1,V2,h,xc}
 * Manual mode: setMode('manual') → addLine('direct'|'refracted')
 *              → drag handles → onManualUpdate callback fires
 *
 * Seismic refraction (Hagedoorn 1959 / Telford et al.):
 *   Direct wave slope    : 1/V₁  (ms/m)  → V₁ = 1000 / slope₁
 *   Refracted wave slope : 1/V₂  (ms/m)  → V₂ = 1000 / slope₂
 *   Intercept time ti    : y-intercept of refracted line (ms → s)
 *   Layer thickness h    : (ti × V₁ × V₂) / (2 × √(V₂² − V₁²))
 */

const HodochronModule = (() => {

    const PAD_L = 56, PAD_R = 20, PAD_T = 24, PAD_B = 44;
    const HANDLE_R = 8;    // visual radius (px)
    const HIT_R    = 14;   // hit test radius (px, larger for touch)

    let _canvas = null;
    let _ctx    = null;
    let _points = [];   // [{dist(m), t(ms), label, accM}]
    let _split  = null;

    // Manual mode state
    let _mode        = 'auto';   // 'auto' | 'manual'
    let _manualLines = [];
    // [{role:'direct'|'refracted', color, p1:{distM,tMs}, p2:{distM,tMs}, dragging:null|'p1'|'p2'}]
    let _onManualCb  = null;

    // Bound pointer handlers (stored for removeEventListener)
    let _boundPD = null, _boundPM = null, _boundPU = null;

    // ── Coordinate transforms ──────────────────────────────────────
    function _getTransforms() {
        const W  = _canvas.width,  H  = _canvas.height;
        const PW = W - PAD_L - PAD_R, PH = H - PAD_T - PAD_B;
        const maxDist = Math.max(..._points.map(p => p.dist)) * 1.15 || 100;
        const maxT    = Math.max(..._points.map(p => p.t), 10) * 1.2;
        const minT    = Math.min(..._points.map(p => p.t), 0);
        const tRange  = maxT - minT;
        return {
            toCX:   d  => PAD_L + (d / maxDist) * PW,
            toCY:   t  => PAD_T + PH - ((t - minT) / tRange) * PH,
            toDist: cx => Math.max(0, (cx - PAD_L) / PW * maxDist),
            toT:    cy => minT + (1 - (cy - PAD_T) / PH) * tRange,
            PW, PH, maxDist, maxT, minT, tRange
        };
    }

    // ── Linear regression ──────────────────────────────────────────
    function _linReg(pts) {
        const n = pts.length;
        if (n < 2) return null;
        let sx = 0, sy = 0, sxx = 0, sxy = 0;
        for (const p of pts) { sx += p.x; sy += p.y; sxx += p.x*p.x; sxy += p.x*p.y; }
        const denom = n * sxx - sx * sx;
        if (Math.abs(denom) < 1e-12) return null;
        const slope     = (n * sxy - sx * sy) / denom;
        const intercept = (sy - slope * sx) / n;
        const meanY = sy / n;
        let ssTot = 0, ssRes = 0;
        for (const p of pts) {
            ssTot += (p.y - meanY) ** 2;
            ssRes += (p.y - (slope * p.x + intercept)) ** 2;
        }
        const r2 = ssTot > 1e-12 ? 1 - ssRes / ssTot : 1;
        return { slope, intercept, r2 };
    }

    // ── Auto compute (regression) ──────────────────────────────────
    function _compute() {
        if (_split === null || _points.length < 4) return null;
        const g1 = _points.filter(p => p.dist <= _split).map(p => ({ x: p.dist, y: p.t }));
        const g2 = _points.filter(p => p.dist >  _split).map(p => ({ x: p.dist, y: p.t }));
        if (g1.length < 2 || g2.length < 2) return null;

        const r1 = _linReg(g1), r2 = _linReg(g2);
        if (!r1 || !r2 || r1.slope <= 0 || r2.slope <= 0) return null;
        if (r1.slope <= r2.slope) return null;

        const V1 = 1000 / r1.slope, V2 = 1000 / r2.slope;
        if (V2 <= V1) return null;

        const ti = r2.intercept / 1000;
        if (ti <= 0) return null;

        const dv = V2 * V2 - V1 * V1;
        if (dv <= 0) return null;
        const h  = (ti * V1 * V2) / (2 * Math.sqrt(dv));
        const xc = (r2.intercept - r1.intercept) / (r1.slope - r2.slope);

        return {
            V1: Math.round(V1), V2: Math.round(V2),
            ti: ti.toFixed(4),  h: (Math.round(h * 10) / 10),
            xc: Math.round(xc),
            r2_1: r1.r2.toFixed(3), r2_2: r2.r2.toFixed(3),
            _r1: r1, _r2: r2
        };
    }

    // ── Manual compute (from dragged line handles) ─────────────────
    function _computeManual() {
        const d = _manualLines.find(l => l.role === 'direct');
        const r = _manualLines.find(l => l.role === 'refracted');
        const out = {};

        if (d) {
            const dx = d.p2.distM - d.p1.distM;
            const dt = d.p2.tMs   - d.p1.tMs;
            if (Math.abs(dx) > 0.01 && dt > 0) out.V1 = Math.round(dx * 1000 / dt);
        }
        if (r) {
            const dx = r.p2.distM - r.p1.distM;
            const dt = r.p2.tMs   - r.p1.tMs;
            if (Math.abs(dx) > 0.01 && dt > 0) out.V2 = Math.round(dx * 1000 / dt);
        }

        if (out.V1 && out.V2 && out.V2 > out.V1 && r) {
            const slope_r  = (r.p2.tMs - r.p1.tMs) / (r.p2.distM - r.p1.distM);
            const tiMs     = r.p1.tMs - slope_r * r.p1.distM;
            const ti       = tiMs / 1000;
            if (ti > 0) {
                const V1 = out.V1, V2 = out.V2;
                const dv = V2 * V2 - V1 * V1;
                if (dv > 0) {
                    out.h = Math.round((ti * V1 * V2) / (2 * Math.sqrt(dv)) * 10) / 10;
                    if (d) {
                        const slope_d  = (d.p2.tMs - d.p1.tMs) / (d.p2.distM - d.p1.distM);
                        const tiMs_d   = d.p1.tMs - slope_d * d.p1.distM;
                        const dSlope   = slope_d - slope_r;
                        if (Math.abs(dSlope) > 1e-9)
                            out.xc = Math.round((tiMs - tiMs_d) / dSlope);
                    }
                }
            }
        }
        return Object.keys(out).length ? out : null;
    }

    // ── Pointer events for manual handles ─────────────────────────
    function _onPD(e) {
        if (_mode !== 'manual' || !_manualLines.length || !_canvas) return;
        const rect = _canvas.getBoundingClientRect();
        const scaleX = _canvas.width  / rect.width;
        const scaleY = _canvas.height / rect.height;
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top)  * scaleY;
        const tr = _getTransforms();
        for (const line of _manualLines) {
            for (const key of ['p1', 'p2']) {
                const hx = tr.toCX(line[key].distM);
                const hy = tr.toCY(line[key].tMs);
                if (Math.hypot(cx - hx, cy - hy) < HIT_R) {
                    line.dragging = key;
                    _canvas.setPointerCapture(e.pointerId);
                    return;
                }
            }
        }
    }

    function _onPM(e) {
        if (_mode !== 'manual') return;
        const active = _manualLines.find(l => l.dragging !== null);
        if (!active) return;
        const rect   = _canvas.getBoundingClientRect();
        const scaleX = _canvas.width  / rect.width;
        const scaleY = _canvas.height / rect.height;
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top)  * scaleY;
        const tr = _getTransforms();
        active[active.dragging] = {
            distM: Math.max(0, Math.min(tr.maxDist, tr.toDist(cx))),
            tMs:   tr.toT(cy)
        };
        const result = _computeManual();
        _redraw(null, result);
        if (_onManualCb) _onManualCb(result);
    }

    function _onPU() {
        for (const l of _manualLines) l.dragging = null;
    }

    // ── Render ─────────────────────────────────────────────────────
    function _redraw(autoResult, manualResult) {
        if (!_canvas || !_ctx || _points.length === 0) return;
        const W  = _canvas.width,  H  = _canvas.height;
        const PW = W - PAD_L - PAD_R, PH = H - PAD_T - PAD_B;
        if (PW < 10 || PH < 10) return;

        const tr = _getTransforms();

        // Background
        _ctx.fillStyle = '#0a0a0a';
        _ctx.fillRect(0, 0, W, H);

        // Grid
        _ctx.strokeStyle = '#1a1a1a'; _ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const xg = PAD_L + PW * i / 5;
            _ctx.beginPath(); _ctx.moveTo(xg, PAD_T); _ctx.lineTo(xg, PAD_T + PH); _ctx.stroke();
            const yg = PAD_T + PH * i / 5;
            _ctx.beginPath(); _ctx.moveTo(PAD_L, yg); _ctx.lineTo(PAD_L + PW, yg); _ctx.stroke();
        }

        // Axes
        _ctx.strokeStyle = '#444'; _ctx.lineWidth = 1.5;
        _ctx.beginPath();
        _ctx.moveTo(PAD_L, PAD_T);
        _ctx.lineTo(PAD_L, PAD_T + PH);
        _ctx.lineTo(PAD_L + PW, PAD_T + PH);
        _ctx.stroke();

        // t=0 reference
        if (tr.minT < 0) {
            const y0 = tr.toCY(0);
            _ctx.strokeStyle = '#333'; _ctx.lineWidth = 1; _ctx.setLineDash([4, 4]);
            _ctx.beginPath(); _ctx.moveTo(PAD_L, y0); _ctx.lineTo(PAD_L + PW, y0); _ctx.stroke();
            _ctx.setLineDash([]);
        }

        // Auto regression lines
        if (_mode === 'auto' && autoResult) {
            const { _r1, _r2, xc } = autoResult;
            _ctx.strokeStyle = '#4a9eff'; _ctx.lineWidth = 2; _ctx.setLineDash([]);
            _ctx.beginPath();
            _ctx.moveTo(tr.toCX(0),          tr.toCY(_r1.intercept));
            _ctx.lineTo(tr.toCX(tr.maxDist), tr.toCY(_r1.slope * tr.maxDist + _r1.intercept));
            _ctx.stroke();
            _ctx.strokeStyle = '#ff9f43'; _ctx.lineWidth = 2;
            _ctx.beginPath();
            _ctx.moveTo(tr.toCX(0),          tr.toCY(_r2.intercept));
            _ctx.lineTo(tr.toCX(tr.maxDist), tr.toCY(_r2.slope * tr.maxDist + _r2.intercept));
            _ctx.stroke();
            if (xc > 0 && xc < tr.maxDist) {
                _ctx.strokeStyle = '#ff4757'; _ctx.lineWidth = 1.5; _ctx.setLineDash([5, 4]);
                _ctx.beginPath(); _ctx.moveTo(tr.toCX(xc), PAD_T); _ctx.lineTo(tr.toCX(xc), PAD_T + PH); _ctx.stroke();
                _ctx.setLineDash([]);
                _ctx.fillStyle = '#ff4757'; _ctx.font = '10px sans-serif'; _ctx.textAlign = 'center';
                _ctx.fillText(`xc=${xc}m`, tr.toCX(xc), PAD_T + 12);
            }
        }
        _ctx.setLineDash([]);

        // Auto split divider
        if (_mode === 'auto' && _split !== null) {
            _ctx.strokeStyle = '#555'; _ctx.lineWidth = 1; _ctx.setLineDash([3, 3]);
            _ctx.beginPath(); _ctx.moveTo(tr.toCX(_split), PAD_T); _ctx.lineTo(tr.toCX(_split), PAD_T + PH); _ctx.stroke();
            _ctx.setLineDash([]);
        }

        // Data points + GPS error bars
        for (const p of _points) {
            const inG1 = _mode === 'manual' || _split === null || p.dist <= _split;
            const cpx  = tr.toCX(p.dist), cpy = tr.toCY(p.t);
            if (p.accM > 0) {
                _ctx.strokeStyle = '#333'; _ctx.lineWidth = 1;
                _ctx.beginPath();
                _ctx.moveTo(tr.toCX(Math.max(0, p.dist - p.accM)), cpy);
                _ctx.lineTo(tr.toCX(p.dist + p.accM), cpy);
                _ctx.stroke();
            }
            _ctx.fillStyle = inG1 ? '#4a9eff' : '#ff9f43';
            _ctx.beginPath(); _ctx.arc(cpx, cpy, 5, 0, Math.PI * 2); _ctx.fill();
            if (p.label) {
                _ctx.fillStyle = '#888'; _ctx.font = '9px sans-serif'; _ctx.textAlign = 'center';
                _ctx.fillText(p.label, cpx, cpy - 9);
            }
        }

        // Manual lines + handles
        if (_mode === 'manual') {
            const mc = manualResult || _computeManual();
            for (const line of _manualLines) {
                const x1 = tr.toCX(line.p1.distM), y1 = tr.toCY(line.p1.tMs);
                const x2 = tr.toCX(line.p2.distM), y2 = tr.toCY(line.p2.tMs);
                // Extend line to full plot width
                const dx = line.p2.distM - line.p1.distM;
                const dt = line.p2.tMs   - line.p1.tMs;
                if (Math.abs(dx) > 0.001) {
                    const slope = dt / dx;
                    const yAt0    = tr.toCY(line.p1.tMs - slope * line.p1.distM);
                    const yAtMax  = tr.toCY(line.p1.tMs + slope * (tr.maxDist - line.p1.distM));
                    _ctx.strokeStyle = line.color + '55'; _ctx.lineWidth = 1.5; _ctx.setLineDash([4, 4]);
                    _ctx.beginPath();
                    _ctx.moveTo(PAD_L, yAt0);
                    _ctx.lineTo(PAD_L + PW, yAtMax);
                    _ctx.stroke();
                    _ctx.setLineDash([]);
                }
                // Solid segment between handles
                _ctx.strokeStyle = line.color; _ctx.lineWidth = 2.5;
                _ctx.beginPath(); _ctx.moveTo(x1, y1); _ctx.lineTo(x2, y2); _ctx.stroke();

                // Handles
                for (const [hx, hy] of [[x1, y1], [x2, y2]]) {
                    _ctx.fillStyle = line.color;
                    _ctx.beginPath(); _ctx.arc(hx, hy, HANDLE_R, 0, Math.PI * 2); _ctx.fill();
                    _ctx.strokeStyle = '#fff'; _ctx.lineWidth = 1.5;
                    _ctx.beginPath(); _ctx.arc(hx, hy, HANDLE_R, 0, Math.PI * 2); _ctx.stroke();
                }
            }
            // xc vertical line from manual result
            if (mc && mc.xc && mc.xc > 0 && mc.xc < tr.maxDist) {
                _ctx.strokeStyle = '#ff4757'; _ctx.lineWidth = 1.5; _ctx.setLineDash([5, 4]);
                _ctx.beginPath(); _ctx.moveTo(tr.toCX(mc.xc), PAD_T); _ctx.lineTo(tr.toCX(mc.xc), PAD_T + PH); _ctx.stroke();
                _ctx.setLineDash([]);
                _ctx.fillStyle = '#ff4757'; _ctx.font = '10px sans-serif'; _ctx.textAlign = 'center';
                _ctx.fillText(`xc=${mc.xc}m`, tr.toCX(mc.xc), PAD_T + 12);
            }
        }

        // Axis labels
        _ctx.fillStyle = '#666'; _ctx.font = '10px sans-serif'; _ctx.textAlign = 'center';
        _ctx.fillText('거리 (m)', PAD_L + PW / 2, H - 6);
        _ctx.save();
        _ctx.translate(13, PAD_T + PH / 2);
        _ctx.rotate(-Math.PI / 2);
        _ctx.fillText('도달 시간 (ms)', 0, 0);
        _ctx.restore();

        // Tick labels
        _ctx.fillStyle = '#555'; _ctx.font = '9px sans-serif';
        for (let i = 0; i <= 5; i++) {
            _ctx.textAlign = 'center';
            _ctx.fillText(Math.round(tr.maxDist * i / 5), tr.toCX(tr.maxDist * i / 5), PAD_T + PH + 15);
            _ctx.textAlign = 'right';
            _ctx.fillText(Math.round(tr.minT + tr.tRange * i / 5), PAD_L - 4, tr.toCY(tr.minT + tr.tRange * i / 5) + 3);
        }

        // Legend
        _ctx.font = '9px sans-serif'; _ctx.textAlign = 'left';
        if (_mode === 'auto' && autoResult) {
            _ctx.fillStyle = '#4a9eff';
            _ctx.fillText(`직접파 V₁=${autoResult.V1} m/s`, PAD_L + 4, PAD_T + 13);
            _ctx.fillStyle = '#ff9f43';
            _ctx.fillText(`굴절파 V₂=${autoResult.V2} m/s`, PAD_L + 4, PAD_T + 25);
        }
        const mc2 = _mode === 'manual' ? (manualResult || _computeManual()) : null;
        if (mc2) {
            _ctx.fillStyle = '#4a9eff';
            if (mc2.V1) _ctx.fillText(`직접파 V₁=${mc2.V1} m/s`, PAD_L + 4, PAD_T + 13);
            _ctx.fillStyle = '#ff9f43';
            if (mc2.V2) _ctx.fillText(`굴절파 V₂=${mc2.V2} m/s`, PAD_L + 4, PAD_T + 25);
        }
    }

    // ── Public API ─────────────────────────────────────────────────
    function init(canvasEl) {
        // Detach old listeners
        if (_canvas && _boundPD) {
            _canvas.removeEventListener('pointerdown', _boundPD);
            _canvas.removeEventListener('pointermove', _boundPM);
            _canvas.removeEventListener('pointerup',   _boundPU);
            _canvas.removeEventListener('pointercancel', _boundPU);
        }
        _canvas = canvasEl;
        _ctx    = canvasEl.getContext('2d');
        _canvas.width  = _canvas.clientWidth  || 340;
        _canvas.height = _canvas.clientHeight || 240;
        _ctx.fillStyle = '#0a0a0a';
        _ctx.fillRect(0, 0, _canvas.width, _canvas.height);

        _boundPD = _onPD.bind(null);
        _boundPM = _onPM.bind(null);
        _boundPU = _onPU.bind(null);
        _canvas.addEventListener('pointerdown',   _boundPD);
        _canvas.addEventListener('pointermove',   _boundPM);
        _canvas.addEventListener('pointerup',     _boundPU);
        _canvas.addEventListener('pointercancel', _boundPU);
    }

    function setData(points) {
        _points      = points;
        _split       = null;
        _manualLines = [];
        _redraw(null, null);
    }

    function setSplit(distM) {
        _split = distM;
        const result = _compute();
        _redraw(result, null);
        return result;
    }

    function setMode(mode) {
        _mode        = mode;
        _manualLines = [];
        if (mode === 'auto') {
            const result = _split !== null ? _compute() : null;
            _redraw(result, null);
        } else {
            _redraw(null, null);
        }
    }

    function addLine(role) {
        if (_manualLines.some(l => l.role === role)) return;
        if (_points.length === 0) return;
        const tr      = _getTransforms();
        const color   = role === 'direct' ? '#4a9eff' : '#ff9f43';
        const frac1   = 0.15, frac2 = 0.75;
        _manualLines.push({
            role, color,
            p1: { distM: tr.maxDist * frac1, tMs: tr.maxT * frac1 * 0.7 },
            p2: { distM: tr.maxDist * frac2, tMs: tr.maxT * frac2 * 0.7 },
            dragging: null
        });
        const mc = _computeManual();
        _redraw(null, mc);
        if (_onManualCb) _onManualCb(mc);
    }

    function clearLines() {
        _manualLines = [];
        _redraw(null, null);
        if (_onManualCb) _onManualCb(null);
    }

    function onManualUpdate(cb) {
        _onManualCb = cb;
    }

    function redraw() {
        if (_mode === 'auto') {
            const result = _split !== null ? _compute() : null;
            _redraw(result, null);
        } else {
            const mc = _computeManual();
            _redraw(null, mc);
        }
    }

    return { init, setData, setSplit, redraw, setMode, addLine, clearLines, onManualUpdate };
})();

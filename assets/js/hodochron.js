/**
 * hodochron.js  v1.0
 * Role   : Travel-time curve (hodochron) Canvas renderer
 * Input  : setData([{dist, t, label, accM}])
 *          setSplit(distM) → linear regression, returns {V1,V2,ti,h,xc,...} or null
 * Output : Canvas 2D scatter plot with regression lines
 *
 * Seismic refraction method (Hagedoorn 1959 / Telford et al.):
 *   Direct wave slope    : 1/V₁  (ms/m)  → V₁ = 1000 / slope₁
 *   Refracted wave slope : 1/V₂  (ms/m)  → V₂ = 1000 / slope₂
 *   Intercept time ti    : y-intercept of refracted line (ms → s)
 *   Layer thickness h    : (ti × V₁ × V₂) / (2 × √(V₂² − V₁²))
 */

const HodochronModule = (() => {

    const PAD_L = 56, PAD_R = 20, PAD_T = 24, PAD_B = 44;

    let _canvas = null;
    let _ctx    = null;
    let _points = [];   // [{dist(m), t(ms), label, accM}]
    let _split  = null; // split distance (m) or null

    // ── Linear regression (least squares) ─────────────────────────
    // pts: [{x, y}]  →  {slope, intercept, r2}
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

    // ── Compute geophysical results from current split ─────────────
    function _compute() {
        if (_split === null || _points.length < 4) return null;
        const g1 = _points.filter(p => p.dist <= _split).map(p => ({ x: p.dist, y: p.t }));
        const g2 = _points.filter(p => p.dist >  _split).map(p => ({ x: p.dist, y: p.t }));
        if (g1.length < 2 || g2.length < 2) return null;

        const r1 = _linReg(g1);
        const r2 = _linReg(g2);
        if (!r1 || !r2 || r1.slope <= 0 || r2.slope <= 0) return null;
        if (r1.slope <= r2.slope) return null;   // V1 < V2 required

        const V1 = 1000 / r1.slope;   // m/s
        const V2 = 1000 / r2.slope;   // m/s
        if (V2 <= V1) return null;

        const ti = r2.intercept / 1000;   // ms → s
        if (ti <= 0) return null;

        const dv = V2 * V2 - V1 * V1;
        if (dv <= 0) return null;
        const h  = (ti * V1 * V2) / (2 * Math.sqrt(dv));
        const xc = (r2.intercept - r1.intercept) / (r1.slope - r2.slope);

        return {
            V1: Math.round(V1), V2: Math.round(V2),
            ti: ti.toFixed(4), h: (Math.round(h * 10) / 10),
            xc: Math.round(xc),
            r2_1: r1.r2.toFixed(3), r2_2: r2.r2.toFixed(3),
            _r1: r1, _r2: r2
        };
    }

    // ── Render ─────────────────────────────────────────────────────
    function _redraw(result) {
        if (!_canvas || !_ctx || _points.length === 0) return;
        const W  = _canvas.width;
        const H  = _canvas.height;
        const PW = W - PAD_L - PAD_R;
        const PH = H - PAD_T - PAD_B;
        if (PW < 10 || PH < 10) return;

        const maxDist = Math.max(..._points.map(p => p.dist)) * 1.15 || 100;
        const maxT    = Math.max(..._points.map(p => p.t), 10) * 1.2;
        const minT    = Math.min(..._points.map(p => p.t), 0);
        const tRange  = maxT - minT;

        function px(d) { return PAD_L + (d / maxDist) * PW; }
        function py(t) { return PAD_T + PH - ((t - minT) / tRange) * PH; }

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

        // t=0 horizontal reference
        if (minT < 0) {
            const y0 = py(0);
            _ctx.strokeStyle = '#333'; _ctx.lineWidth = 1; _ctx.setLineDash([4, 4]);
            _ctx.beginPath(); _ctx.moveTo(PAD_L, y0); _ctx.lineTo(PAD_L + PW, y0); _ctx.stroke();
            _ctx.setLineDash([]);
        }

        // Regression lines
        if (result) {
            const { _r1, _r2, xc } = result;
            // Direct wave (blue)
            _ctx.strokeStyle = '#4a9eff'; _ctx.lineWidth = 2; _ctx.setLineDash([]);
            _ctx.beginPath();
            _ctx.moveTo(px(0), py(_r1.intercept));
            _ctx.lineTo(px(maxDist), py(_r1.slope * maxDist + _r1.intercept));
            _ctx.stroke();
            // Refracted wave (orange)
            _ctx.strokeStyle = '#ff9f43'; _ctx.lineWidth = 2;
            _ctx.beginPath();
            _ctx.moveTo(px(0), py(_r2.intercept));
            _ctx.lineTo(px(maxDist), py(_r2.slope * maxDist + _r2.intercept));
            _ctx.stroke();
            // Crossover (red dashed vertical)
            if (xc > 0 && xc < maxDist) {
                _ctx.strokeStyle = '#ff4757'; _ctx.lineWidth = 1.5; _ctx.setLineDash([5, 4]);
                _ctx.beginPath(); _ctx.moveTo(px(xc), PAD_T); _ctx.lineTo(px(xc), PAD_T + PH); _ctx.stroke();
                _ctx.setLineDash([]);
                _ctx.fillStyle = '#ff4757'; _ctx.font = '10px sans-serif'; _ctx.textAlign = 'center';
                _ctx.fillText(`xc=${xc}m`, px(xc), PAD_T + 12);
            }
        }
        _ctx.setLineDash([]);

        // Split divider
        if (_split !== null) {
            _ctx.strokeStyle = '#555'; _ctx.lineWidth = 1; _ctx.setLineDash([3, 3]);
            _ctx.beginPath(); _ctx.moveTo(px(_split), PAD_T); _ctx.lineTo(px(_split), PAD_T + PH); _ctx.stroke();
            _ctx.setLineDash([]);
        }

        // Data points + GPS horizontal error bars
        for (const p of _points) {
            const inG1 = _split === null || p.dist <= _split;
            const cx = px(p.dist), cy = py(p.t);
            if (p.accM > 0) {
                _ctx.strokeStyle = '#333'; _ctx.lineWidth = 1;
                _ctx.beginPath();
                _ctx.moveTo(px(Math.max(0, p.dist - p.accM)), cy);
                _ctx.lineTo(px(p.dist + p.accM), cy);
                _ctx.stroke();
            }
            _ctx.fillStyle = inG1 ? '#4a9eff' : '#ff9f43';
            _ctx.beginPath(); _ctx.arc(cx, cy, 5, 0, Math.PI * 2); _ctx.fill();
            if (p.label) {
                _ctx.fillStyle = '#888'; _ctx.font = '9px sans-serif'; _ctx.textAlign = 'center';
                _ctx.fillText(p.label, cx, cy - 9);
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
            _ctx.fillText(Math.round(maxDist * i / 5), px(maxDist * i / 5), PAD_T + PH + 15);
            _ctx.textAlign = 'right';
            _ctx.fillText(Math.round(minT + tRange * i / 5), PAD_L - 4, py(minT + tRange * i / 5) + 3);
        }

        // Legend
        if (result) {
            _ctx.font = '9px sans-serif'; _ctx.textAlign = 'left';
            _ctx.fillStyle = '#4a9eff';
            _ctx.fillText(`직접파 V₁=${result.V1} m/s`, PAD_L + 4, PAD_T + 13);
            _ctx.fillStyle = '#ff9f43';
            _ctx.fillText(`굴절파 V₂=${result.V2} m/s`, PAD_L + 4, PAD_T + 25);
        }
    }

    // ── Public API ─────────────────────────────────────────────────
    function init(canvasEl) {
        _canvas = canvasEl;
        _ctx    = canvasEl.getContext('2d');
        _canvas.width  = _canvas.clientWidth  || 340;
        _canvas.height = _canvas.clientHeight || 240;
        _ctx.fillStyle = '#0a0a0a';
        _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
    }

    function setData(points) {
        _points = points;
        _split  = null;
        _redraw(null);
    }

    function setSplit(distM) {
        _split = distM;
        const result = _compute();
        _redraw(result);
        return result;
    }

    function redraw() {
        const result = _split !== null ? _compute() : null;
        _redraw(result);
    }

    return { init, setData, setSplit, redraw };
})();

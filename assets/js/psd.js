/**
 * psd.js  v3.6
 * Role   : Power Spectral Density (Welch's method)
 * Input  : acc_z samples via push() or pre-loaded rows via computeFromRows()
 * Output : Canvas 2D line graph
 *          X axis = frequency (log scale, F_MIN – Nyquist Hz)
 *          Y axis = power density (dB re (m/s²)²/Hz)
 *
 * Rendering layers:
 *   1. [densityMode=true]  Density heatmap: blue→cyan→yellow→red (ObsPy PPSD style)
 *                           + Welch mean curve (white, 1px)
 *   2b. [densityMode=false] Latest window only: single teal line (realtime view)
 *
 * Correct Welch PSD formula (one-sided, Hann window energy compensated):
 *   PSD[b] = 2 × |FFT_b|² / (sr × sum_w2)
 *   where sum_w2 = Σ hann[i]²  (≈ 3N/8 for Hann)
 *   dB = 10 × log₁₀(PSD[b])
 *
 * v3.2 changes vs v3.1:
 *   - Layer 2 replaced: individual semi-transparent lines →
 *     pixel-level density heatmap (log-normalized, blue→red colormap)
 * v3.3 changes vs v3.2:
 *   - Heatmap fill direction: bin→pixel → pixel→bin with linear interpolation
 *     Fixes gaps at low frequencies where log pixel spacing > bin spacing
 * v3.5 changes vs v3.4:
 *   - Added _densityMode toggle (setDensityMode): default=false shows realtime
 *     single-window line; true restores density heatmap + mean line
 * v3.6 changes vs v3.5:
 *   - Removed Peterson NLNM/NHNM reference lines (high noise floor makes them unusable)
 */

const PsdModule = (() => {

    // ── Config ────────────────────────────────────────────────────
    const FFT_SIZE = 1024;
    const HOP_SIZE = 26;
    const FILE_HOP = FFT_SIZE / 2;  // 512 — 50% overlap for file mode
    const DB_MIN   = -120;
    const DB_MAX   = -20;
    const F_MIN    = 0.2;  // Hz: left edge of plot (matches HVSR)

    // Padding (px)
    const PAD_L = 40, PAD_R = 10, PAD_T = 10, PAD_B = 20;

    // ── Hann window + energy normalization constant ────────────────
    const _hann = new Float32Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++)
        _hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));

    // sum of squared Hann weights (≈ 3N/8 for large N)
    let _sumW2 = 0;
    for (let i = 0; i < FFT_SIZE; i++) _sumW2 += _hann[i] * _hann[i];

    // ── State ─────────────────────────────────────────────────────
    let _canvas       = null;
    let _ctx          = null;
    let _sr           = 100;
    let _buf          = new Float32Array(FFT_SIZE);
    let _head         = 0;
    let _hopCount     = 0;
    let _sumPow       = null;  // Float32Array(FFT_SIZE/2) — cumulative power sum
    let _nWin         = 0;     // number of accumulated windows
    let _dispDbMax    = DB_MAX; // sticky auto-scale ceiling (only moves up)
    let _windows      = [];    // Float32Array(FFT_SIZE/2)[] — per-window PSDs
    let _densityMode  = false; // false=realtime latest-window line, true=density heatmap

    // ── FFT ───────────────────────────────────────────────────────
    function _fft(re, im) {
        const N = re.length;
        for (let i = 1, j = 0; i < N; i++) {
            let bit = N >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                [re[i], re[j]] = [re[j], re[i]];
                [im[i], im[j]] = [im[j], im[i]];
            }
        }
        for (let len = 2; len <= N; len <<= 1) {
            const theta = -2 * Math.PI / len;
            const wRe = Math.cos(theta), wIm = Math.sin(theta);
            const half = len >> 1;
            for (let i = 0; i < N; i += len) {
                let uRe = 1, uIm = 0;
                for (let k = 0; k < half; k++) {
                    const aRe = re[i+k], aIm = im[i+k];
                    const tRe = uRe*re[i+k+half] - uIm*im[i+k+half];
                    const tIm = uRe*im[i+k+half] + uIm*re[i+k+half];
                    re[i+k]      = aRe+tRe;  im[i+k]      = aIm+tIm;
                    re[i+k+half] = aRe-tRe;  im[i+k+half] = aIm-tIm;
                    const nRe = uRe*wRe - uIm*wIm;
                    uIm = uRe*wIm + uIm*wRe;  uRe = nRe;
                }
            }
        }
    }

    // ── Compute one power spectrum from ring buffer ────────────────
    function _computePower() {
        // 1) Extract raw samples from ring buffer
        const raw = new Float32Array(FFT_SIZE);
        for (let i = 0; i < FFT_SIZE; i++)
            raw[i] = _buf[(_head + i) & (FFT_SIZE - 1)];
        // 2) DC offset removal (subtract window mean)
        let mean = 0;
        for (let i = 0; i < FFT_SIZE; i++) mean += raw[i];
        mean /= FFT_SIZE;
        // 3) Apply Hann window
        const re = new Float32Array(FFT_SIZE);
        const im = new Float32Array(FFT_SIZE);
        for (let i = 0; i < FFT_SIZE; i++)
            re[i] = (raw[i] - mean) * _hann[i];
        _fft(re, im);
        // 4) One-sided PSD with Hann window energy compensation
        const pow = new Float32Array(FFT_SIZE / 2);
        for (let b = 0; b < FFT_SIZE / 2; b++)
            pow[b] = 2 * (re[b]**2 + im[b]**2) / (_sr * _sumW2);
        return pow;
    }

    // ── Compute averaged PSD from accumulated sum ─────────────────
    function _averagedPsd() {
        if (!_sumPow || _nWin === 0) return null;
        const avg = new Float32Array(FFT_SIZE / 2);
        for (let b = 0; b < FFT_SIZE / 2; b++) avg[b] = _sumPow[b] / _nWin;
        return avg;
    }

    // ── Render PSD ────────────────────────────────────────────────
    function _redraw() {
        if (!_canvas || !_ctx) return;
        const W  = _canvas.width;
        const H  = _canvas.height;
        const PW = W - PAD_L - PAD_R;
        const PH = H - PAD_T - PAD_B;
        if (PW < 2 || PH < 2) return;

        const nyq      = _sr / 2;
        const fMax     = Math.min(50, nyq);
        const logRange = Math.log10(fMax / F_MIN);

        function fx(f)  { return PAD_L + Math.round(Math.log10(f / F_MIN) / logRange * PW); }

        // Auto-scale: compute display range from current averaged data
        const avg0 = _averagedPsd();
        if (avg0) {
            let dataMax = DB_MIN;
            for (let b = 1; b < FFT_SIZE / 2; b++) {
                const f = b * _sr / FFT_SIZE;
                if (f < F_MIN || f > fMax) continue;
                const db = avg0[b] > 0 ? 10 * Math.log10(avg0[b]) : DB_MIN;
                if (db > dataMax) dataMax = db;
            }
            if (dataMax > _dispDbMax - 10)
                _dispDbMax = Math.ceil((dataMax + 15) / 20) * 20;
        }
        const dispMax = _dispDbMax;
        const dispMin = dispMax - 100;

        function dby(db) { return PAD_T + PH - Math.round((db - dispMin) / (dispMax - dispMin) * PH); }

        // Background
        _ctx.fillStyle = '#0a0a0a';
        _ctx.fillRect(0, 0, W, H);

        // Grid
        _ctx.strokeStyle = '#1e1e1e';
        _ctx.lineWidth   = 1;
        for (let db = dispMin; db <= dispMax; db += 20) {
            const y = dby(db);
            _ctx.beginPath(); _ctx.moveTo(PAD_L, y); _ctx.lineTo(PAD_L + PW, y); _ctx.stroke();
        }
        [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50].forEach(f => {
            if (f < F_MIN || f > fMax) return;
            const x = fx(f);
            _ctx.beginPath(); _ctx.moveTo(x, PAD_T); _ctx.lineTo(x, PAD_T + PH); _ctx.stroke();
        });

        // Y axis labels (dB)
        _ctx.fillStyle = '#666';
        _ctx.font      = '9px sans-serif';
        _ctx.textAlign = 'right';
        for (let db = dispMin; db <= dispMax; db += 20)
            _ctx.fillText(`${db}`, PAD_L - 4, dby(db) + 3);

        // Y axis title
        _ctx.save();
        _ctx.translate(10, PAD_T + PH / 2);
        _ctx.rotate(-Math.PI / 2);
        _ctx.textAlign = 'center';
        _ctx.fillText('dB', 0, 0);
        _ctx.restore();

        // X axis labels (Hz)
        _ctx.fillStyle = '#666';
        _ctx.textAlign = 'center';
        [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50].forEach(f => {
            if (f < F_MIN || f > fMax) return;
            _ctx.fillText(`${f}Hz`, fx(f), PAD_T + PH + PAD_B - 4);
        });

        if (_windows.length === 0) return;

        if (_densityMode) {
            // ── Layer 2a: Density heatmap ─────────────────────────
            // Count how many window PSD curves pass through each plot pixel.
            // Log-normalise the count, then map to blue→cyan→yellow→red.
            const density = new Uint32Array(PW * PH);

            // Iterate pixel columns → bin (not bin → pixel).
            // This eliminates gaps at low frequencies where log-spaced pixels
            // are much wider than the linear FFT bin spacing.
            for (const win of _windows) {
                for (let px = 0; px < PW; px++) {
                    const f = F_MIN * Math.pow(10, px / PW * logRange);
                    if (f > fMax) break;
                    const bf = f * FFT_SIZE / _sr;
                    const b0 = Math.floor(bf);
                    const b1 = Math.min(b0 + 1, FFT_SIZE / 2 - 1);
                    if (b0 < 1) continue;
                    const t  = bf - b0;
                    const p  = win[b0] * (1 - t) + win[b1] * t;
                    const db = p > 0 ? 10 * Math.log10(p) : dispMin;
                    const py = dby(Math.max(dispMin, Math.min(dispMax, db))) - PAD_T;
                    if (py < 0 || py >= PH) continue;
                    density[py * PW + px]++;
                }
            }

            let maxDens = 1;
            for (let i = 0; i < density.length; i++)
                if (density[i] > maxDens) maxDens = density[i];

            const logMax = Math.log(maxDens + 1);
            const img    = _ctx.createImageData(PW, PH);

            for (let i = 0; i < PW * PH; i++) {
                const d = density[i];
                if (d === 0) continue;
                const t   = Math.log(d + 1) / logMax;
                const off = i * 4;
                let r, g, b;
                if (t < 1/3) {
                    const s  = t * 3;
                    r = 0;
                    g = Math.round(s * 220);
                    b = Math.round(150 + s * 105);
                } else if (t < 2/3) {
                    const s  = (t - 1/3) * 3;
                    r = Math.round(s * 240);
                    g = Math.round(220 + s * 35);
                    b = Math.round(255 * (1 - s));
                } else {
                    const s  = (t - 2/3) * 3;
                    r = Math.round(240 + s * 15);
                    g = Math.round(255 * (1 - s * 0.88));
                    b = 0;
                }
                img.data[off]     = r;
                img.data[off + 1] = g;
                img.data[off + 2] = b;
                img.data[off + 3] = Math.round(180 + t * 75);
            }
            _ctx.putImageData(img, PAD_L, PAD_T);

            // ── Layer 3: Welch mean curve ─────────────────────────
            const avg = avg0 || _averagedPsd();
            if (avg) {
                _ctx.strokeStyle = 'rgba(255,255,255,0.9)';
                _ctx.lineWidth   = 1;
                _ctx.beginPath();
                let started = false;
                for (let b = 1; b < FFT_SIZE / 2; b++) {
                    const f = b * _sr / FFT_SIZE;
                    if (f < F_MIN || f > fMax) continue;
                    const db = avg[b] > 0 ? 10 * Math.log10(avg[b]) : dispMin;
                    const y  = dby(Math.max(dispMin, Math.min(dispMax, db)));
                    if (!started) { _ctx.moveTo(fx(f), y); started = true; }
                    else           _ctx.lineTo(fx(f), y);
                }
                _ctx.stroke();
            }

            // Frame count label
            _ctx.fillStyle = 'rgba(255,255,255,0.45)';
            _ctx.textAlign = 'left';
            _ctx.fillText(`${_nWin} frames avg`, PAD_L + 4, PAD_T + 11);

        } else {
            // ── Layer 2b: Realtime — latest single window line ────
            const latest = _windows[_windows.length - 1];
            _ctx.beginPath();
            _ctx.strokeStyle = 'rgba(0, 210, 180, 0.9)';
            _ctx.lineWidth   = 1.5;
            let first = true;
            for (let px = 0; px < PW; px++) {
                const f = F_MIN * Math.pow(10, px / PW * logRange);
                if (f > fMax) break;
                const bf = f * FFT_SIZE / _sr;
                const b0 = Math.floor(bf);
                const b1 = Math.min(b0 + 1, FFT_SIZE / 2 - 1);
                if (b0 < 1) continue;
                const t  = bf - b0;
                const p  = latest[b0] * (1 - t) + latest[b1] * t;
                const db = p > 0 ? 10 * Math.log10(p) : dispMin;
                const y  = dby(Math.max(dispMin, Math.min(dispMax, db)));
                if (first) { _ctx.moveTo(PAD_L + px, y); first = false; }
                else        { _ctx.lineTo(PAD_L + px, y); }
            }
            _ctx.stroke();

            // Frame count label
            _ctx.fillStyle = 'rgba(255,255,255,0.45)';
            _ctx.textAlign = 'left';
            _ctx.fillText(`live · ${_nWin} frames`, PAD_L + 4, PAD_T + 11);
        }
    }

    // ── Public API ────────────────────────────────────────────────

    function init(canvasEl, sampleRate) {
        _canvas       = canvasEl;
        _ctx          = canvasEl.getContext('2d');
        if (sampleRate && sampleRate > 0) _sr = sampleRate;
        _canvas.width  = _canvas.clientWidth  || 300;
        _canvas.height = _canvas.clientHeight || 150;
        _sumPow       = null;
        _nWin         = 0;
        _windows      = [];
        _showPeterson = false;
        _ctx.fillStyle = '#0a0a0a';
        _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
    }

    function push(accZ, sampleRate) {
        if (sampleRate && sampleRate > 0) _sr = sampleRate;
        _buf[_head] = accZ;
        _head = (_head + 1) & (FFT_SIZE - 1);
        if (++_hopCount >= HOP_SIZE) {
            _hopCount = 0;
            if (!_canvas) return;
            if (!_sumPow) _sumPow = new Float32Array(FFT_SIZE / 2);
            const pow = _computePower();
            for (let b = 0; b < FFT_SIZE / 2; b++) _sumPow[b] += pow[b];
            _nWin++;
            _windows.push(pow);
            _redraw();
        }
    }

    function reset() {
        _buf.fill(0);
        _head         = 0;
        _hopCount     = 0;
        _sumPow       = null;
        _nWin         = 0;
        _dispDbMax    = DB_MAX;
        _windows      = [];
        _showPeterson = false;
        if (_ctx && _canvas) {
            _ctx.fillStyle = '#0a0a0a';
            _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
        }
    }

    /**
     * Compute PSD from pre-loaded CSV rows (file mode).
     * Uses FILE_HOP (50% overlap) for reasonable window count.
     * @param {Array}  rows   parsed CSV row objects
     * @param {number} sr     sample rate (Hz)
     * @param {string} axis   'z' | 'x' | 'y'
     */
    function computeFromRows(rows, sr, axis) {
        if (!_canvas || !rows || rows.length < FFT_SIZE) return;
        if (sr && sr > 0) _sr = sr;

        const re     = new Float32Array(FFT_SIZE);
        const im     = new Float32Array(FFT_SIZE);
        const sumPow = new Float32Array(FFT_SIZE / 2);
        const wins   = [];
        let count    = 0;

        for (let start = 0; start + FFT_SIZE <= rows.length; start += FILE_HOP) {
            // 1) Read raw samples
            re.fill(0); im.fill(0);
            let mean = 0;
            for (let i = 0; i < FFT_SIZE; i++) {
                const r = rows[start + i];
                const v = parseFloat(
                    axis === 'x' ? r.acc_x : axis === 'y' ? r.acc_y : r.acc_z
                ) || 0;
                re[i] = v;
                mean += v;
            }
            // 2) DC offset removal
            mean /= FFT_SIZE;
            // 3) Apply Hann window
            for (let i = 0; i < FFT_SIZE; i++)
                re[i] = (re[i] - mean) * _hann[i];
            _fft(re, im);
            // 4) One-sided PSD with Hann window compensation
            const pow = new Float32Array(FFT_SIZE / 2);
            for (let b = 0; b < FFT_SIZE / 2; b++) {
                pow[b] = 2 * (re[b]**2 + im[b]**2) / (_sr * _sumW2);
                sumPow[b] += pow[b];
            }
            wins.push(pow);
            count++;
        }
        if (count === 0) return;

        _sumPow  = sumPow;
        _nWin    = count;
        _windows = wins;
        _redraw();
    }

    function setDensityMode(val) {
        _densityMode = !!val;
        _redraw();
    }

    return { init, push, reset, computeFromRows, setDensityMode };
})();

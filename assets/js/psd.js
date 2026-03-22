/**
 * psd.js  v1.0
 * Role   : Power Spectral Density (Welch's method, rolling average)
 * Input  : acc_z samples via push() or pre-loaded rows via computeFromRows()
 * Output : Canvas 2D line graph
 *          X axis = frequency (log scale, 0.5 – Nyquist Hz)
 *          Y axis = power density (dB, DB_MIN – DB_MAX)
 *
 * Algorithm : Cooley-Tukey FFT → squared magnitude → rolling mean of N_AVG frames
 *             PSD[b] = mean(|FFT_b|²) / (sr × FFT_SIZE)   [(m/s²)²/Hz]
 *             dB     = 10 × log₁₀(PSD[b])
 */

const PsdModule = (() => {

    // ── Config ────────────────────────────────────────────────────
    const FFT_SIZE = 256;
    const HOP_SIZE = 26;
    const N_AVG    = 16;   // rolling window: last N_AVG FFT frames averaged
    const DB_MIN   = -120;
    const DB_MAX   = -20;
    const F_MIN    = 0.5;  // Hz: left edge of plot

    // Padding (px)
    const PAD_L = 40, PAD_R = 10, PAD_T = 10, PAD_B = 20;

    // ── Hann window ───────────────────────────────────────────────
    const _hann = new Float32Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++)
        _hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));

    // ── State ─────────────────────────────────────────────────────
    let _canvas = null;
    let _ctx    = null;
    let _sr     = 100;
    let _buf    = new Float32Array(FFT_SIZE);
    let _head   = 0;
    let _hopCount = 0;
    const _powerBuf = [];  // rolling array of Float32Array(FFT_SIZE/2), max N_AVG entries

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
        const re = new Float32Array(FFT_SIZE);
        const im = new Float32Array(FFT_SIZE);
        for (let i = 0; i < FFT_SIZE; i++)
            re[i] = _buf[(_head + i) & (FFT_SIZE - 1)] * _hann[i];
        _fft(re, im);
        const pow = new Float32Array(FFT_SIZE / 2);
        for (let b = 0; b < FFT_SIZE / 2; b++)
            pow[b] = (re[b]**2 + im[b]**2) / (_sr * FFT_SIZE);
        return pow;
    }

    // ── Average the rolling power buffer ──────────────────────────
    function _averagedPsd() {
        if (_powerBuf.length === 0) return null;
        const avg = new Float32Array(FFT_SIZE / 2);
        for (const p of _powerBuf)
            for (let b = 0; b < FFT_SIZE / 2; b++) avg[b] += p[b];
        for (let b = 0; b < FFT_SIZE / 2; b++) avg[b] /= _powerBuf.length;
        return avg;
    }

    // ── Render PSD curve ──────────────────────────────────────────
    function _redraw() {
        if (!_canvas || !_ctx) return;
        const W  = _canvas.width;
        const H  = _canvas.height;
        const PW = W - PAD_L - PAD_R;
        const PH = H - PAD_T - PAD_B;
        if (PW < 2 || PH < 2) return;

        const nyq  = _sr / 2;
        const fMax = Math.min(50, nyq);
        const logRange = Math.log10(fMax / F_MIN);

        function fx(f)  { return PAD_L + Math.round(Math.log10(f / F_MIN) / logRange * PW); }
        function dby(db) { return PAD_T + PH - Math.round((db - DB_MIN) / (DB_MAX - DB_MIN) * PH); }

        // Background
        _ctx.fillStyle = '#0a0a0a';
        _ctx.fillRect(0, 0, W, H);

        // Grid
        _ctx.strokeStyle = '#1e1e1e';
        _ctx.lineWidth   = 1;
        for (let db = DB_MIN; db <= DB_MAX; db += 20) {
            const y = dby(db);
            _ctx.beginPath(); _ctx.moveTo(PAD_L, y); _ctx.lineTo(PAD_L + PW, y); _ctx.stroke();
        }
        [1, 2, 5, 10, 20, 50].forEach(f => {
            if (f < F_MIN || f > fMax) return;
            const x = fx(f);
            _ctx.beginPath(); _ctx.moveTo(x, PAD_T); _ctx.lineTo(x, PAD_T + PH); _ctx.stroke();
        });

        // Y axis labels (dB)
        _ctx.fillStyle = '#666';
        _ctx.font      = '9px sans-serif';
        _ctx.textAlign = 'right';
        for (let db = DB_MIN; db <= DB_MAX; db += 20)
            _ctx.fillText(`${db}`, PAD_L - 4, dby(db) + 3);

        // Y axis title
        _ctx.save();
        _ctx.translate(10, PAD_T + PH / 2);
        _ctx.rotate(-Math.PI / 2);
        _ctx.textAlign = 'center';
        _ctx.fillText('dB', 0, 0);
        _ctx.restore();

        // X axis labels (Hz)
        _ctx.textAlign = 'center';
        [1, 2, 5, 10, 20, 50].forEach(f => {
            if (f < F_MIN || f > fMax) return;
            _ctx.fillText(`${f}Hz`, fx(f), PAD_T + PH + PAD_B - 4);
        });

        // PSD curve
        const avg = _averagedPsd();
        if (!avg) return;

        _ctx.strokeStyle = '#00d2d3';
        _ctx.lineWidth   = 1.5;
        _ctx.beginPath();
        let started = false;
        for (let b = 1; b < FFT_SIZE / 2; b++) {
            const f = b * _sr / FFT_SIZE;
            if (f < F_MIN || f > fMax) continue;
            const db = avg[b] > 0 ? 10 * Math.log10(avg[b]) : DB_MIN;
            const y  = dby(Math.max(DB_MIN, Math.min(DB_MAX, db)));
            if (!started) { _ctx.moveTo(fx(f), y); started = true; }
            else           _ctx.lineTo(fx(f), y);
        }
        _ctx.stroke();

        // Frame count label
        _ctx.fillStyle = 'rgba(255,255,255,0.45)';
        _ctx.textAlign = 'left';
        _ctx.fillText(`${_powerBuf.length} frames avg`, PAD_L + 4, PAD_T + 11);
        _ctx.textAlign = 'left';
    }

    // ── Public API ────────────────────────────────────────────────

    function init(canvasEl, sampleRate) {
        _canvas = canvasEl;
        _ctx    = canvasEl.getContext('2d');
        if (sampleRate && sampleRate > 0) _sr = sampleRate;
        _canvas.width  = _canvas.clientWidth  || 300;
        _canvas.height = _canvas.clientHeight || 150;
        _powerBuf.length = 0;
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
            _powerBuf.push(_computePower());
            if (_powerBuf.length > N_AVG) _powerBuf.shift();
            _redraw();
        }
    }

    function reset() {
        _buf.fill(0);
        _head     = 0;
        _hopCount = 0;
        _powerBuf.length = 0;
        if (_ctx && _canvas) {
            _ctx.fillStyle = '#0a0a0a';
            _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
        }
    }

    /**
     * Compute PSD from pre-loaded CSV rows (file mode).
     * @param {Array}  rows   parsed CSV row objects
     * @param {number} sr     sample rate (Hz)
     * @param {string} axis   'z' | 'x' | 'y'
     */
    function computeFromRows(rows, sr, axis) {
        if (!_canvas || !rows || rows.length < FFT_SIZE) return;
        if (sr && sr > 0) _sr = sr;

        const re = new Float32Array(FFT_SIZE);
        const im = new Float32Array(FFT_SIZE);
        const sumPow = new Float32Array(FFT_SIZE / 2);
        let count = 0;

        for (let start = 0; start + FFT_SIZE <= rows.length; start += HOP_SIZE) {
            re.fill(0); im.fill(0);
            for (let i = 0; i < FFT_SIZE; i++) {
                const r = rows[start + i];
                const v = parseFloat(
                    axis === 'x' ? r.acc_x : axis === 'y' ? r.acc_y : r.acc_z
                ) || 0;
                re[i] = v * _hann[i];
            }
            _fft(re, im);
            for (let b = 0; b < FFT_SIZE / 2; b++)
                sumPow[b] += (re[b]**2 + im[b]**2) / (_sr * FFT_SIZE);
            count++;
        }
        if (count === 0) return;

        _powerBuf.length = 0;
        const avg = new Float32Array(FFT_SIZE / 2);
        for (let b = 0; b < FFT_SIZE / 2; b++) avg[b] = sumPow[b] / count;
        _powerBuf.push(avg);
        _redraw();
    }

    return { init, push, reset, computeFromRows };
})();

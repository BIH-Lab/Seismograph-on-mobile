/**
 * hvsr.js  v2.0
 * Role   : Horizontal-to-Vertical Spectral Ratio (Nakamura method)
 * Input  : acc_x, acc_y, acc_z samples via push()
 *          or pre-loaded 3-axis rows via computeFromRows()
 * Output : Canvas 2D line graph
 *          X axis = frequency (log scale, F_MIN – F_MAX Hz)
 *          Y axis = H/V ratio (linear, 0 – HV_MAX)
 *
 * Formula :
 *   H(f) = √( (|FFT_x(f)|² + |FFT_y(f)|²) / 2 )
 *   V(f) = |FFT_z(f)|
 *   HVSR(f) = mean over windows of [ H(f)/V(f) ]   ← per-window ratio (SESAME-correct)
 *
 * Sensor mode : Hann, ±2-bin MA smoothing, live accumulation
 * File mode   : Hann, 50% overlap, stationarity filter, Konno-Ohmachi (b=40) smoothing
 *
 * Improvements over v1.7 (SESAME 2004 compliance):
 *   1. Averaging order : per-window H/V ratio then mean (was: mean H², mean V², then ratio)
 *   2. File mode overlap: 50 % (HOP=FFT_SIZE/2) instead of 97.5 %
 *   3. Smoothing        : Konno-Ohmachi (b=40) for file mode; ±2-bin MA for sensor mode
 *   4. Stationarity     : reject windows with total RMS outside [0.5×, 2×] median
 *   5. f₀ search range  : 0.2–20 Hz (was 1–10 Hz)
 *   6. f₀ threshold     : 2.0 (was 1.5)
 *   7. Plot range       : F_MIN = 0.2 Hz (was 0.5 Hz)
 *
 * Reference : Nakamura (1989); SESAME guidelines (2004);
 *             Jung et al. (2010) — HVSR study of SW Korean Peninsula
 */

const HvsrModule = (() => {

    // ── Config ────────────────────────────────────────────────────
    const FFT_SIZE    = 1024;
    const HOP_SIZE    = 26;     // sensor mode: ~97.5% overlap
    const FILE_HOP    = 512;    // file mode: 50% overlap
    const F_MIN       = 0.2;    // Hz: left edge of plot
    const F_MAX       = 50;     // Hz: right edge of plot
    const MIN_WINDOWS = 50;     // below this: show low-reliability warning
    const KO_BW       = 40;     // Konno-Ohmachi bandwidth coefficient b
    const SMOOTH_HALF = 2;      // ±bins for sensor-mode MA smoothing
    const STAT_LO     = 0.5;    // stationarity: reject if < LO × median RMS
    const STAT_HI     = 2.0;    // stationarity: reject if > HI × median RMS
    const F0_MIN      = 0.2;    // Hz: f₀ peak search range min
    const F0_MAX      = 20;     // Hz: f₀ peak search range max
    const F0_THRESH   = 2.0;    // H/V amplitude threshold to mark f₀

    // Padding (px)
    const PAD_L = 40, PAD_R = 10, PAD_T = 22, PAD_B = 20;

    // ── Hann window ───────────────────────────────────────────────
    const _hann = new Float32Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++)
        _hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));

    // ── State ─────────────────────────────────────────────────────
    let _canvas   = null;
    let _ctx      = null;
    let _sr       = 100;
    let _bufX     = new Float32Array(FFT_SIZE);
    let _bufY     = new Float32Array(FFT_SIZE);
    let _bufZ     = new Float32Array(FFT_SIZE);
    let _head     = 0;
    let _hopCount = 0;
    let _sumHV    = null;   // accumulated per-window H/V ratios per bin
    let _nWin     = 0;      // number of accumulated windows
    let _hvDispMax = 2;     // display Y ceiling, recomputed each redraw
    let _useKO    = false;  // true while displaying file-mode results

    // ── FFT (Cooley-Tukey radix-2 DIT) ───────────────────────────
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

    // ── Konno-Ohmachi smoothing (file mode) ───────────────────────
    // W(f, fc) = [sin(b·log₁₀(f/fc)) / (b·log₁₀(f/fc))]⁴
    function _koSmooth(spectrum) {
        const N   = spectrum.length;
        const out = new Float32Array(N);
        for (let ci = 1; ci < N; ci++) {
            const fc = ci * _sr / (2 * N);
            let wsum = 0, vsum = 0;
            for (let fi = 1; fi < N; fi++) {
                const f = fi * _sr / (2 * N);
                const x = KO_BW * Math.log10(f / fc);
                let w;
                if (Math.abs(x) < 1e-4) {
                    w = 1;
                } else {
                    const sx = Math.sin(x) / x;
                    w = sx * sx * sx * sx;
                }
                vsum += w * spectrum[fi];
                wsum += w;
            }
            out[ci] = wsum > 1e-12 ? vsum / wsum : 0;
        }
        return out;
    }

    // ── ±SMOOTH_HALF moving-average smoothing (sensor mode) ───────
    function _maSmooth(spectrum) {
        const N   = spectrum.length;
        const out = new Float32Array(N);
        for (let b = 0; b < N; b++) {
            let sum = 0, cnt = 0;
            for (let k = -SMOOTH_HALF; k <= SMOOTH_HALF; k++) {
                const idx = b + k;
                if (idx >= 0 && idx < N) { sum += spectrum[idx]; cnt++; }
            }
            out[b] = sum / cnt;
        }
        return out;
    }

    // ── Accumulate one FFT window from ring buffers (sensor mode) ─
    function _accumulateWindow() {
        if (!_sumHV) _sumHV = new Float32Array(FFT_SIZE / 2);
        const reX = new Float32Array(FFT_SIZE), imX = new Float32Array(FFT_SIZE);
        const reY = new Float32Array(FFT_SIZE), imY = new Float32Array(FFT_SIZE);
        const reZ = new Float32Array(FFT_SIZE), imZ = new Float32Array(FFT_SIZE);

        let mX = 0, mY = 0, mZ = 0;
        for (let i = 0; i < FFT_SIZE; i++) {
            const idx = (_head + i) & (FFT_SIZE - 1);
            mX += _bufX[idx]; mY += _bufY[idx]; mZ += _bufZ[idx];
        }
        mX /= FFT_SIZE; mY /= FFT_SIZE; mZ /= FFT_SIZE;
        for (let i = 0; i < FFT_SIZE; i++) {
            const idx = (_head + i) & (FFT_SIZE - 1);
            const w   = _hann[i];
            reX[i] = (_bufX[idx] - mX) * w;
            reY[i] = (_bufY[idx] - mY) * w;
            reZ[i] = (_bufZ[idx] - mZ) * w;
        }
        _fft(reX, imX);
        _fft(reY, imY);
        _fft(reZ, imZ);

        // Per-window H/V ratio accumulation (SESAME-correct averaging order)
        for (let b = 0; b < FFT_SIZE / 2; b++) {
            const h = Math.sqrt((reX[b]**2 + imX[b]**2 + reY[b]**2 + imY[b]**2) / 2);
            const v = Math.sqrt(reZ[b]**2 + imZ[b]**2);
            _sumHV[b] += v > 1e-12 ? h / v : 0;
        }
        _nWin++;
    }

    // ── Compute averaged + smoothed HVSR curve ─────────────────────
    function _computeHvsr() {
        if (!_sumHV || _nWin === 0) return null;
        const raw = new Float32Array(FFT_SIZE / 2);
        for (let b = 0; b < FFT_SIZE / 2; b++)
            raw[b] = _sumHV[b] / _nWin;
        return _useKO ? _koSmooth(raw) : _maSmooth(raw);
    }

    // ── Render ────────────────────────────────────────────────────
    function _redraw() {
        if (!_canvas || !_ctx) return;
        const W  = _canvas.width;
        const H  = _canvas.height;
        const PW = W - PAD_L - PAD_R;
        const PH = H - PAD_T - PAD_B;
        if (PW < 2 || PH < 2) return;

        const nyq      = _sr / 2;
        const fMax     = Math.min(F_MAX, nyq);
        const logRange = Math.log10(fMax / F_MIN);

        function fx(f) { return PAD_L + Math.round(Math.log10(f / F_MIN) / logRange * PW); }

        // Compute HVSR first for auto-scale
        const hv = _computeHvsr();
        if (hv) {
            let dataMax = 0;
            for (let b = 1; b < FFT_SIZE / 2; b++) {
                const f = b * _sr / FFT_SIZE;
                if (f < F_MIN || f > fMax) continue;
                if (hv[b] > dataMax) dataMax = hv[b];
            }
            const target = dataMax * 1.1;
            _hvDispMax = target <= 2  ? Math.max(1, Math.ceil(target * 2) / 2)
                       : target <= 10 ? Math.ceil(target)
                       :                Math.ceil(target / 2) * 2;
        }

        function hvy(hvVal) {
            return PAD_T + PH - Math.round(Math.min(hvVal, _hvDispMax) / _hvDispMax * PH);
        }

        // Background
        _ctx.fillStyle = '#0a0a0a';
        _ctx.fillRect(0, 0, W, H);

        // Grid
        _ctx.strokeStyle = '#1e1e1e';
        _ctx.lineWidth   = 1;
        const gridStep = _hvDispMax <= 2  ? 0.5
                       : _hvDispMax <= 5  ? 1
                       : _hvDispMax <= 10 ? 2
                       : _hvDispMax <= 20 ? 4 : 5;
        for (let v = 0; v <= _hvDispMax; v += gridStep) {
            const y = hvy(v);
            _ctx.beginPath(); _ctx.moveTo(PAD_L, y); _ctx.lineTo(PAD_L + PW, y); _ctx.stroke();
        }
        [0.2, 0.5, 1, 2, 5, 10, 20, 50].forEach(f => {
            if (f < F_MIN || f > fMax) return;
            const x = fx(f);
            _ctx.beginPath(); _ctx.moveTo(x, PAD_T); _ctx.lineTo(x, PAD_T + PH); _ctx.stroke();
        });

        // Y axis labels
        _ctx.fillStyle = '#666';
        _ctx.font      = '9px sans-serif';
        _ctx.textAlign = 'right';
        for (let v = 0; v <= _hvDispMax; v += gridStep)
            _ctx.fillText(`${v}`, PAD_L - 4, hvy(v) + 3);

        _ctx.save();
        _ctx.translate(10, PAD_T + PH / 2);
        _ctx.rotate(-Math.PI / 2);
        _ctx.textAlign = 'center';
        _ctx.fillText('H/V', 0, 0);
        _ctx.restore();

        // X axis labels
        _ctx.fillStyle = '#666';
        _ctx.textAlign = 'center';
        [0.2, 0.5, 1, 2, 5, 10, 20, 50].forEach(f => {
            if (f < F_MIN || f > fMax) return;
            _ctx.fillText(`${f}Hz`, fx(f), PAD_T + PH + PAD_B - 4);
        });

        // H/V = 1 reference dashed line
        _ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        _ctx.lineWidth   = 1;
        _ctx.setLineDash([4, 4]);
        _ctx.beginPath(); _ctx.moveTo(PAD_L, hvy(1)); _ctx.lineTo(PAD_L + PW, hvy(1)); _ctx.stroke();
        _ctx.setLineDash([]);

        // Window count / quality indicator
        const lowQuality = _nWin < MIN_WINDOWS;
        _ctx.fillStyle   = lowQuality ? '#f39c12' : 'rgba(255,255,255,0.45)';
        _ctx.textAlign   = 'left';
        _ctx.font        = '9px sans-serif';
        _ctx.fillText(
            lowQuality
                ? `N=${_nWin} — 신뢰도 낮음 (10분 이상 측정 권장)`
                : `N=${_nWin} 윈도우 평균`,
            PAD_L + 4, PAD_T - 6
        );

        if (!hv) return;

        // HVSR curve
        _ctx.strokeStyle = '#e67e22';
        _ctx.lineWidth   = 2;
        _ctx.beginPath();
        let started = false;
        let peakVal = 0, peakHz = 0;

        for (let b = 1; b < FFT_SIZE / 2; b++) {
            const f = b * _sr / FFT_SIZE;
            if (f < F_MIN || f > fMax) continue;
            const y = hvy(hv[b]);
            if (!started) { _ctx.moveTo(fx(f), y); started = true; }
            else            _ctx.lineTo(fx(f), y);
            if (f >= F0_MIN && f <= F0_MAX && hv[b] > peakVal) {
                peakVal = hv[b]; peakHz = f;
            }
        }
        _ctx.stroke();

        // f₀ peak marker (only if clear peak H/V ≥ threshold)
        if (peakVal >= F0_THRESH && peakHz > 0) {
            const px = fx(peakHz);
            _ctx.strokeStyle = 'rgba(230,126,34,0.6)';
            _ctx.lineWidth   = 1;
            _ctx.setLineDash([3, 3]);
            _ctx.beginPath(); _ctx.moveTo(px, PAD_T); _ctx.lineTo(px, PAD_T + PH); _ctx.stroke();
            _ctx.setLineDash([]);
            _ctx.fillStyle = '#e67e22';
            _ctx.textAlign = 'center';
            _ctx.font      = '10px sans-serif';
            _ctx.fillText(`f₀=${peakHz.toFixed(2)}Hz`, px, PAD_T + 11);
        }
        _ctx.textAlign = 'left';
    }

    // ── Public API ────────────────────────────────────────────────

    function init(canvasEl, sampleRate) {
        _canvas = canvasEl;
        _ctx    = canvasEl.getContext('2d');
        if (sampleRate && sampleRate > 0) _sr = sampleRate;
        _canvas.width  = _canvas.clientWidth  || 300;
        _canvas.height = _canvas.clientHeight || 150;
        _sumHV    = null;
        _nWin     = 0;
        _head     = 0;
        _hopCount = 0;
        _useKO    = false;
        _hvDispMax = 2;
        _bufX.fill(0); _bufY.fill(0); _bufZ.fill(0);
        _ctx.fillStyle = '#0a0a0a';
        _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
    }

    function push(accX, accY, accZ, sampleRate) {
        if (sampleRate && sampleRate > 0) _sr = sampleRate;
        _bufX[_head] = accX;
        _bufY[_head] = accY;
        _bufZ[_head] = accZ;
        _head = (_head + 1) & (FFT_SIZE - 1);
        if (++_hopCount >= HOP_SIZE) {
            _hopCount = 0;
            if (!_canvas) return;
            _accumulateWindow();
            _redraw();
        }
    }

    function reset() {
        _bufX.fill(0); _bufY.fill(0); _bufZ.fill(0);
        _head      = 0;
        _hopCount  = 0;
        _sumHV     = null;
        _nWin      = 0;
        _hvDispMax = 2;
        _useKO     = false;
        if (_ctx && _canvas) {
            _ctx.fillStyle = '#0a0a0a';
            _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
        }
    }

    function windowCount() { return _nWin; }

    /**
     * Compute HVSR from pre-loaded 3-axis CSV rows (file mode).
     * Uses 50 % overlap, stationarity filtering, Konno-Ohmachi smoothing.
     * @param {Array}  rows  parsed CSV row objects
     * @param {number} sr    sample rate (Hz)
     */
    function computeFromRows(rows, sr) {
        if (!_canvas || !rows || rows.length < FFT_SIZE) return;
        if (!rows[0].acc_x) return;  // Z-only CSV — caller should guard this
        if (sr && sr > 0) _sr = sr;

        const step         = FILE_HOP;
        const totalWindows = Math.floor((rows.length - FFT_SIZE) / step) + 1;

        // ── Pass 1: RMS per window for stationarity check ──────────
        const rmsArr = new Float32Array(totalWindows);
        for (let wi = 0; wi < totalWindows; wi++) {
            const s = wi * step;
            let sumSq = 0;
            for (let i = 0; i < FFT_SIZE; i++) {
                const r = rows[s + i];
                const x = parseFloat(r.acc_x) || 0;
                const y = parseFloat(r.acc_y) || 0;
                const z = parseFloat(r.acc_z) || 0;
                sumSq += x*x + y*y + z*z;
            }
            rmsArr[wi] = Math.sqrt(sumSq / FFT_SIZE);
        }

        // Median RMS
        const sorted = rmsArr.slice().sort();
        const median = sorted[Math.floor(totalWindows / 2)];
        const lo = median > 1e-12 ? median * STAT_LO : 0;
        const hi = median > 1e-12 ? median * STAT_HI : Infinity;

        // ── Pass 2: accumulate stationary windows ──────────────────
        _sumHV = new Float32Array(FFT_SIZE / 2);
        _nWin  = 0;

        const reX = new Float32Array(FFT_SIZE), imX = new Float32Array(FFT_SIZE);
        const reY = new Float32Array(FFT_SIZE), imY = new Float32Array(FFT_SIZE);
        const reZ = new Float32Array(FFT_SIZE), imZ = new Float32Array(FFT_SIZE);

        for (let wi = 0; wi < totalWindows; wi++) {
            if (rmsArr[wi] < lo || rmsArr[wi] > hi) continue;
            const s = wi * step;
            reX.fill(0); imX.fill(0);
            reY.fill(0); imY.fill(0);
            reZ.fill(0); imZ.fill(0);

            let mX = 0, mY = 0, mZ = 0;
            for (let i = 0; i < FFT_SIZE; i++) {
                const r = rows[s + i];
                mX += parseFloat(r.acc_x) || 0;
                mY += parseFloat(r.acc_y) || 0;
                mZ += parseFloat(r.acc_z) || 0;
            }
            mX /= FFT_SIZE; mY /= FFT_SIZE; mZ /= FFT_SIZE;

            for (let i = 0; i < FFT_SIZE; i++) {
                const r = rows[s + i];
                const w = _hann[i];
                reX[i] = ((parseFloat(r.acc_x) || 0) - mX) * w;
                reY[i] = ((parseFloat(r.acc_y) || 0) - mY) * w;
                reZ[i] = ((parseFloat(r.acc_z) || 0) - mZ) * w;
            }
            _fft(reX, imX); _fft(reY, imY); _fft(reZ, imZ);

            for (let b = 0; b < FFT_SIZE / 2; b++) {
                const h = Math.sqrt((reX[b]**2 + imX[b]**2 + reY[b]**2 + imY[b]**2) / 2);
                const v = Math.sqrt(reZ[b]**2 + imZ[b]**2);
                _sumHV[b] += v > 1e-12 ? h / v : 0;
            }
            _nWin++;
        }

        _useKO = true;
        _redraw();
    }

    return { init, push, reset, windowCount, computeFromRows };
})();

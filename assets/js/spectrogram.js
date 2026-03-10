/**
 * spectrogram.js
 * Role   : Real-time FFT spectrogram Canvas rendering (waterfall)
 * Input  : acc_z samples via push()
 * Output : Canvas 2D waterfall — X axis = frequency (0 Hz left → dispFreq right)
 *                               Y axis = time (newest top, oldest bottom = WINDOW_SEC ago)
 *
 * Algorithm  : Cooley-Tukey radix-2 DIT FFT
 * Window     : Hann (spectral leakage suppression)
 * Color map  : Viridis-style LUT (dark purple → blue → teal → yellow)
 * Rendering  : History-based full redraw (pixel-accurate time scale, no scroll drift)
 */

const SpectrogramModule = (() => {

    // ── Config ────────────────────────────────────────────────────
    const FFT_SIZE    = 256;  // must be power of 2
    const HOP_SIZE    = 26;   // new samples per FFT frame (~90% overlap, ObsPy default)
    const MAX_FREQ    = 100;  // Hz display ceiling; clipped to Nyquist (sr/2) at runtime
    const WINDOW_SEC  = 10;   // must match visual.js WINDOW_SEC
    const LOG_MIN     = -3;   // log10 amplitude floor  (0.001 m/s²)
    const LOG_MAX     = -1;   // log10 amplitude ceiling (0.1  m/s²)
    const FREQ_AXIS_H = 18;   // px reserved at bottom for frequency-axis labels

    // ── State ─────────────────────────────────────────────────────
    let _canvas       = null;
    let _ctx          = null;
    let _sr           = 100;
    let _onPeak       = null;
    let _buf          = new Float32Array(FFT_SIZE);  // ring buffer
    let _head         = 0;
    let _hopCount     = 0;
    let _hopTotal     = 0;      // total hops since init
    let _initTime     = null;   // performance.now() at init — wall-clock reference
    let _lastLabelSec = -1;     // last 2-second boundary already labelled
    // History: array of 1-px row ImageData pixels (newest = index 0)
    const _history = [];    // each entry: { rowData: Uint8ClampedArray(W×4), label: string|null }

    // ── Hann window (precomputed) ─────────────────────────────────
    const _hann = new Float32Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) {
        _hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));
    }

    // ── Cooley-Tukey radix-2 DIT FFT ─────────────────────────────
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
                    re[i+k]        = aRe+tRe;  im[i+k]        = aIm+tIm;
                    re[i+k+half]   = aRe-tRe;  im[i+k+half]   = aIm-tIm;
                    const nRe = uRe*wRe - uIm*wIm;
                    uIm = uRe*wIm + uIm*wRe;  uRe = nRe;
                }
            }
        }
    }

    // ── Viridis-style color LUT (256 entries) ─────────────────────
    const _lut = (() => {
        const stops = [
            [ 68,   1,  84],
            [ 59,  82, 139],
            [ 33, 145, 140],
            [ 94, 201,  98],
            [253, 231,  37],
        ];
        const lut = new Uint8Array(256 * 3);
        for (let i = 0; i < 256; i++) {
            const t = i / 255, raw = t * (stops.length - 1);
            const lo = Math.floor(raw), hi = Math.min(lo + 1, stops.length - 1), f = raw - lo;
            lut[i*3]   = Math.round(stops[lo][0] + f*(stops[hi][0]-stops[lo][0]));
            lut[i*3+1] = Math.round(stops[lo][1] + f*(stops[hi][1]-stops[lo][1]));
            lut[i*3+2] = Math.round(stops[lo][2] + f*(stops[hi][2]-stops[lo][2]));
        }
        return lut;
    })();

    // ── Compute 1-px row from current ring buffer ─────────────────
    // Returns { rowData: Uint8ClampedArray(W×4), peakHz: number }
    function _computeRow(W) {
        const re = new Float32Array(FFT_SIZE);
        const im = new Float32Array(FFT_SIZE);
        for (let i = 0; i < FFT_SIZE; i++) {
            re[i] = _buf[(_head + i) & (FFT_SIZE - 1)] * _hann[i];
        }
        _fft(re, im);

        const nyq      = _sr / 2;
        const dispFreq = Math.min(MAX_FREQ, nyq);
        const topBin   = Math.ceil(dispFreq / nyq * (FFT_SIZE / 2));

        const rowData = new Uint8ClampedArray(W * 4);
        for (let x = 0; x < W; x++) {
            const bin  = Math.min(Math.floor((x + 0.5) / W * topBin), topBin - 1);
            const amp  = Math.sqrt(re[bin]**2 + im[bin]**2) / (FFT_SIZE / 2);
            const logA = amp > 1e-9 ? Math.log10(amp) : LOG_MIN;
            const t    = Math.max(0, Math.min(1, (logA - LOG_MIN) / (LOG_MAX - LOG_MIN)));
            const ci   = Math.round(t * 255);
            rowData[x*4]   = _lut[ci*3];
            rowData[x*4+1] = _lut[ci*3+1];
            rowData[x*4+2] = _lut[ci*3+2];
            rowData[x*4+3] = 255;
        }

        // Peak frequency
        let maxAmp = 0, peakBin = 1;
        for (let b = 1; b < topBin; b++) {
            const a = Math.sqrt(re[b]**2 + im[b]**2);
            if (a > maxAmp) { maxAmp = a; peakBin = b; }
        }
        const peakHz = (peakBin / topBin) * dispFreq;

        return { rowData, peakHz };
    }

    // ── Redraw entire canvas from history (pixel-accurate time scale) ─
    function _redrawCanvas() {
        if (!_canvas || !_ctx) return;
        const W  = _canvas.width;
        const H  = _canvas.height;
        const DH = H - FREQ_AXIS_H;
        if (W < 2 || DH < 2) return;

        // Measured sr from wall-clock (accurate after >5 hops and >500 ms)
        const elapsedMs  = _initTime !== null ? performance.now() - _initTime : 0;
        const measuredSr = (_hopTotal > 5 && elapsedMs > 500)
            ? Math.max(20, Math.min(250, (_hopTotal * HOP_SIZE) / (elapsedMs / 1000)))
            : _sr;
        const finalM = (measuredSr * WINDOW_SEC) / HOP_SIZE;

        // Clear spectrogram area
        _ctx.fillStyle = '#0a0a0a';
        _ctx.fillRect(0, 0, W, DH);

        // Draw history: index 0 = newest (top, y=0), oldest at bottom
        // Each entry: { rowData, label } — label scrolls down with its row
        const N = _history.length;
        // During initial fill (N < finalM), stretch rows to fill canvas so waterfall
        // is immediately visible. Once N reaches finalM, switch to correct time scale.
        const M = Math.max(1, Math.min(N, finalM));
        _ctx.fillStyle = 'rgba(255,255,255,0.55)';
        _ctx.font = '9px sans-serif';
        for (let i = 0; i < N; i++) {
            const { rowData, label } = _history[i];
            const y0 = Math.round(i * DH / M);
            const y1 = Math.round((i + 1) * DH / M);
            const h  = Math.max(1, y1 - y0);
            if (y0 >= DH) break;
            const imgBuf = new Uint8ClampedArray(W * h * 4);
            for (let row = 0; row < h; row++) imgBuf.set(rowData, row * W * 4);
            _ctx.putImageData(new ImageData(imgBuf, W, h), 0, y0);
            // Time label scrolls with its row (same behavior as file-select mode)
            if (label && y0 + 9 < DH) _ctx.fillText(label, 2, y0 + 9);
        }

        _drawFreqAxis();
    }

    // ── Draw frequency axis at canvas bottom ──────────────────────
    function _drawFreqAxis() {
        if (!_canvas || !_ctx) return;
        const W  = _canvas.width;
        const H  = _canvas.height;
        const DH = H - FREQ_AXIS_H;
        const dispFreq = Math.min(MAX_FREQ, _sr / 2);

        _ctx.fillStyle = '#111';
        _ctx.fillRect(0, DH, W, FREQ_AXIS_H);
        _ctx.fillStyle  = '#666';
        _ctx.font       = '9px sans-serif';
        _ctx.strokeStyle = '#444';
        _ctx.lineWidth  = 1;

        for (let f = 0; f <= dispFreq; f += 10) {
            const x = Math.round((f / dispFreq) * (W - 1));
            _ctx.beginPath(); _ctx.moveTo(x, DH); _ctx.lineTo(x, DH + 4); _ctx.stroke();
            const label = f === 0 ? '0Hz' : `${f}`;
            const tw = f === 0 ? 0 : _ctx.measureText(label).width / 2;
            _ctx.fillText(label, Math.max(0, x - tw), H - 3);
        }
    }

    // ── Public API ────────────────────────────────────────────────

    function init(canvasEl, sampleRate, onPeakHz) {
        _canvas       = canvasEl;
        _ctx          = canvasEl.getContext('2d');
        _onPeak       = (typeof onPeakHz === 'function') ? onPeakHz : null;
        _hopTotal     = 0;
        _initTime     = performance.now();
        _lastLabelSec = -1;
        _history.length = 0;
        if (sampleRate && sampleRate > 0) _sr = sampleRate;

        _canvas.width  = _canvas.clientWidth  || 300;
        _canvas.height = _canvas.clientHeight || 150;

        _ctx.fillStyle = '#0a0a0a';
        _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
        _drawFreqAxis();
    }

    function push(accZ, sampleRate) {
        if (sampleRate && sampleRate > 0) _sr = sampleRate;
        _buf[_head] = accZ;
        _head = (_head + 1) & (FFT_SIZE - 1);
        if (++_hopCount >= HOP_SIZE) {
            _hopCount = 0;
            if (!_canvas) return;

            const { rowData, peakHz } = _computeRow(_canvas.width);
            if (_onPeak) _onPeak(peakHz.toFixed(1));

            _hopTotal++;
            // Elapsed time from wall-clock (immune to wrong event.interval reporting)
            const elapsedMs  = _initTime !== null ? performance.now() - _initTime : (_hopTotal * HOP_SIZE / _sr * 1000);
            const elapsedSec = elapsedMs / 1000;
            const labelSec   = Math.floor(elapsedSec / 2) * 2;
            const label      = (labelSec > _lastLabelSec) ? `${labelSec}s` : null;
            if (label) _lastLabelSec = labelSec;

            _history.unshift({ rowData, label }); // newest first

            // Measured sr from wall-clock (fallback to _sr if not enough data yet)
            const measuredSr = (_hopTotal > 5 && elapsedMs > 500)
                ? Math.max(20, Math.min(250, (_hopTotal * HOP_SIZE) / (elapsedMs / 1000)))
                : _sr;
            const maxFrames = Math.ceil(measuredSr * WINDOW_SEC / HOP_SIZE) + 1;
            if (_history.length > maxFrames) _history.length = maxFrames;

            _redrawCanvas();
        }
    }

    function reset() {
        _buf.fill(0);
        _head         = 0;
        _hopCount     = 0;
        _hopTotal     = 0;
        _initTime     = null;
        _lastLabelSec = -1;
        _history.length = 0;
        if (_ctx && _canvas) {
            _ctx.fillStyle = '#0a0a0a';
            _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
            _drawFreqAxis();
        }
    }

    return { init, push, reset };
})();

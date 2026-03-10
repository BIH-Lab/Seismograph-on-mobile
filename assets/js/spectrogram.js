/**
 * spectrogram.js
 * Role   : Real-time FFT spectrogram Canvas rendering
 * Input  : acc_z samples via push()
 * Output : Canvas 2D time×frequency color map (scrolls left as new data arrives)
 *
 * Algorithm  : Cooley-Tukey radix-2 DIT FFT
 * Window     : Hann (spectral leakage suppression)
 * Color map  : Viridis-style LUT (dark purple → blue → teal → yellow)
 */

const SpectrogramModule = (() => {

    // ── Config ────────────────────────────────────────────────────
    const FFT_SIZE = 256;   // must be power of 2; frequency resolution = sr / FFT_SIZE
    const HOP_SIZE = 26;    // new samples per spectrogram column (~90% overlap, per ObsPy default)
    const MAX_FREQ = 25;    // Hz — display ceiling (Nyquist of 50 Hz minimum sr)
    const LOG_MIN  = -3;    // log10 amplitude floor  → darkest color (0.001 m/s², building micro-vibration)
    const LOG_MAX  = -1;    // log10 amplitude ceiling → brightest color (0.1 m/s², typical daily vibration)

    // ── State ─────────────────────────────────────────────────────
    let _canvas   = null;
    let _ctx      = null;
    let _sr       = 100;    // estimated sample rate (Hz); updated via push()
    let _onPeak   = null;   // callback(hz: string) for peak frequency display
    let _buf      = new Float32Array(FFT_SIZE);  // ring buffer of recent samples
    let _head     = 0;      // next write index in ring buffer
    let _hopCount = 0;      // samples accumulated since last FFT

    // ── Hann window (precomputed) ─────────────────────────────────
    const _hann = new Float32Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) {
        _hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));
    }

    // ── Cooley-Tukey radix-2 DIT FFT ─────────────────────────────
    // In-place complex FFT on real[] and imag[] arrays (length N, power of 2)
    function _fft(re, im) {
        const N = re.length;

        // Bit-reversal permutation
        for (let i = 1, j = 0; i < N; i++) {
            let bit = N >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                [re[i], re[j]] = [re[j], re[i]];
                [im[i], im[j]] = [im[j], im[i]];
            }
        }

        // Butterfly stages
        for (let len = 2; len <= N; len <<= 1) {
            const theta = -2 * Math.PI / len;
            const wRe   = Math.cos(theta);
            const wIm   = Math.sin(theta);
            const half  = len >> 1;
            for (let i = 0; i < N; i += len) {
                let uRe = 1, uIm = 0;
                for (let k = 0; k < half; k++) {
                    const aRe = re[i + k];
                    const aIm = im[i + k];
                    const tRe = uRe * re[i + k + half] - uIm * im[i + k + half];
                    const tIm = uRe * im[i + k + half] + uIm * re[i + k + half];
                    re[i + k]        = aRe + tRe;
                    im[i + k]        = aIm + tIm;
                    re[i + k + half] = aRe - tRe;
                    im[i + k + half] = aIm - tIm;
                    const nRe = uRe * wRe - uIm * wIm;
                    uIm = uRe * wIm + uIm * wRe;
                    uRe = nRe;
                }
            }
        }
    }

    // ── Viridis-style color LUT (256 entries) ─────────────────────
    // Precomputed at module load for performance
    const _lut = (() => {
        const stops = [
            [ 68,   1,  84],   // 0.00 — dark purple
            [ 59,  82, 139],   // 0.25 — blue
            [ 33, 145, 140],   // 0.50 — teal
            [ 94, 201,  98],   // 0.75 — green
            [253, 231,  37],   // 1.00 — yellow
        ];
        const lut = new Uint8Array(256 * 3);
        for (let i = 0; i < 256; i++) {
            const t   = i / 255;
            const raw = t * (stops.length - 1);
            const lo  = Math.floor(raw);
            const hi  = Math.min(lo + 1, stops.length - 1);
            const f   = raw - lo;
            lut[i * 3]     = Math.round(stops[lo][0] + f * (stops[hi][0] - stops[lo][0]));
            lut[i * 3 + 1] = Math.round(stops[lo][1] + f * (stops[hi][1] - stops[lo][1]));
            lut[i * 3 + 2] = Math.round(stops[lo][2] + f * (stops[hi][2] - stops[lo][2]));
        }
        return lut;
    })();

    // ── Compute FFT and draw one column to canvas ─────────────────
    function _drawColumn() {
        if (!_canvas || !_ctx) return;
        const W = _canvas.width;
        const H = _canvas.height;
        if (W < 2 || H < 2) return;

        // Build windowed snapshot of ring buffer
        const re = new Float32Array(FFT_SIZE);
        const im = new Float32Array(FFT_SIZE);
        for (let i = 0; i < FFT_SIZE; i++) {
            re[i] = _buf[(_head + i) & (FFT_SIZE - 1)] * _hann[i];
        }

        _fft(re, im);

        // Number of bins that cover 0..MAX_FREQ
        const nyq    = _sr / 2;
        const topBin = Math.min(FFT_SIZE / 2, Math.ceil(MAX_FREQ / nyq * (FFT_SIZE / 2)));

        // Build one-pixel-wide column as ImageData
        const colData = new Uint8ClampedArray(H * 4);
        for (let y = 0; y < H; y++) {
            // y=0 (top) → MAX_FREQ; y=H-1 (bottom) → 0 Hz
            const bin  = Math.floor((1 - (y + 0.5) / H) * topBin);
            const amp  = Math.sqrt(re[bin] ** 2 + im[bin] ** 2) / (FFT_SIZE / 2);
            const logA = amp > 1e-9 ? Math.log10(amp) : LOG_MIN;
            const t    = Math.max(0, Math.min(1, (logA - LOG_MIN) / (LOG_MAX - LOG_MIN)));
            const ci   = Math.round(t * 255);
            colData[y * 4]     = _lut[ci * 3];
            colData[y * 4 + 1] = _lut[ci * 3 + 1];
            colData[y * 4 + 2] = _lut[ci * 3 + 2];
            colData[y * 4 + 3] = 255;
        }

        // Peak frequency: find bin with max amplitude in the visible range
        if (_onPeak) {
            let maxAmp = 0, peakBin = 1;
            for (let b = 1; b < topBin; b++) {
                const a = Math.sqrt(re[b] ** 2 + im[b] ** 2);
                if (a > maxAmp) { maxAmp = a; peakBin = b; }
            }
            const peakHz = (peakBin / (FFT_SIZE / 2)) * (_sr / 2);
            _onPeak(peakHz.toFixed(1));
        }

        // Scroll canvas left by 1 px, then stamp new column at right edge
        _ctx.drawImage(_canvas, -1, 0);
        _ctx.putImageData(new ImageData(colData, 1, H), W - 1, 0);
    }

    // ── Public API ────────────────────────────────────────────────

    /**
     * Initialize the spectrogram canvas.
     * Call after the canvas element is visible so clientWidth/Height are set.
     * @param {HTMLCanvasElement} canvasEl
     * @param {number} [sampleRate=100]  Initial sample rate estimate (Hz)
     */
    function init(canvasEl, sampleRate, onPeakHz) {
        _canvas  = canvasEl;
        _ctx     = canvasEl.getContext('2d');
        _onPeak  = (typeof onPeakHz === 'function') ? onPeakHz : null;
        if (sampleRate && sampleRate > 0) _sr = sampleRate;

        // Fix canvas pixel dimensions to current CSS display size
        _canvas.width  = _canvas.clientWidth  || 300;
        _canvas.height = _canvas.clientHeight || 150;

        _ctx.fillStyle = '#0a0a0a';
        _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
    }

    /**
     * Push one calibrated sensor sample.
     * Triggers an FFT + canvas column every HOP_SIZE samples.
     * @param {number} accZ        Calibrated Z-axis acceleration (m/s²)
     * @param {number} [sampleRate] Current sample rate estimate (Hz)
     */
    function push(accZ, sampleRate) {
        if (sampleRate && sampleRate > 0) _sr = sampleRate;
        _buf[_head] = accZ;
        _head = (_head + 1) & (FFT_SIZE - 1);
        if (++_hopCount >= HOP_SIZE) {
            _hopCount = 0;
            _drawColumn();
        }
    }

    /** Clear the canvas and reset the sample buffer. */
    function reset() {
        _buf.fill(0);
        _head     = 0;
        _hopCount = 0;
        if (_ctx && _canvas) {
            _ctx.fillStyle = '#0a0a0a';
            _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
        }
    }

    return { init, push, reset };
})();

/**
 * spectrogram.js
 * Role   : Real-time FFT spectrogram Canvas rendering (waterfall)
 * Input  : acc_z samples via push()
 * Output : Canvas 2D waterfall — X axis = frequency, Y axis = time (newest top)
 *
 * Algorithm  : Cooley-Tukey radix-2 DIT FFT
 * Window     : Hann (spectral leakage suppression)
 * Color map  : Viridis-style LUT (dark purple → blue → teal → yellow)
 */

const SpectrogramModule = (() => {

    // ── Config ────────────────────────────────────────────────────
    const FFT_SIZE    = 256;  // must be power of 2
    const HOP_SIZE    = 26;   // new samples per row (~90% overlap, ObsPy default)
    const MAX_FREQ    = 100;  // Hz — display ceiling (clipped to Nyquist if sr < 200)
    const WINDOW_SEC  = 10;   // must match visual.js WINDOW_SEC (row height sync)
    const LOG_MIN     = -3;   // log10 amplitude floor  (0.001 m/s²)
    const LOG_MAX     = -1;   // log10 amplitude ceiling (0.1 m/s²)
    const FREQ_AXIS_H = 18;   // pixels reserved at canvas bottom for frequency axis

    // ── State ─────────────────────────────────────────────────────
    let _canvas       = null;
    let _ctx          = null;
    let _sr           = 100;
    let _onPeak       = null;
    let _buf          = new Float32Array(FFT_SIZE);
    let _head         = 0;
    let _hopCount     = 0;
    let _hopTotal     = 0;    // hops since init (for elapsed-time labels)
    let _lastLabelSec = -2;   // last 2-second boundary that received a label

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
                    const aRe = re[i + k], aIm = im[i + k];
                    const tRe = uRe * re[i + k + half] - uIm * im[i + k + half];
                    const tIm = uRe * im[i + k + half] + uIm * re[i + k + half];
                    re[i + k]        = aRe + tRe;  im[i + k]        = aIm + tIm;
                    re[i + k + half] = aRe - tRe;  im[i + k + half] = aIm - tIm;
                    const nRe = uRe * wRe - uIm * wIm;
                    uIm = uRe * wIm + uIm * wRe;  uRe = nRe;
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
            lut[i*3]   = Math.round(stops[lo][0] + f * (stops[hi][0] - stops[lo][0]));
            lut[i*3+1] = Math.round(stops[lo][1] + f * (stops[hi][1] - stops[lo][1]));
            lut[i*3+2] = Math.round(stops[lo][2] + f * (stops[hi][2] - stops[lo][2]));
        }
        return lut;
    })();

    // ── Draw frequency axis at canvas bottom ──────────────────────
    function _drawFreqAxis() {
        if (!_canvas || !_ctx) return;
        const W = _canvas.width, H = _canvas.height, DH = H - FREQ_AXIS_H;
        const nyq = _sr / 2, dispFreq = Math.min(MAX_FREQ, nyq);

        _ctx.fillStyle = '#111';
        _ctx.fillRect(0, DH, W, FREQ_AXIS_H);

        _ctx.fillStyle = '#666';
        _ctx.font = '9px sans-serif';
        _ctx.strokeStyle = '#444';
        _ctx.lineWidth = 1;

        // Tick every 10 Hz up to dispFreq
        for (let f = 0; f <= dispFreq; f += 10) {
            const x = Math.round((f / dispFreq) * (W - 1));
            _ctx.beginPath();
            _ctx.moveTo(x, DH);
            _ctx.lineTo(x, DH + 4);
            _ctx.stroke();
            const label = f === 0 ? '0Hz' : `${f}`;
            const tw = f === 0 ? 0 : _ctx.measureText(label).width / 2;
            _ctx.fillText(label, Math.max(0, x - tw), H - 3);
        }
    }

    // ── Compute FFT and draw one waterfall row ─────────────────────
    function _drawRow() {
        if (!_canvas || !_ctx) return;
        const W = _canvas.width, H = _canvas.height, DH = H - FREQ_AXIS_H;
        if (W < 2 || DH < 2) return;

        // Windowed snapshot from ring buffer
        const re = new Float32Array(FFT_SIZE);
        const im = new Float32Array(FFT_SIZE);
        for (let i = 0; i < FFT_SIZE; i++) {
            re[i] = _buf[(_head + i) & (FFT_SIZE - 1)] * _hann[i];
        }
        _fft(re, im);

        // Frequency range: 0 → dispFreq (clipped to Nyquist)
        const nyq = _sr / 2, dispFreq = Math.min(MAX_FREQ, nyq);
        const topBin = Math.ceil(dispFreq / nyq * (FFT_SIZE / 2));

        // Build one-pixel-tall row: x maps linearly to frequency
        const rowData = new Uint8ClampedArray(W * 4);
        for (let x = 0; x < W; x++) {
            const bin  = Math.min(Math.floor((x + 0.5) / W * topBin), topBin - 1);
            const amp  = Math.sqrt(re[bin] ** 2 + im[bin] ** 2) / (FFT_SIZE / 2);
            const logA = amp > 1e-9 ? Math.log10(amp) : LOG_MIN;
            const t    = Math.max(0, Math.min(1, (logA - LOG_MIN) / (LOG_MAX - LOG_MIN)));
            const ci   = Math.round(t * 255);
            rowData[x*4]   = _lut[ci*3];
            rowData[x*4+1] = _lut[ci*3+1];
            rowData[x*4+2] = _lut[ci*3+2];
            rowData[x*4+3] = 255;
        }

        // Peak frequency callback
        if (_onPeak) {
            let maxAmp = 0, peakBin = 1;
            for (let b = 1; b < topBin; b++) {
                const a = Math.sqrt(re[b] ** 2 + im[b] ** 2);
                if (a > maxAmp) { maxAmp = a; peakBin = b; }
            }
            _onPeak(((peakBin / topBin) * dispFreq).toFixed(1));
        }

        // Row height synced with waveform 10-second window
        const rowH = Math.max(1, Math.round(DH * HOP_SIZE / (_sr * WINDOW_SEC)));

        // Expand 1px row to rowH pixels
        const imgBuf = new Uint8ClampedArray(W * rowH * 4);
        for (let y = 0; y < rowH; y++) imgBuf.set(rowData, y * W * 4);

        // Scroll spectrogram area DOWN using getImageData (avoids self-drawImage instability)
        if (DH > rowH) {
            const existing = _ctx.getImageData(0, 0, W, DH - rowH);
            _ctx.putImageData(existing, 0, rowH);
        }
        // Stamp new row at top
        _ctx.putImageData(new ImageData(imgBuf, W, rowH), 0, 0);

        // Elapsed-time label every 2 seconds
        _hopTotal++;
        const elapsedSec  = (_hopTotal * HOP_SIZE) / _sr;
        const labelSec    = Math.floor(elapsedSec / 2) * 2;
        if (labelSec > _lastLabelSec) {
            _lastLabelSec = labelSec;
            _ctx.fillStyle = 'rgba(255,255,255,0.55)';
            _ctx.font = '9px sans-serif';
            _ctx.fillText(`${labelSec}s`, 2, rowH + 9);
        }

        // Redraw frequency axis (always visible at bottom)
        _drawFreqAxis();
    }

    // ── Public API ────────────────────────────────────────────────

    function init(canvasEl, sampleRate, onPeakHz) {
        _canvas       = canvasEl;
        _ctx          = canvasEl.getContext('2d');
        _onPeak       = (typeof onPeakHz === 'function') ? onPeakHz : null;
        _hopTotal     = 0;
        _lastLabelSec = -2;
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
            _drawRow();
        }
    }

    function reset() {
        _buf.fill(0);
        _head         = 0;
        _hopCount     = 0;
        _hopTotal     = 0;
        _lastLabelSec = -2;
        if (_ctx && _canvas) {
            _ctx.fillStyle = '#0a0a0a';
            _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
            _drawFreqAxis();
        }
    }

    return { init, push, reset };
})();

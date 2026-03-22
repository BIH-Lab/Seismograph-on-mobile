/**
 * spectrogram.js  v3.0
 * Role   : Real-time FFT spectrogram Canvas rendering (horizontal waterfall)
 * Input  : acc_z samples via push()
 * Output : Canvas 2D waterfall — X axis = time (oldest left → newest right)
 *                               Y axis = frequency (0 Hz bottom → dispFreq top)
 *          Left strip (FREQ_AXIS_W px) : frequency labels
 *          Bottom strip (TIME_AXIS_H px): time labels
 *
 * Algorithm  : Cooley-Tukey radix-2 DIT FFT
 * Window     : Hann (spectral leakage suppression)
 * Color map  : Viridis-style LUT (dark purple → blue → teal → yellow)
 * Rendering  : History-based full redraw (column-per-frame, horizontal scroll)
 */

const SpectrogramModule = (() => {

    // ── Config ────────────────────────────────────────────────────
    const FFT_SIZE    = 256;  // must be power of 2
    const HOP_SIZE    = 26;   // new samples per FFT frame (~90% overlap)
    const MAX_FREQ    = 100;  // Hz display ceiling; clipped to Nyquist at runtime
    const WINDOW_SEC  = 30;   // seconds of history kept and displayed
    const LOG_MIN     = -3;   // log10 amplitude floor  (0.001 m/s²)
    const LOG_MAX     = -1;   // log10 amplitude ceiling (0.1 m/s²)
    const FREQ_AXIS_W = 30;   // px reserved at left for frequency labels
    const TIME_AXIS_H = 12;   // px reserved at bottom for time labels

    // ── State ─────────────────────────────────────────────────────
    let _canvas  = null;
    let _ctx     = null;
    let _sr      = 100;
    let _onPeak  = null;
    let _buf     = new Float32Array(FFT_SIZE);  // ring buffer
    let _head    = 0;
    let _hopCount = 0;
    // History: newest = index 0 = rightmost column
    const _history = [];  // each entry: { colData: Uint8ClampedArray(DH×4) }

    // Review mode state
    let _reviewing  = false;
    let _viewOffset = 0;   // index into _history[] of rightmost visible column
    let _viewCols   = 0;   // number of columns to display in review

    // Offscreen 1-px-wide canvas for efficient column scaling
    let _tmpCanvas = null;
    let _tmpCtx    = null;

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
                    re[i+k]      = aRe+tRe;  im[i+k]      = aIm+tIm;
                    re[i+k+half] = aRe-tRe;  im[i+k+half] = aIm-tIm;
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

    // ── Compute 1-px column from current ring buffer ──────────────
    // DH = spectrogram height in pixels (H - TIME_AXIS_H)
    // Y=0 = top = MAX_FREQ, Y=DH-1 = bottom = 0 Hz
    function _computeCol(DH) {
        const re = new Float32Array(FFT_SIZE);
        const im = new Float32Array(FFT_SIZE);
        for (let i = 0; i < FFT_SIZE; i++) {
            re[i] = _buf[(_head + i) & (FFT_SIZE - 1)] * _hann[i];
        }
        _fft(re, im);

        const nyq      = _sr / 2;
        const dispFreq = Math.min(MAX_FREQ, nyq);
        const topBin   = Math.ceil(dispFreq / nyq * (FFT_SIZE / 2));

        const colData = new Uint8ClampedArray(DH * 4);
        for (let y = 0; y < DH; y++) {
            // map pixel row y → frequency bin (y=0 = top = highest freq)
            const bin = Math.min(Math.floor((1 - (y + 0.5) / DH) * topBin), topBin - 1);
            const amp  = Math.sqrt(re[bin]**2 + im[bin]**2) / (FFT_SIZE / 2);
            const logA = amp > 1e-9 ? Math.log10(amp) : LOG_MIN;
            const t    = Math.max(0, Math.min(1, (logA - LOG_MIN) / (LOG_MAX - LOG_MIN)));
            const ci   = Math.round(t * 255);
            colData[y*4]   = _lut[ci*3];
            colData[y*4+1] = _lut[ci*3+1];
            colData[y*4+2] = _lut[ci*3+2];
            colData[y*4+3] = 255;
        }

        // Peak frequency
        let maxAmp = 0, peakBin = 1;
        for (let b = 1; b < topBin; b++) {
            const a = Math.sqrt(re[b]**2 + im[b]**2);
            if (a > maxAmp) { maxAmp = a; peakBin = b; }
        }
        return { colData, peakHz: (peakBin / topBin) * dispFreq };
    }

    // ── Ensure offscreen 1×DH canvas exists and matches DH ────────
    function _ensureTmp(DH) {
        if (!_tmpCanvas || _tmpCanvas.height !== DH) {
            _tmpCanvas = document.createElement('canvas');
            _tmpCanvas.width  = 1;
            _tmpCanvas.height = DH;
            _tmpCtx = _tmpCanvas.getContext('2d');
        }
    }

    // ── Redraw entire canvas from history ─────────────────────────
    function _redrawCanvas() {
        if (!_canvas || !_ctx) return;
        const W  = _canvas.width;
        const H  = _canvas.height;
        const SW = W - FREQ_AXIS_W;   // spectrogram area width
        const DH = H - TIME_AXIS_H;   // spectrogram area height
        if (SW < 2 || DH < 2) return;

        const M = (_sr * WINDOW_SEC) / HOP_SIZE;  // frames in full window
        const N = _history.length;

        // Clear spectrogram area
        _ctx.fillStyle = '#0a0a0a';
        _ctx.fillRect(FREQ_AXIS_W, 0, SW, DH);

        let drawFrom, drawCount, displayCols;
        if (_reviewing) {
            drawFrom    = _viewOffset;
            drawCount   = Math.min(_viewCols, N - _viewOffset);
            displayCols = _viewCols;
        } else {
            drawFrom    = 0;
            drawCount   = N;
            displayCols = Math.max(1, Math.min(N, M));
        }

        // Draw columns: index 0 = newest = rightmost
        _ensureTmp(DH);
        _ctx.imageSmoothingEnabled = false;
        for (let i = 0; i < drawCount; i++) {
            const { colData } = _history[drawFrom + i];
            // x range: newest (i=0) at right, oldest at left
            const x1 = FREQ_AXIS_W + Math.round((1 - i / displayCols) * SW);
            const x0 = FREQ_AXIS_W + Math.round((1 - (i + 1) / displayCols) * SW);
            const w  = Math.max(1, x1 - x0);
            if (x1 <= FREQ_AXIS_W) break;
            _tmpCtx.putImageData(new ImageData(colData, 1, DH), 0, 0);
            _ctx.drawImage(_tmpCanvas, x0, 0, w, DH);
        }

        _drawFreqAxis(DH);
        _drawTimeAxis(SW, DH, displayCols);
    }

    // ── Draw frequency axis on the left strip ──────────────────────
    function _drawFreqAxis(DH) {
        if (!_canvas || !_ctx) return;
        const dispFreq = Math.min(MAX_FREQ, _sr / 2);
        _ctx.fillStyle = '#111';
        _ctx.fillRect(0, 0, FREQ_AXIS_W, DH);
        _ctx.fillStyle   = '#666';
        _ctx.font        = '9px sans-serif';
        _ctx.strokeStyle = '#444';
        _ctx.lineWidth   = 1;
        _ctx.textAlign   = 'right';

        const step = dispFreq <= 25 ? 5 : 25;
        for (let f = 0; f <= dispFreq; f += step) {
            const y = Math.round((1 - f / dispFreq) * DH);
            _ctx.beginPath();
            _ctx.moveTo(FREQ_AXIS_W - 4, y);
            _ctx.lineTo(FREQ_AXIS_W, y);
            _ctx.stroke();
            const label = f === 0 ? '0' : `${f}`;
            _ctx.fillText(label, FREQ_AXIS_W - 6, Math.min(y + 3, DH - 2));
        }
        // "Hz" rotated label
        _ctx.save();
        _ctx.fillStyle = '#555';
        _ctx.translate(8, DH / 2);
        _ctx.rotate(-Math.PI / 2);
        _ctx.textAlign = 'center';
        _ctx.fillText('Hz', 0, 0);
        _ctx.restore();
        _ctx.textAlign = 'left';
    }

    // ── Draw time axis at bottom strip ────────────────────────────
    function _drawTimeAxis(SW, DH, displayCols) {
        if (!_canvas || !_ctx) return;
        const W = _canvas.width;
        const H = _canvas.height;
        _ctx.fillStyle = '#111';
        _ctx.fillRect(FREQ_AXIS_W, DH, SW, TIME_AXIS_H);
        _ctx.fillStyle   = '#555';
        _ctx.font        = '9px sans-serif';
        _ctx.strokeStyle = '#333';
        _ctx.lineWidth   = 1;
        _ctx.textAlign   = 'center';

        const totalSec  = displayCols * HOP_SIZE / _sr;
        const labelStep = totalSec <= 10 ? 2 : totalSec <= 30 ? 5 : 10;

        for (let sec = 0; sec <= Math.ceil(totalSec); sec += labelStep) {
            const frac = sec / Math.max(totalSec, 1);
            const x    = FREQ_AXIS_W + Math.round((1 - frac) * SW);
            if (x < FREQ_AXIS_W) continue;
            _ctx.beginPath();
            _ctx.moveTo(x, DH);
            _ctx.lineTo(x, DH + 3);
            _ctx.stroke();
            const lbl = sec === 0 ? '0s' : `-${sec}s`;
            _ctx.fillText(lbl, Math.max(FREQ_AXIS_W + 12, Math.min(x, W - 12)), H - 2);
        }
        _ctx.textAlign = 'left';
    }

    // ── Public API ────────────────────────────────────────────────

    function init(canvasEl, sampleRate, onPeakHz) {
        _canvas   = canvasEl;
        _ctx      = canvasEl.getContext('2d');
        _onPeak   = (typeof onPeakHz === 'function') ? onPeakHz : null;
        _history.length = 0;
        _reviewing  = false;
        _viewOffset = 0;
        _viewCols   = 0;
        if (sampleRate && sampleRate > 0) _sr = sampleRate;

        _canvas.width  = _canvas.clientWidth  || 300;
        _canvas.height = _canvas.clientHeight || 150;

        _ctx.fillStyle = '#0a0a0a';
        _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
        _drawFreqAxis(_canvas.height - TIME_AXIS_H);
    }

    function push(accZ, sampleRate) {
        if (_reviewing) return;
        if (sampleRate && sampleRate > 0) _sr = sampleRate;
        _buf[_head] = accZ;
        _head = (_head + 1) & (FFT_SIZE - 1);
        if (++_hopCount >= HOP_SIZE) {
            _hopCount = 0;
            if (!_canvas) return;
            const DH = _canvas.height - TIME_AXIS_H;
            if (DH < 2) return;
            const { colData, peakHz } = _computeCol(DH);
            if (_onPeak) _onPeak(peakHz.toFixed(1));
            _history.unshift({ colData });  // newest first
            const maxFrames = Math.ceil(_sr * WINDOW_SEC / HOP_SIZE) + 1;
            if (_history.length > maxFrames) _history.length = maxFrames;
            _redrawCanvas();
        }
    }

    function reset() {
        _buf.fill(0);
        _head     = 0;
        _hopCount = 0;
        _history.length = 0;
        _reviewing  = false;
        _viewOffset = 0;
        _viewCols   = 0;
        if (_ctx && _canvas) {
            _ctx.fillStyle = '#0a0a0a';
            _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
            _drawFreqAxis(_canvas.height - TIME_AXIS_H);
        }
    }

    /** Freeze live mode; preserve history for pan/zoom exploration. */
    function startReview() {
        _reviewing  = true;
        const M = Math.ceil(_sr * WINDOW_SEC / HOP_SIZE);
        _viewOffset = 0;
        _viewCols   = Math.min(_history.length, M);
        _redrawCanvas();
    }

    /**
     * Set the review viewport.
     * @param {number} offset  index into _history[] of rightmost visible column
     * @param {number} cols    number of history columns to display
     */
    function setView(offset, cols) {
        const N = _history.length;
        _viewOffset = Math.max(0, Math.min(offset, N - 1));
        _viewCols   = Math.max(1, Math.min(cols, N - _viewOffset));
        _redrawCanvas();
    }

    function historyLength() {
        return _history.length;
    }

    return { init, push, reset, startReview, setView, historyLength };
})();

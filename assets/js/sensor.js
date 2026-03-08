/**
 * sensor.js
 * Role    : DeviceMotionEvent reception and data normalization
 * Output  : { timestamp, acc_x, acc_y, acc_z, magnitude }
 * Note    : Includes iOS permission request handling
 */

const SensorModule = (() => {
    let _onData    = null;
    let _onStatus  = null;   // optional status callback ('calibrating' | 'ready')
    let _running   = false;

    // ── Calibration ───────────────────────────────────────────────
    const CALIB_SAMPLES = 30;
    let _calibBuf = [];          // raw samples during calibration
    let _baseline = null;        // { x, y, z } mean to subtract

    function _resetCalib() {
        _calibBuf = [];
        _baseline = null;
    }

    // ── Normalize one DeviceMotionEvent ──────────────────────────
    function _handleMotion(event) {
        if (!_running) return;

        // Prefer gravity-removed acceleration; fall back to including-gravity
        const a = (event.acceleration && event.acceleration.x != null)
            ? event.acceleration
            : event.accelerationIncludingGravity || {};

        const raw_x = a.x ?? 0;
        const raw_y = a.y ?? 0;
        const raw_z = a.z ?? 0;

        // ── Calibration phase: collect baseline ──────────────────
        if (_baseline === null) {
            _calibBuf.push({ x: raw_x, y: raw_y, z: raw_z });
            if (_onStatus) _onStatus('calibrating', _calibBuf.length, CALIB_SAMPLES);

            if (_calibBuf.length >= CALIB_SAMPLES) {
                const sum = _calibBuf.reduce(
                    (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y, z: acc.z + v.z }),
                    { x: 0, y: 0, z: 0 }
                );
                _baseline = {
                    x: sum.x / CALIB_SAMPLES,
                    y: sum.y / CALIB_SAMPLES,
                    z: sum.z / CALIB_SAMPLES,
                };
                if (_onStatus) _onStatus('ready');
            }
            return;   // don't emit data during calibration
        }

        // ── Normal phase: subtract baseline ──────────────────────
        const acc_x = raw_x - _baseline.x;
        const acc_y = raw_y - _baseline.y;
        const acc_z = raw_z - _baseline.z;

        const magnitude = Math.sqrt(acc_x ** 2 + acc_y ** 2 + acc_z ** 2);

        const data = {
            timestamp : new Date().toISOString(),
            acc_x     : parseFloat(acc_x.toFixed(6)),
            acc_y     : parseFloat(acc_y.toFixed(6)),
            acc_z     : parseFloat(acc_z.toFixed(6)),
            magnitude : parseFloat(magnitude.toFixed(6)),
        };

        if (_onData) _onData(data);
    }

    // ── Request permission (iOS 13+) ─────────────────────────────
    function _requestPermission() {
        return new Promise((resolve, reject) => {
            if (typeof DeviceMotionEvent === 'undefined') {
                reject(new Error('DeviceMotionEvent를 지원하지 않는 브라우저입니다.'));
                return;
            }

            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                // iOS Safari 13+
                DeviceMotionEvent.requestPermission()
                    .then(state => {
                        if (state === 'granted') resolve();
                        else reject(new Error('센서 권한이 거부되었습니다.\n설정 > Safari > 동작 및 방향 접근을 허용해주세요.'));
                    })
                    .catch(reject);
            } else {
                // Android Chrome / other browsers — no permission needed
                resolve();
            }
        });
    }

    // ── Public API ───────────────────────────────────────────────

    /**
     * Start sensor.
     * @param {function} onData  Called with each data point
     * @param {function} onError Called if permission is denied
     */
    /**
     * Start sensor.
     * @param {function} onData    Called with each calibrated data point
     * @param {function} onError   Called if permission is denied
     * @param {function} onStatus  Called with ('calibrating', current, total) | ('ready')
     */
    function start(onData, onError, onStatus) {
        if (_running) return;

        _onData   = onData;
        _onStatus = onStatus || null;
        _resetCalib();

        _requestPermission()
            .then(() => {
                _running = true;
                window.addEventListener('devicemotion', _handleMotion);
            })
            .catch(err => {
                if (onError) onError(err.message);
            });
    }

    /** Stop sensor. */
    function stop() {
        if (!_running) return;
        _running = false;
        window.removeEventListener('devicemotion', _handleMotion);
        _onData   = null;
        _onStatus = null;
        _resetCalib();
    }

    /** Whether sensor is currently running. */
    function isRunning() {
        return _running;
    }

    return { start, stop, isRunning };
})();

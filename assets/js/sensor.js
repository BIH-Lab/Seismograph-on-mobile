/**
 * sensor.js
 * Role    : Accelerometer data collection and calibration
 * Output  : { timestamp, acc_x, acc_y, acc_z, magnitude, interval_ms }
 *
 * Sensor source priority:
 *   1. Generic Sensor API (Accelerometer class)
 *        → Android Chrome 67+ — direct hardware ADC, no browser rounding
 *   2. DeviceMotionEvent (accelerationIncludingGravity)
 *        → iOS Safari, older browsers — limited to ~0.1 m/s² precision by Chrome policy
 *
 * Note: iOS DeviceMotionEvent requires user-gesture permission request (Safari 13+).
 *       Android Chrome does not require explicit permission for Generic Sensor API.
 */

const SensorModule = (() => {
    let _onData       = null;
    let _onStatus     = null;
    let _running      = false;
    let _sensorSource = null;   // 'generic' | 'devicemotion' | null

    // ── Calibration ───────────────────────────────────────────────
    const CALIB_SAMPLES = 5;
    let _calibBuf = [];
    let _baseline = null;
    let _lastTs   = null;   // for interval_ms estimation in Generic Sensor path

    function _resetCalib() {
        _calibBuf     = [];
        _baseline     = null;
        _lastTs       = null;
        _sensorSource = null;
    }

    // ── Generic Sensor API handle ─────────────────────────────────
    let _accelSensor = null;

    // ── Shared processing (both paths call this) ──────────────────
    function _processRaw(raw, interval_ms) {
        // Calibration phase: accumulate baseline
        if (_baseline === null) {
            _calibBuf.push(raw);
            if (_onStatus) _onStatus('calibrating', _calibBuf.length, CALIB_SAMPLES);

            if (_calibBuf.length >= CALIB_SAMPLES) {
                const sum = _calibBuf.reduce(
                    (s, v) => ({ x: s.x + v.x, y: s.y + v.y, z: s.z + v.z }),
                    { x: 0, y: 0, z: 0 }
                );
                _baseline = {
                    x: sum.x / CALIB_SAMPLES,
                    y: sum.y / CALIB_SAMPLES,
                    z: sum.z / CALIB_SAMPLES,
                };
                if (_onStatus) _onStatus('ready', _sensorSource);
            }
            return;
        }

        // Normal phase: subtract baseline
        const acc_x     = raw.x - _baseline.x;
        const acc_y     = raw.y - _baseline.y;
        const acc_z     = raw.z - _baseline.z;
        const magnitude = Math.sqrt(acc_x ** 2 + acc_y ** 2 + acc_z ** 2);

        if (_onData) _onData({
            timestamp   : new Date().toISOString(),
            acc_x,
            acc_y,
            acc_z,
            magnitude,
            interval_ms,
        });
    }

    // ── Path 1: Generic Sensor API (Android Chrome) ───────────────
    function _startGeneric(onError) {
        try {
            _accelSensor = new Accelerometer({ frequency: 100 });

            _accelSensor.addEventListener('reading', () => {
                if (!_running) return;
                if (_sensorSource === null) _sensorSource = 'generic';
                const now      = performance.now();
                const interval = _lastTs !== null ? now - _lastTs : null;
                _lastTs = now;
                _processRaw(
                    { x: _accelSensor.x, y: _accelSensor.y, z: _accelSensor.z },
                    interval
                );
            });

            _accelSensor.addEventListener('error', () => {
                // Any error (NotAllowedError, NotReadableError, etc.) → fall back to DeviceMotionEvent
                _accelSensor = null;
                _startDeviceMotion(onError);
            });

            _accelSensor.start();
            _running = true;

        } catch (e) {
            // Accelerometer constructor failed (e.g. SecurityError) — fall back
            _accelSensor = null;
            _startDeviceMotion(onError);
        }
    }

    // ── Path 2: DeviceMotionEvent (iOS Safari / fallback) ─────────
    function _handleMotion(event) {
        if (!_running) return;

        // Prefer raw hardware values (accelerationIncludingGravity)
        const aG = event.accelerationIncludingGravity;
        let raw = null;
        if (aG && aG.x != null && aG.y != null && aG.z != null) {
            raw = { x: aG.x, y: aG.y, z: aG.z };
        } else {
            const a = event.acceleration;
            if (a && a.x != null && a.y != null && a.z != null) {
                raw = { x: a.x, y: a.y, z: a.z };
            }
        }

        if (!raw) {
            if (_onStatus) _onStatus('unavailable');
            return;
        }

        _processRaw(raw, event.interval || null);
    }

    function _startDeviceMotion(onError) {
        _requestiOSPermission()
            .then(() => {
                _sensorSource = 'devicemotion';
                _running = true;
                window.addEventListener('devicemotion', _handleMotion);
            })
            .catch(err => {
                if (onError) onError(err.message);
            });
    }

    // ── iOS 13+ permission request ────────────────────────────────
    function _requestiOSPermission() {
        return new Promise((resolve, reject) => {
            if (typeof DeviceMotionEvent === 'undefined') {
                reject(new Error('DeviceMotionEvent를 지원하지 않는 브라우저입니다.'));
                return;
            }
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                DeviceMotionEvent.requestPermission()
                    .then(state => {
                        if (state === 'granted') resolve();
                        else reject(new Error('센서 권한이 거부되었습니다.\n설정 > Safari > 동작 및 방향 접근을 허용해주세요.'));
                    })
                    .catch(reject);
            } else {
                resolve();
            }
        });
    }

    // ── Public API ────────────────────────────────────────────────

    /**
     * Start sensor.
     * Tries Generic Sensor API first; falls back to DeviceMotionEvent.
     * @param {function} onData    Called with each calibrated data point
     * @param {function} onError   Called if permission is denied or sensor unavailable
     * @param {function} onStatus  Called with ('calibrating', current, total) | ('ready', source) | ('unavailable')
     *                             source: 'generic' (Generic Sensor API) | 'devicemotion' (DeviceMotionEvent)
     */
    function start(onData, onError, onStatus) {
        if (_running) return;
        _onData   = onData;
        _onStatus = onStatus || null;
        _resetCalib();

        if (typeof Accelerometer !== 'undefined') {
            _startGeneric(onError);     // Android Chrome — high precision
        } else {
            _startDeviceMotion(onError); // iOS Safari / fallback
        }
    }

    /** Stop sensor and release all resources. */
    function stop() {
        if (!_running) return;
        _running = false;

        if (_accelSensor) {
            _accelSensor.stop();
            _accelSensor = null;
        }
        window.removeEventListener('devicemotion', _handleMotion);

        _onData   = null;
        _onStatus = null;
        _resetCalib();
    }

    /** Whether sensor is currently running. */
    function isRunning() { return _running; }

    return { start, stop, isRunning };
})();

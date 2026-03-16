/**
 * sensor.js
 * Role    : Accelerometer data collection and calibration
 * Output  : { timestamp, acc_x, acc_y, acc_z, magnitude, interval_ms }
 *
 * Sensor source priority:
 *   1. LinearAccelerationSensor  → Android Chrome 67+ with gyroscope fusion (highest precision)
 *   2. Accelerometer             → Android Chrome 67+, gravity-inclusive but calibrated (high precision)
 *   3. DeviceMotionEvent         → iOS Safari / fallback (limited to ~0.1 m/s² by Chrome policy)
 *
 * Note: iOS DeviceMotionEvent requires user-gesture permission request (Safari 13+).
 *       Android Chrome does not require explicit permission for Generic Sensor API.
 */

const SensorModule = (() => {
    let _onData       = null;
    let _onStatus     = null;
    let _running      = false;
    let _sensorSource = null;   // 'linear' | 'accel' | 'devicemotion' | null

    // ── Calibration ───────────────────────────────────────────────
    const WARMUP_MS     = 3000; // discard samples for 3 s after start (absorb touch vibration)
    const CALIB_SAMPLES = 100;  // 100Hz × 1s — stabilisation window to exclude startup noise
    let _warmupStart = null;
    let _calibBuf = [];
    let _baseline = null;
    let _lastTs   = null;   // for interval_ms estimation in Generic Sensor path

    function _resetCalib() {
        _warmupStart  = null;
        _calibBuf     = [];
        _baseline     = null;
        _lastTs       = null;
        _sensorSource = null;
    }

    // ── Generic Sensor API handle ─────────────────────────────────
    let _accelSensor = null;

    // ── Shared processing (both paths call this) ──────────────────
    function _processRaw(raw, interval_ms, tsMs) {
        // Warm-up phase: discard samples for WARMUP_MS after first reading
        if (_warmupStart === null) _warmupStart = tsMs;
        const elapsed = tsMs - _warmupStart;
        if (elapsed < WARMUP_MS) {
            if (_onStatus) _onStatus('warmup', Math.ceil((WARMUP_MS - elapsed) / 1000));
            return;
        }

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
            timestamp   : new Date(tsMs).toISOString(),
            acc_x,
            acc_y,
            acc_z,
            magnitude,
            interval_ms,
        });
    }

    // ── Path 1 & 2: Generic Sensor API (Android Chrome) ──────────
    // type: 'linear' → LinearAccelerationSensor (gravity removed by OS fusion)
    //       'accel'  → Accelerometer (raw hardware, gravity included, removed by calibration)
    function _startGeneric(type, onError) {
        try {
            _accelSensor = type === 'linear'
                ? new LinearAccelerationSensor({ frequency: 100 })
                : new Accelerometer({ frequency: 100 });

            _accelSensor.addEventListener('reading', () => {
                if (!_running) return;
                if (_sensorSource === null) _sensorSource = type;
                const now      = performance.now();
                const interval = _lastTs !== null ? now - _lastTs : null;
                _lastTs = now;
                _processRaw(
                    { x: _accelSensor.x, y: _accelSensor.y, z: _accelSensor.z },
                    interval,
                    performance.timeOrigin + now
                );
            });

            _accelSensor.addEventListener('error', () => {
                _accelSensor = null;
                // linear fails → try plain Accelerometer before giving up
                if (type === 'linear' && typeof Accelerometer !== 'undefined') {
                    _startGeneric('accel', onError);
                } else {
                    _startDeviceMotion(onError);
                }
            });

            _accelSensor.start();
            _running = true;

        } catch (e) {
            _accelSensor = null;
            if (type === 'linear' && typeof Accelerometer !== 'undefined') {
                _startGeneric('accel', onError);
            } else {
                _startDeviceMotion(onError);
            }
        }
    }

    // ── Path 3: DeviceMotionEvent (iOS Safari / fallback) ─────────
    function _handleMotion(event) {
        if (!_running) return;

        // Prefer gravity-free values (consistent with LinearAccelerationSensor)
        const a = event.acceleration;
        let raw = null;
        if (a && a.x != null && a.y != null && a.z != null) {
            raw = { x: a.x, y: a.y, z: a.z };
        } else {
            const aG = event.accelerationIncludingGravity;
            if (aG && aG.x != null && aG.y != null && aG.z != null) {
                raw = { x: aG.x, y: aG.y, z: aG.z };
            }
        }

        if (!raw) {
            if (_onStatus) _onStatus('unavailable');
            return;
        }

        _processRaw(raw, event.interval || null, performance.timeOrigin + performance.now());
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
     * Priority: LinearAccelerationSensor → Accelerometer → DeviceMotionEvent
     * @param {function} onData    Called with each calibrated data point
     * @param {function} onError   Called if permission is denied or sensor unavailable
     * @param {function} onStatus  Called with ('warmup', remainingSec) | ('calibrating', current, total) | ('ready', source) | ('unavailable')
     *                             source: 'linear' | 'accel' | 'devicemotion'
     */
    function start(onData, onError, onStatus) {
        if (_running) return;
        _onData   = onData;
        _onStatus = onStatus || null;
        _resetCalib();

        if (typeof LinearAccelerationSensor !== 'undefined') {
            _startGeneric('linear', onError);   // Android Chrome — highest precision
        } else if (typeof Accelerometer !== 'undefined') {
            _startGeneric('accel', onError);    // Android Chrome — high precision
        } else {
            _startDeviceMotion(onError);        // iOS Safari / fallback
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

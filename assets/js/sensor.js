/**
 * sensor.js
 * Role    : DeviceMotionEvent reception and data normalization
 * Output  : { timestamp, acc_x, acc_y, acc_z, magnitude }
 * Note    : Includes iOS permission request handling
 */

const SensorModule = (() => {
    let _onData = null;   // callback set by caller
    let _running = false;

    // ── Normalize one DeviceMotionEvent ──────────────────────────
    function _handleMotion(event) {
        if (!_running) return;

        const a = event.accelerationIncludingGravity || {};
        const acc_x = a.x ?? 0;
        const acc_y = a.y ?? 0;
        const acc_z = a.z ?? 0;

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
    function start(onData, onError) {
        if (_running) return;

        _onData = onData;

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
        _onData = null;
    }

    /** Whether sensor is currently running. */
    function isRunning() {
        return _running;
    }

    return { start, stop, isRunning };
})();

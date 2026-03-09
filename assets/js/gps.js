/**
 * gps.js
 * Role   : Get device GPS coordinates once at measurement start
 * Output : { latitude, longitude, accuracy }
 */

const GpsModule = (() => {

    let _coords = null;

    /**
     * Request GPS permission and get current position (one-shot).
     * @returns {Promise<{ latitude, longitude, accuracy }>}
     */
    function get() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('이 브라우저는 GPS를 지원하지 않습니다.'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    _coords = {
                        latitude  : parseFloat(pos.coords.latitude.toFixed(6)),
                        longitude : parseFloat(pos.coords.longitude.toFixed(6)),
                        accuracy  : Math.round(pos.coords.accuracy),
                    };
                    resolve(_coords);
                },
                (err) => {
                    // err.code: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
                    const msg = err.code === 1
                        ? 'GPS 권한이 거부되었습니다. Safari 설정 > 개인정보 보호 > 위치 서비스를 허용해주세요.'
                        : err.code === 3
                        ? 'GPS 신호를 찾는 데 시간이 초과되었습니다. 실외로 이동 후 다시 시도해주세요.'
                        : 'GPS 위치를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.';
                    reject(new Error(msg));
                },
                { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
            );
        });
    }

    /** Return last fetched coordinates (null if not yet fetched). */
    function coords() {
        return _coords;
    }

    /** Clear stored coordinates. */
    function clear() {
        _coords = null;
    }

    return { get, coords, clear };
})();

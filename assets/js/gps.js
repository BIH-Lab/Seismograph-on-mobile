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

            const isFirefox = navigator.userAgent.includes('Firefox');
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
                        ? 'GPS 권한이 거부되었습니다.\n해결: iPhone 설정 앱 → 개인정보 보호 및 보안 → 위치 서비스 → Safari 웹사이트 → "앱을 사용하는 동안" 선택'
                        : err.code === 3
                        ? `GPS 신호를 찾는 데 시간이 초과되었습니다.${isFirefox ? ' Firefox는 시간이 더 걸릴 수 있습니다.' : ''} 잠시 후 다시 시도해주세요.`
                        : 'GPS 위치를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.';
                    reject(new Error(msg));
                },
                { enableHighAccuracy: false, timeout: isFirefox ? 20000 : 10000, maximumAge: 300000 }
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

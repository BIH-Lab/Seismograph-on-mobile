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
                () => {
                    reject(new Error('GPS 권한이 거부되었거나 위치를 찾을 수 없습니다.'));
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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

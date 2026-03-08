/**
 * export.js
 * Role   : Store collected data in memory and export as CSV
 * Output : timestamp, acc_x, acc_y, acc_z, magnitude
 */

const ExportModule = (() => {

    const _rows = [];   // Array of data objects

    // ── Public API ────────────────────────────────────────────────

    /**
     * Record one data point.
     * Called by activity1/index.html for every sensor event.
     * @param {{ timestamp, acc_x, acc_y, acc_z, magnitude }} data
     */
    function record(data) {
        _rows.push(data);
    }

    /**
     * Convert stored rows to CSV and trigger browser download.
     * Filename: seismograph_YYYY-MM-DD_HH-MM-SS.csv
     */
    function download() {
        if (_rows.length === 0) {
            alert('저장된 데이터가 없습니다. 측정 후 다운로드해주세요.');
            return;
        }

        const header = 'timestamp,acc_x,acc_y,acc_z,magnitude\n';
        const body   = _rows
            .map(r => `${r.timestamp},${r.acc_x},${r.acc_y},${r.acc_z},${r.magnitude}`)
            .join('\n');

        const blob     = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
        const url      = URL.createObjectURL(blob);
        const filename = _filename();

        // iOS Safari does not support <a download> — open in new tab instead
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
            const win = window.open(url, '_blank');
            if (win) {
                win.document.title = filename;
            } else {
                alert('팝업이 차단되었습니다. Safari 설정에서 팝업 허용 후 다시 시도해주세요.');
            }
            // Revoke after a delay to ensure the blob is loaded
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            return;
        }

        // Android / Desktop — standard download
        const a = document.createElement('a');
        a.href  = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Delay revocation so mobile browsers finish initiating the download
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    /** Clear stored data (call when starting a new session). */
    function clear() {
        _rows.length = 0;
    }

    /** Number of recorded rows. */
    function count() {
        return _rows.length;
    }

    // ── Helper ────────────────────────────────────────────────────
    function _filename() {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
        return `seismograph_${date}_${time}.csv`;
    }

    return { record, download, clear, count };
})();

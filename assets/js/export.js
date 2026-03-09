/**
 * export.js
 * Role   : Store collected data in memory and export as CSV
 * Output : CSV columns are derived automatically from the first recorded row
 */

const ExportModule = (() => {

    const _rows = [];   // Array of data objects

    // ── Public API ────────────────────────────────────────────────

    /**
     * Record one data point.
     * @param {Object} data  Any flat object (keys become CSV columns)
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

        const keys   = Object.keys(_rows[0]);
        const header = keys.join(',') + '\n';
        const body   = _rows
            .map(r => keys.map(k => r[k]).join(','))
            .join('\n');

        const csvContent = header + body;
        const filename   = _filename();

        // ── 1순위: File System Access API — 데스크톱 전용
        //    모바일에서는 Web Share API가 더 안정적이므로 건너뜀
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        if (!isMobile && window.showSaveFilePicker) {
            window.showSaveFilePicker({
                suggestedName: filename,
                types: [{ description: 'CSV 파일', accept: { 'text/csv': ['.csv'] } }],
            })
            .then(async fileHandle => {
                const writable = await fileHandle.createWritable();
                await writable.write(csvContent);
                await writable.close();
            })
            .catch(err => {
                // 사용자가 취소한 경우(AbortError)는 무시
                if (err.name !== 'AbortError') {
                    console.warn('showSaveFilePicker failed, falling back', err);
                    _shareOrDownload(csvContent, filename);
                }
            });
            return;
        }

        // ── 2순위 이하
        _shareOrDownload(csvContent, filename);
    }

    /** Clear stored data (call when starting a new session). */
    function clear() {
        _rows.length = 0;
    }

    /** Number of recorded rows. */
    function count() {
        return _rows.length;
    }

    // ── Helpers ───────────────────────────────────────────────────

    // 2순위: Web Share API (iOS 15+ / Android)
    // 3순위: <a download> (구형 브라우저)
    function _shareOrDownload(csvContent, filename) {
        const file = new File([csvContent], filename, { type: 'text/csv;charset=utf-8;' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: filename })
                .catch(err => {
                    if (err.name !== 'AbortError') _fallbackDownload(csvContent, filename);
                });
            return;
        }
        _fallbackDownload(csvContent, filename);
    }

    function _fallbackDownload(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    function _filename() {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
        return `seismograph_${date}_${time}.csv`;
    }

    return { record, download, clear, count };
})();

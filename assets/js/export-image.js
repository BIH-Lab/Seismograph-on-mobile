// ImageExportModule v1.0
// ObsPy-style PNG export: dark metadata header + canvas graph body
const ImageExportModule = (() => {
    const HEADER_H = 56;
    const MIN_W    = 800;

    function download(srcCanvas, meta) {
        const scale = Math.max(1, MIN_W / srcCanvas.width);
        const W = Math.round(srcCanvas.width  * scale);
        const H = Math.round(srcCanvas.height * scale) + HEADER_H;

        const off = document.createElement('canvas');
        off.width  = W;
        off.height = H;
        const ctx  = off.getContext('2d');

        // dark header
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, W, HEADER_H);

        // title: "STN-01  ·  Z-axis  ·  100 Hz"
        ctx.fillStyle = '#f0f0f0';
        ctx.font = 'bold 15px "Courier New", monospace';
        ctx.fillText(meta.title, 12, 22);

        // subtitle: "PSD (Welch)  ·  2026-04-04T12:34:56Z  ·  0.1–50 Hz"
        ctx.font = '12px "Courier New", monospace';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(meta.subtitle, 12, 42);

        // separator line
        ctx.strokeStyle = '#444444';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(0, HEADER_H - 2);
        ctx.lineTo(W, HEADER_H - 2);
        ctx.stroke();

        // graph body (scale up to MIN_W)
        ctx.drawImage(srcCanvas, 0, HEADER_H, W, Math.round(srcCanvas.height * scale));

        // trigger download
        const a = document.createElement('a');
        a.href     = off.toDataURL('image/png');
        a.download = meta.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    return { download };
})();

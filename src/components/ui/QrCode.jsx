import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/**
 * A high-contrast QR for printing and scanning.
 *
 * The four-module quiet zone is part of the image itself, not only of the
 * surrounding card: cameras need white space around the code, and the printed
 * pass is often cropped or photographed at an angle.
 */
export default function QrCode({ value, label, className = '', quiet = 4 }) {
  const { size, path, valid } = useMemo(() => {
    if (!value || typeof value !== 'string' || !value.trim()) {
      return { size: 0, path: '', valid: false };
    }
    try {
      const qr = qrcode(0, 'M');
      qr.addData(value.trim());
      qr.make();

      const count = qr.getModuleCount();
      let d = '';
      for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
          if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
        }
      }
      return { size: count, path: d, valid: true };
    } catch (err) {
      console.warn('[Ma5sos QR] Generation error:', err);
      return { size: 0, path: '', valid: false };
    }
  }, [value]);

  if (!valid || size === 0) {
    return (
      <div className={`qr-fallback ${className}`} role="img" aria-label="رمز الدخول غير متوفر">
        <span>رمز الدخول غير متوفر</span>
      </div>
    );
  }

  const box = size + quiet * 2;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${box} ${box}`}
      width="100%"
      height="100%"
      shapeRendering="crispEdges"
      role="img"
      aria-label={label ?? 'رمز QR لتذكرة الضيف'}
    >
      <rect width={box} height={box} fill="#ffffff" />
      <g transform={`translate(${quiet} ${quiet})`}>
        <path d={path} fill="#000000" />
      </g>
    </svg>
  );
}

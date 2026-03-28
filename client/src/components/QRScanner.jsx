import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function QRScanner({ onScan, onError }) {
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraId, setCameraId] = useState(null);
  const [cameras, setCameras] = useState([]);
  const lastScannedRef = useRef('');
  const cooldownRef = useRef(false);

  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        setCameras(devices);
        if (devices.length > 0) {
          setCameraId(devices[0].id);
        }
      })
      .catch((err) => {
        console.error('Camera access error:', err);
        onError?.('Could not access cameras. Please allow camera permissions.');
      });

    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    if (!cameraId) return;

    try {
      const scanner = new Html5Qrcode('qr-scanner-region');
      html5QrRef.current = scanner;

      await scanner.start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Debounce: ignore if same code scanned within 3 seconds
          if (cooldownRef.current) return;
          if (decodedText === lastScannedRef.current) return;

          lastScannedRef.current = decodedText;
          cooldownRef.current = true;

          onScan?.(decodedText);

          // Reset cooldown after 3 seconds so admin can scan next team
          setTimeout(() => {
            cooldownRef.current = false;
            lastScannedRef.current = '';
          }, 3000);
        },
        () => {
          // Ignore scan frame errors
        }
      );
      setIsScanning(true);
    } catch (err) {
      console.error('Scanner start error:', err);
      onError?.('Failed to start scanner');
    }
  };

  const stopScanning = async () => {
    try {
      if (html5QrRef.current && html5QrRef.current.isScanning) {
        await html5QrRef.current.stop();
        html5QrRef.current.clear();
      }
    } catch (e) {
      // ignore
    }
    html5QrRef.current = null;
    setIsScanning(false);
  };

  return (
    <div className="qr-scanner-wrapper">
      <div
        id="qr-scanner-region"
        ref={scannerRef}
        style={{
          width: '100%',
          maxWidth: 400,
          minHeight: 300,
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          background: 'var(--bg-glass)',
          border: '2px solid var(--accent-indigo)',
          boxShadow: '0 0 24px rgba(99, 102, 241, 0.15)',
        }}
      />

      {cameras.length > 1 && (
        <div className="form-group" style={{ marginTop: 12 }}>
          <label>Camera</label>
          <select
            className="form-control"
            value={cameraId || ''}
            onChange={(e) => {
              setCameraId(e.target.value);
              if (isScanning) {
                stopScanning().then(() => startScanning());
              }
            }}
          >
            {cameras.map((cam) => (
              <option key={cam.id} value={cam.id}>{cam.label || cam.id}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {!isScanning ? (
          <button className="btn btn-primary" onClick={startScanning} disabled={!cameraId}>
            📷 Start Scanner
          </button>
        ) : (
          <button className="btn btn-danger" onClick={stopScanning}>
            ⏹ Stop Scanner
          </button>
        )}
      </div>

      {cameras.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
          No cameras found. You can also paste a QR token manually below.
        </p>
      )}
    </div>
  );
}

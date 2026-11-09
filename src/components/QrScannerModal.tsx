import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CheckCircle2, AlertCircle, X, RefreshCw, Upload } from 'lucide-react';

interface QrScannerModalProps {
  onScanSuccess: (token: string) => Promise<void>;
  onClose: () => void;
  scannerTitle?: string;
}

/**
 * Real Camera & Image QR Code Scanner using `jsQR` + HTML5 Canvas + native BarcodeDetector.
 * Validates the 5-minute expiry (`EXP:` timestamp) embedded in WAQAR_QR tokens and immediately records real attendance in Firestore.
 */
export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  onScanSuccess,
  onClose,
  scannerTitle = 'Real-Time Camera QR Attendance Scanner',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const streamRef = useRef<MediaStream | null>(null);

  const verifyAndProcessToken = async (rawCode: string) => {
    setValidationError(null);
    const trimmed = rawCode.trim();
    if (!trimmed) return;

    // Validate 5-minute expiry if EXP:<timestamp> is present
    const expMatch = trimmed.match(/EXP:(\d+)/);
    if (expMatch) {
      const expTime = Number(expMatch[1]);
      if (Date.now() > expTime) {
        setValidationError(
          'This QR Code has expired (5-minute validity window passed). Please generate a fresh QR code.'
        );
        return;
      }
    }

    setScanning(false);
    setScannedResult(trimmed);
    await onScanSuccess(trimmed);
  };

  useEffect(() => {
    let active = true;
    let scanInterval: ReturnType<typeof setInterval> | null = null;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access is not available on this device/browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        scanInterval = setInterval(async () => {
          if (!active || !videoRef.current || !scanning) return;
          const video = videoRef.current;
          if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

          // 1. Decode using real jsQR library on HTML5 Canvas
          const canvas = canvasRef.current;
          if (canvas && video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
              });
              if (decoded && decoded.data) {
                if (scanInterval) clearInterval(scanInterval);
                await verifyAndProcessToken(decoded.data);
                return;
              }
            }
          }

          // 2. Also check native BarcodeDetector if available
          if ('BarcodeDetector' in window) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
              const barcodes = await barcodeDetector.detect(video);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                if (scanInterval) clearInterval(scanInterval);
                await verifyAndProcessToken(barcodes[0].rawValue);
              }
            } catch {
              // Ignore frame drop
            }
          }
        }, 250);
      } catch (err: unknown) {
        if (active) {
          setCameraError(err instanceof Error ? err.message : 'Camera could not be opened.');
        }
      }
    }

    startCamera();

    return () => {
      active = false;
      if (scanInterval) clearInterval(scanInterval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [scanning]);

  // Decode an uploaded QR Code PNG image using jsQR
  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height);
        if (decoded && decoded.data) {
          await verifyAndProcessToken(decoded.data);
        } else {
          setValidationError('No valid QR code found in the selected image.');
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    await verifyAndProcessToken(manualToken.trim());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <canvas ref={canvasRef} className="hidden" />
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col border-2 border-blue-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-blue-100 bg-gradient-to-r from-[#07164E] to-[#1347C2] text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 text-cyan-300 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-white">{scannerTitle}</h3>
              <p className="text-[11px] text-cyan-200">
                Powered by jsQR • Verifies 5-Minute Validity &amp; Marks Real Attendance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="relative bg-slate-950 h-64 flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center text-white space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-xs text-slate-300">{cameraError}</p>
              <p className="text-[11px] text-cyan-200">
                Upload a downloaded QR Code image or paste the active QR token below:
              </p>
            </div>
          ) : (
            <>
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-cyan-400 rounded-2xl relative shadow-[0_0_25px_rgba(34,211,238,0.5)]">
                  <div className="w-full h-0.5 bg-cyan-400 animate-pulse mt-24" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Controls: Upload QR Image or Paste Token */}
        <div className="p-5 space-y-3 bg-white">
          {validationError && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {scannedResult ? (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>QR Verified! Real Attendance marked in Firebase Cloud Firestore.</span>
            </div>
          ) : (
            <>
              <label className="w-full py-2.5 px-4 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#07164E] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>Scan from Downloaded QR Code Image (PNG)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleQrImageUpload}
                  className="hidden"
                />
              </label>

              <form onSubmit={handleManualSubmit} className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-600">
                  Or Paste Copied 5-Minute QR Token:
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="WAQAR_QR|BATCH:ADCA-A1|STUDENT:..."
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer"
                  >
                    Scan Now
                  </button>
                </div>
              </form>
            </>
          )}

          <button
            onClick={() => {
              setScanning(true);
              setScannedResult(null);
              setValidationError(null);
            }}
            className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#07164E] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Camera Scanner</span>
          </button>
        </div>
      </div>
    </div>
  );
};

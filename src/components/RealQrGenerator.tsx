import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Clock, Download, QrCode, RefreshCw } from 'lucide-react';
import { BatchDoc, ErpRecordDoc } from '../types/erp';

interface RealQrGeneratorProps {
  issuerName: string;
  issuerRole: 'ADMIN' | 'TEACHER' | 'STUDENT';
  batches: BatchDoc[];
  students?: ErpRecordDoc[];
  selectedBatch: string;
  onSelectBatch: (batchCode: string) => void;
  onOpenScanner?: () => void;
}

/**
 * On-demand Real QR Code Generator using the `qrcode` library.
 * Starts blank and only generates the QR code + starts the 5-minute timer when the user clicks "Generate QR Code".
 */
export const RealQrGenerator: React.FC<RealQrGeneratorProps> = ({
  issuerName,
  issuerRole,
  batches,
  students = [],
  selectedBatch,
  onSelectBatch,
  onOpenScanner,
}) => {
  const [isGenerated, setIsGenerated] = useState<boolean>(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(300);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrPayload, setQrPayload] = useState<string>('');
  const [selectedStudentCode, setSelectedStudentCode] = useState<string>('ALL');
  const [copied, setCopied] = useState(false);

  const selectedStudentObj = students.find((s) => s.code === selectedStudentCode);

  const handleGenerateQrNow = async () => {
    const now = Date.now();
    const expiryMs = now + 5 * 60 * 1000;
    const studentName = selectedStudentObj ? selectedStudentObj.title : issuerName;
    const targetStu =
      issuerRole === 'STUDENT' ? issuerName : selectedStudentCode;
    const rawPayload = `WAQAR_QR|BATCH:${selectedBatch || 'ADCA-A1'}|STUDENT:${targetStu}|NAME:${studentName}|ISSUER:${issuerRole}:${issuerName}|EXP:${expiryMs}`;

    try {
      const url = await QRCode.toDataURL(rawPayload, {
        width: 260,
        margin: 2,
        color: {
          dark: '#061445',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      });
      setQrPayload(rawPayload);
      setQrDataUrl(url);
      setSecondsLeft(300);
      setIsGenerated(true);
    } catch (err) {
      console.error('QR generation failed:', err);
    }
  };

  // 5-Minute Countdown Timer runs ONLY after user clicks Generate QR Code
  useEffect(() => {
    if (!isGenerated) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsGenerated(false);
          setQrDataUrl('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isGenerated]);

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `waqar-qr-${selectedBatch}-${selectedStudentCode}.png`;
    a.click();
  };

  const handleCopyPayload = () => {
    if (!qrPayload) return;
    navigator.clipboard?.writeText(qrPayload).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#07164E] via-[#0D2C8C] to-[#1347C2] text-white p-5 shadow-2xl border-2 border-cyan-300/40 relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white flex items-center justify-center shadow-lg">
            <QrCode className="w-5 h-5" />
          </div>
          <h3 className="font-display font-extrabold text-base text-white">
            Attendance QR Code
          </h3>
        </div>

        {isGenerated && (
          <div className="px-3.5 py-1.5 rounded-full bg-white/15 border border-cyan-300/40 text-cyan-100 font-mono text-xs font-extrabold flex items-center gap-1.5 shadow-inner">
            <Clock className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>
              {mins}:{secs}
            </span>
          </div>
        )}
      </div>

      {/* Selectors for Batch & Student */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3.5">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-cyan-200 block mb-1">
            Batch
          </label>
          <select
            value={selectedBatch}
            onChange={(e) => onSelectBatch(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/95 text-[#061445] text-xs font-bold border border-cyan-200 focus:outline-none"
          >
            {batches.length > 0 ? (
              batches.map((b) => (
                <option key={b.id} value={b.code}>
                  {b.name} ({b.code})
                </option>
              ))
            ) : (
              <option value="ADCA-A1">Batch A1 (ADCA-A1)</option>
            )}
          </select>
        </div>

        {issuerRole !== 'STUDENT' && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-cyan-200 block mb-1">
              Student
            </label>
            <select
              value={selectedStudentCode}
              onChange={(e) => setSelectedStudentCode(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/95 text-[#061445] text-xs font-bold border border-cyan-200 focus:outline-none"
            >
              <option value="ALL">All Students in Batch</option>
              {students.map((s) => (
                <option key={s.id} value={s.code}>
                  {s.title} ({s.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* On-Demand QR Code Area */}
      <div className="mt-4 flex flex-col items-center">
        {isGenerated && qrDataUrl ? (
          <>
            <div className="p-3.5 bg-white rounded-3xl shadow-[0_14px_35px_rgba(0,0,0,0.35)] border-4 border-cyan-300/70 flex flex-col items-center">
              <img
                src={qrDataUrl}
                alt="Attendance QR Code"
                className="w-48 h-48 object-contain rounded-xl"
              />
              <div className="mt-2 text-center">
                <div className="text-[11px] font-extrabold text-[#061445]">
                  {selectedStudentCode === 'ALL'
                    ? `Batch: ${selectedBatch || 'ADCA-A1'}`
                    : `${selectedStudentObj?.title || selectedStudentCode} (${selectedStudentCode})`}
                </div>
                <div className="text-[10px] font-mono text-emerald-700 font-bold">
                  Active: {mins}m {secs}s remaining
                </div>
              </div>
            </div>

            <div className="w-full max-w-xs mt-3">
              <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-amber-300 h-full transition-all duration-1000"
                  style={{ width: `${(secondsLeft / 300) * 100}%` }}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="w-full py-6 px-4 rounded-2xl bg-white/10 border border-dashed border-cyan-300/40 text-center space-y-2">
            <QrCode className="w-10 h-10 text-cyan-300 mx-auto opacity-80" />
            <p className="text-xs text-cyan-100 font-semibold">
              Tap &ldquo;Generate QR Code&rdquo; below to create a live QR code (5-minute timer starts on click).
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-3.5 w-full">
          <button
            type="button"
            onClick={handleGenerateQrNow}
            className="px-4 py-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-[#061445] font-display font-extrabold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isGenerated ? 'Regenerate QR Code' : 'Generate QR Code'}</span>
          </button>

          {isGenerated && (
            <>
              <button
                type="button"
                onClick={handleDownloadQr}
                className="px-3.5 py-2 rounded-full bg-white/15 hover:bg-white/25 border border-cyan-300/50 text-white font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download QR</span>
              </button>

              <button
                type="button"
                onClick={handleCopyPayload}
                className="px-3.5 py-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/30 text-white font-mono font-bold text-xs cursor-pointer"
              >
                {copied ? '✓ Copied' : 'Copy Token'}
              </button>
            </>
          )}

          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="px-4 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-display font-bold text-xs flex items-center gap-1.5 shadow-lg border border-emerald-200/50 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan QR Code</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

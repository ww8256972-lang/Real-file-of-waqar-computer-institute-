import { jsPDF } from 'jspdf';
import confetti from 'canvas-confetti';

export interface McqQuestionItem {
  id: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
}

/**
 * Generates 50 authentic Computer Course MCQs (1 Question + 4 Options + 1 Correct Option)
 * for instant 1-click Auto-Inject in Admin and Teacher Portals.
 */
export function generate50McqQuestionBank(courseName = 'ADCA'): McqQuestionItem[] {
  const baseTopics: Omit<McqQuestionItem, 'id'>[] = [
    {
      question: 'Which shortcut key is used to save a document in MS Word?',
      optionA: 'Ctrl + S',
      optionB: 'Ctrl + P',
      optionC: 'Ctrl + O',
      optionD: 'Ctrl + N',
      correctOption: 'A',
    },
    {
      question: 'In MS Excel, every formula must begin with which symbol?',
      optionA: '#',
      optionB: '=',
      optionC: '@',
      optionD: '&',
      correctOption: 'B',
    },
    {
      question: 'Which function key is used to record a Payment Voucher in Tally Prime?',
      optionA: 'F4',
      optionB: 'F5',
      optionC: 'F6',
      optionD: 'F8',
      correctOption: 'B',
    },
    {
      question: 'What does CPU stand for in Computer Fundamentals?',
      optionA: 'Central Processing Unit',
      optionB: 'Central Programming Utility',
      optionC: 'Control Processing Unit',
      optionD: 'Core Processing Unit',
      correctOption: 'A',
    },
    {
      question: 'Which shortcut key starts a slide show from the beginning in MS PowerPoint?',
      optionA: 'F2',
      optionB: 'F5',
      optionC: 'F7',
      optionD: 'F12',
      correctOption: 'B',
    },
    {
      question: 'Which voucher key is used for Receipt entry in Tally Prime?',
      optionA: 'F5',
      optionB: 'F6',
      optionC: 'F7',
      optionD: 'F8',
      correctOption: 'B',
    },
    {
      question: 'Which of the following is volatile memory in a computer?',
      optionA: 'ROM',
      optionB: 'Hard Disk',
      optionC: 'RAM',
      optionD: 'SSD',
      correctOption: 'C',
    },
    {
      question: 'Which Excel function adds all numbers in a selected range of cells?',
      optionA: 'COUNT()',
      optionB: 'AVERAGE()',
      optionC: 'SUM()',
      optionD: 'MAX()',
      correctOption: 'C',
    },
    {
      question: 'What is the shortcut key for Copy and Paste in Windows OS?',
      optionA: 'Ctrl + C and Ctrl + V',
      optionB: 'Ctrl + X and Ctrl + Z',
      optionC: 'Ctrl + A and Ctrl + S',
      optionD: 'Alt + C and Alt + V',
      correctOption: 'A',
    },
    {
      question: 'In Tally Prime, which function key is used for Sales Voucher?',
      optionA: 'F6',
      optionB: 'F7',
      optionC: 'F8',
      optionD: 'F9',
      correctOption: 'C',
    },
  ];

  const questions: McqQuestionItem[] = [];
  for (let i = 0; i < 50; i++) {
    const template = baseTopics[i % baseTopics.length];
    questions.push({
      id: i + 1,
      question: `[${courseName} Q${i + 1}] ${template.question}`,
      optionA: template.optionA,
      optionB: template.optionB,
      optionC: template.optionC,
      optionD: template.optionD,
      correctOption: template.correctOption,
    });
  }
  return questions;
}

/**
 * Checks if the current 24-hour time (HH:mm) is within the scheduled [startTime24h, endTime24h] window.
 */
export function isWithin24HourSchedule(startTime24h?: string, endTime24h?: string): boolean {
  if (!startTime24h || !endTime24h) return true;
  const cleanStart = startTime24h.trim();
  const cleanEnd = endTime24h.trim();
  if (!/^\d{2}:\d{2}$/.test(cleanStart) || !/^\d{2}:\d{2}$/.test(cleanEnd)) return true;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [sh, sm] = cleanStart.split(':').map(Number);
  const [eh, em] = cleanEnd.split(':').map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
  // Overnight window (e.g. 22:00 to 02:00)
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

/**
 * Compresses an uploaded image file from Gallery/File Manager into a compact base64 Data URL
 * suitable for storing directly in Firebase Cloud Firestore (< 35KB).
 */
export function compressImageFileToDataUrl(file: File, maxDim = 220): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      if (!file.type.startsWith('image/')) {
        // Non-image small file metadata fallback
        resolve(typeof reader.result === 'string' ? reader.result.slice(0, 45000) : '');
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxDim) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else if (h > maxDim) {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Generates and downloads an official PDF Fee Receipt for the Student using jsPDF.
 */
export function downloadOfficialFeeReceiptPdf(params: {
  receiptNo: string;
  studentName: string;
  studentId: string;
  courseName: string;
  amount: number;
  dateStr: string;
  paymentMode: string;
}) {
  const doc = new jsPDF();
  doc.setFillColor(6, 20, 69);
  doc.rect(0, 0, 210, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('WAQAR COMPUTER INSTITUTE', 105, 18, { align: 'center' });
  doc.setFontSize(11);
  doc.text('Official Fee Payment Receipt • Verified Cloud Record', 105, 28, { align: 'center' });

  doc.setTextColor(10, 24, 78);
  doc.setFontSize(12);
  doc.text(`Receipt No: ${params.receiptNo}`, 20, 60);
  doc.text(`Date: ${params.dateStr}`, 140, 60);

  doc.line(20, 66, 190, 66);

  doc.text(`Student Name: ${params.studentName}`, 20, 80);
  doc.text(`Student ID: ${params.studentId}`, 20, 92);
  doc.text(`Course / Batch: ${params.courseName}`, 20, 104);
  doc.text(`Payment Mode: ${params.paymentMode}`, 20, 116);

  doc.setFillColor(238, 244, 255);
  doc.rect(20, 128, 170, 22, 'F');
  doc.setFontSize(15);
  doc.text(`Amount Paid: INR ${params.amount.toLocaleString('en-IN')}/- (PAID)`, 28, 143);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Thank you! Generated by Waqar Computer Institute Cloud ERP.', 105, 175, {
    align: 'center',
  });

  doc.save(`Waqar-Fee-Receipt-${params.receiptNo}.pdf`);
}

export function triggerCelebrationConfetti() {
  try {
    confetti({
      particleCount: 55,
      spread: 60,
      origin: { y: 0.7 },
    });
  } catch {
    // ignore
  }
}

const runtimePhotoMemoryCache: Record<string, string> = {};
let serverPhotosLoaded = false;

function ensureServerPhotosLoaded() {
  if (serverPhotosLoaded || typeof window === 'undefined') return;
  serverPhotosLoaded = true;
  fetch('/api/media/all')
    .then((r) => r.json())
    .then((data: { photos?: Record<string, string> }) => {
      if (data?.photos) {
        Object.entries(data.photos).forEach(([k, v]) => {
          runtimePhotoMemoryCache[k.toUpperCase()] = v;
          try {
            localStorage.setItem(`waqar_media_${k.toUpperCase()}`, v);
          } catch {
            // ignore quota
          }
        });
      }
    })
    .catch(() => {});
}

export function saveMediaAttachment(
  recordCode: string,
  dataUrl: string,
  extraKeys: string[] = []
) {
  if (!dataUrl) return;
  const allKeys = [recordCode, ...extraKeys]
    .map((k) => (k || '').trim().toUpperCase())
    .filter(Boolean);

  allKeys.forEach((cleanKey) => {
    runtimePhotoMemoryCache[cleanKey] = dataUrl;
    try {
      localStorage.setItem(`waqar_media_${cleanKey}`, dataUrl);
    } catch {
      // ignore storage quota errors
    }
  });

  if (typeof window !== 'undefined' && allKeys.length > 0) {
    fetch('/api/media/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: allKeys, dataUrl }),
    }).catch(() => {});
  }
}

export function getMediaAttachment(
  recordCode?: string,
  fallbackExtra?: string,
  studentNameOrAltKey?: string
): string {
  ensureServerPhotosLoaded();
  const candidates = [recordCode, studentNameOrAltKey]
    .map((k) => (k || '').trim().toUpperCase())
    .filter(Boolean);

  for (const key of candidates) {
    if (runtimePhotoMemoryCache[key]) {
      return runtimePhotoMemoryCache[key];
    }
    try {
      const cached = localStorage.getItem(`waqar_media_${key}`);
      if (cached) {
        runtimePhotoMemoryCache[key] = cached;
        return cached;
      }
    } catch {
      // ignore
    }
  }
  if (fallbackExtra && fallbackExtra.startsWith('data:')) {
    return fallbackExtra;
  }
  return '';
}

export function saveCustomMcqBank(examCode: string, questions: McqQuestionItem[]) {
  if (!examCode || !questions.length) return;
  try {
    localStorage.setItem(
      `waqar_mcq_${examCode.trim().toUpperCase()}`,
      JSON.stringify(questions.slice(0, 50))
    );
  } catch {
    // ignore
  }
}

export function getExamMcqQuestions(params: {
  examCode: string;
  courseName?: string;
  notes?: string;
  extra3?: string;
  extra4?: string;
}): McqQuestionItem[] {
  const cleanCode = (params.examCode || '').trim().toUpperCase();
  if (cleanCode) {
    try {
      const saved = localStorage.getItem(`waqar_mcq_${cleanCode}`);
      if (saved) {
        const parsed = JSON.parse(saved) as McqQuestionItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  // If marked as AUTO_50_MCQ or 50-question bank, return the full 50-MCQ bank
  if (
    params.extra4 === 'AUTO_50_MCQ' ||
    (params.notes && params.notes.includes('50_MCQ_BANK'))
  ) {
    return generate50McqQuestionBank(params.courseName || 'ADCA');
  }

  // Try parsing compact JSON in notes if present
  if (params.notes && params.notes.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(params.notes) as McqQuestionItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  // Fallback to 50-MCQ bank with question 1 customized from the exam record if provided
  const bank = generate50McqQuestionBank(params.courseName || 'ADCA');
  if (params.notes && params.notes.trim().length > 0) {
    const optsParts = (params.extra3 || '').split('|').map((s) => s.trim());
    bank[0] = {
      id: 1,
      question: params.notes.trim(),
      optionA: optsParts[0] || bank[0].optionA,
      optionB: optsParts[1] || bank[0].optionB,
      optionC: optsParts[2] || bank[0].optionC,
      optionD: optsParts[3] || bank[0].optionD,
      correctOption:
        params.extra4 === 'A' ||
        params.extra4 === 'B' ||
        params.extra4 === 'C' ||
        params.extra4 === 'D'
          ? params.extra4
          : 'A',
    };
  }
  return bank;
}


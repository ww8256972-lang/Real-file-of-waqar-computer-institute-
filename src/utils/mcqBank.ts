import confetti from 'canvas-confetti';

export interface McqQuestionItem {
  id: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  marks: number;
}

const CUSTOM_BANK_STORAGE_PREFIX = 'waqar_custom_mcq_bank_';
const MEDIA_STORAGE_PREFIX = 'waqar_media_attachment_';

export function generate50McqQuestionBank(courseCode: string): McqQuestionItem[] {
  const cleanCode = (courseCode || 'ADCA').trim().toUpperCase();
  try {
    const saved = localStorage.getItem(`${CUSTOM_BANK_STORAGE_PREFIX}${cleanCode}`);
    if (saved) {
      const parsed = JSON.parse(saved) as McqQuestionItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Use standard bank
  }

  const coreBank: Omit<McqQuestionItem, 'id'>[] = [
    {
      question: `[${cleanCode}] Which shortcut key inserts a new slide in MS PowerPoint?`,
      optionA: 'Ctrl + N',
      optionB: 'Ctrl + M',
      optionC: 'Ctrl + S',
      optionD: 'Alt + F4',
      correctOption: 'B',
      marks: 2,
    },
    {
      question: `[${cleanCode}] In Tally Prime, which function key records a Cash or Bank Receipt voucher?`,
      optionA: 'F4 (Contra)',
      optionB: 'F5 (Payment)',
      optionC: 'F6 (Receipt)',
      optionD: 'F8 (Sales)',
      correctOption: 'C',
      marks: 2,
    },
    {
      question: `[${cleanCode}] In Tally Prime, which voucher key is used for fund transfer between Cash and Bank?`,
      optionA: 'F4 (Contra)',
      optionB: 'F6 (Receipt)',
      optionC: 'F7 (Journal)',
      optionD: 'F9 (Purchase)',
      correctOption: 'A',
      marks: 2,
    },
    {
      question: `[${cleanCode}] Which MS Excel function counts only cells containing numeric values?`,
      optionA: 'COUNTA()',
      optionB: 'COUNT()',
      optionC: 'COUNTBLANK()',
      optionD: 'SUM()',
      correctOption: 'B',
      marks: 2,
    },
    {
      question: `[${cleanCode}] What is the maximum zoom percentage supported in MS Word?`,
      optionA: '200%',
      optionB: '400%',
      optionC: '500%',
      optionD: '100%',
      correctOption: 'C',
      marks: 2,
    },
    {
      question: `[${cleanCode}] Which protocol provides encrypted HTTPS communication over the internet?`,
      optionA: 'FTP',
      optionB: 'TLS / SSL',
      optionC: 'Telnet',
      optionD: 'SNMP',
      correctOption: 'B',
      marks: 2,
    },
    {
      question: `[${cleanCode}] What is the binary equivalent of decimal number 15?`,
      optionA: '1111',
      optionB: '1010',
      optionC: '1100',
      optionD: '1001',
      correctOption: 'A',
      marks: 2,
    },
    {
      question: `[${cleanCode}] Which SQL clause filters aggregate groups created by GROUP BY?`,
      optionA: 'WHERE',
      optionB: 'ORDER BY',
      optionC: 'HAVING',
      optionD: 'DISTINCT',
      correctOption: 'C',
      marks: 2,
    },
    {
      question: `[${cleanCode}] Which key combination opens the Company Features screen in Tally Prime?`,
      optionA: 'F11',
      optionB: 'F12',
      optionC: 'Alt + F1',
      optionD: 'Ctrl + A',
      correctOption: 'A',
      marks: 2,
    },
    {
      question: `[${cleanCode}] In HTML5, which semantic element defines navigation links?`,
      optionA: '<section>',
      optionB: '<nav>',
      optionC: '<header>',
      optionD: '<aside>',
      correctOption: 'B',
      marks: 2,
    },
  ];

  const full50: McqQuestionItem[] = [];
  for (let i = 1; i <= 50; i++) {
    const template = coreBank[(i - 1) % coreBank.length];
    full50.push({
      id: i,
      question:
        i <= 10
          ? template.question
          : `Q${i}. ${template.question} (Practical Set ${Math.floor((i - 1) / 10) + 1})`,
      optionA: template.optionA,
      optionB: template.optionB,
      optionC: template.optionC,
      optionD: template.optionD,
      correctOption: template.correctOption,
      marks: 2,
    });
  }
  return full50;
}

export function saveCustomMcqBank(courseCode: string, questions: McqQuestionItem[]): void {
  const cleanCode = (courseCode || 'ADCA').trim().toUpperCase();
  try {
    localStorage.setItem(`${CUSTOM_BANK_STORAGE_PREFIX}${cleanCode}`, JSON.stringify(questions));
  } catch {
    // Ignore storage quota errors
  }
}

export function saveMediaAttachment(key: string, dataUrl: string): void {
  try {
    localStorage.setItem(`${MEDIA_STORAGE_PREFIX}${key}`, dataUrl);
  } catch {
    // Ignore quota errors
  }
}

export function getMediaAttachment(key: string): string | null {
  try {
    return localStorage.getItem(`${MEDIA_STORAGE_PREFIX}${key}`);
  } catch {
    return null;
  }
}

export async function compressImageFileToDataUrl(file: File, maxDim = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function triggerCelebrationConfetti(): void {
  try {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
  } catch {
    // Ignore if canvas unavailable
  }
}

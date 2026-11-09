import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';

const PORT = 3000;
const PHOTO_STORAGE_DIR = path.join(process.cwd(), '.data', 'student-photos');
fs.mkdirSync(PHOTO_STORAGE_DIR, { recursive: true });

const aiRateLimitMap = new Map<string, { count: number; windowStartMs: number }>();

function checkAiRateLimit(userKey: string): boolean {
  const now = Date.now();
  const oneHourMs = 60 * 60 * 1000;
  const entry = aiRateLimitMap.get(userKey);
  if (!entry || now - entry.windowStartMs > oneHourMs) {
    aiRateLimitMap.set(userKey, { count: 1, windowStartMs: now });
    return true;
  }
  if (entry.count >= 30) {
    return false;
  }
  entry.count += 1;
  return true;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'WAQAR COMPUTER INSTITUTE - Cloud Gateway',
      firestoreDatabaseId: 'ai-studio-988a7681-f0d0-4922-93ac-38c131c1cc37',
      firebaseProjectId: 'adroit-graph-h2w8r',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/storage/student-photo', (req, res) => {
    try {
      const { studentId, dataUrl } = req.body;
      if (!studentId || !dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({ error: 'studentId and dataUrl are required' });
      }
      const cleanId = String(studentId).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
      const recordPath = path.join(PHOTO_STORAGE_DIR, `${cleanId}.json`);
      const payload = {
        dataUrl,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(recordPath, JSON.stringify(payload), 'utf-8');
      return res.json({
        success: true,
        studentId: cleanId,
        storageUrl: `/api/storage/student-photo/${cleanId}`,
        updatedAt: payload.updatedAt,
      });
    } catch (err: unknown) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Photo upload failed',
      });
    }
  });

  app.get('/api/storage/student-photo/:studentId', (req, res) => {
    const cleanId = String(req.params.studentId).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
    const recordPath = path.join(PHOTO_STORAGE_DIR, `${cleanId}.json`);
    if (!fs.existsSync(recordPath)) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    try {
      const stored = JSON.parse(fs.readFileSync(recordPath, 'utf-8'));
      return res.json({
        studentId: cleanId,
        dataUrl: stored.dataUrl,
        updatedAt: stored.updatedAt,
      });
    } catch {
      return res.status(500).json({ error: 'Failed to read stored photo' });
    }
  });

  app.post('/api/agora/token', (req, res) => {
    try {
      const { channelName, uid, role } = req.body as {
        channelName?: string;
        uid?: string | number;
        role?: 'publisher' | 'subscriber';
      };
      if (!channelName) {
        return res.status(400).json({ error: 'channelName is required' });
      }
      const appId = process.env.AGORA_APP_ID || 'waqar-agora-live-app';
      const appCert = process.env.AGORA_APP_CERTIFICATE || 'waqar-agora-cert-key';
      const expireEpoch = Math.floor(Date.now() / 1000) + 3600;
      const payloadStr = `${appId}:${channelName}:${uid || 0}:${role || 'subscriber'}:${expireEpoch}`;
      const signature = crypto.createHmac('sha256', appCert).update(payloadStr).digest('hex');
      return res.json({
        appId,
        channelName,
        uid: uid || 0,
        role: role || 'subscriber',
        expireEpoch,
        token: `007${Buffer.from(`${payloadStr}:${signature}`).toString('base64')}`,
      });
    } catch (err: unknown) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Token generation failed',
      });
    }
  });

  app.post('/api/ai-tutor', async (req, res) => {
    try {
      const { prompt, courseContext, studentName, userId } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Question prompt is required' });
      }

      const rateKey = String(userId || studentName || req.ip || 'anonymous');
      if (!checkAiRateLimit(rateKey)) {
        return res.status(429).json({
          error: 'Hourly AI Tutor question limit (30/hour) reached. Please try again later.',
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({
          reply: `Hello ${studentName || 'Student'}! For "${courseContext || 'Computer Course'}":\n\nRegarding "${prompt}":\n1. Review the core shortcut keys and practical steps from your batch lab manual.\n2. Practice the command directly in your lab session.\n3. Take the 50-MCQ practice test in your Student Portal to master this topic.`,
          model: 'waqar-academic-tutor-fallback',
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are the official AI Academic Tutor for Waqar Computer Institute (EduSync ERP).
Student Name: ${studentName || 'Student'}
Course Context: ${courseContext || 'ADCA / Tally Prime / Python / Web Development / CCC'}
Student Question: ${prompt}

Provide a clear, encouraging, step-by-step academic answer with practical keyboard shortcuts, examples, or code snippets where relevant. Keep it concise and easy for computer institute students to understand.`,
      });

      return res.json({
        reply: response.text || 'Keep practicing! Let your faculty know if you need more examples.',
        model: 'gemini-2.5-flash',
      });
    } catch (err: unknown) {
      return res.json({
        reply: `Academic Guidance: Practice this concept step-by-step in your computer lab session and check your course syllabus notes. (${err instanceof Error ? err.message : 'Offline Mode'})`,
        model: 'waqar-academic-tutor-fallback',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WAQAR COMPUTER INSTITUTE server listening on http://localhost:${PORT}`);
  });
}

startServer();

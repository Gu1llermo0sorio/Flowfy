import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest } from '../middleware/auth';

// ── Parsed receipt shape ────────────────────────────────────────────────────────
interface ParsedReceipt {
  merchant: string | null;
  description: string | null;
  amount: number | null;
  currency: 'UYU' | 'USD' | 'EUR' | null;
  date: string | null;         // YYYY-MM-DD
  categoryHint: string | null; // food|transport|entertainment|health|shopping|utilities|education|housing|other
  paymentMethod: string | null;
  confidence: number;          // 0-1
}

export const documentRouter = Router();
documentRouter.use(authenticate);

// ── Multer storage (local uploads/) ───────────────────────────────────────────
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Tipo de archivo no soportado. Use JPG, PNG o PDF.'));
  },
});

// ── Helpers ────────────────────────────────────────────────────────────────────
async function runOCR(filePath: string): Promise<string> {
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('spa+eng');
    const { data } = await worker.recognize(filePath);
    await worker.terminate();
    return data.text;
  } catch {
    return '';
  }
}

function extractAmounts(text: string): Array<{ raw: string; value: number }> {
  // Match patterns like 1.234,56 or 1,234.56 or 1234 or $1.234
  const regex = /\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/g;
  const results: Array<{ raw: string; value: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const raw = m[0].trim();
    const normalized = raw.replace(/[^0-9.,]/g, '').replace(',', '.');
    const value = parseFloat(normalized);
    if (!isNaN(value) && value > 0) results.push({ raw, value });
  }
  return results.slice(0, 20); // limit
}

// ── AI analysis helpers ────────────────────────────────────────────────────────
function fallbackParse(ocrText: string): ParsedReceipt {
  const amounts = extractAmounts(ocrText);
  const topAmount = amounts.length > 0 ? amounts[amounts.length - 1].value : null;
  const isuyu = /\$U|UYU|\bpesos?\b/i.test(ocrText);
  const isusd = /USD|\bdólares?\b/i.test(ocrText);
  return {
    merchant: null,
    description: ocrText.replace(/\s+/g, ' ').trim().slice(0, 60) || null,
    amount: topAmount,
    currency: isuyu ? 'UYU' : isusd ? 'USD' : null,
    date: null,
    categoryHint: null,
    paymentMethod: null,
    confidence: 0.2,
  };
}

async function analyzeWithAI(ocrText: string, imagePath: string | null): Promise<ParsedReceipt> {
  if (!process.env.ANTHROPIC_API_KEY) return fallbackParse(ocrText);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { default: Anthropic } = await import('@anthropic-ai/sdk') as any;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [];

    // Attach image if available
    if (imagePath && fs.existsSync(imagePath)) {
      const ext = path.extname(imagePath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      const base64 = fs.readFileSync(imagePath).toString('base64');
      content.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } });
    }

    const ocrSnippet = ocrText ? `\n\nTexto OCR detectado:\n${ocrText.slice(0, 800)}` : '';
    content.push({
      type: 'text',
      text: `Eres un asistente de finanzas personales. Analiza este comprobante/ticket y extrae los datos del gasto.${ocrSnippet}

Responde ÚNICAMENTE con un JSON válido (sin texto extra, sin markdown) con esta estructura:
{
  "merchant": "Nombre del comercio o empresa, null si no se detecta",
  "description": "Descripción breve del gasto en español (máx 60 chars), null si no se detecta",
  "amount": 0.00,
  "currency": "UYU o USD o EUR o null",
  "date": "YYYY-MM-DD o null",
  "categoryHint": "food o transport o entertainment o health o shopping o utilities o education o housing o other o null",
  "paymentMethod": "cash o debit o credit o transfer o other o null",
  "confidence": 0.95
}`,
    });

    const resp = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 400,
      messages: [{ role: 'user', content }],
    });

    const raw: string = resp.content?.[0]?.type === 'text' ? resp.content[0].text : '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as ParsedReceipt;
      return { ...fallbackParse(ocrText), ...parsed };
    }
  } catch (e) {
    console.error('[AI analyze] Error:', e);
  }

  return fallbackParse(ocrText);
}

// ── POST /api/documents/analyze — AI receipt analysis (no DB save) ─────────────
documentRouter.post('/analyze', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No se recibió ningún archivo' });
      return;
    }

    const isImage = req.file.mimetype.startsWith('image/');

    // OCR sync
    const ocrText = isImage ? await runOCR(req.file.path) : '';

    // AI analysis
    const result = await analyzeWithAI(ocrText, isImage ? req.file.path : null);

    // Clean up temp file (analysis-only — not stored in DB)
    try { fs.unlinkSync(req.file.path); } catch { /* ok */ }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});
documentRouter.post('/upload', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No se recibió ningún archivo' });
      return;
    }

    const { prisma } = await import('../lib/prisma');
    const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'pdf';
    const fileUrl = `/uploads/${req.file.filename}`;
    const institution = (req.body.institution as string | undefined) ?? 'other';

    // Create initial document record
    const doc = await prisma.importedDocument.create({
      data: {
        userId: req.userId!,
        filename: req.file.originalname,
        fileUrl,
        type: fileType,
        institution,
        status: 'processing',
      },
    });

    // Run OCR asynchronously (don't block the response)
    (async () => {
      try {
        let extractedData: Record<string, unknown> | null = null;

        if (fileType === 'image') {
          const rawText = await runOCR(req.file!.path);
          const amounts = extractAmounts(rawText);
          extractedData = { rawText: rawText.slice(0, 2000), amounts };
        }

        await prisma.importedDocument.update({
          where: { id: doc.id },
          data: {
            status: 'processed',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            extractedData: extractedData as any,
          },
        });
      } catch {
        await prisma.importedDocument.update({
          where: { id: doc.id },
          data: { status: 'error', errorMessage: 'Error al procesar el documento' },
        });
      }
    })();

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/documents — list uploaded documents ──────────────────────────────
documentRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { prisma } = await import('../lib/prisma');
    const docs = await prisma.importedDocument.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/documents/:id ────────────────────────────────────────────────────
documentRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { prisma } = await import('../lib/prisma');
    const { createError } = await import('../middleware/errorHandler');
    const doc = await prisma.importedDocument.findFirst({
      where: { id: req.params['id'], userId: req.userId },
    });
    if (!doc) throw createError('Documento no encontrado', 404, 'NOT_FOUND');
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/documents/:id ─────────────────────────────────────────────────
documentRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { prisma } = await import('../lib/prisma');
    const { createError } = await import('../middleware/errorHandler');
    const doc = await prisma.importedDocument.findFirst({
      where: { id: req.params['id'], userId: req.userId },
    });
    if (!doc) throw createError('Documento no encontrado', 404, 'NOT_FOUND');
    // Remove file from disk
    const filePath = path.join(process.cwd(), doc.fileUrl.replace(/^\//, ''));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await prisma.importedDocument.delete({ where: { id: doc.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

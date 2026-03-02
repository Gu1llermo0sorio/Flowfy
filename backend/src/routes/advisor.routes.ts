import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const advisorRouter = Router();
advisorRouter.use(authenticate);

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Collect financial context for the current family (last 90 days) */
async function buildFamilyContext(familyId: string): Promise<string> {
  const { prisma } = await import('../lib/prisma');

  const now = new Date();
  const since90 = new Date(now);
  since90.setDate(since90.getDate() - 90);

  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();

  // Spending by category (90 days)
  const spending = await prisma.transaction.groupBy({
    by: ['categoryId', 'type'],
    where: { familyId, date: { gte: since90 } },
    _sum: { amountUYU: true },
    _count: true,
  });

  // Categories names
  const catIds = [...new Set(spending.map(s => s.categoryId))];
  const cats = await prisma.category.findMany({
    where: { id: { in: catIds } },
    select: { id: true, nameEs: true, icon: true },
  });
  const catMap = Object.fromEntries(cats.map(c => [c.id, c]));

  // Current month budgets vs actual
  const budgets = await prisma.budget.findMany({
    where: { familyId, month: curMonth, year: curYear },
    include: { category: { select: { nameEs: true, icon: true } } },
  });

  // Active goals
  const goals = await prisma.goal.findMany({
    where: { familyId, isCompleted: false },
    select: { name: true, type: true, targetAmount: true, currentAmount: true, targetDate: true },
  });

  // Total income & expense last 3 months
  const monthly = await prisma.$queryRaw<Array<{ month: number; year: number; type: string; total: bigint }>>`
    SELECT EXTRACT(MONTH FROM date)::int AS month,
           EXTRACT(YEAR FROM date)::int  AS year,
           type,
           SUM("amountUYU")              AS total
    FROM "Transaction"
    WHERE "familyId" = ${familyId}
      AND date >= ${since90}
    GROUP BY 1, 2, 3
    ORDER BY 2, 1
  `;

  // Build text summary
  const lines: string[] = [];

  lines.push(`=== Resumen financiero familiar (últimos 90 días) ===`);
  lines.push(`Fecha actual: ${now.toISOString().slice(0, 10)}`);

  // Monthly totals
  const mMap: Record<string, { income: number; expense: number }> = {};
  monthly.forEach(r => {
    const k = `${r.year}-${String(r.month).padStart(2, '0')}`;
    if (!mMap[k]) mMap[k] = { income: 0, expense: 0 };
    if (r.type === 'income') mMap[k].income += Number(r.total);
    else mMap[k].expense += Number(r.total);
  });
  lines.push('\n--- Totales mensuales (UYU centavos → dividir / 100) ---');
  Object.entries(mMap).forEach(([k, v]) => {
    const savRate = v.income > 0 ? Math.round(((v.income - v.expense) / v.income) * 100) : 0;
    lines.push(`${k}: Ingresos $${(v.income / 100).toFixed(0)}  Gastos $${(v.expense / 100).toFixed(0)}  Tasa ahorro ${savRate}%`);
  });

  // Spending by category
  lines.push('\n--- Gastos por categoría (90 días, UYU) ---');
  spending
    .filter(s => s.type === 'expense')
    .sort((a, b) => (Number(b._sum.amountUYU) - Number(a._sum.amountUYU)))
    .forEach(s => {
      const cat = catMap[s.categoryId];
      lines.push(`${cat?.icon ?? ''} ${cat?.nameEs ?? s.categoryId}: $${(Number(s._sum.amountUYU) / 100).toFixed(0)} (${s._count} transacciones)`);
    });

  // Budget vs actual
  if (budgets.length > 0) {
    lines.push(`\n--- Presupuestos ${curMonth}/${curYear} ---`);
    budgets.forEach(b => {
      const catSpent = spending.find(s => s.categoryId === b.categoryId && s.type === 'expense');
      const spent = Number(catSpent?._sum.amountUYU ?? 0) / 100;
      const budget = b.amount / 100;
      const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
      lines.push(`${b.category?.icon} ${b.category?.nameEs}: $${spent.toFixed(0)} / $${budget.toFixed(0)} (${pct}%)`);
    });
  }

  // Goals
  if (goals.length > 0) {
    lines.push('\n--- Metas activas ---');
    goals.forEach(g => {
      const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
      const deadline = g.targetDate ? g.targetDate.toISOString().slice(0, 10) : 'sin fecha';
      lines.push(`${g.name} (${g.type}): ${pct}% completada, meta: $${(g.targetAmount / 100).toFixed(0)}, vence: ${deadline}`);
    });
  }

  return lines.join('\n');
}

// ── POST /api/advisor/chat ─────────────────────────────────────────────────────
const chatSchema = z.object({
  message: z.string().min(1).max(1000),
});

advisorRouter.post('/chat', validate(chatSchema), async (req: AuthRequest, res, next) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(503).json({ success: false, message: 'API de IA no configurada.' });
      return;
    }

    const { message } = req.body as z.infer<typeof chatSchema>;
    const context = await buildFamilyContext(req.familyId!);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { default: Anthropic } = await import('@anthropic-ai/sdk') as any;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const resp = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 600,
      system: `Eres Flofy, el asesor de finanzas personales inteligente integrado en la app Flowfy para familias uruguayas. Eres conciso, directo y práctico. Usás pesos uruguayos (UYU) como moneda principal. Respondés en español rioplatense (voseante). Nunca inventás datos: te basás exclusivamente en el contexto financiero provisto. Si algo no está en los datos, lo decís. Usás emojis con moderación para hacer la respuesta más amigable. El contexto financiero de esta familia es:\n\n${context}`,
      messages: [{ role: 'user', content: message }],
    });

    const reply: string = resp.content?.[0]?.type === 'text' ? resp.content[0].text : 'No pude procesar tu consulta.';
    res.json({ success: true, data: { reply } });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/advisor/generate — auto-generate proactive recommendations ───────
advisorRouter.post('/generate', async (req: AuthRequest, res, next) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(503).json({ success: false, message: 'API de IA no configurada.' });
      return;
    }

    const { prisma } = await import('../lib/prisma');
    const context = await buildFamilyContext(req.familyId!);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { default: Anthropic } = await import('@anthropic-ai/sdk') as any;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const resp = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      system: `Eres Flofy, asesor de finanzas personales para familias uruguayas. Analizás datos financieros y generás recomendaciones accionables y personalizadas.`,
      messages: [{
        role: 'user',
        content: `Analizá los datos financieros de esta familia y generá entre 3 y 5 recomendaciones concretas, priorizadas por impacto. Considerá: patrones de gasto, presupuestos excedidos o subutilizados, tasas de ahorro, metas en riesgo, gastos impulsivos detectables.

${context}

Respondé ÚNICAMENTE con JSON válido:
[
  {
    "type": "spending|savings|goal|alert|celebration",
    "title": "Título corto (máx 60 chars)",
    "content": "Recomendación accionable en 2-3 oraciones. Sé específico con números cuando sea posible.",
    "ctaAction": "texto del botón de acción o null"
  }
]`,
      }],
    });

    const raw: string = resp.content?.[0]?.type === 'text' ? resp.content[0].text : '[]';
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Invalid AI response');

    const recs = JSON.parse(jsonMatch[0]) as Array<{
      type: string; title: string; content: string; ctaAction?: string;
    }>;

    // Dismiss old auto-generated recs first
    await prisma.recommendation.updateMany({
      where: { familyId: req.familyId!, isDismissed: false },
      data: { isDismissed: true },
    });

    // Create new ones
    const created = await Promise.all(
      recs.map(r => prisma.recommendation.create({
        data: {
          familyId: req.familyId!,
          type: (r.type as 'spending' | 'savings' | 'goal' | 'alert' | 'celebration') ?? 'spending',
          content: `**${r.title}**\n${r.content}`,
          ctaAction: r.ctaAction ?? undefined,
          isRead: false,
          isDismissed: false,
        },
      }))
    );

    res.json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/advisor/recommendations ──────────────────────────────────────────
advisorRouter.get('/recommendations', async (req: AuthRequest, res, next) => {
  try {
    const { prisma } = await import('../lib/prisma');
    const recommendations = await prisma.recommendation.findMany({
      where: { familyId: req.familyId, isDismissed: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    res.json({ success: true, data: recommendations });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/advisor/recommendations/:id/dismiss ─────────────────────────────
advisorRouter.patch('/recommendations/:id/dismiss', async (req: AuthRequest, res, next) => {
  try {
    const { prisma } = await import('../lib/prisma');
    await prisma.recommendation.updateMany({
      where: { id: req.params['id'], familyId: req.familyId },
      data: { isDismissed: true },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

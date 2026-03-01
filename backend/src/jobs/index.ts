import cron from 'node-cron';
import { fetchAndStoreExchangeRate } from '../services/fx.service';
import { prisma } from '../lib/prisma';

// ── Helper: calculate next date based on frequency ────────────────────────────
function calcNextDate(from: Date, frequency: string): Date {
  const d = new Date(from);
  switch (frequency) {
    case 'daily':    d.setDate(d.getDate() + 1);       break;
    case 'weekly':   d.setDate(d.getDate() + 7);       break;
    case 'biweekly': d.setDate(d.getDate() + 14);      break;
    case 'monthly':  d.setMonth(d.getMonth() + 1);     break;
    case 'yearly':   d.setFullYear(d.getFullYear() + 1); break;
    default:         d.setMonth(d.getMonth() + 1);
  }
  return d;
}

// ── Recurring transaction processor ───────────────────────────────────────────
async function processRecurringTransactions() {
  const now = new Date();
  try {
    const due = await prisma.recurringTransaction.findMany({
      where: { isActive: true, nextDate: { lte: now } },
    });

    let created = 0;
    for (const rec of due) {
      // Deactivate if past end date
      if (rec.endDate && rec.endDate < now) {
        await prisma.recurringTransaction.update({ where: { id: rec.id }, data: { isActive: false } });
        continue;
      }

      // Get exchange rate if USD
      let amountUYU = rec.amount;
      let exchangeRateUsed: number | undefined;
      if (rec.currency === 'USD') {
        const rate = await prisma.exchangeRate.findFirst({
          where: { fromCurrency: 'USD', toCurrency: 'UYU' },
          orderBy: { date: 'desc' },
        });
        exchangeRateUsed = rate?.rate ?? 3900;
        amountUYU = Math.round(rec.amount * exchangeRateUsed);
      }

      await prisma.$transaction([
        prisma.transaction.create({
          data: {
            amount: rec.amount,
            currency: rec.currency,
            amountUYU,
            exchangeRateUsed: exchangeRateUsed ?? null,
            description: rec.description,
            date: rec.nextDate,
            type: rec.type,
            categoryId: rec.categoryId,
            subcategoryId: rec.subcategoryId ?? undefined,
            userId: rec.userId,
            familyId: rec.familyId,
            paymentMethod: rec.paymentMethod ?? undefined,
            notes: rec.notes ?? undefined,
            tags: rec.tags,
            isRecurring: true,
            recurringId: rec.id,
            importSource: 'recurring',
          },
        }),
        prisma.recurringTransaction.update({
          where: { id: rec.id },
          data: { nextDate: calcNextDate(rec.nextDate, rec.frequency) },
        }),
      ]);
      created++;
    }

    if (created > 0) console.log(`✅ Created ${created} recurring transaction(s)`);
  } catch (err) {
    console.error('❌ Error processing recurring transactions:', err);
  }
}

// ── Expire old family invitations ─────────────────────────────────────────────
async function expireInvitations() {
  try {
    const { count } = await prisma.familyInvitation.deleteMany({
      where: { expiresAt: { lt: new Date() }, usedAt: null },
    });
    if (count > 0) console.log(`🗑️  Removed ${count} expired invitation(s)`);
  } catch (err) {
    console.error('❌ Error expiring invitations:', err);
  }
}

/**
 * Initializes and starts all cron jobs.
 * Called once on server startup.
 */
export function startCronJobs(): void {
  console.log('⏰ Starting cron jobs...');

  // Exchange rate — daily at 8 AM UYT (11:00 UTC)
  cron.schedule('0 11 * * *', async () => {
    console.log('💱 Fetching daily exchange rate...');
    try {
      await fetchAndStoreExchangeRate();
      console.log('✅ Exchange rate updated');
    } catch (err) {
      console.error('❌ Failed to fetch exchange rate:', err);
    }
  });

  // Recurring transactions — daily at midnight UYT (03:00 UTC)
  cron.schedule('0 3 * * *', processRecurringTransactions, { timezone: 'America/Montevideo' });

  // Expire invitations — hourly
  cron.schedule('0 * * * *', expireInvitations);

  // Weekly recommendations — Sunday 10 PM UYT (01:00 UTC Monday)
  cron.schedule('0 1 * * 1', async () => {
    console.log('🤖 Generating weekly AI recommendations...');
    // Future: implement recommendations.service call here
  });

  console.log('✅ Cron jobs started');
}


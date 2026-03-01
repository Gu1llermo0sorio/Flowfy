import { prisma } from '../lib/prisma';

const API_KEY = process.env.EXCHANGE_RATE_API_KEY;
const BASE_URL = `https://v6.exchangerate-api.com/v6/${API_KEY}/pair/USD/UYU`;

/**
 * Fetches the current USD → UYU exchange rate from exchangerate-api.com
 * and stores it in the database.
 * Only fetches if there's no record for today yet (caching).
 */
export async function fetchAndStoreExchangeRate(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if we already have today's rate
  const existing = await prisma.exchangeRate.findFirst({
    where: { fromCurrency: 'USD', toCurrency: 'UYU', date: today },
  });

  if (existing) return existing.rate;

  if (!API_KEY) {
    console.warn('⚠️  EXCHANGE_RATE_API_KEY not set, using fallback rate');
    return storeFallbackRate(today);
  }

  try {
    const response = await fetch(BASE_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = (await response.json()) as { conversion_rate: number; result: string };
    if (data.result !== 'success') throw new Error('API returned non-success');

    const rate = data.conversion_rate;

    await prisma.exchangeRate.create({
      data: {
        fromCurrency: 'USD',
        toCurrency: 'UYU',
        rate,
        date: today,
        source: 'exchangerate-api',
      },
    });

    return rate;
  } catch (err) {
    console.error('exchange rate fetch failed:', err);
    return storeFallbackRate(today);
  }
}

async function storeFallbackRate(date: Date): Promise<number> {
  const FALLBACK_RATE = 39.0;
  await prisma.exchangeRate.upsert({
    where: { fromCurrency_toCurrency_date: { fromCurrency: 'USD', toCurrency: 'UYU', date } },
    update: {},
    create: {
      fromCurrency: 'USD',
      toCurrency: 'UYU',
      rate: FALLBACK_RATE,
      date,
      source: 'fallback',
    },
  });
  return FALLBACK_RATE;
}

/**
 * Returns the most recent stored exchange rate.
 */
export async function getLatestRate(): Promise<number> {
  const rate = await prisma.exchangeRate.findFirst({
    where: { fromCurrency: 'USD', toCurrency: 'UYU' },
    orderBy: { date: 'desc' },
  });
  return rate?.rate ?? 39.0;
}

/**
 * Converts an amount from USD to UYU centavos using the latest stored rate.
 */
export async function convertUSDtoUYU(amountCentavos: number): Promise<number> {
  const rate = await getLatestRate();
  return Math.round(amountCentavos * rate);
}

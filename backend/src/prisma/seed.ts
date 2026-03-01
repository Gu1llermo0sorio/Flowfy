import { PrismaClient } from '@prisma/client';
import { seedDefaultCategories } from '../services/categories.service';

const prisma = new PrismaClient();

/**
 * Seeds the database with default badges.
 * Run with: npm run db:seed
 */
async function main(): Promise<void> {
  console.log('🌱 Seeding Flowfy database...');

  // ── Seed badges ─────────────────────────────────────────────────────────────
  const badges = [
    {
      code: 'on_fire',
      name: 'On Fire',
      nameEs: 'En Llamas',
      description: 'Log transactions 7 days in a row',
      descriptionEs: 'Registrá transacciones 7 días seguidos',
      icon: '🔥',
      xpReward: 100,
      sortOrder: 1,
    },
    {
      code: 'iron_will',
      name: 'Iron Will',
      nameEs: 'Voluntad de Hierro',
      description: 'Log transactions 30 days in a row',
      descriptionEs: 'Registrá transacciones 30 días seguidos',
      icon: '💪',
      xpReward: 300,
      sortOrder: 2,
    },
    {
      code: 'food_saver',
      name: 'Food Saver',
      nameEs: 'Ahorrador de Comida',
      description: 'Spend 20% less on food than budgeted',
      descriptionEs: 'Gastá 20% menos en comida de lo presupuestado',
      icon: '🥗',
      xpReward: 150,
      sortOrder: 3,
    },
    {
      code: 'dream_achiever',
      name: 'Dream Achiever',
      nameEs: 'Cumplidor de Sueños',
      description: 'Complete a vacation savings goal',
      descriptionEs: 'Completá una meta de ahorro para vacaciones',
      icon: '✈️',
      xpReward: 200,
      sortOrder: 4,
    },
    {
      code: 'debt_slayer',
      name: 'Debt Slayer',
      nameEs: 'Mata-Deudas',
      description: 'Pay off a debt goal',
      descriptionEs: 'Pagá completamente una deuda',
      icon: '📉',
      xpReward: 250,
      sortOrder: 5,
    },
    {
      code: 'team_players',
      name: 'Team Players',
      nameEs: 'Jugadores en Equipo',
      description: 'Both members logged transactions the same week',
      descriptionEs: 'Ambos miembros registraron transacciones en la misma semana',
      icon: '🤝',
      xpReward: 75,
      sortOrder: 6,
    },
    {
      code: 'budget_master',
      name: 'Budget Master',
      nameEs: 'Maestro del Presupuesto',
      description: 'All categories under budget for a full month',
      descriptionEs: 'Todas las categorías bajo presupuesto por un mes completo',
      icon: '🎯',
      xpReward: 300,
      sortOrder: 7,
    },
    {
      code: 'receipt_hoarder',
      name: 'Receipt Hoarder',
      nameEs: 'Coleccionista de Tickets',
      description: 'Upload 50 receipts',
      descriptionEs: 'Subí 50 tickets o facturas',
      icon: '📸',
      xpReward: 100,
      sortOrder: 8,
    },
    {
      code: 'ai_listener',
      name: 'AI Listener',
      nameEs: 'Oyente de IA',
      description: 'Follow 5 AI recommendations',
      descriptionEs: 'Seguí 5 recomendaciones de la IA',
      icon: '🤖',
      xpReward: 125,
      sortOrder: 9,
    },
    {
      code: 'perfect_month',
      name: 'Perfect Month',
      nameEs: 'Mes Perfecto',
      description: 'Zero overspending all month',
      descriptionEs: 'Sin gastos excedidos en todo el mes',
      icon: '💯',
      xpReward: 500,
      sortOrder: 10,
    },
    {
      code: 'statement_pro',
      name: 'Statement Pro',
      nameEs: 'Pro del Resumen',
      description: 'Import 10 bank statements',
      descriptionEs: 'Importá 10 estados de cuenta',
      icon: '🏦',
      xpReward: 150,
      sortOrder: 11,
    },
    {
      code: 'oca_master',
      name: 'OCA Master',
      nameEs: 'Maestro OCA',
      description: 'Track all OCA installments for 3 months',
      descriptionEs: 'Seguí todas las cuotas OCA por 3 meses',
      icon: '💳',
      xpReward: 200,
      sortOrder: 12,
    },
  ];

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { code: badge.code },
      update: badge,
      create: badge,
    });
  }
  console.log(`✅ ${badges.length} badges seeded`);

  console.log('✅ Database seeded successfully!');
  console.log('\n💡 To create a test family and seed categories, register through the API.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { prisma } from '../lib/prisma';

/**
 * Default system categories with Spanish names, emojis, colors and subcategories.
 * These are seeded once per family on registration.
 */
const DEFAULT_CATEGORIES = [
  {
    name: 'Food & Dining',
    nameEs: 'Comida y Restaurantes',
    icon: '🍔',
    color: '#F59E0B',
    sortOrder: 1,
    subcategories: [
      { name: 'Supermarket', nameEs: 'Supermercado', icon: '🛒' },
      { name: 'Restaurant', nameEs: 'Restaurante', icon: '🍽️' },
      { name: 'Fast Food', nameEs: 'Comida rápida', icon: '🍟' },
      { name: 'Coffee', nameEs: 'Café', icon: '☕' },
      { name: 'Delivery', nameEs: 'Delivery', icon: '🛵' },
      { name: 'Bakery', nameEs: 'Panadería', icon: '🥖' },
      { name: 'Alcohol', nameEs: 'Alcohol', icon: '🍺' },
    ],
  },
  {
    name: 'Housing',
    nameEs: 'Hogar y Vivienda',
    icon: '🏠',
    color: '#6366F1',
    sortOrder: 2,
    subcategories: [
      { name: 'Rent/Mortgage', nameEs: 'Alquiler/Hipoteca', icon: '🏠' },
      { name: 'Electricity', nameEs: 'Electricidad', icon: '⚡' },
      { name: 'Water', nameEs: 'Agua', icon: '💧' },
      { name: 'Gas', nameEs: 'Gas', icon: '🔥' },
      { name: 'Internet', nameEs: 'Internet', icon: '📡' },
      { name: 'Phone', nameEs: 'Teléfono', icon: '📱' },
      { name: 'HOA/Maintenance', nameEs: 'Expensas/Mantenimiento', icon: '🔧' },
      { name: 'Cleaning', nameEs: 'Limpieza', icon: '🧹' },
    ],
  },
  {
    name: 'Transport',
    nameEs: 'Transporte',
    icon: '🚗',
    color: '#3B82F6',
    sortOrder: 3,
    subcategories: [
      { name: 'Fuel', nameEs: 'Combustible', icon: '⛽' },
      { name: 'Public Transit', nameEs: 'Transporte público', icon: '🚌' },
      { name: 'Taxi/Uber', nameEs: 'Taxi/Uber', icon: '🚕' },
      { name: 'Parking', nameEs: 'Estacionamiento', icon: '🅿️' },
      { name: 'Car Maintenance', nameEs: 'Mantenimiento de auto', icon: '🔩' },
      { name: 'Tolls', nameEs: 'Peajes', icon: '🛣️' },
      { name: 'Car Insurance', nameEs: 'Seguro de auto', icon: '📋' },
    ],
  },
  {
    name: 'Clothing & Personal',
    nameEs: 'Ropa y Personal',
    icon: '👕',
    color: '#EC4899',
    sortOrder: 4,
    subcategories: [
      { name: 'Clothes', nameEs: 'Ropa', icon: '👗' },
      { name: 'Shoes', nameEs: 'Calzado', icon: '👟' },
      { name: 'Accessories', nameEs: 'Accesorios', icon: '👜' },
      { name: 'Haircut', nameEs: 'Peluquería', icon: '💇' },
      { name: 'Beauty', nameEs: 'Belleza', icon: '💄' },
      { name: 'Pharmacy', nameEs: 'Farmacia', icon: '💊' },
    ],
  },
  {
    name: 'Entertainment',
    nameEs: 'Entretenimiento',
    icon: '🎬',
    color: '#8B5CF6',
    sortOrder: 5,
    subcategories: [
      { name: 'Streaming', nameEs: 'Streaming', icon: '📺' },
      { name: 'Cinema', nameEs: 'Cine', icon: '🎥' },
      { name: 'Events', nameEs: 'Eventos', icon: '🎉' },
      { name: 'Sports', nameEs: 'Deportes', icon: '⚽' },
      { name: 'Hobbies', nameEs: 'Hobbies', icon: '🎸' },
      { name: 'Books', nameEs: 'Libros', icon: '📚' },
      { name: 'Music', nameEs: 'Música', icon: '🎵' },
    ],
  },
  {
    name: 'Health',
    nameEs: 'Salud',
    icon: '🏥',
    color: '#10B981',
    sortOrder: 6,
    subcategories: [
      { name: 'Doctor', nameEs: 'Médico', icon: '🩺' },
      { name: 'Dentist', nameEs: 'Dentista', icon: '🦷' },
      { name: 'Gym', nameEs: 'Gimnasio', icon: '💪' },
      { name: 'Medicine', nameEs: 'Medicamentos', icon: '💊' },
      { name: 'Lab Tests', nameEs: 'Análisis', icon: '🧪' },
      { name: 'Health Insurance', nameEs: 'FONASA/Seguro salud', icon: '🏥' },
    ],
  },
  {
    name: 'Education',
    nameEs: 'Educación',
    icon: '📚',
    color: '#0EA5E9',
    sortOrder: 7,
    subcategories: [
      { name: 'Tuition', nameEs: 'Cuota escolar/universitaria', icon: '🎓' },
      { name: 'Books', nameEs: 'Libros y útiles', icon: '📖' },
      { name: 'Courses', nameEs: 'Cursos', icon: '💻' },
      { name: 'School Supplies', nameEs: 'Útiles escolares', icon: '✏️' },
    ],
  },
  {
    name: 'Work',
    nameEs: 'Trabajo',
    icon: '💼',
    color: '#64748B',
    sortOrder: 8,
    subcategories: [
      { name: 'Office Supplies', nameEs: 'Insumos de oficina', icon: '📎' },
      { name: 'Software', nameEs: 'Software', icon: '💿' },
      { name: 'Professional Services', nameEs: 'Servicios profesionales', icon: '📊' },
    ],
  },
  {
    name: 'Travel & Vacation',
    nameEs: 'Viajes y Vacaciones',
    icon: '✈️',
    color: '#06B6D4',
    sortOrder: 9,
    subcategories: [
      { name: 'Flights', nameEs: 'Vuelos', icon: '✈️' },
      { name: 'Hotels', nameEs: 'Hoteles', icon: '🏨' },
      { name: 'Tours', nameEs: 'Tours y excursiones', icon: '🗺️' },
      { name: 'Travel Insurance', nameEs: 'Seguro de viaje', icon: '🔐' },
    ],
  },
  {
    name: 'Pets',
    nameEs: 'Mascotas',
    icon: '🐾',
    color: '#F97316',
    sortOrder: 10,
    subcategories: [
      { name: 'Pet Food', nameEs: 'Comida para mascotas', icon: '🦴' },
      { name: 'Vet', nameEs: 'Veterinaria', icon: '🐶' },
      { name: 'Grooming', nameEs: 'Peluquería canina', icon: '✂️' },
      { name: 'Pet Accessories', nameEs: 'Accesorios', icon: '🎾' },
    ],
  },
  {
    name: 'Gifts & Donations',
    nameEs: 'Regalos y Donaciones',
    icon: '🎁',
    color: '#EF4444',
    sortOrder: 11,
    subcategories: [
      { name: 'Birthdays', nameEs: 'Cumpleaños', icon: '🎂' },
      { name: 'Holidays', nameEs: 'Fiestas', icon: '🎄' },
      { name: 'Charity', nameEs: 'Caridad/Donaciones', icon: '❤️' },
    ],
  },
  {
    name: 'Financial',
    nameEs: 'Finanzas',
    icon: '💳',
    color: '#0D9488',
    sortOrder: 12,
    subcategories: [
      { name: 'Loan Payments', nameEs: 'Cuotas de préstamo', icon: '🏦' },
      { name: 'Credit Card Fees', nameEs: 'Comisiones de tarjeta', icon: '💳' },
      { name: 'Bank Fees', nameEs: 'Comisiones bancarias', icon: '🏛️' },
      { name: 'Investments', nameEs: 'Inversiones', icon: '📈' },
      { name: 'Savings Transfers', nameEs: 'Transferencias a ahorro', icon: '💰' },
    ],
  },
  {
    name: 'Home Improvement',
    nameEs: 'Mejoras del Hogar',
    icon: '🔧',
    color: '#A78BFA',
    sortOrder: 13,
    subcategories: [
      { name: 'Furniture', nameEs: 'Muebles', icon: '🛋️' },
      { name: 'Appliances', nameEs: 'Electrodomésticos', icon: '🧊' },
      { name: 'Repairs', nameEs: 'Reparaciones', icon: '🔨' },
      { name: 'Decoration', nameEs: 'Decoración', icon: '🖼️' },
    ],
  },
  {
    name: 'Miscellaneous',
    nameEs: 'Varios',
    icon: '📦',
    color: '#94A3B8',
    sortOrder: 14,
    subcategories: [
      { name: 'Other', nameEs: 'Otro', icon: '📦' },
    ],
  },
  // Income category
  {
    name: 'Income',
    nameEs: 'Ingresos',
    icon: '💵',
    color: '#10B981',
    sortOrder: 0,
    subcategories: [
      { name: 'Salary', nameEs: 'Sueldo', icon: '💼' },
      { name: 'Freelance', nameEs: 'Freelance', icon: '💻' },
      { name: 'Rental', nameEs: 'Alquiler propio', icon: '🏘️' },
      { name: 'Investments', nameEs: 'Rendimiento inversiones', icon: '📈' },
      { name: 'Other Income', nameEs: 'Otros ingresos', icon: '💰' },
    ],
  },
];

// ── New categories to lazily add for existing families ──────────────────────
const ENSURE_CATEGORIES: typeof DEFAULT_CATEGORIES = [
  {
    name: 'Personal Care',
    nameEs: 'Cuidado Personal',
    icon: '💅',
    color: '#F472B6',
    sortOrder: 16,
    subcategories: [
      { name: 'Haircut', nameEs: 'Peluquería', icon: '💇' },
      { name: 'Beauty', nameEs: 'Belleza', icon: '💄' },
      { name: 'Pharmacy', nameEs: 'Farmacia', icon: '💊' },
      { name: 'Spa', nameEs: 'Spa / Masajes', icon: '🧖' },
      { name: 'Nails', nameEs: 'Manicura / Pedicura', icon: '💅' },
    ],
  },
];

async function ensureNewDefaults(familyId: string): Promise<void> {
  for (const cat of ENSURE_CATEGORIES) {
    const exists = await prisma.category.findFirst({ where: { familyId, nameEs: cat.nameEs } });
    if (!exists) {
      const { subcategories, ...catData } = cat;
      const created = await prisma.category.create({ data: { ...catData, familyId, isCustom: false } });
      if (subcategories.length) {
        await prisma.subcategory.createMany({
          data: subcategories.map((sub, idx) => ({ ...sub, categoryId: created.id, sortOrder: idx })),
        });
      }
    }
  }
}

/**
 * Seeds the default categories and subcategories for a newly created family.
 * Only creates system-level categories (familyId = null) once, then links.
 * For simplicity, creates family-scoped copies.
 */
export async function seedDefaultCategories(familyId: string): Promise<void> {
  for (const cat of DEFAULT_CATEGORIES) {
    const { subcategories, ...catData } = cat;

    const created = await prisma.category.create({
      data: {
        ...catData,
        familyId,
        isCustom: false,
      },
    });

    if (subcategories.length > 0) {
      await prisma.subcategory.createMany({
        data: subcategories.map((sub, idx) => ({
          name: sub.name,
          nameEs: sub.nameEs,
          icon: sub.icon,
          categoryId: created.id,
          sortOrder: idx,
        })),
      });
    }
  }
}

/**
 * Returns all categories (with subcategories) for a family.
 * Lazily creates any new default categories that weren't in the original seed.
 */
export async function getCategoriesForFamily(familyId: string) {
  await ensureNewDefaults(familyId);
  return prisma.category.findMany({
    where: {
      OR: [{ familyId }, { familyId: null, isCustom: false }],
    },
    include: {
      subcategories: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { sortOrder: 'asc' },
  });
}

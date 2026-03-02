import { prisma } from '../lib/prisma';

/**
 * Default system categories — seeded once per family on registration.
 *
 * Coherence rules (no ambiguity):
 *  · Farmacia / Medicamentos  → SOLO "Salud"
 *  · Peluquería / Spa / Estética → SOLO "Cuidado Personal"
 *  · Ropa / Calzado / Accesorios → SOLO "Ropa y Accesorios"
 *  · METLIFE / MAPFRE / seguros  → SOLO "Seguros"
 *  · Netflix / Spotify / juegos  → SOLO "Entretenimiento"
 *  · ClickUp / GitHub / SaaS     → SOLO "Trabajo y Tecnología"
 *  · STM / Uber / ANCAP          → SOLO "Transporte"
 *  · ANTEL / UTE / alquiler      → SOLO "Hogar y Vivienda"
 */
const DEFAULT_CATEGORIES = [
  // ── 0 · Ingresos ────────────────────────────────────────────────────────────
  {
    name: 'Income',
    nameEs: 'Ingresos',
    icon: '💵',
    color: '#10B981',
    sortOrder: 0,
    subcategories: [
      { name: 'Salary',             nameEs: 'Sueldo',                      icon: '💼' },
      { name: 'Freelance',          nameEs: 'Freelance / Honorarios',      icon: '💻' },
      { name: 'Rental Income',      nameEs: 'Renta de alquiler',           icon: '🏘️' },
      { name: 'Investment Returns', nameEs: 'Rendimiento de inversiones',  icon: '📈' },
      { name: 'Other Income',       nameEs: 'Otros ingresos',              icon: '💰' },
    ],
  },
  // ── 1 · Comida y Restaurantes ───────────────────────────────────────────────
  {
    name: 'Food & Dining',
    nameEs: 'Comida y Restaurantes',
    icon: '🍔',
    color: '#F59E0B',
    sortOrder: 1,
    subcategories: [
      { name: 'Supermarket',  nameEs: 'Supermercado',        icon: '🛒' },
      { name: 'Restaurant',   nameEs: 'Restaurante',         icon: '🍽️' },
      { name: 'Fast Food',    nameEs: 'Comida rápida',       icon: '🍟' },
      { name: 'Cafe',         nameEs: 'Cafetería / Café',    icon: '☕' },
      { name: 'Delivery',     nameEs: 'Delivery',            icon: '🛵' },
      { name: 'Bakery',       nameEs: 'Panadería / Almacén', icon: '🥖' },
      { name: 'Bar',          nameEs: 'Bar / Bebidas',       icon: '🍺' },
    ],
  },
  // ── 2 · Hogar y Vivienda ────────────────────────────────────────────────────
  //   Incluye todos los gastos FIJOS del hogar: alquiler, servicios, telefonía.
  //   NO incluye peajes de ruta (→ Transporte) ni compras de muebles (→ Mejoras).
  {
    name: 'Housing',
    nameEs: 'Hogar y Vivienda',
    icon: '🏠',
    color: '#6366F1',
    sortOrder: 2,
    subcategories: [
      { name: 'Rent',          nameEs: 'Alquiler',                   icon: '🏠' },
      { name: 'Electricity',   nameEs: 'Electricidad (UTE)',          icon: '⚡' },
      { name: 'Water',         nameEs: 'Agua (OSE)',                  icon: '💧' },
      { name: 'Gas',           nameEs: 'Gas',                        icon: '🔥' },
      { name: 'Internet/TV',   nameEs: 'Internet / Cable / TV',      icon: '📡' },
      { name: 'Phone',         nameEs: 'Teléfono / Telefonía móvil', icon: '📱' },
      { name: 'HOA',           nameEs: 'Expensas / Administración',  icon: '🏢' },
      { name: 'Cleaning',      nameEs: 'Limpieza / Mucama',          icon: '🧹' },
    ],
  },
  // ── 3 · Transporte ──────────────────────────────────────────────────────────
  //   Todo lo relacionado con movilidad: auto propio, público, app.
  //   Telepeaje (ACU) va aquí, NO en Hogar.
  {
    name: 'Transport',
    nameEs: 'Transporte',
    icon: '🚗',
    color: '#3B82F6',
    sortOrder: 3,
    subcategories: [
      { name: 'Fuel',           nameEs: 'Combustible',              icon: '⛽' },
      { name: 'Public Transit', nameEs: 'Transporte público (STM)', icon: '🚌' },
      { name: 'Rideshare',      nameEs: 'Taxi / Uber / Cabify',     icon: '🚕' },
      { name: 'Parking',        nameEs: 'Estacionamiento',          icon: '🅿️' },
      { name: 'Tolls',          nameEs: 'Peajes / Telepeaje',       icon: '🛣️' },
      { name: 'Car Maintenance',nameEs: 'Mantenimiento de auto',    icon: '🔩' },
      { name: 'Car Rental',     nameEs: 'Alquiler de auto',         icon: '🔑' },
    ],
  },
  // ── 4 · Ropa y Accesorios ───────────────────────────────────────────────────
  //   SOLO indumentaria, calzado y accesorios. Peluquería/belleza → Cuidado Personal.
  {
    name: 'Clothing & Accessories',
    nameEs: 'Ropa y Accesorios',
    icon: '👕',
    color: '#EC4899',
    sortOrder: 4,
    subcategories: [
      { name: 'Clothes',      nameEs: 'Ropa',                      icon: '👗' },
      { name: 'Shoes',        nameEs: 'Calzado',                   icon: '👟' },
      { name: 'Sports Gear',  nameEs: 'Ropa y equipo deportivo',   icon: '🏃' },
      { name: 'Accessories',  nameEs: 'Accesorios / Bolsos',       icon: '👜' },
    ],
  },
  // ── 5 · Cuidado Personal ────────────────────────────────────────────────────
  //   SOLO servicios de belleza y bienestar estético.
  //   Farmacia/Medicamentos → Salud. Gym/deporte → Salud.
  {
    name: 'Personal Care',
    nameEs: 'Cuidado Personal',
    icon: '💅',
    color: '#F472B6',
    sortOrder: 5,
    subcategories: [
      { name: 'Haircut',    nameEs: 'Peluquería / Barbería',      icon: '💇' },
      { name: 'Beauty',     nameEs: 'Estética / Tratamientos',    icon: '💄' },
      { name: 'Spa',        nameEs: 'Spa / Masajes',              icon: '🧖' },
      { name: 'Nails',      nameEs: 'Manicura / Pedicura',        icon: '💅' },
      { name: 'Cosmetics',  nameEs: 'Cosmética / Perfumería',     icon: '🪞' },
    ],
  },
  // ── 6 · Salud ───────────────────────────────────────────────────────────────
  //   Todo lo médico-sanitario. Farmacia va AQUÍ (no en Cuidado Personal ni Ropa).
  {
    name: 'Health',
    nameEs: 'Salud',
    icon: '🏥',
    color: '#10B981',
    sortOrder: 6,
    subcategories: [
      { name: 'Mutual/IAMC',      nameEs: 'Mutualista / IAMC',            icon: '🏥' },
      { name: 'Doctor',           nameEs: 'Médico / Consulta',            icon: '🩺' },
      { name: 'Dentist',          nameEs: 'Dentista',                     icon: '🦷' },
      { name: 'Pharmacy',         nameEs: 'Farmacia / Medicamentos',      icon: '💊' },
      { name: 'Lab Tests',        nameEs: 'Análisis / Diagnóstico',       icon: '🧪' },
      { name: 'Optics',           nameEs: 'Óptica',                       icon: '👓' },
      { name: 'Physiotherapy',    nameEs: 'Fisioterapia / Kinesiología',  icon: '🦴' },
      { name: 'Gym',              nameEs: 'Gimnasio / Actividad física',  icon: '💪' },
    ],
  },
  // ── 7 · Entretenimiento ─────────────────────────────────────────────────────
  //   Ocio, cultura y hobbies para uso personal. Herramientas de trabajo → Trabajo y Tec.
  {
    name: 'Entertainment',
    nameEs: 'Entretenimiento',
    icon: '🎬',
    color: '#8B5CF6',
    sortOrder: 7,
    subcategories: [
      { name: 'Streaming',  nameEs: 'Streaming (Netflix, Spotify…)', icon: '📺' },
      { name: 'Cinema',     nameEs: 'Cine / Teatro',                 icon: '🎥' },
      { name: 'Events',     nameEs: 'Conciertos / Eventos',          icon: '🎉' },
      { name: 'Gaming',     nameEs: 'Videojuegos',                   icon: '🎮' },
      { name: 'Books',      nameEs: 'Libros / Revistas',             icon: '📚' },
      { name: 'Hobbies',    nameEs: 'Hobbies / Artesanías',          icon: '🎸' },
    ],
  },
  // ── 8 · Educación ───────────────────────────────────────────────────────────
  {
    name: 'Education',
    nameEs: 'Educación',
    icon: '🎓',
    color: '#0EA5E9',
    sortOrder: 8,
    subcategories: [
      { name: 'Tuition',         nameEs: 'Cuota escolar / universitaria', icon: '🎓' },
      { name: 'Study Books',     nameEs: 'Libros de estudio / material',  icon: '📖' },
      { name: 'Courses',         nameEs: 'Cursos / Capacitación',         icon: '💻' },
      { name: 'Languages',       nameEs: 'Idiomas',                       icon: '🌐' },
      { name: 'School Supplies', nameEs: 'Útiles escolares',              icon: '✏️' },
    ],
  },
  // ── 9 · Trabajo y Tecnología ────────────────────────────────────────────────
  //   SaaS, herramientas, insumos de trabajo. Netflix/Spotify → Entretenimiento.
  {
    name: 'Work & Technology',
    nameEs: 'Trabajo y Tecnología',
    icon: '💼',
    color: '#64748B',
    sortOrder: 9,
    subcategories: [
      { name: 'Software',          nameEs: 'Software y herramientas', icon: '💻' },
      { name: 'Cloud/Hosting',     nameEs: 'Cloud / Hosting',         icon: '☁️' },
      { name: 'Office Supplies',   nameEs: 'Insumos de oficina',      icon: '📎' },
      { name: 'Prof. Services',    nameEs: 'Servicios profesionales', icon: '📊' },
    ],
  },
  // ── 10 · Viajes y Vacaciones ────────────────────────────────────────────────
  {
    name: 'Travel & Vacation',
    nameEs: 'Viajes y Vacaciones',
    icon: '✈️',
    color: '#06B6D4',
    sortOrder: 10,
    subcategories: [
      { name: 'Flights',         nameEs: 'Vuelos',                    icon: '✈️' },
      { name: 'Hotels',          nameEs: 'Hoteles / Alojamiento',     icon: '🏨' },
      { name: 'Car Rental',      nameEs: 'Alquiler de auto (viaje)',  icon: '🔑' },
      { name: 'Transit',         nameEs: 'Transporte en destino',     icon: '🚌' },
      { name: 'Tours',           nameEs: 'Tours y actividades',       icon: '🗺️' },
      { name: 'Travel Insurance',nameEs: 'Seguro de viaje',           icon: '🔐' },
    ],
  },
  // ── 11 · Mascotas ───────────────────────────────────────────────────────────
  {
    name: 'Pets',
    nameEs: 'Mascotas',
    icon: '🐾',
    color: '#F97316',
    sortOrder: 11,
    subcategories: [
      { name: 'Pet Food',       nameEs: 'Comida para mascotas',   icon: '🦴' },
      { name: 'Vet',            nameEs: 'Veterinaria',            icon: '🐶' },
      { name: 'Pet Grooming',   nameEs: 'Peluquería canina',      icon: '✂️' },
      { name: 'Pet Accessories',nameEs: 'Accesorios para mascotas',icon:'🎾' },
    ],
  },
  // ── 12 · Mejoras del Hogar ──────────────────────────────────────────────────
  {
    name: 'Home Improvement',
    nameEs: 'Mejoras del Hogar',
    icon: '🔧',
    color: '#A78BFA',
    sortOrder: 12,
    subcategories: [
      { name: 'Furniture',    nameEs: 'Muebles',                    icon: '🛋️' },
      { name: 'Appliances',   nameEs: 'Electrodomésticos',          icon: '🧊' },
      { name: 'Repairs',      nameEs: 'Reparaciones',               icon: '🔨' },
      { name: 'Decoration',   nameEs: 'Decoración',                 icon: '🖼️' },
      { name: 'Hardware',     nameEs: 'Ferretería / Materiales',    icon: '🪛' },
    ],
  },
  // ── 13 · Regalos y Donaciones ───────────────────────────────────────────────
  {
    name: 'Gifts & Donations',
    nameEs: 'Regalos y Donaciones',
    icon: '🎁',
    color: '#EF4444',
    sortOrder: 13,
    subcategories: [
      { name: 'Gifts',       nameEs: 'Regalos',                  icon: '🎂' },
      { name: 'Experiences', nameEs: 'Regalos de experiencia',   icon: '🎟️' },
      { name: 'Charity',     nameEs: 'Caridad / Donaciones',     icon: '❤️' },
    ],
  },
  // ── 14 · Seguros ────────────────────────────────────────────────────────────
  //   METLIFE, MAPFRE, SANCOR, BSE → aquí. NO en Finanzas ni en Salud.
  {
    name: 'Insurance',
    nameEs: 'Seguros',
    icon: '🛡️',
    color: '#78716C',
    sortOrder: 14,
    subcategories: [
      { name: 'Life Insurance',   nameEs: 'Seguro de vida',          icon: '💛' },
      { name: 'Car Insurance',    nameEs: 'Seguro de auto',          icon: '🚗' },
      { name: 'Home Insurance',   nameEs: 'Seguro de hogar',         icon: '🏠' },
      { name: 'Health Insurance', nameEs: 'Seguro de salud privado', icon: '🏥' },
      { name: 'Other Insurance',  nameEs: 'Otros seguros',           icon: '🛡️' },
    ],
  },
  // ── 15 · Finanzas ───────────────────────────────────────────────────────────
  //   Comisiones, intereses y cargos bancarios/tarjeta. Seguros → categoría propia.
  {
    name: 'Financial',
    nameEs: 'Finanzas',
    icon: '💳',
    color: '#0D9488',
    sortOrder: 15,
    subcategories: [
      { name: 'Loan Payments',   nameEs: 'Cuotas de préstamo',      icon: '🏦' },
      { name: 'Card Fees',       nameEs: 'Comisiones de tarjeta',   icon: '💳' },
      { name: 'Bank Fees',       nameEs: 'Comisiones bancarias',    icon: '🏛️' },
      { name: 'Card Interest',   nameEs: 'Intereses de tarjeta',    icon: '📊' },
      { name: 'Investments',     nameEs: 'Inversiones',             icon: '📈' },
    ],
  },
  // ── 16 · Varios ─────────────────────────────────────────────────────────────
  {
    name: 'Miscellaneous',
    nameEs: 'Varios',
    icon: '📦',
    color: '#94A3B8',
    sortOrder: 16,
    subcategories: [
      { name: 'Other', nameEs: 'Otro', icon: '📦' },
    ],
  },
];

// ── Migration helpers ────────────────────────────────────────────────────────

/** Add subcategories that don't yet exist in a category. */
async function ensureSubs(
  categoryId: string,
  subs: Array<{ name: string; nameEs: string; icon: string; sortOrder: number }>,
): Promise<void> {
  const existing = await prisma.subcategory.findMany({ where: { categoryId } });
  const existingNames = new Set(existing.map((s) => s.nameEs));
  for (const sub of subs) {
    if (!existingNames.has(sub.nameEs)) {
      await prisma.subcategory.create({ data: { ...sub, categoryId } });
    }
  }
}

/**
 * Migration applied lazily on every getCategoriesForFamily() call.
 * Idempotent — safe to run multiple times.
 */
async function ensureNewDefaults(familyId: string): Promise<void> {
  // ── 1. Rename "Ropa y Personal" → "Ropa y Accesorios" ─────────────────────
  await prisma.category.updateMany({
    where: { familyId, nameEs: 'Ropa y Personal' },
    data: { name: 'Clothing & Accessories', nameEs: 'Ropa y Accesorios' },
  });

  // ── 2. Clean "Ropa y Accesorios": remove misplaced subcategories ───────────
  const ropaCat = await prisma.category.findFirst({ where: { familyId, nameEs: 'Ropa y Accesorios' } });
  if (ropaCat) {
    await prisma.subcategory.deleteMany({
      where: { categoryId: ropaCat.id, nameEs: { in: ['Peluquería', 'Belleza', 'Farmacia'] } },
    });
    await ensureSubs(ropaCat.id, [
      { name: 'Sports Gear', nameEs: 'Ropa y equipo deportivo', icon: '🏃', sortOrder: 3 },
      { name: 'Accessories', nameEs: 'Accesorios / Bolsos', icon: '👜', sortOrder: 4 },
    ]);
  }

  // ── 3. Rename "Trabajo" → "Trabajo y Tecnología" ─────────────────────────
  await prisma.category.updateMany({
    where: { familyId, nameEs: 'Trabajo' },
    data: { name: 'Work & Technology', nameEs: 'Trabajo y Tecnología' },
  });

  // ── 4. Expand "Trabajo y Tecnología" subcategories ────────────────────────
  const trabajoCat = await prisma.category.findFirst({ where: { familyId, nameEs: 'Trabajo y Tecnología' } });
  if (!trabajoCat) {
    const created = await prisma.category.create({
      data: { name: 'Work & Technology', nameEs: 'Trabajo y Tecnología', icon: '💼', color: '#64748B', sortOrder: 9, familyId, isCustom: false },
    });
    await ensureSubs(created.id, [
      { name: 'Software',        nameEs: 'Software y herramientas', icon: '💻', sortOrder: 0 },
      { name: 'Cloud/Hosting',   nameEs: 'Cloud / Hosting',         icon: '☁️', sortOrder: 1 },
      { name: 'Office Supplies', nameEs: 'Insumos de oficina',      icon: '📎', sortOrder: 2 },
      { name: 'Prof. Services',  nameEs: 'Servicios profesionales', icon: '📊', sortOrder: 3 },
    ]);
  } else {
    await ensureSubs(trabajoCat.id, [
      { name: 'Software',      nameEs: 'Software y herramientas', icon: '💻', sortOrder: 0 },
      { name: 'Cloud/Hosting', nameEs: 'Cloud / Hosting',         icon: '☁️', sortOrder: 1 },
    ]);
  }

  // ── 5. Ensure "Cuidado Personal" (clean — no Farmacia) ──────────────────
  let cuidadoCat = await prisma.category.findFirst({ where: { familyId, nameEs: 'Cuidado Personal' } });
  if (!cuidadoCat) {
    cuidadoCat = await prisma.category.create({
      data: { name: 'Personal Care', nameEs: 'Cuidado Personal', icon: '💅', color: '#F472B6', sortOrder: 5, familyId, isCustom: false },
    });
  }
  // Remove Farmacia if it ended up here from a previous seed
  await prisma.subcategory.deleteMany({
    where: { categoryId: cuidadoCat.id, nameEs: { in: ['Farmacia', 'Pharmacy'] } },
  });
  await ensureSubs(cuidadoCat.id, [
    { name: 'Haircut',   nameEs: 'Peluquería / Barbería',   icon: '💇', sortOrder: 0 },
    { name: 'Beauty',    nameEs: 'Estética / Tratamientos', icon: '💄', sortOrder: 1 },
    { name: 'Spa',       nameEs: 'Spa / Masajes',           icon: '🧖', sortOrder: 2 },
    { name: 'Nails',     nameEs: 'Manicura / Pedicura',     icon: '💅', sortOrder: 3 },
    { name: 'Cosmetics', nameEs: 'Cosmética / Perfumería',  icon: '🪞', sortOrder: 4 },
  ]);

  // ── 6. Expand "Salud" — canonical home of Farmacia ───────────────────────
  const saludCat = await prisma.category.findFirst({ where: { familyId, nameEs: 'Salud' } });
  if (saludCat) {
    // Rename old subcategory names for clarity
    await prisma.subcategory.updateMany({
      where: { categoryId: saludCat.id, nameEs: 'Farmacia' },
      data: { nameEs: 'Farmacia / Medicamentos' },
    });
    await prisma.subcategory.updateMany({
      where: { categoryId: saludCat.id, nameEs: 'Medicamentos' },
      data: { nameEs: 'Farmacia / Medicamentos' },
    });
    await prisma.subcategory.updateMany({
      where: { categoryId: saludCat.id, nameEs: 'FONASA/Seguro salud' },
      data: { nameEs: 'Mutualista / IAMC' },
    });
    await ensureSubs(saludCat.id, [
      { name: 'Mutual/IAMC',   nameEs: 'Mutualista / IAMC',           icon: '🏥', sortOrder: 0 },
      { name: 'Pharmacy',      nameEs: 'Farmacia / Medicamentos',     icon: '💊', sortOrder: 3 },
      { name: 'Optics',        nameEs: 'Óptica',                      icon: '👓', sortOrder: 6 },
      { name: 'Physiotherapy', nameEs: 'Fisioterapia / Kinesiología', icon: '🦴', sortOrder: 7 },
    ]);
  }

  // ── 7. Add "Seguros" category ────────────────────────────────────────────
  const segurosCat = await prisma.category.findFirst({ where: { familyId, nameEs: 'Seguros' } });
  if (!segurosCat) {
    const created = await prisma.category.create({
      data: { name: 'Insurance', nameEs: 'Seguros', icon: '🛡️', color: '#78716C', sortOrder: 14, familyId, isCustom: false },
    });
    await ensureSubs(created.id, [
      { name: 'Life Insurance',   nameEs: 'Seguro de vida',          icon: '💛', sortOrder: 0 },
      { name: 'Car Insurance',    nameEs: 'Seguro de auto',          icon: '🚗', sortOrder: 1 },
      { name: 'Home Insurance',   nameEs: 'Seguro de hogar',         icon: '🏠', sortOrder: 2 },
      { name: 'Health Insurance', nameEs: 'Seguro de salud privado', icon: '🏥', sortOrder: 3 },
      { name: 'Other Insurance',  nameEs: 'Otros seguros',           icon: '🛡️', sortOrder: 4 },
    ]);
  }

  // ── 8. Expand "Finanzas" ─────────────────────────────────────────────────
  const finanzasCat = await prisma.category.findFirst({ where: { familyId, nameEs: 'Finanzas' } });
  if (finanzasCat) {
    // Remove "Transferencias a ahorro" — no es un gasto categorizable
    await prisma.subcategory.deleteMany({
      where: { categoryId: finanzasCat.id, nameEs: 'Transferencias a ahorro' },
    });
    await ensureSubs(finanzasCat.id, [
      { name: 'Card Interest', nameEs: 'Intereses de tarjeta', icon: '📊', sortOrder: 4 },
    ]);
  }

  // ── 9. Expand "Hogar y Vivienda" subcategory labels ──────────────────────
  const hogarCat = await prisma.category.findFirst({ where: { familyId, nameEs: 'Hogar y Vivienda' } });
  if (hogarCat) {
    await prisma.subcategory.updateMany({
      where: { categoryId: hogarCat.id, nameEs: 'Alquiler/Hipoteca' },
      data: { nameEs: 'Alquiler' },
    });
    await prisma.subcategory.updateMany({
      where: { categoryId: hogarCat.id, nameEs: 'Internet' },
      data: { nameEs: 'Internet / Cable / TV' },
    });
    await prisma.subcategory.updateMany({
      where: { categoryId: hogarCat.id, nameEs: 'Expensas/Mantenimiento' },
      data: { nameEs: 'Expensas / Administración' },
    });
    await prisma.subcategory.updateMany({
      where: { categoryId: hogarCat.id, nameEs: 'Teléfono' },
      data: { nameEs: 'Teléfono / Telefonía móvil' },
    });
  }

  // ── 10. Transporte: rename Taxi/Uber + add Alquiler de auto ──────────────
  const transCat = await prisma.category.findFirst({ where: { familyId, nameEs: 'Transporte' } });
  if (transCat) {
    await prisma.subcategory.updateMany({
      where: { categoryId: transCat.id, nameEs: 'Taxi/Uber' },
      data: { nameEs: 'Taxi / Uber / Cabify' },
    });
    await prisma.subcategory.updateMany({
      where: { categoryId: transCat.id, nameEs: 'Peajes' },
      data: { nameEs: 'Peajes / Telepeaje' },
    });
    await ensureSubs(transCat.id, [
      { name: 'Car Rental', nameEs: 'Alquiler de auto', icon: '🔑', sortOrder: 7 },
    ]);
  }

  // ── 11. Mejoras del Hogar: add Ferretería ─────────────────────────────────
  const mejCat = await prisma.category.findFirst({ where: { familyId, nameEs: 'Mejoras del Hogar' } });
  if (mejCat) {
    await ensureSubs(mejCat.id, [
      { name: 'Hardware', nameEs: 'Ferretería / Materiales', icon: '🪛', sortOrder: 5 },
    ]);
  }

  // ── 12. Entretenimiento: replace "Music" with "Gaming", clean up ─────────
  const entCat = await prisma.category.findFirst({ where: { familyId, nameEs: 'Entretenimiento' } });
  if (entCat) {
    await ensureSubs(entCat.id, [
      { name: 'Gaming', nameEs: 'Videojuegos', icon: '🎮', sortOrder: 5 },
    ]);
    await prisma.subcategory.updateMany({
      where: { categoryId: entCat.id, nameEs: 'Deportes' },
      data: { nameEs: 'Actividades deportivas' },
    });
  }

  // ── 13. Educación: add Idiomas ────────────────────────────────────────────
  const eduCat = await prisma.category.findFirst({ where: { familyId, nameEs: 'Educación' } });
  if (eduCat) {
    await ensureSubs(eduCat.id, [
      { name: 'Languages', nameEs: 'Idiomas', icon: '🌐', sortOrder: 4 },
    ]);
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

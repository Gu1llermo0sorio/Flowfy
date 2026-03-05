import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createError } from '../middleware/errorHandler';
import { getCategoriesForFamily } from '../services/categories.service';

export const categoryRouter = Router();
categoryRouter.use(authenticate);

const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  nameEs: z.string().min(1).max(50),
  icon: z.string().min(1).max(10),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color debe ser un hex válido'),
});

const createSubcategorySchema = z.object({
  name: z.string().min(1).max(50),
  nameEs: z.string().min(1).max(50),
  icon: z.string().optional(),
});

// GET /api/categories
categoryRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const categories = await getCategoriesForFamily(req.familyId!);
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
});

// GET /api/categories/:id
categoryRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const category = await prisma.category.findFirst({
      where: {
        id: req.params.id,
        OR: [{ familyId: req.familyId }, { familyId: null }],
      },
      include: { subcategories: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!category) throw createError('Categoría no encontrada', 404, 'NOT_FOUND');
    res.json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
});

// POST /api/categories — create custom category
categoryRouter.post('/', validate(createCategorySchema), async (req: AuthRequest, res, next) => {
  try {
    const data = req.body as z.infer<typeof createCategorySchema>;

    // Check current count of custom categories for this family
    const count = await prisma.category.count({
      where: { familyId: req.familyId, isCustom: true },
    });
    if (count >= 20) throw createError('Máximo 20 categorías personalizadas', 400, 'LIMIT_REACHED');

    const category = await prisma.category.create({
      data: { ...data, familyId: req.familyId, isCustom: true },
    });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/categories/:id — update custom category
categoryRouter.patch('/:id', validate(createCategorySchema.partial()), async (req: AuthRequest, res, next) => {
  try {
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, familyId: req.familyId, isCustom: true },
    });
    if (!category) throw createError('Categoría no encontrada o no editable', 404, 'NOT_FOUND');

    const updated = await prisma.category.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/categories/:id — delete custom category only
categoryRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, familyId: req.familyId, isCustom: true },
    });
    if (!category) throw createError('Categoría no encontrada o no eliminable', 404, 'NOT_FOUND');

    const txCount = await prisma.transaction.count({ where: { categoryId: req.params.id } });
    if (txCount > 0)
      throw createError(
        `No se puede eliminar: hay ${txCount} transacciones usando esta categoría`,
        400,
        'CATEGORY_IN_USE'
      );

    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Categoría eliminada' });
  } catch (err) {
    next(err);
  }
});

// POST /api/categories/:id/subcategories
categoryRouter.post(
  '/:id/subcategories',
  validate(createSubcategorySchema),
  async (req: AuthRequest, res, next) => {
    try {
      const category = await prisma.category.findFirst({
        where: {
          id: req.params.id,
          OR: [{ familyId: req.familyId }, { familyId: null }],
        },
      });
      if (!category) throw createError('Categoría no encontrada', 404, 'NOT_FOUND');

      const subcategory = await prisma.subcategory.create({
        data: { ...req.body, categoryId: req.params.id },
      });
      res.status(201).json({ success: true, data: subcategory });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/categories/:id/subcategories/:subId — edit subcategory
categoryRouter.patch(
  '/:id/subcategories/:subId',
  validate(createSubcategorySchema.partial()),
  async (req: AuthRequest, res, next) => {
    try {
      const category = await prisma.category.findFirst({
        where: {
          id: req.params.id,
          OR: [{ familyId: req.familyId }, { familyId: null }],
        },
      });
      if (!category) throw createError('Categoría no encontrada', 404, 'NOT_FOUND');

      const subcategory = await prisma.subcategory.findFirst({
        where: { id: req.params.subId, categoryId: req.params.id },
      });
      if (!subcategory) throw createError('Subcategoría no encontrada', 404, 'NOT_FOUND');

      const updated = await prisma.subcategory.update({
        where: { id: req.params.subId },
        data: req.body,
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/categories/:id/subcategories/:subId — delete subcategory
categoryRouter.delete('/:id/subcategories/:subId', async (req: AuthRequest, res, next) => {
  try {
    const category = await prisma.category.findFirst({
      where: {
        id: req.params.id,
        OR: [{ familyId: req.familyId }, { familyId: null }],
      },
    });
    if (!category) throw createError('Categoría no encontrada', 404, 'NOT_FOUND');

    const subcategory = await prisma.subcategory.findFirst({
      where: { id: req.params.subId, categoryId: req.params.id },
    });
    if (!subcategory) throw createError('Subcategoría no encontrada', 404, 'NOT_FOUND');

    // Check if subcategory has transactions
    const txCount = await prisma.transaction.count({ where: { subcategoryId: req.params.subId } });
    if (txCount > 0) {
      throw createError(
        `No se puede eliminar: hay ${txCount} transacciones usando esta subcategoría`,
        400,
        'SUBCATEGORY_IN_USE'
      );
    }

    await prisma.subcategory.delete({ where: { id: req.params.subId } });
    res.json({ success: true, message: 'Subcategoría eliminada' });
  } catch (err) {
    next(err);
  }
});

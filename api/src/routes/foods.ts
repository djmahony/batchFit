import { Router } from 'express';

import { requireAuth } from '../auth/requireAuth.js';
import { prisma } from '../prisma.js';

export const foodsRouter = Router();

foodsRouter.use(requireAuth);

// A food is visible to a user if it's a shared reference food (no owner) or their own.
const visibleTo = (userId: string) => ({ OR: [{ ownerId: null }, { ownerId: userId }] });

// GET /foods — reference foods + the caller's custom foods.
// GET /foods?query= — search the same set by name or brand (SQLite LIKE is
// case-insensitive for ASCII, which covers our food names).
foodsRouter.get('/', async (req, res) => {
  const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
  const foods = await prisma.food.findMany({
    where: {
      AND: [
        visibleTo(req.userId!),
        query === ''
          ? {}
          : { OR: [{ name: { contains: query } }, { brand: { contains: query } }] },
      ],
    },
    orderBy: { name: 'asc' },
    take: 50,
  });
  res.json({ foods });
});

// GET /foods/recent — the caller's most recently logged foods, newest first,
// one row per food (feeds the add-food "Recents" tab).
foodsRouter.get('/recent', async (req, res) => {
  const recents = await prisma.logEntry.findMany({
    where: { userId: req.userId, foodId: { not: null } },
    orderBy: { createdAt: 'desc' },
    distinct: ['foodId'],
    take: 20,
    select: { foodId: true },
  });
  const ids = recents.map((r) => r.foodId!);
  const foods = await prisma.food.findMany({
    where: { id: { in: ids }, ...visibleTo(req.userId!) },
  });
  const byId = new Map(foods.map((f) => [f.id, f]));
  res.json({ foods: ids.map((id) => byId.get(id)).filter(Boolean) });
});

// GET /foods/barcode/:code — look up a scanned barcode. Checks our own DB
// first (a prior scan by any user, or the caller's own manual fallback entry)
// before ever calling Open Food Facts — it rate-limits product lookups and
// its own docs ask integrators to cache rather than re-query. A successful
// OFF lookup is cached as a *shared* food (ownerId null) so the next scan of
// the same product, by anyone, never leaves our database. 404 means "not
// found anywhere" — the client falls back to manual entry.
foodsRouter.get('/barcode/:code', async (req, res) => {
  const code = req.params.code.trim();
  if (code === '') {
    return res.status(400).json({ error: 'barcode is required' });
  }

  const cached = await prisma.food.findFirst({
    where: { barcode: code, ...visibleTo(req.userId!) },
  });
  if (cached) return res.json({ food: cached });

  let product: Record<string, unknown> | null = null;
  try {
    const offRes = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,nutriments`,
    );
    const body = await offRes.json();
    if (body?.status === 1 && body.product) product = body.product;
  } catch {
    // Network failure or bad response — treated the same as "not found".
  }

  const name = typeof product?.product_name === 'string' ? product.product_name.trim() : '';
  const nutriments = (product?.nutriments ?? {}) as Record<string, unknown>;
  const kcal = nutriments['energy-kcal_100g'];
  const protein = nutriments['proteins_100g'];
  const fat = nutriments['fat_100g'];
  const carbs = nutriments['carbohydrates_100g'];
  const fibre = nutriments['fiber_100g'];
  const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

  if (name === '' || !isNum(kcal) || !isNum(protein) || !isNum(fat) || !isNum(carbs)) {
    return res.status(404).json({ error: 'not found' });
  }

  const brand = typeof product?.brands === 'string' && product.brands.trim() !== '' ? product.brands.split(',')[0].trim() : null;

  try {
    const food = await prisma.food.create({
      data: {
        name,
        brand,
        barcode: code,
        ownerId: null,
        kcal,
        protein,
        fat,
        carbs,
        fibre: isNum(fibre) ? fibre : 0,
      },
    });
    res.status(201).json({ food });
  } catch {
    // Another request cached the same barcode first (unique constraint), or
    // it collided with someone else's *private* food (barcode is globally
    // unique regardless of visibility) — only ever return a match actually
    // visible to this caller, same as the cache check above.
    const existing = await prisma.food.findFirst({
      where: { barcode: code, ...visibleTo(req.userId!) },
    });
    if (existing) return res.json({ food: existing });
    res.status(404).json({ error: 'not found' });
  }
});

// GET /foods/:id — a single visible food (reference or the caller's own).
foodsRouter.get('/:id', async (req, res) => {
  const food = await prisma.food.findFirst({
    where: { id: req.params.id, ...visibleTo(req.userId!) },
  });
  if (!food) return res.status(404).json({ error: 'food not found' });
  res.json({ food });
});

const MACROS = ['kcal', 'protein', 'fat', 'carbs', 'fibre'] as const;

// POST /foods — create a custom food owned by the caller (macros are per
// 100g). `barcode` is optional — set when this is the "not found on Open
// Food Facts, fill it in yourself" fallback after a scan, so a second scan
// recognises it. Stays owned by the caller either way; not shared globally.
foodsRouter.post('/', async (req, res) => {
  const { name, brand, barcode } = req.body ?? {};
  if (typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' });
  }
  if (barcode !== undefined && barcode !== null && (typeof barcode !== 'string' || barcode.trim() === '')) {
    return res.status(400).json({ error: 'barcode must be a non-empty string' });
  }

  const macros: Record<string, number> = {};
  for (const key of MACROS) {
    const value = req.body?.[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return res.status(400).json({ error: `${key} must be a non-negative number` });
    }
    macros[key] = value;
  }

  const data = {
    name: name.trim(),
    brand: typeof brand === 'string' && brand.trim() !== '' ? brand.trim() : null,
    barcode: typeof barcode === 'string' ? barcode.trim() : null,
    ownerId: req.userId!,
    kcal: macros.kcal,
    protein: macros.protein,
    fat: macros.fat,
    carbs: macros.carbs,
    fibre: macros.fibre,
  };

  try {
    const food = await prisma.food.create({ data });
    res.status(201).json({ food });
  } catch {
    // Someone else's private entry already claimed this barcode (globally
    // unique regardless of visibility) — save the food anyway, just without
    // tagging it, rather than block the user over a rare collision.
    const food = await prisma.food.create({ data: { ...data, barcode: null } });
    res.status(201).json({ food });
  }
});

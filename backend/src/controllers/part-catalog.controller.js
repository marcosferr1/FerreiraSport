const db = require('../../models');

const PartCatalog = db.PartCatalog;
const { Op } = db.Sequelize;

async function listPartCatalog(req, res, next) {
  try {
    const { q, active, page, pageSize } = req.query;
    const where = {};

    const pageNum = Math.max(1, Number(page) || 1);
    const sizeNum = Math.max(1, Math.min(100, Number(pageSize) || 20));
    const offset = (pageNum - 1) * sizeNum;
    if (q) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${String(q).trim()}%` } },
        { brand: { [Op.iLike]: `%${String(q).trim()}%` } },
        { sku: { [Op.iLike]: `%${String(q).trim()}%` } },
      ];
    }
    if (active === 'true') where.active = true;
    if (active === 'false') where.active = false;

    const { rows, count } = await PartCatalog.findAndCountAll({
      where,
      order: [['name', 'ASC']],
      limit: sizeNum,
      offset,
    });
    return res.json({
      data: rows,
      meta: {
        page: pageNum,
        pageSize: sizeNum,
        total: count,
        totalPages: Math.max(1, Math.ceil(count / sizeNum)),
      },
    });
  } catch (e) {
    return next(e);
  }
}

async function createPartCatalog(req, res, next) {
  try {
    const { name, brand, sku, description, suggestedPrice, active } = req.body || {};
    const cleanName = String(name || '').trim();
    if (!cleanName) return res.status(400).json({ error: 'name requerido' });

    const where = {
      name: cleanName,
      brand: brand ? String(brand).trim() : null,
      sku: sku ? String(sku).trim() : null,
    };

    const [row] = await PartCatalog.findOrCreate({
      where,
      defaults: {
        ...where,
        description: description || null,
        suggestedPrice: suggestedPrice ?? null,
        active: active == null ? true : Boolean(active),
      },
    });

    return res.status(201).json({ data: row });
  } catch (e) {
    return next(e);
  }
}

async function updatePartCatalog(req, res, next) {
  try {
    const row = await PartCatalog.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Repuesto no encontrado' });

    const { name, brand, sku, description, suggestedPrice, active } = req.body || {};
    const next = {};
    if (name !== undefined) {
      const cleanName = String(name || '').trim();
      if (!cleanName) return res.status(400).json({ error: 'name inválido' });
      next.name = cleanName;
    }
    if (brand !== undefined) next.brand = brand ? String(brand).trim() : null;
    if (sku !== undefined) next.sku = sku ? String(sku).trim() : null;
    if (description !== undefined) next.description = description || null;
    if (suggestedPrice !== undefined) next.suggestedPrice = suggestedPrice === null || suggestedPrice === '' ? null : Number(suggestedPrice);
    if (active !== undefined) next.active = Boolean(active);

    await row.update(next);
    return res.json({ data: row });
  } catch (e) {
    return next(e);
  }
}

async function deletePartCatalog(req, res, next) {
  try {
    const row = await PartCatalog.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Repuesto no encontrado' });
    await row.destroy();
    return res.json({ data: { id: req.params.id, deleted: true } });
  } catch (e) {
    return next(e);
  }
}

module.exports = { listPartCatalog, createPartCatalog, updatePartCatalog, deletePartCatalog };

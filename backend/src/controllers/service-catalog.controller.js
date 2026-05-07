const db = require('../../models');

const ServiceCatalog = db.ServiceCatalog;
const { Op } = db.Sequelize;

async function listServiceCatalog(req, res, next) {
  try {
    const { q, active, page, pageSize } = req.query;
    const where = {};

    const pageNum = Math.max(1, Number(page) || 1);
    const sizeNum = Math.max(1, Math.min(100, Number(pageSize) || 20));
    const offset = (pageNum - 1) * sizeNum;
    if (q) where.name = { [Op.iLike]: `%${String(q).trim()}%` };
    if (active === 'true') where.active = true;
    if (active === 'false') where.active = false;

    const { rows, count } = await ServiceCatalog.findAndCountAll({
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

async function createServiceCatalog(req, res, next) {
  try {
    const { name, description, suggestedPrice, active } = req.body || {};
    const cleanName = String(name || '').trim();
    if (!cleanName) return res.status(400).json({ error: 'name requerido' });

    const [row] = await ServiceCatalog.findOrCreate({
      where: { name: cleanName },
      defaults: {
        name: cleanName,
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

async function updateServiceCatalog(req, res, next) {
  try {
    const row = await ServiceCatalog.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Servicio no encontrado' });

    const { name, description, suggestedPrice, active } = req.body || {};
    const next = {};
    if (name !== undefined) {
      const cleanName = String(name || '').trim();
      if (!cleanName) return res.status(400).json({ error: 'name inválido' });
      next.name = cleanName;
    }
    if (description !== undefined) next.description = description || null;
    if (suggestedPrice !== undefined) next.suggestedPrice = suggestedPrice === null || suggestedPrice === '' ? null : Number(suggestedPrice);
    if (active !== undefined) next.active = Boolean(active);

    await row.update(next);
    return res.json({ data: row });
  } catch (e) {
    return next(e);
  }
}

async function deleteServiceCatalog(req, res, next) {
  try {
    const row = await ServiceCatalog.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Servicio no encontrado' });
    await row.destroy();
    return res.json({ data: { id: req.params.id, deleted: true } });
  } catch (e) {
    return next(e);
  }
}

module.exports = { listServiceCatalog, createServiceCatalog, updateServiceCatalog, deleteServiceCatalog };

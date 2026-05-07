const db = require('../../models');

const { VehicleBrand, VehicleModel, Sequelize } = db;
const { Op } = Sequelize;

async function listBrands(req, res, next) {
  try {
    const { q } = req.query;
    const where = {};
    if (q && String(q).trim()) {
      where.name = { [Op.iLike]: `%${String(q).trim()}%` };
    }

    const rows = await VehicleBrand.findAll({
      where,
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });

    return res.json({ data: rows });
  } catch (e) {
    return next(e);
  }
}

async function listModelsByBrand(req, res, next) {
  try {
    const { brandId } = req.params;
    const { q } = req.query;

    const brand = await VehicleBrand.findByPk(brandId, { attributes: ['id'] });
    if (!brand) return res.status(404).json({ error: 'Marca no encontrada' });

    const where = { vehicleBrandId: brandId };
    if (q && String(q).trim()) {
      where.name = { [Op.iLike]: `%${String(q).trim()}%` };
    }

    const rows = await VehicleModel.findAll({
      where,
      attributes: ['id', 'name', 'vehicleBrandId'],
      order: [['name', 'ASC']],
    });

    return res.json({ data: rows });
  } catch (e) {
    return next(e);
  }
}

module.exports = { listBrands, listModelsByBrand };

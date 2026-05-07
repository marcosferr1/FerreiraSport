const db = require('../../models');

const Customer = db.Customer;

function getSearchWhere({ type, q }) {
  const where = {};
  if (type) where.type = type;
  if (q) {
    // Búsqueda simple por nombre / email / doc.
    const { Op } = db.Sequelize;
    where[Op.or] = [
      { name: { [Op.iLike]: `%${q}%` } },
      { email: { [Op.iLike]: `%${q}%` } },
      { doc: { [Op.iLike]: `%${q}%` } },
    ];
  }
  return where;
}

async function listCustomers(req, res, next) {
  try {
    const { type, q } = req.query;
    const where = getSearchWhere({ type, q });
    const customers = await Customer.findAll({ where, order: [['createdAt', 'DESC']] });
    return res.json({ data: customers });
  } catch (e) {
    return next(e);
  }
}

async function createCustomer(req, res, next) {
  try {
    const { type, name, phone, email, doc } = req.body || {};

    // MVP: permitir campos opcionales.
    if (!type && !name) return res.status(400).json({ error: 'type o name requerido' });

    const customer = await Customer.create({
      type: type || null,
      name: name || null,
      phone: phone || null,
      email: email || null,
      doc: doc || null,
    });
    return res.status(201).json({ data: customer });
  } catch (e) {
    return next(e);
  }
}

async function getCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const customer = await Customer.findByPk(id);
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });
    return res.json({ data: customer });
  } catch (e) {
    return next(e);
  }
}

async function updateCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const customer = await Customer.findByPk(id);
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { type, name, phone, email, doc } = req.body || {};

    await customer.update({
      type: type ?? customer.type,
      name: name ?? customer.name,
      phone: phone ?? customer.phone,
      email: email ?? customer.email,
      doc: doc ?? customer.doc,
    });

    return res.json({ data: customer });
  } catch (e) {
    return next(e);
  }
}

module.exports = { listCustomers, createCustomer, getCustomer, updateCustomer };


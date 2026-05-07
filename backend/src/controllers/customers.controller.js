const db = require('../../models');

const Customer = db.Customer;
const Vehicle = db.Vehicle;
const Intake = db.Intake;
const Budget = db.Budget;
const Payment = db.Payment;

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
    const vehicles = await Vehicle.findAll({
      where: { customerId: id },
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'plate', 'make', 'model', 'year', 'customerId'],
    });
    return res.json({ data: { ...customer.toJSON(), vehicles } });
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

async function deleteCustomer(req, res, next) {
  const tx = await db.sequelize.transaction();
  try {
    const { id } = req.params;
    const deleteVehicles = String(req.query.deleteVehicles || '').toLowerCase() === 'true';

    const customer = await Customer.findByPk(id, { transaction: tx });
    if (!customer) {
      await tx.rollback();
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const customerVehicles = await Vehicle.findAll({
      where: { customerId: id },
      attributes: ['id'],
      transaction: tx,
    });
    const vehicleIds = customerVehicles.map((v) => v.id);

    if (deleteVehicles && vehicleIds.length > 0) {
      const [intakesCount, budgetsCount, paymentsCount] = await Promise.all([
        Intake.count({ where: { vehicleId: vehicleIds }, transaction: tx }),
        Budget.count({ where: { vehicleId: vehicleIds }, transaction: tx }),
        Payment.count({ where: { vehicleId: vehicleIds }, transaction: tx }),
      ]);
      const linkedRecords = intakesCount + budgetsCount + paymentsCount;
      if (linkedRecords > 0) {
        await tx.rollback();
        return res.status(409).json({
          error:
            'No se pueden borrar los vehículos asociados porque tienen historial relacionado (ingresos, presupuestos o pagos).',
        });
      }
    }

    if (deleteVehicles) {
      await Vehicle.destroy({ where: { customerId: id }, transaction: tx });
    } else {
      await Vehicle.update({ customerId: null }, { where: { customerId: id }, transaction: tx });
    }

    await Customer.destroy({ where: { id }, transaction: tx });
    await tx.commit();
    return res.json({
      data: {
        deletedCustomerId: id,
        vehiclesDeleted: deleteVehicles ? vehicleIds.length : 0,
        vehiclesDetached: deleteVehicles ? 0 : vehicleIds.length,
      },
    });
  } catch (e) {
    await tx.rollback();
    return next(e);
  }
}

module.exports = { listCustomers, createCustomer, getCustomer, updateCustomer, deleteCustomer };


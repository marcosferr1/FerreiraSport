const db = require('../../models');

const Vehicle = db.Vehicle;
const Intake = db.Intake;
const ClinicalRecord = db.ClinicalRecord;
const IntakeService = db.IntakeService;
const IntakePart = db.IntakePart;
const Budget = db.Budget;
const BudgetLine = db.BudgetLine;
const Payment = db.Payment;

async function listVehicles(req, res, next) {
  try {
    const { customerId, q } = req.query;
    const where = {};
    if (customerId) where.customerId = customerId;
    if (q) {
      const { Op } = db.Sequelize;
      where.plate = { [Op.iLike]: `%${q}%` };
    }

    const vehicles = await Vehicle.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
    return res.json({ data: vehicles });
  } catch (e) {
    return next(e);
  }
}

async function createVehicle(req, res, next) {
  try {
    const { plate, make, model, year, customerId } = req.body || {};
    if (!plate) return res.status(400).json({ error: 'plate requerido' });

    const vehicle = await Vehicle.create({
      plate,
      make: make || null,
      model: model || null,
      year: year ?? null,
      customerId: customerId || null,
    });

    return res.status(201).json({ data: vehicle });
  } catch (e) {
    return next(e);
  }
}

async function getVehicle(req, res, next) {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado' });
    return res.json({ data: vehicle });
  } catch (e) {
    return next(e);
  }
}


async function getVehicleHistory(req, res, next) {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado' });

    const intakes = await Intake.findAll({
      where: { vehicleId: vehicle.id },
      include: [
        { model: ClinicalRecord },
        { model: IntakeService },
        { model: IntakePart },
      ],
      order: [['receivedAt', 'DESC']],
    });

    const intakeIds = intakes.map((i) => i.id);
    const budgets = intakeIds.length
      ? await Budget.findAll({
          where: { intakeId: intakeIds },
          include: [BudgetLine],
          order: [['createdAt', 'DESC']],
        })
      : [];

    const budgetByIntakeId = new Map();
    for (const b of budgets) {
      if (!b.intakeId || budgetByIntakeId.has(b.intakeId)) continue;
      const lines = Array.isArray(b.BudgetLines) ? b.BudgetLines : [];
      const total = lines.reduce((acc, l) => acc + Number(l.lineTotal || 0), 0);
      budgetByIntakeId.set(b.intakeId, { ...b.toJSON(), total });
    }

    const timeline = intakes.map((intake) => {
      const records = Array.isArray(intake.ClinicalRecords) ? intake.ClinicalRecords : [];
      const services = Array.isArray(intake.IntakeServices) ? intake.IntakeServices : [];
      const parts = Array.isArray(intake.IntakeParts) ? intake.IntakeParts : [];

      records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const clinicalRecord = records[0] || null;

      return {
        intake: {
          id: intake.id,
          status: intake.status,
          receivedAt: intake.receivedAt,
          odometer: intake.odometer,
          notes: intake.notes,
          createdAt: intake.createdAt,
        },
        clinicalRecord: clinicalRecord ? clinicalRecord.toJSON() : null,
        services: services.map((s) => s.toJSON()),
        parts: parts.map((p) => p.toJSON()),
        budget: budgetByIntakeId.get(intake.id) || null,
      };
    });

    return res.json({ data: { vehicle, timeline } });
  } catch (e) {
    return next(e);
  }
}

async function updateVehicle(req, res, next) {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado' });

    const { plate, make, model, year, customerId } = req.body || {};

    await vehicle.update({
      plate: plate ?? vehicle.plate,
      make: make ?? vehicle.make,
      model: model ?? vehicle.model,
      year: year ?? vehicle.year,
      customerId: customerId ?? vehicle.customerId,
    });

    return res.json({ data: vehicle });
  } catch (e) {
    return next(e);
  }
}

async function deleteVehicle(req, res, next) {
  const tx = await db.sequelize.transaction();
  try {
    const { id } = req.params;
    const cascade = String(req.query.cascade || '').toLowerCase() === 'true';
    const vehicle = await Vehicle.findByPk(id, { transaction: tx });
    if (!vehicle) {
      await tx.rollback();
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const [intakesCount, budgetsCount, paymentsCount] = await Promise.all([
      Intake.count({ where: { vehicleId: id }, transaction: tx }),
      Budget.count({ where: { vehicleId: id }, transaction: tx }),
      Payment.count({ where: { vehicleId: id }, transaction: tx }),
    ]);
    const linked = intakesCount + budgetsCount + paymentsCount;
    if (linked > 0) {
      if (!cascade) {
        await tx.rollback();
        return res.status(409).json({
          error:
            'No se puede borrar el vehículo porque tiene historial relacionado (ingresos, presupuestos o pagos).',
        });
      }

      const Op = db.Sequelize.Op;
      const intakes = await Intake.findAll({
        where: { vehicleId: id },
        attributes: ['id'],
        transaction: tx,
      });
      const intakeIds = intakes.map((x) => x.id);
      const budgets = await Budget.findAll({
        where: intakeIds.length > 0 ? { [Op.or]: [{ vehicleId: id }, { intakeId: intakeIds }] } : { vehicleId: id },
        attributes: ['id'],
        transaction: tx,
      });
      const budgetIds = budgets.map((x) => x.id);

      const paymentOr = [{ vehicleId: id }];
      if (intakeIds.length > 0) paymentOr.push({ intakeId: intakeIds });
      if (budgetIds.length > 0) paymentOr.push({ budgetId: budgetIds });
      await Payment.destroy({ where: { [Op.or]: paymentOr }, transaction: tx });

      if (budgetIds.length > 0) {
        await db.BudgetAuditLog.destroy({ where: { budgetId: budgetIds }, transaction: tx });
        await BudgetLine.destroy({ where: { budgetId: budgetIds }, transaction: tx });
        await Budget.destroy({ where: { id: budgetIds }, transaction: tx });
      }

      if (intakeIds.length > 0) {
        await ClinicalRecord.destroy({ where: { intakeId: intakeIds }, transaction: tx });
        await IntakeService.destroy({ where: { intakeId: intakeIds }, transaction: tx });
        await IntakePart.destroy({ where: { intakeId: intakeIds }, transaction: tx });
        await Intake.destroy({ where: { id: intakeIds }, transaction: tx });
      }
    }

    await Vehicle.destroy({ where: { id }, transaction: tx });
    await tx.commit();
    return res.json({
      data: {
        deletedVehicleId: id,
        cascadeApplied: linked > 0 && cascade,
      },
    });
  } catch (e) {
    await tx.rollback();
    return next(e);
  }
}

module.exports = { listVehicles, createVehicle, getVehicle, getVehicleHistory, updateVehicle, deleteVehicle };


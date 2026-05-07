const db = require('../../models');

const Intake = db.Intake;
const ClinicalRecord = db.ClinicalRecord;
const IntakeService = db.IntakeService;
const IntakePart = db.IntakePart;

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function listIntakes(req, res, next) {
  try {
    const { customerId, vehicleId, status } = req.query;
    const where = {};
    if (customerId) where.customerId = customerId;
    if (vehicleId) where.vehicleId = vehicleId;
    if (status) where.status = status;

    const intakes = await Intake.findAll({
      where,
      include: [
        {
          model: IntakeService,
          attributes: ['id', 'laborPrice'],
        },
        {
          model: IntakePart,
          attributes: ['id', 'lineTotal'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    const data = intakes.map((row) => {
      const json = row.toJSON();
      const laborTotal = (json.IntakeServices || []).reduce((acc, s) => acc + toNum(s.laborPrice, 0), 0);
      const partsTotal = (json.IntakeParts || []).reduce((acc, p) => acc + toNum(p.lineTotal, 0), 0);
      return {
        ...json,
        laborTotal,
        partsTotal,
        total: laborTotal + partsTotal,
      };
    });
    return res.json({ data });
  } catch (e) {
    return next(e);
  }
}

async function createIntake(req, res, next) {
  try {
    const { vehicleId, customerId, status, receivedAt, odometer, notes, createdBy } = req.body || {};

    const intake = await Intake.create({
      vehicleId: vehicleId || null,
      customerId: customerId || null,
      status: status || 'OPEN',
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      odometer: odometer ?? null,
      notes: notes || null,
      createdBy: createdBy || req.user.id || null,
    });

    return res.status(201).json({ data: intake });
  } catch (e) {
    return next(e);
  }
}

async function getIntake(req, res, next) {
  try {
    const intake = await Intake.findByPk(req.params.id);
    if (!intake) return res.status(404).json({ error: 'Ingreso no encontrado' });
    return res.json({ data: intake });
  } catch (e) {
    return next(e);
  }
}

async function updateIntake(req, res, next) {
  try {
    const intake = await Intake.findByPk(req.params.id);
    if (!intake) return res.status(404).json({ error: 'Ingreso no encontrado' });

    const { vehicleId, customerId, status, receivedAt, odometer, notes } = req.body || {};

    await intake.update({
      vehicleId: vehicleId ?? intake.vehicleId,
      customerId: customerId ?? intake.customerId,
      status: status ?? intake.status,
      receivedAt: receivedAt ? new Date(receivedAt) : intake.receivedAt,
      odometer: odometer ?? intake.odometer,
      notes: notes ?? intake.notes,
    });

    return res.json({ data: intake });
  } catch (e) {
    return next(e);
  }
}

async function createClinicalRecord(req, res, next) {
  try {
    const intakeId = req.params.id;
    const { complaint, diagnosis, notes } = req.body || {};

    // MVP: no validamos si el Intake existe para simplificar; si quieres, lo hacemos después.
    const record = await ClinicalRecord.create({
      intakeId,
      complaint: complaint || null,
      diagnosis: diagnosis || null,
      notes: notes || null,
      createdBy: req.user.id || null,
    });

    return res.status(201).json({ data: record });
  } catch (e) {
    return next(e);
  }
}

async function listClinicalRecords(req, res, next) {
  try {
    const intakeId = req.params.id;
    const records = await ClinicalRecord.findAll({
      where: { intakeId },
      order: [['createdAt', 'DESC']],
    });
    return res.json({ data: records });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  listIntakes,
  createIntake,
  getIntake,
  updateIntake,
  createClinicalRecord,
  listClinicalRecords,
};


const db = require('../../models');

const Intake = db.Intake;
const IntakeService = db.IntakeService;
const IntakePart = db.IntakePart;
const ServiceCatalog = db.ServiceCatalog;
const PartCatalog = db.PartCatalog;
const Budget = db.Budget;
const BudgetLine = db.BudgetLine;
const ClinicalRecord = db.ClinicalRecord;
const Vehicle = db.Vehicle;

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function requireArray(name, value) {
  if (!Array.isArray(value)) throw new Error(`${name} debe ser array`);
}

async function getLastVehicleOdometer(vehicleId, transaction) {
  const lastIntake = await Intake.findOne({
    where: { vehicleId },
    order: [['receivedAt', 'DESC']],
    transaction,
  });
  if (!lastIntake || lastIntake.odometer == null) return null;
  const n = Number(lastIntake.odometer);
  return Number.isFinite(n) ? n : null;
}

async function resolveServiceItem(item, transaction) {
  if (item.serviceCatalogId) {
    const cat = await ServiceCatalog.findByPk(item.serviceCatalogId, { transaction });
    if (!cat) throw new Error('Servicio de catálogo no encontrado');
    return { catalogId: cat.id, name: cat.name };
  }

  if (item.isNew) {
    const cleanName = String(item.name || '').trim();
    if (!cleanName) throw new Error('name requerido para nuevo servicio');
    const [row] = await ServiceCatalog.findOrCreate({
      where: { name: cleanName },
      defaults: {
        name: cleanName,
        description: item.description || null,
        suggestedPrice: item.suggestedPrice ?? null,
        active: true,
      },
      transaction,
    });
    return { catalogId: row.id, name: row.name };
  }

  const inlineName = String(item.name || '').trim();
  if (!inlineName) throw new Error('Servicio sin nombre');
  return { catalogId: null, name: inlineName };
}

async function resolvePartItem(item, transaction) {
  if (item.partCatalogId) {
    const cat = await PartCatalog.findByPk(item.partCatalogId, { transaction });
    if (!cat) throw new Error('Repuesto de catálogo no encontrado');
    return { catalogId: cat.id, name: cat.name };
  }

  if (item.isNew) {
    const cleanName = String(item.name || '').trim();
    if (!cleanName) throw new Error('name requerido para nuevo repuesto');
    const [row] = await PartCatalog.findOrCreate({
      where: {
        name: cleanName,
        brand: item.brand ? String(item.brand).trim() : null,
        sku: item.sku ? String(item.sku).trim() : null,
      },
      defaults: {
        name: cleanName,
        brand: item.brand ? String(item.brand).trim() : null,
        sku: item.sku ? String(item.sku).trim() : null,
        description: item.description || null,
        suggestedPrice: item.suggestedPrice ?? null,
        active: true,
      },
      transaction,
    });
    return { catalogId: row.id, name: row.name };
  }

  const inlineName = String(item.name || '').trim();
  if (!inlineName) throw new Error('Repuesto sin nombre');
  return { catalogId: null, name: inlineName };
}

async function createServiceWizard(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const { customerId, vehicleId, odometer, receivedAt, intakeNotes, services, parts } = req.body || {};

    if (!customerId) return res.status(400).json({ error: 'customerId requerido' });
    if (!vehicleId) return res.status(400).json({ error: 'vehicleId requerido' });
    if (odometer == null || odometer === '') return res.status(400).json({ error: 'odometer requerido' });
    if (!receivedAt) return res.status(400).json({ error: 'receivedAt requerido' });

    requireArray('services', services || []);
    requireArray('parts', parts || []);

    const vehicle = await Vehicle.findByPk(vehicleId, { transaction: t });
    if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado' });
    if (vehicle.customerId && vehicle.customerId !== customerId) {
      return res.status(400).json({ error: 'El vehículo no pertenece al cliente seleccionado' });
    }
    const newOdometer = toNum(odometer, -1);
    const lastOdometer = await getLastVehicleOdometer(vehicleId, t);
    if (newOdometer < 0) return res.status(400).json({ error: 'odometer inválido' });
    if (lastOdometer != null && newOdometer < lastOdometer) {
      return res.status(400).json({
        error: `Kilometraje inválido: no puede ser menor al último registro (${lastOdometer})`,
      });
    }

    const intake = await Intake.create(
      {
        vehicleId,
        customerId,
        status: 'OPEN',
        receivedAt: new Date(receivedAt),
        odometer: newOdometer,
        notes: intakeNotes || null,
        createdBy: req.user.id || null,
      },
      { transaction: t }
    );

    let laborTotal = 0;
    let partsTotal = 0;
    const createdServices = [];
    const createdParts = [];

    for (const raw of services || []) {
      const resolved = await resolveServiceItem(raw, t);
      const laborPrice = toNum(raw.laborPrice, 0);
      laborTotal += laborPrice;

      const row = await IntakeService.create(
        {
          intakeId: intake.id,
          serviceCatalogId: resolved.catalogId,
          nameSnapshot: resolved.name,
          laborPrice,
          notes: raw.notes || null,
        },
        { transaction: t }
      );
      createdServices.push(row);
    }

    for (const raw of parts || []) {
      const resolved = await resolvePartItem(raw, t);
      const qty = toNum(raw.qty, 1);
      const unitPrice = toNum(raw.unitPrice, 0);
      const lineTotal = qty * unitPrice;
      partsTotal += lineTotal;

      const row = await IntakePart.create(
        {
          intakeId: intake.id,
          partCatalogId: resolved.catalogId,
          nameSnapshot: resolved.name,
          qty,
          unitPrice,
          lineTotal,
          notes: raw.notes || null,
        },
        { transaction: t }
      );
      createdParts.push(row);
    }

    const budget = await Budget.create(
      {
        customerId,
        vehicleId,
        intakeId: intake.id,
        status: 'PENDIENTE',
        createdBy: req.user.id || null,
        updatedBy: req.user.id || null,
      },
      { transaction: t }
    );

    for (const s of createdServices) {
      await BudgetLine.create(
        {
          budgetId: budget.id,
          description: `Servicio: ${s.nameSnapshot}`,
          qty: 1,
          unitPrice: s.laborPrice,
          lineTotal: s.laborPrice,
        },
        { transaction: t }
      );
    }

    for (const p of createdParts) {
      await BudgetLine.create(
        {
          budgetId: budget.id,
          description: `Repuesto: ${p.nameSnapshot}`,
          qty: p.qty,
          unitPrice: p.unitPrice,
          lineTotal: p.lineTotal,
        },
        { transaction: t }
      );
    }

    const serviceList = createdServices.map((s) => `${s.nameSnapshot} (${toNum(s.laborPrice, 0).toFixed(2)})`).join(', ');
    const partsList = createdParts
      .map((p) => `${p.nameSnapshot} x${toNum(p.qty, 1)} @ ${toNum(p.unitPrice, 0).toFixed(2)}`)
      .join(', ');

    const clinicalNotes = [
      `Fecha: ${new Date(receivedAt).toISOString()}`,
      `Kilometraje: ${toNum(odometer, 0)}`,
      `Servicios: ${serviceList || '—'}`,
      `Repuestos: ${partsList || '—'}`,
      `Presupuesto: ${budget.id}`,
      `Totales -> Mano de obra: ${laborTotal.toFixed(2)} | Repuestos: ${partsTotal.toFixed(2)} | Total: ${(laborTotal + partsTotal).toFixed(2)}`,
    ].join('\n');

    const clinicalRecord = await ClinicalRecord.create(
      {
        intakeId: intake.id,
        complaint: intakeNotes || null,
        diagnosis: 'Registro automático por wizard de servicio',
        notes: clinicalNotes,
        createdBy: req.user.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    return res.status(201).json({
      data: {
        intakeId: intake.id,
        budgetId: budget.id,
        clinicalRecordId: clinicalRecord.id,
        laborTotal,
        partsTotal,
        total: laborTotal + partsTotal,
      },
    });
  } catch (e) {
    await t.rollback();
    return next(e);
  }
}

module.exports = { createServiceWizard };

const db = require('../../models');
const { logBudgetEvent } = require('../services/budgetAuditService');

const Budget = db.Budget;
const BudgetLine = db.BudgetLine;
const BudgetAuditLog = db.BudgetAuditLog;
const Intake = db.Intake;
const ClinicalRecord = db.ClinicalRecord;

function computeLineTotal({ qty, unitPrice }) {
  const q = Number(qty ?? 0);
  const u = Number(unitPrice ?? 0);
  return q * u;
}

function getStatusAllowedTransitions() {
  return {
    PENDIENTE: ['APROBADO', 'RECHAZADO'],
    RECHAZADO: ['PENDIENTE'],
    APROBADO: [],
  };
}

function ensureBudgetEditable(budget) {
  if (!budget) return 'NO_ENCONTRADO';
  if (budget.status === 'REPLACED') return 'BUDGET_REEMPLAZADO';
  return null;
}

async function getLastVehicleOdometer(vehicleId) {
  if (!vehicleId) return null;
  const lastIntake = await Intake.findOne({
    where: { vehicleId },
    order: [['receivedAt', 'DESC']],
  });
  if (!lastIntake || lastIntake.odometer == null) return null;
  const n = Number(lastIntake.odometer);
  return Number.isFinite(n) ? n : null;
}

async function listBudgets(req, res, next) {
  try {
    const { status, customerId, vehicleId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (vehicleId) where.vehicleId = vehicleId;

    const budgets = await Budget.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [BudgetLine], // incluir líneas para total
    });

    const data = budgets.map((b) => {
      const lines = b.BudgetLines;
      const total = Array.isArray(lines) ? lines.reduce((acc, l) => acc + Number(l.lineTotal), 0) : 0;
      return { ...b.toJSON(), total };
    });

    return res.json({ data });
  } catch (e) {
    return next(e);
  }
}

async function createBudget(req, res, next) {
  try {
    const { customerId, vehicleId, intakeId, status, lines, odometer, receivedAt, budgetNotes } = req.body || {};
    if (vehicleId && odometer != null && odometer !== '') {
      const newOdometer = Number(odometer);
      if (!Number.isFinite(newOdometer) || newOdometer < 0) {
        return res.status(400).json({ error: 'odometer inválido' });
      }
      const lastOdometer = await getLastVehicleOdometer(vehicleId);
      if (lastOdometer != null && newOdometer < lastOdometer) {
        return res.status(400).json({
          error: `Kilometraje inválido: no puede ser menor al último registro (${lastOdometer})`,
        });
      }
    }

    let resolvedIntakeId = intakeId || null;

    if (!resolvedIntakeId && customerId && vehicleId) {
      const intake = await Intake.create({
        customerId,
        vehicleId,
        status: 'BUDGET',
        receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
        odometer: odometer ?? null,
        notes: budgetNotes || null,
        createdBy: req.user.id,
      });
      resolvedIntakeId = intake.id;
    }

    const budget = await Budget.create({
      customerId: customerId || null,
      vehicleId: vehicleId || null,
      intakeId: resolvedIntakeId,
      status: status || 'PENDIENTE',
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    const createdLines = [];
    if (Array.isArray(lines) && lines.length > 0) {
      for (const line of lines) {
        const qty = line.qty ?? 1;
        const unitPrice = line.unitPrice ?? 0;
        const lineTotal = computeLineTotal({ qty, unitPrice });

        const created = await BudgetLine.create({
          budgetId: budget.id,
          description: line.description,
          qty,
          unitPrice,
          lineTotal,
        });
        createdLines.push(created);

        await logBudgetEvent({
          budgetId: budget.id,
          eventType: 'LINE_ADDED',
          changedBy: req.user.id,
          payload: { line: created.toJSON() },
        });
      }
    }

    if (budget.status !== 'PENDIENTE') {
      await logBudgetEvent({
        budgetId: budget.id,
        eventType: 'STATUS_CHANGED',
        fromStatus: null,
        toStatus: budget.status,
        changedBy: req.user.id,
        payload: null,
      });
    }

    if (resolvedIntakeId) {
      const summaryLines = createdLines.map((l) => `${l.description} | qty ${l.qty} | unit ${l.unitPrice} | total ${l.lineTotal}`).join('\\n');
      await ClinicalRecord.create({
        intakeId: resolvedIntakeId,
        complaint: budgetNotes || null,
        diagnosis: 'Presupuesto generado',
        notes: `Presupuesto ${budget.id} (estado ${budget.status})\\n${summaryLines}`,
        createdBy: req.user.id,
      });
    }

    const budgetWithLines = await Budget.findByPk(budget.id, {
      include: [BudgetLine],
    });

    return res.status(201).json({ data: budgetWithLines });
  } catch (e) {
    return next(e);
  }
}

async function getBudget(req, res, next) {
  try {
    const budget = await Budget.findByPk(req.params.id, { include: [BudgetLine] });
    if (!budget) return res.status(404).json({ error: 'Presupuesto no encontrado' });
    return res.json({ data: budget });
  } catch (e) {
    return next(e);
  }
}

async function updateBudgetStatus(req, res, next) {
  try {
    const { newStatus, reason } = req.body || {};
    const budget = await Budget.findByPk(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Presupuesto no encontrado' });

    const editState = ensureBudgetEditable(budget);
    if (editState === 'BUDGET_REEMPLAZADO') {
      return res.status(409).json({ error: 'Este presupuesto fue reemplazado y no es editable.' });
    }

    if (!newStatus) return res.status(400).json({ error: 'newStatus requerido' });

    const allowed = getStatusAllowedTransitions()[budget.status] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(409).json({
        error: `Transición no permitida: ${budget.status} -> ${newStatus}`,
      });
    }

    const fromStatus = budget.status;
    budget.status = newStatus;
    budget.updatedBy = req.user.id;
    await budget.save();

    await logBudgetEvent({
      budgetId: budget.id,
      eventType: 'STATUS_CHANGED',
      fromStatus,
      toStatus: newStatus,
      changedBy: req.user.id,
      payload: reason ? { reason } : null,
    });

    return res.json({ data: budget });
  } catch (e) {
    return next(e);
  }
}

async function addBudgetLine(req, res, next) {
  try {
    const { id } = req.params;
    const { description, qty, unitPrice } = req.body || {};

    const budget = await Budget.findByPk(id);
    if (!budget) return res.status(404).json({ error: 'Presupuesto no encontrado' });

    const editState = ensureBudgetEditable(budget);
    if (editState === 'BUDGET_REEMPLAZADO') {
      return res.status(409).json({ error: 'Este presupuesto fue reemplazado y no es editable.' });
    }

    if (!description) return res.status(400).json({ error: 'description requerida' });

    const q = qty ?? 1;
    const u = unitPrice ?? 0;
    const lineTotal = computeLineTotal({ qty: q, unitPrice: u });

    const line = await BudgetLine.create({
      budgetId: budget.id,
      description,
      qty: q,
      unitPrice: u,
      lineTotal,
    });

    await logBudgetEvent({
      budgetId: budget.id,
      eventType: 'LINE_ADDED',
      changedBy: req.user.id,
      payload: { line: line.toJSON() },
    });

    return res.status(201).json({ data: line });
  } catch (e) {
    return next(e);
  }
}

async function updateBudgetLine(req, res, next) {
  try {
    const { budgetId, lineId } = req.params;
    const { description, qty, unitPrice } = req.body || {};

    const budget = await Budget.findByPk(budgetId);
    if (!budget) return res.status(404).json({ error: 'Presupuesto no encontrado' });

    const editState = ensureBudgetEditable(budget);
    if (editState === 'BUDGET_REEMPLAZADO') {
      return res.status(409).json({ error: 'Este presupuesto fue reemplazado y no es editable.' });
    }

    const line = await BudgetLine.findOne({ where: { id: lineId, budgetId } });
    if (!line) return res.status(404).json({ error: 'Línea no encontrada' });

    const prev = line.toJSON();

    const nextQty = qty ?? prev.qty;
    const nextUnitPrice = unitPrice ?? prev.unitPrice;
    const nextLineTotal = computeLineTotal({ qty: nextQty, unitPrice: nextUnitPrice });

    await line.update({
      description: description ?? prev.description,
      qty: nextQty,
      unitPrice: nextUnitPrice,
      lineTotal: nextLineTotal,
    });

    await logBudgetEvent({
      budgetId,
      eventType: 'LINE_UPDATED',
      changedBy: req.user.id,
      payload: {
        lineId,
        changes: {
          description: { from: prev.description, to: line.description },
          qty: { from: prev.qty, to: line.qty },
          unitPrice: { from: prev.unitPrice, to: line.unitPrice },
          lineTotal: { from: prev.lineTotal, to: line.lineTotal },
        },
      },
    });

    return res.json({ data: line });
  } catch (e) {
    return next(e);
  }
}

async function deleteBudgetLine(req, res, next) {
  try {
    const { budgetId, lineId } = req.params;

    const budget = await Budget.findByPk(budgetId);
    if (!budget) return res.status(404).json({ error: 'Presupuesto no encontrado' });

    const editState = ensureBudgetEditable(budget);
    if (editState === 'BUDGET_REEMPLAZADO') {
      return res.status(409).json({ error: 'Este presupuesto fue reemplazado y no es editable.' });
    }

    const line = await BudgetLine.findOne({ where: { id: lineId, budgetId } });
    if (!line) return res.status(404).json({ error: 'Línea no encontrada' });

    const prev = line.toJSON();
    await line.destroy();

    await logBudgetEvent({
      budgetId,
      eventType: 'LINE_DELETED',
      changedBy: req.user.id,
      payload: { line: prev },
    });

    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
}

async function getBudgetAudit(req, res, next) {
  try {
    const { id } = req.params;
    const logs = await BudgetAuditLog.findAll({
      where: { budgetId: id },
      order: [['changedAt', 'DESC']],
    });
    return res.json({ data: logs });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  listBudgets,
  createBudget,
  getBudget,
  updateBudgetStatus,
  addBudgetLine,
  updateBudgetLine,
  deleteBudgetLine,
  getBudgetAudit,
};


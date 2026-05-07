const db = require('../../models');

const Payment = db.Payment;
const { Op } = db.Sequelize;

/** Calendario YYYY-MM-DD: from inicio del día UTC, to fin del día UTC (inclusivo). */
function parseBoundaryDate(value, endOfDay) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateRange(from, to) {
  return {
    fromDate: parseBoundaryDate(from, false),
    toDate: parseBoundaryDate(to, true),
  };
}

function validatePaymentBody(body) {
  if (!body) return 'Cuerpo requerido';
  if (body.amount == null) return 'amount requerido';
  if (!body.method) return 'method requerido';
  if (!body.paidAt) return 'paidAt requerido';
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) return 'amount debe ser >= 0';
  const paidAt = new Date(body.paidAt);
  if (Number.isNaN(paidAt.getTime())) return 'paidAt inválido';
  return null;
}

async function listPayments(req, res, next) {
  try {
    const { from, to, method, customerId, q } = req.query;
    const { fromDate, toDate } = parseDateRange(from, to);

    const where = {};
    if (method) where.method = method;
    if (customerId) where.customerId = customerId;
    if (fromDate || toDate) {
      where.paidAt = {
        ...(fromDate ? { [Op.gte]: fromDate } : {}),
        ...(toDate ? { [Op.lte]: toDate } : {}),
      };
    }
    if (q) {
      // búsqueda flexible por referencia/note (si existen)
      where[Op.or] = [
        { note: { [Op.iLike]: `%${q}%` } },
        { reference: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const payments = await Payment.findAll({
      where,
      order: [['paidAt', 'DESC']],
    });

    return res.json({ data: payments });
  } catch (e) {
    return next(e);
  }
}

async function createPayment(req, res, next) {
  try {
    const err = validatePaymentBody(req.body);
    if (err) return res.status(400).json({ error: err });

    const {
      amount,
      method,
      paidAt,
      customerId,
      vehicleId,
      intakeId,
      budgetId,
      note,
      reference,
    } = req.body || {};

    const payment = await Payment.create({
      amount,
      method,
      paidAt: new Date(paidAt),
      customerId: customerId || null,
      vehicleId: vehicleId || null,
      intakeId: intakeId || null,
      budgetId: budgetId || null,
      note: note || null,
      reference: reference || null,
      createdBy: req.user.id || null,
    });

    return res.status(201).json({ data: payment });
  } catch (e) {
    return next(e);
  }
}

async function getPayment(req, res, next) {
  try {
    const payment = await Payment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Pago no encontrado' });
    return res.json({ data: payment });
  } catch (e) {
    return next(e);
  }
}

module.exports = { listPayments, createPayment, getPayment };


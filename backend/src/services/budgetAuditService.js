const db = require('../../models');

const BudgetAuditLog = db.BudgetAuditLog;

async function logBudgetEvent({
  budgetId,
  eventType,
  fromStatus = null,
  toStatus = null,
  changedBy = null,
  payload = null,
}) {
  await BudgetAuditLog.create({
    budgetId,
    eventType,
    fromStatus,
    toStatus,
    changedBy,
    changedAt: new Date(),
    payload,
  });
}

module.exports = { logBudgetEvent };


const express = require('express');
const {
  listBudgets,
  createBudget,
  getBudget,
  updateBudgetStatus,
  addBudgetLine,
  updateBudgetLine,
  deleteBudgetLine,
  getBudgetAudit,
} = require('../controllers/budgets.controller');

const router = express.Router();

router.get('/', listBudgets);
router.post('/', createBudget);

router.get('/:id', getBudget);

router.patch('/:id/status', updateBudgetStatus);

router.post('/:id/lines', addBudgetLine);
router.patch('/:budgetId/lines/:lineId', updateBudgetLine);
router.delete('/:budgetId/lines/:lineId', deleteBudgetLine);

router.get('/:id/audit', getBudgetAudit);

module.exports = router;


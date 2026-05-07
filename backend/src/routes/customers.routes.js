const express = require('express');
const {
  listCustomers,
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,
} = require('../controllers/customers.controller');

const router = express.Router();

router.get('/', listCustomers);
router.post('/', createCustomer);
router.get('/:id', getCustomer);
router.patch('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;


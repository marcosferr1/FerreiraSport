const express = require('express');
const {
  listCustomers,
  createCustomer,
  getCustomer,
  updateCustomer,
} = require('../controllers/customers.controller');

const router = express.Router();

router.get('/', listCustomers);
router.post('/', createCustomer);
router.get('/:id', getCustomer);
router.patch('/:id', updateCustomer);

module.exports = router;


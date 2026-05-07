const express = require('express');
const { listPayments, createPayment, getPayment } = require('../controllers/payments.controller');

const router = express.Router();

router.get('/', listPayments);
router.post('/', createPayment);
router.get('/:id', getPayment);

module.exports = router;


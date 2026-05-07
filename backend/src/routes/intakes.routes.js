const express = require('express');
const {
  listIntakes,
  createIntake,
  getIntake,
  updateIntake,
  createClinicalRecord,
  listClinicalRecords,
} = require('../controllers/intakes.controller');

const router = express.Router();

router.get('/', listIntakes);
router.post('/', createIntake);
router.get('/:id', getIntake);
router.patch('/:id', updateIntake);

router.post('/:id/clinical-records', createClinicalRecord);
router.get('/:id/clinical-records', listClinicalRecords);

module.exports = router;


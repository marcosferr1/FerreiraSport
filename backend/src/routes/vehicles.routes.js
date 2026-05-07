const express = require('express');
const { listVehicles, createVehicle, getVehicle, getVehicleHistory, updateVehicle } = require('../controllers/vehicles.controller');

const router = express.Router();

router.get('/', listVehicles);
router.post('/', createVehicle);
router.get('/:id/history', getVehicleHistory);
router.get('/:id', getVehicle);
router.patch('/:id', updateVehicle);

module.exports = router;


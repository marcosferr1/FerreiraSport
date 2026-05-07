const express = require('express');
const { listVehicles, createVehicle, getVehicle, getVehicleHistory, updateVehicle, deleteVehicle } = require('../controllers/vehicles.controller');

const router = express.Router();

router.get('/', listVehicles);
router.post('/', createVehicle);
router.get('/:id/history', getVehicleHistory);
router.get('/:id', getVehicle);
router.patch('/:id', updateVehicle);
router.delete('/:id', deleteVehicle);

module.exports = router;


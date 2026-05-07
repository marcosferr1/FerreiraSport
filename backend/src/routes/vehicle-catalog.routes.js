const express = require('express');
const { listBrands, listModelsByBrand } = require('../controllers/vehicle-catalog.controller');

const router = express.Router();

router.get('/', listBrands);
router.get('/:brandId/models', listModelsByBrand);

module.exports = router;

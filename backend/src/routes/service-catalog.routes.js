const express = require('express');
const { listServiceCatalog, createServiceCatalog, updateServiceCatalog, deleteServiceCatalog } = require('../controllers/service-catalog.controller');

const router = express.Router();

router.get('/', listServiceCatalog);
router.post('/', createServiceCatalog);
router.patch('/:id', updateServiceCatalog);
router.delete('/:id', deleteServiceCatalog);

module.exports = router;

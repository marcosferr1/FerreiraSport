const express = require('express');
const { listPartCatalog, createPartCatalog, updatePartCatalog, deletePartCatalog } = require('../controllers/part-catalog.controller');

const router = express.Router();

router.get('/', listPartCatalog);
router.post('/', createPartCatalog);
router.patch('/:id', updatePartCatalog);
router.delete('/:id', deletePartCatalog);

module.exports = router;

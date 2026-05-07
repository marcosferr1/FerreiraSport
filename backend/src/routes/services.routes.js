const express = require('express');
const { createServiceWizard } = require('../controllers/services-wizard.controller');

const router = express.Router();

router.post('/wizard', createServiceWizard);

module.exports = router;

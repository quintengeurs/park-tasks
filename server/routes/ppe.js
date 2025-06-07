const express = require('express');
const router = express.Router();
const { PPERequest } = require('../models');
const authMiddleware = require('../middleware/auth');

router.post('/', authMiddleware, async (req, res) => {
  const { items, userId } = req.body;
  const ppeRequest = await PPERequest.create({ items, userId });
  res.status(201).json(ppeRequest);
});

router.get('/', authMiddleware, async (req, res) => {
  const requests = await PPERequest.findAll();
  res.json(requests);
});

module.exports = router;
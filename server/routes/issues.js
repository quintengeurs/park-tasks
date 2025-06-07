const express = require('express');
const router = express.Router();
const { Issue } = require('../models');
const authMiddleware = require('../middleware/auth');

router.post('/', authMiddleware, async (req, res) => {
  const { description, image, userId } = req.body;
  const issue = await Issue.create({ description, image, userId });
  res.status(201).json(issue);
});

module.exports = router;
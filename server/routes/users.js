const express = require('express');
const router = express.Router();
const { User } = require('../models');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  const users = await User.findAll();
  res.json(users);
});

module.exports = router;
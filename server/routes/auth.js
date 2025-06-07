const express = require('express');
const router = express.Router();
const { User } = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ uid: user.uid, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
  res.json({ token, user: { uid: user.uid, email: user.email, role: user.role, privileges: user.privileges, name: user.name } });
});

router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ where: { uid: decoded.uid } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ uid: user.uid, email: user.email, role: user.role, privileges: user.privileges, name: user.name });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
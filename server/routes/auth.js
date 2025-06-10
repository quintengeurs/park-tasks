const express = require('express');
const router = express.Router();
const { UserData } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    console.log('Login attempt:', email); // Debug
    const user = await UserData.findOne({ where: { email } });
    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      console.log('Invalid password for:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.uid, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Login success:', email, 'Token:', token); // Debug
    res.json({ token, user: { id: user.uid, email: user.email, role: user.role, name: user.name } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    console.log('No token provided for /me');
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded); // Debug
    const user = await UserData.findOne({ where: { uid: decoded.id } });
    if (!user) {
      console.log('User not found for /me:', decoded.id);
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ id: user.uid, email: user.email, role: user.role, name: user.name });
  } catch (error) {
    console.error('Auth/me error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;

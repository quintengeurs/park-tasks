const express = require('express');
  const bcrypt = require('bcrypt');
  const jwt = require('jsonwebtoken');
  const { pool } = require('../database');

  const router = express.Router();
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

  router.post('/login', async (req, res) => {
      const { username, password } = req.body;
      try {
          const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
          const user = rows[0];
          if (!user) return res.status(401).json({ message: 'Invalid credentials' });

          const match = await bcrypt.compare(password, user.password);
          if (!match) return res.status(401).json({ message: 'Invalid credentials' });

          const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
          res.json({ token });
      } catch (err) {
          res.status(500).json({ message: 'Database error' });
      }
  });

  router.get('/check', (req, res) => {
      const token = req.headers['authorization']?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'No token provided' });

      jwt.verify(token, JWT_SECRET, (err, user) => {
          if (err) return res.status(403).json({ message: 'Invalid token' });
          res.json({ user });
      });
  });

  module.exports = router;
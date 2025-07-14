const express = require('express');
  const { pool } = require('../database');

  const router = express.Router();

  router.get('/', async (req, res) => {
      try {
          const { rows } = await pool.query('SELECT * FROM issues WHERE user_id = $1 AND resolved = FALSE', [req.user.id]);
          res.json(rows);
      } catch (err) {
          res.status(500).json({ message: 'Database error' });
      }
  });

  router.get('/resolved', async (req, res) => {
      try {
          const { rows } = await pool.query('SELECT * FROM issues WHERE user_id = $1 AND resolved = TRUE', [req.user.id]);
          res.json(rows);
      } catch (err) {
          res.status(500).json({ message: 'Database error' });
      }
  });

  router.post('/', async (req, res) => {
      const { location, description, urgency, image } = req.body;
      try {
          await pool.query(
              'INSERT INTO issues (user_id, location, description, urgency, image, resolved, created_at) VALUES ($1, $2, $3, $4, $5, FALSE, CURRENT_TIMESTAMP)',
              [req.user.id, location, description, urgency, image]
          );
          res.status(201).json({ message: 'Issue created' });
      } catch (err) {
          res.status(500).json({ message: 'Database error' });
      }
  });

  router.patch('/:id/resolve', async (req, res) => {
      try {
          await pool.query('UPDATE issues SET resolved = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
          res.json({ message: 'Issue resolved' });
      } catch (err) {
          res.status(500).json({ message: 'Database error' });
      }
  });

  module.exports = router;
const express = require('express');
  const { pool } = require('../database');

  const router = express.Router();

  router.get('/', async (req, res) => {
      try {
          const { rows } = await pool.query('SELECT * FROM tasks WHERE user_id = $1 AND archived = FALSE', [req.user.id]);
          res.json(rows);
      } catch (err) {
          res.status(500).json({ message: 'Database error' });
      }
  });

  router.get('/archived', async (req, res) => {
      try {
          const { rows } = await pool.query('SELECT * FROM tasks WHERE user_id = $1 AND archived = TRUE', [req.user.id]);
          res.json(rows);
      } catch (err) {
          res.status(500).json({ message: 'Database error' });
      }
  });

  router.post('/', async (req, res) => {
      const { title, description, image } = req.body;
      try {
          await pool.query(
              'INSERT INTO tasks (user_id, title, description, image, completed, archived, created_at) VALUES ($1, $2, $3, $4, FALSE, FALSE, CURRENT_TIMESTAMP)',
              [req.user.id, title, description, image]
          );
          res.status(201).json({ message: 'Task created' });
      } catch (err) {
          res.status(500).json({ message: 'Database error' });
      }
  });

  router.patch('/:id', async (req, res) => {
      const { completed } = req.body;
      try {
          await pool.query('UPDATE tasks SET completed = $1 WHERE id = $2 AND user_id = $3', [completed, req.params.id, req.user.id]);
          res.json({ message: 'Task updated' });
      } catch (err) {
          res.status(500).json({ message: 'Database error' });
      }
  });

  router.patch('/:id/archive', async (req, res) => {
      try {
          await pool.query('UPDATE tasks SET archived = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
          res.json({ message: 'Task archived' });
      } catch (err) {
          res.status(500).json({ message: 'Database error' });
      }
  });

  module.exports = router;
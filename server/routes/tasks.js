const express = require('express');
const { Pool } = require('pg');
const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.post('/', async (req, res) => {
  const { title, description, image_url, urgency, schedule_type, schedule_details, assigned_to } = req.body;
  const result = await pool.query(
    'INSERT INTO tasks (title, description, image_url, urgency, schedule_type, schedule_details, assigned_to) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [title, description, image_url, urgency, schedule_type, JSON.stringify(schedule_details), assigned_to]
  );
  res.json(result.rows[0]);
});

router.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM tasks');
  res.json(result.rows);
});

module.exports = router;

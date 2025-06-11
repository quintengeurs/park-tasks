const express = require('express');
const { Pool } = require('pg');
const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.post('/', async (req, res) => {
  const { name, team, job_role, account_features, page_visibility } = req.body;
  const result = await pool.query(
    'INSERT INTO staff (name, team, job_role, account_features, page_visibility) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [name, team, job_role, JSON.stringify(account_features), JSON.stringify(page_visibility)]
  );
  res.json(result.rows[0]);
});

router.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM staff');
  res.json(result.rows);
});

module.exports = router;

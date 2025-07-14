const { Pool } = require('pg');
  const bcrypt = require('bcrypt');

  const pool = new Pool({
      connectionString: `${process.env.SUPABASE_URL}/postgres?pgbouncer=true&connection_limit=1`,
      ssl: { rejectUnauthorized: false },
      user: 'postgres',
      password: process.env.SUPABASE_KEY,
      host: process.env.SUPABASE_URL.replace('https://', '').split('/')[0],
      database: 'postgres',
      port: 5432
  });

  async function initDatabase() {
      try {
          const client = await pool.connect();
          const hashedPassword = bcrypt.hashSync('admin123', 10);
          await client.query(`
              INSERT INTO users (username, password)
              VALUES ($1, $2)
              ON CONFLICT (username) DO NOTHING
          `, ['admin', hashedPassword]);
          client.release();
      } catch (err) {
          console.error('Database initialization error:', err);
          throw err;
      }
  }

  module.exports = { pool, initDatabase };
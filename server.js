// server.js
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"]
    }
  }
}));

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Session configuration
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'park-management-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Database initialization
async function initializeDatabase() {
  try {
    // Create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL COLLATE "default",
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      ) WITH (OIDS=FALSE);
      
      ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON session(expire);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(100) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        permissions TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        assigned_to INTEGER REFERENCES staff(id),
        assigned_by INTEGER REFERENCES staff(id),
        urgency VARCHAR(20) DEFAULT 'medium',
        task_type VARCHAR(50) DEFAULT 'one-off',
        status VARCHAR(50) DEFAULT 'active',
        image_url VARCHAR(500),
        completion_photo VARCHAR(500),
        completion_notes TEXT,
        date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        date_completed TIMESTAMP,
        date_approved TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ppe_requests (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER REFERENCES staff(id),
        items TEXT[],
        status VARCHAR(50) DEFAULT 'pending',
        date_requested TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        date_resolved TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mimetype VARCHAR(100) NOT NULL,
        data BYTEA NOT NULL,
        size INTEGER NOT NULL,
        uploaded_by INTEGER REFERENCES staff(id),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default admin user if not exists
    const adminExists = await pool.query('SELECT id FROM staff WHERE username = $1', ['admin']);
    if (adminExists.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.query(`
        INSERT INTO staff (name, email, role, username, password, permissions)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, ['Admin User', 'admin@park.gov', 'Operations Manager', 'admin', hashedPassword, ['all']]);

      // Insert sample staff
      const sampleStaff = [
        ['John Smith', 'john@park.gov', 'Head Gardener', 'jsmith', 'password123', ['tasks', 'reports']],
        ['Sarah Wilson', 'sarah@park.gov', 'Keeper', 'swilson', 'password123', ['tasks']],
        ['Mike Johnson', 'mike@park.gov', 'Area Manager', 'mjohnson', 'password123', ['tasks', 'management', 'reports']]
      ];

      for (const staff of sampleStaff) {
        const hashedPwd = await bcrypt.hash(staff[4], 10);
        await pool.query(`
          INSERT INTO staff (name, email, role, username, password, permissions)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [staff[0], staff[1], staff[2], staff[3], hashedPwd, staff[5]]);
      }
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (req.session.user && 
        (req.session.user.permissions.includes('all') || 
         req.session.user.permissions.includes(permission))) {
      next();
    } else {
      res.status(403).json({ error: 'Insufficient permissions' });
    }
  };
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Authentication routes
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const result = await pool.query(
      'SELECT * FROM staff WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    };
    
    res.json({ 
      success: true, 
      user: req.session.user,
      isManagement: user.permissions.includes('all') || user.permissions.includes('management')
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.json({ success: true });
  });
});

// Staff management routes
app.get('/api/staff', requireAuth, requirePermission('management'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, username, status, permissions, created_at FROM staff WHERE id != $1 ORDER BY name',
      [req.session.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/staff', requireAuth, requirePermission('management'), async (req, res) => {
  try {
    const { name, email, role, username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    let permissions = ['tasks'];
    if (['Area Manager', 'Operations Manager', 'Head Gardener'].includes(role)) {
      permissions.push('management');
    }
    
    const result = await pool.query(`
      INSERT INTO staff (name, email, role, username, password, permissions)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, username, status, permissions, created_at
    `, [name, email, role, username, hashedPassword, permissions]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Add staff error:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

app.put('/api/staff/:id', requireAuth, requirePermission('management'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, username, password } = req.body;
    
    let updateQuery = `
      UPDATE staff SET name = $1, email = $2, role = $3, username = $4, updated_at = CURRENT_TIMESTAMP
    `;
    let values = [name, email, role, username];
    
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery += ', password = $5';
      values.push(hashedPassword);
    }
    
    updateQuery += ' WHERE id = $' + (values.length + 1) + ' RETURNING *';
    values.push(id);
    
    const result = await pool.query(updateQuery, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/staff/:id', requireAuth, requirePermission('management'), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM staff WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Task management routes
app.get('/api/tasks', requireAuth, async (req, res) => {
  try {
    const { status, assigned_to } = req.query;
    let query = `
      SELECT t.*, s1.name as assigned_to_name, s2.name as assigned_by_name 
      FROM tasks t 
      LEFT JOIN staff s1 ON t.assigned_to = s1.id 
      LEFT JOIN staff s2 ON t.assigned_by = s2.id
    `;
    let values = [];
    let conditions = [];
    
    if (status) {
      conditions.push(`t.status = $${values.length + 1}`);
      values.push(status);
    }
    
    if (assigned_to) {
      conditions.push(`t.assigned_to = $${values.length + 1}`);
      values.push(assigned_to);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY t.date_created DESC';
    
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/tasks', requireAuth, requirePermission('management'), async (req, res) => {
  try {
    const { title, description, assigned_to, urgency, task_type } = req.body;
    
    const result = await pool.query(`
      INSERT INTO tasks (title, description, assigned_to, assigned_by, urgency, task_type)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [title, description, assigned_to, req.session.user.id, urgency, task_type]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/tasks/:id/complete', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    let completion_photo = null;
    if (req.file) {
      // Store file in database
      const fileResult = await pool.query(`
        INSERT INTO files (filename, original_name, mimetype, data, size, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
      `, [
        `completion_${id}_${Date.now()}`,
        req.file.originalname,
        req.file.mimetype,
        req.file.buffer,
        req.file.size,
        req.session.user.id
      ]);
      completion_photo = `/api/files/${fileResult.rows[0].id}`;
    }
    
    const result = await pool.query(`
      UPDATE tasks 
      SET status = 'pending_approval', 
          completion_notes = $1, 
          completion_photo = $2, 
          date_completed = CURRENT_TIMESTAMP
      WHERE id = $3 AND assigned_to = $4 
      RETURNING *
    `, [notes, completion_photo, id, req.session.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or not assigned to you' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/tasks/:id/approve', requireAuth, requirePermission('management'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      UPDATE tasks 
      SET status = 'approved', date_approved = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `, [id]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Approve task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/tasks/:id/reject', requireAuth, requirePermission('management'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      UPDATE tasks 
      SET status = 'active', 
          completion_notes = NULL, 
          completion_photo = NULL, 
          date_completed = NULL
      WHERE id = $1 
      RETURNING *
    `, [id]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Reject task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/tasks/:id', requireAuth, requirePermission('management'), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PPE request routes
app.get('/api/ppe-requests', requireAuth, requirePermission('management'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pr.*, s.name as staff_name 
      FROM ppe_requests pr 
      JOIN staff s ON pr.staff_id = s.id 
      ORDER BY pr.date_requested DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get PPE requests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/ppe-requests', requireAuth, async (req, res) => {
  try {
    const { items } = req.body;
    
    const result = await pool.query(`
      INSERT INTO ppe_requests (staff_id, items)
      VALUES ($1, $2) RETURNING *
    `, [req.session.user.id, items]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create PPE request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/ppe-requests/:id/approve', requireAuth, requirePermission('management'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      UPDATE ppe_requests 
      SET status = 'approved', date_resolved = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `, [id]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Approve PPE request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/ppe-requests/:id', requireAuth, requirePermission('management'), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM ppe_requests WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete PPE request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// File serving route
app.get('/api/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM files WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const file = result.rows[0];
    res.set({
      'Content-Type': file.mimetype,
      'Content-Length': file.size,
      'Cache-Control': 'public, max-age=31536000'
    });
    
    res.send(file.data);
  } catch (error) {
    console.error('File serving error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Statistics route
app.get('/api/statistics', requireAuth, requirePermission('management'), async (req, res) => {
  try {
    const stats = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM staff WHERE id != $1', [req.session.user.id]),
      pool.query('SELECT COUNT(*) as active FROM staff WHERE status = $1 AND id != $2', ['Active', req.session.user.id]),
      pool.query('SELECT COUNT(*) as pending FROM tasks WHERE status = $1', ['pending_approval']),
      pool.query('SELECT COUNT(*) as ppe_pending FROM ppe_requests WHERE status = $1', ['pending'])
    ]);
    
    res.json({
      totalStaff: parseInt(stats[0].rows[0].total),
      activeStaff: parseInt(stats[1].rows[0].active),
      pendingTasks: parseInt(stats[2].rows[0].pending),
      pendingPPE: parseInt(stats[3].rows[0].ppe_pending)
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Server error' });
});

// Start server
async function startServer() {
  await initializeDatabase();
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer().catch(console.error);

const express = require('express');
const http = require('http');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const WebSocket = require('ws');
const Sequelize = require('sequelize');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Sequelize setup
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'database.db'
});

// Session middleware with Sequelize store
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: new SequelizeStore({
        db: sequelize,
        tableName: 'sessions', // Optional: custom table name
        checkExpirationInterval: 15 * 60 * 1000, // Clean up expired sessions every 15 minutes
        expiration: 24 * 60 * 60 * 1000 // Sessions expire after 24 hours
    })
}));

// Sync Sequelize to create the sessions table
sequelize.sync();

// Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Database
const db = new sqlite3.Database('database.db');

// Set view engine
app.set('view engine', 'ejs');

// WebSocket setup
wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    ws.on('close', () => console.log('WebSocket client disconnected'));
});

// Broadcast function
function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// Routes
app.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('index', { user: req.session.user });
});

app.get('/setup', (req, res) => {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            type TEXT NOT NULL,
            urgency TEXT,
            image TEXT,
            due_date TEXT,
            season TEXT,
            allocated_to TEXT,
            recurrence TEXT,
            status TEXT CHECK(status IN ('active', 'completed')),
            archived BOOLEAN NOT NULL DEFAULT 0,
            completed BOOLEAN NOT NULL DEFAULT 0,
            completed_date TEXT,
            completion_note TEXT,
            completion_image TEXT,
            original_task_id INTEGER
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            rospa_trained INTEGER DEFAULT 0
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            location TEXT NOT NULL,
            image_path TEXT,
            urgency TEXT CHECK(urgency IN ('Low', 'Medium', 'High')),
            created_at TEXT
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS inspections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location TEXT NOT NULL,
            type TEXT NOT NULL,
            subtype TEXT,
            notes TEXT,
            user_id INTEGER,
            created_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        db.run(`INSERT OR IGNORE INTO users (username, password, role) 
                VALUES ('admin', ?, 'Admin')`, [hashedPassword]);
        db.run(`INSERT OR IGNORE INTO tasks (title, type, urgency, season, status) 
                VALUES ('Test Task', 'maintenance', 'normal', 'all', 'active')`);
    });
    res.send('Database initialized');
});

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err || !user || !bcrypt.compareSync(password, user.password)) {
            return res.json({ success: false, message: 'Invalid credentials' });
        }
        req.session.user = user;
        res.json({ success: true });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/current-user', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.json(null);
    }
});

app.get('/admin', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'Admin') return res.redirect('/');
    res.render('admin', { user: req.session.user });
});

app.get('/api/tasks', (req, res) => {
    db.all('SELECT * FROM tasks', [], (err, tasks) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json(tasks);
    });
});

app.post('/api/tasks', upload.single('image'), (req, res) => {
    const { title, description, type, custom_type, urgency, due_date, season, allocated_to, recurrence } = req.body;
    const taskType = custom_type || type;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    db.run(
        `INSERT INTO tasks (title, description, type, urgency, image, due_date, season, allocated_to, recurrence, status, archived, completed) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, description, taskType, urgency, imagePath, due_date || null, season || 'all', allocated_to || null, recurrence || null, 'active', false, false],
        function(err) {
            if (err) return res.status(500).json({ success: false, message: 'Database error' });
            broadcast({ type: 'new_task' });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.put('/api/tasks/:id', upload.single('image'), (req, res) => {
    const taskId = req.params.id;
    const { title, description, type, custom_type, urgency, due_date, season, allocated_to, recurrence, existing_image } = req.body;
    const taskType = custom_type || type;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : existing_image;
    db.run(
        `UPDATE tasks SET title = ?, description = ?, type = ?, urgency = ?, image = ?, due_date = ?, season = ?, allocated_to = ?, recurrence = ? WHERE id = ?`,
        [title, description, taskType, urgency, imagePath, due_date || null, season || 'all', allocated_to || null, recurrence || null, taskId],
        (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Database error' });
            broadcast({ type: 'updated_task' });
            res.json({ success: true });
        }
    );
});

app.post('/api/tasks/:id/complete', (req, res) => {
    const taskId = req.params.id;
    db.run('UPDATE tasks SET completed = 1, completed_date = datetime("now") WHERE id = ?', [taskId], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        broadcast({ type: 'updated_task' });
        res.json({ success: true });
    });
});

app.post('/api/tasks/:id/archive', (req, res) => {
    const taskId = req.params.id;
    db.run('UPDATE tasks SET archived = true WHERE id = ?', [taskId], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        broadcast({ type: 'updated_task' });
        res.json({ success: true });
    });
});

app.delete('/api/tasks/:id', (req, res) => {
    const taskId = req.params.id;
    db.run('DELETE FROM tasks WHERE id = ?', [taskId], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        broadcast({ type: 'updated_task' });
        res.json({ success: true });
    });
});

app.get('/staff', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    res.render('staff', { user: req.session.user });
});

app.get('/api/users', (req, res) => {
    db.all('SELECT id, username, role FROM users', [], (err, users) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json(users);
    });
});

app.post('/api/users', (req, res) => {
    const { username, password, role } = req.body;
    db.get('SELECT username FROM users WHERE username = ?', [username], (err, existingUser) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        if (existingUser) return res.json({ success: false, message: 'Username already exists' });
        const hashedPassword = bcrypt.hashSync(password, 10);
        db.run(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role],
            function(err) {
                if (err) return res.status(500).json({ success: false, message: 'Database error' });
                res.json({ success: true, id: this.lastID });
            }
        );
    });
});

app.put('/api/users/:id', (req, res) => {
    const userId = req.params.id;
    const { username, password, role } = req.body;
    const hashedPassword = password ? bcrypt.hashSync(password, 10) : null;
    if (hashedPassword) {
        db.run(
            'UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?',
            [username, hashedPassword, role, userId],
            (err) => {
                if (err) return res.status(500).json({ success: false, message: 'Database error' });
                res.json({ success: true });
            }
        );
    } else {
        db.run(
            'UPDATE users SET username = ?, role = ? WHERE id = ?',
            [username, role, userId],
            (err) => {
                if (err) return res.status(500).json({ success: false, message: 'Database error' });
                res.json({ success: true });
            }
        );
    }
});

app.delete('/api/users/:id', (req, res) => {
    const userId = req.params.id;
    db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json({ success: true });
    });
});

app.get('/archive', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    res.render('archive', { user: req.session.user });
});

app.get('/issues', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    db.all('SELECT * FROM issues ORDER BY created_at DESC', [], (err, issues) => {
        if (err) return res.status(500).send('Database error');
        res.render('issues', { user: req.session.user, issues });
    });
});

app.get('/api/issues', (req, res) => {
    db.all('SELECT * FROM issues ORDER BY created_at DESC', [], (err, issues) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json(issues);
    });
});

app.post('/issues', upload.single('image'), (req, res) => {
    const { title, description, location, urgency } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    db.run(
        'INSERT INTO issues (title, description, location, image_path, urgency, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [title, description, location, imagePath, urgency, new Date().toISOString()],
        (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Database error' });
            broadcast({ type: 'new_issue' });
            res.redirect('/issues');
        }
    );
});

app.get('/inspections', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    db.all('SELECT * FROM inspections ORDER BY created_at DESC', [], (err, inspections) => {
        if (err) return res.status(500).send('Database error');
        res.render('inspections', { user: req.session.user, inspections });
    });
});

app.get('/api/inspections', (req, res) => {
    db.all('SELECT * FROM inspections ORDER BY created_at DESC', [], (err, inspections) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json(inspections);
    });
});

app.post('/inspections', (req, res) => {
    const { location, type, subtype, notes } = req.body;
    const userId = req.session.user.id;
    db.run(
        'INSERT INTO inspections (location, type, subtype, notes, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [location, type, subtype || null, notes || null, userId, new Date().toISOString()],
        (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Database error' });
            broadcast({ type: 'new_inspection' });
            res.redirect('/inspections');
        }
    );
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});

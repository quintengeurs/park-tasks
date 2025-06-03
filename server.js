require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const Sequelize = require('sequelize');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const multer = require('multer');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000; // Use dynamic port for hosting platforms

// Create HTTP server for Express and WebSocket
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// SQLite database setup (file-based for persistence)
const db = new sqlite3.Database('database.db', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite file database');
    }
});

// Initialize database tables
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    type TEXT,
    description TEXT,
    due_date TEXT,
    urgency TEXT,
    allocated_to TEXT,
    season TEXT,
    image TEXT,
    completed BOOLEAN,
    archived BOOLEAN,
    recurrence TEXT,
    original_task_id INTEGER
)`);

// Seed admin user
const hashedPassword = bcrypt.hashSync('admin123', 10);
db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`, ['admin', hashedPassword, 'admin']);

// Sequelize for session storage
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'database.db'
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key', // Use env variable for secret
    resave: false,
    saveUninitialized: false,
    store: new SequelizeStore({
        db: sequelize
    })
}));

// Sync session store
sequelize.sync();

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Authentication middleware
function ensureAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
}

// Routes
app.get('/', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/admin', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin.html'));
});

app.get('/staff', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/staff.html'));
});

app.get('/archive', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/archive.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/login.html'));
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err || !user || !bcrypt.compareSync(password, user.password)) {
            return res.json({ success: false, message: 'Invalid credentials' });
        }
        req.session.user = { id: user.id, username: user.username, role: user.role };
        res.json({ success: true });
    });
});

app.get('/api/current-user', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.json(null);
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ success: false, message: 'Failed to log out' });
        }
        // Clear the session cookie
        res.clearCookie('connect.sid'); // Matches the default cookie name used by express-session
        res.json({ success: true });
    });
});

// Task routes
app.get('/api/tasks', ensureAuthenticated, (req, res) => {
    db.all(`SELECT * FROM tasks`, [], (err, tasks) => {
        if (err) {
            console.error('Tasks fetch error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json(tasks);
    });
});

app.post('/api/tasks', ensureAuthenticated, upload.single('image'), (req, res) => {
    const { title, type, description, due_date, urgency, allocated_to, season, recurrence } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const today = new Date().toISOString().split('T')[0];

    console.log('Task creation request:', { title, type, description, due_date, urgency, allocated_to, season, recurrence, image });

    // Validate required fields
    if (!title || !type || !urgency) {
        console.error('Missing required fields');
        return res.json({ success: false, message: 'Title, type, and urgency are required' });
    }

    // Validate due date or season for non-Due Today tasks
    if (!due_date && (!season || season === 'all') && due_date !== today) {
        console.error('Validation failed: due date or specific season required');
        return res.json({ success: false, message: 'Either a due date or a specific season is required' });
    }

    // Create immediate task
    db.run(
        `INSERT INTO tasks (title, type, description, due_date, urgency, allocated_to, season, image, completed, archived, recurrence) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, type, description || null, due_date || null, urgency, allocated_to || null, season || 'all', image, false, false, recurrence || null],
        function(err) {
            if (err) {
                console.error('Task insertion error:', err);
                return res.json({ success: false, message: 'Failed to add task: ' + err.message });
            }
            const immediateTaskId = this.lastID;
            console.log('Task created:', { id: immediateTaskId, title, due_date });
            broadcast({ type: 'new_task', taskId: immediateTaskId });

            // Create scheduled task if due today and recurring
            if (due_date === today && recurrence) {
                let scheduledDueDate;
                const baseDate = new Date();
                if (recurrence === 'daily') {
                    scheduledDueDate = new Date(baseDate.setDate(baseDate.getDate() + 1)).toISOString().split('T')[0];
                } else if (recurrence === 'weekly') {
                    scheduledDueDate = new Date(baseDate.setDate(baseDate.getDate() + 7)).toISOString().split('T')[0];
                } else if (recurrence === 'monthly') {
                    scheduledDueDate = new Date(baseDate.setMonth(baseDate.getMonth() + 1)).toISOString().split('T')[0];
                }

                db.run(
                    `INSERT INTO tasks (title, type, description, due_date, urgency, allocated_to, season, image, completed, archived, recurrence, original_task_id) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [title, type, description || null, scheduledDueDate, urgency, allocated_to || null, season || 'all', image, false, false, recurrence, immediateTaskId],
                    function(err) {
                        if (err) {
                            console.error('Scheduled task insertion error:', err);
                        } else {
                            console.log('Scheduled task created:', { id: this.lastID, title, due_date: scheduledDueDate });
                            broadcast({ type: 'new_task', taskId: this.lastID });
                        }
                    }
                );
            }

            res.json({ success: true });
        }
    );
});

app.post('/api/tasks/:id/complete', ensureAuthenticated, (req, res) => {
    db.run(`UPDATE tasks SET completed = ? WHERE id = ?`, [true, req.params.id], function(err) {
        if (err) {
            console.error('Task completion error:', err);
            return res.status(500).json({ success: false, message: 'Failed to complete task' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        broadcast({ type: 'updated_task', taskId: req.params.id });
        res.json({ success: true });

        // Handle recurrence
        db.get(`SELECT * FROM tasks WHERE id = ?`, [req.params.id], (err, task) => {
            if (err || !task || !task.recurrence) return;

            let newDueDate;
            const today = new Date();
            if (task.recurrence === 'daily') {
                newDueDate = new Date(today.setDate(today.getDate() + 1)).toISOString().split('T')[0];
            } else if (task.recurrence === 'weekly') {
                newDueDate = new Date(today.setDate(today.getDate() + 7)).toISOString().split('T')[0];
            } else if (task.recurrence === 'monthly') {
                newDueDate = new Date(today.setMonth(today.getMonth() + 1)).toISOString().split('T')[0];
            }

            db.get(`SELECT COUNT(*) as count FROM tasks WHERE original_task_id = ? AND due_date = ?`, 
                [req.params.id, newDueDate], (err, row) => {
                    if (err || row.count >= 5) return;

                    db.run(
                        `INSERT INTO tasks (title, type, description, due_date, urgency, allocated_to, season, image, completed, archived, recurrence, original_task_id) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [task.title, task.type, task.description, newDueDate, task.urgency, task.allocated_to, task.season, task.image, false, false, task.recurrence, req.params.id],
                        function(err) {
                            if (!err) {
                                console.log(`Recreated task ${task.title} with new due date ${newDueDate}`);
                                broadcast({ type: 'new_task', taskId: this.lastID });
                            }
                        }
                    );
                });
        });
    });
});

app.post('/api/tasks/:id/archive', ensureAuthenticated, (req, res) => {
    db.run(`UPDATE tasks SET archived = ? WHERE id = ?`, [true, req.params.id], function(err) {
        if (err) {
            console.error('Task archive error:', err);
            return res.status(500).json({ success: false, message: 'Failed to archive task' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        broadcast({ type: 'updated_task', taskId: req.params.id });
        res.json({ success: true });
    });
});

app.put('/api/tasks/:id', ensureAuthenticated, upload.single('image'), (req, res) => {
    const { title, type, description, due_date, urgency, allocated_to, season, recurrence, existing_image } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : existing_image;

    console.log('Task update request:', { id: req.params.id, title, type, description, due_date, urgency, allocated_to, season, recurrence, image });

    if (!title || !type || !urgency) {
        console.error('Missing required fields');
        return res.json({ success: false, message: 'Title, type, and urgency are required' });
    }

    if (!due_date && (!season || season === 'all')) {
        console.error('Validation failed: due date or specific season required');
        return res.json({ success: false, message: 'Either a due date or a specific season is required' });
    }

    db.run(
        `UPDATE tasks SET title = ?, type = ?, description = ?, due_date = ?, urgency = ?, allocated_to = ?, season = ?, image = ?, recurrence = ? WHERE id = ?`,
        [title, type, description || null, due_date || null, urgency, allocated_to || null, season || 'all', image, recurrence || null, req.params.id],
        function(err) {
            if (err) {
                console.error('Task update error:', err);
                return res.status(500).json({ success: false, message: 'Failed to update task: ' + err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ success: false, message: 'Task not found' });
            }
            console.log('Task updated:', { id: req.params.id, title, due_date });
            broadcast({ type: 'updated_task', taskId: req.params.id });
            res.json({ success: true });
        }
    );
});

app.delete('/api/tasks/:id', ensureAuthenticated, (req, res) => {
    db.run(`DELETE FROM tasks WHERE id = ?`, [req.params.id], function(err) {
        if (err) {
            console.error('Task deletion error:', err);
            return res.status(500).json({ success: false, message: 'Failed to delete task' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        console.log('Task deleted:', { id: req.params.id });
        broadcast({ type: 'updated_task', taskId: req.params.id });
        res.json({ success: true });
    });
});

// User routes
app.get('/api/users', ensureAuthenticated, (req, res) => {
    db.all(`SELECT id, username, role FROM users`, [], (err, users) => {
        if (err) {
            console.error('Users fetch error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json(users);
    });
});

app.post('/api/users', ensureAuthenticated, (req, res) => {
    const { username, password, role } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, [username, hashedPassword, role], function(err) {
        if (err) {
            console.error('User creation error:', err);
            return res.json({ success: false, message: 'Username already exists' });
        }
        console.log('User created:', { username, role });
        res.json({ success: true });
    });
});

app.put('/api/users/:id', ensureAuthenticated, (req, res) => {
    const { username, password, role } = req.body;
    const hashedPassword = password ? bcrypt.hashSync(password, 10) : null;
    if (hashedPassword) {
        db.run(`UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?`, [username, hashedPassword, role, req.params.id], function(err) {
            if (err) {
                console.error('User update error:', err);
                return res.json({ success: false, message: 'Failed to update user' });
            }
            console.log('User updated:', { id: req.params.id, username, role });
            res.json({ success: true });
        });
    } else {
        db.run(`UPDATE users SET username = ?, role = ? WHERE id = ?`, [username, role, req.params.id], function(err) {
            if (err) {
                console.error('User update error:', err);
                return res.json({ success: false, message: 'Failed to update user' });
            }
            console.log('User updated:', { id: req.params.id, username, role });
            res.json({ success: true });
        });
    }
});

app.delete('/api/users/:id', ensureAuthenticated, (req, res) => {
    db.run(`DELETE FROM users WHERE id = ?`, [req.params.id], function(err) {
        if (err) {
            console.error('User deletion error:', err);
            return res.status(500).json({ success: false, message: 'Failed to delete user' });
        }
        console.log('User deleted:', { id: req.params.id });
        res.json({ success: true });
    });
});

// WebSocket broadcast function
function broadcast(data) {
    console.log('Broadcasting:', data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Start the server
server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
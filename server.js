const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const bcrypt = require('bcrypt');
const WebSocket = require('ws');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');

const app = express();
const port = process.env.PORT || 10000;

// Database setup
const dbPath = process.env.NODE_ENV === 'production' ? '/opt/render/project/src/database.db' : './database.db';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to SQLite database');
});

// Database migration and seeding
db.serialize(() => {
    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        )
    `);

    // Add permissions column if it doesn't exist
    db.get("PRAGMA table_info(users)", (err, columns) => {
        if (err) {
            console.error('Error checking users table schema:', err.message);
            return;
        }
        const hasPermissions = columns.some(col => col.name === 'permissions');
        if (!hasPermissions) {
            console.log('Adding permissions column to users table...');
            db.run(`
                ALTER TABLE users
                ADD COLUMN permissions TEXT DEFAULT '["tasks"]'
            `, (err) => {
                if (err) {
                    console.error('Error adding permissions column:', err.message);
                } else {
                    console.log('Permissions column added successfully');
                }
            });
        } else {
            console.log('Permissions column already exists');
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            due_date TEXT,
            urgency TEXT NOT NULL,
            allocated_to TEXT,
            season TEXT DEFAULT 'all',
            image TEXT,
            completed BOOLEAN DEFAULT FALSE,
            archived BOOLEAN DEFAULT FALSE,
            recurrence TEXT,
            original_task_id INTEGER,
            completion_image TEXT,
            completion_note TEXT
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location TEXT NOT NULL,
            urgency TEXT NOT NULL,
            image TEXT,
            description TEXT,
            raised_by TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
            sid TEXT PRIMARY KEY,
            expires INTEGER,
            data TEXT
        )
    `);

    // Seed default admin user if no users exist
    setTimeout(() => {
        db.get('SELECT COUNT(*) as count FROM users', [], async (err, row) => {
            if (err) {
                console.error('Error checking users count:', err.message);
                return;
            }
            if (row.count === 0) {
                console.log('No users found, seeding default admin user...');
                try {
                    const hashedPassword = await bcrypt.hash('admin123', 10);
                    db.run(
                        'INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)',
                        ['admin', hashedPassword, 'admin', '["tasks","admin","archive","staff","issues"]'],
                        (err) => {
                            if (err) {
                                console.error('Error seeding admin user:', err.message);
                            } else {
                                console.log('Default admin user created: username=admin, password=admin123');
                            }
                        }
                    );
                } catch (err) {
                    console.error('Error hashing password for admin user:', err.message);
                }
            } else {
                console.log('Users table already contains data, skipping seeding.');
            }
        });
    }, 1000);
});

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'public/uploads/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Sequelize for session store
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath
});
const sessionStore = new SequelizeStore({ db: sequelize });
sessionStore.sync();

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
}));
app.use((req, res, next) => {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    next();
});

// Authentication middleware
function ensureAuthenticated(req, res, next) {
    if (req.session.userId) return next();
    console.log('Unauthorized access attempt:', req.path);
    res.status(401).json({ success: false, message: 'Unauthorized' });
}

// WebSocket server
const server = app.listen(port, () => console.log(`Server running on port ${port}`));
const wss = new WebSocket.Server({ server });

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', ensureAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/archive', ensureAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'public', 'archive.html')));
app.get('/staff', ensureAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'public', 'staff.html')));
app.get('/issues', ensureAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'public', 'issues.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt:', { username });
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            console.error('Login database error:', err.message);
            return res.json({ success: false, message: 'Server error' });
        }
        if (!user) {
            console.log('User not found:', username);
            return res.json({ success: false, message: 'Invalid credentials' });
        }
        try {
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                console.log('Invalid password for user:', username);
                return res.json({ success: false, message: 'Invalid credentials' });
            }
            req.session.userId = user.id;
            console.log('Login successful:', username);
            res.json({ success: true });
        } catch (err) {
            console.error('Bcrypt error:', err.message);
            res.json({ success: false, message: 'Server error' });
        }
    });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err.message);
            return res.json({ success: false, message: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

// Current user
app.get('/api/current-user', (req, res) => {
    if (!req.session.userId) {
        console.log('No session userId');
        return res.json(null);
    }
    db.get('SELECT id, username, role, permissions FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        if (err) {
            console.error('Current user database error:', err.message);
            return res.json(null);
        }
        if (!user) {
            console.log('User not found for session userId:', req.session.userId);
            return res.json(null);
        }
        try {
            user.permissions = JSON.parse(user.permissions || '["tasks"]');
            console.log('Current user:', user);
            res.json(user);
        } catch (err) {
            console.error('Permissions parse error:', err.message);
            res.json(null);
        }
    });
});

// Users
app.get('/api/users', ensureAuthenticated, (req, res) => {
    db.all('SELECT id, username, role, permissions FROM users', [], (err, users) => {
        if (err) {
            console.error('Users fetch error:', err.message);
            return res.json({ success: false, message: 'Server error' });
        }
        users.forEach(user => {
            try {
                user.permissions = JSON.parse(user.permissions || '["tasks"]');
            } catch (err) {
                console.error('Permissions parse error for user:', user.username, err.message);
                user.permissions = ['tasks'];
            }
        });
        res.json(users);
    });
});

app.post('/api/users', ensureAuthenticated, async (req, res) => {
    const { username, password, role, permissions } = req.body;
    if (!username || !password || !role || !permissions) {
        return res.json({ success: false, message: 'Missing required fields' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
            'INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, role, JSON.stringify(permissions)],
            function(err) {
                if (err) {
                    console.error('User creation error:', err.message);
                    return res.json({ success: false, message: 'Failed to create user' });
                }
                res.json({ success: true });
            }
        );
    } catch (err) {
        console.error('User creation error:', err.message);
        res.json({ success: false, message: 'Server error' });
    }
});

app.put('/api/users/:id', ensureAuthenticated, async (req, res) => {
    const { username, password, role, permissions } = req.body;
    let query = 'UPDATE users SET username = ?, role = ?, permissions = ?';
    const params = [username, role, JSON.stringify(permissions)];
    if (password) {
        query += ', password = ?';
        params.push(await bcrypt.hash(password, 10));
    }
    query += ' WHERE id = ?';
    params.push(req.params.id);
    db.run(query, params, function(err) {
        if (err) {
            console.error('User update error:', err.message);
            return res.json({ success: false, message: 'Failed to update user' });
        }
        if (this.changes === 0) {
            return res.json({ success: false, message: 'User not found' });
        }
        res.json({ success: true });
    });
});

app.delete('/api/users/:id', ensureAuthenticated, (req, res) => {
    db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            console.error('User deletion error:', err.message);
            return res.json({ success: false, message: 'Failed to delete user' });
        }
        if (this.changes === 0) {
            return res.json({ success: false, message: 'User not found' });
        }
        res.json({ success: true });
    });
});

// Tasks
app.get('/api/tasks', ensureAuthenticated, (req, res) => {
    db.all('SELECT * FROM tasks', [], (err, tasks) => {
        if (err) {
            console.error('Tasks fetch error:', err.message);
            return res.json({ success: false, message: 'Server error' });
        }
        res.json(tasks);
    });
});

app.post('/api/tasks', ensureAuthenticated, upload.single('image'), (req, res) => {
    const { title, type, description, due_date, urgency, allocated_to, season, recurrence } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const today = new Date().toISOString().split('T')[0];
    if (!title || !type || !urgency) {
        console.error('Missing required fields:', { title, type, urgency });
        return res.json({ success: false, message: 'Title, type, and urgency are required' });
    }
    if (!due_date && (!season || season === 'all') && due_date !== today) {
        console.error('Validation failed: due date or specific season required');
        return res.json({ success: false, message: 'Either a due date or a specific season is required' });
    }
    db.run(
        `INSERT INTO tasks (title, type, description, due_date, urgency, allocated_to, season, image, completed, archived, recurrence) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, type, description || null, due_date || null, urgency, allocated_to || null, season || 'all', image, false, false, recurrence || null],
        function(err) {
            if (err) {
                console.error('Task insertion error:', err.message);
                return res.json({ success: false, message: 'Failed to add task' });
            }
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'new_task', id: this.lastID }));
                }
            });
            res.json({ success: true });
        }
    );
});

app.put('/api/tasks/:id', ensureAuthenticated, upload.single('image'), (req, res) => {
    const { title, type, description, due_date, urgency, allocated_to, season, recurrence, existing_image } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : existing_image;
    db.run(
        `UPDATE tasks SET title = ?, type = ?, description = ?, due_date = ?, urgency = ?, allocated_to = ?, season = ?, image = ?, recurrence = ? WHERE id = ?`,
        [title, type, description || null, due_date || null, urgency, allocated_to || null, season || 'all', image, recurrence || null, req.params.id],
        function(err) {
            if (err) {
                console.error('Task update error:', err.message);
                return res.json({ success: false, message: 'Failed to update task' });
            }
            if (this.changes === 0) {
                return res.json({ success: false, message: 'Task not found' });
            }
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'updated_task', id: req.params.id }));
                }
            });
            res.json({ success: true });
        }
    );
});

app.post('/api/tasks/:id/complete', ensureAuthenticated, upload.single('completion_image'), (req, res) => {
    const { completion_note } = req.body;
    const completion_image = req.file ? `/uploads/${req.file.filename}` : null;
    if (!completion_image && !completion_note) {
        console.error('Completion validation failed:', { completion_image, completion_note });
        return res.json({ success: false, message: 'Image or note required for completion' });
    }
    db.run(
        `UPDATE tasks SET completed = ?, completion_image = ?, completion_note = ? WHERE id = ?`,
        [true, completion_image, completion_note || null, req.params.id],
        function(err) {
            if (err) {
                console.error('Task completion error:', err.message);
                return res.json({ success: false, message: 'Failed to complete task' });
            }
            if (this.changes === 0) {
                return res.json({ success: false, message: 'Task not found' });
            }
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'updated_task', id: req.params.id }));
                }
            });
            res.json({ success: true });
        }
    );
});

app.post('/api/tasks/:id/archive', ensureAuthenticated, (req, res) => {
    db.run(
        `UPDATE tasks SET archived = ? WHERE id = ?`,
        [true, req.params.id],
        function(err) {
            if (err) {
                console.error('Task archive error:', err.message);
                return res.json({ success: false, message: 'Failed to archive task' });
            }
            if (this.changes === 0) {
                return res.json({ success: false, message: 'Task not found' });
            }
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'updated_task', id: req.params.id }));
                }
            });
            res.json({ success: true });
        }
    );
});

app.post('/api/tasks/:id/unarchive', ensureAuthenticated, (req, res) => {
    db.run(
        `UPDATE tasks SET archived = ? WHERE id = ?`,
        [false, req.params.id],
        function(err) {
            if (err) {
                console.error('Task unarchive error:', err.message);
                return res.json({ success: false, message: 'Failed to unarchive task' });
            }
            if (this.changes === 0) {
                return res.json({ success: false, message: 'Task not found' });
            }
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'updated_task', id: req.params.id }));
                }
            });
            res.json({ success: true });
        }
    );
});

app.delete('/api/tasks/:id', ensureAuthenticated, (req, res) => {
    db.run('DELETE FROM tasks WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            console.error('Task deletion error:', err.message);
            return res.json({ success: false, message: 'Failed to delete task' });
        }
        if (this.changes === 0) {
            return res.json({ success: false, message: 'Task not found' });
        }
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'updated_task', id: req.params.id }));
            }
        });
        res.json({ success: true });
    });
});

app.post('/api/tasks/from-issue', ensureAuthenticated, upload.single('image'), (req, res) => {
    const { title, type, description, due_date, urgency, allocated_to, season, recurrence, issue_id } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    if (!title || !type || !urgency) {
        console.error('Missing required fields for task from issue:', { title, type, urgency });
        return res.json({ success: false, message: 'Title, type, and urgency are required' });
    }
    db.run(
        `INSERT INTO tasks (title, type, description, due_date, urgency, allocated_to, season, image, completed, archived, recurrence) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, type, description || null, due_date || null, urgency, allocated_to || null, season || 'all', image, false, false, recurrence || null],
        function(err) {
            if (err) {
                console.error('Task from issue error:', err.message);
                return res.json({ success: false, message: 'Failed to create task' });
            }
            db.run('DELETE FROM issues WHERE id = ?', [issue_id], (err) => {
                if (err) console.error('Issue deletion error:', err.message);
            });
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'new_task', id: this.lastID }));
                }
            });
            res.json({ success: true });
        }
    );
});

// Issues
app.get('/api/issues', ensureAuthenticated, (req, res) => {
    db.all('SELECT * FROM issues ORDER BY created_at DESC', [], (err, issues) => {
        if (err) {
            console.error('Issues fetch error:', err.message);
            return res.json({ success: false, message: 'Server error' });
        }
        res.json(issues);
    });
});

app.post('/api/issues', ensureAuthenticated, upload.single('image'), (req, res) => {
    const { location, urgency, description, raised_by } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const created_at = new Date().toISOString();
    if (!location || !urgency || !raised_by) {
        console.error('Missing required fields for issue:', { location, urgency, raised_by });
        return res.json({ success: false, message: 'Location, urgency, and raised_by are required' });
    }
    db.run(
        `INSERT INTO issues (location, urgency, image, description, raised_by, created_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [location, urgency, image, description || null, raised_by, created_at],
        function(err) {
            if (err) {
                console.error('Issue creation error:', err.message);
                return res.json({ success: false, message: 'Failed to add issue' });
            }
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'new_issue', id: this.lastID }));
                }
            });
            res.json({ success: true });
        }
    );
});

app.delete('/api/issues/:id', ensureAuthenticated, (req, res) => {
    db.run('DELETE FROM issues WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            console.error('Issue deletion error:', err.message);
            return res.json({ success: false, message: 'Failed to delete issue' });
        }
        if (this.changes === 0) {
            return res.json({ success: false, message: 'Issue not found' });
        }
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'updated_issue', id: req.params.id }));
            }
        });
        res.json({ success: true });
    });
});

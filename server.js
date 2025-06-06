const express = require('express');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 10000;

// SQLite database setup
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: console.log
});

// Session store
const store = new SequelizeStore({
    db: sequelize,
    tableName: 'Sessions',
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 24 * 60 * 60 * 1000
});

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    store: store,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Models
const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, defaultValue: 'user' },
    permissions: { type: DataTypes.JSON, defaultValue: ['tasks'] }
});

const Task = sequelize.define('Task', {
    title: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    due_date: { type: DataTypes.DATE },
    urgency: { type: DataTypes.STRING, defaultValue: 'medium' },
    allocated_to: { type: DataTypes.STRING },
    season: { type: DataTypes.STRING, defaultValue: 'all' },
    recurrence: { type: DataTypes.STRING },
    image: { type: DataTypes.STRING },
    completion_note: { type: DataTypes.TEXT },
    completion_image: { type: DataTypes.STRING },
    completed: { type: DataTypes.BOOLEAN, defaultValue: false },
    archived: { type: DataTypes.BOOLEAN, defaultValue: false }
});

const Issue = sequelize.define('Issue', {
    location: { type: DataTypes.STRING, allowNull: false },
    urgency: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    raised_by: { type: DataTypes.STRING, allowNull: false },
    image: { type: DataTypes.STRING },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
});

// Sync database
sequelize.sync().then(async () => {
    console.log('Connected to SQLite database');
    store.sync();
    try {
        const [results] = await sequelize.query("PRAGMA table_info(Users)");
        const hasPermissions = results.some(col => col.name === 'permissions');
        if (!hasPermissions) {
            console.log('Adding permissions column to users table...');
            await sequelize.query('ALTER TABLE Users ADD COLUMN permissions JSON');
            console.log('Permissions column added successfully');
        }
        const users = await User.findAll();
        if (users.length === 0) {
            console.log('No users found, seeding default admin user...');
            await User.create({
                username: 'admin',
                password: await bcrypt.hash('admin123', 10),
                role: 'admin',
                permissions: ['tasks', 'admin', 'archive', 'staff', 'issues']
            });
            console.log('Default admin user created: username=admin, password=admin123');
        }
    } catch (err) {
        console.error('Database initialization error:', err);
    }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Log all incoming requests
app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.path}, SessionID: ${req.sessionID}`);
    next();
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const requireAuth = async (req, res, next) => {
    console.log(`Request: ${req.method} ${req.path}, SessionID: ${req.sessionID}, UserID: ${req.session.userId || 'none'}`);
    if (req.session.userId) {
        const user = await User.findByPk(req.session.userId);
        if (user) {
            req.user = user;
            return next();
        }
    }
    console.log(`Unauthorized access attempt: ${req.path}`);
    res.status(401).json({ redirect: '/login' });
};

// Routes
app.get('/api/current-user', requireAuth, (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        permissions: req.user.permissions
    });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ where: { username } });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user.id;
            req.session.save(err => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.status(500).json({ success: false, message: 'Server error' });
                }
                console.log(`Login successful: ${username}, SessionID: ${req.sessionID}, UserID: ${user.id}`);
                res.json({ success: true });
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
        res.json({ success: true });
    });
});

app.get('/api/users', requireAuth, async (req, res) => {
    if (!req.user.permissions.includes('staff')) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const users = await User.findAll({ attributes: ['id', 'username', 'role', 'permissions'] });
    res.json(users);
});

app.post('/api/users', requireAuth, upload.none(), async (req, res) => {
    if (!req.user.permissions.includes('staff')) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const { username, password, role, permissions } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({
            username,
            password: hashedPassword,
            role,
            permissions: JSON.parse(permissions)
        });
        res.json({ success: true });
    } catch (err) {
        console.error('User creation error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/users/:id', requireAuth, upload.none(), async (req, res) => {
    if (!req.user.permissions.includes('staff')) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const { username, password, role, permissions } = req.body;
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const updates = { username, role, permissions: JSON.parse(permissions) };
        if (password) {
            updates.password = await bcrypt.hash(password, 10);
        }
        await user.update(updates);
        res.json({ success: true });
    } catch (err) {
        console.error('User update error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/users/:id', requireAuth, async (req, res) => {
    if (!req.user.permissions.includes('staff')) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        await user.destroy();
        res.json({ success: true });
    } catch (err) {
        console.error('User deletion error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/tasks', requireAuth, async (req, res) => {
    const tasks = await Task.findAll();
    res.json(tasks);
});

app.post('/api/tasks', requireAuth, upload.single('image'), async (req, res) => {
    if (!req.user.permissions.includes('admin')) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    try {
        const taskData = {
            title: req.body.title,
            type: req.body.type,
            description: req.body.description,
            due_date: req.body.due_date || null,
            urgency: req.body.urgency,
            allocated_to: req.body.allocated_to || null,
            season: req.body.season,
            recurrence: req.body.recurrence || null,
            image: req.file ? `/uploads/${req.file.filename}` : null
        };
        const task = await Task.create(taskData);
        broadcast({ type: 'new_task', task });
        res.json({ success: true });
    } catch (err) {
        console.error('Task creation error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/tasks/:id', requireAuth, upload.single('image'), async (req, res) => {
    if (!req.user.permissions.includes('admin')) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    try {
        const task = await Task.findByPk(req.params.id);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        const taskData = {
            title: req.body.title,
            type: req.body.type,
            description: req.body.description,
            due_date: req.body.due_date || null,
            urgency: req.body.urgency,
            allocated_to: req.body.allocated_to || null,
            season: req.body.season,
            recurrence: req.body.recurrence || null,
            image: req.file ? `/uploads/${req.file.filename}` : req.body.existing_image
        };
        await task.update(taskData);
        broadcast({ type: 'updated_task', task });
        res.json({ success: true });
    } catch (err) {
        console.error('Task update error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/tasks/:id/complete', requireAuth, upload.single('completion_image'), async (req, res) => {
    try {
        const task = await Task.findByPk(req.params.id);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        if (req.user.role !== 'admin' && task.allocated_to !== req.user.username) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        await task.update({
            completed: true,
            completion_note: req.body.completion_note || null,
            completion_image: req.file ? `/uploads/${req.file.filename}` : null
        });
        broadcast({ type: 'updated_task', task });
        res.json({ success: true });
    } catch (err) {
        console.error('Task completion error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/tasks/:id/archive', requireAuth, async (req, res) => {
    if (!req.user.permissions.includes('admin')) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    try {
        const task = await Task.findByPk(req.params.id);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        await task.update({ archived: true });
        broadcast({ type: 'updated_task', task });
        res.json({ success: true });
    } catch (err) {
        console.error('Task archive error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/tasks/:id/unarchive', requireAuth, async (req, res) => {
    if (!req.user.permissions.includes('admin')) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    try {
        const task = await Task.findByPk(req.params.id);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        await task.update({ archived: false });
        broadcast({ type: 'updated_task', task });
        res.json({ success: true });
    } catch (err) {
        console.error('Task unarchive error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
    if (!req.user.permissions.includes('admin')) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    try {
        const task = await Task.findByPk(req.params.id);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        await task.destroy();
        res.json({ success: true });
    } catch (err) {
        console.error('Task delete error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/issues', requireAuth, async (req, res) => {
    const issues = await Issue.findAll();
    res.json(issues);
});

app.post('/api/issues', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const issueData = {
            location: req.body.location,
            urgency: req.body.urgency,
            description: req.body.description,
            raised_by: req.body.raised_by,
            image: req.file ? `/uploads/${req.file.filename}` : null
        };
        const issue = await Issue.create(issueData);
        broadcast({ type: 'new_issue', issue });
        res.json({ success: true });
    } catch (err) {
        console.error('Issue creation error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/issues/:id', requireAuth, async (req, res) => {
    if (!req.user.permissions.includes('issues')) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    try {
        const issue = await Issue.findByPk(req.params.id);
        if (!issue) {
            return res.status(404).json({ success: false, message: 'Issue not found' });
        }
        await issue.destroy();
        res.json({ success: true });
    } catch (err) {
        console.error('Issue deletion error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/tasks/from-issue', requireAuth, upload.single('image'), async (req, res) => {
    if (!req.user.permissions.includes('admin')) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    try {
        const issue = await Issue.findByPk(req.body.issue_id);
        if (!issue) {
            return res.status(404).json({ success: false, message: 'Issue not found' });
        }
        const taskData = {
            title: req.body.title || `Issue at ${issue.location}`,
            type: req.body.type || 'maintenance',
            description: req.body.description || issue.description,
            due_date: req.body.due_date || null,
            urgency: req.body.urgency || issue.urgency,
            allocated_to: req.body.allocated_to || null,
            season: req.body.season || 'all',
            image: req.file ? `/uploads/${req.file.filename}` : issue.image
        };
        const task = await Task.create(taskData);
        broadcast({ type: 'new_task', task });
        res.json({ success: true });
    } catch (err) {
        console.error('Task from issue creation error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Serve page files
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get(['/', '/admin', '/archive', '/staff', '/issues'], requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket server
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

const wss = new WebSocket.Server({ server });

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    ws.on('error', (err) => console.error('WebSocket error:', err));
});

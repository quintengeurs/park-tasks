const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const ppeRoutes = require('./routes/ppe');
const userRoutes = require('./routes/users');
const issueRoutes = require('./routes/issues');
const multer = require('multer');
const path = require('path');

const app = express();

// Debug: Log server startup
console.log('Starting server at:', new Date().toISOString());

// CORS configuration
app.use(cors({
  origin: 'https://park-staff-frontend.onrender.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON bodies
app.use(express.json());

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'Uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });
app.post('/api/uploads', upload.single('file'), (req, res) => {
  console.log('File uploaded:', req.file);
  res.json({ filePath: `/uploads/${req.file.filename}` });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/ppe', ppeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/issues', issueRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check hit at:', new Date().toISOString());
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Catch-all route for undefined endpoints
app.use('*', (req, res) => {
  console.log('Catch-all route hit:', { url: req.originalUrl, method: req.method });
  res.status(404).json({ error: 'Route not found' });
});

// Database connection
sequelize.authenticate()
  .then(() => {
    console.log('PostgreSQL connected');
    // Sync models (optional, use with caution in production)
    // sequelize.sync({ force: false }).then(() => console.log('Models synced'));
  })
  .catch((err) => {
    console.error('PostgreSQL connection error:', err);
  });

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

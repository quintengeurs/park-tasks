const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const taskRoutes = require('./routes/tasks');
const ppeRoutes = require('./routes/ppe');
const userRoutes = require('./routes/users');
const issueRoutes = require('./routes/issues');
const authRoutes = require('./routes/auth');
const multer = require('multer');
const path = require('path');

const app = express();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

app.use(cors({
  origin: 'https://park-staff-frontend.onrender.com', // Replace with your frontend Render URL
}));
app.use(express.json());

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File upload endpoint
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ filePath: `/uploads/${req.file.filename}` });
});

app.use('/api/tasks', taskRoutes);
app.use('/api/ppe', ppeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/auth', authRoutes);

// Create uploads directory
const fs = require('fs');
fs.mkdirSync('./uploads', { recursive: true });

// Test database connection
sequelize.authenticate()
  .then(() => console.log('PostgreSQL connected'))
  .catch((err) => console.error('PostgreSQL connection error:', err));

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});
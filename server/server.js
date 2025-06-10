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

app.use(cors({
  origin: 'https://park-staff-frontend.onrender.com',
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/tasks', taskRoutes);
app.use('/api/ppe', ppeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/auth', authRoutes);


const fs = require('fs');
fs.mkdirSync('./uploads', { recursive: true });

sequelize.authenticate()
  .then(() => console.log('PostgreSQL connected'))
  .catch((err) => console.error('PostgreSQL connection error:', err));

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});

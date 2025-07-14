const express = require('express');
  const cors = require('cors');
  const jwt = require('jsonwebtoken');
  const authRoutes = require('./routes/auth');
  const taskRoutes = require('./routes/tasks');
  const issueRoutes = require('./routes/issues');
  const { initDatabase } = require('./database');

  const app = express();
  const PORT = process.env.PORT || 3000;
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

  app.use(cors());
  app.use(express.json());
  app.use(express.static('public'));

  const authenticateToken = (req, res, next) => {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'No token provided' });

      jwt.verify(token, JWT_SECRET, (err, user) => {
          if (err) return res.status(403).json({ message: 'Invalid token' });
          req.user = user;
          next();
      });
  };

  app.use('/api/auth', authRoutes);
  app.use('/api/tasks', authenticateToken, taskRoutes);
  app.use('/api/issues', authenticateToken, issueRoutes);

  initDatabase().then(() => {
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  }).catch(err => {
      console.error('Failed to initialize database:', err);
      process.exit(1);
  });
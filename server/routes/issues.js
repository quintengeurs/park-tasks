const express = require('express');
const router = express.Router();
const { Issue } = require('../models');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { description } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    const issue = await Issue.create({
      description,
      image: imagePath,
      userId: req.user.id,
    });
    res.json(issue);
  } catch (error) {
    console.error('Issue creation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

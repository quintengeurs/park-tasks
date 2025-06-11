const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const upload = multer({ dest: 'uploads/' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/staff', require('./routes/staff'));

app.post('/api/upload', upload.single('image'), (req, res) => {
  res.json({ filePath: `/uploads/${req.file.filename}` });
});

app.get('/', (req, res) => res.send('Park Tasks API'));
app.listen(process.env.PORT || 3000, () => console.log('Server running'));

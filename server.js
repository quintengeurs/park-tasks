const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const sanitizeHtml = require('sanitize-html');
const app = express();
const port = 3000;

// Connect to SQLite database
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    // Create tasks table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task TEXT NOT NULL
    )`);
  }
});

// Middleware to parse form data and serve static files
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Route to get all tasks
app.get('/tasks', (req, res) => {
  db.all('SELECT * FROM tasks', [], (err, rows) => {
    if (err) {
      console.error('Error fetching tasks:', err.message);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }
    res.json(rows);
  });
});

// Route to add a new task
app.post('/tasks', (req, res) => {
  const task = sanitizeHtml(req.body.task, {
    allowedTags: [],
    allowedAttributes: {}
  }).trim();

  if (!task) {
    return res.status(400).json({ error: 'Task cannot be empty' });
  }

  db.run('INSERT INTO tasks (task) VALUES (?)', [task], function (err) {
    if (err) {
      console.error('Error adding task:', err.message);
      return res.status(500).json({ error: 'Failed to add task' });
    }
    res.json({ id: this.lastID, task });
  });
});

// Route to delete a task
app.delete('/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  db.run('DELETE FROM tasks WHERE id = ?', [id], function (err) {
    if (err) {
      console.error('Error deleting task:', err.message);
      return res.status(500).json({ error: 'Failed to delete task' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ success: true });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

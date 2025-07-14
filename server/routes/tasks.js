const express = require('express');
const { db } = require('../database');

const router = express.Router();

router.get('/', (req, res) => {
    db.all('SELECT * FROM tasks WHERE user_id = ? AND archived = 0', [req.user.id], (err, tasks) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json(tasks);
    });
});

router.get('/archived', (req, res) => {
    db.all('SELECT * FROM tasks WHERE user_id = ? AND archived = 1', [req.user.id], (err, tasks) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json(tasks);
    });
});

router.post('/', (req, res) => {
    const { title, description, image } = req.body;
    const created_at = new Date().toISOString();
    db.run(
        'INSERT INTO tasks (user_id, title, description, image, completed, archived, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, title, description, image, 0, 0, created_at],
        (err) => {
            if (err) return res.status(500).json({ message: 'Database error' });
            res.status(201).json({ message: 'Task created' });
        }
    );
});

router.patch('/:id', (req, res) => {
    const { completed } = req.body;
    db.run('UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?', [completed ? 1 : 0, req.params.id, req.user.id], (err) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ message: 'Task updated' });
    });
});

router.patch('/:id/archive', (req, res) => {
    db.run('UPDATE tasks SET archived = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ message: 'Task archived' });
    });
});

module.exports = router;
const express = require('express');
const { db } = require('../database');

const router = express.Router();

router.get('/', (req, res) => {
    db.all('SELECT * FROM issues WHERE user_id = ? AND resolved = 0', [req.user.id], (err, issues) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json(issues);
    });
});

router.get('/resolved', (req, res) => {
    db.all('SELECT * FROM issues WHERE user_id = ? AND resolved = 1', [req.user.id], (err, issues) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json(issues);
    });
});

router.post('/', (req, res) => {
    const { location, description, urgency, image } = req.body;
    const created_at = new Date().toISOString();
    db.run(
        'INSERT INTO issues (user_id, location, description, urgency, image, resolved, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, location, description, urgency, image, 0, created_at],
        (err) => {
            if (err) return res.status(500).json({ message: 'Database error' });
            res.status(201).json({ message: 'Issue created' });
        }
    );
});

router.patch('/:id/resolve', (req, res) => {
    db.run('UPDATE issues SET resolved = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ message: 'Issue resolved' });
    });
});

module.exports = router;
const express = require('express');
const router = express.Router();
const { Task } = require('../models');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  const tasks = await Task.findAll({
    where: { status: req.query.status || 'assigned' },
  });
  res.json(tasks);
});

router.patch('/:id', authMiddleware, async (req, res) => {
  const { status, completedImage, completedNote } = req.body;
  const task = await Task.findByPk(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  await task.update({
    status,
    completedImage,
    completedNote,
    completedAt: status === 'pending' ? new Date() : task.completedAt,
  });
  res.json(task);
});

module.exports = router;
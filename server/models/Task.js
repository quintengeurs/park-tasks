const { DataTypes } = require('sequelize');
const sequelize = require('./index');

const Task = sequelize.define('Task', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  image: { type: DataTypes.STRING },
  urgency: {
    type: DataTypes.ENUM('normal', 'urgent'),
    defaultValue: 'normal',
  },
  recurrence: {
    type: DataTypes.ENUM('daily', 'weekly', 'biweekly', 'monthly', 'one-off'),
    defaultValue: 'one-off',
  },
  assignedTo: { type: DataTypes.STRING, allowNull: false },
  status: {
    type: DataTypes.ENUM('assigned', 'pending', 'completed', 'archived'),
    defaultValue: 'assigned',
  },
  completedImage: { type: DataTypes.STRING },
  completedNote: { type: DataTypes.TEXT },
  completedAt: { type: DataTypes.DATE },
}, {
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false,
});

module.exports = Task;
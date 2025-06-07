const { DataTypes } = require('sequelize');
const sequelize = require('./index');

const Issue = sequelize.define('Issue', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  image: { type: DataTypes.STRING },
  status: {
    type: DataTypes.ENUM('open', 'in-progress', 'resolved'),
    defaultValue: 'open',
  },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false,
});

module.exports = Issue;
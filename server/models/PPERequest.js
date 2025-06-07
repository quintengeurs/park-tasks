const { DataTypes } = require('sequelize');
const sequelize = require('./index');

const PPERequest = sequelize.define('PPERequest', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.STRING, allowNull: false },
  items: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  requestedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
  },
}, {
  timestamps: false,
});

module.exports = PPERequest;
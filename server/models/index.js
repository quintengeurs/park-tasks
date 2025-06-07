const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
});

const User = require('./User');
const Task = require('./Task');
const PPERequest = require('./PPERequest');
const Issue = require('./Issue');

module.exports = {
  sequelize,
  User,
  Task,
  PPERequest,
  Issue,
};

sequelize.sync({ alter: true }).then(() => {
  console.log('PostgreSQL database synced');
});
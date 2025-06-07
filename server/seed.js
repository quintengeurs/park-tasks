const { sequelize, User, Task } = require('./models');
const bcrypt = require('bcrypt');

async function seed() {
  await sequelize.sync({ force: true }); // WARNING: Drops existing tables
  const hashedPassword = await bcrypt.hash('password123', 10);
  await User.create({
    email: 'test@example.com',
    password: hashedPassword,
    role: 'Gardener',
    privileges: ['tasks', 'issues'],
    name: 'Test User',
  });
  await Task.create({
    title: 'Clean Park Benches',
    description: 'Clean all benches in the north section.',
    assignedTo: 'test-user-uuid', // Replace with actual UUID after seeding
    recurrence: 'daily',
    urgency: 'normal',
  });
  console.log('Database seeded');
  await sequelize.close();
}

seed().catch(console.error);
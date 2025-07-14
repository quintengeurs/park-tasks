const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('tasks.db');

async function initDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Users table
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE,
                    password TEXT
                )
            `);

            // Tasks table
            db.run(`
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    title TEXT,
                    description TEXT,
                    image TEXT,
                    completed BOOLEAN,
                    archived BOOLEAN,
                    created_at TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);

            // Issues table
            db.run(`
                CREATE TABLE IF NOT EXISTS issues (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    location TEXT,
                    description TEXT,
                    urgency INTEGER,
                    image TEXT,
                    resolved BOOLEAN,
                    created_at TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);

            // Insert a default user (username: admin, password: admin123)
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            db.run(
                `INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)`,
                ['admin', hashedPassword],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    });
}

module.exports = { db, initDatabase };
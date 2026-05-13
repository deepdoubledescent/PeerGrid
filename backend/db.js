// src/db.js
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 1,
  waitForConnections: true,
  queueLimit: 0,
  idleTimeout: 60000, // Close idle connections after 1 minute
});

// Pro-tip: Log connection errors to simplify debugging in sam logs --tail
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

export default pool;
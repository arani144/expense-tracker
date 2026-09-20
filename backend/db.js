const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: process.env.DB_PORT || 4000,
  user: process.env.DB_USER || '4LmvnB3xNudD3B8.root',
  password: process.env.DB_PASSWORD || 'ocean%900',
  database: process.env.DB_NAME || 'expense_tracker',
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool.promise();
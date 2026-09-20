const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const JWT_SECRET = 'your_super_secret_jwt_key_here'; // Replace with any random string

app.use(cors());
app.use(express.json());

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required. Please log in.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Session expired or invalid token.' });
    req.user = user; // contains user.id and user.username
    next();
  });
};

// --- Auth Routes ---

// Register
app.post(['/api/auth/register', '/auth/register'], async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );
    res.status(201).json({ message: 'User registered successfully!' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Username already taken.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post(['/api/auth/login', '/auth/login'], async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Protected Expense Routes ---

// Get all expenses for logged-in user
app.get('/api/expenses', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add expense
app.post('/api/expenses', authenticateToken, async (req, res) => {
  const { title, amount, category, expense_date } = req.body;
  if (!title || !amount || !category || !expense_date) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO expenses (user_id, title, amount, category, expense_date) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, title, amount, category, expense_date]
    );
    res.status(201).json({ id: result.insertId, title, amount, category, expense_date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete expense
app.delete('/api/expenses/:id', authenticateToken, async (req, res) => {
  try {
    await db.query('DELETE FROM expenses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save / update monthly budget
app.post('/api/budget', authenticateToken, async (req, res) => {
  const { month_year, amount } = req.body;
  try {
    await db.query(
      'INSERT INTO budgets (user_id, month_year, amount) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE amount = ?',
      [req.user.id, month_year, amount, amount]
    );
    res.json({ message: 'Budget updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Monthly summary calculation
app.get('/api/summary/:monthYear', authenticateToken, async (req, res) => {
  const { monthYear } = req.params;
  const userId = req.user.id;

  try {
    const [spentRows] = await db.query(
      "SELECT COALESCE(SUM(amount), 0) AS total_spent FROM expenses WHERE user_id = ? AND DATE_FORMAT(expense_date, '%Y-%m') = ?",
      [userId, monthYear]
    );
    const [categoryRows] = await db.query(
      "SELECT category, SUM(amount) AS total FROM expenses WHERE user_id = ? AND DATE_FORMAT(expense_date, '%Y-%m') = ? GROUP BY category",
      [userId, monthYear]
    );
    const [budgetRows] = await db.query(
      'SELECT amount FROM budgets WHERE user_id = ? AND month_year = ?',
      [userId, monthYear]
    );

    const budget = budgetRows[0] ? Number(budgetRows[0].amount) : 0;
    const totalSpent = Number(spentRows[0].total_spent);
    const remaining = budget - totalSpent;

    res.json({
      budget,
      totalSpent,
      remaining,
      categoryBreakdown: categoryRows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
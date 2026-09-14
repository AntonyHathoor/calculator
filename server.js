const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const { evaluate } = require('mathjs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'calculator_db'
};

let pool;
async function initDb() {
  pool = mysql.createPool(dbConfig);
  console.log('Connected to MySQL pool');
}
initDb();

app.post('/api/calculate', async (req, res) => {
  try {
    const { expression } = req.body;
    if (!expression || typeof expression !== 'string') {
      return res.status(400).json({ error: 'المعادلة غير صحيحة' });
    }

    let result;
    try {
      result = evaluate(expression);
    } catch (e) {
      return res.status(400).json({ error: 'معادلة غير صحيحة' });
    }

    if (typeof result !== 'number' || !isFinite(result)) {
      return res.status(400).json({ error: 'ناتج غير معروف' });
    }

    await pool.query(
      'INSERT INTO calculations (expression, result) VALUES (?, ?)',
      [expression, result]
    );

    res.json({ result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حصل خطأ في السيرفر' });
  }
});

app.get('/api/history', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM calculations ORDER BY id DESC LIMIT 100'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حصل خطأ في السيرفر' });
  }
});

app.delete('/api/history/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM calculations WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حصل خطأ في السيرفر' });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

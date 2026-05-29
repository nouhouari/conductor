const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/conductor_test',
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Database setup ──

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'not urgent',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'not urgent'`);
}

// ── API routes ──

app.get('/api/todos', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM todos ORDER BY created_at DESC');
  res.json(rows);
});

app.get('/api/todos/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM todos WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

app.post('/api/todos', async (req, res) => {
  const { title, status = 'open', priority = 'not urgent' } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const { rows } = await pool.query(
    'INSERT INTO todos (title, status, priority) VALUES ($1, $2, $3) RETURNING *',
    [title, status, priority]
  );
  res.status(201).json(rows[0]);
});

app.put('/api/todos/:id', async (req, res) => {
  const { title, status, priority } = req.body;
  const fields = [];
  const values = [];
  let idx = 1;

  if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
  if (status !== undefined) { fields.push(`status = $${idx++}`); values.push(status); }
  if (priority !== undefined) { fields.push(`priority = $${idx++}`); values.push(priority); }
  if (fields.length === 0) return res.status(400).json({ error: 'nothing to update' });

  fields.push(`updated_at = NOW()`);
  values.push(req.params.id);

  const { rows } = await pool.query(
    `UPDATE todos SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

app.delete('/api/todos/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM todos WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

// ── Web pages ──

app.get('/login', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Login</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
  form { background: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.1); width: 320px; }
  h1 { margin: 0 0 1.5rem; font-size: 1.4rem; }
  label { display: block; margin-bottom: .25rem; font-size: .9rem; }
  input[type="text"], input[type="password"] { width: 100%; padding: .5rem; margin-bottom: 1rem; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
  button { width: 100%; padding: .6rem; background: #4f46e5; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
  button:hover { background: #4338ca; }
</style>
</head>
<body>
  <form method="POST" action="/login">
    <h1>Sign In</h1>
    <label for="username">Email</label>
    <input type="text" id="username" name="username" data-testid="username" required>
    <label for="password">Password</label>
    <input type="password" id="password" name="password" data-testid="password" required>
    <button type="submit" data-testid="login-submit">Log in</button>
  </form>
</body>
</html>`);
});

app.post('/login', (_req, res) => {
  res.redirect('/');
});

app.get('/', async (_req, res) => {
  const { rows: todos } = await pool.query('SELECT * FROM todos ORDER BY created_at DESC');
  const todoItems = todos
    .map(t => {
      const checked = t.status === 'done' ? 'checked' : '';
      const doneClass = t.status === 'done' ? ' done' : '';
      return `<li data-testid="todo-item" data-id="${t.id}" data-priority="${escapeHtml(t.priority)}" class="${doneClass}">
          <input type="checkbox" data-testid="todo-toggle" ${checked} onchange="toggleTodo(${t.id}, this.checked)">
          <span class="todo-title">${escapeHtml(t.title)}</span>
          <span class="todo-priority" data-testid="todo-priority">${escapeHtml(t.priority)}</span>
          <span class="todo-status">[${escapeHtml(t.status)}]</span>
          <button class="btn-edit" data-testid="todo-edit" onclick="editTodo(${t.id}, '${escapeAttr(t.title)}')">Edit</button>
          <button class="btn-delete" data-testid="todo-delete" onclick="deleteTodo(${t.id})">Delete</button>
        </li>`;
    })
    .join('\n    ');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Todos</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 600px; margin: 2rem auto; padding: 0 1rem; background: #f5f5f5; }
  h1 { color: #1e1b4b; }
  .add-form { display: flex; gap: .5rem; margin-bottom: 1.5rem; }
  .add-form input { flex: 1; padding: .5rem; border: 1px solid #ccc; border-radius: 4px; }
  .add-form select { padding: .5rem; border: 1px solid #ccc; border-radius: 4px; }
  .add-form button { padding: .5rem 1rem; background: #4f46e5; color: #fff; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap; }
  ul { list-style: none; padding: 0; }
  li { background: #fff; padding: .75rem 1rem; margin-bottom: .5rem; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,.08); display: flex; align-items: center; gap: .5rem; }
  li[data-priority="critical"] { background: #fee2e2; }
  li[data-priority="urgent"] { background: #fef3c7; }
  li[data-priority="not urgent"] { background: #dcfce7; }
  li.done .todo-title { text-decoration: line-through; color: #999; }
  .todo-title { flex: 1; }
  .todo-priority { font-size: .75rem; padding: .15rem .4rem; border-radius: 3px; font-weight: 600; }
  li[data-priority="critical"] .todo-priority { color: #dc2626; }
  li[data-priority="urgent"] .todo-priority { color: #d97706; }
  li[data-priority="not urgent"] .todo-priority { color: #16a34a; }
  .todo-status { color: #888; font-size: .85rem; }
  .btn-edit, .btn-delete { padding: .25rem .5rem; border: none; border-radius: 4px; cursor: pointer; font-size: .8rem; }
  .btn-edit { background: #e0e7ff; color: #4338ca; }
  .btn-delete { background: #fee2e2; color: #dc2626; }
</style>
</head>
<body>
  <h1>My Todos</h1>
  <form class="add-form">
    <input type="text" name="title" data-testid="todo-input" placeholder="What needs to be done?" required>
    <select name="priority" data-testid="todo-priority-select">
      <option value="not urgent">Not Urgent</option>
      <option value="urgent">Urgent</option>
      <option value="critical">Critical</option>
    </select>
    <button type="submit" data-testid="todo-add">Add</button>
  </form>
  <ul data-testid="todo-list">
    ${todoItems}
  </ul>
  <script>
    const API = '/api/todos';

    document.querySelector('.add-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.querySelector('[data-testid="todo-input"]');
      const select = document.querySelector('[data-testid="todo-priority-select"]');
      const title = input.value.trim();
      if (!title) return;
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, status: 'open', priority: select.value })
      });
      if (res.ok) location.reload();
    });

    async function toggleTodo(id, checked) {
      await fetch(API + '/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: checked ? 'done' : 'open' })
      });
      location.reload();
    }

    async function editTodo(id, currentTitle) {
      const title = prompt('Edit todo title:', currentTitle);
      if (title === null || title.trim() === '') return;
      await fetch(API + '/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() })
      });
      location.reload();
    }

    async function deleteTodo(id) {
      if (!confirm('Delete this todo?')) return;
      await fetch(API + '/' + id, { method: 'DELETE' });
      location.reload();
    }
  </script>
</body>
</html>`);
});

// ── Helpers ──

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ── Start ──

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Test server running at http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});

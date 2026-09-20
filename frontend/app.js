const API_URL = 'https://expense-tracker-sntg.onrender.com';
let chartInstance = null;
let isRegisterMode = false;

// DOM Elements
const authSection = document.getElementById('authSection');
const dashboardSection = document.getElementById('dashboardSection');
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authSubtitle');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const toggleAuthBtn = document.getElementById('toggleAuthBtn');
const authError = document.getElementById('authError');
const userGreeting = document.getElementById('userGreeting');

const monthPicker = document.getElementById('monthPicker');
const today = new Date();
monthPicker.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
document.getElementById('date').value = today.toISOString().split('T')[0];

// Toggle Login / Register View
toggleAuthBtn.addEventListener('click', () => {
  isRegisterMode = !isRegisterMode;
  authError.classList.add('hidden');
  if (isRegisterMode) {
    authTitle.textContent = 'Create a new account to get started';
    authSubmitBtn.textContent = 'Sign Up';
    toggleAuthBtn.textContent = 'Already have an account? Sign in';
  } else {
    authTitle.textContent = 'Sign in to manage your budget';
    authSubmitBtn.textContent = 'Sign In';
    toggleAuthBtn.textContent = "Don't have an account? Sign up";
  }
});

// Handle Login / Registration
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.classList.add('hidden');
  const endpoint = isRegisterMode ? '/auth/register' : '/auth/login';

  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: document.getElementById('authUsername').value,
      password: document.getElementById('authPassword').value
    })
  });

  const data = await res.json();
  if (!res.ok) {
    authError.textContent = data.error || 'Authentication failed';
    authError.classList.remove('hidden');
    return;
  }

  if (isRegisterMode) {
    alert('Account created successfully! Please sign in.');
    toggleAuthBtn.click();
  } else {
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
    initApp();
  }
});

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  initApp();
}

// Wrapper for Authenticated API Requests
async function authFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  options.headers = {
    ...options.headers,
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const res = await fetch(url, options);
  if (res.status === 401 || res.status === 403) {
    logout();
    throw new Error('Unauthorized');
  }
  return res;
}

// Dashboard Functions
monthPicker.addEventListener('change', loadDashboard);

async function loadDashboard() {
  const currentMonth = monthPicker.value;
  await Promise.all([loadExpenses(), loadSummary(currentMonth)]);
}

async function loadSummary(month) {
  const res = await authFetch(`${API_URL}/summary/${month}`);
  const data = await res.json();

  document.getElementById('budgetInput').value = data.budget || '';
  document.getElementById('totalSpent').textContent = `$${data.totalSpent.toFixed(2)}`;

  const remainingEl = document.getElementById('remainingBalance');
  remainingEl.textContent = `$${data.remaining.toFixed(2)}`;
  remainingEl.className = data.remaining < 0
    ? 'text-2xl font-bold text-red-600 mt-2'
    : 'text-2xl font-bold text-emerald-600 mt-2';

  renderChart(data.categoryBreakdown);
}

function renderChart(categories) {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  const labels = categories.map(c => c.category);
  const dataValues = categories.map(c => c.total);

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length ? labels : ['No Expenses'],
      datasets: [{
        data: dataValues.length ? dataValues : [1],
        backgroundColor: labels.length
          ? ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#64748b']
          : ['#e2e8f0']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

async function loadExpenses() {
  const res = await authFetch(`${API_URL}/expenses`);
  const expenses = await res.json();

  const tbody = document.getElementById('expenseTableBody');
  tbody.innerHTML = expenses.map(item => `
    <tr>
      <td class="p-3 font-medium">${item.title}</td>
      <td class="p-3"><span class="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs">${item.category}</span></td>
      <td class="p-3 text-gray-500">${item.expense_date.split('T')[0]}</td>
      <td class="p-3 font-semibold text-slate-900">$${Number(item.amount).toFixed(2)}</td>
      <td class="p-3">
        <button onclick="deleteExpense(${item.id})" class="text-red-500 hover:text-red-700 text-xs">Delete</button>
      </td>
    </tr>
  `).join('');
}

document.getElementById('expenseForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('title').value,
    amount: parseFloat(document.getElementById('amount').value),
    category: document.getElementById('category').value,
    expense_date: document.getElementById('date').value
  };

  await authFetch(`${API_URL}/expenses`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  e.target.reset();
  document.getElementById('date').value = new Date().toISOString().split('T')[0];
  loadDashboard();
});

async function saveBudget() {
  const amount = parseFloat(document.getElementById('budgetInput').value) || 0;
  await authFetch(`${API_URL}/budget`, {
    method: 'POST',
    body: JSON.stringify({ month_year: monthPicker.value, amount })
  });
  loadDashboard();
}

async function deleteExpense(id) {
  await authFetch(`${API_URL}/expenses/${id}`, { method: 'DELETE' });
  loadDashboard();
}

function initApp() {
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');

  if (token) {
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    userGreeting.textContent = username || 'User';
    loadDashboard();
  } else {
    authSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
  }
}

// Check auth state on start
initApp();
const API_URL = 'https://expense-tracker-sntg.onrender.com';

let chartInstance = null;
let isRegisterMode = false;

// ===============================
// DOM ELEMENTS
// ===============================

const authSection = document.getElementById('authSection');
const dashboardSection = document.getElementById('dashboardSection');
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authSubtitle');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const toggleAuthBtn = document.getElementById('toggleAuthBtn');
const authError = document.getElementById('authError');
const userGreeting = document.getElementById('userGreeting');

const monthPicker = document.getElementById('monthPicker');


// ===============================
// SET DEFAULT DATE
// ===============================

const today = new Date();

monthPicker.value =
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

document.getElementById('date').value =
    today.toISOString().split('T')[0];


// ===============================
// TOGGLE LOGIN / REGISTER
// ===============================

toggleAuthBtn.addEventListener('click', () => {

    isRegisterMode = !isRegisterMode;

    authError.classList.add('hidden');

    if (isRegisterMode) {

        authTitle.textContent =
            'Create a new account to get started';

        authSubmitBtn.textContent =
            'Sign Up';

        toggleAuthBtn.textContent =
            'Already have an account? Sign in';

    } else {

        authTitle.textContent =
            'Sign in to manage your budget';

        authSubmitBtn.textContent =
            'Sign In';

        toggleAuthBtn.textContent =
            "Don't have an account? Sign up";
    }
});


// ===============================
// LOGIN / REGISTER
// ===============================

authForm.addEventListener('submit', async (e) => {

    e.preventDefault();

    authError.classList.add('hidden');

    const endpoint = isRegisterMode
        ? '/api/auth/register'
        : '/api/auth/login';

    try {

        const res = await fetch(`${API_URL}${endpoint}`, {

            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({

                username:
                    document.getElementById('authUsername').value,

                password:
                    document.getElementById('authPassword').value
            })
        });

        const data = await res.json();

        if (!res.ok) {

            authError.textContent =
                data.error || 'Authentication failed';

            authError.classList.remove('hidden');

            return;
        }

        // Registration successful
        if (isRegisterMode) {

            alert(
                'Account created successfully! Please sign in.'
            );

            toggleAuthBtn.click();

        }

        // Login successful
        else {

            localStorage.setItem(
                'token',
                data.token
            );

            localStorage.setItem(
                'username',
                data.username
            );

            initApp();
        }

    } catch (error) {

        console.error('Authentication error:', error);

        authError.textContent =
            'Unable to connect to the server. Please try again.';

        authError.classList.remove('hidden');
    }
});


// ===============================
// LOGOUT
// ===============================

function logout() {

    localStorage.removeItem('token');

    localStorage.removeItem('username');

    initApp();
}


// ===============================
// AUTHENTICATED API REQUEST
// ===============================

async function authFetch(url, options = {}) {

    const token =
        localStorage.getItem('token');

    options.headers = {

        ...options.headers,

        'Content-Type':
            'application/json',

        'Authorization':
            `Bearer ${token}`
    };

    const res =
        await fetch(url, options);

    if (res.status === 401 || res.status === 403) {

        logout();

        throw new Error('Unauthorized');
    }

    return res;
}


// ===============================
// MONTH CHANGE
// ===============================

monthPicker.addEventListener(
    'change',
    loadDashboard
);


// ===============================
// LOAD DASHBOARD
// ===============================

async function loadDashboard() {

    const currentMonth =
        monthPicker.value;

    try {

        await Promise.all([

            loadExpenses(),

            loadSummary(currentMonth)

        ]);

    } catch (error) {

        console.error(
            'Dashboard loading error:',
            error
        );
    }
}


// ===============================
// LOAD MONTHLY SUMMARY
// ===============================

async function loadSummary(month) {

    const res = await authFetch(
        `${API_URL}/api/summary/${month}`
    );

    const data = await res.json();

    if (!res.ok) {

        throw new Error(
            data.error || 'Failed to load summary'
        );
    }


    // Budget
    document.getElementById(
        'budgetInput'
    ).value = data.budget || '';


    // Total spent
    document.getElementById(
        'totalSpent'
    ).textContent =
        `$${Number(data.totalSpent || 0).toFixed(2)}`;


    // Remaining balance
    const remainingEl =
        document.getElementById(
            'remainingBalance'
        );

    const remaining =
        Number(data.remaining || 0);

    remainingEl.textContent =
        `$${remaining.toFixed(2)}`;


    if (remaining < 0) {

        remainingEl.className =
            'text-2xl font-bold text-red-600 mt-2';

    } else {

        remainingEl.className =
            'text-2xl font-bold text-emerald-600 mt-2';
    }


    // Draw graph
    renderChart(
        data.categoryBreakdown || []
    );
}


// ===============================
// RENDER EXPENSE CHART
// ===============================

function renderChart(categories) {

    const canvas =
        document.getElementById(
            'categoryChart'
        );

    if (!canvas) {

        console.error(
            'categoryChart canvas not found'
        );

        return;
    }


    const ctx =
        canvas.getContext('2d');


    const labels =
        categories.map(
            c => c.category
        );


    const dataValues =
        categories.map(
            c => Number(c.total)
        );


    // Destroy previous chart
    if (chartInstance) {

        chartInstance.destroy();

        chartInstance = null;
    }


    // No expenses
    if (labels.length === 0) {

        chartInstance =
            new Chart(ctx, {

                type: 'doughnut',

                data: {

                    labels: ['No Expenses'],

                    datasets: [{

                        data: [1],

                        backgroundColor:
                            ['#e2e8f0']
                    }]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false
                }
            });

        return;
    }


    // Create chart
    chartInstance =
        new Chart(ctx, {

            type: 'doughnut',

            data: {

                labels: labels,

                datasets: [{

                    data: dataValues,

                    backgroundColor: [

                        '#6366f1',

                        '#ec4899',

                        '#f59e0b',

                        '#10b981',

                        '#3b82f6',

                        '#8b5cf6',

                        '#64748b'
                    ]
                }]
            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                plugins: {

                    legend: {

                        position: 'bottom'
                    }
                }
            }
        });
}


// ===============================
// LOAD ALL EXPENSES
// ===============================

async function loadExpenses() {

    const res =
        await authFetch(
            `${API_URL}/api/expenses`
        );


    const expenses =
        await res.json();


    if (!res.ok) {

        throw new Error(
            expenses.error ||
            'Failed to load expenses'
        );
    }


    const tbody =
        document.getElementById(
            'expenseTableBody'
        );


    tbody.innerHTML =
        expenses.map(item => `

            <tr>

                <td class="p-3 font-medium">
                    ${item.title}
                </td>

                <td class="p-3">

                    <span
                        class="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs">

                        ${item.category}

                    </span>

                </td>

                <td class="p-3 text-gray-500">

                    ${String(item.expense_date).split('T')[0]}

                </td>

                <td class="p-3 font-semibold text-slate-900">

                    $${Number(item.amount).toFixed(2)}

                </td>

                <td class="p-3">

                    <button
                        onclick="deleteExpense(${item.id})"
                        class="text-red-500 hover:text-red-700 text-xs">

                        Delete

                    </button>

                </td>

            </tr>

        `).join('');


    // If there are no expenses
    if (expenses.length === 0) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="p-5 text-center text-gray-500">

                    No expenses added yet.

                </td>

            </tr>

        `;
    }
}


// ===============================
// ADD EXPENSE
// ===============================

document
    .getElementById('expenseForm')
    .addEventListener('submit', async (e) => {

        e.preventDefault();


        const payload = {

            title:
                document.getElementById(
                    'title'
                ).value.trim(),

            amount:
                parseFloat(
                    document.getElementById(
                        'amount'
                    ).value
                ),

            category:
                document.getElementById(
                    'category'
                ).value,

            expense_date:
                document.getElementById(
                    'date'
                ).value
        };


        // Validate
        if (
            !payload.title ||
            !payload.amount ||
            !payload.category ||
            !payload.expense_date
        ) {

            alert(
                'Please fill in all fields.'
            );

            return;
        }


        try {

            const res =
                await authFetch(

                    `${API_URL}/api/expenses`,

                    {

                        method: 'POST',

                        body:
                            JSON.stringify(
                                payload
                            )
                    }
                );


            const data =
                await res.json();


            if (!res.ok) {

                alert(
                    data.error ||
                    'Failed to add expense'
                );

                return;
            }


            alert(
                'Expense added successfully!'
            );


            // Reset form
            e.target.reset();


            // Restore today's date
            document.getElementById(
                'date'
            ).value =
                new Date()
                    .toISOString()
                    .split('T')[0];


            // Reload dashboard
            await loadDashboard();


        } catch (error) {

            console.error(
                'Add expense error:',
                error
            );

            alert(
                'Could not save the expense. Please check your connection.'
            );
        }
    });


// ===============================
// SAVE BUDGET
// ===============================

async function saveBudget() {

    const amount =
        parseFloat(
            document.getElementById(
                'budgetInput'
            ).value
        ) || 0;


    try {

        const res =
            await authFetch(

                `${API_URL}/api/budget`,

                {

                    method: 'POST',

                    body:
                        JSON.stringify({

                            month_year:
                                monthPicker.value,

                            amount:
                                amount
                        })
                }
            );


        const data =
            await res.json();


        if (!res.ok) {

            alert(
                data.error ||
                'Failed to save budget'
            );

            return;
        }


        alert(
            'Budget saved successfully!'
        );


        await loadDashboard();


    } catch (error) {

        console.error(
            'Save budget error:',
            error
        );

        alert(
            'Could not save budget.'
        );
    }
}


// ===============================
// DELETE EXPENSE
// ===============================

async function deleteExpense(id) {

    if (
        !confirm(
            'Are you sure you want to delete this expense?'
        )
    ) {

        return;
    }


    try {

        const res =
            await authFetch(

                `${API_URL}/api/expenses/${id}`,

                {

                    method: 'DELETE'
                }
            );


        const data =
            await res.json();


        if (!res.ok) {

            alert(
                data.error ||
                'Failed to delete expense'
            );

            return;
        }


        await loadDashboard();


    } catch (error) {

        console.error(
            'Delete expense error:',
            error
        );

        alert(
            'Could not delete expense.'
        );
    }
}


// ===============================
// INITIALIZE APP
// ===============================

function initApp() {

    const token =
        localStorage.getItem(
            'token'
        );

    const username =
        localStorage.getItem(
            'username'
        );


    if (token) {

        authSection.classList.add(
            'hidden'
        );

        dashboardSection.classList.remove(
            'hidden'
        );

        userGreeting.textContent =
            username || 'User';


        loadDashboard();

    } else {

        authSection.classList.remove(
            'hidden'
        );

        dashboardSection.classList.add(
            'hidden'
        );
    }
}


// ===============================
// CHECK LOGIN STATE
// ===============================

initApp();
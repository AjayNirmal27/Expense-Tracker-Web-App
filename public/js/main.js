document.addEventListener('DOMContentLoaded', () => {
    function showMessageBox(message, type = 'success') {
        const msgBox = document.getElementById('message-box');
        if (!msgBox) return;

        msgBox.textContent = message;
        msgBox.className = `message-box show ${type === 'error' ? 'error' : 'success'}`;
        setTimeout(() => {
            msgBox.className = 'message-box';
        }, 3000);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const serverMessage = urlParams.get('message');
    if (serverMessage) {
        const isError = serverMessage.toLowerCase().includes('failed') ||
                        serverMessage.toLowerCase().includes('invalid') ||
                        serverMessage.toLowerCase().includes('expired') ||
                        serverMessage.toLowerCase().includes('error');
        showMessageBox(serverMessage, isError ? 'error' : 'success');
        history.replaceState({}, document.title, window.location.pathname);
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = e.target.username.value;
            const password = e.target.password.value;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();

                if (response.ok) {
                    showMessageBox(data.message, 'success');
                    window.location.href = data.redirectUrl;
                } else {
                    showMessageBox(data.message || 'Login failed.', 'error');
                }
            } catch (error) {
                console.error('Login error:', error);
                showMessageBox('An error occurred during login.', 'error');
            }
        });
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = e.target.username.value;
            const password = e.target.password.value;
            const email = e.target.email.value;
            const fullName = e.target.fullName.value;

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, email, fullName })
                });
                const data = await response.json();

                if (response.ok) {
                    showMessageBox(data.message, 'success');
                    e.target.reset();
                    window.location.href = data.redirectUrl;
                } else {
                    showMessageBox(data.message || 'Registration failed.', 'error');
                }
            } catch (error) {
                console.error('Registration error:', error);
                showMessageBox('An error occurred during registration.', 'error');
            }
        });
    }

    const addExpenseForm = document.getElementById('add-expense-form');
    if (addExpenseForm) {
        addExpenseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newExpense = {
                expenseName: e.target.expenseName.value,
                amount: parseFloat(e.target.amount.value),
                date: e.target.date.value,
                description: e.target.description.value
            };

            try {
                const response = await fetch('/api/expenses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newExpense)
                });
                const data = await response.json();

                if (response.ok) {
                    showMessageBox(data.message, 'success');
                    e.target.reset();
                    window.location.href = data.redirectUrl;
                } else {
                    showMessageBox(data.message || 'Failed to add expense.', 'error');
                }
            } catch (error) {
                console.error('Add expense error:', error);
                showMessageBox('An error occurred while adding expense.', 'error');
            }
        });
    }

    const updateExpenseForm = document.getElementById('update-expense-form');
    if (updateExpenseForm) {
        updateExpenseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const expenseId = e.target.dataset.expenseId;
            const updatedExpense = {
                expenseName: e.target.expenseName.value,
                amount: parseFloat(e.target.amount.value),
                date: e.target.date.value,
                description: e.target.description.value
            };

            try {
                const response = await fetch(`/api/expenses/${expenseId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedExpense)
                });
                const data = await response.json();

                if (response.ok) {
                    showMessageBox(data.message, 'success');
                    window.location.href = data.redirectUrl;
                } else {
                    showMessageBox(data.message || 'Failed to update expense.', 'error');
                }
            } catch (error) {
                console.error('Update expense error:', error);
                showMessageBox('An error occurred while updating expense.', 'error');
            }
        });
    }

    const expensesContainer = document.getElementById('expenses-container');
    if (expensesContainer) {
        expensesContainer.addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-btn')) {
                const expenseId = e.target.dataset.id;
                if (!confirm('Are you sure you want to delete this expense?')) {
                    return;
                }
                try {
                    const response = await fetch(`/api/expenses/${expenseId}`, {
                        method: 'DELETE'
                    });
                    const data = await response.json();

                    if (response.ok) {
                        showMessageBox(data.message, 'success');
                        e.target.closest('.expense-item').remove();
                        if (expensesContainer.children.length === 1 && expensesContainer.children[0].id === 'no-expenses-message') {
                        } else if (expensesContainer.children.length === 0) {
                            const noExpensesMessage = document.createElement('p');
                            noExpensesMessage.id = 'no-expenses-message';
                            noExpensesMessage.className = 'text-center text-gray-500';
                            noExpensesMessage.textContent = 'No expenses added yet.';
                            expensesContainer.appendChild(noExpensesMessage);
                        }
                    } else {
                        showMessageBox(data.message || 'Failed to delete expense.', 'error');
                    }
                } catch (error) {
                    console.error('Delete expense error:', error);
                    showMessageBox('An error occurred while deleting expense.', 'error');
                }
            }
        });
    }
});

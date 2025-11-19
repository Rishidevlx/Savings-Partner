// public/js/goal-details.js

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api/goals';
    
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/index.html';
        return;
    }
    const CURRENT_USER_ID = user.id;

    const goalNameEl = document.getElementById('goal-details-name');
    const summaryContainer = document.getElementById('goal-summary-container');
    const transactionsList = document.getElementById('goal-transactions-list');

    const getGoalId = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    };

    const renderSummary = (goal) => {
        goalNameEl.textContent = goal.name;
        const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
        
        summaryContainer.innerHTML = `
            <div class="progress-info">
                <span>Progress</span>
                <span>${Math.round(progress)}%</span>
            </div>
            <div class="progress-bar-container"><div class="progress-bar" style="width: ${progress}%"></div></div>
            <div class="amount-info">
                <span class="current-amount">₹${parseFloat(goal.current_amount).toLocaleString('en-IN')}</span>
                <span class="target-amount">of ₹${parseFloat(goal.target_amount).toLocaleString('en-IN')}</span>
            </div>
        `;
    };

    const renderTransactions = (transactions) => {
        transactionsList.innerHTML = '';
        if (transactions.length === 0) {
            transactionsList.innerHTML = '<p>No contributions made to this goal yet.</p>';
            return;
        }
        transactions.forEach(t => {
            const item = document.createElement('div');
            item.className = 'transaction-item';
            const formattedDate = new Date(t.transaction_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            item.innerHTML = `
                <div class="transaction-icon"><i class="fas fa-coins"></i></div>
                <div class="transaction-details">
                    <span class="description">${t.description || 'Contribution'}</span>
                    <span class="date">${formattedDate}</span>
                </div>
                <div class="transaction-amount">+ ₹${parseFloat(t.amount).toLocaleString('en-IN')}</div>
            `;
            transactionsList.appendChild(item);
        });
    };

    const fetchData = async () => {
        const goalId = getGoalId();
        if (!goalId) {
            goalNameEl.textContent = "Goal not found";
            return;
        }

        try {
            const [goal, transactions] = await Promise.all([
                fetch(`${API_URL}/${goalId}?userId=${CURRENT_USER_ID}`).then(res => res.json()),
                fetch(`${API_URL}/${goalId}/transactions?userId=${CURRENT_USER_ID}`).then(res => res.json())
            ]);

            renderSummary(goal);
            renderTransactions(transactions);

        } catch (error) {
            console.error("Failed to fetch goal details:", error);
            goalNameEl.textContent = "Error loading goal";
        }
    };

    fetchData();
});
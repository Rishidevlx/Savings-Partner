// public/js/connected-goal-details.js

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:3000/api/connected-goals';
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/index.html';
        return;
    }
    const CURRENT_USER_ID = user.id;

    const goalNameEl = document.getElementById('goal-name');
    const summaryContainer = document.getElementById('goal-summary-container');
    const breakdownContainer = document.getElementById('contributions-breakdown-container');
    const transactionsList = document.getElementById('goal-transactions-list');
    const searchInput = document.getElementById('transaction-search');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    const getGoalId = () => new URLSearchParams(window.location.search).get('id');

    const renderSummary = (goal) => {
        goalNameEl.textContent = goal.name;
        const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
        summaryContainer.innerHTML = `
            <div class="progress-info">
                <span>Progress</span>
                <span>${Math.round(progress)}%</span>
            </div>
            <div class="progress-bar-container"><div class="progress-bar" style="width: ${progress > 100 ? 100 : progress}%"></div></div>
            <div class="amount-info">
                <span class="current-amount">₹${parseFloat(goal.current_amount).toLocaleString('en-IN')}</span>
                <span class="target-amount">of ₹${parseFloat(goal.target_amount).toLocaleString('en-IN')}</span>
            </div>
        `;
    };

    const renderContributions = (contributions) => {
        breakdownContainer.innerHTML = '';
        if (contributions.length === 0) return;
        
        contributions.forEach(c => {
            const card = document.createElement('div');
            card.className = 'breakdown-card';
            card.innerHTML = `
                <div class="contributor-name">${c.fullname.split(' ')[0]}</div>
                <div class="contributor-amount">₹${parseFloat(c.total_contribution).toLocaleString('en-IN')}</div>
            `;
            breakdownContainer.appendChild(card);
        });
    };

    const renderTransactions = (transactions) => {
        transactionsList.innerHTML = '';
        if (transactions.length === 0) {
            transactionsList.innerHTML = '<p style="text-align:center; padding: 20px; color: #777;">No contributions found for the selected filters.</p>';
            return;
        }
        transactions.forEach(t => {
            const item = document.createElement('div');
            const type = t.amount >= 0 ? 'income' : 'expense';
            const sign = type === 'income' ? '+' : '-';
            item.className = 'transaction-item';
            const formattedDate = new Date(t.transaction_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            item.innerHTML = `
                <div class="transaction-icon ${type}"><i class="fas fa-coins"></i></div>
                <div class="transaction-details">
                    <span class="contributor">${t.fullname}</span>
                    <span class="description">${t.description || (type === 'income' ? 'Contribution' : 'Withdrawal')}</span>
                </div>
                <div class="transaction-amount">
                    <div class="amount ${type}">${sign} ₹${parseFloat(Math.abs(t.amount)).toLocaleString('en-IN')}</div>
                    <div class="date">${formattedDate}</div>
                </div>`;
            transactionsList.appendChild(item);
        });
    };

    const fetchGoalDetails = async () => {
        const goalId = getGoalId();
        if (!goalId) { goalNameEl.textContent = "Goal not found"; return; }
        try {
            const goal = await fetch(`${API_URL}/${goalId}?userId=${CURRENT_USER_ID}`).then(res => res.json());
            renderSummary(goal);
        } catch (error) {
            goalNameEl.textContent = "Error loading goal";
        }
    };

    const fetchContributions = async () => {
        const goalId = getGoalId();
        if (!goalId) return;
        try {
            const contributions = await fetch(`${API_URL}/${goalId}/contributions`).then(res => res.json());
            renderContributions(contributions);
        } catch (error) {
            console.error("Error fetching contributions:", error);
        }
    };
    
    const fetchTransactions = async () => {
        const goalId = getGoalId();
        if (!goalId) return;

        const search = searchInput.value;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        let url = `${API_URL}/${goalId}/transactions?userId=${CURRENT_USER_ID}`;
        if (search) url += `&search=${search}`;
        if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;

        try {
            const transactions = await fetch(url).then(res => res.json());
            renderTransactions(transactions);
        } catch (error) {
            transactionsList.innerHTML = '<p>Error loading transactions.</p>';
        }
    };
    
    let debounceTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(fetchTransactions, 300);
    });
    
    [startDateInput, endDateInput].forEach(el => el.addEventListener('change', fetchTransactions));
    clearFiltersBtn.addEventListener('click', () => {
        startDateInput.value = '';
        endDateInput.value = '';
        searchInput.value = '';
        fetchTransactions();
    });

    fetchGoalDetails();
    fetchTransactions();
    fetchContributions();
});
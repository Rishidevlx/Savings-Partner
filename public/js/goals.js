document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api/goals';

    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/index.html';
        return;
    }
    const CURRENT_USER_ID = user.id;

    // --- DOM Elements ---
    const elements = {
        statsContainer: document.getElementById('goal-stats-cards'),
        gridContainer: document.getElementById('goals-grid-container'),
        searchInput: document.getElementById('goal-search-input'),
        filterSelect: document.getElementById('goal-filter-select'),
        goalModal: document.getElementById('goal-modal-overlay'),
        addFundModal: document.getElementById('add-fund-modal-overlay'),
        extendDateModal: document.getElementById('extend-date-modal-overlay'),
        deleteModal: document.getElementById('confirm-delete-modal-overlay'),
        goalForm: document.getElementById('goal-form'),
        addFundForm: document.getElementById('add-fund-form'),
        extendDateForm: document.getElementById('extend-date-form')
    };

    let allGoals = [];
    let currentGoalId = null;

    // --- Helper Functions ---
    const showToast = (message, type = 'success') => {
        Toastify({ text: message, duration: 3000, gravity: "top", position: "right", stopOnFocus: true, style: { background: type === 'success' ? "linear-gradient(to right, #00A79D, #00b09b)" : "linear-gradient(to right, #e74c3c, #ff5f6d)" } }).showToast();
    };

    const fetchApi = async (url, options = {}) => {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'An API error occurred');
            }
            if (response.status === 204 || (response.status === 200 && response.headers.get('content-length') === '0')) {
                 return;
            }
            return response.json();
        } catch (error) {
            showToast(error.message, 'error');
            throw error;
        }
    };
    
    // --- Render Functions ---
    const renderStats = (stats) => {
        elements.statsContainer.innerHTML = `
            <div class="stat-card"><div class="card-icon" style="background-color: #34495e;"><i class="fas fa-layer-group"></i></div><div class="card-info"><span class="card-title">Total Goals</span><span class="card-value">${stats.total}</span></div></div>
            <div class="stat-card active"><div class="card-icon"><i class="fas fa-hourglass-half"></i></div><div class="card-info"><span class="card-title">Active Goals</span><span class="card-value">${stats.active}</span></div></div>
            <div class="stat-card completed"><div class="card-icon"><i class="fas fa-check"></i></div><div class="card-info"><span class="card-title">Completed</span><span class="card-value">${stats.completed}</span></div></div>
            <div class="stat-card failed"><div class="card-icon"><i class="fas fa-times"></i></div><div class="card-info"><span class="card-title">Failed</span><span class="card-value">${stats.failed}</span></div></div>
        `;
    };

    const renderGoals = (goals) => {
        elements.gridContainer.innerHTML = '';
        if (goals.length === 0) {
            elements.gridContainer.innerHTML = `<div class="empty-state"><i class="fas fa-bullseye"></i><p>No goals found. Create one to get started!</p></div>`;
            return;
        }

        goals.forEach(goal => {
            const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const targetDate = new Date(goal.target_date);
            const diffTime = targetDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let daysLeftText = '';
            if (goal.status === 'completed') {
                daysLeftText = 'Completed!';
            } else if (diffDays < 0) {
                daysLeftText = 'Date Passed';
                goal.status = 'failed'; 
            } else if (diffDays === 0) {
                daysLeftText = 'Today is the day!';
            } else {
                daysLeftText = `${diffDays} days left`;
            }

            const goalCard = document.createElement('div');
            goalCard.className = `goal-card ${goal.status}`;
            goalCard.dataset.id = goal.id;

            goalCard.innerHTML = `
                <div class="goal-card-header">
                    <div>
                        <h3 class="goal-title">${goal.name}</h3>
                        <span class="goal-days-left">${daysLeftText}</span>
                    </div>
                    <div class="goal-icon"><i class="fas fa-bullseye"></i></div>
                </div>
                <div>
                    <div class="progress-info">
                        <span>Progress</span>
                        <span>${Math.round(progress)}%</span>
                    </div>
                    <div class="progress-bar-container"><div class="progress-bar" style="width: ${progress > 100 ? 100 : progress}%"></div></div>
                    <div class="amount-info">
                        <span class="current-amount">₹${parseFloat(goal.current_amount).toLocaleString('en-IN')}</span>
                        <span class="target-amount">₹${parseFloat(goal.target_amount).toLocaleString('en-IN')}</span>
                    </div>
                </div>
                <div class="goal-card-footer">
                    <div class="goal-actions">
                        <button class="action-btn edit-goal-btn" title="Edit"><i class="fas fa-pencil-alt"></i></button>
                        <button class="action-btn star-goal-btn ${goal.is_important ? 'important' : ''}" title="Important"><i class="fas fa-star"></i></button>
                        <button class="action-btn delete-goal-btn" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                    <div class="goal-main-actions">
                        ${goal.status === 'failed'
                            ? `<button class="btn btn-primary extend-date-btn">Extend Date</button>`
                            : goal.status !== 'completed'
                            ? `<button class="btn btn-primary add-fund-btn">Add Funds</button>`
                            : ''
                        }
                        <button class="btn btn-view-goal">View Goal</button>
                    </div>
                </div>
            `;
            elements.gridContainer.appendChild(goalCard);
        });
    };

    const fetchData = async () => {
        try {
            const [goals, stats] = await Promise.all([
                fetchApi(`${API_URL}?userId=${CURRENT_USER_ID}`),
                fetchApi(`${API_URL}/stats?userId=${CURRENT_USER_ID}`)
            ]);
            allGoals = goals;
            renderStats(stats);
            applyFilters();
        } catch (error) {
            console.error("Failed to fetch initial data:", error);
        }
    };

    const applyFilters = () => {
        const searchTerm = elements.searchInput.value.toLowerCase();
        const filterStatus = elements.filterSelect.value;
        const filteredGoals = allGoals.filter(goal => {
            const matchesSearch = goal.name.toLowerCase().includes(searchTerm);
            const matchesStatus = (filterStatus === 'all') || (goal.status === filterStatus);
            return matchesSearch && matchesStatus;
        });
        renderGoals(filteredGoals);
    };

    document.getElementById('add-goal-btn').addEventListener('click', () => {
        elements.goalForm.reset();
        elements.goalForm.removeAttribute('data-editing-id');
        document.getElementById('goal-modal-title').textContent = 'Create a New Goal';
        elements.goalModal.classList.add('active');
    });

    elements.goalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editingId = e.target.dataset.editingId;
        const data = {
            userId: CURRENT_USER_ID,
            name: document.getElementById('goal-name').value,
            target_amount: document.getElementById('goal-target-amount').value,
            target_date: document.getElementById('goal-target-date').value
        };

        try {
            if (editingId) {
                await fetchApi(`${API_URL}/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                showToast('Goal updated successfully!');
            } else {
                await fetchApi(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                showToast('Goal created successfully!');
            }
            elements.goalModal.classList.remove('active');
            fetchData();
        } catch (error) { console.error('Failed to save goal:', error); }
    });
    
    elements.gridContainer.addEventListener('click', (e) => {
        const target = e.target;
        const goalCard = target.closest('.goal-card');
        if (!goalCard) return;

        currentGoalId = goalCard.dataset.id;
        const goal = allGoals.find(g => g.id == currentGoalId);

        if (!goal) return;

        if (target.closest('.btn-view-goal')) {
            window.location.href = `goal-details.html?id=${currentGoalId}`;
        }
        else if (target.closest('.add-fund-btn')) {
            document.getElementById('add-fund-goal-name').textContent = `For: ${goal.name}`;
            elements.addFundForm.reset();
            document.getElementById('fund-date').valueAsDate = new Date();
            elements.addFundModal.classList.add('active');
        }
        else if (target.closest('.extend-date-btn')) {
             document.getElementById('extend-date-goal-name').textContent = `For: ${goal.name}`;
             elements.extendDateForm.reset();
             elements.extendDateModal.classList.add('active');
        }
        else if (target.closest('.edit-goal-btn')) {
             elements.goalForm.dataset.editingId = currentGoalId;
             document.getElementById('goal-modal-title').textContent = 'Edit Goal';
             document.getElementById('goal-name').value = goal.name;
             document.getElementById('goal-target-amount').value = goal.target_amount;
             document.getElementById('goal-target-date').value = new Date(goal.target_date).toISOString().split('T')[0];
             elements.goalModal.classList.add('active');
        }
        else if (target.closest('.delete-goal-btn')) {
             elements.deleteModal.classList.add('active');
        }
        else if (target.closest('.star-goal-btn')) {
            fetchApi(`${API_URL}/${currentGoalId}/toggle-important`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID }) })
            .then(fetchData);
        }
    });

    elements.addFundForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            userId: CURRENT_USER_ID,
            amount: document.getElementById('fund-amount').value,
            transaction_date: document.getElementById('fund-date').value,
            description: document.getElementById('fund-description').value,
        };
        try {
            await fetchApi(`${API_URL}/${currentGoalId}/add-fund`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            showToast('Fund added successfully!');
            elements.addFundModal.classList.remove('active');
            fetchData();
        } catch (error) { console.error('Failed to add fund:', error); }
    });

    elements.extendDateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            userId: CURRENT_USER_ID,
            new_target_date: document.getElementById('new-target-date').value,
        };
        try {
            await fetchApi(`${API_URL}/${currentGoalId}/extend-date`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            showToast('Date extended successfully!');
            elements.extendDateModal.classList.remove('active');
            fetchData();
        } catch(error) { console.error('Failed to extend date', error); }
    });

    document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
        try {
            await fetchApi(`${API_URL}/${currentGoalId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID }) });
            showToast('Goal deleted successfully!', 'error');
            elements.deleteModal.classList.remove('active');
            fetchData();
        } catch (error) { console.error('Failed to delete goal:', error); }
    });

    ['goal-modal', 'add-fund-modal', 'extend-date-modal', 'confirm-delete-modal'].forEach(id => {
        const overlay = document.getElementById(`${id}-overlay`);
        const closeBtn = document.getElementById(`close-${id}`) || document.getElementById('confirm-cancel-btn');
        if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('active'); });
        if(closeBtn) closeBtn.addEventListener('click', () => overlay.classList.remove('active'));
    });
    
    elements.searchInput.addEventListener('input', applyFilters);
    elements.filterSelect.addEventListener('change', applyFilters);

    fetchData();
});
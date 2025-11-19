document.addEventListener('DOMContentLoaded', () => {

    const API_URL = '/api';
    
    const user = JSON.parse(localStorage.getItem('user'));
    const CURRENT_USER_ID = user ? user.id : null;

    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                !sidebar.contains(e.target) && 
                e.target !== sidebarToggle && 
                !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        });
    }

    const showToast = (message, type = 'success') => {
        Toastify({ text: message, duration: 3000, gravity: "top", position: "right", stopOnFocus: true, style: { background: type === 'success' ? "linear-gradient(to right, #00A79D, #00b09b)" : "linear-gradient(to right, #e74c3c, #ff5f6d)" } }).showToast();
    };

    function setupModal(openBtnId, closeBtnId, overlayId) {
        const openBtn = document.getElementById(openBtnId);
        const closeBtn = document.getElementById(closeBtnId);
        const overlay = document.getElementById(overlayId);
        if (openBtn) openBtn.addEventListener('click', () => overlay.classList.add('active'));
        if (closeBtn) closeBtn.addEventListener('click', () => overlay.classList.remove('active'));
        if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
    }
    
    const fetchApi = async (url, options = {}) => {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                let errorMsg = `Error: ${response.status} ${response.statusText}`;
                try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch (jsonError) {}
                throw new Error(errorMsg);
            }
            if (response.status === 204 || (response.status === 200 && response.headers.get('content-length') === '0')) {
                 return;
            }
            return response.json();
        } catch (error) { showToast(error.message, 'error'); throw error; }
    };

    if (document.querySelector('.welcome-message')) {
        if (!user) { window.location.href = '/index.html'; return; }
        initDashboardPage();
    } else if (document.getElementById('transactions-container')) {
        if (!user) { window.location.href = '/index.html'; return; }
        initTransactionsPage();
    } else if (document.querySelector('.calculator-grid')) {
        if (!user) { window.location.href = '/index.html'; return; }
        initCalculatorPage();
    }

    function initDashboardPage() {
        const formatCurrency = (amount) => `₹${parseFloat(amount).toLocaleString('en-IN')}`;

        const fetchDashboardStats = async () => {
            try {
                const stats = await fetchApi(`${API_URL}/dashboard/stats?userId=${CURRENT_USER_ID}`);
                document.getElementById('total-balance').textContent = formatCurrency(stats.totalBalance);
                document.getElementById('monthly-income').textContent = formatCurrency(stats.monthlyIncome);
                document.getElementById('monthly-expense').textContent = formatCurrency(stats.monthlyExpense);
                document.getElementById('active-goals').textContent = stats.activeGoals;
            } catch (error) { console.error("Failed to fetch dashboard stats", error); }
        };

        const fetchDashboardConnectionRequests = async () => {
            const listContainer = document.getElementById('connection-requests-list');
            try {
                const requests = await fetchApi(`${API_URL}/connections/requests?userId=${CURRENT_USER_ID}`);
                listContainer.innerHTML = ''; 
                if (requests.length === 0) {
                    listContainer.innerHTML = '<p class="empty-message">No new connection requests.</p>';
                    return;
                }
                requests.forEach(req => {
                    const item = document.createElement('div');
                    item.className = 'request-item';
                    item.dataset.requestId = req.id;
                    item.innerHTML = `
                        <div class="request-info">
                            <span>${req.fullname}</span>
                            <small>${req.cid}</small>
                        </div>
                        <div class="request-actions">
                            <button class="btn-accept">Accept</button>
                            <button class="btn-reject">Reject</button>
                        </div>
                    `;
                    listContainer.appendChild(item);
                });
            } catch (error) {
                listContainer.innerHTML = '<p class="empty-message">Could not load requests.</p>';
            }
        };
        
        const welcomeHeader = document.querySelector('.welcome-message h1');
        if (welcomeHeader && user.fullname) {
            welcomeHeader.innerHTML = `Welcome Back, ${user.fullname.split(' ')[0]}! 👋`;
        }
        
        setupModal('show-cid-modal', 'close-cid-modal', 'cid-modal-overlay');
        setupModal('show-connect-modal', 'close-connect-modal', 'connect-modal-overlay');

        const cidText = document.getElementById('cid-text');
        if (cidText && user.cid) {
             cidText.textContent = user.cid;
        }

        document.getElementById('copy-cid-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(cidText.innerText)
                .then(() => showToast('CID copied successfully!'))
                .catch(err => showToast('Failed to copy CID.', 'error'));
        });

        document.getElementById('add-connection-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const cidInput = document.getElementById('cid-input');
            const foundUserContainer = document.getElementById('found-user-container');
            if (!cidInput.value) return;

            try {
                const foundUser = await fetchApi(`${API_URL}/connections/find-user`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cid: cidInput.value, requesterId: CURRENT_USER_ID }) });
                foundUserContainer.classList.remove('hidden');
                foundUserContainer.innerHTML = `<div class="request-item" style="padding: 10px 0;"><div class="request-info"><span>${foundUser.fullname}</span><small>${foundUser.cid}</small></div><button class="btn-accept" id="send-request-btn">Send Request</button></div>`;
                
                document.getElementById('send-request-btn').addEventListener('click', async () => {
                    await fetchApi(`${API_URL}/connections/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requesterId: CURRENT_USER_ID, recipientId: foundUser.id }) });
                    showToast(`Request sent to ${foundUser.fullname}!`);
                    document.getElementById('connect-modal-overlay').classList.remove('active');
                    foundUserContainer.classList.add('hidden');
                    cidInput.value = '';
                });

            } catch(error) {
                foundUserContainer.classList.remove('hidden');
                foundUserContainer.innerHTML = `<p style="color: var(--danger-color);">${error.message}</p>`;
            }
        });

        document.getElementById('connection-requests-list').addEventListener('click', async (e) => {
            const target = e.target;
            const requestItem = target.closest('.request-item');
            if (!requestItem) return;
            
            const requestId = requestItem.dataset.requestId;
            const action = target.classList.contains('btn-accept') ? 'accept' : target.classList.contains('btn-reject') ? 'decline' : null;

            if (action) {
                try {
                    await fetchApi(`${API_URL}/connections/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID, requestId }) });
                    showToast(`Request ${action}ed!`);
                    fetchDashboardConnectionRequests(); 
                } catch(err) {}
            }
        });
        
        document.getElementById('quick-action-cards').addEventListener('click', (e) => {
            const card = e.target.closest('.action-card');
            if (card && card.dataset.href) {
                window.location.href = card.dataset.href;
            }
        });

        fetchDashboardStats();
        fetchDashboardConnectionRequests();
    }

    function initTransactionsPage() {
        const { jsPDF } = window.jspdf;
        const listContainer = document.getElementById('transactions-list-container');
        const addTransactionForm = document.getElementById('transaction-form');
        const bulkSelectBtn = document.getElementById('bulk-select-btn');
        const deleteSelectedBtn = document.getElementById('delete-selected-btn');
        const downloadBtn = document.getElementById('download-btn');
        const transactionsContainer = document.getElementById('transactions-container');
        const totalIncomeEl = document.getElementById('total-income');
        const totalExpenseEl = document.getElementById('total-expense');
        const netBalanceEl = document.getElementById('net-balance');
        const searchInput = document.getElementById('transaction-search-input'); 

        let currentFilters = { type: 'all', days: '30', search: '' }; 
        let allTransactions = [];
        let searchTimeout;

        const confirmModal = document.getElementById('confirm-modal-overlay');
        const confirmTitle = document.getElementById('confirm-modal-title');
        const confirmText = document.getElementById('confirm-modal-text');
        const confirmActionBtn = document.getElementById('confirm-action-btn');
        const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

        const showConfirmationModal = (title, text, onConfirm) => {
            confirmTitle.textContent = title;
            confirmText.textContent = text;
            confirmModal.classList.add('active');
            const newConfirmActionBtn = confirmActionBtn.cloneNode(true);
            confirmActionBtn.parentNode.replaceChild(newConfirmActionBtn, confirmActionBtn);
            newConfirmActionBtn.addEventListener('click', () => {
                onConfirm();
                confirmModal.classList.remove('active');
            });
        };
        confirmCancelBtn.addEventListener('click', () => confirmModal.classList.remove('active'));
        confirmModal.addEventListener('click', (e) => { if(e.target === confirmModal) confirmModal.classList.remove('active'); });

        const fetchAndRenderTransactions = async () => {
            let url = `${API_URL}/transactions?userId=${CURRENT_USER_ID}&type=${currentFilters.type}&days=${currentFilters.days}`;
            if (currentFilters.search) { 
                url += `&search=${encodeURIComponent(currentFilters.search)}`;
            }
            try {
                const transactions = await fetchApi(url);
                allTransactions = transactions;
                renderTransactionList(transactions);
                updateStatsCards(transactions);
            } catch (error) { }
        };

        const getCategoryIcon = (category) => {
            const lowerCaseCategory = category.toLowerCase();
            const iconMap = { 'salary': 'briefcase', 'food': 'utensils', 'transport': 'car', 'shopping': 'shopping-bag', 'bills': 'file-invoice-dollar', 'health': 'heartbeat', 'entertainment': 'film', 'education': 'graduation-cap', 'investment': 'chart-line', 'friend': 'user-friends', 'family': 'home' };
            for (const key in iconMap) { if (lowerCaseCategory.includes(key)) return iconMap[key]; }
            return 'receipt';
        };
        
        const renderTransactionList = (transactions) => {
            listContainer.innerHTML = '';
            if (transactions.length === 0) {
                listContainer.innerHTML = '<p style="text-align: center; color: #777; padding: 20px 0;">No transactions found for the selected filters.</p>';
                return;
            }
            transactions.forEach(t => {
                const item = document.createElement('div');
                item.className = `transaction-item ${t.type}`;
                item.dataset.id = t.id;
                const formattedDate = new Date(t.transaction_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                const descriptionHTML = t.description ? `<div class="description-info">${t.description.replace(/\n/g, '<br>')}</div>` : '';
                item.innerHTML = `
                    <div class="main-info">
                        <input type="checkbox" class="transaction-checkbox" data-id="${t.id}">
                        <div class="transaction-icon"><i class="fas fa-${getCategoryIcon(t.category)}"></i></div>
                        <div class="transaction-details">
                            <span class="category">${t.category}</span>
                            <span class="date">${formattedDate}</span>
                        </div>
                        <div class="transaction-amount">
                            ${t.type === 'income' ? '+' : '-'} ₹${parseFloat(t.amount).toLocaleString('en-IN')}
                        </div>
                    </div>
                    ${descriptionHTML}
                `;
                listContainer.appendChild(item);
            });
        };

        const updateStatsCards = (transactions) => {
            const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
            const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
            totalIncomeEl.textContent = `₹${totalIncome.toLocaleString('en-IN')}`;
            totalExpenseEl.textContent = `₹${totalExpense.toLocaleString('en-IN')}`;
            netBalanceEl.textContent = `₹${(totalIncome - totalExpense).toLocaleString('en-IN')}`;
        };

        addTransactionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = { ...Object.fromEntries(new FormData(addTransactionForm).entries()), userId: CURRENT_USER_ID };
            const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
            try {
                await fetchApi(`${API_URL}/transactions`, options);
                showToast('Transaction added!');
                addTransactionForm.reset();
                document.getElementById('transaction-modal-overlay').classList.remove('active');
                fetchAndRenderTransactions();
            } catch (error) { }
        });

        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentFilters.search = searchInput.value;
                fetchAndRenderTransactions();
            }, 300);
        });

        document.querySelector('.filter-tabs').addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                document.querySelectorAll('.filter-tabs .filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                currentFilters.type = e.target.dataset.filter;
                fetchAndRenderTransactions();
            }
        });
        document.querySelector('.date-filter-select').addEventListener('change', (e) => {
            currentFilters.days = e.target.value;
            fetchAndRenderTransactions();
        });

        bulkSelectBtn.addEventListener('click', () => {
            transactionsContainer.classList.toggle('select-mode');
            const isSelectMode = transactionsContainer.classList.contains('select-mode');
            deleteSelectedBtn.classList.toggle('hidden', !isSelectMode);
            if (!isSelectMode) {
                document.querySelectorAll('.transaction-checkbox').forEach(cb => cb.checked = false);
            }
        });

        deleteSelectedBtn.addEventListener('click', () => {
            const idsToDelete = Array.from(document.querySelectorAll('.transaction-checkbox:checked')).map(cb => cb.dataset.id);
            if (idsToDelete.length === 0) return showToast('Please select transactions.', 'error');
            
            showConfirmationModal('Delete Transaction(s)?', `Are you sure you want to delete ${idsToDelete.length} transaction(s)?`, async () => {
                const options = { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID, ids: idsToDelete }) };
                try {
                    const result = await fetchApi(`${API_URL}/transactions`, options);
                    showToast(result.message);
                    fetchAndRenderTransactions();
                } catch (error) { }
            });
        });

        downloadBtn.addEventListener('click', () => {
            if (allTransactions.length === 0) { showToast('No transactions to download.', 'error'); return; }
            const doc = new jsPDF();
            doc.setFontSize(18); doc.text("Transaction Report", 14, 22); doc.setFontSize(11); doc.setTextColor(100);
            const tableColumn = ["Date", "Category", "Description", "Type", "Amount (INR)"];
            const tableRows = [];
            allTransactions.forEach(item => {
                tableRows.push([ new Date(item.transaction_date).toLocaleDateString("en-GB"), item.category, item.description || "-", item.type.charAt(0).toUpperCase() + item.type.slice(1), item.amount ]);
            });
            doc.autoTable(tableColumn, tableRows, { startY: 30 });
            doc.save(`transactions_report_${new Date().toISOString().split('T')[0]}.pdf`);
            showToast("Report downloaded successfully!");
        });
        
        setupModal('add-transaction-btn', 'close-transaction-modal', 'transaction-modal-overlay');
        document.getElementById('date').valueAsDate = new Date();
        fetchAndRenderTransactions();
    }

    function initCalculatorPage() {
        const display = document.getElementById('current-value');
        const historyDisplay = document.getElementById('history-expression');
        const keys = document.querySelector('.calculator-keys');
        const historyList = document.getElementById('calculation-history-list');
        let state = { currentValue: '0', previousValue: null, operator: null, waitingForOperand: false };

        const updateDisplay = () => {
            display.textContent = state.currentValue;
            if(state.operator && state.previousValue) {
                historyDisplay.textContent = `${state.previousValue} ${state.operator}`;
            } else { historyDisplay.textContent = ''; }
        };

        const handleInput = (key) => {
            if (!isNaN(key)) {
                if (state.waitingForOperand || state.currentValue === '0') {
                    state.currentValue = key;
                    state.waitingForOperand = false;
                } else { state.currentValue += key; }
            } else if (key === '.') {
                if (!state.currentValue.includes('.')) { state.currentValue += '.'; }
            } else if (key in {'+':1, '-':1, '*':1, '/':1, '%':1}) {
                if(state.operator && !state.waitingForOperand) handleCalculate();
                state.previousValue = state.currentValue;
                state.operator = key;
                state.waitingForOperand = true;
            }
        };

        const handleCalculate = () => {
            if (!state.operator || state.previousValue === null) return;
            const prev = parseFloat(state.previousValue);
            const curr = parseFloat(state.currentValue);
            let result;
            switch(state.operator) {
                case '+': result = prev + curr; break;
                case '-': result = prev - curr; break;
                case '*': result = prev * curr; break;
                case '/': result = prev / curr; break;
                case '%': result = prev % curr; break;
                default: return;
            }
            const expression = `${state.previousValue} ${state.operator} ${state.currentValue}`;
            addToHistory(expression, result);
            state.currentValue = String(Number.isFinite(result) ? parseFloat(result.toPrecision(12)) : 'Error');
            state.operator = null;
            state.previousValue = null;
            state.waitingForOperand = true;
        };
        
        const handleClear = () => { state = { currentValue: '0', previousValue: null, operator: null, waitingForOperand: false }; };

        const handleBackspace = () => {
            if (state.currentValue === 'Error' || state.waitingForOperand) return;
            state.currentValue = state.currentValue.length > 1 ? state.currentValue.slice(0, -1) : '0';
        };

        const addToHistory = (expression, result) => {
            if (!Number.isFinite(result)) return;
            const li = document.createElement('li');
            li.innerHTML = `${expression} = <span>${parseFloat(result.toPrecision(12))}</span>`;
            historyList.prepend(li);
        };

        keys.addEventListener('click', e => {
            if (!e.target.matches('button')) return;
            const action = e.target.dataset.action;
            const keyContent = e.target.textContent;
            if (!action) handleInput(keyContent);
            else if (action === 'operator') handleInput(keyContent);
            else if (action === 'decimal') handleInput('.');
            else if (action === 'clear') handleClear();
            else if (action === 'backspace') handleBackspace();
            else if (action === 'calculate') handleCalculate();
            updateDisplay();
        });

        const listContainer = document.getElementById('recent-transactions-list');
        const filterTabs = document.getElementById('recent-transactions-filter');
        const getCategoryIconCal = (category) => ({ 'Salary': 'briefcase', 'Food': 'utensils', 'Transport': 'car', 'Shopping': 'shopping-bag', 'Bills': 'file-invoice-dollar', 'Other': 'receipt' }[category] || 'receipt');

        const renderRecentTransactions = (transactions) => {
            listContainer.innerHTML = '';
            if (transactions.length === 0) {
                listContainer.innerHTML = '<p style="text-align: center; color: #777;">No transactions in the last 30 days.</p>';
                return;
            }
            transactions.forEach(t => {
                const item = document.createElement('div');
                item.className = `transaction-item ${t.type}`;
                item.innerHTML = `<div class="transaction-icon"><i class="fas fa-${getCategoryIconCal(t.category)}"></i></div><div class="transaction-details"><span class="category">${t.category}</span><span class="description">${new Date(t.transaction_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></div><div class="transaction-amount">${t.type === 'income' ? '+' : '-'} ₹${parseFloat(t.amount).toLocaleString('en-IN')}</div>`;
                listContainer.appendChild(item);
            });
        };

        const fetchAndRenderRecentTransactions = async (filterType = 'all') => {
            let url = `${API_URL}/transactions?userId=${CURRENT_USER_ID}&days=30`;
            if (filterType !== 'all') { url += `&type=${filterType}`; }
            try {
                const transactions = await fetchApi(url);
                renderRecentTransactions(transactions);
            } catch (error) { }
        };

        filterTabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                filterTabs.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                fetchAndRenderRecentTransactions(e.target.dataset.filter);
            }
        });
        
        updateDisplay();
        fetchAndRenderRecentTransactions();
    }
});
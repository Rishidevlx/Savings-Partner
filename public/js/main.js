// --- 1. GLOBAL LOGOUT FUNCTION (MUST BE AT THE TOP) ---
// Idhu window object-la direct-a irukum, so eppo venaalum work aagum.
window.logoutApp = function() {
    console.log("Logging out...");

    // A. Clear All Local Data
    localStorage.removeItem('user');
    localStorage.clear();
    sessionStorage.clear();

    // B. Unregister Service Worker (Fix for PWA Cache issues)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for(let registration of registrations) {
                registration.unregister();
                console.log("Service Worker Unregistered");
            }
        });
    }

    // C. Force Redirect with Timestamp (Cache Busting)
    // '?t=' + time add panradhala browser idha puthu page-a nenaichu fresh-a load pannum
    window.location.replace('/index.html?t=' + new Date().getTime());
};

// --- DOM LOADED EVENT ---
document.addEventListener('DOMContentLoaded', () => {

    // Vercel & Localhost Support
    const API_URL = '/api'; 
    
    const user = JSON.parse(localStorage.getItem('user'));
    const CURRENT_USER_ID = user ? user.id : null;

    // --- 2. PAGE ACCESS CONTROL (SECURITY) ---
    // User illana, Login page-ku thurathidum (Except index.html)
    if (!user && !window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        window.location.replace('/index.html');
        return; // Stop executing further code
    }

    // --- 3. MOBILE SIDEBAR TOGGLE (Universal Fix) ---
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    // Support both ID and Class for Overlay
    const overlay = document.getElementById('overlay-bg') || document.querySelector('.overlay-bg'); 
    const closeBtn = document.querySelector('.close-sidebar-btn');

    if (sidebarToggle && sidebar) {
        // Open Sidebar
        sidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.add('active');
            sidebar.classList.add('open'); // Support both CSS styles
            if(overlay) overlay.classList.add('active');
        });

        // Close Function
        const closeMenu = () => {
            sidebar.classList.remove('active');
            sidebar.classList.remove('open');
            if(overlay) overlay.classList.remove('active');
        };

        // Close Events
        if(overlay) overlay.addEventListener('click', closeMenu);
        if(closeBtn) closeBtn.addEventListener('click', closeMenu);

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                (sidebar.classList.contains('active') || sidebar.classList.contains('open')) && 
                !sidebar.contains(e.target) && 
                e.target !== sidebarToggle) {
                closeMenu();
            }
        });
    }

    // --- 4. HELPER FUNCTIONS ---
    const showToast = (message, type = 'success') => {
        if (typeof Toastify === 'function') {
            Toastify({ 
                text: message, 
                duration: 3000, 
                gravity: "top", 
                position: "right", 
                stopOnFocus: true, 
                style: { background: type === 'success' ? "linear-gradient(to right, #00A79D, #00b09b)" : "linear-gradient(to right, #e74c3c, #ff5f6d)" } 
            }).showToast();
        } else {
            console.log(message); // Fallback if Toastify not loaded
        }
    };

    const fetchApi = async (url, options = {}) => {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                // Handle 401 Unauthorized (Session Expired)
                if (response.status === 401) {
                    window.logoutApp();
                    return;
                }
                throw new Error('API Error');
            }
            if (response.status === 204) return;
            return response.json();
        } catch (error) { 
            showToast(error.message || "Something went wrong", 'error'); 
            throw error; 
        }
    };

    // --- 5. INITIALIZE PAGES ---
    // Check which page is currently active
    if (document.querySelector('.welcome-message')) {
        initDashboardPage();
    } else if (document.getElementById('transactions-container')) {
        initTransactionsPage();
    } else if (document.querySelector('.calculator-grid')) {
        initCalculatorPage();
    }

    // --- DASHBOARD LOGIC ---
    function initDashboardPage() {
        const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toLocaleString('en-IN')}`;

        const fetchDashboardStats = async () => {
            try {
                const stats = await fetchApi(`${API_URL}/dashboard/stats?userId=${CURRENT_USER_ID}`);
                if (stats) {
                    document.getElementById('total-balance').textContent = formatCurrency(stats.totalBalance);
                    document.getElementById('monthly-income').textContent = formatCurrency(stats.monthlyIncome);
                    document.getElementById('monthly-expense').textContent = formatCurrency(stats.monthlyExpense);
                    document.getElementById('active-goals').textContent = stats.activeGoals;
                }
            } catch (error) { console.error("Stats Error", error); }
        };
        
        const welcomeHeader = document.querySelector('.welcome-message h1');
        if (welcomeHeader && user && user.fullname) {
            welcomeHeader.innerHTML = `Welcome Back, ${user.fullname.split(' ')[0]}! 👋`;
        }

        const cidText = document.getElementById('cid-text');
        if (cidText && user && user.cid) cidText.textContent = user.cid;

        // Copy CID
        const copyBtn = document.getElementById('copy-cid-btn');
        if(copyBtn) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(cidText.innerText)
                    .then(() => showToast('CID copied successfully!'));
            });
        }

        // Modals
        const setupModal = (openBtnId, closeBtnId, overlayId) => {
            const openBtn = document.getElementById(openBtnId);
            const closeBtn = document.getElementById(closeBtnId);
            const overlay = document.getElementById(overlayId);
            if (openBtn && overlay) openBtn.addEventListener('click', () => overlay.classList.add('active'));
            if (closeBtn && overlay) closeBtn.addEventListener('click', () => overlay.classList.remove('active'));
            if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
        }

        setupModal('show-cid-modal', 'close-cid-modal', 'cid-modal-overlay');
        setupModal('show-connect-modal', 'close-connect-modal', 'connect-modal-overlay');

        fetchDashboardStats();
    }

    // --- TRANSACTIONS LOGIC ---
    function initTransactionsPage() {
        const { jsPDF } = window.jspdf || {}; // Safe check
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
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        const clearFiltersBtn = document.getElementById('clear-filters-btn');

        let currentFilters = { type: 'all', search: '', startDate: '', endDate: '' }; 
        let allTransactions = [];
        let searchTimeout;
        
        // Setup Modal manually since it's reused
        const transModal = document.getElementById('transaction-modal-overlay');
        if(document.getElementById('add-transaction-btn')) {
            document.getElementById('add-transaction-btn').addEventListener('click', () => transModal.classList.add('active'));
        }
        if(document.getElementById('close-transaction-modal')) {
            document.getElementById('close-transaction-modal').addEventListener('click', () => transModal.classList.remove('active'));
        }

        // Delete Modal
        const confirmModal = document.getElementById('confirm-modal-overlay');
        const confirmTitle = document.querySelector('#confirm-modal-overlay h3');
        const confirmText = document.getElementById('confirm-modal-text');
        const confirmActionBtn = document.getElementById('confirm-action-btn');
        const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

        const showConfirmationModal = (title, text, onConfirm) => {
            if(confirmTitle) confirmTitle.textContent = title;
            if(confirmText) confirmText.textContent = text;
            confirmModal.classList.add('active');
            
            // Remove old listeners to prevent duplicates
            const newBtn = confirmActionBtn.cloneNode(true);
            confirmActionBtn.parentNode.replaceChild(newBtn, confirmActionBtn);
            
            newBtn.addEventListener('click', () => {
                onConfirm();
                confirmModal.classList.remove('active');
            });
        };
        if(confirmCancelBtn) confirmCancelBtn.addEventListener('click', () => confirmModal.classList.remove('active'));

        const fetchAndRenderTransactions = async () => {
            let url = `${API_URL}/transactions?userId=${CURRENT_USER_ID}&type=${currentFilters.type}&days=all`; 
            if (currentFilters.search) url += `&search=${encodeURIComponent(currentFilters.search)}`;
            
            try {
                let transactions = await fetchApi(url);
                
                if (transactions && currentFilters.startDate && currentFilters.endDate) {
                    const start = new Date(currentFilters.startDate);
                    const end = new Date(currentFilters.endDate);
                    end.setHours(23, 59, 59, 999);
                    
                    transactions = transactions.filter(t => {
                        const tDate = new Date(t.transaction_date);
                        return tDate >= start && tDate <= end;
                    });
                }

                allTransactions = transactions || [];
                renderTransactionList(allTransactions);
                updateStatsCards(allTransactions);
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
                listContainer.innerHTML = '<p style="text-align: center; color: #777; padding: 20px 0;">No transactions found.</p>';
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

        if(addTransactionForm) {
            addTransactionForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const data = { ...Object.fromEntries(new FormData(addTransactionForm).entries()), userId: CURRENT_USER_ID };
                const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
                try {
                    await fetchApi(`${API_URL}/transactions`, options);
                    showToast('Transaction added!');
                    addTransactionForm.reset();
                    transModal.classList.remove('active');
                    fetchAndRenderTransactions();
                } catch (error) { }
            });
        }

        if(searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    currentFilters.search = searchInput.value;
                    fetchAndRenderTransactions();
                }, 300);
            });
        }

        // Filters & Buttons logic...
        const filterTabs = document.querySelectorAll('.filter-btn');
        filterTabs.forEach(btn => {
            btn.addEventListener('click', () => {
                filterTabs.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilters.type = btn.dataset.filter;
                fetchAndRenderTransactions();
            });
        });
        
        if(startDateInput) startDateInput.addEventListener('change', () => { currentFilters.startDate = startDateInput.value; fetchAndRenderTransactions(); });
        if(endDateInput) endDateInput.addEventListener('change', () => { currentFilters.endDate = endDateInput.value; fetchAndRenderTransactions(); });
        if(clearFiltersBtn) clearFiltersBtn.addEventListener('click', () => {
            startDateInput.value = '';
            endDateInput.value = '';
            currentFilters.startDate = '';
            currentFilters.endDate = '';
            fetchAndRenderTransactions();
        });

        if(bulkSelectBtn) {
            bulkSelectBtn.addEventListener('click', () => {
                transactionsContainer.classList.toggle('select-mode'); 
                const isSelectMode = transactionsContainer.classList.contains('select-mode');
                bulkSelectBtn.innerHTML = isSelectMode ? '<i class="fas fa-times"></i> Cancel' : '<i class="fas fa-check-double"></i> Select';
                deleteSelectedBtn.classList.toggle('hidden', !isSelectMode);
                if (!isSelectMode) {
                    document.querySelectorAll('.transaction-checkbox').forEach(cb => cb.checked = false);
                }
            });
        }

        if(deleteSelectedBtn) {
            deleteSelectedBtn.addEventListener('click', () => {
                const idsToDelete = Array.from(document.querySelectorAll('.transaction-checkbox:checked')).map(cb => cb.dataset.id);
                if (idsToDelete.length === 0) return showToast('Please select transactions.', 'error');
                
                showConfirmationModal('Delete Transactions?', `Delete ${idsToDelete.length} transaction(s)?`, async () => {
                    const options = { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID, ids: idsToDelete }) };
                    try {
                        await fetchApi(`${API_URL}/transactions`, options);
                        showToast('Deleted successfully');
                        fetchAndRenderTransactions();
                        transactionsContainer.classList.remove('select-mode');
                        deleteSelectedBtn.classList.add('hidden');
                        bulkSelectBtn.innerHTML = '<i class="fas fa-check-double"></i> Select';
                    } catch (error) { }
                });
            });
        }

        if(downloadBtn && jsPDF) {
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
                doc.save(`transactions_${new Date().toISOString().split('T')[0]}.pdf`);
                showToast("Downloaded!");
            });
        }
        
        document.getElementById('date').valueAsDate = new Date();
        fetchAndRenderTransactions();
    }

    // --- CALCULATOR PAGE LOGIC ---
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
            if(historyList) historyList.prepend(li);
        };

        if(keys) {
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
        }

        // Recent Transactions for Calculator Page
        const listContainer = document.getElementById('recent-transactions-list');
        const filterTabs = document.querySelectorAll('.filter-btn'); // Re-select specifically for calc page if needed
        
        const getCategoryIconCal = (category) => ({ 'Salary': 'briefcase', 'Food': 'utensils', 'Transport': 'car', 'Shopping': 'shopping-bag', 'Bills': 'file-invoice-dollar', 'Other': 'receipt' }[category] || 'receipt');

        const fetchAndRenderRecentTransactions = async (filterType = 'all') => {
            let url = `${API_URL}/transactions?userId=${CURRENT_USER_ID}&days=30`;
            if (filterType !== 'all') { url += `&type=${filterType}`; }
            try {
                const transactions = await fetchApi(url);
                if(listContainer) {
                    listContainer.innerHTML = '';
                    if (!transactions || transactions.length === 0) {
                        listContainer.innerHTML = '<p style="text-align: center; color: #777;">No transactions in the last 30 days.</p>';
                        return;
                    }
                    transactions.forEach(t => {
                        const item = document.createElement('div');
                        item.className = `transaction-item ${t.type}`;
                        item.innerHTML = `<div class="transaction-icon"><i class="fas fa-${getCategoryIconCal(t.category)}"></i></div><div class="transaction-details"><span class="category">${t.category}</span><span class="description">${new Date(t.transaction_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></div><div class="transaction-amount">${t.type === 'income' ? '+' : '-'} ₹${parseFloat(t.amount).toLocaleString('en-IN')}</div>`;
                        listContainer.appendChild(item);
                    });
                }
            } catch (error) { }
        };

        filterTabs.forEach(btn => {
            btn.addEventListener('click', () => {
                filterTabs.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                fetchAndRenderRecentTransactions(btn.dataset.filter);
            });
        });
        
        updateDisplay();
        fetchAndRenderRecentTransactions();
    }
});
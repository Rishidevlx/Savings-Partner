// public/js/account-details.js

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api';
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) { window.location.href = '/index.html'; return; }
    const CURRENT_USER_ID = user.id;
    const accountId = new URLSearchParams(window.location.search).get('id');
    if (!accountId) { window.location.href = 'accounts.html'; return; }

    const elements = {
        header: document.getElementById('account-name-header'),
        grid: document.getElementById('ledgers-grid'),
        addLedgerBtn: document.getElementById('add-ledger-btn'),
        ledgerModal: document.getElementById('ledger-modal-overlay'),
        ledgerModalTitle: document.getElementById('ledger-modal-title'),
        closeLedgerModal: document.querySelector('#ledger-modal-overlay .modal-close-btn'),
        ledgerForm: document.getElementById('ledger-form'),
        ledgerSearch: document.getElementById('ledger-search'),
        
        // Delete Ledger Modal
        deleteModal: document.getElementById('delete-ledger-confirm-modal'),
        confirmDeleteBtn: document.getElementById('confirm-delete-ledger-btn'),
        cancelDeleteBtn: document.getElementById('cancel-delete-ledger-btn'),
        
        // Sidebar Toggle
        sidebarToggle: document.getElementById('sidebar-toggle'),
        sidebar: document.getElementById('sidebar')
    };

    let currentAccount = {};
    let allLedgers = [];
    let ledgerToDeleteId = null;

    const showToast = (message, type = 'success') => {
        Toastify({ text: message, duration: 3000, gravity: "top", position: "right", style: { background: type === 'success' ? '#00A79D' : '#e74c3c' } }).showToast();
    };

    const fetchApi = async (url, options = {}) => {
        try {
            const response = await fetch(url, options);
            if(response.status === 204) return null;
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            return result;
        } catch (error) {
            showToast(error.message, 'error');
            throw error;
        }
    };

    // Sidebar Toggle Logic
    elements.sidebarToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('active');
    });
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && !elements.sidebar.contains(e.target) && e.target !== elements.sidebarToggle && !elements.sidebarToggle.contains(e.target)) {
            elements.sidebar.classList.remove('active');
        }
    });

    const setupPage = async () => {
        try {
            currentAccount = await fetchApi(`${API_URL}/accounts/${accountId}?userId=${CURRENT_USER_ID}`);
            elements.header.textContent = currentAccount.name;
            const ledgers = await fetchApi(`${API_URL}/ledgers?accountId=${accountId}&userId=${CURRENT_USER_ID}`);
            allLedgers = ledgers;
            renderLedgers(ledgers);
        } catch (error) { console.error(error); }
    };

    const renderLedgers = (ledgers) => {
        elements.grid.innerHTML = '';
        if (ledgers.length === 0) {
            elements.grid.innerHTML = `<div class="empty-state"><i class="fas fa-book-open" style="font-size:40px; margin-bottom:10px; display:block;"></i><p>No ledgers found. Create one to start.</p></div>`;
            return;
        }
        ledgers.forEach(ledger => {
            const card = document.createElement('div');
            card.className = 'ledger-card';
            card.dataset.id = ledger.id;
            card.innerHTML = `
                <i class="fas fa-book"></i>
                <h3>${ledger.name}</h3>
                <p>${new Date(ledger.ledger_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                
                <div style="display:flex; gap:10px; width:100%;">
                    <button class="btn btn-primary btn-full-width view-ledger-btn">View</button>
                    <button class="icon-btn edit-ledger-btn"><i class="fas fa-pencil-alt"></i></button>
                    <button class="icon-btn delete delete-ledger-btn"><i class="fas fa-trash"></i></button>
                </div>
            `;
            elements.grid.appendChild(card);
        });
    };

    elements.ledgerSearch.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allLedgers.filter(l => l.name.toLowerCase().includes(term));
        renderLedgers(filtered);
    });

    // Ledger Actions (Edit, Delete, View)
    elements.addLedgerBtn.addEventListener('click', () => {
        elements.ledgerModalTitle.textContent = 'Create New Ledger';
        elements.ledgerForm.removeAttribute('data-edit-id');
        elements.ledgerForm.reset();
        document.getElementById('ledger-date').valueAsDate = new Date();
        elements.ledgerModal.classList.add('active');
    });
    
    elements.closeLedgerModal.addEventListener('click', () => elements.ledgerModal.classList.remove('active'));

    elements.ledgerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(elements.ledgerForm).entries());
        data.userId = CURRENT_USER_ID;
        data.accountId = accountId;
        
        const editId = elements.ledgerForm.getAttribute('data-edit-id');
        
        try {
            if(editId) {
                await fetchApi(`${API_URL}/ledgers/${editId}`, { 
                    method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
                });
                showToast('Ledger updated!');
            } else {
                await fetchApi(`${API_URL}/ledgers`, { 
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
                });
                showToast('Ledger created!');
            }
            elements.ledgerModal.classList.remove('active');
            setupPage();
        } catch(e) {}
    });

    elements.grid.addEventListener('click', (e) => {
        const card = e.target.closest('.ledger-card');
        if (!card) return;
        const ledgerId = card.dataset.id;
        const ledger = allLedgers.find(l => l.id == ledgerId);

        if(e.target.closest('.view-ledger-btn')) {
            window.location.href = `ledger-details.html?id=${ledgerId}`;
        } else if(e.target.closest('.edit-ledger-btn')) {
            elements.ledgerModalTitle.textContent = 'Edit Ledger';
            elements.ledgerForm.setAttribute('data-edit-id', ledgerId);
            document.getElementById('ledger-name').value = ledger.name;
            document.getElementById('ledger-date').value = new Date(ledger.ledger_date).toISOString().split('T')[0];
            elements.ledgerModal.classList.add('active');
        } else if(e.target.closest('.delete-ledger-btn')) {
            ledgerToDeleteId = ledgerId;
            elements.deleteModal.classList.add('active');
        }
    });

    // Delete Logic
    elements.cancelDeleteBtn.addEventListener('click', () => {
        elements.deleteModal.classList.remove('active');
        ledgerToDeleteId = null;
    });
    
    elements.confirmDeleteBtn.addEventListener('click', async () => {
        if(ledgerToDeleteId) {
            try {
                await fetchApi(`${API_URL}/ledgers/${ledgerToDeleteId}`, {
                    method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: CURRENT_USER_ID })
                });
                showToast('Ledger deleted!');
                setupPage();
            } catch(e) {}
            elements.deleteModal.classList.remove('active');
            ledgerToDeleteId = null;
        }
    });

    window.addEventListener('click', (e) => {
        if (e.target === elements.ledgerModal) elements.ledgerModal.classList.remove('active');
        if (e.target === elements.deleteModal) elements.deleteModal.classList.remove('active');
    });

    setupPage();
});
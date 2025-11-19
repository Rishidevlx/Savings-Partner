// public/js/accounts.js

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api';
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) { window.location.href = '/index.html'; return; }
    const CURRENT_USER_ID = user.id;

    const elements = {
        grid: document.getElementById('accounts-grid'),
        addAccountBtn: document.getElementById('add-account-btn'),
        modal: document.getElementById('account-modal-overlay'),
        modalTitle: document.getElementById('account-modal-title'),
        closeModalBtn: document.querySelector('#account-modal-overlay .modal-close-btn'),
        form: document.getElementById('account-form'),
        searchInput: document.getElementById('search-accounts'),
        typeFilter: document.getElementById('type-filter'),
        
        // Delete Modal
        deleteModal: document.getElementById('delete-confirm-modal'),
        confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
        cancelDeleteBtn: document.getElementById('cancel-delete-btn'),
        
        // Sidebar Toggle
        sidebarToggle: document.getElementById('sidebar-toggle'),
        sidebar: document.getElementById('sidebar')
    };

    let allAccounts = [];
    let accountToDeleteId = null;

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
        if (window.innerWidth <= 768 && 
            !elements.sidebar.contains(e.target) && 
            e.target !== elements.sidebarToggle && 
            !elements.sidebarToggle.contains(e.target)) {
            elements.sidebar.classList.remove('active');
        }
    });

    const renderAccounts = (accounts) => {
        elements.grid.innerHTML = '';
        if (accounts.length === 0) {
            elements.grid.innerHTML = `<div class="empty-state"><i class="fas fa-user-tie"></i><p>No accounts found.</p></div>`;
            return;
        }
        accounts.forEach((acc) => {
            const card = document.createElement('div');
            card.className = 'account-card';
            card.dataset.id = acc.id;
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-title">
                        <h3>${acc.name}</h3>
                        <p>${acc.company_name || 'Individual'}</p>
                    </div>
                    <span class="account-type-badge ${acc.account_type}">${acc.account_type}</span>
                </div>
                <div class="card-body">
                    <div class="info-row"><i class="fas fa-phone"></i><span>${acc.phone_number || '-'}</span></div>
                    <div class="info-row"><i class="fas fa-university"></i><span>${acc.account_number || '-'}</span></div>
                    <div class="info-row"><i class="fas fa-qrcode"></i><span>${acc.upi_id || '-'}</span></div>
                </div>
                <div class="card-footer">
                    <button class="btn btn-primary btn-full-width view-details-btn">View Details</button>
                    <button class="icon-btn edit-account-btn"><i class="fas fa-pencil-alt"></i></button>
                    <button class="icon-btn delete delete-account-btn"><i class="fas fa-trash"></i></button>
                </div>
            `;
            elements.grid.appendChild(card);
        });
    };

    const applyFilters = () => {
        const term = elements.searchInput.value.toLowerCase();
        const type = elements.typeFilter.value;
        const filtered = allAccounts.filter(acc => {
            const matchesName = acc.name.toLowerCase().includes(term) || (acc.company_name && acc.company_name.toLowerCase().includes(term));
            const matchesType = type === 'all' || acc.account_type === type;
            return matchesName && matchesType;
        });
        renderAccounts(filtered);
    };

    const fetchAndRenderAccounts = async () => {
        try {
            allAccounts = await fetchApi(`${API_URL}/accounts?userId=${CURRENT_USER_ID}`);
            applyFilters();
        } catch (error) { console.error(error); }
    };

    elements.searchInput.addEventListener('input', applyFilters);
    elements.typeFilter.addEventListener('change', applyFilters);

    elements.addAccountBtn.addEventListener('click', () => {
        elements.modalTitle.textContent = 'Add New Account';
        elements.form.removeAttribute('data-edit-id');
        elements.form.reset();
        elements.modal.classList.add('active');
    });

    elements.closeModalBtn.addEventListener('click', () => elements.modal.classList.remove('active'));

    elements.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(elements.form);
        const data = Object.fromEntries(formData.entries());
        data.userId = CURRENT_USER_ID;
        const editId = elements.form.getAttribute('data-edit-id');

        try {
            if (editId) {
                await fetchApi(`${API_URL}/accounts/${editId}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
                });
                showToast('Account updated!');
            } else {
                await fetchApi(`${API_URL}/accounts`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
                });
                showToast('Account added!');
            }
            elements.modal.classList.remove('active');
            elements.form.reset();
            fetchAndRenderAccounts();
        } catch (error) { console.error(error); }
    });

    elements.grid.addEventListener('click', async (e) => {
        const card = e.target.closest('.account-card');
        if (!card) return;
        const id = card.dataset.id;
        const account = allAccounts.find(a => a.id == id);

        if (e.target.closest('.view-details-btn')) {
            window.location.href = `account-details.html?id=${id}`;
        } else if (e.target.closest('.edit-account-btn')) {
            elements.modalTitle.textContent = 'Edit Account';
            elements.form.setAttribute('data-edit-id', id);
            document.getElementById('account-type').value = account.account_type;
            document.getElementById('account-name').value = account.name;
            document.getElementById('company-name').value = account.company_name;
            document.getElementById('phone-number').value = account.phone_number;
            document.getElementById('account-number').value = account.account_number;
            document.getElementById('upi-id').value = account.upi_id;
            elements.modal.classList.add('active');
        } else if (e.target.closest('.delete-account-btn')) {
            accountToDeleteId = id;
            elements.deleteModal.classList.add('active');
        }
    });

    elements.cancelDeleteBtn.addEventListener('click', () => {
        elements.deleteModal.classList.remove('active');
        accountToDeleteId = null;
    });

    elements.confirmDeleteBtn.addEventListener('click', async () => {
        if(accountToDeleteId) {
            try {
                await fetchApi(`${API_URL}/accounts/${accountToDeleteId}`, {
                    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID })
                });
                showToast('Account deleted successfully!');
                fetchAndRenderAccounts();
            } catch(e) {}
            elements.deleteModal.classList.remove('active');
            accountToDeleteId = null;
        }
    });

    window.addEventListener('click', (e) => {
        if (e.target === elements.deleteModal) elements.deleteModal.classList.remove('active');
        if (e.target === elements.modal) elements.modal.classList.remove('active');
    });

    fetchAndRenderAccounts();
});
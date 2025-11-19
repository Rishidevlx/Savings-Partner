// public/js/ledger-details.js

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:3000/api';
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) { window.location.href = '/index.html'; return; }
    const CURRENT_USER_ID = user.id;
    const ledgerId = new URLSearchParams(window.location.search).get('id');
    if (!ledgerId) { window.location.href = 'accounts.html'; return; }

    let ledgerInfo = null;
    let allEntries = [];
    let entryToDeleteId = null; // Store ID for deletion

    const elements = {
        ledgerNameHeader: document.getElementById('ledger-name-header'),
        accountNameSubheader: document.getElementById('account-name-subheader'),
        backLink: document.getElementById('back-link'),
        statsContainer: document.getElementById('ledger-stats'),
        tableHead: document.querySelector('#entries-table thead'),
        tableBody: document.getElementById('entries-tbody'),
        addEntryBtn: document.getElementById('add-entry-btn'),
        modal: document.getElementById('entry-modal-overlay'),
        modalTitle: document.getElementById('entry-modal-title'),
        form: document.getElementById('entry-form'),
        closeModalBtn: document.querySelector('#entry-modal-overlay .modal-close-btn'),
        emptyStateContainer: document.getElementById('empty-state-container'),
        // Filters
        searchInput: document.getElementById('entry-search'),
        dateFrom: document.getElementById('date-from'),
        dateTo: document.getElementById('date-to'),
        clearFilters: document.getElementById('clear-filters'),
        downloadPdfBtn: document.getElementById('download-pdf-btn'),
        // Delete Modal
        deleteModal: document.getElementById('delete-confirm-modal'),
        confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
        cancelDeleteBtn: document.getElementById('cancel-delete-btn')
    };
    
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

    const setupPage = async () => {
        try {
            ledgerInfo = await fetchApi(`${API_URL}/ledgers/${ledgerId}?userId=${CURRENT_USER_ID}`);
            elements.ledgerNameHeader.textContent = ledgerInfo.name;
            elements.accountNameSubheader.textContent = `For: ${ledgerInfo.account_name}`;
            elements.backLink.href = `account-details.html?id=${ledgerInfo.account_id}`;
            
            generateTableHeaders();
            await fetchAndRenderEntries();
        } catch (error) {
            elements.ledgerNameHeader.textContent = 'Ledger Not Found';
        }
    };

    const generateTableHeaders = () => {
        const headers = ['Date', 'Bill No', 'Description', 'Total Amt', 'Credit', 'Debit', 'Pending', 'Payment', 'Actions'];
        elements.tableHead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    };

    const renderEntries = (entriesToRender) => {
        elements.tableBody.innerHTML = '';
        if (entriesToRender.length === 0) {
            elements.emptyStateContainer.innerHTML = `<div class="empty-state" style="text-align:center; padding:40px; color:#aaa;"><i class="fas fa-file-invoice-dollar" style="font-size:40px; margin-bottom:10px;"></i><p>No entries found.</p></div>`;
            return;
        }
        elements.emptyStateContainer.innerHTML = '';

        let totalTurnover = 0;
        let totalPending = 0;

        const isClient = ledgerInfo.account_type === 'Client';

        entriesToRender.forEach(entry => {
            const total = parseFloat(entry.total_amount);
            const paid = parseFloat(entry.paid_amount);
            const pending = total - paid;

            totalTurnover += total;
            totalPending += pending;

            // Logic: Client (Credit=Paid, Debit=0), Supplier (Credit=0, Debit=Paid)
            const credit = isClient ? paid : 0;
            const debit = isClient ? 0 : paid;

            const isCompleted = pending <= 0;
            const rowClass = isCompleted ? 'completed-row' : '';
            const statusBadge = isCompleted ? '<span class="status-badge completed">Completed</span>' : `₹${pending.toLocaleString('en-IN')}`;

            const row = document.createElement('tr');
            row.className = rowClass;
            row.dataset.entryId = entry.id;
            
            row.innerHTML = `
                <td>${new Date(entry.entry_date).toLocaleDateString('en-GB')}</td>
                <td>${entry.bill_no || '-'}</td>
                <td>${entry.description}</td>
                <td style="font-weight:600">₹${total.toLocaleString('en-IN')}</td>
                <td class="credit-val">${credit > 0 ? '₹'+credit.toLocaleString('en-IN') : '-'}</td>
                <td class="debit-val">${debit > 0 ? '₹'+debit.toLocaleString('en-IN') : '-'}</td>
                <td class="pending-val">${statusBadge}</td>
                <td>${entry.payment_type || '-'}</td>
                <td>
                    <div class="action-group">
                        <button class="action-btn edit-entry-btn" title="Edit"><i class="fas fa-pencil-alt"></i></button>
                        <button class="action-btn delete-entry-btn" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            elements.tableBody.appendChild(row);
        });

        elements.statsContainer.innerHTML = `
             <div class="stat-card">
                <div class="card-title">Total Turnover</div>
                <div class="card-value">₹${totalTurnover.toLocaleString('en-IN')}</div>
            </div>
             <div class="stat-card">
                <div class="card-title">Total Pending</div>
                <div class="card-value ${totalPending > 0 ? 'negative' : 'positive'}">₹${totalPending.toLocaleString('en-IN')}</div>
            </div>
        `;
    };

    const fetchAndRenderEntries = async () => {
        try {
            allEntries = await fetchApi(`${API_URL}/ledger-entries?ledgerId=${ledgerId}&userId=${CURRENT_USER_ID}`);
            applyFilters();
        } catch (error) { console.error(error); }
    };

    const applyFilters = () => {
        const term = elements.searchInput.value.toLowerCase();
        const from = elements.dateFrom.value;
        const to = elements.dateTo.value;

        const filtered = allEntries.filter(entry => {
            const matchSearch = (entry.bill_no && entry.bill_no.toLowerCase().includes(term)) || 
                                (entry.description && entry.description.toLowerCase().includes(term));
            let matchDate = true;
            if (from && to) {
                const d = new Date(entry.entry_date).toISOString().split('T')[0];
                matchDate = d >= from && d <= to;
            }
            return matchSearch && matchDate;
        });
        renderEntries(filtered);
    };

    // Events
    elements.searchInput.addEventListener('input', applyFilters);
    elements.dateFrom.addEventListener('change', applyFilters);
    elements.dateTo.addEventListener('change', applyFilters);
    elements.clearFilters.addEventListener('click', () => {
        elements.searchInput.value = '';
        elements.dateFrom.value = '';
        elements.dateTo.value = '';
        applyFilters();
    });

    // MODAL FORM RENDERER (Compact & Clean)
    const renderForm = (data = null) => {
        const isClient = ledgerInfo.account_type === 'Client';
        const val = (key) => data ? data[key] : '';
        const dateVal = data ? new Date(data.entry_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        elements.form.innerHTML = `
            <div class="modal-form-grid">
                <div class="form-group"><label>Date</label><input type="date" name="entry_date" value="${dateVal}" required></div>
                <div class="form-group"><label>Bill No</label><input type="text" name="bill_no" value="${val('bill_no')}" placeholder="e.g. 101"></div>
                
                <div class="form-group full-width"><label>Description</label><input type="text" name="description" value="${val('description')}" required placeholder="Item or Service details"></div>
                
                <div class="form-group"><label>Total Amount (₹)</label><input type="number" name="total_amount" value="${val('total_amount')}" required></div>
                <div class="form-group"><label>${isClient ? 'Received' : 'Paid'} Amount (₹)</label><input type="number" name="paid_amount" value="${val('paid_amount') || 0}"></div>
                
                <div class="form-group full-width"><label>Payment Type</label>
                    <select name="payment_type">
                        <option value="Cash" ${val('payment_type') === 'Cash' ? 'selected' : ''}>Cash</option>
                        <option value="Online" ${val('payment_type') === 'Online' ? 'selected' : ''}>Online</option>
                        <option value="Cheque" ${val('payment_type') === 'Cheque' ? 'selected' : ''}>Cheque</option>
                        <option value="Pending" ${val('payment_type') === 'Pending' ? 'selected' : ''}>Pending</option>
                    </select>
                </div>
            </div>
            <div style="margin-top:20px;">
                <button type="submit" class="btn btn-primary btn-full-width" style="justify-content:center;">${data ? 'Update Entry' : 'Save Entry'}</button>
            </div>
        `;
    };

    elements.addEntryBtn.addEventListener('click', () => {
        elements.modalTitle.textContent = 'New Entry';
        elements.form.removeAttribute('data-edit-id');
        renderForm();
        elements.modal.classList.add('active');
    });

    elements.closeModalBtn.addEventListener('click', () => elements.modal.classList.remove('active'));

    elements.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(elements.form);
        const data = Object.fromEntries(formData.entries());
        
        // Set quantity to 0 by default since we removed it from UI
        data.quantity = 0;
        data.ledger_id = ledgerId;
        data.user_id = CURRENT_USER_ID;
        // For Edit API, it expects snake_case keys often, ensure backend matches
        data.userId = CURRENT_USER_ID; 
        
        const editId = elements.form.getAttribute('data-edit-id');

        try {
            if(editId) {
                await fetchApi(`${API_URL}/ledger-entries/${editId}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
                });
                showToast('Entry updated successfully!');
            } else {
                await fetchApi(`${API_URL}/ledger-entries`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
                });
                showToast('Entry added successfully!');
            }
            elements.modal.classList.remove('active');
            fetchAndRenderEntries();
        } catch(error) { console.error(error); }
    });

    // Table Actions (Edit/Delete)
    elements.tableBody.addEventListener('click', async (e) => {
        const tr = e.target.closest('tr');
        if (!tr) return;
        const entryId = tr.dataset.entryId;
        const entry = allEntries.find(e => e.id == entryId);

        if(e.target.closest('.delete-entry-btn')) {
            entryToDeleteId = entryId;
            elements.deleteModal.classList.add('active');
        } else if (e.target.closest('.edit-entry-btn')) {
            elements.modalTitle.textContent = 'Edit Entry';
            elements.form.setAttribute('data-edit-id', entryId);
            renderForm(entry);
            elements.modal.classList.add('active');
        }
    });

    // Custom Delete Modal Logic
    elements.cancelDeleteBtn.addEventListener('click', () => {
        elements.deleteModal.classList.remove('active');
        entryToDeleteId = null;
    });

    elements.confirmDeleteBtn.addEventListener('click', async () => {
        if (entryToDeleteId) {
            try {
                await fetchApi(`${API_URL}/ledger-entries/${entryToDeleteId}`, {
                    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID })
                });
                showToast('Entry deleted successfully!');
                fetchAndRenderEntries();
            } catch (error) {
                console.error(error);
            }
            elements.deleteModal.classList.remove('active');
            entryToDeleteId = null;
        }
    });

    // Close Delete Modal on Outside Click
    elements.deleteModal.addEventListener('click', (e) => {
        if (e.target === elements.deleteModal) {
            elements.deleteModal.classList.remove('active');
            entryToDeleteId = null;
        }
    });

    // PDF Download
    elements.downloadPdfBtn.addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.setTextColor(0, 167, 157);
        doc.text(ledgerInfo.name, 14, 20);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Account: ${ledgerInfo.account_name}`, 14, 26);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32);

        const rows = [];
        const isClient = ledgerInfo.account_type === 'Client';
        
        allEntries.forEach(e => {
            const total = parseFloat(e.total_amount);
            const paid = parseFloat(e.paid_amount);
            const pending = total - paid;
            const credit = isClient ? paid : 0;
            const debit = isClient ? 0 : paid;
            
            rows.push([
                new Date(e.entry_date).toLocaleDateString('en-GB'),
                e.bill_no || '-',
                e.description,
                total.toFixed(2),
                credit > 0 ? credit.toFixed(2) : '-',
                debit > 0 ? debit.toFixed(2) : '-',
                pending.toFixed(2),
                e.payment_type
            ]);
        });

        doc.autoTable({
            head: [['Date', 'Bill No', 'Desc', 'Total', 'Credit', 'Debit', 'Pending', 'Type']],
            body: rows,
            startY: 38,
            theme: 'grid',
            headStyles: { fillColor: [0, 167, 157] },
            styles: { fontSize: 8 }
        });

        doc.save(`${ledgerInfo.name}_Ledger.pdf`);
        showToast('PDF Downloaded');
    });

    setupPage();
});
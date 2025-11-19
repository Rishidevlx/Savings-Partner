// public/js/notes.js

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api/notes';
    
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/index.html';
        return;
    }
    const CURRENT_USER_ID = user.id;

    // --- DOM Elements ---
    const elements = {
        notesGrid: document.getElementById('notes-grid-container'),
        importantList: document.getElementById('important-notes-list-container'),
        remindersList: document.getElementById('reminders-list-container'),
        searchInput: document.getElementById('note-search-input'),
        startDateInput: document.getElementById('start-date'),
        endDateInput: document.getElementById('end-date'),
        clearFiltersBtn: document.getElementById('clear-filters-btn'),
        noteModal: document.getElementById('note-modal-overlay'),
        viewModal: document.getElementById('view-note-modal-overlay'),
        deleteModal: document.getElementById('confirm-delete-modal-overlay'),
        setPasswordModal: document.getElementById('set-password-modal-overlay'),
        verifyPasswordModal: document.getElementById('verify-password-modal-overlay'),
        noteForm: document.getElementById('note-form'),
        setPasswordForm: document.getElementById('set-password-form'),
        verifyPasswordForm: document.getElementById('verify-password-form'),
    };

    // --- State Management ---
    let notes = [];
    let actionState = { noteId: null, action: null };

    // --- Helper Functions ---
    const showToast = (message, type = 'success') => {
        Toastify({ text: message, duration: 3000, gravity: "top", position: "right", stopOnFocus: true, style: { background: type === 'success' ? "linear-gradient(to right, #00A79D, #00b09b)" : "linear-gradient(to right, #e74c3c, #ff5f6d)" } }).showToast();
    };

    const setupModal = (openBtnId, closeBtnId, overlayId) => {
        const openBtn = document.getElementById(openBtnId);
        const closeBtn = document.getElementById(closeBtnId);
        const overlay = document.getElementById(overlayId);
        if (openBtn) openBtn.addEventListener('click', () => {
             if(openBtnId === 'add-note-btn') {
                 document.getElementById('note-modal-title').textContent = 'Create a New Note';
                 elements.noteForm.reset();
                 elements.noteForm.removeAttribute('data-editing-id');
             }
            overlay.classList.add('active');
        });
        if (closeBtn) closeBtn.addEventListener('click', () => overlay.classList.remove('active'));
        if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
    };

    const fetchApi = async (url, options = {}) => {
        try {
            const response = await fetch(url, options);
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'An error occurred');
            return result;
        } catch (error) {
            showToast(error.message, 'error');
            throw error;
        }
    };
    
    // --- Render Functions ---
    const getEmptyStateHTML = (icon, message) => {
        return `<div class="empty-state"><i class="fas fa-${icon}"></i><p>${message}</p></div>`;
    };

    const renderNotes = () => {
        elements.notesGrid.innerHTML = '';
        elements.importantList.innerHTML = '';

        if (notes.length === 0) {
            elements.notesGrid.innerHTML = getEmptyStateHTML('folder-open', 'No notes found. Create one to get started!');
        }

        notes.forEach(note => {
            const noteCard = document.createElement('div');
            noteCard.className = 'note-card';
            noteCard.dataset.id = note.id;
            noteCard.innerHTML = `
                <div class="note-card-main">
                    <h3 class="note-title">${note.title} ${note.is_locked ? '<i class="fas fa-lock"></i>' : ''}</h3>
                    <p class="note-content">${note.content ? note.content.split('\n')[0] : 'No content'}</p>
                </div>
                <div class="note-card-footer">
                     <span class="note-date">${note.reminder_date ? new Date(note.reminder_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                    <div class="note-actions">
                         <button class="note-action-btn view-btn" title="View"><i class="fas fa-eye"></i></button>
                         <button class="note-action-btn edit-btn" title="Edit"><i class="fas fa-pencil-alt"></i></button>
                         <button class="note-action-btn star-btn ${note.is_important ? 'starred' : ''}" title="Important"><i class="fas fa-star"></i></button>
                         <button class="note-action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
                         <button class="note-action-btn more-btn" title="More"><i class="fas fa-ellipsis-v"></i></button>
                         <div class="dropdown-menu">
                            <a class="dropdown-item set-password-btn"><i class="fas fa-lock"></i> Set Password</a>
                         </div>
                    </div>
                </div>`;
            elements.notesGrid.appendChild(noteCard);

            if (note.is_important) {
                const importantItem = document.createElement('div');
                importantItem.className = 'important-note-item';
                importantItem.dataset.id = note.id;
                importantItem.innerHTML = `<i class="fas fa-star"></i> ${note.title} ${note.is_locked ? '<i class="fas fa-lock lock-icon-sm"></i>' : ''}`;
                elements.importantList.appendChild(importantItem);
            }
        });
        if (elements.importantList.innerHTML === '') {
            elements.importantList.innerHTML = getEmptyStateHTML('star', 'Star a note to see it here.');
        }
    };

    const renderTodaysReminders = () => {
        const todayDate = new Date();
        const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
        
        const todaysReminders = notes.filter(note => note.reminder_date && note.reminder_date.startsWith(today));
        elements.remindersList.innerHTML = '';
        if (todaysReminders.length > 0) {
            todaysReminders.forEach(note => {
                const reminderItem = document.createElement('div');
                reminderItem.className = 'reminder-item';
                reminderItem.textContent = note.title;
                elements.remindersList.appendChild(reminderItem);
            });
        } else {
            elements.remindersList.innerHTML = `<p class="empty-message" style="padding:0; font-size: 14px;">No reminders for today.</p>`;
        }
    };

    const fetchNotes = async () => {
        const search = elements.searchInput.value;
        const startDate = elements.startDateInput.value;
        const endDate = elements.endDateInput.value;
        let url = `${API_URL}?userId=${CURRENT_USER_ID}`;
        if (search) url += `&search=${search}`;
        if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;
        try {
            notes = await fetchApi(url);
            renderNotes();
            renderTodaysReminders();
        } catch (error) { console.error("Failed to fetch notes:", error); }
    };

    const handleNoteAction = (noteId, action, unlockedData = null) => {
        const note = unlockedData || notes.find(n => n.id === noteId);
        if (!note) return;
        switch (action) {
            case 'view':
                document.getElementById('view-note-title').textContent = note.title;
                document.getElementById('view-note-content').innerHTML = note.content.replace(/\n/g, '<br>');
                document.getElementById('view-note-date').innerHTML = `<i class="fas fa-calendar-alt"></i> ${new Date(note.reminder_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
                elements.viewModal.classList.add('active');
                break;
            case 'edit':
                document.getElementById('note-modal-title').textContent = 'Edit Note';
                elements.noteForm.elements['note-title-input'].value = note.title;
                elements.noteForm.elements['note-date-input'].value = note.reminder_date ? note.reminder_date.split('T')[0] : '';
                elements.noteForm.elements['note-content-input'].value = note.content;
                elements.noteForm.dataset.editingId = note.id;
                elements.noteModal.classList.add('active');
                break;
            case 'delete':
                elements.deleteModal.classList.add('active');
                document.getElementById('confirm-delete-btn').dataset.noteId = note.id;
                break;
            case 'set-password':
                elements.setPasswordForm.reset();
                elements.setPasswordModal.classList.add('active');
                elements.setPasswordForm.dataset.noteId = note.id;
                break;
        }
    };

    const getNoteFromEvent = (e, parentSelector) => {
        const targetElement = e.target.closest(parentSelector);
        if (!targetElement) return null;
        const noteId = parseInt(targetElement.dataset.id);
        return notes.find(n => n.id === noteId);
    };

    const determineAction = e => {
        if (e.target.closest('.view-btn')) return 'view';
        if (e.target.closest('.edit-btn')) return 'edit';
        if (e.target.closest('.delete-btn')) return 'delete';
        if (e.target.closest('.set-password-btn')) return 'set-password';
        return null;
    };

    [elements.searchInput, elements.startDateInput, elements.endDateInput].forEach(el => el.addEventListener('input', fetchNotes));
    elements.clearFiltersBtn.addEventListener('click', () => { elements.startDateInput.value = ''; elements.endDateInput.value = ''; fetchNotes(); });

    elements.notesGrid.addEventListener('click', async e => {
        const note = getNoteFromEvent(e, '.note-card');
        if (!note) return;
        const action = determineAction(e);
        if (action) {
            if (note.is_locked && action !== 'set-password') {
                actionState = { noteId: note.id, action };
                elements.verifyPasswordForm.reset();
                elements.verifyPasswordModal.classList.add('active');
            } else { handleNoteAction(note.id, action); }
        } else if (e.target.closest('.star-btn')) {
            try { await fetchApi(`${API_URL}/${note.id}/toggle-important`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID }) }); fetchNotes(); } catch (error) { console.error('Failed to toggle important:', error); }
        } else if (e.target.closest('.more-btn')) {
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => menu.classList.remove('show'));
            e.target.closest('.note-actions').querySelector('.dropdown-menu').classList.toggle('show');
        }
    });

    elements.importantList.addEventListener('click', e => {
        const note = getNoteFromEvent(e, '.important-note-item');
        if (!note) return;
        if (note.is_locked) {
            actionState = { noteId: note.id, action: 'view' };
            elements.verifyPasswordForm.reset();
            elements.verifyPasswordModal.classList.add('active');
        } else { handleNoteAction(note.id, 'view'); }
    });

    elements.noteForm.addEventListener('submit', async e => {
        e.preventDefault();
        const editingId = e.target.dataset.editingId;
        const data = { userId: CURRENT_USER_ID, title: e.target.elements['note-title-input'].value, content: e.target.elements['note-content-input'].value, reminder_date: e.target.elements['note-date-input'].value || null };
        try {
            if (editingId) { await fetchApi(`${API_URL}/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); showToast('Note updated successfully!'); } 
            else { await fetchApi(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); showToast('Note created successfully!'); }
            elements.noteModal.classList.remove('active');
            fetchNotes();
        } catch (error) { console.error('Failed to save note:', error); }
    });

    elements.setPasswordForm.addEventListener('submit', async e => {
        e.preventDefault();
        const noteId = e.target.dataset.noteId;
        const password = e.target.elements['note-password'].value;
        const confirmPassword = e.target.elements['note-confirm-password'].value;
        if (password.length < 4) { showToast('Password must be at least 4 characters.', 'error'); return; }
        if (password !== confirmPassword) { showToast('Passwords do not match.', 'error'); return; }
        try {
            await fetchApi(`${API_URL}/${noteId}/set-password`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID, password }) });
            showToast('Password set successfully!');
            elements.setPasswordModal.classList.remove('active');
            fetchNotes();
        } catch (error) { console.error('Failed to set password:', error); }
    });

    elements.verifyPasswordForm.addEventListener('submit', async e => {
        e.preventDefault();
        const password = e.target.elements['note-verify-password'].value;
        try {
            const result = await fetchApi(`${API_URL}/${actionState.noteId}/verify-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID, password }) });
            if (result.success) {
                elements.verifyPasswordModal.classList.remove('active');
                handleNoteAction(actionState.noteId, actionState.action, result.note);
            }
        } catch (error) { console.error('Password verification failed:', error); }
    });

    document.getElementById('confirm-delete-btn').addEventListener('click', async (e) => {
        const noteId = parseInt(e.target.dataset.noteId);
        try {
            await fetchApi(`${API_URL}/${noteId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID }) });
            showToast('Note deleted successfully!', 'error');
            elements.deleteModal.classList.remove('active');
            fetchNotes();
        } catch (error) { console.error('Failed to delete note:', error); }
    });

    setupModal('add-note-btn', 'close-note-modal', 'note-modal-overlay');
    setupModal(null, 'close-view-note-modal', 'view-note-modal-overlay');
    setupModal(null, 'confirm-cancel-btn', 'confirm-delete-modal-overlay');
    setupModal(null, 'close-set-password-modal', 'set-password-modal-overlay');
    setupModal(null, 'close-verify-password-modal', 'verify-password-modal-overlay');
    document.getElementById('current-date-display').textContent = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    fetchNotes();
});
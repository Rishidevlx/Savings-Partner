// public/js/settings.js

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api';
    const user = JSON.parse(localStorage.getItem('user'));

    if (!user) {
        window.location.href = '/index.html';
        return;
    }
    const CURRENT_USER_ID = user.id;

    // --- DOM Elements ---
    const elements = {
        profileForm: document.getElementById('profile-form'),
        passwordForm: document.getElementById('password-form'),
        fullnameInput: document.getElementById('fullname'),
        cidInput: document.getElementById('cid'),
        connectionsList: document.getElementById('connections-list'),
        goalsList: document.getElementById('goals-list'),
        notesList: document.getElementById('notes-list'),
        confirmModal: document.getElementById('confirm-modal-overlay'),
        confirmTitle: document.getElementById('confirm-modal-title'),
        confirmText: document.getElementById('confirm-modal-text'),
        confirmActionBtn: document.getElementById('confirm-action-btn'),
        confirmCancelBtn: document.getElementById('confirm-cancel-btn'),
    };

    // --- Helper Functions ---
    const showToast = (message, type = 'success') => {
        Toastify({ text: message, duration: 3000, gravity: "top", position: "right", stopOnFocus: true, style: { background: type === 'success' ? "linear-gradient(to right, #00A79D, #00b09b)" : "linear-gradient(to right, #e74c3c, #ff5f6d)" } }).showToast();
    };
    
    const fetchApi = async (url, options = {}) => {
        try {
            const response = await fetch(url, options);
            if (response.status === 204) return null;
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'An API error occurred');
            return result;
        } catch (error) {
            showToast(error.message, 'error');
            throw error;
        }
    };
    
    const showConfirmationModal = (title, text, onConfirm) => {
        elements.confirmTitle.textContent = title;
        elements.confirmText.textContent = text;
        elements.confirmModal.classList.add('active');
        
        // Clone and replace to remove old event listeners
        const newConfirmActionBtn = elements.confirmActionBtn.cloneNode(true);
        elements.confirmActionBtn.parentNode.replaceChild(newConfirmActionBtn, elements.confirmActionBtn);
        elements.confirmActionBtn = newConfirmActionBtn;

        elements.confirmActionBtn.addEventListener('click', () => {
            onConfirm();
            elements.confirmModal.classList.remove('active');
        });
    };
    elements.confirmCancelBtn.addEventListener('click', () => elements.confirmModal.classList.remove('active'));


    // --- Render Functions ---
    const renderConnections = (connections) => {
        elements.connectionsList.innerHTML = '';
        if (connections.length === 0) {
            elements.connectionsList.innerHTML = '<p>You have no active connections.</p>';
            return;
        }
        connections.forEach(conn => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="item-info">
                    <div class="item-title">${conn.fullname}</div>
                    <div class="item-subtitle">${conn.cid}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-delete" data-connection-id="${conn.connection_id}">Disconnect</button>
                </div>
            `;
            elements.connectionsList.appendChild(item);
        });
    };

    const renderGoals = (goals) => {
        elements.goalsList.innerHTML = '';
        if (goals.length === 0) {
            elements.goalsList.innerHTML = '<p>You are not part of any connected goals.</p>';
            return;
        }
        goals.forEach(goal => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="item-info">
                    <div class="item-title">${goal.name}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-delete" data-goal-id="${goal.id}">Leave Goal</button>
                </div>
            `;
            elements.goalsList.appendChild(item);
        });
    };

    const renderNotes = (notes) => {
        elements.notesList.innerHTML = '';
        if (notes.length === 0) {
            elements.notesList.innerHTML = '<p>You have no password-protected notes.</p>';
            return;
        }
        notes.forEach(note => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="item-info">
                    <div class="item-title">${note.title}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-delete" data-note-id="${note.id}">Remove Password</button>
                </div>
            `;
            elements.notesList.appendChild(item);
        });
    };
    
    // --- Fetch and Populate ---
    const populatePage = async () => {
        elements.fullnameInput.value = user.fullname;
        elements.cidInput.value = user.cid;

        const [connections, goals, notes] = await Promise.all([
            fetchApi(`${API_URL}/settings/connections?userId=${CURRENT_USER_ID}`),
            fetchApi(`${API_URL}/settings/connected-goals?userId=${CURRENT_USER_ID}`),
            fetchApi(`${API_URL}/settings/locked-notes?userId=${CURRENT_USER_ID}`),
        ]);
        
        if(connections) renderConnections(connections);
        if(goals) renderGoals(goals);
        if(notes) renderNotes(notes);
    };

    // --- Event Listeners ---
    elements.profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newFullname = elements.fullnameInput.value;
        const newCid = elements.cidInput.value;
        
        const data = { userId: CURRENT_USER_ID, fullname: newFullname, cid: newCid };

        try {
            await fetchApi(`${API_URL}/user/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            showToast('Profile updated successfully!');
            // Update localStorage
            user.fullname = newFullname;
            user.cid = newCid;
            localStorage.setItem('user', JSON.stringify(user));
        } catch(error) {
            // Revert on error
            elements.fullnameInput.value = user.fullname;
            elements.cidInput.value = user.cid;
        }
    });
    
    elements.passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPassword = document.getElementById('old-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            showToast("New passwords do not match.", 'error');
            return;
        }
        
        const data = { userId: CURRENT_USER_ID, oldPassword, newPassword };
        try {
            await fetchApi(`${API_URL}/user/change-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            showToast('Password changed successfully!');
            elements.passwordForm.reset();
        } catch(error) {
            // Error handled by fetchApi
        }
    });
    
    // Event delegation for dynamically loaded items
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        // Disconnect Connection
        if (target.matches('[data-connection-id]')) {
            const connectionId = target.dataset.connectionId;
            showConfirmationModal('Disconnect User?', 'Are you sure you want to remove this connection?', async () => {
                await fetchApi(`${API_URL}/settings/disconnect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID, connectionId }) });
                populatePage();
            });
        }
        
        // Leave Goal
        if (target.matches('[data-goal-id]')) {
            const goalId = target.dataset.goalId;
            showConfirmationModal('Leave Goal?', 'Are you sure you want to leave this goal? You will lose access to it.', async () => {
                await fetchApi(`${API_URL}/settings/leave-goal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID, goalId }) });
                populatePage();
            });
        }

        // Remove Note Password
        if (target.matches('[data-note-id]')) {
            const noteId = target.dataset.noteId;
            showConfirmationModal('Remove Password?', 'Are you sure you want to remove the password from this note?', async () => {
                await fetchApi(`${API_URL}/settings/remove-note-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID, noteId }) });
                populatePage();
            });
        }
    });

    // Initial Load
    populatePage();
});
// public/js/admin.js

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api';
    const user = JSON.parse(localStorage.getItem('user'));

    // Verify Admin
    if (!user || user.role !== 'admin') {
        window.location.href = '/index.html';
        return;
    }

    const elements = {
        tbody: document.getElementById('users-tbody'),
        deleteModal: document.getElementById('delete-confirm-modal'),
        confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
        cancelDeleteBtn: document.getElementById('cancel-delete-btn')
    };

    let userToDeleteId = null;

    const showToast = (message, type = 'success') => {
        Toastify({ text: message, duration: 3000, gravity: "top", position: "right", style: { background: type === 'success' ? '#00A79D' : '#e74c3c' } }).showToast();
    };

    const fetchUsers = async () => {
        try {
            const response = await fetch(`${API_URL}/admin/users`);
            const users = await response.json();
            renderUsers(users);
        } catch (error) {
            console.error('Error fetching users:', error);
            showToast('Failed to load users', 'error');
        }
    };

    const renderUsers = (users) => {
        elements.tbody.innerHTML = '';
        users.forEach(u => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${u.id}</td>
                <td>${u.fullname}</td>
                <td>${u.email}</td>
                <td><span style="background:#e0f2f1; color:#00A79D; padding:4px 8px; border-radius:4px; font-size:12px;">${u.cid || '-'}</span></td>
                <td>${new Date(u.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="action-btn delete-user-btn" data-id="${u.id}" style="color:#e74c3c; border-color:#e74c3c;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            elements.tbody.appendChild(row);
        });
    };

    elements.tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.delete-user-btn');
        if (btn) {
            userToDeleteId = btn.dataset.id;
            elements.deleteModal.classList.add('active');
        }
    });

    elements.confirmDeleteBtn.addEventListener('click', async () => {
        if (userToDeleteId) {
            try {
                await fetch(`${API_URL}/admin/users/${userToDeleteId}`, { method: 'DELETE' });
                showToast('User deleted successfully');
                fetchUsers();
            } catch (error) {
                showToast('Error deleting user', 'error');
            }
            elements.deleteModal.classList.remove('active');
            userToDeleteId = null;
        }
    });

    elements.cancelDeleteBtn.addEventListener('click', () => {
        elements.deleteModal.classList.remove('active');
        userToDeleteId = null;
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('user');
        window.location.href = '/index.html';
    });

    fetchUsers();
});
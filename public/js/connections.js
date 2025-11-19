// public/js/connections.js

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:3000/api';
    
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/index.html';
        return;
    }
    const CURRENT_USER_ID = user.id;

    const elements = {
        cidText: document.getElementById('cid-text'),
        copyCidBtn: document.getElementById('copy-cid-btn'),
        requestsContainer: document.getElementById('requests-list-container'),
        connectedGoalsContainer: document.getElementById('connected-goals-grid'),
        requestCountBadge: document.getElementById('request-count-badge'),
        addConnectionForm: document.getElementById('add-connection-form'),
        cidInput: document.getElementById('cid-input'),
        foundUserContainer: document.getElementById('found-user-container'),
        createGoalModal: document.getElementById('create-goal-modal-overlay'),
        createGoalForm: document.getElementById('create-goal-form'),
        connectionsCheckboxList: document.getElementById('connections-checkbox-list'),
        notificationBell: document.getElementById('notification-bell'),
        notificationCount: document.getElementById('notification-count'),
        notificationDropdown: document.getElementById('notification-dropdown'),
        goalSearchInput: document.getElementById('connected-goal-search-input'),
        goalFilterTabs: document.getElementById('connected-goal-filter-tabs'),
    };
    
    const modals = {};
    const createModal = (id, content) => {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.id = `${id}-overlay`;
        modalOverlay.innerHTML = content;
        document.body.appendChild(modalOverlay);
        
        modals[id] = {
            overlay: modalOverlay,
            form: modalOverlay.querySelector('form'),
            closeBtn: modalOverlay.querySelector('.modal-close-btn'),
            cancelBtn: modalOverlay.querySelector('.btn-secondary'),
        };
        
        modals[id].closeBtn?.addEventListener('click', () => modalOverlay.classList.remove('active'));
        modals[id].cancelBtn?.addEventListener('click', () => modalOverlay.classList.remove('active'));
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) modalOverlay.classList.remove('active');
        });
    };

    createModal('edit-goal', `
        <div class="modal wide-modal">
            <button class="modal-close-btn">&times;</button>
            <h3>Edit Connected Goal</h3>
            <form id="edit-goal-form">
                <div class="form-group"><label for="edit-goal-name">Goal Name</label><input type="text" id="edit-goal-name" required></div>
                <div class="form-group"><label for="edit-goal-target-amount">Target Amount (₹)</label><input type="number" id="edit-goal-target-amount" required></div>
                <div class="form-group"><label for="edit-goal-target-date">Target Date</label><input type="date" id="edit-goal-target-date" required></div>
                <button type="submit" class="btn btn-primary btn-full-width">Save Changes</button>
            </form>
        </div>`);

    createModal('add-fund', `
        <div class="modal">
            <button class="modal-close-btn">&times;</button>
            <h3>Add Funds</h3>
            <p id="add-fund-goal-name-p"></p>
            <form id="add-fund-form">
                <div class="form-group">
                    <label for="add-fund-type">Type</label>
                    <select id="add-fund-type" name="type">
                        <option value="income">Income (Add to Goal)</option>
                        <option value="expense">Expense (Remove from Goal)</option>
                    </select>
                </div>
                <div class="form-group"><label for="add-fund-amount">Amount (₹)</label><input type="number" id="add-fund-amount" required></div>
                <div class="form-group"><label for="add-fund-date">Date</label><input type="date" id="add-fund-date" required></div>
                <div class="form-group"><label for="add-fund-description">Description (Optional)</label><textarea id="add-fund-description"></textarea></div>
                <button type="submit" class="btn btn-primary btn-full-width">Update Goal</button>
            </form>
        </div>`);
        
    createModal('delete-goal-confirm', `
        <div class="modal confirm-modal">
            <h3>Are you sure?</h3>
            <p>This connected goal will be permanently deleted for everyone. This cannot be undone.</p>
            <div class="confirm-buttons">
                <button class="btn btn-secondary">Cancel</button>
                <button class="btn btn-delete" id="confirm-delete-goal-btn">Delete</button>
            </div>
        </div>`);
        
    createModal('extend-date', `
        <div class="modal">
            <button class="modal-close-btn">&times;</button>
            <h3>Extend Goal Date</h3>
            <form id="extend-date-form">
                <div class="form-group"><label for="extend-goal-target-date">New Target Date</label><input type="date" id="extend-goal-target-date" required></div>
                <button type="submit" class="btn btn-primary btn-full-width">Extend Date</button>
            </form>
        </div>`);

    let allConnectedGoals = [];

    const showToast = (message, type = 'success') => {
        Toastify({ text: message, duration: 3000, gravity: "top", position: "right", stopOnFocus: true, style: { background: type === 'success' ? "linear-gradient(to right, #00A79D, #00b09b)" : "linear-gradient(to right, #e74c3c, #ff5f6d)" } }).showToast();
    };
    
    const fetchApi = async (url, options = {}) => {
        try {
            const response = await fetch(url, options);
            const contentType = response.headers.get("content-type");
            if (response.status === 204) return null;
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'An API error occurred');
                return result;
            } else {
                const textResult = await response.text();
                if (!response.ok) throw new Error(textResult || 'An API error occurred');
                return textResult;
            }
        } catch (error) { 
            showToast(error.message, 'error');
            console.error("API Fetch Error:", error);
            throw error; 
        }
    };

    const renderEmptyState = (container, icon, message) => {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-${icon}"></i><p>${message}</p></div>`;
    };

    const fetchConnectionRequests = async () => {
        try {
            const requests = await fetchApi(`${API_URL}/connections/requests?userId=${CURRENT_USER_ID}`);
            elements.requestCountBadge.textContent = requests.length;
            if (requests.length === 0) {
                renderEmptyState(elements.requestsContainer, 'user-check', 'No new connection requests.');
                return;
            }
            elements.requestsContainer.innerHTML = '';
            requests.forEach(req => {
                const requestItem = document.createElement('div');
                requestItem.className = 'request-item';
                requestItem.dataset.requestId = req.id;
                requestItem.innerHTML = `
                    <div class="request-info"><span class="user-name">${req.fullname}</span><span class="user-cid">${req.cid}</span></div>
                    <div class="request-actions"><button class="btn btn-accept">Accept</button><button class="btn btn-decline">Decline</button></div>`;
                elements.requestsContainer.appendChild(requestItem);
            });
        } catch (error) {
            renderEmptyState(elements.requestsContainer, 'user-times', 'Could not load requests.');
        }
    };
    
    const fetchGoalInvitations = async () => {
        try {
            const invitations = await fetchApi(`${API_URL}/connected-goals/invitations?userId=${CURRENT_USER_ID}`);
            const currentCount = (await fetchApi(`${API_URL}/notifications?userId=${CURRENT_USER_ID}`)).length;
            const totalNotifications = invitations.length + currentCount;
            
            elements.notificationCount.textContent = totalNotifications;
            elements.notificationCount.dataset.count = totalNotifications;
            
            elements.notificationDropdown.innerHTML = '';
            if (totalNotifications === 0) {
                 elements.notificationDropdown.innerHTML = '<div class="notification-item"><p>No new notifications.</p></div>';
                return;
            }
            
            invitations.forEach(inv => {
                const item = document.createElement('div');
                item.className = 'notification-item';
                item.dataset.invitationId = inv.invitation_id;
                item.innerHTML = `
                    <p><b>${inv.invited_by}</b> invited you to the goal: <b>${inv.goal_name}</b></p>
                    <div class="notification-actions">
                        <button class="btn btn-accept btn-accept-goal">Accept</button>
                        <button class="btn btn-decline btn-decline-goal">Decline</button>
                    </div>`;
                elements.notificationDropdown.appendChild(item);
            });
        } catch (error) {
             elements.notificationDropdown.innerHTML = '<div class="notification-item"><p>Could not load notifications.</p></div>';
        }
    };
    
    const fetchUserNotifications = async () => {
        try {
            const notifications = await fetchApi(`${API_URL}/notifications?userId=${CURRENT_USER_ID}`);
            if (notifications.length > 0) {
                const notificationIds = [];
                notifications.forEach(notif => {
                    showToast(notif.message, 'error');
                    notificationIds.push(notif.id);
                });
                await fetchApi(`${API_URL}/notifications/mark-read`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notificationIds })
                });
                fetchGoalInvitations(); // Refresh bell count
            }
        } catch (error) {
            console.error("Could not fetch user notifications", error);
        }
    };

    const renderConnectedGoals = (goalsToRender) => {
        elements.connectedGoalsContainer.innerHTML = '';
        if (goalsToRender.length === 0) {
            renderEmptyState(elements.connectedGoalsContainer, 'users-cog', 'No goals match your criteria.');
            return;
        }

        goalsToRender.forEach(goal => {
            const progress = goal.target_amount > 0 ? (parseFloat(goal.current_amount) / parseFloat(goal.target_amount)) * 100 : 0;
            const participantsHTML = goal.participants.map(name => `<span>${name.split(' ')[0]}</span>`).join(', ');
            
            const isOwner = goal.owner_user_id === CURRENT_USER_ID;
            const ownerActions = isOwner ? `
                <button class="action-btn edit-goal-btn" title="Edit Goal"><i class="fas fa-pencil-alt"></i></button>
                <button class="action-btn delete-goal-btn" title="Delete Goal"><i class="fas fa-trash"></i></button>
            ` : '';

            let statusTag = '';
            if (goal.status === 'completed') {
                statusTag = '<span class="goal-status-tag completed">Completed!</span>';
            } else if (goal.status === 'failed') {
                statusTag = '<span class="goal-status-tag failed">Date Passed</span>';
            }
            
            const mainButton = goal.status === 'failed' && isOwner
                ? `<button class="btn btn-primary extend-date-btn">Extend Date</button>`
                : goal.status !== 'completed'
                ? `<button class="btn btn-primary add-fund-btn">Add Funds</button>`
                : '';

            const goalCard = document.createElement('div');
            goalCard.className = `goal-card ${goal.status}`;
            goalCard.dataset.goalId = goal.id;

            goalCard.innerHTML = `
                <div class="goal-card-header">
                    <div>
                        <h3 class="goal-title">${goal.name}</h3>
                        ${statusTag}
                    </div>
                    <div class="goal-actions">
                        ${ownerActions}
                        <button class="action-btn star-goal-btn ${goal.is_starred ? 'starred' : ''}" title="Star Goal"><i class="fas fa-star"></i></button>
                    </div>
                </div>
                <div>
                    <div class="progress-bar-container"><div class="progress-bar" style="width: ${progress > 100 ? 100 : progress}%"></div></div>
                    <div class="amount-info">
                        <span>₹${parseFloat(goal.current_amount).toLocaleString('en-IN')}</span>
                        <span>of ₹${parseFloat(goal.target_amount).toLocaleString('en-IN')}</span>
                    </div>
                </div>
                <div class="goal-card-footer">
                     <div class="goal-participants">With: ${participantsHTML}</div>
                     <div class="goal-main-actions">
                        ${mainButton}
                        <button class="btn btn-secondary view-goal-btn">View</button>
                     </div>
                </div>`;
            elements.connectedGoalsContainer.appendChild(goalCard);
        });
    };

    const applyGoalFiltersAndRender = () => {
        const searchTerm = elements.goalSearchInput.value.toLowerCase();
        const activeFilter = elements.goalFilterTabs.querySelector('.active').dataset.filter;

        const filteredGoals = allConnectedGoals.filter(goal => {
            const matchesSearch = goal.name.toLowerCase().includes(searchTerm);
            const matchesFilter = (activeFilter === 'all') || (goal.status === activeFilter);
            return matchesSearch && matchesFilter;
        });
        renderConnectedGoals(filteredGoals);
    };

    const fetchConnectedGoals = async () => {
        try {
            const goals = await fetchApi(`${API_URL}/connected-goals/list?userId=${CURRENT_USER_ID}`);
            allConnectedGoals = goals; 
            applyGoalFiltersAndRender();
        } catch (error) {
             renderEmptyState(elements.connectedGoalsContainer, 'exclamation-triangle', 'Could not load goals.');
        }
    };
    
    elements.goalSearchInput.addEventListener('input', applyGoalFiltersAndRender);
    elements.goalFilterTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            elements.goalFilterTabs.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            applyGoalFiltersAndRender();
        }
    });

    elements.connectedGoalsContainer.addEventListener('click', async (e) => {
        const goalCard = e.target.closest('.goal-card');
        if (!goalCard) return;
        const goalId = goalCard.dataset.goalId;
        const goal = allConnectedGoals.find(g => g.id == goalId);

        if (e.target.closest('.edit-goal-btn')) {
            modals['edit-goal'].form.dataset.goalId = goalId;
            document.getElementById('edit-goal-name').value = goal.name;
            document.getElementById('edit-goal-target-amount').value = goal.target_amount;
            document.getElementById('edit-goal-target-date').value = new Date(goal.target_date).toISOString().split('T')[0];
            modals['edit-goal'].overlay.classList.add('active');
        }
        else if (e.target.closest('.delete-goal-btn')) {
            const confirmBtn = document.getElementById('confirm-delete-goal-btn');
            confirmBtn.dataset.goalId = goalId;
            modals['delete-goal-confirm'].overlay.classList.add('active');
        }
        else if (e.target.closest('.star-goal-btn')) {
            await fetchApi(`${API_URL}/connected-goals/${goalId}/toggle-star`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID }) });
            fetchConnectedGoals();
        }
        else if (e.target.closest('.add-fund-btn')) {
            modals['add-fund'].form.dataset.goalId = goalId;
            document.getElementById('add-fund-goal-name-p').textContent = `Adding funds to: ${goal.name}`;
            document.getElementById('add-fund-date').valueAsDate = new Date();
            modals['add-fund'].overlay.classList.add('active');
        }
        else if(e.target.closest('.extend-date-btn')) {
            modals['extend-date'].form.dataset.goalId = goalId;
            modals['extend-date'].overlay.classList.add('active');
        }
        else if (e.target.closest('.view-goal-btn')) {
            window.location.href = `connected-goal-details.html?id=${goalId}`;
        }
    });

    modals['edit-goal'].form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const goalId = e.target.dataset.goalId;
        const data = {
            name: document.getElementById('edit-goal-name').value,
            target_amount: document.getElementById('edit-goal-target-amount').value,
            target_date: document.getElementById('edit-goal-target-date').value,
            userId: CURRENT_USER_ID
        };
        await fetchApi(`${API_URL}/connected-goals/${goalId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        showToast('Goal updated successfully!');
        modals['edit-goal'].overlay.classList.remove('active');
        fetchConnectedGoals();
    });
    
    modals['add-fund'].form.addEventListener('submit', async(e) => {
        e.preventDefault();
        const goalId = e.target.dataset.goalId;
        const data = {
            amount: document.getElementById('add-fund-amount').value,
            date: document.getElementById('add-fund-date').value,
            description: document.getElementById('add-fund-description').value,
            type: document.getElementById('add-fund-type').value,
            userId: CURRENT_USER_ID,
        };
        await fetchApi(`${API_URL}/connected-goals/${goalId}/add-fund`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        showToast('Fund updated successfully!');
        modals['add-fund'].overlay.classList.remove('active');
        e.target.reset();
        fetchConnectedGoals();
    });

    modals['extend-date'].form.addEventListener('submit', async(e) => {
        e.preventDefault();
        const goalId = e.target.dataset.goalId;
        const data = {
            new_target_date: document.getElementById('extend-goal-target-date').value,
            userId: CURRENT_USER_ID
        };
        await fetchApi(`${API_URL}/connected-goals/${goalId}/extend-date`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        showToast('Goal date extended!');
        modals['extend-date'].overlay.classList.remove('active');
        e.target.reset();
        fetchConnectedGoals();
    });

    document.getElementById('confirm-delete-goal-btn').addEventListener('click', async (e) => {
        const goalId = e.target.dataset.goalId;
        await fetchApi(`${API_URL}/connected-goals/${goalId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID }) });
        showToast('Goal deleted successfully!', 'error');
        modals['delete-goal-confirm'].overlay.classList.remove('active');
        fetchConnectedGoals();
    });
    
    document.getElementById('show-cid-btn').addEventListener('click', () => {
        document.getElementById('cid-modal-overlay').classList.add('active');
        elements.cidText.textContent = user.cid;
    });
    document.getElementById('close-cid-modal').addEventListener('click', () => document.getElementById('cid-modal-overlay').classList.remove('active'));
    elements.copyCidBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(elements.cidText.textContent).then(() => {
            elements.copyCidBtn.innerHTML = `<i class="fas fa-check"></i> Copied!`;
            setTimeout(() => { elements.copyCidBtn.innerHTML = `<i class="fas fa-copy"></i> Copy CID`; }, 2000);
        });
    });

    document.getElementById('add-connection-btn').addEventListener('click', () => document.getElementById('add-connection-modal-overlay').classList.add('active'));
    document.getElementById('close-add-connection-modal').addEventListener('click', () => {
        document.getElementById('add-connection-modal-overlay').classList.remove('active');
        elements.foundUserContainer.classList.add('hidden');
        elements.addConnectionForm.reset();
    });
    elements.addConnectionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cid = elements.cidInput.value.trim();
        if (!cid) return;
        try {
            const foundUser = await fetchApi(`${API_URL}/connections/find-user`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cid, requesterId: CURRENT_USER_ID }) });
            elements.foundUserContainer.innerHTML = `<div class="request-item"><div class="request-info"><span class="user-name">${foundUser.fullname}</span><span class="user-cid">${foundUser.cid}</span></div><button class="btn btn-primary" id="send-request-btn">Send Request</button></div>`;
            elements.foundUserContainer.classList.remove('hidden');
            document.getElementById('send-request-btn').addEventListener('click', async () => {
                await fetchApi(`${API_URL}/connections/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requesterId: CURRENT_USER_ID, recipientId: foundUser.id }) });
                showToast(`Request sent to ${foundUser.fullname}!`);
                document.getElementById('add-connection-modal-overlay').classList.remove('active');
                elements.foundUserContainer.classList.add('hidden');
                elements.addConnectionForm.reset();
                // No need to fetch requests here, the other user will see it.
            });
        } catch (error) {
            elements.foundUserContainer.innerHTML = `<p style="color: #e74c3c; padding: 10px;">${error.message}</p>`;
            elements.foundUserContainer.classList.remove('hidden');
        }
    });

    document.getElementById('create-connected-goal-btn').addEventListener('click', async () => {
        try {
            const connections = await fetchApi(`${API_URL}/connections/list?userId=${CURRENT_USER_ID}`);
            elements.connectionsCheckboxList.innerHTML = '';
            if (connections.length > 0) {
                connections.forEach(conn => {
                    elements.connectionsCheckboxList.innerHTML += `
                        <label class="connection-checkbox-item">
                            <input type="checkbox" name="participants" value="${conn.id}"> ${conn.fullname}
                        </label>`;
                });
            } else {
                elements.connectionsCheckboxList.innerHTML = '<p>No connections found to invite. Connect with someone first!</p>';
            }
            elements.createGoalModal.classList.add('active');
        } catch (error) {
            showToast('Could not load your connections.', 'error');
        }
    });
    document.getElementById('close-create-goal-modal').addEventListener('click', () => elements.createGoalModal.classList.remove('active'));
    elements.createGoalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectedParticipants = Array.from(e.target.querySelectorAll('input[name="participants"]:checked')).map(cb => cb.value);
        const data = {
            ownerId: CURRENT_USER_ID,
            name: document.getElementById('goal-name').value,
            targetAmount: document.getElementById('goal-target-amount').value,
            targetDate: document.getElementById('goal-target-date').value,
            participants: selectedParticipants
        };
        try {
            await fetchApi(`${API_URL}/connected-goals/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            showToast('Goal invitations sent successfully!');
            elements.createGoalModal.classList.remove('active');
            e.target.reset();
        } catch (error) { /* Handled by fetchApi */ }
    });
    
    elements.requestsContainer.addEventListener('click', async (e) => {
        const target = e.target;
        const requestItem = target.closest('.request-item');
        if (!requestItem) return;
        const requestId = requestItem.dataset.requestId;
        const action = target.classList.contains('btn-accept') ? 'accept' : target.classList.contains('btn-decline') ? 'decline' : null;
        if (!action) return;
        try {
            await fetchApi(`${API_URL}/connections/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID, requestId }) });
            showToast(`Request ${action}ed!`);
            fetchConnectionRequests();
        } catch (error) { /* Handled by fetchApi */ }
    });

    elements.notificationDropdown.addEventListener('click', async (e) => {
        const target = e.target;
        const notificationItem = target.closest('.notification-item');
        if (!notificationItem) return;
        const invitationId = notificationItem.dataset.invitationId;
        const action = target.classList.contains('btn-accept-goal') ? 'accepted' : target.classList.contains('btn-decline-goal') ? 'declined' : null;
        if (!action) return;
        try {
            await fetchApi(`${API_URL}/connected-goals/invitations/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CURRENT_USER_ID, invitationId, action }) });
            showToast(`Invitation ${action}!`);
            fetchGoalInvitations();
            fetchConnectedGoals();
        } catch (error) { /* Handled by fetchApi */ }
    });

    elements.notificationBell.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.notificationBell.classList.toggle('active');
    });
    document.addEventListener('click', () => elements.notificationBell.classList.remove('active'));

    const initialLoad = () => {
        fetchConnectionRequests();
        fetchGoalInvitations();
        fetchConnectedGoals();
        setInterval(fetchUserNotifications, 30000);
        fetchUserNotifications();
    };

    initialLoad();
});
const express = require('express');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const dbPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

dbPool.getConnection().then(conn => {
    console.log('Successfully connected to TiDB Cloud!');
    conn.release();
}).catch(err => console.error('Error connecting to database:', err));

const generateCid = async (fullname) => {
    const base = fullname.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
    let cid, exists;
    do {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        cid = `${base}_${randomNum}`;
        const [rows] = await dbPool.query('SELECT id FROM users WHERE cid = ?', [cid]);
        exists = rows.length > 0;
    } while (exists);
    return cid;
};

const transporter = nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: 587,
    auth: {
        user: 'apikey',
        pass: process.env.EMAIL_SERVICE_API_KEY
    }
});

const createEmailTemplate = (userName, noteTitle, noteContent) => {
    return `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #00A79D; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">Savings Partner Reminder</h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #00A79D;">Hello, ${userName}!</h2>
                <p>This is a reminder for your note titled:</p>
                <div style="background-color: #f4f7fa; padding: 20px; border-radius: 5px; border-left: 4px solid #00A79D;">
                    <h3 style="margin-top: 0;">${noteTitle}</h3>
                    <p style="white-space: pre-wrap;">${noteContent}</p>
                </div>
            </div>
        </div>
    `;
};

const sendPendingReminders = async () => {
    try {
        const sql = `
            SELECT n.id, n.title, n.content, u.email, u.fullname 
            FROM notes n
            JOIN users u ON n.user_id = u.id
            WHERE n.reminder_date = CURDATE() AND n.reminder_sent_at IS NULL
        `;
        const [reminders] = await dbPool.query(sql);

        if (reminders.length > 0) {
            for (const reminder of reminders) {
                const mailOptions = { 
                    from: `"Savings Partner" <${process.env.SENDER_EMAIL}>`, 
                    to: reminder.email, 
                    subject: `Reminder: ${reminder.title}`, 
                    html: createEmailTemplate(reminder.fullname, reminder.title, reminder.content) 
                };
                await transporter.sendMail(mailOptions);
                await dbPool.query('UPDATE notes SET reminder_sent_at = NOW() WHERE id = ?', [reminder.id]);
            }
        }
    } catch (error) {
        console.error('Error during sendPendingReminders:', error);
    }
};

// cron.schedule('*/15 * * * *', sendPendingReminders);
// cron.schedule('0 8 * * *', sendPendingReminders);

// --- AUTHENTICATION ---

app.post('/api/signup', async (req, res) => {
    try {
        const { fullname, phone, email, password } = req.body;
        if (!fullname || !email || !password || !phone) return res.status(400).json({ message: 'Please fill all fields.' });
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const cid = await generateCid(fullname);
        const sql = 'INSERT INTO users (fullname, phone, email, password_hash, cid, role) VALUES (?, ?, ?, ?, ?, ?)';
        await dbPool.query(sql, [fullname, phone, email, password_hash, cid, 'user']);
        res.status(201).json({ message: 'User created successfully!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email or CID already exists.' });
        res.status(500).json({ message: 'Server error during sign up.' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Please provide email and password.' });
        const sql = 'SELECT * FROM users WHERE email = ?';
        const [rows] = await dbPool.query(sql, [email]);
        if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials.' });
        let user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });
        
        let cid = user.cid;
        if (!cid) {
            cid = await generateCid(user.fullname);
            await dbPool.query('UPDATE users SET cid = ? WHERE id = ?', [cid, user.id]);
        }
        
        const userPayload = {
            id: user.id,
            fullname: user.fullname,
            cid: cid,
            role: user.role || 'user'
        };
        res.status(200).json({ message: 'Login successful!', user: userPayload });
    } catch (error) {
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// --- ADMIN ROUTES ---

app.get('/api/admin/users', async (req, res) => {
    try {
        const [users] = await dbPool.query("SELECT id, fullname, email, cid, created_at FROM users WHERE role != 'admin' ORDER BY created_at DESC");
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching users.' });
    }
});

app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await dbPool.query('DELETE FROM users WHERE id = ?', [id]);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Server error deleting user.' });
    }
});

// --- DASHBOARD ---

app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ message: 'User ID is required.' });

        const [balanceResult] = await dbPool.query('SELECT SUM(CASE WHEN type = "income" THEN amount ELSE -amount END) as totalBalance FROM transactions WHERE user_id = ?', [userId]);
        const [incomeResult] = await dbPool.query('SELECT SUM(amount) as monthlyIncome FROM transactions WHERE user_id = ? AND type = "income" AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)', [userId]);
        const [expenseResult] = await dbPool.query('SELECT SUM(amount) as monthlyExpense FROM transactions WHERE user_id = ? AND type = "expense" AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)', [userId]);
        const [goalsResult] = await dbPool.query('SELECT COUNT(*) as activeGoals FROM goals WHERE user_id = ? AND status = "active"', [userId]);
        
        res.json({
            totalBalance: balanceResult[0].totalBalance || 0,
            monthlyIncome: incomeResult[0].monthlyIncome || 0,
            monthlyExpense: expenseResult[0].monthlyExpense || 0,
            activeGoals: goalsResult[0].activeGoals || 0
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching dashboard stats.' });
    }
});

// --- TRANSACTIONS ---

app.get('/api/transactions', async (req, res) => { 
    try { 
        const { userId, type, days, search } = req.query; 
        let sql = 'SELECT * FROM transactions WHERE user_id = ?'; 
        const params = [userId]; 
        if (type && (type === 'income' || type === 'expense')) { sql += ' AND type = ?'; params.push(type); } 
        if (days && days !== 'all') { sql += ' AND transaction_date >= CURDATE() - INTERVAL ? DAY'; params.push(parseInt(days));} 
        if (search) { sql += ' AND (category LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
        sql += ' ORDER BY transaction_date DESC, id DESC'; 
        const [transactions] = await dbPool.query(sql, params); 
        res.status(200).json(transactions); 
    } catch (error) { res.status(500).json({ message: 'Server error.' }); } 
});

app.post('/api/transactions', async (req, res) => { 
    try { 
        const { userId, type, amount, category, date, description } = req.body; 
        const transactionData = { user_id: userId, type, amount, category, transaction_date: date, description }; 
        const [result] = await dbPool.query('INSERT INTO transactions SET ?', transactionData); 
        res.status(201).json({ message: 'Added!', id: result.insertId }); 
    } catch (error) { res.status(500).json({ message: 'Server error.' }); } 
});

app.delete('/api/transactions', async (req, res) => { 
    try { 
        const { userId, ids } = req.body; 
        await dbPool.query('DELETE FROM transactions WHERE id IN (?) AND user_id = ?', [ids, userId]); 
        res.status(200).json({ message: 'Deleted successfully.' }); 
    } catch (error) { res.status(500).json({ message: 'Server error.' }); } 
});

// --- NOTES ---

app.get('/api/notes', async (req, res) => { 
    try { 
        const { userId, search } = req.query; 
        let sql = 'SELECT id, user_id, title, content, reminder_date, is_important, password_hash IS NOT NULL AS is_locked FROM notes WHERE user_id = ?'; 
        const params = [userId]; 
        if (search) { sql += ' AND (title LIKE ? OR content LIKE ?)'; params.push(`%${search}%`, `%${search}%`); } 
        sql += ' ORDER BY created_at DESC'; 
        const [notes] = await dbPool.query(sql, params); 
        res.status(200).json(notes); 
    } catch (error) { res.status(500).json({ message: 'Error fetching notes.' }); } 
});

app.post('/api/notes', async (req, res) => { 
    try { 
        const { userId, title, content, reminder_date } = req.body; 
        await dbPool.query('INSERT INTO notes (user_id, title, content, reminder_date) VALUES (?, ?, ?, ?)', [userId, title, content, reminder_date || null]); 
        res.status(201).json({ message: 'Note created!' }); 
    } catch (error) { res.status(500).json({ message: 'Error creating note.' }); } 
});

app.put('/api/notes/:id', async (req, res) => { 
    try { 
        const { id } = req.params; 
        const { userId, title, content, reminder_date } = req.body; 
        await dbPool.query('UPDATE notes SET title = ?, content = ?, reminder_date = ? WHERE id = ? AND user_id = ?', [title, content, reminder_date || null, id, userId]); 
        res.status(200).json({ message: 'Note updated!' }); 
    } catch (error) { res.status(500).json({ message: 'Error updating note.' }); } 
});

app.delete('/api/notes/:id', async (req, res) => { 
    try { 
        const { id } = req.params; 
        const { userId } = req.body; 
        await dbPool.query('DELETE FROM notes WHERE id = ? AND user_id = ?', [id, userId]); 
        res.status(200).json({ message: 'Note deleted.' }); 
    } catch (error) { res.status(500).json({ message: 'Error deleting note.' }); } 
});

app.put('/api/notes/:id/toggle-important', async (req, res) => { 
    try { 
        const { id } = req.params; 
        const { userId } = req.body; 
        await dbPool.query('UPDATE notes SET is_important = NOT is_important WHERE id = ? AND user_id = ?', [id, userId]); 
        res.status(200).json({ message: 'Toggled.' }); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.put('/api/notes/:id/set-password', async (req, res) => { 
    try { 
        const { id } = req.params; 
        const { userId, password } = req.body; 
        const salt = await bcrypt.genSalt(10); 
        const password_hash = await bcrypt.hash(password, salt); 
        await dbPool.query('UPDATE notes SET password_hash = ? WHERE id = ? AND user_id = ?', [password_hash, id, userId]); 
        res.status(200).json({ message: 'Password set.' }); 
    } catch (error) { res.status(500).json({ message: 'Error setting password.' }); } 
});

app.post('/api/notes/:id/verify-password', async (req, res) => { 
    try { 
        const { id } = req.params; 
        const { userId, password } = req.body; 
        const [rows] = await dbPool.query('SELECT * FROM notes WHERE id = ? AND user_id = ?', [id, userId]); 
        if (rows.length === 0) return res.status(404).json({ message: 'Note not found.' }); 
        const note = rows[0]; 
        const isMatch = await bcrypt.compare(password, note.password_hash); 
        if (!isMatch) return res.status(401).json({ message: 'Invalid password.' }); 
        delete note.password_hash; 
        res.status(200).json({ success: true, note: note }); 
    } catch (error) { res.status(500).json({ message: 'Error verifying.' }); } 
});

// --- GOALS ---

app.post('/api/goals', async (req, res) => { 
    try { 
        const { userId, name, target_amount, target_date } = req.body; 
        await dbPool.query('INSERT INTO goals SET ?', { user_id: userId, name, target_amount, target_date }); 
        res.status(201).json({ message: 'Goal created!' }); 
    } catch (error) { res.status(500).json({ message: 'Error creating goal.' }); } 
});

app.get('/api/goals', async (req, res) => { 
    try { 
        const { userId } = req.query; 
        await dbPool.query('UPDATE goals SET status = "failed" WHERE target_date < CURDATE() AND status = "active" AND current_amount < target_amount'); 
        const [goals] = await dbPool.query('SELECT * FROM goals WHERE user_id = ? ORDER BY is_important DESC, created_at DESC', [userId]); 
        res.status(200).json(goals); 
    } catch (error) { res.status(500).json({ message: 'Error fetching goals.' }); } 
});

app.get('/api/goals/stats', async (req, res) => { 
    try { 
        const { userId } = req.query; 
        const [stats] = await dbPool.query('SELECT status, COUNT(*) as count FROM goals WHERE user_id = ? GROUP BY status', [userId]); 
        const result = { total: 0, active: 0, completed: 0, failed: 0 }; 
        stats.forEach(s => { result[s.status] = s.count; result.total += s.count; }); 
        res.status(200).json(result); 
    } catch (error) { res.status(500).json({ message: 'Error fetching stats.' }); } 
});

app.get('/api/goals/:id', async (req, res) => { 
    try { 
        const { id } = req.params; 
        const { userId } = req.query; 
        const [rows] = await dbPool.query('SELECT * FROM goals WHERE id = ? AND user_id = ?', [id, userId]); 
        res.status(200).json(rows[0]); 
    } catch (error) { res.status(500).json({ message: 'Error fetching goal.' }); } 
});

app.put('/api/goals/:id', async (req, res) => { 
    try { 
        const { id } = req.params; 
        const { userId, name, target_amount, target_date } = req.body; 
        await dbPool.query('UPDATE goals SET name = ?, target_amount = ?, target_date = ? WHERE id = ? AND user_id = ?', [name, target_amount, target_date, id, userId]); 
        res.status(200).json({ message: 'Goal updated!' }); 
    } catch (error) { res.status(500).json({ message: 'Error updating goal.' }); } 
});

app.delete('/api/goals/:id', async (req, res) => { 
    try { 
        const { id } = req.params; 
        const { userId } = req.body; 
        await dbPool.query('DELETE FROM goals WHERE id = ? AND user_id = ?', [id, userId]); 
        res.status(204).send(); 
    } catch (error) { res.status(500).json({ message: 'Error deleting goal.' }); } 
});

app.post('/api/goals/:id/add-fund', async (req, res) => { 
    const connection = await dbPool.getConnection(); 
    try { 
        await connection.beginTransaction(); 
        const { id } = req.params; 
        const { userId, amount, transaction_date, description } = req.body; 
        await connection.query('INSERT INTO goal_transactions (goal_id, user_id, amount, transaction_date, description) VALUES (?, ?, ?, ?, ?)', [id, userId, amount, transaction_date, description]); 
        await connection.query('UPDATE goals SET current_amount = current_amount + ? WHERE id = ?', [amount, id]); 
        const [goals] = await connection.query('SELECT current_amount, target_amount FROM goals WHERE id = ?', [id]); 
        if (goals[0].current_amount >= goals[0].target_amount) { await connection.query('UPDATE goals SET status = "completed" WHERE id = ?', [id]); } 
        await connection.commit(); 
        res.status(200).json({ message: 'Fund added!' }); 
    } catch (error) { 
        await connection.rollback(); 
        res.status(500).json({ message: 'Error adding fund.' }); 
    } finally { connection.release(); } 
});

app.get('/api/goals/:id/transactions', async (req, res) => { 
    try { 
        const { id } = req.params; 
        const { userId } = req.query; 
        const [transactions] = await dbPool.query('SELECT * FROM goal_transactions WHERE goal_id = ? AND user_id = ? ORDER BY transaction_date DESC', [id, userId]); 
        res.status(200).json(transactions); 
    } catch (error) { res.status(500).json({ message: 'Error fetching transactions.' }); } 
});

app.put('/api/goals/:id/toggle-important', async (req, res) => { 
    try { 
        const { id } = req.params; 
        const { userId } = req.body; 
        await dbPool.query('UPDATE goals SET is_important = NOT is_important WHERE id = ? AND user_id = ?', [id, userId]); 
        res.status(200).json({ message: 'Toggled.' }); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.put('/api/goals/:id/extend-date', async (req, res) => { 
    try { 
        const { id } = req.params; 
        const { userId, new_target_date } = req.body; 
        await dbPool.query('UPDATE goals SET target_date = ?, status = "active" WHERE id = ? AND user_id = ? AND status = "failed"', [new_target_date, id, userId]); 
        res.status(200).json({ message: 'Extended!' }); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

// --- CONNECTIONS ---

app.get('/api/user/cid', async (req, res) => { 
    try { 
        const { userId } = req.query; 
        const [rows] = await dbPool.query('SELECT cid FROM users WHERE id = ?', [userId]); 
        res.json({ cid: rows[0].cid }); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.post('/api/connections/find-user', async (req, res) => { 
    try { 
        const { cid, requesterId } = req.body; 
        const [rows] = await dbPool.query('SELECT id, fullname, cid FROM users WHERE cid = ? AND id != ?', [cid, requesterId]); 
        if (rows.length === 0) return res.status(404).json({ message: 'User not found.' }); 
        res.json(rows[0]); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.post('/api/connections/request', async (req, res) => { 
    try { 
        const { requesterId, recipientId } = req.body; 
        await dbPool.query('INSERT INTO connections (user_one_id, user_two_id, status, action_user_id) VALUES (?, ?, ?, ?)', [requesterId, recipientId, 'pending', requesterId]); 
        res.status(201).json({ message: 'Request sent!' }); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.get('/api/connections/requests', async (req, res) => { 
    try { 
        const { userId } = req.query; 
        const [requests] = await dbPool.query(`SELECT c.id, u.fullname, u.cid FROM connections c JOIN users u ON c.user_one_id = u.id WHERE c.user_two_id = ? AND c.status = 'pending'`, [userId]); 
        res.json(requests); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.post('/api/connections/accept', async (req, res) => { 
    try { 
        const { userId, requestId } = req.body; 
        await dbPool.query("UPDATE connections SET status = 'connected' WHERE id = ? AND user_two_id = ?", [requestId, userId]); 
        res.json({ message: 'Accepted!' }); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.post('/api/connections/decline', async (req, res) => { 
    try { 
        const { userId, requestId } = req.body; 
        await dbPool.query("DELETE FROM connections WHERE id = ? AND user_two_id = ?", [requestId, userId]); 
        res.json({ message: 'Declined.' }); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.get('/api/connections/list', async (req, res) => { 
    try { 
        const { userId } = req.query; 
        const [connections] = await dbPool.query(`SELECT u.id, u.fullname FROM connections c JOIN users u ON u.id = IF(c.user_one_id = ?, c.user_two_id, c.user_one_id) WHERE (c.user_one_id = ? OR c.user_two_id = ?) AND c.status = 'connected'`, [userId, userId, userId]); 
        res.json(connections); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

// --- CONNECTED GOALS ---

app.post('/api/connected-goals/create', async (req, res) => { 
    const connection = await dbPool.getConnection(); 
    try { 
        await connection.beginTransaction(); 
        const { ownerId, name, targetAmount, targetDate, participants } = req.body; 
        const [goalResult] = await connection.query('INSERT INTO connected_goals (owner_user_id, name, target_amount, target_date) VALUES (?, ?, ?, ?)', [ownerId, name, targetAmount, targetDate]); 
        const goalId = goalResult.insertId; 
        await connection.query('INSERT INTO connected_goal_participants (goal_id, user_id, status) VALUES (?, ?, ?)', [goalId, ownerId, 'accepted']); 
        if (participants && participants.length > 0) { 
            const participantValues = participants.map(userId => [goalId, userId, 'pending']); 
            await connection.query('INSERT INTO connected_goal_participants (goal_id, user_id, status) VALUES ?', [participantValues]); 
        } 
        await connection.commit(); 
        res.status(201).json({ message: 'Goal created!', goalId }); 
    } catch (error) { 
        await connection.rollback(); 
        res.status(500).json({ message: 'Error.' }); 
    } finally { connection.release(); } 
});

app.get('/api/connected-goals/invitations', async (req, res) => { 
    try { 
        const { userId } = req.query; 
        const [invitations] = await dbPool.query(`SELECT cgp.id as invitation_id, cg.id as goal_id, cg.name as goal_name, u.fullname as invited_by FROM connected_goal_participants cgp JOIN connected_goals cg ON cgp.goal_id = cg.id JOIN users u ON cg.owner_user_id = u.id WHERE cgp.user_id = ? AND cgp.status = 'pending'`, [userId]); 
        res.json(invitations); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.post('/api/connected-goals/invitations/respond', async (req, res) => { 
    try { 
        const { userId, invitationId, action } = req.body; 
        await dbPool.query('UPDATE connected_goal_participants SET status = ? WHERE id = ? AND user_id = ?', [action, invitationId, userId]); 
        res.json({ message: `Invitation ${action}!` }); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.get('/api/connected-goals/list', async (req, res) => { 
    try { 
        const { userId } = req.query; 
        const [goals] = await dbPool.query(`SELECT cg.id, cg.name, cg.target_amount, cg.current_amount, cg.target_date, cg.owner_user_id, CASE WHEN cg.current_amount >= cg.target_amount THEN 'completed' WHEN cg.target_date < CURDATE() THEN 'failed' ELSE 'active' END as status, CASE WHEN cgs.user_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_starred FROM connected_goals cg JOIN connected_goal_participants cgp ON cg.id = cgp.goal_id LEFT JOIN connected_goal_stars cgs ON cg.id = cgs.goal_id AND cgs.user_id = ? WHERE cgp.user_id = ? AND cgp.status = 'accepted' ORDER BY is_starred DESC, cg.created_at DESC`, [userId, userId]); 
        const goalsWithParticipants = await Promise.all(goals.map(async (goal) => { 
            const [participants] = await dbPool.query(`SELECT u.fullname FROM connected_goal_participants cgp JOIN users u ON cgp.user_id = u.id WHERE cgp.goal_id = ? AND cgp.status = 'accepted'`, [goal.id]); 
            return { ...goal, participants: participants.map(p => p.fullname) }; 
        })); 
        res.json(goalsWithParticipants); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.get('/api/connected-goals/:id', async (req, res) => { 
    try { 
        const { id } = req.params; 
        const [rows] = await dbPool.query('SELECT * FROM connected_goals WHERE id = ?', [id]); 
        res.json(rows[0]); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.put('/api/connected-goals/:id', async (req, res) => { 
    try { 
        const { id } = req.params; 
        const { name, target_amount, target_date, userId } = req.body; 
        await dbPool.query('UPDATE connected_goals SET name = ?, target_amount = ?, target_date = ? WHERE id = ? AND owner_user_id = ?', [name, target_amount, target_date, id, userId]); 
        res.json({ message: 'Updated!' }); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.delete('/api/connected-goals/:id', async (req, res) => { 
    try { 
        const { id } = req.params; 
        const { userId } = req.body; 
        await dbPool.query('DELETE FROM connected_goals WHERE id = ? AND owner_user_id = ?', [id, userId]); 
        res.status(204).send(); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.post('/api/connected-goals/:id/toggle-star', async (req, res) => { 
    try { 
        const { id } = req.params; 
        const { userId } = req.body; 
        const [existing] = await dbPool.query('SELECT * FROM connected_goal_stars WHERE user_id = ? AND goal_id = ?', [userId, id]); 
        if (existing.length > 0) { 
            await dbPool.query('DELETE FROM connected_goal_stars WHERE user_id = ? AND goal_id = ?', [userId, id]); 
        } else { 
            await dbPool.query('INSERT INTO connected_goal_stars (user_id, goal_id) VALUES (?, ?)', [userId, id]); 
        } 
        res.json({ message: 'Star toggled.' }); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.post('/api/connected-goals/:id/add-fund', async (req, res) => { 
    const connection = await dbPool.getConnection(); 
    try { 
        await connection.beginTransaction(); 
        const { id } = req.params; 
        const { userId, amount, date, description, type } = req.body; 
        const finalAmount = type === 'expense' ? -Math.abs(amount) : Math.abs(amount); 
        await connection.query('INSERT INTO connected_goal_transactions (goal_id, user_id, amount, transaction_date, description) VALUES (?, ?, ?, ?, ?)', [id, userId, finalAmount, date, description]); 
        await connection.query('UPDATE connected_goals SET current_amount = current_amount + ? WHERE id = ?', [finalAmount, id]); 
        await connection.commit(); 
        res.json({ message: 'Fund updated!' }); 
    } catch (error) { 
        await connection.rollback(); 
        res.status(500).json({ message: 'Error.' }); 
    } finally { connection.release(); } 
});

app.post('/api/connected-goals/:id/extend-date', async(req, res) => { 
    try { 
        const { id } = req.params; 
        const { new_target_date, userId } = req.body; 
        await dbPool.query('UPDATE connected_goals SET target_date = ? WHERE id = ? AND owner_user_id = ?', [new_target_date, id, userId]); 
        res.json({ message: 'Extended!' }); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.get('/api/connected-goals/:id/transactions', async (req, res) => { 
    try { 
        const { id } = req.params; 
        const [transactions] = await dbPool.query(`SELECT cgt.*, u.fullname FROM connected_goal_transactions cgt JOIN users u ON cgt.user_id = u.id WHERE cgt.goal_id = ? ORDER BY cgt.transaction_date DESC`, [id]); 
        res.json(transactions); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.get('/api/connected-goals/:id/contributions', async (req, res) => { 
    try { 
        const { id } = req.params; 
        const [contributions] = await dbPool.query(`SELECT u.fullname, SUM(cgt.amount) as total_contribution FROM connected_goal_transactions cgt JOIN users u ON cgt.user_id = u.id WHERE cgt.goal_id = ? GROUP BY cgt.user_id ORDER BY total_contribution DESC`, [id]); 
        res.json(contributions); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

// --- SETTINGS & NOTIFICATIONS ---

app.get('/api/notifications', async (req, res) => { 
    try { 
        const { userId } = req.query; 
        const [notifications] = await dbPool.query('SELECT id, message FROM notifications WHERE user_id = ? AND is_read = FALSE', [userId]); 
        res.json(notifications); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.post('/api/notifications/mark-read', async (req, res) => { 
    try { 
        const { notificationIds } = req.body; 
        await dbPool.query('UPDATE notifications SET is_read = TRUE WHERE id IN (?)', [notificationIds]); 
        res.status(204).send(); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.put('/api/user/profile', async (req, res) => { 
    try { 
        const { userId, fullname, cid } = req.body; 
        await dbPool.query('UPDATE users SET fullname = ?, cid = ? WHERE id = ?', [fullname, cid, userId]); 
        res.json({ message: 'Updated!' }); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.post('/api/user/change-password', async (req, res) => { 
    try { 
        const { userId, oldPassword, newPassword } = req.body; 
        const [rows] = await dbPool.query('SELECT password_hash FROM users WHERE id = ?', [userId]); 
        const isMatch = await bcrypt.compare(oldPassword, rows[0].password_hash); 
        if(!isMatch) return res.status(401).json({message:'Wrong password'}); 
        const salt = await bcrypt.genSalt(10); 
        const hash = await bcrypt.hash(newPassword, salt); 
        await dbPool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]); 
        res.json({ message: 'Changed!' }); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.get('/api/settings/connections', async (req, res) => { 
    try { 
        const { userId } = req.query; 
        const [connections] = await dbPool.query(`SELECT c.id as connection_id, u.fullname, u.cid FROM connections c JOIN users u ON u.id = IF(c.user_one_id = ?, c.user_two_id, c.user_one_id) WHERE (c.user_one_id = ? OR c.user_two_id = ?) AND c.status = 'connected'`, [userId, userId, userId]); 
        res.json(connections); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.post('/api/settings/disconnect', async (req, res) => { 
    try { 
        const { userId, connectionId } = req.body; 
        await dbPool.query('DELETE FROM connections WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)', [connectionId, userId, userId]); 
        res.status(204).send(); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.get('/api/settings/connected-goals', async (req, res) => { 
    try { 
        const { userId } = req.query; 
        const [goals] = await dbPool.query(`SELECT cg.id, cg.name FROM connected_goals cg JOIN connected_goal_participants cgp ON cg.id = cgp.goal_id WHERE cgp.user_id = ? AND cgp.status = 'accepted'`, [userId]); 
        res.json(goals); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.post('/api/settings/leave-goal', async (req, res) => { 
    try { 
        const { userId, goalId } = req.body; 
        const [res] = await dbPool.query('DELETE FROM connected_goal_participants WHERE goal_id = ? AND user_id = ? AND goal_id NOT IN (SELECT id FROM connected_goals WHERE owner_user_id = ?)', [goalId, userId, userId]); 
        if(res.affectedRows === 0) return res.status(403).json({message:'Owner cannot leave.'}); 
        res.status(204).send(); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.get('/api/settings/locked-notes', async (req, res) => { 
    try { 
        const { userId } = req.query; 
        const [notes] = await dbPool.query('SELECT id, title FROM notes WHERE user_id = ? AND password_hash IS NOT NULL', [userId]); 
        res.json(notes); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

app.post('/api/settings/remove-note-password', async (req, res) => { 
    try { 
        const { userId, noteId } = req.body; 
        await dbPool.query('UPDATE notes SET password_hash = NULL WHERE id = ? AND user_id = ?', [noteId, userId]); 
        res.status(204).send(); 
    } catch (error) { res.status(500).json({ message: 'Error.' }); } 
});

// --- ACCOUNTS & LEDGERS ---

app.post('/api/accounts', async (req, res) => {
    try {
        const { userId, account_type, name, company_name, phone_number, account_number, upi_id } = req.body;
        const sql = 'INSERT INTO accounts (user_id, account_type, name, company_name, phone_number, account_number, upi_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
        const [result] = await dbPool.query(sql, [userId, account_type, name, company_name, phone_number, account_number, upi_id]);
        res.status(201).json({ id: result.insertId, message: 'Account created successfully!' });
    } catch (error) { res.status(500).json({ message: 'Server error creating account.' }); }
});

app.get('/api/accounts', async (req, res) => {
    try {
        const { userId } = req.query;
        const [accounts] = await dbPool.query('SELECT * FROM accounts WHERE user_id = ? ORDER BY name ASC', [userId]);
        res.json(accounts);
    } catch (error) { res.status(500).json({ message: 'Server error fetching accounts.' }); }
});

app.get('/api/accounts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query;
        const [account] = await dbPool.query('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [id, userId]);
        if (account.length === 0) return res.status(404).json({ message: 'Account not found.' });
        res.json(account[0]);
    } catch (error) { res.status(500).json({ message: 'Server error fetching account details.' }); }
});

app.put('/api/accounts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, name, company_name, phone_number, account_number, upi_id } = req.body;
        const sql = 'UPDATE accounts SET name = ?, company_name = ?, phone_number = ?, account_number = ?, upi_id = ? WHERE id = ? AND user_id = ?';
        const [result] = await dbPool.query(sql, [name, company_name, phone_number, account_number, upi_id, id, userId]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Account not found or authorized.' });
        res.json({ message: 'Account updated successfully!' });
    } catch (error) { res.status(500).json({ message: 'Server error updating account.' }); }
});

app.delete('/api/accounts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        const sql = 'DELETE FROM accounts WHERE id = ? AND user_id = ?';
        const [result] = await dbPool.query(sql, [id, userId]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Account not found.' });
        res.status(204).send();
    } catch (error) { res.status(500).json({ message: 'Server error deleting account.' }); }
});

app.post('/api/ledgers', async (req, res) => {
    try {
        const { accountId, userId, name, ledger_date } = req.body;
        const sql = 'INSERT INTO ledgers (account_id, user_id, name, ledger_date) VALUES (?, ?, ?, ?)';
        const [result] = await dbPool.query(sql, [accountId, userId, name, ledger_date]);
        res.status(201).json({ id: result.insertId, message: 'Ledger created successfully!' });
    } catch (error) { res.status(500).json({ message: 'Server error creating ledger.' }); }
});

app.get('/api/ledgers', async (req, res) => {
    try {
        const { accountId, userId } = req.query;
        const [ledgers] = await dbPool.query('SELECT * FROM ledgers WHERE account_id = ? AND user_id = ? ORDER BY ledger_date DESC', [accountId, userId]);
        res.json(ledgers);
    } catch (error) { res.status(500).json({ message: 'Server error fetching ledgers.' }); }
});

app.get('/api/ledgers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query;
        const sql = `SELECT l.id, l.account_id, l.name, l.ledger_date, a.name as account_name, a.account_type FROM ledgers l JOIN accounts a ON l.account_id = a.id WHERE l.id = ? AND l.user_id = ?`;
        const [ledger] = await dbPool.query(sql, [id, userId]);
        if (ledger.length === 0) return res.status(404).json({ message: 'Ledger not found.' });
        res.json(ledger[0]);
    } catch (error) { res.status(500).json({ message: 'Server error fetching ledger details.' }); }
});

app.put('/api/ledgers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, name, ledger_date } = req.body;
        const sql = 'UPDATE ledgers SET name = ?, ledger_date = ? WHERE id = ? AND user_id = ?';
        const [result] = await dbPool.query(sql, [name, ledger_date, id, userId]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Ledger not found.' });
        res.json({ message: 'Ledger updated successfully!' });
    } catch (error) { res.status(500).json({ message: 'Server error updating ledger.' }); }
});

app.delete('/api/ledgers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        const sql = 'DELETE FROM ledgers WHERE id = ? AND user_id = ?';
        const [result] = await dbPool.query(sql, [id, userId]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Ledger not found.' });
        res.status(204).send();
    } catch (error) { res.status(500).json({ message: 'Server error deleting ledger.' }); }
});

app.post('/api/ledger-entries', async (req, res) => {
    try {
        const { ledger_id, user_id, bill_no, entry_date, description, quantity, total_amount, paid_amount, payment_type } = req.body;
        const sql = 'INSERT INTO ledger_entries (ledger_id, user_id, bill_no, entry_date, description, quantity, total_amount, paid_amount, payment_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
        await dbPool.query(sql, [ledger_id, user_id, bill_no, entry_date, description, quantity, total_amount, paid_amount, payment_type]);
        res.status(201).json({ message: 'Entry added successfully!' });
    } catch (error) { res.status(500).json({ message: 'Server error adding entry.' }); }
});

app.get('/api/ledger-entries', async (req, res) => {
    try {
        const { ledgerId, userId } = req.query;
        const sql = 'SELECT * FROM ledger_entries WHERE ledger_id = ? AND user_id = ? ORDER BY entry_date DESC';
        const [entries] = await dbPool.query(sql, [ledgerId, userId]);
        res.json(entries);
    } catch (error) { res.status(500).json({ message: 'Server error fetching entries.' }); }
});

app.put('/api/ledger-entries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, bill_no, entry_date, description, quantity, total_amount, paid_amount, payment_type } = req.body;
        const sql = 'UPDATE ledger_entries SET bill_no = ?, entry_date = ?, description = ?, quantity = ?, total_amount = ?, paid_amount = ?, payment_type = ? WHERE id = ? AND user_id = ?';
        const [result] = await dbPool.query(sql, [bill_no, entry_date, description, quantity, total_amount, paid_amount, payment_type, id, userId]);
        if(result.affectedRows === 0) return res.status(404).json({message: 'Entry not found.'});
        res.json({ message: 'Entry updated successfully!' });
    } catch (error) { res.status(500).json({ message: 'Server error updating entry.' }); }
});

app.delete('/api/ledger-entries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        const sql = 'DELETE FROM ledger_entries WHERE id = ? AND user_id = ?';
        const [result] = await dbPool.query(sql, [id, userId]);
        if(result.affectedRows === 0) return res.status(404).json({message: 'Entry not found.'});
        res.status(204).send();
    } catch (error) { res.status(500).json({ message: 'Server error deleting entry.' }); }
});

// Export the app for Vercel
module.exports = app;

// Only listen if running locally (Not in Vercel)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}
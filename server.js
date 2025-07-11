import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

        
dotenv.config();

console.log('\n--- Environment Variables Check ---');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '******** (masked)' : 'NOT SET or EMPTY');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('-----------------------------------\n');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

let db;
async function connectToDatabase() {
    try {
        db = await mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        console.log('Connected to MySQL database via pool.');

        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                fullName VARCHAR(255) NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Users table checked/created.');

        await db.query(`
            CREATE TABLE IF NOT EXISTS expenses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                userId INT NOT NULL,
                expenseName VARCHAR(255) NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                date DATE NOT NULL,
                description TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Expenses table checked/created.');

    } catch (err) {
        console.error('Error connecting to MySQL database or creating tables:', err.message);
        process.exit(1);
    }
}

connectToDatabase();

app.use((req, res, next) => {
    req.cookies = {};
    if (req.headers.cookie) {
        req.headers.cookie.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            req.cookies[parts[0].trim()] = parts[1];
        });
    }
    next();
});

const authenticateToken = (req, res, next) => {
    const token = req.cookies && req.cookies.authToken;

    if (!token) {
        return res.redirect('/login?message=Please log in to access this page.');
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            res.clearCookie('authToken');
            return res.redirect('/login?message=Session expired. Please log in again.');
        }
        req.user = user;
        next();
    });
};

app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    res.render('login', { message: req.query.message, username: undefined });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];

        if (!user) {
            return res.status(400).json({ message: 'Invalid username or password.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid username or password.' });
        }

        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        
        res.cookie('authToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 3600000
        });

        res.status(200).json({ message: 'Login successful!', redirectUrl: '/dashboard' });
    } catch (error) {
        console.error('Error during login:', error.message);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.get('/register', (req, res) => {
    res.render('register', { message: req.query.message, username: undefined });
});

app.post('/api/register', async (req, res) => {
    const { username, password, email, fullName } = req.body;
    if (!username || !password || !email || !fullName) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO users (username, password, email, fullName) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, email, fullName]
        );
        res.status(201).json({ message: 'User registered successfully!', redirectUrl: '/login' });
    } catch (error) {
        console.error('Error during registration:', error.message);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Username or Email already exists.' });
        }
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('authToken');
    res.redirect('/login?message=Logged out successfully!');
});

app.get('/dashboard', authenticateToken, (req, res) => {
    res.render('dashboard', { username: req.user.username });
});

app.get('/expenses/add', authenticateToken, (req, res) => {
    res.render('addExpense', { message: req.query.message, username: req.user.username });
});

app.post('/api/expenses', authenticateToken, async (req, res) => {
    const { expenseName, amount, date, description } = req.body;
    const userId = req.user.userId;

    if (!expenseName || !amount || !date) {
        return res.status(400).json({ message: 'Expense name, amount, and date are required.' });
    }

    try {
        const [result] = await db.query('INSERT INTO expenses (userId, expenseName, amount, date, description) VALUES (?, ?, ?, ?, ?)',
            [userId, expenseName, amount, date, description]
        );
        res.status(201).json({ message: 'Expense added successfully!', expenseId: result.insertId, redirectUrl: '/expenses?message=Expense added successfully!' });
    } catch (error) {
        console.error('Error adding expense:', error.message);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.get('/expenses', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const [rows] = await db.query('SELECT * FROM expenses WHERE userId = ? ORDER BY date DESC', [userId]);
        res.render('expenseList', { expenses: rows, message: req.query.message, username: req.user.username });
    } catch (error) {
        console.error('Error fetching expenses:', error.message);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.get('/expenses/edit/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const [rows] = await db.query('SELECT * FROM expenses WHERE id = ? AND userId = ?', [id, userId]);
        const expense = rows[0];

        if (!expense) {
            return res.redirect('/expenses?message=Expense not found or not authorized.&type=error');
        }
        res.render('updateExpense', { expense: expense, message: req.query.message, username: req.user.username });
    } catch (error) {
        console.error('Error fetching expense for edit:', error.message);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.put('/api/expenses/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { expenseName, amount, date, description } = req.body;
    const userId = req.user.userId;

    if (!expenseName || !amount || !date) {
        return res.status(400).json({ message: 'Expense name, amount, and date are required.' });
    }

    try {
        const [result] = await db.query('UPDATE expenses SET expenseName = ?, amount = ?, date = ?, description = ? WHERE id = ? AND userId = ?',
            [expenseName, amount, date, description, id, userId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Expense not found or not authorized.' });
        }
        res.status(200).json({ message: 'Expense updated successfully!', redirectUrl: '/expenses?message=Expense updated successfully!' });
    } catch (error) {
        console.error('Error updating expense:', error.message);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.delete('/api/expenses/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const [result] = await db.query('DELETE FROM expenses WHERE id = ? AND userId = ?', [id, userId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Expense not found or not authorized.' });
        }
        res.status(200).json({ message: 'Expense deleted successfully!' });
    } catch (error) {
        console.error('Error deleting expense:', error.message);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

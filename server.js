const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'social-media-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Data files
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const POSTS_FILE = path.join(__dirname, 'data', 'posts.json');

// Initialize data directory and files
const initializeData = () => {
    try {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(USERS_FILE)) {
            fs.writeFileSync(USERS_FILE, '[]');
        }
        if (!fs.existsSync(POSTS_FILE)) {
            fs.writeFileSync(POSTS_FILE, '[]');
        }
    } catch (error) {
        console.error('Error initializing data:', error);
    }
};

// Helper functions
const readUsers = () => {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading users:', error);
        return [];
    }
};

const writeUsers = (users) => {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error writing users:', error);
    }
};

const readPosts = () => {
    try {
        const data = fs.readFileSync(POSTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading posts:', error);
        return [];
    }
};

const writePosts = (posts) => {
    try {
        fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
    } catch (error) {
        console.error('Error writing posts:', error);
    }
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Signup
app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        const users = readUsers();
        
        if (users.find(u => u.username === username)) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: Date.now(),
            username,
            email,
            password: hashedPassword,
            passwordHistory: [hashedPassword],
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        writeUsers(users);
        
        req.session.userId = newUser.id;
        res.json({ success: true, user: { id: newUser.id, username, email } });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        const users = readUsers();
        const user = users.find(u => u.username === username || u.email === username);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        req.session.userId = user.id;
        res.json({ 
            success: true, 
            user: { 
                id: user.id, 
                username: user.username, 
                email: user.email 
            } 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// Create Post
app.post('/api/posts', (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const { content, isPrivate } = req.body;
        
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Post content is required' });
        }
        
        const posts = readPosts();
        const users = readUsers();
        const user = users.find(u => u.id === req.session.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const newPost = {
            id: Date.now(),
            userId: req.session.userId,
            username: user.username,
            content: content.trim(),
            isPrivate: !!isPrivate,
            createdAt: new Date().toISOString()
        };
        
        posts.push(newPost);
        writePosts(posts);
        
        res.json({ success: true, post: newPost });
    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get Posts
app.get('/api/posts', (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const posts = readPosts();
        const filteredPosts = posts.filter(post => 
            !post.isPrivate || post.userId === req.session.userId
        ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json({ posts: filteredPosts });
    } catch (error) {
        console.error('Get posts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get Current User
app.get('/api/user', (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const users = readUsers();
        const user = users.find(u => u.id === req.session.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ user: { id: user.id, username: user.username, email: user.email } });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.status(500).json({ error: 'Error logging out' });
            }
            res.json({ success: true });
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Change Password - Enhanced with better error handling
app.post('/api/change-password', async (req, res) => {
    console.log('Change password request received');
    console.log('Session:', req.session);
    console.log('Request body:', { ...req.body, currentPassword: '***', newPassword: '***' });
    
    try {
        if (!req.session.userId) {
            console.log('No session found');
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Both current and new passwords are required' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }
        
        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === req.session.userId);
        
        if (userIndex === -1) {
            console.log('User not found for session:', req.session.userId);
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = users[userIndex];
        console.log('Found user:', user.username);
        
        const currentPasswordMatch = await bcrypt.compare(currentPassword, user.password);
        if (!currentPasswordMatch) {
            console.log('Current password incorrect');
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        
        // Check if new password is one of the last 3 passwords
        const lastThreePasswords = user.passwordHistory ? user.passwordHistory.slice(-3) : [];
        console.log('Checking against', lastThreePasswords.length, 'previous passwords');
        
        for (const oldPassword of lastThreePasswords) {
            if (await bcrypt.compare(newPassword, oldPassword)) {
                return res.status(400).json({ error: 'New password cannot be one of your last 3 passwords' });
            }
        }
        
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedNewPassword;
        
        if (!user.passwordHistory) {
            user.passwordHistory = [];
        }
        user.passwordHistory.push(hashedNewPassword);
        
        // Keep only last 5 passwords in history
        if (user.passwordHistory.length > 5) {
            user.passwordHistory = user.passwordHistory.slice(-5);
        }
        
        writeUsers(users);
        console.log('Password changed successfully for user:', user.username);
        
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

initializeData();
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

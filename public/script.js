class SocialMediaApp {
    constructor() {
        this.currentUser = null;
        this.isSignupMode = false; 
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthentication();
    }

    bindEvents() {
       
        document.getElementById('auth-form').addEventListener('submit', (e) => this.handleAuth(e));
        document.getElementById('auth-switch-link').addEventListener('click', (e) => this.toggleAuthMode(e));

       
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('change-password-btn').addEventListener('click', () => this.showChangePasswordModal());

       
        document.getElementById('post-form').addEventListener('submit', (e) => this.createPost(e));

       
        document.getElementById('change-password-form').addEventListener('submit', (e) => this.changePassword(e));
        document.querySelector('.close').addEventListener('click', () => this.hideChangePasswordModal());
        document.getElementById('change-password-modal').addEventListener('click', (e) => {
            if (e.target.id === 'change-password-modal') this.hideChangePasswordModal();
        });
    }

    async checkAuthentication() {
        try {
            const response = await fetch('/api/user');
            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                this.showMainSection();
                this.loadPosts();
            } else {
                this.showAuthSection();
            }
        } catch (error) {
            console.error('Auth check error:', error);
            this.showAuthSection();
        }
    }

    toggleAuthMode(e) {
        e.preventDefault();
        this.isSignupMode = !this.isSignupMode;
        
        const title = document.getElementById('auth-title');
        const subtitle = document.getElementById('auth-subtitle');
        const usernameInput = document.getElementById('username');
        const emailInput = document.getElementById('email');
        const submitBtn = document.getElementById('auth-submit');
        const switchText = document.getElementById('auth-switch-text');

        if (this.isSignupMode) {
            title.textContent = 'Sign up';
            subtitle.textContent = 'Create a free account with your email.';
            usernameInput.placeholder = 'Username';
            emailInput.style.display = 'block';
            emailInput.required = true;
            submitBtn.textContent = 'Sign up';
            switchText.innerHTML = 'Have an account? <a href="#" id="auth-switch-link">Log in</a>';
        } else {
            title.textContent = 'Log in';
            subtitle.textContent = 'Please log in to your account.';
            usernameInput.placeholder = 'Username or Email';
            emailInput.style.display = 'none';
            emailInput.required = false;
            submitBtn.textContent = 'Log in';
            switchText.innerHTML = 'Don\'t have an account? <a href="#" id="auth-switch-link">Sign up</a>';
        }

        
        document.getElementById('auth-switch-link').addEventListener('click', (e) => this.toggleAuthMode(e));

        
        document.getElementById('auth-form').reset();
        this.clearAlerts();
    }

    async handleAuth(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Validation
        if (!username || !password) {
            this.showAlert('Please fill in all required fields', 'error');
            return;
        }

        if (this.isSignupMode) {
            if (!email) {
                this.showAlert('Email is required for signup', 'error');
                return;
            }
            
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                this.showAlert('Please enter a valid email address', 'error');
                return;
            }
            
            if (password.length < 6) {
                this.showAlert('Password must be at least 6 characters long', 'error');
                return;
            }
        }

        const endpoint = this.isSignupMode ? '/api/signup' : '/api/login';
        const payload = this.isSignupMode ? { username, email, password } : { username, password };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                this.currentUser = data.user;
                this.showMainSection();
                await this.loadPosts();
                this.showAlert(this.isSignupMode ? 'Account created successfully!' : 'Welcome back!', 'success');
            } else {
                this.showAlert(data.error || 'Authentication failed', 'error');
            }
        } catch (error) {
            console.error('Auth error:', error);
            this.showAlert('Network error. Please try again.', 'error');
        }
    }

    async logout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            this.currentUser = null;
            this.showAuthSection();
            this.showAlert('Logged out successfully!', 'success');
        } catch (error) {
            console.error('Logout error:', error);
            this.showAlert('Error logging out', 'error');
        }
    }

    async createPost(e) {
        e.preventDefault();
        
        const content = document.getElementById('post-content').value.trim();
        const isPrivate = document.getElementById('post-private').checked;

        if (!content) {
            this.showAlert('Post content cannot be empty', 'error');
            return;
        }

        try {
            const response = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, isPrivate })
            });

            const data = await response.json();

            if (response.ok) {
                document.getElementById('post-form').reset();
                await this.loadPosts();
                this.showAlert('Post created successfully!', 'success');
            } else {
                this.showAlert(data.error, 'error');
            }
        } catch (error) {
            console.error('Create post error:', error);
            this.showAlert('Error creating post', 'error');
        }
    }

    async loadPosts() {
        try {
            const response = await fetch('/api/posts');
            if (response.ok) {
                const data = await response.json();
                this.renderPosts(data.posts);
            } else {
                console.error('Error loading posts');
            }
        } catch (error) {
            console.error('Load posts error:', error);
        }
    }

    renderPosts(posts) {
        const feed = document.getElementById('posts-feed');
        
        if (posts.length === 0) {
            feed.innerHTML = '<div class="no-posts">No posts yet. Be the first to post!</div>';
            return;
        }

        feed.innerHTML = posts.map(post => `
            <div class="post">
                <div class="post-header">
                    <span class="post-author">${this.escapeHtml(post.username)}</span>
                    <span class="post-date">${new Date(post.createdAt).toLocaleString()}</span>
                </div>
                <div class="post-content">${this.escapeHtml(post.content)}</div>
                ${post.isPrivate ? '<span class="post-privacy">Private</span>' : ''}
            </div>
        `).join('');
    }

    showChangePasswordModal() {
        document.getElementById('change-password-modal').classList.remove('hidden');
    }

    hideChangePasswordModal() {
        document.getElementById('change-password-modal').classList.add('hidden');
        document.getElementById('change-password-form').reset();
        this.clearAlerts();
    }

    async changePassword(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showAlert('All fields are required', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showAlert('New passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showAlert('New password must be at least 6 characters long', 'error');
            return;
        }

        if (newPassword === currentPassword) {
            this.showAlert('New password must be different from current password', 'error');
            return;
        }

        try {
            const response = await fetch('/api/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (response.ok) {
                this.hideChangePasswordModal();
                this.showAlert('Password changed successfully!', 'success');
            } else {
                this.showAlert(data.error, 'error');
            }
        } catch (error) {
            console.error('Change password error:', error);
            this.showAlert('Error changing password', 'error');
        }
    }

    showAuthSection() {
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('main-section').classList.add('hidden');
        document.getElementById('navbar').classList.add('hidden');
    }

    showMainSection() {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('main-section').classList.remove('hidden');
        document.getElementById('navbar').classList.remove('hidden');
        if (this.currentUser) {
            document.getElementById('username-display').textContent = `Welcome, ${this.currentUser.username}`;
        }
    }

    showAlert(message, type) {
        this.clearAlerts();
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        
        // Find the appropriate container for the alert
        let container;
        if (!document.getElementById('auth-section').classList.contains('hidden')) {
            container = document.querySelector('.form');
        } else if (!document.getElementById('change-password-modal').classList.contains('hidden')) {
            container = document.querySelector('#change-password-modal .form');
        } else {
            container = document.querySelector('.create-post');
        }
        
        if (container) {
            container.insertBefore(alert, container.firstChild);
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.parentNode.removeChild(alert);
                }
            }, 5000);
        }
    }

    clearAlerts() {
        document.querySelectorAll('.alert').forEach(alert => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SocialMediaApp();
});

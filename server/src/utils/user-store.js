import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
    return {};
}

function saveUsers(users) {
    try {
        const options = { encoding: 'utf8', mode: 0o600 };
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), options);
        try {
            // writeFileSync mode option only works on creation, force chmod for existing files
            fs.chmodSync(USERS_FILE, 0o600);
        } catch (e) {
            // Ignore chmod errors on systems that don't support it (e.g. some Docker mounts/Windows)
        }
        return true;
    } catch (error) {
        console.error('Error saving users:', error);
        return false;
    }
}

function hashPassword(password, salt) {
    if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

function verifyPassword(password, storedHash, salt) {
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === storedHash;
}

export const UserStore = {
    init() {
        const users = loadUsers();
        // Ensure file permissions are secure (0600) on startup
        if (fs.existsSync(USERS_FILE)) {
            try { fs.chmodSync(USERS_FILE, 0o600); } catch (e) { }
        }

        if (Object.keys(users).length === 0) {
            console.log('--------------------------------------------------');
            console.log('No users found. Creating default admin user.');
            console.log('Username: admin');
            console.log('Password: admin');
            console.log('--------------------------------------------------');
            this.createUser('admin', 'admin');
        }
    },

    createUser(username, password) {
        const users = loadUsers();
        if (users[username]) {
            throw new Error('User already exists');
        }

        const { hash, salt } = hashPassword(password);
        users[username] = {
            username,
            hash,
            salt,
            created_at: new Date().toISOString()
        };

        return saveUsers(users);
    },

    authenticate(username, password) {
        const users = loadUsers();
        const user = users[username];

        if (!user) return null;

        if (verifyPassword(password, user.hash, user.salt)) {
            const { hash, salt, ...safeUser } = user;
            return safeUser;
        }

        return null;
    },

    changePassword(username, newPassword) {
        const users = loadUsers();
        if (!users[username]) {
            throw new Error('User not found');
        }

        const { hash, salt } = hashPassword(newPassword);
        users[username].hash = hash;
        users[username].salt = salt;
        users[username].updated_at = new Date().toISOString();

        return saveUsers(users);
    }
};

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database file path (in project root)
const DB_PATH = path.join(__dirname, '..', 'data.db');

let db = null;

/**
 * Initialize database connection and create tables
 */
export function initDatabase() {
    try {
        db = new Database(DB_PATH);
        
        // Create tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS verified_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                address TEXT NOT NULL,
                wallet_type TEXT,
                nfts TEXT, -- JSON array of NFTs
                verified_at INTEGER,
                last_checked INTEGER,
                UNIQUE(user_id, guild_id, address)
            );
            
            CREATE INDEX IF NOT EXISTS idx_user_guild 
            ON verified_users(user_id, guild_id);
            
            CREATE INDEX IF NOT EXISTS idx_address 
            ON verified_users(address);
            
            CREATE TABLE IF NOT EXISTS verification_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at INTEGER,
                completed_at INTEGER
            );
            
            CREATE INDEX IF NOT EXISTS idx_session 
            ON verification_sessions(session_id);
        `);
        
        console.log('✅ Database initialized');
        return db;
    } catch (err) {
        console.error('❌ Database initialization failed:', err);
        throw err;
    }
}

/**
 * Save verified user/wallet
 */
export function saveVerifiedUser(userId, guildId, address, walletType, nfts) {
    if (!db) throw new Error('Database not initialized');
    
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO verified_users 
        (user_id, guild_id, address, wallet_type, nfts, verified_at, last_checked)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const now = Date.now();
    stmt.run(
        userId,
        guildId,
        address,
        walletType,
        JSON.stringify(nfts || []),
        now,
        now
    );
    
    console.log(`💾 Saved wallet ${address.slice(0, 10)}... for user ${userId}`);
}

/**
 * Get all wallets for a user in a guild
 */
export function getUserWallets(userId, guildId) {
    if (!db) throw new Error('Database not initialized');
    
    const stmt = db.prepare(`
        SELECT address, wallet_type, nfts, verified_at 
        FROM verified_users 
        WHERE user_id = ? AND guild_id = ?
    `);
    
    const rows = stmt.all(userId, guildId);
    
    return rows.map(row => ({
        address: row.address,
        type: row.wallet_type,
        nfts: JSON.parse(row.nfts || '[]'),
        verifiedAt: row.verified_at
    }));
}

/**
 * Get all verified users for re-verification
 */
export function getAllVerifiedUsers() {
    if (!db) throw new Error('Database not initialized');
    
    const stmt = db.prepare(`
        SELECT user_id, guild_id, address, wallet_type, nfts, last_checked
        FROM verified_users
    `);
    
    return stmt.all().map(row => ({
        userId: row.user_id,
        guildId: row.guild_id,
        address: row.address,
        type: row.wallet_type,
        nfts: JSON.parse(row.nfts || '[]'),
        lastChecked: row.last_checked
    }));
}

/**
 * Remove a user's wallet
 */
export function removeWallet(userId, guildId, address) {
    if (!db) throw new Error('Database not initialized');
    
    const stmt = db.prepare(`
        DELETE FROM verified_users 
        WHERE user_id = ? AND guild_id = ? AND address = ?
    `);
    
    stmt.run(userId, guildId, address);
    console.log(`🗑️ Removed wallet ${address.slice(0, 10)}... for user ${userId}`);
}

/**
 * Remove all wallets for a user (when role is revoked)
 */
export function removeAllUserWallets(userId, guildId) {
    if (!db) throw new Error('Database not initialized');
    
    const stmt = db.prepare(`
        DELETE FROM verified_users 
        WHERE user_id = ? AND guild_id = ?
    `);
    
    stmt.run(userId, guildId);
    console.log(`🗑️ Removed all wallets for user ${userId}`);
}

/**
 * Update last checked timestamp
 */
export function updateLastChecked(userId, guildId, address) {
    if (!db) throw new Error('Database not initialized');
    
    const stmt = db.prepare(`
        UPDATE verified_users 
        SET last_checked = ?
        WHERE user_id = ? AND guild_id = ? AND address = ?
    `);
    
    stmt.run(Date.now(), userId, guildId, address);
}

/**
 * Get verification stats
 */
export function getStats(guildId) {
    if (!db) throw new Error('Database not initialized');
    
    const totalStmt = db.prepare(`
        SELECT COUNT(DISTINCT user_id) as count 
        FROM verified_users 
        WHERE guild_id = ?
    `);
    
    const walletStmt = db.prepare(`
        SELECT COUNT(*) as count 
        FROM verified_users 
        WHERE guild_id = ?
    `);
    
    return {
        uniqueUsers: totalStmt.get(guildId).count,
        totalWallets: walletStmt.get(guildId).count
    };
}

/**
 * Close database connection
 */
export function closeDatabase() {
    if (db) {
        db.close();
        console.log('📦 Database closed');
    }
}

// Handle graceful shutdown
process.on('SIGINT', closeDatabase);
process.on('SIGTERM', closeDatabase);

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database file path
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data.db');

let db = null;

/**
 * Initialize database connection and create tables
 */
export async function initDatabase() {
    try {
        db = await open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });
        
        // Create tables
        await db.exec(`
            CREATE TABLE IF NOT EXISTS verified_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                address TEXT NOT NULL,
                wallet_type TEXT,
                nfts TEXT,
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
        
        console.log('✅ Database initialized at', DB_PATH);
        return db;
    } catch (err) {
        console.error('❌ Database initialization failed:', err);
        throw err;
    }
}

/**
 * Save verified user/wallet
 */
export async function saveVerifiedUser(userId, guildId, address, walletType, nfts) {
    if (!db) throw new Error('Database not initialized');
    
    const now = Date.now();
    await db.run(
        `INSERT OR REPLACE INTO verified_users 
        (user_id, guild_id, address, wallet_type, nfts, verified_at, last_checked)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
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
export async function getUserWallets(userId, guildId) {
    if (!db) throw new Error('Database not initialized');
    
    const rows = await db.all(
        `SELECT address, wallet_type, nfts, verified_at 
        FROM verified_users 
        WHERE user_id = ? AND guild_id = ?`,
        userId,
        guildId
    );
    
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
export async function getAllVerifiedUsers() {
    if (!db) throw new Error('Database not initialized');
    
    const rows = await db.all(
        `SELECT user_id, guild_id, address, wallet_type, nfts, last_checked
        FROM verified_users`
    );
    
    return rows.map(row => ({
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
export async function removeWallet(userId, guildId, address) {
    if (!db) throw new Error('Database not initialized');
    
    await db.run(
        `DELETE FROM verified_users 
        WHERE user_id = ? AND guild_id = ? AND address = ?`,
        userId,
        guildId,
        address
    );
    console.log(`🗑️ Removed wallet ${address.slice(0, 10)}... for user ${userId}`);
}

/**
 * Remove all wallets for a user (when role is revoked)
 */
export async function removeAllUserWallets(userId, guildId) {
    if (!db) throw new Error('Database not initialized');
    
    await db.run(
        `DELETE FROM verified_users 
        WHERE user_id = ? AND guild_id = ?`,
        userId,
        guildId
    );
    console.log(`🗑️ Removed all wallets for user ${userId}`);
}

/**
 * Update last checked timestamp
 */
export async function updateLastChecked(userId, guildId, address) {
    if (!db) throw new Error('Database not initialized');
    
    await db.run(
        `UPDATE verified_users 
        SET last_checked = ?
        WHERE user_id = ? AND guild_id = ? AND address = ?`,
        Date.now(),
        userId,
        guildId,
        address
    );
}

/**
 * Get verification stats
 */
export async function getStats(guildId) {
    if (!db) throw new Error('Database not initialized');
    
    const totalResult = await db.get(
        `SELECT COUNT(DISTINCT user_id) as count 
        FROM verified_users 
        WHERE guild_id = ?`,
        guildId
    );
    
    const walletResult = await db.get(
        `SELECT COUNT(*) as count 
        FROM verified_users 
        WHERE guild_id = ?`,
        guildId
    );
    
    return {
        uniqueUsers: totalResult?.count || 0,
        totalWallets: walletResult?.count || 0
    };
}

/**
 * Close database connection
 */
export async function closeDatabase() {
    if (db) {
        await db.close();
        console.log('📦 Database closed');
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => closeDatabase().then(() => process.exit(0)));
process.on('SIGTERM', () => closeDatabase().then(() => process.exit(0)));

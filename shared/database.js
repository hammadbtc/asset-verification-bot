import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database file path
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data.json');

// In-memory cache
let db = {
    users: [],
    sessions: []
};
let initialized = false;

/**
 * Initialize database - load from file
 */
export async function initDatabase() {
    try {
        // Try to load existing data
        const data = await fs.readFile(DB_PATH, 'utf8').catch(() => null);
        if (data) {
            db = JSON.parse(data);
        }
        initialized = true;
        console.log('✅ Database loaded from', DB_PATH);
    } catch (err) {
        console.error('❌ Database initialization failed:', err);
        throw err;
    }
}

/**
 * Save database to file
 */
async function saveDatabase() {
    try {
        await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
    } catch (err) {
        console.error('Failed to save database:', err);
    }
}

/**
 * Save verified user/wallet
 */
export async function saveVerifiedUser(userId, guildId, address, walletType, nfts) {
    if (!initialized) throw new Error('Database not initialized');
    
    // Remove existing entry for this address
    db.users = db.users.filter(u => 
        !(u.user_id === userId && u.guild_id === guildId && u.address === address)
    );
    
    // Add new entry
    db.users.push({
        user_id: userId,
        guild_id: guildId,
        address: address,
        wallet_type: walletType,
        nfts: nfts || [],
        verified_at: Date.now(),
        last_checked: Date.now()
    });
    
    await saveDatabase();
    console.log(`💾 Saved wallet ${address.slice(0, 10)}... for user ${userId}`);
}

/**
 * Get all wallets for a user in a guild
 */
export async function getUserWallets(userId, guildId) {
    if (!initialized) throw new Error('Database not initialized');
    
    return db.users
        .filter(u => u.user_id === userId && u.guild_id === guildId)
        .map(u => ({
            address: u.address,
            type: u.wallet_type,
            nfts: u.nfts || [],
            verifiedAt: u.verified_at
        }));
}

/**
 * Get all verified users for re-verification
 */
export async function getAllVerifiedUsers() {
    if (!initialized) throw new Error('Database not initialized');
    
    return db.users.map(u => ({
        userId: u.user_id,
        guildId: u.guild_id,
        address: u.address,
        type: u.wallet_type,
        nfts: u.nfts || [],
        lastChecked: u.last_checked
    }));
}

/**
 * Remove all wallets for a user
 */
export async function removeAllUserWallets(userId, guildId) {
    if (!initialized) throw new Error('Database not initialized');
    
    db.users = db.users.filter(u => 
        !(u.user_id === userId && u.guild_id === guildId)
    );
    
    await saveDatabase();
    console.log(`🗑️ Removed all wallets for user ${userId}`);
}

/**
 * Update last checked timestamp
 */
export async function updateLastChecked(userId, guildId, address) {
    if (!initialized) throw new Error('Database not initialized');
    
    const user = db.users.find(u => 
        u.user_id === userId && u.guild_id === guildId && u.address === address
    );
    
    if (user) {
        user.last_checked = Date.now();
        await saveDatabase();
    }
}

/**
 * Get verification stats
 */
export async function getStats(guildId) {
    if (!initialized) throw new Error('Database not initialized');
    
    const guildUsers = db.users.filter(u => u.guild_id === guildId);
    const uniqueUsers = new Set(guildUsers.map(u => u.user_id)).size;
    
    return {
        uniqueUsers,
        totalWallets: guildUsers.length
    };
}

import { EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';
import { getGuildCollection, filterNFTsByCollection } from '../shared/collections.js';
import {
    saveVerifiedUser as dbSaveVerifiedUser,
    getUserWallets as dbGetUserWallets,
    getAllVerifiedUsers as dbGetAllVerifiedUsers,
    removeAllUserWallets as dbRemoveAllUserWallets,
    updateLastChecked as dbUpdateLastChecked
} from '../shared/database.js';

dotenv.config();

/**
 * Daily Re-verification System
 * 
 * This module handles:
 * - Periodic re-checking of verified users' NFT holdings
 * - Removing roles from users who no longer hold required NFTs
 * - Logging re-verification results
 */

const VERIFIED_ROLE_ID = process.env.VERIFIED_ROLE_ID;
const HIRO_API_BASE = 'https://api.hiro.so';

/**
 * Save verified user (wrapper for database)
 */
export async function saveVerifiedUser(userId, guildId, address, walletType, nfts) {
    dbSaveVerifiedUser(userId, guildId, address, walletType, nfts);
}

/**
 * Get saved wallets for a user
 */
export function getUserWallets(userId, guildId) {
    return dbGetUserWallets(userId, guildId);
}

/**
 * Check if user still holds required NFTs
 */
export async function checkUserHoldings(address, guildId) {
    try {
        const response = await fetch(
            `${HIRO_API_BASE}/ordinals/v1/inscriptions?address=${address}&limit=50`
        );
        
        if (!response.ok) {
            throw new Error(`Hiro API error: ${response.status}`);
        }
        
        const data = await response.json();
        const allNfts = data.results || [];
        
        // Get collection for this guild
        const collectionId = getGuildCollection(guildId);
        
        // Filter by collection
        const nfts = filterNFTsByCollection(allNfts.map(nft => ({
            id: nft.id,
            number: nft.number,
            contentType: nft.content_type,
            name: nft.meta?.name || `Inscription #${nft.number}`
        })), collectionId);
        
        return {
            hasRequiredNFT: nfts.length > 0,
            nfts,
            collectionId
        };
        
    } catch (err) {
        console.error('Failed to check holdings:', err);
        return { hasRequiredNFT: true, nfts: [], collectionId: null }; // Fail open
    }
}

/**
 * Run re-verification for all verified users
 */
export async function runReverification(client) {
    console.log('🔄 Starting daily re-verification...');
    
    const results = {
        checked: 0,
        revoked: 0,
        errors: 0
    };
    
    // Get all verified users from database
    const verifiedUsers = dbGetAllVerifiedUsers();
    console.log(`📊 Found ${verifiedUsers.length} wallets to check`);
    
    for (const userData of verifiedUsers) {
        try {
            const { userId, guildId, address, nfts } = userData;
            
            // Check current holdings
            const { hasRequiredNFT, collectionId } = await checkUserHoldings(address, guildId);
            
            if (!hasRequiredNFT) {
                // Remove role
                try {
                    const guild = await client.guilds.fetch(guildId);
                    const member = await guild.members.fetch(userId);
                    
                    if (VERIFIED_ROLE_ID && member.roles.cache.has(VERIFIED_ROLE_ID)) {
                        await member.roles.remove(VERIFIED_ROLE_ID);
                        
                        // Remove from database
                        dbRemoveAllUserWallets(userId, guildId);
                        
                        // Notify user
                        try {
                            const embed = new EmbedBuilder()
                                .setTitle('⚠️ Verification Expired')
                                .setDescription(
                                    'Your verified holder role has been removed because you no longer hold the required NFT.\n\n' +
                                    'If this is a mistake, use `/verify` to re-verify.'
                                )
                                .setColor(0xff9800);
                            
                            await member.send({ embeds: [embed] });
                        } catch (dmErr) {
                            // DMs disabled, ignore
                        }
                        
                        console.log(`⛔ Revoked verification for ${member.user.tag}`);
                        results.revoked++;
                    }
                } catch (guildErr) {
                    console.error(`Failed to process ${userId}:`, guildErr);
                    results.errors++;
                }
            } else {
                // Update last checked
                dbUpdateLastChecked(userId, guildId, address);
                results.checked++;
                console.log(`✅ ${userId} still holds ${collectionId} NFTs`);
            }
            
        } catch (err) {
            console.error('Re-verification error:', err);
            results.errors++;
        }
    }
    
    console.log('✅ Re-verification complete:', results);
    return results;
}

/**
 * Start re-verification scheduler
 */
export function startReverificationScheduler(client) {
    console.log('📅 Re-verification scheduler started (runs every 24 hours)');
    
    // Run immediately on startup
    setTimeout(() => {
        runReverification(client);
    }, 60000); // Wait 1 minute after startup
    
    // Schedule daily runs (24 hours)
    setInterval(() => {
        runReverification(client);
    }, 24 * 60 * 60 * 1000);
}

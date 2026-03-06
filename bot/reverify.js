import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';

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
const REVERIFY_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const HIRO_API_BASE = 'https://api.hiro.so';

// Store verified users and their wallets
const verifiedUsers = new Map();

/**
 * Load verified users from persistent storage
 * In production, use a database
 */
export async function loadVerifiedUsers() {
    // TODO: Load from database
    return new Map();
}

/**
 * Save verified user
 */
export async function saveVerifiedUser(userId, guildId, address, nfts) {
    const data = {
        userId,
        guildId,
        address,
        nfts,
        verifiedAt: Date.now(),
        lastChecked: Date.now()
    };
    
    verifiedUsers.set(`${guildId}:${userId}`, data);
    
    // TODO: Persist to database
    console.log(`💾 Saved verification for user ${userId}`);
}

/**
 * Check if user still holds required NFTs
 */
export async function checkUserHoldings(address, collectionId = null) {
    try {
        const response = await fetch(
            `${HIRO_API_BASE}/ordinals/v1/inscriptions?address=${address}&limit=50`
        );
        
        if (!response.ok) {
            throw new Error(`Hiro API error: ${response.status}`);
        }
        
        const data = await response.json();
        const nfts = data.results || [];
        
        // If collection ID specified, filter by it
        if (collectionId) {
            // Note: Hiro API doesn't directly support collection filtering
            // You may need to cross-reference with your collection data
            return {
                hasRequiredNFT: nfts.length > 0, // Customize logic
                nfts
            };
        }
        
        return {
            hasRequiredNFT: nfts.length > 0,
            nfts
        };
        
    } catch (err) {
        console.error('Failed to check holdings:', err);
        return { hasRequiredNFT: true, nfts: [] }; // Fail open
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
    
    for (const [key, data] of verifiedUsers) {
        try {
            const { userId, guildId, address } = data;
            
            // Check current holdings
            const { hasRequiredNFT } = await checkUserHoldings(address);
            
            if (!hasRequiredNFT) {
                // Remove role
                const guild = await client.guilds.fetch(guildId);
                const member = await guild.members.fetch(userId);
                
                if (VERIFIED_ROLE_ID) {
                    await member.roles.remove(VERIFIED_ROLE_ID);
                }
                
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
                
                verifiedUsers.delete(key);
                results.revoked++;
                
                console.log(`⛔ Revoked verification for ${member.user.tag}`);
            } else {
                // Update last checked
                data.lastChecked = Date.now();
                results.checked++;
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
    console.log('📅 Re-verification scheduler started');
    
    // Run immediately on startup
    runReverification(client);
    
    // Schedule daily runs
    setInterval(() => {
        runReverification(client);
    }, REVERIFY_INTERVAL);
}

/**
 * Manual re-verification command handler
 */
export async function handleReverifyCommand(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const results = await runReverification(interaction.client);
    
    const embed = new EmbedBuilder()
        .setTitle('🔄 Re-verification Complete')
        .addFields(
            { name: 'Checked', value: results.checked.toString(), inline: true },
            { name: 'Revoked', value: results.revoked.toString(), inline: true },
            { name: 'Errors', value: results.errors.toString(), inline: true }
        )
        .setColor(0x667eea)
        .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
}

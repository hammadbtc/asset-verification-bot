import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import dotenv from 'dotenv';
import { initDatabase } from '../shared/database.js';
import { runReverification, startReverificationScheduler, saveVerifiedUser, getUserWallets } from './reverify.js';

dotenv.config();

// Initialize database
initDatabase();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

// Configuration
const VERIFIED_ROLE_ID = process.env.VERIFIED_ROLE_ID;
const VERIFICATION_CHANNEL_ID = process.env.VERIFICATION_CHANNEL_ID;
const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:3000';
const BOT_API_PORT = process.env.BOT_PORT || 3001;

// Active verifications
const activeVerifications = new Map();

/**
 * Register slash commands
 */
async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('verify')
            .setDescription('Get your personal verification link')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('check')
            .setDescription('Check your verification status')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('setup')
            .setDescription('Setup verification in this channel (Admin only)')
            .setDefaultMemberPermissions('0')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('admin')
            .setDescription('Admin commands for NFT verification')
            .addSubcommand(sub =>
                sub.setName('stats')
                    .setDescription('Show verification statistics')
            )
            .addSubcommand(sub =>
                sub.setName('revoke')
                    .setDescription('Revoke a user\'s verification')
                    .addUserOption(opt =>
                        opt.setName('user')
                            .setDescription('User to revoke')
                            .setRequired(true)
                    )
            )
            .addSubcommand(sub =>
                sub.setName('reverify')
                    .setDescription('Run re-verification check on all users')
            )
            .setDefaultMemberPermissions('0')
            .toJSON()
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('🔄 Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(
                process.env.DISCORD_CLIENT_ID,
                process.env.DISCORD_GUILD_ID
            ),
            { body: commands }
        );
        console.log('✅ Slash commands registered');
    } catch (err) {
        console.error('Failed to register commands:', err);
    }
}

/**
 * Handle /verify command
 */
async function handleVerify(interaction) {
    // Defer immediately to prevent timeout
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    try {
        // Create verification session via web API
        const response = await fetch(`${WEB_BASE_URL}/api/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                guildId,
                createdAt: Date.now()
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create verification session');
        }

        const { sessionId, url } = await response.json();
        const verifyUrl = `${WEB_BASE_URL}${url}`;

        // Store active verification
        activeVerifications.set(sessionId, {
            userId,
            guildId,
            interaction,
            startedAt: Date.now()
        });

        // Create verification button
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('🔐 Verify Wallet')
                .setStyle(ButtonStyle.Link)
                .setURL(verifyUrl),
            new ButtonBuilder()
                .setLabel('Check Status')
                .setStyle(ButtonStyle.Primary)
                .setCustomId(`check_${sessionId}`)
        );

        const embed = new EmbedBuilder()
            .setTitle('🔐 NFT Verification')
            .setDescription(
                'Click the button below to verify your NFT ownership.\n\n' +
                '**Supported Wallets:**\n' +
                '• Unisat\n' +
                '• Xverse\n' +
                '• Leather\n\n' +
                '⚠️ This link expires in 10 minutes.'
            )
            .setColor(0x667eea)
            .setFooter({ text: 'Session: ' + sessionId.slice(0, 8) });

        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });

        // Start polling for result
        pollVerification(sessionId, interaction);

    } catch (err) {
        console.error('Verify error:', err);
        await interaction.editReply({
            content: '❌ Failed to start verification. Please try again later.'
        });
    }
}

/**
 * Poll for verification result
 */
async function pollVerification(sessionId, interaction, attempts = 0) {
    if (attempts > 60) { // 10 minutes (10s * 60)
        activeVerifications.delete(sessionId);
        return;
    }

    try {
        const response = await fetch(`${WEB_BASE_URL}/api/result/${sessionId}`);
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.success) {
                // Grant role
                await grantVerifiedRole(interaction, result);
                activeVerifications.delete(sessionId);
                return;
            }
        }

        // Continue polling
        setTimeout(() => pollVerification(sessionId, interaction, attempts + 1), 10000);

    } catch (err) {
        console.error('Poll error:', err);
        setTimeout(() => pollVerification(sessionId, interaction, attempts + 1), 10000);
    }
}

/**
 * Grant verified role to user
 */
async function grantVerifiedRole(interaction, result) {
    try {
        const member = await interaction.guild.members.fetch(result.userId);
        
        if (VERIFIED_ROLE_ID) {
            await member.roles.add(VERIFIED_ROLE_ID);
        }
        
        // Save to re-verification tracking (all wallets)
        for (const wallet of result.wallets || [{ address: result.address, type: 'unknown' }]) {
            await saveVerifiedUser(
                result.userId,
                result.guildId,
                wallet.address,
                wallet.type,
                result.nfts || []
            );
        }

        const nftList = result.nfts.slice(0, 5).map(nft => 
            `• ${nft.name || 'NFT #' + nft.number}`
        ).join('\n');

        const walletCount = result.walletCount || 1;
        const walletText = walletCount > 1 ? `(${walletCount} wallets)` : '';

        const embed = new EmbedBuilder()
            .setTitle('✅ Verification Successful!')
            .setDescription(
                `Welcome, ${member.user.username}! ${walletText}\n\n` +
                `**Wallet(s):** ${result.wallets ? result.wallets.map(w => `\`${w.address.slice(0, 10)}...${w.address.slice(-6)}\``).join(', ') : `\`${result.address.slice(0, 10)}...${result.address.slice(-6)}\``}\n\n` +
                `**Your NFTs:**\n${nftList}${result.nfts.length > 5 ? '\n• ...and more' : ''}`
            )
            .setColor(0x4CAF50)
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed],
            components: []
        });

        console.log(`✅ Verified ${member.user.tag} with ${result.nfts.length} NFTs`);

    } catch (err) {
        console.error('Failed to grant role:', err);
        await interaction.editReply({
            content: '❌ Verification succeeded but failed to assign role. Please contact an admin.',
            components: []
        });
    }
}

/**
 * Handle /check command
 */
async function handleCheck(interaction) {
    const member = interaction.member;
    const hasRole = VERIFIED_ROLE_ID && member.roles.cache.has(VERIFIED_ROLE_ID);

    const embed = new EmbedBuilder()
        .setTitle('🔍 Verification Status')
        .setDescription(
            hasRole 
                ? '✅ You are verified! You have the verified holder role.'
                : '❌ You are not verified. Use `/verify` to verify your NFT ownership.'
        )
        .setColor(hasRole ? 0x4CAF50 : 0xff9800);

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Handle /admin command
 */
async function handleAdmin(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'stats') {
        // Count verified members
        const guild = interaction.guild;
        await guild.members.fetch();
        
        const verifiedCount = guild.members.cache.filter(
            m => m.roles.cache.has(VERIFIED_ROLE_ID)
        ).size;

        const embed = new EmbedBuilder()
            .setTitle('📊 Verification Stats')
            .addFields(
                { name: 'Verified Holders', value: verifiedCount.toString(), inline: true },
                { name: 'Total Members', value: guild.memberCount.toString(), inline: true }
            )
            .setColor(0x667eea);

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'revoke') {
        const target = interaction.options.getMember('user');
        
        if (VERIFIED_ROLE_ID) {
            await target.roles.remove(VERIFIED_ROLE_ID);
        }

        await interaction.reply({
            content: `✅ Revoked verification for ${target.user.tag}`,
            ephemeral: true
        });
    }
    
    if (subcommand === 'reverify') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
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
}

/**
 * Handle /setup command - Post persistent verification message
 */
async function handleSetup(interaction) {
    try {
        // Create the persistent verification embed
        const embed = new EmbedBuilder()
            .setTitle('🥚 Ordinal Eggs Verification')
            .setDescription(
                '**🔒 Verify Holder Status**\n\n' +
                '✅ To access this server, verify ownership of:\n' +
                '• Ordinal Eggs (Sub10k)\n' +
                '• Mother Cluckers\n\n' +
                '👉 Click **"Verify Now"** to connect your wallet and get verified.\n\n' +
                '🔐 Your wallet stays in your control. We only verify you hold the NFTs — no transactions, no permissions, just a message signature.'
            )
            .setColor(0x667eea)
            .setThumbnail('https://ordinal-eggs.com/logo.jpg')
            .setFooter({ text: 'Powered by Ordinal Eggs • Secure Message Signing' });

        // Create buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_start')
                    .setLabel('🔐 Verify Now')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('check_status')
                    .setLabel('📊 Check Status')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('manage_wallets')
                    .setLabel('👛 My Wallets')
                    .setStyle(ButtonStyle.Success)
            );

        // Send the persistent message
        await interaction.channel.send({
            embeds: [embed],
            components: [row]
        });

        await interaction.reply({
            content: '✅ Verification message posted! This channel is now the verification hub.',
            ephemeral: true
        });

    } catch (err) {
        console.error('Setup error:', err);
        await interaction.reply({
            content: '❌ Failed to setup verification message.',
            ephemeral: true
        });
    }
}

// Event handlers
client.on('clientReady', () => {
    console.log(`🤖 Bot logged in as ${client.user.tag}`);
    registerCommands();
    
    // Start daily re-verification scheduler
    startReverificationScheduler(client);
});

client.on('interactionCreate', async (interaction) => {
    // Handle button clicks
    if (interaction.isButton()) {
        if (interaction.customId === 'verify_start') {
            // Create ephemeral verification link
            await handleVerifyButton(interaction);
            return;
        }
        if (interaction.customId === 'check_status') {
            await handleCheck(interaction);
            return;
        }
        if (interaction.customId === 'manage_wallets') {
            await handleManageWallets(interaction);
            return;
        }
        if (interaction.customId.startsWith('check_')) {
            const sessionId = interaction.customId.replace('check_', '');
            try {
                const response = await fetch(`${WEB_BASE_URL}/api/result/${sessionId}`);
                
                if (response.ok) {
                    const result = await response.json();
                    await interaction.reply({
                        content: result.success 
                            ? '✅ Verification complete! Check above for your role.'
                            : '⏳ Still waiting for verification...',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '⏳ Verification in progress... Please complete the wallet connection.',
                        ephemeral: true
                    });
                }
            } catch (err) {
                await interaction.reply({
                    content: '❌ Error checking status. Please try again.',
                    ephemeral: true
                });
            }
            return;
        }
    }

    // Handle slash commands
    if (interaction.isChatInputCommand()) {
        switch (interaction.commandName) {
            case 'verify':
                await handleVerify(interaction);
                break;
            case 'check':
                await handleCheck(interaction);
                break;
            case 'setup':
                await handleSetup(interaction);
                break;
            case 'admin':
                await handleAdmin(interaction);
                break;
        }
    }
});

/**
 * Handle Verify button click (from persistent message)
 */
async function handleVerifyButton(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    try {
        // Create verification session
        const response = await fetch(`${WEB_BASE_URL}/api/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                guildId,
                createdAt: Date.now()
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create verification session');
        }

        const { sessionId, url } = await response.json();
        const verifyUrl = `${WEB_BASE_URL}${url}`;

        const embed = new EmbedBuilder()
            .setTitle('🔐 Start Verification')
            .setDescription(
                'Click the button below to verify your NFT ownership.\n\n' +
                '**Supported Wallets:**\n' +
                '• Unisat\n' +
                '• Xverse\n\n' +
                '⚠️ This link expires in 10 minutes.'
            )
            .setColor(0x667eea);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('🔐 Verify Wallet')
                .setStyle(ButtonStyle.Link)
                .setURL(verifyUrl)
        );

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });

    } catch (err) {
        console.error('Verify button error:', err);
        await interaction.reply({
            content: '❌ Failed to start verification. Please try again.',
            ephemeral: true
        });
    }
}

/**
 * Handle Manage Wallets button
 */
async function handleManageWallets(interaction) {
    const member = interaction.member;
    const hasRole = VERIFIED_ROLE_ID && member.roles.cache.has(VERIFIED_ROLE_ID);

    if (!hasRole) {
        await interaction.reply({
            content: '❌ You are not verified yet. Click "Verify Now" to verify your wallet.',
            ephemeral: true
        });
        return;
    }

    // Get user's saved wallets
    const wallets = getUserWallets(interaction.user.id, interaction.guildId);
    
    let walletList = '';
    if (wallets.length > 0) {
        walletList = wallets.map((w, i) => {
            const shortAddr = `${w.address.slice(0, 8)}...${w.address.slice(-6)}`;
            const nftCount = w.nfts?.length || 0;
            const date = new Date(w.verifiedAt).toLocaleDateString();
            return `${i + 1}. \`${shortAddr}\` — ${nftCount} NFTs (added ${date})`;
        }).join('\n');
    } else {
        walletList = 'No wallets found in database.';
    }

    const embed = new EmbedBuilder()
        .setTitle('👛 Your Connected Wallets')
        .setDescription(
            'You can add multiple wallets to aggregate your NFTs.\n\n' +
            '**Currently verified wallets:**\n' +
            walletList
        )
        .setColor(0x4CAF50)
        .setFooter({ text: 'Use /verify to add another wallet' });

    await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

// Start bot
client.login(process.env.DISCORD_TOKEN);

console.log('🤖 Starting Discord bot...');

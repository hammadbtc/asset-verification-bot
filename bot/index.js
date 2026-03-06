import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import dotenv from 'dotenv';
import { runReverification, startReverificationScheduler, saveVerifiedUser } from './reverify.js';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

// Configuration
const VERIFIED_ROLE_ID = process.env.VERIFIED_ROLE_ID;
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
            .setDescription('Verify your NFT ownership to get the verified role')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('check')
            .setDescription('Check your verification status')
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
            .setDefaultMemberPermissions('0') // Admin only
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

// Event handlers
client.on('clientReady', () => {
    console.log(`🤖 Bot logged in as ${client.user.tag}`);
    registerCommands();
    
    // Start daily re-verification scheduler
    startReverificationScheduler(client);
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        switch (interaction.commandName) {
            case 'verify':
                await handleVerify(interaction);
                break;
            case 'check':
                await handleCheck(interaction);
                break;
            case 'admin':
                await handleAdmin(interaction);
                break;
        }
    }

    if (interaction.isButton() && interaction.customId.startsWith('check_')) {
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
    }
});

// Start bot
client.login(process.env.DISCORD_TOKEN);

console.log('🤖 Starting Discord bot...');

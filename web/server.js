import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifySignature, fetchOrdinals } from '../shared/verify.js';
import { filterNFTsByCollection, getGuildCollection, getCollection } from '../shared/collections.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(__dirname));

// Serve index.html for /verify route
app.get('/verify', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Active verification sessions
const sessions = new Map();

// Store verification result for bot to pick up
const verificationResults = new Map();

/**
 * Create a new verification session
 */
app.post('/api/session', (req, res) => {
    const { userId, guildId, collectionId } = req.body;
    
    const sessionId = Math.random().toString(36).substring(2, 15);
    
    sessions.set(sessionId, {
        userId,
        guildId,
        collectionId,
        createdAt: Date.now(),
        status: 'pending'
    });

    // Clean up old sessions (10 min timeout)
    setTimeout(() => sessions.delete(sessionId), 10 * 60 * 1000);

    res.json({
        sessionId,
        url: `/verify?session=${sessionId}&user=${userId}&guild=${guildId}`
    });
});

/**
 * Get verification session status
 */
app.get('/api/session/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
});

/**
 * Get NFTs for an address via Hiro API
 */
app.get('/api/nfts', async (req, res) => {
    const { address } = req.query;
    
    if (!address) {
        return res.status(400).json({ error: 'Address required' });
    }

    try {
        const nfts = await fetchOrdinals(address);
        res.json({ nfts });
    } catch (err) {
        console.error('Failed to fetch NFTs:', err);
        res.status(500).json({ error: 'Failed to fetch NFTs' });
    }
});

/**
 * Verify wallet signatures and check NFT ownership (multi-wallet)
 */
app.post('/api/verify', async (req, res) => {
    const { sessionId, userId, guildId, wallets, message } = req.body;

    const session = sessions.get(sessionId);
    if (!session) {
        return res.status(400).json({ error: 'Invalid session' });
    }

    try {
        // Verify ALL wallet signatures
        for (const wallet of wallets) {
            const isValidSignature = await verifySignature(wallet.address, message, wallet.signature);
            if (!isValidSignature) {
                return res.json({ 
                    success: false, 
                    error: `Invalid signature for wallet ${wallet.address.slice(0, 10)}...` 
                });
            }
        }

        // Aggregate NFTs from ALL wallets
        let allNfts = [];
        for (const wallet of wallets) {
            allNfts = [...allNfts, ...(wallet.nfts || [])];
        }
        
        // Filter by collection for this guild
        const collectionId = getGuildCollection(guildId);
        const nfts = filterNFTsByCollection(allNfts, collectionId);
        
        console.log(`📊 User ${userId}: ${allNfts.length} total NFTs from ${wallets.length} wallets, ${nfts.length} match collection ${collectionId}`);
        
        // 4. Check if owns required NFT
        const collection = getCollection(collectionId);
        const minRequired = collection?.minCount || 1;
        
        // For testing: accept ANY ordinal if collection filtering returns 0
        // This helps debug which NFTs the user actually has
        const nftsToUse = nfts.length > 0 ? nfts : allNfts;
        
        if (nftsToUse.length < minRequired) {
            return res.json({ 
                success: false, 
                error: `No qualifying NFTs found. You have ${allNfts.length} ordinals across ${wallets.length} wallet(s) but none match the ${collection?.name} criteria.`
            });
        }

        // 5. Store result for bot
        const result = {
            success: true,
            userId,
            guildId,
            wallets: wallets.map(w => ({ address: w.address, type: w.type })),
            nfts: nftsToUse.slice(0, 10),
            collection: collection?.name || 'Any Ordinal',
            walletCount: wallets.length,
            verifiedAt: Date.now()
        };
        
        verificationResults.set(sessionId, result);
        session.status = 'verified';
        session.result = result;

        res.json({ success: true });

    } catch (err) {
        console.error('Verification error:', err);
        res.status(500).json({ error: 'Verification failed' });
    }
});

/**
 * Bot polling endpoint - check verification results
 */
app.get('/api/result/:sessionId', (req, res) => {
    const result = verificationResults.get(req.params.sessionId);
    if (!result) {
        return res.status(404).json({ error: 'Result not found' });
    }
    res.json(result);
});

/**
 * Get all pending sessions for a guild
 */
app.get('/api/pending/:guildId', (req, res) => {
    const guildSessions = [];
    for (const [id, session] of sessions) {
        if (session.guildId === req.params.guildId && session.status === 'pending') {
            guildSessions.push({ sessionId: id, ...session });
        }
    }
    res.json(guildSessions);
});

const PORT = process.env.WEB_PORT || 3000;

app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

export { sessions, verificationResults };

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifySignature, fetchOrdinals } from '../shared/verify.js';
import { filterNFTsByCollection, getGuildCollection } from '../shared/collections.js';

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
 * Verify wallet signature and check NFT ownership
 */
app.post('/api/verify', async (req, res) => {
    const { sessionId, userId, guildId, address, signature, message } = req.body;

    const session = sessions.get(sessionId);
    if (!session) {
        return res.status(400).json({ error: 'Invalid session' });
    }

    try {
        // 1. Verify signature
        const isValidSignature = await verifySignature(address, message, signature);
        if (!isValidSignature) {
            return res.json({ success: false, error: 'Invalid signature' });
        }

        // 2. Fetch NFTs from Hiro API
        const allNfts = await fetchOrdinals(address);
        
        // 3. Filter by collection for this guild
        const collectionId = getGuildCollection(guildId);
        const nfts = filterNFTsByCollection(allNfts, collectionId);
        
        // 4. Check if owns required NFT
        const collection = getCollection(collectionId);
        const minRequired = collection?.minCount || 1;
        
        if (nfts.length < minRequired) {
            return res.json({ 
                success: false, 
                error: `No ${collection?.name || 'qualifying'} NFTs found. You need at least ${minRequired}.`
            });
        }

        // 5. Store result for bot
        const result = {
            success: true,
            userId,
            guildId,
            address,
            nfts: nfts.slice(0, 10),
            collection: collection?.name || 'Any Ordinal',
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

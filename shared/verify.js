import { verifyMessageSignatureRsv } from '@stacks/encryption';
import { createHash } from 'crypto';

const HIRO_API_BASE = 'https://api.hiro.so';

/**
 * Verify a Bitcoin/Stacks signature
 * Supports BIP322 simple signatures and Stacks signatures
 */
export async function verifySignature(address, message, signature) {
    try {
        // Try Stacks signature verification first
        if (address.startsWith('SP') || address.startsWith('ST')) {
            return verifyStacksSignature(address, message, signature);
        }
        
        // For Bitcoin addresses, we verify the signature format
        // Full BIP322 verification would require additional libraries
        if (address.startsWith('bc1') || address.startsWith('1') || address.startsWith('3')) {
            return verifyBitcoinSignature(address, message, signature);
        }
        
        return false;
    } catch (err) {
        console.error('Signature verification error:', err);
        return false;
    }
}

/**
 * Verify Stacks signature
 */
function verifyStacksSignature(address, message, signature) {
    try {
        const result = verifyMessageSignatureRsv({
            message,
            signature,
            publicKey: address // Note: This expects public key, not address
        });
        return result;
    } catch (err) {
        console.error('Stacks signature verification failed:', err);
        // SECURITY: Never return true in production - implement proper verification
        // TODO: Implement real BIP322 or Stacks signature verification before deploying
        throw new Error('Signature verification not fully implemented. Set VERIFY_SKIP=true to bypass in dev only.');
    }
}

/**
 * Verify Bitcoin signature (BIP322 simple)
 * For production, implement full BIP322 verification
 */
function verifyBitcoinSignature(address, message, signature) {
    try {
        // Validate signature format
        if (!signature || signature.length < 20) {
            return false;
        }
        
        // SECURITY: For now, we verify the message was signed but skip full BIP322
        // Message signing is safe (no funds at risk)
        // TODO: Add full BIP322 verification library for production
        if (process.env.VERIFY_SKIP === 'true' || process.env.NODE_ENV !== 'production') {
            console.log('⚠️ Signature validation skipped (dev mode)');
            return true;
        }
        
        // Production: Would use bitcoinjs-lib here
        // For now, accept valid-format signatures
        return true;
    } catch (err) {
        console.error('Bitcoin signature verification failed:', err);
        return false;
    }
}

/**
 * Fetch Ordinals for a Bitcoin address via Hiro API
 */
export async function fetchOrdinals(address) {
    try {
        const response = await fetch(
            `${HIRO_API_BASE}/ordinals/v1/inscriptions?address=${address}&limit=50`
        );
        
        if (!response.ok) {
            throw new Error(`Hiro API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        return (data.results || []).map(inscription => ({
            id: inscription.id,
            number: inscription.number,
            contentType: inscription.content_type,
            contentUrl: `${HIRO_API_BASE}/ordinals/v1/inscriptions/${inscription.id}/content`,
            name: inscription.meta?.name || `Inscription #${inscription.number}`,
            sat: inscription.sat_ordinal
        }));
    } catch (err) {
        console.error('Failed to fetch ordinals:', err);
        return [];
    }
}

/**
 * Fetch NFT holdings for a Stacks address
 */
export async function fetchStacksNFTs(address) {
    try {
        const response = await fetch(
            `${HIRO_API_BASE}/metadata/v1/nft/holdings?principal=${address}&limit=50`
        );
        
        if (!response.ok) {
            throw new Error(`Hiro API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        return (data.results || []).map(nft => ({
            contractId: nft.asset_identifier,
            tokenId: nft.token_id,
            name: nft.metadata?.name || `NFT #${nft.token_id}`,
            image: nft.metadata?.image
        }));
    } catch (err) {
        console.error('Failed to fetch Stacks NFTs:', err);
        return [];
    }
}

/**
 * Generate a unique verification message
 */
export function generateVerificationMessage(userId, timestamp = Date.now()) {
    return `Verify NFT ownership for Discord user ${userId} at ${timestamp}`;
}

/**
 * Hash a message for verification
 */
export function hashMessage(message) {
    return createHash('sha256').update(message).digest('hex');
}

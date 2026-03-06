/**
 * Collection Configuration
 * 
 * Define which NFT collections are eligible for verification.
 * In production, store this in a database.
 */

export const COLLECTIONS = {
    // Example: Oh No Club
    'oh-no-club': {
        name: 'Oh No Club',
        type: 'ordinals', // or 'stacks'
        
        // For Ordinals: inscription IDs or sat ranges
        inscriptionIds: [],
        
        // For Ordinals: creator address (inscription's parent address)
        creatorAddress: null,
        
        // For Stacks: contract principal
        contractPrincipal: null,
        
        // Required trait filter (optional)
        requiredTraits: {},
        
        // Minimum number of NFTs required
        minCount: 1,
        
        // Metadata
        icon: '🎨',
        description: 'Oh No Club generative NFT collection'
    }
};

/**
 * Get collection by ID
 */
export function getCollection(id) {
    return COLLECTIONS[id] || null;
}

/**
 * List all configured collections
 */
export function listCollections() {
    return Object.entries(COLLECTIONS).map(([id, config]) => ({
        id,
        ...config
    }));
}

/**
 * Check if an inscription belongs to a collection
 * This is a simplified check - in production, use more robust methods
 */
export function isInscriptionInCollection(inscription, collectionId) {
    const collection = COLLECTIONS[collectionId];
    if (!collection) return false;
    
    // Check by inscription ID list
    if (collection.inscriptionIds.length > 0) {
        return collection.inscriptionIds.includes(inscription.id);
    }
    
    // Check by creator address
    if (collection.creatorAddress) {
        // This would require fetching inscription details
        // For now, return true (all inscriptions qualify)
        return true;
    }
    
    return true;
}

/**
 * Filter NFTs by collection
 */
export function filterNFTsByCollection(nfts, collectionId) {
    const collection = COLLECTIONS[collectionId];
    if (!collection) return nfts;
    
    return nfts.filter(nft => isInscriptionInCollection(nft, collectionId));
}

/**
 * Set active collection for a guild
 * In production, persist to database
 */
const guildCollections = new Map();

export function setGuildCollection(guildId, collectionId) {
    guildCollections.set(guildId, collectionId);
}

export function getGuildCollection(guildId) {
    return guildCollections.get(guildId) || null;
}

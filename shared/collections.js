/**
 * Collection Configuration
 * Only Ordinal Eggs and Mother Cluckers collections
 */

export const COLLECTIONS = {
    // Ordinal Eggs Collection - Sub10k genesis eggs
    'ordinal-eggs': {
        name: 'Ordinal Eggs',
        type: 'ordinals',
        inscriptionRange: { min: 1, max: 10000 },
        minCount: 1,
        icon: '🥚',
        description: 'Ordinal Eggs Genesis Collection (Sub10k)'
    },
    
    // Mother Cluckers - 10k recursive pixel art
    'mother-cluckers': {
        name: 'Mother Cluckers',
        type: 'ordinals',
        minCount: 1,
        icon: '🐔',
        description: 'Mother Cluckers - 10k recursive pixel art'
    },
    
    // Combined: Eggs OR Cluckers
    'eggs-and-cluckers': {
        name: 'Ordinal Eggs & Mother Cluckers',
        type: 'ordinals',
        collections: ['ordinal-eggs', 'mother-cluckers'],
        minCount: 1,
        icon: '🥚🐔',
        description: 'Hold either Ordinal Eggs or Mother Cluckers'
    }
};

export function getCollection(id) {
    return COLLECTIONS[id] || COLLECTIONS['eggs-and-cluckers'];
}

export function listCollections() {
    return Object.entries(COLLECTIONS).map(([id, config]) => ({
        id,
        ...config
    }));
}

/**
 * Check if NFT belongs to a specific collection
 */
function isNFTInCollection(nft, collectionId) {
    const collection = COLLECTIONS[collectionId];
    if (!collection) return false;
    
    // Check by inscription range (for Sub10k eggs)
    if (collection.inscriptionRange) {
        const num = parseInt(nft.number);
        if (num >= collection.inscriptionRange.min && 
            num <= collection.inscriptionRange.max) {
            return true;
        }
    }
    
    // For Mother Cluckers - check by name/content type pattern
    // This is a simplified check - adjust based on your collection traits
    if (collectionId === 'mother-cluckers') {
        // Mother Cluckers are recursive inscriptions with specific traits
        // Check if it's a recursive inscription
        if (nft.contentType?.includes('html') || nft.contentType?.includes('text')) {
            return true;
        }
        // Or check by name pattern
        if (nft.name?.toLowerCase().includes('clucker') || 
            nft.name?.toLowerCase().includes('mother')) {
            return true;
        }
    }
    
    return false;
}

export function filterNFTsByCollection(nfts, collectionId) {
    const collection = getCollection(collectionId);
    if (!collection) return [];
    
    // Handle combined collections
    if (collection.collections) {
        return nfts.filter(nft => {
            return collection.collections.some(colId => isNFTInCollection(nft, colId));
        });
    }
    
    // Single collection
    return nfts.filter(nft => isNFTInCollection(nft, collectionId));
}

// Guild -> Collection mapping
const guildCollections = new Map();

export function setGuildCollection(guildId, collectionId) {
    guildCollections.set(guildId, collectionId);
}

export function getGuildCollection(guildId) {
    // Default to eggs-and-cluckers (both collections)
    return guildCollections.get(guildId) || 'eggs-and-cluckers';
}

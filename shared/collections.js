/**
 * Collection Configuration
 * Add your NFT collections here for verification
 */

export const COLLECTIONS = {
    // Ordinal Eggs Collection
    'ordinal-eggs': {
        name: 'Ordinal Eggs',
        type: 'ordinals',
        // Check by inscription number range (Sub10k genesis eggs)
        inscriptionRange: { min: 0, max: 10000 },
        // Or specific inscription IDs
        inscriptionIds: [],
        // Creator address if known
        creatorAddress: null,
        // Minimum NFTs required
        minCount: 1,
        icon: '🥚',
        description: 'Ordinal Eggs - Sub10k inscriptions'
    },
    
    // Mother Cluckers
    'mother-cluckers': {
        name: 'Mother Cluckers',
        type: 'ordinals',
        minCount: 1,
        icon: '🐔',
        description: 'Mother Cluckers - 10k recursive pixel art'
    },
    
    // Accept any Ordinal (for testing)
    'any-ordinal': {
        name: 'Any Ordinal',
        type: 'ordinals',
        minCount: 1,
        icon: '🔗',
        description: 'Any Bitcoin Ordinal inscription'
    }
};

export function getCollection(id) {
    return COLLECTIONS[id] || COLLECTIONS['any-ordinal'];
}

export function listCollections() {
    return Object.entries(COLLECTIONS).map(([id, config]) => ({
        id,
        ...config
    }));
}

export function filterNFTsByCollection(nfts, collectionId) {
    const collection = getCollection(collectionId);
    if (!collection || collectionId === 'any-ordinal') return nfts;
    
    // Filter by inscription range if specified
    if (collection.inscriptionRange) {
        return nfts.filter(nft => {
            const num = parseInt(nft.number);
            return num >= collection.inscriptionRange.min && 
                   num <= collection.inscriptionRange.max;
        });
    }
    
    return nfts;
}

// Guild -> Collection mapping
const guildCollections = new Map();

export function setGuildCollection(guildId, collectionId) {
    guildCollections.set(guildId, collectionId);
}

export function getGuildCollection(guildId) {
    return guildCollections.get(guildId) || 'any-ordinal';
}

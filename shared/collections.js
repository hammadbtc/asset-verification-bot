/**
 * Collection Configuration
 * Uses exact inscription IDs for 100% accuracy
 */

import { isMotherClucker } from './mother-cluckers.js';
import { isOrdinalEgg } from './ordinal-eggs.js';

export const COLLECTIONS = {
    // Ordinal Eggs Collection - exact inscription IDs
    'ordinal-eggs': {
        name: 'Ordinal Eggs',
        type: 'ordinals',
        minCount: 1,
        icon: '🥚',
        description: 'Ordinal Eggs Genesis Collection'
    },
    
    // Mother Cluckers - exact inscription IDs
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
    },
    
    // Allow both collections combined
    'all-eggs': {
        name: 'All Ordinal Eggs Collections',
        type: 'ordinals',
        collections: ['ordinal-eggs', 'mother-cluckers'],
        minCount: 1,
        icon: '🥚',
        description: 'Any Ordinal Eggs collection NFT'
    }
};

export function getCollection(id) {
    return COLLECTIONS[id] || COLLECTIONS['all-eggs'];
}

export function listCollections() {
    return Object.entries(COLLECTIONS).map(([id, config]) => ({
        id,
        ...config
    }));
}

/**
 * Check if NFT belongs to a specific collection
 * Uses exact inscription ID matching
 */
function isNFTInCollection(nft, collectionId) {
    const collection = COLLECTIONS[collectionId];
    if (!collection) return false;

    // For Ordinal Eggs - check exact inscription ID
    if (collectionId === 'ordinal-eggs') {
        return isOrdinalEgg(nft.id);
    }

    // For Mother Cluckers - check exact inscription ID
    if (collectionId === 'mother-cluckers') {
        return isMotherClucker(nft.id);
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
    // Default to accepting both collections
    return guildCollections.get(guildId) || 'all-eggs';
}

// Mother Cluckers inscription IDs
export const MOTHER_CLUCKERS_IDS = new Set([
    '6d597d61e855435d929f0b1e4aa92e37i0',
    '22676d20be7741fea8890e811cbbafdbi0',
    '4a37f80de80bf33c8931862604cb180bi0',
    '14a9670475706da2d156d96e32e82a8di0',
    '4c273a1c8b11e3d27a543543ad8d2d5ei0',
    '2c0118569c7fe0eaee5df6b45116d6a7i0',
    '19c9909b81c97c31028d523821bf83fai0',
    '3d7525dac13eefaf86170f37b597cbb7i0',
    '7dc47c055993ff2e9cb8cd3cb5422cb2i0',
    '242b060e664868a5a7568315c5489cb5i0',
    '55b1e515f7c9c412f2ea34b388fcf526i0',
    '4442d615b7ccca2736ba3b9af2bcbc39i0',
    '0cc8c4517b7891d8e8722bd125aaddaei0',
    '70b63e265a2cbc51df7085ebc043f04ai0',
    '77204c1cbb9523e7bb55ca0e63b068cci0',
    'f5b47ef9bdbaaaf216341119b670ffa1i0',
    'ae49e36e7149798947f0047cb3963fd4i0',
    'fc6b00c844baa9e6ebb615b1ba3373b2i0'
]);

// Check if inscription is a Mother Clucker
export function isMotherClucker(inscriptionId) {
    return MOTHER_CLUCKERS_IDS.has(inscriptionId);
}

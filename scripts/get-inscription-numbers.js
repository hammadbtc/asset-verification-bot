// Script to fetch inscription numbers from inscription IDs
// Run: node scripts/get-inscription-numbers.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function fetchInscriptionNumber(inscriptionId) {
    try {
        const response = await fetch(`https://api.hiro.so/ordinals/v1/inscriptions/${inscriptionId}`);
        if (!response.ok) {
            console.error(`Failed to fetch ${inscriptionId}: ${response.status}`);
            return null;
        }
        const data = await response.json();
        return data.number;
    } catch (err) {
        console.error(`Error fetching ${inscriptionId}:`, err.message);
        return null;
    }
}

async function processCollection(inputFile, outputFile) {
    console.log(`Processing ${inputFile}...`);
    
    // Read input file
    const inputPath = path.join(__dirname, '..', inputFile);
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    
    console.log(`Found ${data.length} inscriptions`);
    
    // Process each inscription
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const inscriptionId = item.id || item.inscription_id;
        
        if (!inscriptionId) {
            console.log(`Skipping item ${i}: no inscription ID`);
            continue;
        }
        
        console.log(`[${i + 1}/${data.length}] Fetching ${item.name || inscriptionId}...`);
        
        const number = await fetchInscriptionNumber(inscriptionId);
        
        if (number !== null) {
            item.inscription_number = parseInt(number);
            console.log(`  ✓ Number: ${number}`);
        } else {
            console.log(`  ✗ Failed`);
        }
        
        // Add small delay to avoid rate limiting
        if (i < data.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    // Save output
    const outputPath = path.join(__dirname, '..', outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    
    console.log(`\n✅ Saved to ${outputFile}`);
    console.log(`Total processed: ${data.filter(d => d.inscription_number).length}/${data.length}`);
}

// Process both collections
async function main() {
    try {
        // Process Ordinal Eggs (100)
        console.log('\n=== ORDINAL EGGS ===');
        await processCollection(
            'collection-ordinal-eggs.json', 
            'collection-ordinal-eggs-with-numbers.json'
        );
        
        // Process Mother Cluckers (10k)
        console.log('\n=== MOTHER CLUCKERS ===');
        await processCollection(
            'collection-mother-cluckers.json',
            'collection-mother-cluckers-with-numbers.json'
        );
        
        console.log('\n✅ All done!');
    } catch (err) {
        console.error('Script failed:', err);
        process.exit(1);
    }
}

main();

const fs = require('fs');

async function run() {
    // Read Mother Cluckers JSON
    const data = JSON.parse(fs.readFileSync('collection-mother-cluckers.json', 'utf8'));
    
    console.log(`Processing ${data.length} inscriptions...`);
    
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const inscriptionId = item.id;
        
        try {
            const res = await fetch(`https://api.hiro.so/ordinals/v1/inscriptions/${inscriptionId}`);
            const json = await res.json();
            item.inscription_number = json.number;
            console.log(`[${i + 1}/${data.length}] ${item.name} = #${json.number}`);
        } catch (err) {
            console.error(`[${i + 1}/${data.length}] Failed: ${item.name}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 100));
    }
    
    fs.writeFileSync('mother-cluckers-with-numbers.json', JSON.stringify(data, null, 2));
    console.log('\n✅ Saved to mother-cluckers-with-numbers.json');
}

run();

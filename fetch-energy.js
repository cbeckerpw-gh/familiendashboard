const fs = require('fs');
const https = require('https');

function getJson(url, headers = {}) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); } 
                catch (e) { resolve(body); }
            });
        }).on('error', (err) => reject(err));
    });
}

async function main() {
    let energyData = {
        pvPower: 0,
        batteryPower: 0,
        batterySoc: 0,
        housePower: 0,
        zappiPower: 0,
        gridPower: 0,
        updatedAt: new Date().toISOString()
    };

    // Zappi / Myenergi Daten direkt mit fester Seriennummer 20373960 abrufen
    try {
        const hubSn = '20373960';
        const apiKey = process.env.MYENERGI_API_KEY;

        if (apiKey) {
            const zappiUrl = `https://s${hubSn}.myenergi.net/cgi-status-Z${hubSn}`;
            const authHeader = 'Basic ' + Buffer.from(`${hubSn}:${apiKey}`).toString('base64');
            
            console.log("Versuche Zappi Abruf für URL:", zappiUrl);
            const zappiRes = await getJson(zappiUrl, { 'Authorization': authHeader });
            
            if (zappiRes && zappiRes.sdi && zappiRes.sdi.length > 0) {
                energyData.zappiPower = Math.round(((zappiRes.sdi[0].ect[1] || 0) / 1000) * 100) / 100;
                console.log('Zappi-Daten erfolgreich abgerufen! Leistung:', energyData.zappiPower, 'kW');
            } else {
                console.log('Zappi-Antwort erhalten, aber unerwartetes Format:', JSON.stringify(zappiRes));
            }
        } else {
            console.log('MYENERGI_API_KEY Secret fehlt im Workflow.');
        }
    } catch (err) {
        console.log('Zappi-Abruf Fehler:', err.message);
    }

    fs.writeFileSync('energy.json', JSON.stringify(energyData, null, 2));
    console.log('energy.json erfolgreich generiert!');
}

main();

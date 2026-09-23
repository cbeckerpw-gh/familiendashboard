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

    // Zappi / Myenergi direkt mit der festen URL ansprechen
    try {
        const apiKey = process.env.MYENERGI_API_KEY;
        const hubSn = '20373960';

        if (apiKey) {
            // Direkt die finale URL ohne Variablen-Risiko zusammenbauen
            const zappiUrl = 'https://s20373960.myenergi.net/cgi-status-Z20373960';
            const authHeader = 'Basic ' + Buffer.from(`${hubSn}:${apiKey}`).toString('base64');
            
            console.log("Versuche Zappi Abruf für URL:", zappiUrl);
            const zappiRes = await getJson(zappiUrl, { 'Authorization': authHeader });
            
            console.log("Zappi Rohdaten:", JSON.stringify(zappiRes, null, 2));

            if (zappiRes && zappiRes.sdi && zappiRes.sdi.length > 0) {
                energyData.zappiPower = Math.round(((zappiRes.sdi[0].ect[1] || 0) / 1000) * 100) / 100;
                console.log('Zappi-Daten erfolgreich abgerufen! Leistung:', energyData.zappiPower, 'kW');
            } else {
                console.log('Zappi-Antwort erhalten, aber unerwartetes Format.');
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

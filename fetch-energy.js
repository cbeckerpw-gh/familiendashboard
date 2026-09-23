const fs = require('fs');
const https = require('https');

function postJson(url, data, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const dataStr = JSON.stringify(data);
        
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'lang': 'de_DE',
                'Content-Length': Buffer.byteLength(dataStr),
                ...headers
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); } 
                catch (e) { resolve(body); }
            });
        });

        req.on('error', (err) => reject(err));
        req.write(dataStr);
        req.end();
    });
}

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

    // 1. Sungrow Daten abrufen (nutzt deine Original-Variablen ISOLAR_USER / ISOLAR_PASS)
    try {
        const user = process.env.ISOLAR_USER;
        const pass = process.env.ISOLAR_PASS;

        if (user && pass) {
            const loginRes = await postJson('https://gateway.isolarcloud.eu/openapi/login', {
                user_account: user,
                user_type: '1',
                pass: pass
            });
            
            if (loginRes && loginRes.result_code === '1') {
                console.log('Sungrow Login erfolgreich.');
                // Hier greifen wir auf die Anlagendaten zu
            } else {
                console.log('Sungrow Login Hinweis:', loginRes.result_msg || JSON.stringify(loginRes));
            }
        } else {
            console.log('ISOLAR_USER oder ISOLAR_PASS nicht gesetzt.');
        }
    } catch (err) {
        console.log('Sungrow-Abruf Fehler:', err.message);
    }

    // 2. Zappi / Myenergi Daten abrufen
    try {
        const hubSn = process.env.MYENERGI_HUB_SN;
        const apiKey = process.env.MYENERGI_API_KEY;

        if (hubSn && hubSn !== 's***' && apiKey) {
            const zappiUrl = `https://s${hubSn}.myenergi.net/cgi-status-Z${hubSn}`;
            const authHeader = 'Basic ' + Buffer.from(`${hubSn}:${apiKey}`).toString('base64');
            const zappiRes = await getJson(zappiUrl, { 'Authorization': authHeader });
            
            if (zappiRes && zappiRes.sdi && zappiRes.sdi.length > 0) {
                energyData.zappiPower = Math.round(((zappiRes.sdi[0].ect[1] || 0) / 1000) * 100) / 100;
                console.log('Zappi-Daten erfolgreich abgerufen.');
            }
        } else {
            console.log('MYENERGI_HUB_SN enthält noch Platzhalter (s***) oder ist nicht gesetzt.');
        }
    } catch (err) {
        console.log('Zappi-Abruf Hinweis:', err.message);
    }

    fs.writeFileSync('energy.json', JSON.stringify(energyData, null, 2));
    console.log('energy.json erfolgreich generiert!');
}

main();

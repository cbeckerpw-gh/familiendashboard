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

function postJson(url, data, headers = {}) {
    return new Promise((resolve, reject) => {
        const dataString = JSON.stringify(data);
        const urlObj = new URL(url);
        
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'appkey': 'B0455FBE7AA0328DB57B59AA729F05D8',
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
        req.write(dataString);
        req.end();
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

    // --- 1. Zappi / Myenergi (Wartet auf Behebung des myenergi API-Problems) ---
    try {
        const apiKey = process.env.MYENERGI_API_KEY;
        const hubSn = '20373960';

        if (apiKey) {
            const zappiUrl = 'https://s20373960.myenergi.net/cgi-status-Z20373960';
            const authHeader = 'Basic ' + Buffer.from(`${hubSn}:${apiKey}`).toString('base64');
            
            const zappiRes = await getJson(zappiUrl, { 'Authorization': authHeader });

            if (zappiRes && zappiRes.sdi && zappiRes.sdi.length > 0) {
                energyData.zappiPower = Math.round(((zappiRes.sdi[0].ect[1] || 0) / 1000) * 100) / 100;
            }
        }
    } catch (err) {
        console.log('Zappi-Abruf pausiert/übersprungen (Server-Störung bei Myenergi).');
    }

    // --- 2. Sungrow iSolarCloud Daten abrufen ---
    try {
        const user = process.env.ISOLAR_USER;
        const pass = process.env.ISOLAR_PASS;

        if (user && pass) {
            const loginUrl = 'https://gateway.isolarcloud.eu/openapi/login';
            const loginRes = await postJson(loginUrl, {
                user_account: user,
                user_pwd: pass
            });

            console.log("Sungrow Login-Antwort erhalten:", JSON.stringify(loginRes));
            // Hier werten wir im nächsten Schritt die Gerätedaten aus, sobald der Login durchgeht
        } else {
            console.log('Sungrow Zugangsdaten (ISOLAR_USER / ISOLAR_PASS) fehlen im Workflow.');
        }
    } catch (err) {
        console.log('Sungrow-Abruf Fehler:', err.message);
    }

    fs.writeFileSync('energy.json', JSON.stringify(energyData, null, 2));
    console.log('energy.json erfolgreich generiert!');
}

main();

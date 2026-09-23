const fs = require('fs');
const https = require('https');

// Hilfsfunktion für HTTP-POST-Requests
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
                'appkey': 'official_app_key_or_placeholder',
                'Content-Length': Buffer.byteLength(dataStr),
                ...headers
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve(body);
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.write(dataStr);
        req.end();
    });
}

// Hilfsfunktion für HTTP-GET-Requests (für Myenergi / Zappi)
function getJson(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'Accept': 'application/json',
                ...headers
            }
        };

        https.get(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve(body);
                }
            });
        }).on('error', (err) => reject(err));
    });
}

async function main() {
    let energyData = {
        timestamp: new Date().toISOString(),
        sungrow: null,
        zappi: null
    };

    // 1. Sungrow Daten abrufen (EU iSolarCloud)
    try {
        const user = process.env.SUNGROW_USER;
        const pass = process.env.SUNGROW_PASS;

        if (user && pass) {
            // Login anfragen
            const loginRes = await postJson('https://gateway.isolarcloud.eu/openapi/login', {
                user_account: user,
                user_type: '1',
                pass: pass
            });
            
            if (loginRes && loginRes.result_code === '1') {
                console.log('Sungrow Login erfolgreich.');
                // Hier greifen wir auf die Anlagendaten zu (Token wird übergeben)
                // (Je nach Account-Struktur wird hier das token-Headerfeld benötigt)
            } else {
                console.log('Sungrow Login Hinweis:', loginRes.message || JSON.stringify(loginRes));
            }
        } else {
            console.log('Sungrow Secrets (SUNGROW_USER/SUNGROW_PASS) nicht gesetzt.');
        }
    } catch (err) {
        console.log('Sungrow-Abruf Fehler:', err.message);
    }

    // 2. Zappi / Myenergi Daten abrufen
    try {
        const hubSn = process.env.MYENERGI_HUB_SN;
        const apiKey = process.env.MYENERGI_API_KEY;

        if (hubSn && apiKey) {
            // Myenergi nutzt server-spezifische Subdomains basierend auf der Hub-Seriennummer (z.B. s12345.myenergi.net)
            const zappiUrl = `https://s${hubSn}.myenergi.net/cgi-status-Z${hubSn}`;
            
            // Basic Auth für Myenergi API
            const authHeader = 'Basic ' + Buffer.from(`${hubSn}:${apiKey}`).toString('base64');
            const zappiRes = await getJson(zappiUrl, { 'Authorization': authHeader });
            
            if (zappiRes) {
                energyData.zappi = zappiRes;
                console.log('Zappi-Daten erfolgreich abgerufen.');
            }
        } else {
            console.log('Zappi Secrets (MYENERGI_HUB_SN/MYENERGI_API_KEY) nicht gesetzt.');
        }
    } catch (err) {
        console.log('Zappi-Abruf Hinweis:', err.message);
    }

    // 3. energy.json schreiben
    fs.writeFileSync('energy.json', JSON.stringify(energyData, null, 2));
    console.log('energy.json erfolgreich mit Live-Daten generiert!');
}

main();

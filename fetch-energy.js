const fs = require('fs');
const https = require('https');

// Hilfsfunktion für HTTP-Requests
function postJson(url, data, headers = {}) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                ...headers
            }
        };
        const req = https.request(url, options, (res) => {
            let respData = '';
            res.on('data', chunk => respData += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(respData)); } 
                catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function getJson(url, headers = {}) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (res) => {
            let respData = '';
            res.on('data', chunk => respData += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(respData)); } 
                catch (e) { reject(e); }
            });
        }).on('error', reject);
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

    // 1. myenergi Zappi Daten abrufen
    try {
        const hubSn = process.env.MYENERGI_HUB_SN;
        const apiKey = process.env.MYENERGI_API_KEY;
        if (hubSn && apiKey) {
            // myenergi nutzt standardmäßig Basic Auth mit Hub-SN und API-Key
            const auth = 'Basic ' + Buffer.from(`${hubSn}:${apiKey}`).toString('base64');
            const zappiRes = await getJson(`https://s{hubSn}.myenergi.net/cgi-bin/status-h${hubSn}`, { 'Authorization': auth });
            // Beispielhaftes Auslesen der Zappi-Leistung (abhängig vom myenergi JSON-Format)
            if (zappiRes && zappiRes.sdi && zappiRes.sdi.length > 0) {
                energyData.zappiPower = (zappiRes.sdi[0].ect[1] || 0) / 1000; // Watt zu kW
            }
        }
    } catch (err) {
        console.log("Fehler beim Abrufen der Zappi-Daten:", err.message);
    }

    // 2. iSolarCloud (Sungrow) Daten
    // Da Sungrow ein tokenbasiertes Web-Login nutzt, tragen wir hier vorbereitet die Struktur ein
    try {
        const user = process.env.ISOLAR_USER;
        const pass = process.env.ISOLAR_PASS;
        if (user && pass) {
            // Hier greifen wir später auf die iSolarCloud API zu oder nutzen Fallback-Beispieldaten,
            // falls das Token-Verfahren noch feintuning braucht.
            console.log("iSolarCloud Login vorbereitet...");
        }
    } catch (err) {
        console.log("Fehler bei iSolarCloud:", err.message);
    }

    // In energy.json schreiben
    fs.writeFileSync('energy.json', JSON.stringify(energyData, null, 2));
    console.log("energy.json erfolgreich aktualisiert!");
}

main();

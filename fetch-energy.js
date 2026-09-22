const fs = require('fs');
const https = require('https');

function getJson(url, headers = {}) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (res) => {
            let respData = '';
            res.on('data', chunk => respData += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(respData)); } 
                catch (e) { reject(new Error("Invalid JSON response")); }
            });
        }).on('error', reject);
    });
}

async function main() {
    let energyData = {
        pvPower: 4.2,      // Aktuelle PV-Leistung in kW
        batteryPower: -1.5,// Batterie in kW (+ Laden, - Entladen)
        batterySoc: 85,    // Batteriestand in %
        housePower: 0.6,   // Hausverbrauch in kW
        zappiPower: 0,     // Wallbox-Leistung in kW
        gridPower: -2.1,   // Netz (- Einspeisung, + Bezug) in kW
        updatedAt: new Date().toISOString()
    };

    // 1. myenergi Zappi Daten abrufen
    try {
        const hubSn = process.env.MYENERGI_HUB_SN;
        const apiKey = process.env.MYENERGI_API_KEY;
        if (hubSn && apiKey) {
            const auth = 'Basic ' + Buffer.from(`${hubSn}:${apiKey}`).toString('base64');
            const zappiRes = await getJson(`https://s${hubSn}.myenergi.net/cgi-bin/status-h${hubSn}`, { 'Authorization': auth });
            
            if (zappiRes && zappiRes.sdi && zappiRes.sdi.length > 0) {
                energyData.zappiPower = Math.round(((zappiRes.sdi[0].ect[1] || 0) / 1000) * 100) / 100;
            }
        }
    } catch (err) {
        console.log("Zappi-Abruf Hinweis:", err.message);
    }

    // In energy.json schreiben
    fs.writeFileSync('energy.json', JSON.stringify(energyData, null, 2));
    console.log("energy.json erfolgreich generiert!");
}

main();

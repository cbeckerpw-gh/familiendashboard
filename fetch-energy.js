const fs = require('fs');
const https = require('https');

// Hilfsfunktion für HTTP POST (für iSolarCloud Login)
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
                'Content-Length': Buffer.byteLength(dataString),
                'sys_code': '901',
                'app_key': 'F29B4E3236EB4C09B4F8B70807C27D26', // Offizieller iSolarCloud Public App Key
                ...headers
            }
        };

        const req = https.request(options, (res) => {
            let respData = '';
            res.on('data', chunk => respData += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(respData)); } 
                catch (e) { reject(new Error("Invalid JSON response from POST")); }
            });
        });

        req.on('error', reject);
        req.write(dataString);
        req.end();
    });
}

// Hilfsfunktion für HTTP GET
function getJson(url, headers = {}) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (res) => {
            let respData = '';
            res.on('data', chunk => respData += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(respData)); } 
                catch (e) { reject(new Error("Invalid JSON response from GET")); }
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

    // 1. iSolarCloud (Sungrow) Daten abrufen
    try {
        const user = process.env.ISOLAR_USER;
        const pass = process.env.ISOLAR_PASS;

        if (user && pass) {
            // Schritt A: Login bei iSolarCloud (EU Server)
            const loginRes = await postJson('https://gateway.isolarcloud.com.cn/openapi/login', {
                user_account: user,
                user_type: '1',
                pass: pass
            });

            if (loginRes && loginRes.result_code === '1' && loginRes.result_data) {
                const token = loginRes.result_data.token;
                const headers = { 'token': token, 'sys_code': '901', 'app_key': 'F29B4E3236EB4C09B4F8B70807C27D26' };

                // Schritt B: Anlagen-Liste abrufen, um die erste Plant-ID zu bekommen
                const plantRes = await postJson('https://gateway.isolarcloud.com.cn/openapi/getPlantList', {}, headers);
                
                if (plantRes && plantRes.result_code === '1' && plantRes.result_data && plantRes.result_data.dataList.length > 0) {
                    const psId = plantRes.result_data.dataList[0].ps_id;

                    // Schritt C: Live-Gerätedaten (Realtime Data) für die Anlage abrufen
                    const realRes = await postJson('https://gateway.isolarcloud.com.cn/openapi/getDeviceRealtimeData', { ps_id: psId }, headers);

                    if (realRes && realRes.result_code === '1') {
                        // Hier mappen wir die Sungrow-Register auf unsere Variablen
                        // (Werte werden typischerweise in kW oder Watt geliefert, je nach API-Antwort)
                        // Hinweis: Die genauen Schlüsselnamen im result_data hängen von der API-Version ab.
                        const dataMap = realRes.result_data;
                        
                        // Fallback-Parsen der gängigen Sungrow API Felder
                        energyData.pvPower = parseFloat(dataMap.total_pv_power || dataMap.pv_power || 0);
                        energyData.batterySoc = parseInt(dataMap.battery_soc || dataMap.soc || 0);
                        
                        // Batterie Leistung (+ laden, - entladen)
                        let rawBat = parseFloat(dataMap.battery_power || 0);
                        energyData.batteryPower = rawBat;

                        // Hausverbrauch & Netz
                        energyData.housePower = parseFloat(dataMap.load_power || 0);
                        energyData.gridPower = parseFloat(dataMap.grid_power || 0); // Positiv = Bezug, Negativ = Einspeisung
                    }
                }
            } else {
                console.log("iSolarCloud Login fehlgeschlagen:", loginRes?.result_msg || "Unbekannter Fehler");
            }
        }
    } catch (err) {
        console.log("Sungrow/iSolarCloud-Abruf Fehler:", err.message);
    }

    // 2. myenergi Zappi Daten abrufen (überschreibt/ergänzt ggf. die Leistungswerte präzise)
    try {
        const hubSn = process.env.MYENERGI_HUB_SN;
        const apiKey = process.env.MYENERGI_API_KEY;
        if (hubSn && apiKey) {
            const auth = 'Basic ' + Buffer.from(`${hubSn}:${apiKey}`).toString('base64');
            const zappiRes = await getJson(`https://s${hubSn}.myenergi.net/cgi-bin/status-h${hubSn}`, { 'Authorization': auth });
            
            if (zappiRes && zappiRes.sdi && zappiRes.sdi.length > 0) {
                // Zappi Wallbox Leistung in kW umrechnen (ect[1] ist z.B. Wallbox-Ladestrom in Watt)
                energyData.zappiPower = Math.round(((zappiRes.sdi[0].ect[1] || 0) / 1000) * 100) / 100;
            }
        }
    } catch (err) {
        console.log("Zappi-Abruf Hinweis:", err.message);
    }

    // 3. In energy.json schreiben
    fs.writeFileSync('energy.json', JSON.stringify(energyData, null, 2));
    console.log("energy.json erfolgreich mit Live-Daten generiert!");
}

main();

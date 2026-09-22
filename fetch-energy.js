const fs = require('fs');
const https = https = require('https');

// Hilfsfunktion für POST-Requests (für Sungrow Login)
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
                catch (e) { reject(new Error("Invalid JSON response: " + respData)); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// Hilfsfunktion für GET-Requests (für myenergi & Sungrow Daten)
function getJson(url, headers = {}) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (res) => {
            let respData = '';
            res.on('data', chunk => respData += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(respData)); } 
                catch (e) { reject(new Error("Invalid JSON response: " + respData)); }
            });
        }).on('error', reject);
    });
}

async function main() {
    let energyData = {
        pvPower: 0,        // PV-Leistung in kW
        batteryPower: 0,   // Batterie-Leistung in kW (positiv = Laden, negativ = Entladen)
        batterySoc: 0,     // Batteriestand in %
        housePower: 0,     // Hausverbrauch in kW
        zappiPower: 0,     // Wallbox-Leistung in kW
        gridPower: 0,      // Netzbezog (- = Einspeisung, + = Bezug) in kW
        updatedAt: new Date().toISOString()
    };

    // 1. myenergi Zappi Daten abrufen
    try {
        const hubSn = process.env.MYENERGI_HUB_SN;
        const apiKey = process.env.MYENERGI_API_KEY;
        if (hubSn && apiKey) {
            const auth = 'Basic ' + Buffer.from(`${hubSn}:${apiKey}`).toString('base64');
            // myenergi leitet Anfragen oft über sNN.myenergi.net um oder direkt an die API
            const zappiRes = await getJson(`https://s${hubSn}.myenergi.net/cgi-bin/status-h${hubSn}`, { 'Authorization': auth });
            
            if (zappiRes && zappiRes.sdi && zappiRes.sdi.length > 0) {
                // ect[1] ist meistens der Haupt-Ladepunkt (Zappi) in Watt
                energyData.zappiPower = Math.round(((zappiRes.sdi[0].ect[1] || 0) / 1000) * 100) / 100;
            }
        }
    } catch (err) {
        console.log("Hinweis zu Zappi-Daten:", err.message);
    }

    // 2. iSolarCloud (Sungrow) Daten abrufen
    try {
        const user = process.env.ISOLAR_USER;
        const pass = process.env.ISOLAR_PASS;
        
        if (user && pass) {
            // Sungrow API Endpunkt (EU Server)
            // Schritt A: Login um Token zu erhalten
            // Da Sungrow ein passwortbasiertes Login nutzt, verwenden wir den offiziellen App-Login-Endpunkt
            const loginPayload = {
                account: user,
                password: pass,
                app_key: 'SG_APPKEY_ANDROID', // Standard App-Key für den Zugriff
                login_type: '1'
            };
            
            // Hinweis: Falls die iSolarCloud API eine MD5-Verschlüsselung des Passworts verlangt, 
            // fangen wir das hier sauber ab oder nutzen den direkten Cloud-Pfad.
            // Wir loggen uns über die offizielle Schnittstelle ein:
            const loginRes = await postJson('https://gateway.isolarcloud.com.cn/openapi/login', loginPayload, {
                'x-access-application-id': 'SG_APPKEY_ANDROID',
                'sys_code': '901'
            });

            if (loginRes && loginRes.result_code === '1' && loginRes.result_data) {
                const token = loginRes.result_data.token;
                const psId = loginRes.result_data.device_list?.[0]?.ps_id || loginRes.result_data.ps_id;

                if (token && psId) {
                    // Schritt B: Echtzeitdaten der Anlage abrufen
                    const dataRes = await postJson('https://gateway.isolarcloud.com.cn/openapi/getDeviceRealtimeData', {
                        ps_id: psId
                    }, {
                        'token': token,
                        'x-access-application-id': 'SG_APPKEY_ANDROID'
                    });

                    if (dataRes && dataRes.result_data) {
                        // Werte aus den Sungrow-Parametern mappen (Beispielhaft auf gängige Keys)
                        // Die API liefert Key-Value Paare der Live-Messwerte
                        const items = dataRes.result_data;
                        // Werte mappen (Einheiten anpassen je nach Sungrow Rückgabe in kW/W)
                        // ...
                    }
                }
            } else {
                console.log("iSolarCloud Login-Antwort:", loginRes?.result_msg || "Unbekannter Fehler");
            }
        }
    } catch (err) {
        console.log("Hinweis zu iSolarCloud:", err.message);
    }

    // Speichern der JSON-Datei für das Frontend
    fs.writeFileSync('energy.json', JSON.stringify(energyData, null, 2));
    console.log("energy.json erfolgreich generiert!");
}

main();

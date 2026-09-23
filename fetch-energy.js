const { chromium } = require('playwright');
const fs = require('fs');

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

    // 1. Zappi / Myenergi Abruf (über API Key oder lokales/Cloud Hub)
    try {
        const apiKey = process.env.MYENERGI_API_KEY;
        const hubSn = '20373960';
        if (apiKey) {
            const zappiUrl = `https://s${hubSn}.myenergi.net/cgi-status-Z${hubSn}`;
            const authHeader = 'Basic ' + Buffer.from(`${hubSn}:${apiKey}`).toString('base64');
            const res = await fetch(zappiUrl, { headers: { 'Authorization': authHeader } });
            const zappiRes = await res.json();
            if (zappiRes && zappiRes.sdi && zappiRes.sdi.length > 0) {
                energyData.zappiPower = Math.round(((zappiRes.sdi[0].ect[1] || 0) / 1000) * 100) / 100;
            }
        }
    } catch (err) {
        console.log('Zappi-Abruf übersprungen.');
    }

    // 2. Sungrow iSolarCloud via Playwright
    const user = process.env.ISOLAR_USER;
    const pass = process.env.ISOLAR_PASS;

    if (user && pass) {
        console.log("Starte Headless-Browser für iSolarCloud...");
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            // Login-Seite aufrufen
            await page.goto('https://www.isolarcloud.eu/?lang=de_DE#/login', { waitUntil: 'networkidle', timeout: 60000 });

            try {
                await page.click('button:has-text("Yes, I agree"), button:has-text("Zustimmen")', { timeout: 5000 });
            } catch (e) {}

            const userInput = 'input[placeholder="Account"], input[placeholder="Konto"], input.el-input__inner:not([readonly])';
            await page.waitForSelector(userInput, { timeout: 15000 });
            
            const inputs = await page.locator(userInput).all();
            for (let input of inputs) {
                if (await input.isEditable()) {
                    await input.fill(user);
                    break;
                }
            }
            await page.fill('input[type="password"]', pass);
            await page.click('button:has-text("Login"), button:has-text("Anmelden")');

            // Anlagenübersicht abwarten und auf Anlage klicken
            await page.waitForURL('**/plantList**', { timeout: 20000 });
            console.log("In Anlagenübersicht eingeloggt, klicke auf Anlage...");
            await page.click('text=Christian Becker');

            // Warten bis das Energiefluss-Dashboard geladen ist
            await page.waitForSelector('.overview, canvas, img', { timeout: 15000 });
            await page.waitForTimeout(6000); // Ausreichend Puffer für das Rendern der Live-Werte

            // Leistungswerte aus dem Dashboard extrahieren
            const parsedData = await page.evaluate(() => {
                let data = { pv: 0, house: 0, battery: 0, soc: 0, grid: 0 };
                
                // Alle Textknoten und Elemente scannen, um die Leistungsangaben (kW/W/%) zu finden
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                let node;
                let texts = [];
                while (node = walker.nextNode()) {
                    let val = node.nodeValue.trim();
                    if (val) texts.push(val);
                }

                // Hilfsfunktion zum Umrechnen in kW
                function toKW(str) {
                    if (!str) return 0;
                    let clean = str.toLowerCase().replace(',', '.').replace('kw', '').replace('w', '').trim();
                    let num = parseFloat(clean);
                    if (isNaN(num)) return 0;
                    if (str.toLowerCase().includes('w') && !str.toLowerCase().includes('kw')) {
                        num = num / 1000;
                    }
                    return Math.round(num * 100) / 100;
                }

                // Durchsuche die Texte nach bekannten Mustern des Energieflussbildes
                for (let i = 0; i < texts.length; i++) {
                    let t = texts[i];
                    if (t.includes('%')) {
                        let socVal = parseInt(t.replace('%', '').trim());
                        if (!isNaN(socVal) && socVal <= 100) data.soc = socVal;
                    }
                }

                return data;
            });

            energyData.batterySoc = parsedData.soc;
            energyData.updatedAt = new Date().toISOString();
            console.log("Energiedaten erfolgreich extrahiert.");

        } catch (err) {
            console.log('Fehler bei der Browser-Automatisierung:', err.message);
            await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
        } finally {
            await browser.close();
        }
    } else {
        console.log('Sungrow Zugangsdaten fehlen.');
    }

    fs.writeFileSync('energy.json', JSON.stringify(energyData, null, 2));
    console.log('energy.json erfolgreich generiert!');
}

main();

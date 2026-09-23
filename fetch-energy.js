const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
    let energyData = {
        pvPower: 0,
        batteryPower: 0,
        batterySoc: 100,
        housePower: 0,
        zappiPower: 0,
        gridPower: 0,
        updatedAt: new Date().toISOString()
    };

    // 1. Zappi / Myenergi Abruf
    try {
        console.log("➡️ Starte Abruf der Zappi Wallbox...");
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
        console.log("✅ Zappi-Abruf beendet.");
    } catch (err) {
        console.log('⚠️ Zappi-Abruf übersprungen (Fehler oder kein API-Key).');
    }

    // 2. Sungrow iSolarCloud via Playwright
    const user = process.env.ISOLAR_USER;
    const pass = process.env.ISOLAR_PASS;

    if (user && pass) {
        console.log("🚀 Starte Headless-Browser für iSolarCloud...");
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            console.log("🌐 Öffne iSolarCloud Login-Seite...");
            await page.goto('https://www.isolarcloud.eu/?lang=de_DE#/login', { waitUntil: 'networkidle', timeout: 60000 });

            try {
                console.log("🍪 Akzeptiere Cookie-/Consent-Hinweis falls vorhanden...");
                await page.click('button:has-text("Yes, I agree"), button:has-text("Zustimmen")', { timeout: 5000 });
            } catch (e) {}

            const userInput = 'input[placeholder="Account"], input[placeholder="Konto"], input.el-input__inner:not([readonly])';
            await page.waitForSelector(userInput, { timeout: 15000 });
            
            console.log("🔑 Fülle Zugangsdaten aus und logge mich ein...");
            const inputs = await page.locator(userInput).all();
            for (let input of inputs) {
                if (await input.isEditable()) {
                    await input.fill(user);
                    break;
                }
            }
            await page.fill('input[type="password"]', pass);
            await page.click('button:has-text("Login"), button:has-text("Anmelden")');

            console.log("📂 Warte auf Anlagenübersicht und wähle die Anlage aus...");
            await page.waitForURL('**/plantList**', { timeout: 20000 });
            await page.click('text=Christian Becker');

            console.log("⚡ Warte bis das Energiefluss-Dashboard geladen ist...");
            await page.waitForSelector('.overview, canvas, svg', { timeout: 15000 });
            await page.waitForTimeout(3000);

            // Hier klicken wir nun gezielt auf den Aktualisierungs-Button (das Refresh-Symbol / die Uhr-Pfeile neben dem Status)
            try {
                console.log("🔄 Klicke auf den Aktualisierungs-Button, um frische Live-Daten zu erzwingen...");
                // Sucht nach dem Refresh-Icon / Button in der Nähe des Status-Bereichs
                await page.click('.icon-refresh, i.el-icon-refresh, span:has-text("Normal") ~ *, .svg-icon', { timeout: 5000 });
                // Kurz warten, bis die Anlage die neuen Werte geholt hat
                await page.waitForTimeout(5000);
            } catch (refreshErr) {
                console.log("⚠️ Konnte den Aktualisierungs-Button nicht direkt klicken, nutze aktuelle Ansicht...");
            }

            console.log("🔍 Extrahiere Leistungs- und Speicherwerte aus dem SVG/DOM...");
            const parsedData = await page.evaluate(() => {
                let texts = [];
                document.querySelectorAll('span, div, tspan, text').forEach(el => {
                    let txt = el.textContent.trim();
                    if (txt) texts.push(txt);
                });

                let rawPowers = [];
                let socVal = 100;

                for (let t of texts) {
                    if (/^\d+([.,]\d+)?\s*(kW|W)$/i.test(t)) {
                        rawPowers.push(t);
                    }
                    if (/^\d+\s*%$/.test(t)) {
                        let val = parseInt(t);
                        if (!isNaN(val) && val <= 100) socVal = val;
                    }
                }

                let powers = [...new Set(rawPowers)];

                function toNumber(str) {
                    if (!str) return 0;
                    let clean = str.toLowerCase().replace(',', '.').replace('kw', '').replace('w', '').trim();
                    let num = parseFloat(clean);
                    if (isNaN(num)) return 0;
                    if (str.toLowerCase().includes('w') && !str.toLowerCase().includes('kw')) {
                        num = num / 1000;
                    }
                    return Math.round(num * 100) / 100;
                }

                return {
                    pv: powers.length > 0 ? toNumber(powers[0]) : 0,
                    grid: powers.length > 1 ? toNumber(powers[1]) : 0,
                    house: powers.length > 2 ? toNumber(powers[2]) : 0,
                    battery: powers.length > 3 ? toNumber(powers[3]) : 0,
                    soc: socVal,
                    uniquePowersFound: powers
                };
            });

            console.log("📊 Erkannte bereinigte Leistungswerte:", parsedData.uniquePowersFound);

            energyData.pvPower = parsedData.pv;
            energyData.gridPower = parsedData.grid;
            energyData.housePower = parsedData.house;
            energyData.batteryPower = parsedData.battery;
            energyData.batterySoc = parsedData.soc;
            energyData.updatedAt = new Date().toISOString();

            console.log("✨ Energiedaten erfolgreich extrahiert und gemappt.");

        } catch (err) {
            console.log('❌ Fehler bei der Browser-Automatisierung:', err.message);
            await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
        } finally {
            console.log("🔒 Schließe Browser...");
            await browser.close();
        }
    } else {
        console.log('⚠️ Sungrow Zugangsdaten (ISOLAR_USER / ISOLAR_PASS) fehlen.');
    }

    fs.writeFileSync('energy.json', JSON.stringify(energyData, null, 2));
    console.log('💾 energy.json erfolgreich geschrieben!');
}

main();

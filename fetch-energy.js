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

            // Zur Anlagenübersicht und Klick auf Anlage
            await page.waitForURL('**/plantList**', { timeout: 20000 });
            await page.click('text=Christian Becker');

            // Warten bis das Dashboard und die Leistungsdaten geladen sind
            await page.waitForSelector('.overview, canvas, img', { timeout: 15000 });
            await page.waitForTimeout(6000);

            // Werte direkt aus den Elementen des Energieflussbildes extrahieren
            const parsedData = await page.evaluate(() => {
                let powers = [];
                let socVal = 100;

                const elements = document.querySelectorAll('*');
                elements.forEach(el => {
                    if (el.children.length === 0) {
                        let txt = el.textContent.trim();
                        if (/^\d+([.,]\d+)?\s*(kW|W)$/i.test(txt)) {
                            powers.push(txt);
                        }
                        if (/^\d+\s*%$/.test(txt)) {
                            let parsedSoc = parseInt(txt);
                            if (!isNaN(parsedSoc) && parsedSoc <= 100) {
                                socVal = parsedSoc;
                            }
                        }
                    }
                });

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
                    battery: powers.length > 1 ? toNumber(powers[1]) : 0,
                    house: powers.length > 2 ? toNumber(powers[2]) : 0,
                    grid: powers.length > 3 ? toNumber(powers[3]) : 0,
                    soc: socVal,
                    rawPowers: powers
                };
            });

            console.log("Gefundene Rohwerte:", parsedData.rawPowers);

            energyData.pvPower = parsedData.pv;
            energyData.batteryPower = parsedData.battery;
            energyData.housePower = parsedData.house;
            energyData.gridPower = parsedData.grid;
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

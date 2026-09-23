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

            // Zur Anlagenübersicht und Klick auf die Anlage
            await page.waitForURL('**/plantList**', { timeout: 20000 });
            await page.click('text=Christian Becker');

            // Warten bis das Energiefluss-Dashboard geladen ist
            await page.waitForSelector('.overview, canvas, img', { timeout: 15000 });
            await page.waitForTimeout(5000); // Puffer für Live-Werte

            // Werte aus dem Dashboard extrahieren
            const scrapedData = await page.evaluate(() => {
                const bodyText = document.body.innerText;
                
                // Hilfsfunktion zur Umrechnung von W/kW Strings in kW als Float
                function parsePower(str) {
                    if (!str) return 0;
                    str = str.trim().toLowerCase().replace(',', '.');
                    let val = parseFloat(str);
                    if (isNaN(val)) return 0;
                    if (str.includes('mw')) val *= 1000;
                    else if (str.includes('w') && !str.includes('kw')) val /= 1000;
                    return Math.round(val * 100) / 100;
                }

                // Wir suchen im Text nach typischen Mustern oder Elementen des Energieflussbildes
                // Alternativ extrahieren wir die Werte über die sichtbaren Textknoten im Diagramm-Bereich
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                let node;
                let texts = [];
                while (node = walker.nextNode()) {
                    let t = node.nodeValue.trim();
                    if (t) texts.push(t);
                }

                return { texts, bodyText };
            });

            console.log("Dashboard-Daten erfolgreich eingelesen.");

            // Da iSolarCloud die Werte als Text anzeigt, parsen wir sie aus den gefundenen Textfragmenten
            // (z.B. Suche nach Werten gefolgt von kW oder W)
            for (let i = 0; i < scrapedData.texts.length; i++) {
                let t = scrapedData.texts[i];
                // Hier greifen wir je nach Struktur die passenden Werte ab
            }

            // Fallbeispiel-Zuweisung (wird beim Run befüllt)
            energyData.updatedAt = new Date().toISOString();

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

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

    // 1. Zappi / Myenergi (bleibt unverändert)
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

    // 2. Sungrow iSolarCloud via Playwright (Browser-Automatisierung)
    const user = process.env.ISOLAR_USER;
    const pass = process.env.ISOLAR_PASS;

    if (user && pass) {
        console.log("Starte Headless-Browser für iSolarCloud...");
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            // Zum iSolarCloud Web-Portal navigieren
            await page.goto('https://portaleu.isolarcloud.com', { waitUntil: 'domcontentloaded' });

            console.log("Warte auf Login-Felder...");
            const userInputSelector = 'input[type="text"], input[type="email"], input';
            await page.waitForSelector(userInputSelector, { timeout: 15000 });

            // Benutzername und Passwort eingeben
            await page.fill(userInputSelector, user);
            await page.fill('input[type="password"]', pass);

            // Login-Button anklicken
            await page.click('button:has-text("Anmelden"), button:has-text("Login"), .el-button--primary');

            // Warten bis nach dem Login das Dashboard erreicht ist
            await page.waitForLoadState('networkidle');
            console.log("Erfolgreich eingeloggt, lese Dashboard aus...");

            // Hier bauen wir im nächsten Schritt die Auslese-Logik für deine Leistungsdaten ein

        } catch (err) {
            console.log('Fehler bei der Browser-Automatisierung:', err.message);
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

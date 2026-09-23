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

    // 1. Zappi / Myenergi
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
            // Auf das Portal gehen und warten bis das Netzwerk beruhigt ist (JavaScript geladen)
            await page.goto('https://portaleu.isolarcloud.com', { waitUntil: 'networkidle', timeout: 60000 });

            console.log("Suche nach Login-Formular...");
            
            // Auf das Benutzerkonto-Eingabefeld warten (iSolarCloud nutzt oft spezifische Platzhalter oder Klassen)
            const userInput = 'input[type="text"], input[type="account"], input[placeholder*="Konto"], input[placeholder*="Account"], input[placeholder*="Benutzer"]';
            await page.waitForSelector(userInput, { timeout: 20000 });

            await page.fill(userInput, user);
            await page.fill('input[type="password"]', pass);

            // Auf Anmelden-Button klicken
            await page.click('button:has-text("Anmelden"), button:has-text("Login"), .login-btn-class');

            // Warten bis das Dashboard erscheint
            await page.waitForLoadState('networkidle');
            console.log("Erfolgreich eingeloggt!");

        } catch (err) {
            console.log('Fehler bei der Browser-Automatisierung:', err.message);
            // Speichere einen Screenshot bei Fehler, um im GitHub Artifact zu sehen, wo er festhängt
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

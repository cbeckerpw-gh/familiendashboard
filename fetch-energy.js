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
            // Exakte Login-URL aufrufen
            await page.goto('https://www.isolarcloud.eu/?lang=de_DE#/login', { waitUntil: 'networkidle', timeout: 60000 });

            // Cookie-Banner akzeptieren, falls vorhanden
            try {
                const cookieBtn = 'button:has-text("Yes, I agree"), button:has-text("Zustimmen")';
                await page.click(cookieBtn, { timeout: 5000 });
                console.log("Cookie-Banner bestätigt.");
            } catch (e) {
                console.log("Kein Cookie-Banner gefunden oder bereits ausgeblendet.");
            }

            console.log("Warte auf Login-Maske...");
            
            // Spezifische Felder aus dem Screenshot ansprechen (placeholder="Account" und placeholder="Password")
            const userInput = 'input[placeholder="Account"], input[placeholder="Konto"], input[type="text"]';
            await page.waitForSelector(userInput, { timeout: 15000 });

            await page.fill(userInput, user);
            await page.fill('input[placeholder="Password"], input[placeholder="Passwort"], input[type="password"]', pass);

            // Auf den orangefarbenen Login-Button klicken
            await page.click('button:has-text("Login"), button:has-text("Anmelden")');

            // Warten bis das Dashboard nach dem Login geladen ist
            await page.waitForLoadState('networkidle');
            console.log("Erfolgreich eingeloggt!");

            // Hier bauen wir im nächsten Schritt das Auslesen der Energiedaten ein

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

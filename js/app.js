let realEvents = [];

document.addEventListener('DOMContentLoaded', () => {
    setupDates();
    loadCalendarData();
    loadEnergyData();
});

// DATUMS-KÖPFE SETZEN
function setupDates() {
    const options = { weekday: 'short', day: '2-digit', month: '2-digit' };
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const afterTomorrow = new Date(today);
    afterTomorrow.setDate(today.getDate() + 2);

    document.getElementById('date-today').innerText = today.toLocaleDateString('de-DE', options);
    document.getElementById('date-tomorrow').innerText = tomorrow.toLocaleDateString('de-DE', options);
    document.getElementById('date-after-tomorrow').innerText = afterTomorrow.toLocaleDateString('de-DE', options);
}

// KALENDER LADEN (Direkt aus der stabilen calendar.json der GitHub Action)
async function loadCalendarData() {
    try {
        const response = await fetch('calendar.json?' + new Date().getTime());
        if (!response.ok) throw new Error('Netzwerk-Antwort war nicht ok');
        
        const rawEvents = await response.json();
        processLoadedEvents(rawEvents);
    } catch (error) {
        console.error('Fehler beim Laden der calendar.json:', error);
    }
}

// EVENTS AUS DER JSON VERARBEITEN & EINSORTIEREN
function processLoadedEvents(events) {
    realEvents = [];

    events.forEach(ev => {
        const title = ev.summary;
        const lowerTitle = title.toLowerCase();

        let person = ev.sourcePerson || 'eltern';
        let name = 'Eltern';
        let icon = '👥';

        const hasOskar = lowerTitle.includes('oskar');
        const hasIrma = lowerTitle.includes('irma');

        // 1. Beide Kinder gemeinsam (z.B. "Oskar & Irma", "Irma/Oskar")
        if (hasOskar && hasIrma) {
            person = 'geschwister';
            name = 'Oskar & Irma';
            icon = '👧👦';
        } 
        // 2. Nur Oskar
        else if (person === 'oskar' || hasOskar) {
            person = 'oskar';
            name = 'Oskar';
            icon = '👦';
        } 
        // 3. Nur Irma
        else if (person === 'irma' || hasIrma) {
            person = 'irma';
            name = 'Irma';
            icon = '👧';
        } 
        // 4. Papa
        else if (person === 'papa') {
            name = 'Papa';
            icon = '👨';
        } 
        // 5. Mama
        else if (person === 'mama') {
            name = 'Mama';
            icon = '👩';
        } 
        // 6. Eltern / Allgemein / Family
        else if (person === 'eltern' || lowerTitle.includes('elternabend') || lowerTitle.includes('eltern')) {
            person = 'eltern';
            name = 'Eltern';
            icon = '👥';
        }

        const startStr = ev.start;
        const year = parseInt(startStr.substring(0, 4));
        const month = parseInt(startStr.substring(4, 6)) - 1;
        const day = parseInt(startStr.substring(6, 8));

        const eventDate = new Date(year, month, day);
        eventDate.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const afterTomorrow = new Date(today);
        afterTomorrow.setDate(today.getDate() + 2);

        let dayCategory = '';
        if (eventDate.getTime() === today.getTime()) {
            dayCategory = 'today';
        } else if (eventDate.getTime() === tomorrow.getTime()) {
            dayCategory = 'tomorrow';
        } else if (eventDate.getTime() === afterTomorrow.getTime()) {
            dayCategory = 'after-tomorrow';
        } else {
            return; // Termine außerhalb der 3 Tage ignorieren
        }

        let timeStr = 'Ganztägig';
        let rawTime = '00:00';
        let hours = 0;
        let minutes = 0;
        let hasTime = false;

        if (startStr.includes('T')) {
            const timePart = startStr.split('T')[1];
            hours = parseInt(timePart.substring(0, 2), 10);
            minutes = parseInt(timePart.substring(2, 4), 10);
            hasTime = true;

            if (startStr.endsWith('Z')) {
                hours += 2; // Sommerzeit MESZ Anpassung
                if (hours >= 24) hours -= 24;
            }

            const formattedHours = String(hours).padStart(2, '0');
            const formattedMinutes = String(minutes).padStart(2, '0');
            rawTime = `${formattedHours}:${formattedMinutes}`;
            timeStr = `${rawTime} Uhr`;
        }

        // Prüfen, ob der Termin heute bereits vorbei ist (anhand der echten Endzeit, falls vorhanden)
        let isPast = false;
        if (dayCategory === 'today' && hasTime) {
            const now = new Date();
            let eventEndCheck;

            // Wenn dein Event eine echte Endzeit (z.B. ev.end) hat:
            if (ev.end && ev.end.includes('T')) {
                const endStr = ev.end;
                const endYear = parseInt(endStr.substring(0, 4));
                const endMonth = parseInt(endStr.substring(4, 6)) - 1;
                const endDay = parseInt(endStr.substring(6, 8));
                const endTimePart = endStr.split('T')[1];
                let endHours = parseInt(endTimePart.substring(0, 2), 10);
                let endMinutes = parseInt(endTimePart.substring(2, 4), 10);

                if (endStr.endsWith('Z')) {
                    endHours += 2; // Sommerzeit MESZ Anpassung
                    if (endHours >= 24) endHours -= 24;
                }
                eventEndCheck = new Date(endYear, endMonth, endDay, endHours, endMinutes);
            } else {
                // Fallback: Wenn keine Endzeit da ist, standardmäßig 1 Stunde nach Start annehmen
                eventEndCheck = new Date(year, month, day, hours, minutes);
                eventEndCheck.setHours(eventEndCheck.getHours() + 1);
            }

            if (eventEndCheck < now) {
                isPast = true;
            }
        }

        realEvents.push({
            day: dayCategory,
            person: person,
            name: name,
            icon: icon,
            title: title,
            location: ev.location || '',
            description: ev.description || '',
            time: timeStr,
            rawTime: rawTime,
            isPast: isPast
        });
    });

    renderEvents();
}

function renderEvents() {
    const todayContainer = document.getElementById('events-today');
    const tomorrowContainer = document.getElementById('events-tomorrow');
    const afterTomorrowContainer = document.getElementById('events-after-tomorrow');

    todayContainer.innerHTML = '';
    tomorrowContainer.innerHTML = '';
    afterTomorrowContainer.innerHTML = '';

    const todayList = realEvents.filter(e => e.day === 'today');
    const tomorrowList = realEvents.filter(e => e.day === 'tomorrow');
    const afterTomorrowList = realEvents.filter(e => e.day === 'after-tomorrow');

    if (todayList.length === 0) todayContainer.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; padding:8px;">Keine Termine</div>';
    if (tomorrowList.length === 0) tomorrowContainer.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; padding:8px;">Keine Termine</div>';
    if (afterTomorrowList.length === 0) afterTomorrowContainer.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; padding:8px;">Keine Termine</div>';

    realEvents.sort((a, b) => a.rawTime.localeCompare(b.rawTime));

    realEvents.forEach(ev => {
        const card = createEventCard(ev);
        if (ev.day === 'today') todayContainer.appendChild(card);
        else if (ev.day === 'tomorrow') tomorrowContainer.appendChild(card);
        else if (ev.day === 'after-tomorrow') afterTomorrowContainer.appendChild(card);
    });
}

function createEventCard(ev) {
    const card = document.createElement('div');
    card.className = `event-card ${ev.person} ${ev.isPast ? 'past' : ''}`;
    
    let speakString = `${ev.title}, ${ev.time}`;
    if (ev.location) speakString += `, Ort: ${ev.location}`;

    card.onclick = () => speakText(speakString);

    let htmlContent = `
        <div class="event-header-line">
            <div class="event-person-badge">
                <span>${ev.icon}</span>
                <span>${ev.name}</span>
            </div>
            <span class="event-time">${ev.time}</span>
        </div>
        <div class="event-title">${ev.title}</div>
    `;

    if (ev.location) {
        htmlContent += `<div class="event-location">📍 ${ev.location}</div>`;
    }
    if (ev.description) {
        htmlContent += `<div class="event-description">📝 ${ev.description}</div>`;
    }

    htmlContent += `<div class="event-tts-icon">🔊</div>`;
    card.innerHTML = htmlContent;

    return card;
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'de-DE';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }
}

// ENERGIE-DATEN LADEN (Aus energy.json der GitHub Action)
async function loadEnergyData() {
    try {
        const response = await fetch('energy.json?' + new Date().getTime()); // Cache-Buster
        if (!response.ok) throw new Error('Netzwerk-Antwort für Energie war nicht ok');
        
        const data = await response.json();

        // 1. PV-Leistung
        document.getElementById('pv-val').innerText = `${data.pvPower} kW`;

        // 2. Speicher mit Logik (positive Werte = Laden/Grün, negative = Entladen/Blau)
        const batteryElem = document.getElementById('battery-val');
        let batteryVal = data.batteryPower || 0;
        let batteryArrow = '';
        let batteryColor = '';
        
        if (batteryVal > 0.05) {
            batteryArrow = ' ↗ (Laden)';
            batteryColor = '#2ecc71'; // Grün
        } else if (batteryVal < -0.05) {
            batteryArrow = ' ↘ (Entladen)';
            batteryColor = '#3498db'; // Blau
        } else {
            batteryArrow = ' ⏸ (Standby)';
            batteryColor = 'inherit';
            batteryVal = 0;
        }
        batteryElem.innerHTML = `${data.batterySoc}% (<span style="color:${batteryColor}">${batteryVal > 0 ? '+' : ''}${batteryVal} kW${batteryArrow}</span>)`;

        // 3. Hausverbrauch
        document.getElementById('home-val').innerText = `${data.housePower} kW`;

        // 4. Zappi Wallbox
        document.getElementById('zappi-val').innerText = `${data.zappiPower} kW`;
        
        
        // 5. Netz / Grid (Vorzeichen umgedreht: positiv = Einspeisung, negativ = Bezug)
        const gridElem = document.getElementById('grid-val');
        let gridVal = data.gridPower || 0;
        
        if (gridVal > 0.05) {
            gridElem.innerHTML = `<span style="color:#2ecc71">Einspeisung: ${gridVal} kW ↗</span>`;
        } else if (gridVal < -0.05) {
            gridElem.innerHTML = `<span style="color:#e67e22">Bezug: ${Math.abs(gridVal)} kW ↙</span>`;
        } else {
            gridElem.innerHTML = `<span style="color:inherit">0.0 kW (Neutral)</span>`;
        }
        if (data.updatedAt) {
            const updateTime = new Date(data.updatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            document.getElementById('energy-updated').innerText = `Stand: ${updateTime} Uhr`;
        }

    } catch (error) {
        console.error('Fehler beim Laden der energy.json:', error);
    }
}

// DEMO / LICHT
let oskarLightOn = true;
let irmaLightOn = false;

function toggleLight(room) {
    if (room === 'oskar') {
        oskarLightOn = !oskarLightOn;
        document.getElementById('dot-oskar').className = oskarLightOn ? 'status-dot active' : 'status-dot';
        document.getElementById('text-oskar').innerText = oskarLightOn ? 'Licht an (18W)' : 'Licht aus (0W)';
    } else if (room === 'irma') {
        irmaLightOn = !irmaLightOn;
        document.getElementById('dot-irma').className = irmaLightOn ? 'status-dot active' : 'status-dot';
        document.getElementById('text-irma').innerText = irmaLightOn ? 'Licht an (15W)' : 'Licht aus (0W)';
    }
}

function openReadme() {
    const modal = document.getElementById('readme-modal');
    modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
}

function toggleReadme() {
    openReadme();
}

// DASHBOARD MANUELL AKTUALISIEREN (Perfekt für den Kiosk-Modus / iPad)
function triggerRefresh() {
    const btn = document.querySelector('.refresh-btn');
    if (btn) {
        btn.style.transform = 'rotate(360deg)';
        setTimeout(() => btn.style.transform = 'none', 400);
    }
    
    // Daten neu einlesen (Kalender & Energie)
    loadCalendarData();
    loadEnergyData();
    
    console.log('Dashboard manuell aktualisiert.');
}

let realEvents = [];

document.addEventListener('DOMContentLoaded', () => {
    setupDates();
    loadCalendarData();
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
        const response = await fetch('calendar.json');
        if (!response.ok) throw new Error('Netzwerk-Antwort war nicht ok');
        
        const rawEvents = await response.json();
        processLoadedEvents(rawEvents);
    } catch (error) {
        console.error('Fehler beim Laden der calendar.json:', error);
        loadFallbackEvents();
    }
}

function loadFallbackEvents() {
    // Beispieldaten für die Ansicht, falls die JSON mal fehlen sollte
    realEvents = [
        { day: 'today', person: 'papa', name: 'Papa', icon: '👨', title: 'Mülltonne rausbringen', location: 'Haus', description: 'Papier und Restmüll', time: '08:00 Uhr', rawTime: '08:00' },
        { day: 'tomorrow', person: 'irma', name: 'Irma', icon: '👧', title: 'Kinderturnen', location: 'Sporthalle', description: 'Turnschuhe nicht vergessen', time: '16:00 Uhr', rawTime: '16:00' }
    ];
    
    if (typeof renderEvents === 'function') {
        renderEvents();
    }
}

// EVENTS AUS DER JSON VERARBEITEN & EINSORTIEREN
function processLoadedEvents(events) {
    realEvents = [];

    events.forEach(ev => {
        const title = ev.summary;
        const lowerTitle = title.toLowerCase();

        let person = 'familie';
        let name = 'Familie';
        let icon = '🏡';

        if (lowerTitle.includes('oskar')) {
            person = 'oskar';
            name = 'Oskar';
            icon = '👦';
        } else if (lowerTitle.includes('irma')) {
            person = 'irma';
            name = 'Irma';
            icon = '👧';
        } else if (lowerTitle.includes('mama') || lowerTitle.includes('mutter')) {
            person = 'mama';
            name = 'Mama';
            icon = '👩';
        } else if (lowerTitle.includes('papa') || lowerTitle.includes('vater')) {
            person = 'papa';
            name = 'Papa';
            icon = '👨';
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

        if (startStr.includes('T')) {
            const timePart = startStr.split('T')[1];
            let hours = parseInt(timePart.substring(0, 2), 10);
            const minutes = timePart.substring(2, 4);

            if (startStr.endsWith('Z')) {
                hours += 2; // Sommerzeit MESZ Anpassung
                if (hours >= 24) hours -= 24;
            }

            const formattedHours = String(hours).padStart(2, '0');
            rawTime = `${formattedHours}:${minutes}`;
            timeStr = `${rawTime} Uhr`;
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
            rawTime: rawTime
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
    card.className = `event-card ${ev.person}`;
    
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

function addDemoEvent() {
    realEvents.push({
        day: 'today',
        person: 'irma',
        name: 'Irma',
        icon: '👧',
        title: 'Test-Termin manuell',
        location: 'Sporthalle',
        description: 'Bitte Turnschuhe nicht vergessen',
        time: '18:00 Uhr',
        rawTime: '18:00'
    });
    renderEvents();
}

function toggleReadme() {
    const modal = document.getElementById('readme-modal');
    modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
}

let realEvents = [];
let countdownSeconds = 300; // 5 Minuten in Sekunden

document.addEventListener('DOMContentLoaded', () => {
    setupDates();
    loadCalendarData();
    loadEnergyData();
    startRefreshTimer();

    setInterval(() => {
        triggerRefresh();
    }, 5 * 60 * 1000);
});

// TIMER-LOGIK FUER DEN COUNTDOWN
function startRefreshTimer() {
    const timerElement = document.getElementById('refresh-timer');
    
    setInterval(() => {
        countdownSeconds--;
        
        if (countdownSeconds <= 0) {
            countdownSeconds = 300;
        }
        
        const minutes = Math.floor(countdownSeconds / 60);
        const seconds = countdownSeconds % 60;
        
        if (timerElement) {
            timerElement.textContent = `Nächster Abruf: \({String(minutes).padStart(2, '0')}:\){String(seconds).padStart(2, '0')}`;
        }
    }, 1000);
}

// DATUMS-KOEPFE SETZEN
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

// KALENDER LADEN
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

        if (person === 'papa') {
            name = 'Papa';
            icon = '👨';
        } else if (person === 'mama') {
            name = 'Mama';
            icon = '👩';
        } else {
            if (hasOskar && hasIrma) {
                person = 'geschwister';
                name = 'Oskar & Irma';
                icon = '👧👦';
            } else if (hasOskar) {
                person = 'oskar';
                name = 'Oskar';
                icon = '👦';
            } else if (hasIrma) {
                person = 'irma';
                name = 'Irma';
                icon = '👧';
            } else if (lowerTitle.includes('elternabend') || lowerTitle.includes('eltern')) {
                person = 'eltern';
                name = 'Eltern';
                icon = '👥';
            } else {
                person = 'eltern';
                name = 'Eltern';
                icon = '👥';
            }
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
            return;
        }

        let timeStr = 'Ganztägig';
        let rawTime = '00:00';
        let hours = 0;
        let minutes = 0;
        let hasTime = false;

        if (ev.allDay) {
            timeStr = 'Ganztägig';
            rawTime = '00:00';
        } else if (startStr.includes('T')) {
            const timePart = startStr.split('T')[1];
            hours = parseInt(timePart.substring(0, 2), 10);
            minutes = parseInt(timePart.substring(2, 4), 10);
            hasTime = true;

            if (startStr.endsWith('Z')) {
                hours += 2;
                if (hours >= 24) hours -= 24;
            }

            const formattedHours = String(hours).padStart(2, '0');
            const formattedMinutes = String(minutes).padStart(2, '0');
            rawTime = `\({formattedHours}:\){formattedMinutes}`;
            timeStr = `${rawTime} Uhr`;
        }

        let isPast = false;
        if (dayCategory === 'today' && hasTime) {
            const now = new Date();
            let eventEndCheck;

            if (ev.end && ev.end.includes('T')) {
                const endStr = ev.end;
                const endYear = parseInt(endStr.substring(0, 4));
                const endMonth = parseInt(endStr.substring(4, 6)) - 1;
                const endDay = parseInt(endStr.substring(6, 8));
                const endTimePart = endStr.split('T')[1];
                let endHours = parseInt(endTimePart.substring(0, 2), 10);
                let endMinutes = parseInt(endTimePart.substring(2, 4), 10);

                if (endStr.endsWith('Z')) {
                    endHours += 2;
                    if (endHours >= 24) endHours -= 24;
                }
                eventEndCheck = new Date(endYear, endMonth, endDay, endHours, endMinutes);
            } else {
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

    if (todayList.length === 0) todayContainer.innerHTML = '
}

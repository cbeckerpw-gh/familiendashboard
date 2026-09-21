// iCal URL des Google Kalenders
const ICAL_URL = 'https://calendar.google.com/calendar/ical/family15160420290140632345%40group.calendar.google.com/public/basic.ics';
const PROXY_URL = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(ICAL_URL);

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

// KALENDER LADEN
async function loadCalendarData() {
  try {
    const response = await fetch(PROXY_URL);
    const text = await response.text();
    parseICal(text);
  } catch (error) {
    console.error('Fehler beim Laden des Kalenders:', error);
    showError("Fehler beim Laden der Termine.");
  }
}

// ROBUUSTER ICS PARSER
function parseICal(icsText) {
  // Zeilen zusammenführen, falls sie umgebrochen sind (iCal Standard)
  const cleanedText = icsText.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = cleanedText.split(/\r\n|\n|\r/);
  
  realEvents = [];
  let currentEvent = null;

  lines.forEach(line => {
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
    } else if (line.startsWith('END:VEVENT') && currentEvent) {
      if (currentEvent.summary && currentEvent.start) {
        processEvent(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        let key = line.substring(0, colonIdx);
        // Parameter abschneiden (z.B. DTSTART;TZID=Europe/Berlin:...)
        if (key.includes(';')) {
          key = key.split(';')[0];
        }
        const val = line.substring(colonIdx + 1);
        if (key === 'SUMMARY') currentEvent.summary = val;
        if (key === 'DTSTART') currentEvent.start = val;
      }
    }
  });

  renderEvents();
}

// TERMIN VERARBEITEN & EINSORTIEREN
function processEvent(ev) {
  const title = ev.summary;
  const lowerTitle = title.toLowerCase();

  // Person / Kategorie erkennen anhand der Schlüsselwörter
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

  // iCal Datum parsen (Format YYYYMMDD oder YYYYMMDDTHHMMSS...)
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
    return; // Nur Heute, Morgen, Übermorgen anzeigen
  }

  // Uhrzeit extrahieren (falls vorhanden)
  let timeStr = 'Ganztägig';
  let rawTime = '00:00';

  if (startStr.includes('T')) {
    // Beispiel: 20260921T153000Z oder 20260921T170000
    const timePart = startStr.split('T')[1];
    let hours = parseInt(timePart.substring(0, 2), 10);
    const minutes = timePart.substring(2, 4);

    // Kleine Zeitzonen-Korrektur (falls Z / UTC, +2 Std für MESZ Sommerzeit)
    if (startStr.endsWith('Z')) {
      hours += 2;
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
    title: title, // Originaltitel bleibt unangetastet!
    time: timeStr,
    rawTime: rawTime
  });
}

// FEHLER / LEERER ZUSTAND ANZEIGEN
function showError(msg) {
  ['events-today', 'events-tomorrow', 'events-after-tomorrow'].forEach(id => {
    document.getElementById(id).innerHTML = `<div style="color:var(--text-muted); font-size:0.85rem; padding:8px;">${msg}</div>`;
  });
}

// KARTEN RENDERN
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

  // Nach Uhrzeit sortieren innerhalb des Tages
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
  card.onclick = () => speakText(`${ev.title}, ${ev.time}`);

  card.innerHTML = `
    <div class="event-header-line">
      <div class="event-person-badge">
        <span>${ev.icon}</span>
        <span>${ev.name}</span>
      </div>
      <span class="event-time">${ev.time}</span>
    </div>
    <div class="event-title">${ev.title}</div>
    <div class="event-tts-icon">🔊</div>
  `;
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
    time: '18:00 Uhr',
    rawTime: '18:00'
  });
  renderEvents();
}

function toggleReadme() {
  const modal = document.getElementById('readme-modal');
  modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
}

<script>
    // MOCK DATA FOR DEMO
    const sampleEvents = [
      { id: 1, day: 'today', person: 'oskar', name: 'Oskar', icon: '👦', title: 'Feuerwehr Oskar', time: '15:30 - 17:00 Uhr' },
      { id: 2, day: 'today', person: 'irma', name: 'Irma', icon: '👧', title: 'Irma Turnen', time: '16:00 - 17:00 Uhr' },
      { id: 3, day: 'today', person: 'papa', name: 'Papa', icon: '👨', title: 'Einsatzabteilung', time: '19:00 Uhr' },
      { id: 4, day: 'tomorrow', person: 'mama', name: 'Mama', icon: '👩', title: 'Mama Zahnarzt', time: '09:00 Uhr' },
      { id: 5, day: 'tomorrow', person: 'oskar', name: 'Oskar', icon: '👦', title: 'Schwimmkurs Oskar', time: '14:30 Uhr' },
      { id: 6, day: 'after-tomorrow', person: 'familie', name: 'Familie', icon: '🏡', title: 'Familienausflug', time: '11:00 Uhr' }
    ];

    let oskarLightOn = true;
    let irmaLightOn = false;

    // INITIALISIERUNG
    document.addEventListener('DOMContentLoaded', () => {
      setupDates();
      renderEvents();
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

    // TERMIN-KARTEN RENDERN
    function renderEvents() {
      const todayContainer = document.getElementById('events-today');
      const tomorrowContainer = document.getElementById('events-tomorrow');
      const afterTomorrowContainer = document.getElementById('events-after-tomorrow');

      todayContainer.innerHTML = '';
      tomorrowContainer.innerHTML = '';
      afterTomorrowContainer.innerHTML = '';

      sampleEvents.forEach(ev => {
        const card = createEventCard(ev);
        if (ev.day === 'today') todayContainer.appendChild(card);
        else if (ev.day === 'tomorrow') tomorrowContainer.appendChild(card);
        else if (ev.day === 'after-tomorrow') afterTomorrowContainer.appendChild(card);
      });
    }

    // TERMIN-KARTE ERSTELLEN
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

    // TEXT-TO-SPEECH FOR KIDS
    function speakText(text) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'de-DE';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      }
    }

    // SIMULATION UND DEMO-FUNKTIONEN
    function toggleLight(room) {
      if (room === 'oskar') {
        oskarLightOn = !oskarLightOn;
        const dot = document.getElementById('dot-oskar');
        const txt = document.getElementById('text-oskar');
        dot.className = oskarLightOn ? 'status-dot active' : 'status-dot';
        txt.innerText = oskarLightOn ? 'Licht an (18W)' : 'Licht aus (0W)';
      } else if (room === 'irma') {
        irmaLightOn = !irmaLightOn;
        const dot = document.getElementById('dot-irma');
        const txt = document.getElementById('text-irma');
        dot.className = irmaLightOn ? 'status-dot active' : 'status-dot';
        txt.innerText = irmaLightOn ? 'Licht an (15W)' : 'Licht aus (0W)';
      }
    }

    function addDemoEvent() {
      sampleEvents.push({
        id: Date.now(),
        day: 'today',
        person: 'irma',
        name: 'Irma',
        icon: '👧',
        title: 'Irma Mallehrgang',
        time: '18:00 Uhr'
      });
      renderEvents();
    }

    // README MODAL TOGGLE
    function toggleReadme() {
      const modal = document.getElementById('readme-modal');
      modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
    }
  </script>

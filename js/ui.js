// =====================================================================
// ui.js - Wechsel zwischen den 4 Screens und Verdrahtung der Buttons.
// =====================================================================

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
}

document.getElementById('btn-instructions').addEventListener('click', () => {
  showScreen('instructions');
});

document.getElementById('link-back-start').addEventListener('click', (event) => {
  event.preventDefault();
  showScreen('start');
});

document.getElementById('link-back-result').addEventListener('click', (event) => {
  event.preventDefault();
  showScreen('start');
});

document.getElementById('btn-start-game').addEventListener('click', () => {
  showScreen('game');
  initGame();
});

document.getElementById('btn-play').addEventListener('click', () => {
  // Auf Touch-Geräten kurz warten, damit man die "wacht auf"-Animation
  // (siehe .touch-awake weiter unten) noch sieht, bevor der Screen
  // wechselt - auf dem Desktop läuft man sonst durch das schnelle
  // Klicken direkt "durch" die Animation.
  if (window.matchMedia('(pointer: coarse)').matches) {
    setTimeout(() => {
      showScreen('game');
      initGame();
    }, 180);
  } else {
    showScreen('game');
    initGame();
  }
});

document.getElementById('btn-play-again').addEventListener('click', () => {
  showScreen('game');
  initGame();
});

// Bestenliste beim allerersten Laden der Seite einmal anzeigen (auf der
// Ergebnisseite passiert das zusätzlich jedes Mal in endGame(), siehe
// game.js).
renderLeaderboardEverywhere();

document.getElementById('btn-save-score').addEventListener('click', async () => {
  const input = document.getElementById('player-name-input');
  const saveButton = document.getElementById('btn-save-score');
  const errorText = document.getElementById('save-score-error');
  const name = input.value.trim().slice(0, 20) || 'Anonym';

  // Während des Speicherns (echter Netzwerk-Aufruf an Supabase, nicht
  // mehr sofort wie bei localStorage) den Button deaktivieren, damit
  // durch Doppelklick nicht zwei Einträge angelegt werden.
  saveButton.disabled = true;
  errorText.hidden = true;

  // collectedDots/elapsedMs sind Variablen aus game.js - zu diesem
  // Zeitpunkt (Klick auf "Speichern" auf der Ergebnisseite) enthalten sie
  // noch den Endstand des gerade beendeten Spiels.
  const success = await addLeaderboardEntry(name, collectedDots, elapsedMs);

  if (success) {
    document.getElementById('leaderboard-entry').hidden = true;
    await renderLeaderboardEverywhere();
  } else {
    // Eintrag bleibt sichtbar, damit man es noch einmal versuchen kann.
    errorText.hidden = false;
    saveButton.disabled = false;
  }
});

// =====================================================================
// Rückweg der Hover-Verfolgungsszene auf der Startseite (siehe auch die
// ".returning"-Regeln in style.css).
//
// Der Lauf HIN (Fuchs nach links, Jäger folgt) läuft komplett über
// CSS-Hover-Selektoren. Für den Weg ZURÜCK reicht reines CSS aber nicht:
// eine Hover-Transition kennt nur "gehovert" und "nicht gehovert", keinen
// dritten Zwischenzustand "gerade auf dem Rückweg". Deshalb hier ein
// kleines Stück JavaScript, das für die Dauer des Rücklaufs die Klasse
// "returning" setzt - solange sie aktiv ist, bleiben Fuchs und Jäger
// gespiegelt und in Lauf-Pose. Erst wenn der Timer abläuft (passend zur
// CSS-Transition-Dauer der Positionsänderung), drehen sie sich wieder in
// ihre ursprüngliche Blickrichtung und der Fuchs legt sich schlafen.
// =====================================================================
const RETURN_DURATION_MS = 1500; // muss zur CSS-Transition-Dauer passen (siehe .fox-stage/.ambush-hunter)

const startPlayBtn = document.getElementById('btn-play');
const chaseDecor = document.querySelector('.chase-decor');
let returnTimer = null;

if (startPlayBtn && chaseDecor && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  startPlayBtn.addEventListener('mouseenter', () => {
    clearTimeout(returnTimer);
    chaseDecor.classList.remove('returning');
  });

  startPlayBtn.addEventListener('mouseleave', () => {
    chaseDecor.classList.add('returning');
    returnTimer = setTimeout(() => {
      chaseDecor.classList.remove('returning');
    }, RETURN_DURATION_MS);
  });
}

// =====================================================================
// Touch-Variante der Hover-Animation: Baum, Jäger und die Punkte gibt es
// auf Touch-Geräten gar nicht erst (siehe die "display: none;"-Basis-
// Regeln in style.css) - hier löst ein Antippen des Buttons nur die
// einfache "wacht auf"-Animation aus (schlafend → laufend + Bounce),
// ganz ohne Lauf-Choreografie zum Bildschirmrand.
// =====================================================================
if (startPlayBtn && chaseDecor && window.matchMedia('(pointer: coarse)').matches) {
  startPlayBtn.addEventListener('touchstart', () => {
    chaseDecor.classList.add('touch-awake');
  }, { passive: true });
}

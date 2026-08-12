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

document.getElementById('btn-start-game').addEventListener('click', () => {
  showScreen('game');
  initGame();
});

document.getElementById('btn-play').addEventListener('click', () => {
  showScreen('game');
  initGame();
});

document.getElementById('btn-play-again').addEventListener('click', () => {
  showScreen('game');
  initGame();
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

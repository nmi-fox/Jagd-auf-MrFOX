// =====================================================================
// game.js - Der Spielbildschirm: Labyrinth zeichnen, MrFOX steuern,
// Punkte einsammeln, Leben-System und Kollisionen mit den Jägern.
//
// Bewegungsprinzip (für MrFOX und die Jäger gleich): Jede Spielfigur
// steht immer entweder GENAU auf einer Kachel-Mitte oder unterwegs
// zwischen zwei Kacheln. Nur wenn sie exakt auf einer Kachel-Mitte
// steht, wird neu entschieden, in welche Richtung es weitergeht -
// das ist der Moment, den man als "Kreuzung" bezeichnen kann.
// =====================================================================

const TILE_SIZE = 32;
const PLAYER_SPEED = 3.6;       // Kacheln pro Sekunde
const COLLISION_DISTANCE = 0.6; // ab welcher Nähe (in Kacheln) ein Treffer zählt
const INVULNERABLE_MS = 1800;   // Dauer der Unverwundbarkeit nach einem Treffer
const HEAD_START_MS = 3000;     // MrFOX' Vorsprung zu Spielbeginn: die Jäger stehen still

// Farben passend zum Farbschema in css/style.css (siehe dortige
// CSS-Variablen - Canvas kann CSS-Variablen leider nicht direkt lesen,
// deshalb sind die Werte hier als Kopie hinterlegt).
const COLOR_CREAM = '#FEEBDD';
const COLOR_NAVY = '#365C8A';
const COLOR_HEART_RED = '#EC424A';
const COLOR_HEART_EMPTY = '#C9C9C9';

const PLAYER_IMG_WIDTH = 1337.63; // Original-Seitenverhältnis aus MrFOX_walk.svg
const PLAYER_IMG_HEIGHT = 540.66;

const HUNTER_IMG_WIDTH = 501.74; // Original-Seitenverhältnis aus Jaeger.svg
const HUNTER_IMG_HEIGHT = 621.81;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const playerImg = new Image();
playerImg.src = 'assets/MrFOX_walk.svg';

const hunterImg = new Image();
hunterImg.src = 'assets/Jaeger.svg';

// Spielzustand (wird bei jedem initGame() neu gesetzt)
let grid, cols, rows, dots, totalDots, collectedDots;
let hearts, player, hunters, playerStart;
let invulnerable, invulnerableRemaining, blinkOn, blinkTimer;
let headStartRemaining, elapsedMs;
let gameActive = false;
let rafId = null;
let lastTimestamp = 0;

// ---------------------------------------------------------------------
// Spiel (neu) starten
// ---------------------------------------------------------------------
function initGame() {
  if (rafId) cancelAnimationFrame(rafId);

  const maze = generateMaze();
  grid = maze.grid;
  cols = maze.cols;
  rows = maze.rows;
  playerStart = maze.playerStart;

  // Ein Punkt auf jedem Weg-Feld, außer auf dem Startfeld von MrFOX.
  dots = grid.map((rowArr, r) =>
    rowArr.map((isPath, c) => isPath && !(r === playerStart.row && c === playerStart.col))
  );
  totalDots = dots.reduce((sum, rowArr) => sum + rowArr.filter(Boolean).length, 0);
  collectedDots = 0;

  hearts = 3;
  updateHeartsUI();
  updateScoreUI();

  headStartRemaining = HEAD_START_MS;
  elapsedMs = 0;
  updateTimerUI();

  player = {
    col: playerStart.col,
    row: playerStart.row,
    dir: { dx: 0, dy: 0 },
    progress: 0, // Fortschritt (0..1) auf dem Weg von (col,row) zur nächsten Kachel
    desiredDir: { dx: 0, dy: 0 },
    facingRight: false
  };

  hunters = maze.hunterStarts.map((s) => createHunter(s.col, s.row));

  invulnerable = false;
  invulnerableRemaining = 0;
  blinkOn = false;
  blinkTimer = 0;

  canvas.width = cols * TILE_SIZE;
  canvas.height = rows * TILE_SIZE;

  gameActive = true;
  lastTimestamp = performance.now();
  draw();
  rafId = requestAnimationFrame(gameLoopStep);
}

// ---------------------------------------------------------------------
// Bewegung: jede Spielfigur ("entity") hat eine aktuelle Basis-Kachel
// (entity.col/entity.row), eine Bewegungsrichtung (entity.dir) und
// einen Fortschritt (entity.progress, 0..1) auf dem Weg zur nächsten
// Kachel. Erst wenn eine Kachel-Mitte exakt erreicht ist (progress
// wird wieder auf 0 zurückgesetzt), wird "onDecide" aufgerufen, damit
// die Figur eine neue Richtung wählen kann - das entspricht einer
// "Kreuzung". So bewegt sich die Figur nie mitten durch eine Wand,
// weil Richtungswechsel ausschließlich auf ganzen Kacheln passieren.
// ---------------------------------------------------------------------
function stepEntity(entity, dt, speed, onDecide) {
  let remaining = speed * dt; // noch zurückzulegende Strecke in Kachel-Einheiten
  let safety = 0;

  while (remaining > 1e-9 && safety < 20) {
    safety++;

    if (entity.progress === 0) {
      onDecide(entity, entity.col, entity.row);
      if (entity.dir.dx === 0 && entity.dir.dy === 0) break; // steht (z.B. Sackgasse)
    }

    const distanceToNextTile = 1 - entity.progress;
    const move = Math.min(remaining, distanceToNextTile);
    entity.progress += move;
    remaining -= move;

    if (entity.progress >= 1 - 1e-9) {
      // Nächste Kachel-Mitte erreicht: das wird die neue Basis-Kachel
      entity.col += entity.dir.dx;
      entity.row += entity.dir.dy;
      entity.progress = 0;
    }
  }
}

// Liefert die aktuelle Position einer Spielfigur in Kachel-Einheiten
// (z.B. x=3.4 bedeutet: 40% auf dem Weg von Kachel 3 zu Kachel 4).
function entityPosition(entity) {
  return {
    x: entity.col + entity.dir.dx * entity.progress,
    y: entity.row + entity.dir.dy * entity.progress
  };
}

function decidePlayer(p, col, row) {
  const { dx, dy } = p.desiredDir;
  if ((dx !== 0 || dy !== 0) && isWalkable(grid, col + dx, row + dy)) {
    p.dir = { dx, dy };
  } else if (!isWalkable(grid, col + p.dir.dx, row + p.dir.dy)) {
    p.dir = { dx: 0, dy: 0 };
  }

  // Blickrichtung: nur bei horizontaler Bewegung anpassen, bei
  // vertikaler Bewegung bleibt die zuletzt bekannte Richtung erhalten.
  // MrFOX_walk.svg ist von Haus aus nach LINKS blickend gezeichnet,
  // daher wird hier für Rechtsbewegung gespiegelt (nicht für links).
  if (p.dir.dx === 1) p.facingRight = true;
  else if (p.dir.dx === -1) p.facingRight = false;
}

// ---------------------------------------------------------------------
// Punkte, Kollisionen, Leben
// ---------------------------------------------------------------------
function checkDotCollection() {
  const col = player.col;
  const row = player.row;
  if (dots[row] && dots[row][col]) {
    dots[row][col] = false;
    collectedDots++;
    updateScoreUI();
    if (collectedDots >= totalDots) {
      endGame('win');
    }
  }
}

function checkCollisions() {
  if (invulnerable) return;
  const playerPos = entityPosition(player);
  for (const hunter of hunters) {
    const hunterPos = entityPosition(hunter);
    const distance = Math.hypot(playerPos.x - hunterPos.x, playerPos.y - hunterPos.y);
    if (distance < COLLISION_DISTANCE) {
      loseLife();
      return;
    }
  }
}

function loseLife() {
  hearts--;
  updateHeartsUI();

  if (hearts <= 0) {
    endGame('caught');
    return;
  }

  // Zurück auf die Startposition, Punkte bleiben erhalten.
  player.col = playerStart.col;
  player.row = playerStart.row;
  player.progress = 0;
  player.dir = { dx: 0, dy: 0 };
  player.desiredDir = { dx: 0, dy: 0 };

  invulnerable = true;
  invulnerableRemaining = INVULNERABLE_MS;
  blinkOn = false;
  blinkTimer = 0;
}

function endGame(result) {
  gameActive = false;
  if (rafId) cancelAnimationFrame(rafId);

  const time = formatTime(elapsedMs);
  const title = result === 'win' ? 'Geschafft!' : 'Erwischt!';
  const details =
    result === 'win'
      ? `Du hast alle ${totalDots} Punkte in ${time} gesammelt und noch ${hearts} Leben übrig.`
      : `Du wurdest vom Jäger erwischt. Punktestand: ${collectedDots} von ${totalDots}. Zeit: ${time}.`;

  document.getElementById('result-title').textContent = title;
  document.getElementById('result-details').textContent = details;

  // Bei einem Sieg feiert MrFOX mit Konfetti, statt einfach nur zu laufen.
  const resultFoxImg = document.getElementById('result-fox-img');
  if (result === 'win') {
    resultFoxImg.src = 'assets/MrFOX_confetti.svg';
    resultFoxImg.alt = 'MrFOX freut sich und wirft Konfetti';
    resultFoxImg.classList.add('is-confetti');
  } else {
    resultFoxImg.src = 'assets/MrFOX_walk.svg';
    resultFoxImg.alt = 'MrFOX';
    resultFoxImg.classList.remove('is-confetti');
  }

  // Die Namenseingabe für die Top10-Liste gibt es nur nach einem Sieg -
  // nur dann sind Punkte und Zeit fair mit anderen Läufen vergleichbar
  // (siehe leaderboard.js), weil dann immer "alle Punkte des Labyrinths"
  // geschafft wurden.
  const entryPanel = document.getElementById('leaderboard-entry');
  if (result === 'win') {
    document.getElementById('player-name-input').value = '';
    document.getElementById('btn-save-score').disabled = false;
    document.getElementById('save-score-error').hidden = true;
    entryPanel.hidden = false;
  } else {
    entryPanel.hidden = true;
  }

  renderLeaderboardEverywhere();
  showScreen('result');
}

// ---------------------------------------------------------------------
// Spielschleife
// ---------------------------------------------------------------------
function gameLoopStep(timestamp) {
  if (!gameActive) return;

  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
  lastTimestamp = timestamp;

  elapsedMs += dt * 1000;
  updateTimerUI();

  if (invulnerable) {
    invulnerableRemaining -= dt * 1000;
    blinkTimer += dt * 1000;
    if (blinkTimer > 150) {
      blinkOn = !blinkOn;
      blinkTimer = 0;
    }
    if (invulnerableRemaining <= 0) {
      invulnerable = false;
      blinkOn = false;
    }
  }

  stepEntity(player, dt, PLAYER_SPEED, decidePlayer);
  checkDotCollection();

  // Vorsprung: zu Spielbeginn stehen die Jäger ein paar Sekunden lang
  // still, damit MrFOX schon einmal losrennen kann, bevor die Jagd
  // beginnt. Erst danach bewegen sie sich und können ihn einholen.
  if (headStartRemaining > 0) {
    headStartRemaining -= dt * 1000;
  } else {
    // Das Distanzfeld (kürzester Weg zu MrFOX) wird einmal pro Frame
    // berechnet und von allen Jägern gemeinsam genutzt.
    const distanceField = computeDistanceField(grid, player.col, player.row);

    for (const hunter of hunters) {
      stepEntity(hunter, dt, HUNTER_SPEED, (h) => decideHunterDirection(h, grid, distanceField));
    }

    if (gameActive) checkCollisions();
  }

  draw();

  if (gameActive) rafId = requestAnimationFrame(gameLoopStep);
}

// ---------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMaze();
  hunters.forEach(drawHunter);
  drawPlayer();
  drawHeadStartOverlay();
}

// Zeigt während des Vorsprungs (siehe HEAD_START_MS) einen Countdown
// über dem Labyrinth an, damit klar ist, warum sich die Jäger noch
// nicht bewegen.
function drawHeadStartOverlay() {
  if (headStartRemaining <= 0) return;
  const secondsLeft = Math.ceil(headStartRemaining / 1000);

  ctx.save();
  ctx.fillStyle = 'rgba(54, 92, 138, 0.55)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = COLOR_CREAM;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = `bold ${TILE_SIZE * 1.8}px Verdana, sans-serif`;
  ctx.fillText(String(secondsLeft), canvas.width / 2, canvas.height / 2 - TILE_SIZE * 0.4);

  ctx.font = `${TILE_SIZE * 0.42}px Verdana, sans-serif`;
  ctx.fillText('Lauf schon mal los - die Jäger warten noch!', canvas.width / 2, canvas.height / 2 + TILE_SIZE * 0.9);
  ctx.restore();
}

function drawMaze() {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;

      if (grid[r][c]) {
        ctx.fillStyle = COLOR_CREAM;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        if (dots[r][c]) {
          ctx.fillStyle = COLOR_NAVY;
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE * 0.09, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = COLOR_NAVY;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}

function drawHunter(hunter) {
  const pos = entityPosition(hunter);
  const px = pos.x * TILE_SIZE + TILE_SIZE / 2;
  const py = pos.y * TILE_SIZE + TILE_SIZE / 2;
  const w = TILE_SIZE * 0.88;
  const h = (w * HUNTER_IMG_HEIGHT) / HUNTER_IMG_WIDTH;

  // Der Jäger ist höher als eine Kachel. Damit seine Füße auf dem Weg
  // stehen (statt in der Wand darunter zu "schweben"), wird nicht die
  // Bildmitte, sondern die Fußsohle auf die untere Kachelkante gesetzt.
  // Nach oben darf der Hut dafür etwas in die Wand hineinragen.
  const footMargin = 2;
  const bottomY = TILE_SIZE / 2 - footMargin;

  ctx.save();
  ctx.translate(px, py);
  if (hunter.facingRight) ctx.scale(-1, 1); // Jaeger.svg blickt von Haus aus nach links
  if (hunterImg.complete) {
    ctx.drawImage(hunterImg, -w / 2, bottomY - h, w, h);
  }
  ctx.restore();
}

function drawPlayer() {
  if (invulnerable && blinkOn) return; // Blink-Effekt: diesen Frame auslassen

  const pos = entityPosition(player);
  const px = pos.x * TILE_SIZE + TILE_SIZE / 2;
  const py = pos.y * TILE_SIZE + TILE_SIZE / 2;
  const w = TILE_SIZE * 1.3;
  const h = (w * PLAYER_IMG_HEIGHT) / PLAYER_IMG_WIDTH;

  ctx.save();
  ctx.translate(px, py);
  if (player.facingRight) ctx.scale(-1, 1); // MrFOX_walk.svg blickt von Haus aus nach links
  if (playerImg.complete) {
    ctx.drawImage(playerImg, -w / 2, -h / 2, w, h);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------
// HUD (Herzen + Punktezähler)
// ---------------------------------------------------------------------
function heartSvg(filled) {
  const fill = filled ? COLOR_HEART_RED : 'none';
  const stroke = filled ? COLOR_HEART_RED : COLOR_HEART_EMPTY;
  return `<svg viewBox="0 0 32 29" fill="${fill}" stroke="${stroke}" stroke-width="2.5">
    <path d="M16 27C16 27 2 18.5 2 9.5C2 4.8 5.8 2 9.5 2C12.5 2 15 4 16 6.5C17 4 19.5 2 22.5 2C26.2 2 30 4.8 30 9.5C30 18.5 16 27 16 27Z"/>
  </svg>`;
}

function updateHeartsUI() {
  const container = document.getElementById('hearts');
  let html = '';
  for (let i = 0; i < 3; i++) {
    html += heartSvg(i < hearts);
  }
  container.innerHTML = html;
}

function updateScoreUI() {
  document.getElementById('score-current').textContent = collectedDots;
  document.getElementById('score-total').textContent = totalDots;
}

// Wandelt eine Millisekunden-Zahl in ein "MM:SS"-Format um.
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateTimerUI() {
  document.getElementById('timer').textContent = formatTime(elapsedMs);
}

// ---------------------------------------------------------------------
// Tastatursteuerung (Pfeiltasten + WASD)
// ---------------------------------------------------------------------
const KEY_DIRECTIONS = {
  ArrowUp: { dx: 0, dy: -1 },
  w: { dx: 0, dy: -1 },
  W: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  s: { dx: 0, dy: 1 },
  S: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  a: { dx: -1, dy: 0 },
  A: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  d: { dx: 1, dy: 0 },
  D: { dx: 1, dy: 0 }
};

// Von Tastatur UND Steuerkreuz genutzt, damit die Richtungs-Logik nur an
// einer Stelle steht.
function setDesiredDirection(dx, dy) {
  if (!gameActive) return;
  player.desiredDir = { dx, dy };
}

document.addEventListener('keydown', (event) => {
  if (!gameActive) return; // wichtig: VOR preventDefault(), siehe unten
  const dir = KEY_DIRECTIONS[event.key];
  if (!dir) return;
  event.preventDefault(); // verhindert, dass die Seite mit den Pfeiltasten scrollt
  setDesiredDirection(dir.dx, dir.dy);
});

// ---------------------------------------------------------------------
// Steuerkreuz (Touch) - per CSS nur auf Geräten mit "pointer: coarse"
// sichtbar (siehe .dpad in style.css); dieser Listener läuft harmlos
// auch auf dem Desktop mit, ein "pointerdown" kann auf einem
// unsichtbaren ("display: none") Element aber nie feuern.
// ---------------------------------------------------------------------
const dpad = document.querySelector('.dpad');
if (dpad) {
  dpad.addEventListener('pointerdown', (event) => {
    const btn = event.target.closest('.dpad-btn');
    if (!btn) return;
    event.preventDefault();
    setDesiredDirection(Number(btn.dataset.dx), Number(btn.dataset.dy));
  });
}

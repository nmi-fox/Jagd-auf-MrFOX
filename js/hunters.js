// =====================================================================
// hunters.js - Die "künstliche Intelligenz" der Jäger.
//
// Logik (bewusst einfach gehalten, siehe auch die Anleitungsseite):
// 1. Wir berechnen einmal pro Frame ein "Distanzfeld": für JEDES Feld
//    im Labyrinth die Anzahl an Schritten, die man von dort aus zu
//    MrFOX' aktuellem Feld braucht (per Breitensuche / BFS - das ist
//    der kürzeste Weg durch die Gänge, nicht die Luftlinie).
// 2. Steht ein Jäger an einer Kreuzung (also an einem Punkt, an dem er
//    sich neu entscheiden muss), schaut er sich seine begehbaren
//    Nachbarfelder an:
//    - mit 65% Wahrscheinlichkeit wählt er das Nachbarfeld, das laut
//      Distanzfeld am NÄCHSTEN an MrFOX liegt (Verfolgung),
//    - mit 35% Wahrscheinlichkeit wählt er stattdessen ein zufälliges
//      begehbares Nachbarfeld (damit er nicht unfehlbar ist).
//    Ein direktes Umdrehen wird vermieden, außer es gibt keinen
//    anderen Weg (Sackgasse).
// =====================================================================

const HUNTER_CHASE_CHANCE = 0.65;
const HUNTER_SPEED = 2.6; // Kacheln pro Sekunde, deutlich langsamer als MrFOX (3.6)

function computeDistanceField(grid, targetCol, targetRow) {
  const rows = grid.length;
  const cols = grid[0].length;
  const dist = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
  dist[targetRow][targetCol] = 0;

  const queue = [[targetCol, targetRow]];
  let head = 0;
  const neighborOffsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (head < queue.length) {
    const [c, r] = queue[head++];
    for (const [dx, dy] of neighborOffsets) {
      const nc = c + dx;
      const nr = r + dy;
      if (!isWalkable(grid, nc, nr)) continue;
      if (dist[nr][nc] !== Infinity) continue;
      dist[nr][nc] = dist[r][c] + 1;
      queue.push([nc, nr]);
    }
  }

  return dist;
}

function createHunter(col, row) {
  return {
    col,
    row,
    dir: { dx: 0, dy: 0 },
    progress: 0, // Fortschritt (0..1) auf dem Weg von (col,row) zur nächsten Kachel
    cameFrom: null, // welche Richtung er herkam, um ein sofortiges Umdrehen zu vermeiden
    facingRight: false // Jaeger.svg blickt von Haus aus nach links (wie MrFOX_walk.svg)
  };
}

// Wird an jeder Kreuzung (bzw. bei jedem Erreichen einer Kachel-Mitte)
// aufgerufen, um die neue Bewegungsrichtung des Jägers festzulegen.
function decideHunterDirection(hunter, grid, distanceField) {
  const { col, row } = hunter;
  const neighborOffsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  let candidates = neighborOffsets.filter(([dx, dy]) => isWalkable(grid, col + dx, row + dy));

  // Umdrehen vermeiden, außer es ist der einzige begehbare Weg (Sackgasse)
  if (hunter.cameFrom && candidates.length > 1) {
    candidates = candidates.filter(([dx, dy]) => !(dx === -hunter.cameFrom[0] && dy === -hunter.cameFrom[1]));
  }

  if (candidates.length === 0) {
    hunter.dir = { dx: 0, dy: 0 };
    return;
  }

  let chosen;
  if (Math.random() < HUNTER_CHASE_CHANCE) {
    // Verfolgung: Nachbarfeld mit dem kleinsten Abstand zu MrFOX wählen
    let bestDist = Infinity;
    let best = [];
    for (const [dx, dy] of candidates) {
      const d = distanceField[row + dy][col + dx];
      if (d < bestDist) {
        bestDist = d;
        best = [[dx, dy]];
      } else if (d === bestDist) {
        best.push([dx, dy]);
      }
    }
    chosen = best[Math.floor(Math.random() * best.length)];
  } else {
    // Zufällige Bewegung
    chosen = candidates[Math.floor(Math.random() * candidates.length)];
  }

  hunter.cameFrom = chosen;
  hunter.dir = { dx: chosen[0], dy: chosen[1] };

  // Blickrichtung: nur bei horizontaler Bewegung anpassen, bei
  // vertikaler Bewegung bleibt die zuletzt bekannte Richtung erhalten
  // (siehe decidePlayer() in game.js - gleiches Prinzip).
  if (hunter.dir.dx === 1) hunter.facingRight = true;
  else if (hunter.dir.dx === -1) hunter.facingRight = false;
}

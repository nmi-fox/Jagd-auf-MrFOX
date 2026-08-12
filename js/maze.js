// =====================================================================
// maze.js - Erzeugt das Labyrinth als 2D-Array.
//
// Idee: Wir denken zunächst in groben "Zellen" (CELLS_X x CELLS_Y).
// Zwischen benachbarten Zellen graben wir per Tiefensuche (klassischer
// Labyrinth-Generator) einen Gang. Das ergibt garantiert ein Labyrinth,
// in dem jeder Weg von jedem anderen Weg aus erreichbar ist - es gibt
// also nie eingeschlossene Punkte, die man nicht einsammeln könnte.
//
// Danach reißen wir noch ein paar zusätzliche Wände ein, damit es
// echte Kreuzungen und Schleifen gibt (sonst gäbe es nur genau einen
// einzigen Weg zwischen zwei Punkten, was für ein Jagd-Spiel langweilig
// wäre - die Jäger und MrFOX brauchen Ausweichmöglichkeiten).
//
// Die tatsächliche Rastergröße (inkl. der Wände zwischen den Zellen)
// ist immer ungerade: GRID_COLS = CELLS_X * 2 + 1, GRID_ROWS entsprechend.
// =====================================================================

const CELLS_X = 8;
const CELLS_Y = 6;
const GRID_COLS = CELLS_X * 2 + 1;
const GRID_ROWS = CELLS_Y * 2 + 1;

function isWalkable(grid, col, row) {
  if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length) return false;
  return grid[row][col] === true;
}

function generateMaze() {
  // grid[row][col]: true = begehbarer Weg, false = Wand
  const grid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));
  const visited = Array.from({ length: CELLS_Y }, () => Array(CELLS_X).fill(false));

  function cellToGrid(cx, cy) {
    return { col: cx * 2 + 1, row: cy * 2 + 1 };
  }

  function shuffled(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Rekursive Tiefensuche: von der aktuellen Zelle aus in zufälliger
  // Reihenfolge alle Nachbarzellen besuchen, die noch nicht besucht
  // wurden, und dabei die Wand dazwischen einreißen.
  function carve(cx, cy) {
    visited[cy][cx] = true;
    const { col, row } = cellToGrid(cx, cy);
    grid[row][col] = true;

    const directions = shuffled([[0, -1], [0, 1], [-1, 0], [1, 0]]);
    for (const [dx, dy] of directions) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= CELLS_X || ny >= CELLS_Y || visited[ny][nx]) continue;
      grid[row + dy][col + dx] = true; // Wand zwischen den Zellen einreißen
      carve(nx, ny);
    }
  }

  carve(0, 0);

  // Zusätzliche Schleifen: an ca. 22% aller "inneren Wände" zwischen
  // zwei bereits begehbaren Zellen wird die Wand ebenfalls entfernt.
  const extraLoopChance = 0.22;
  for (let row = 1; row < GRID_ROWS - 1; row++) {
    for (let col = 1; col < GRID_COLS - 1; col++) {
      if (grid[row][col]) continue; // schon ein Weg
      const isHorizontalConnector = row % 2 === 1 && col % 2 === 0;
      const isVerticalConnector = row % 2 === 0 && col % 2 === 1;
      if (isHorizontalConnector && grid[row][col - 1] && grid[row][col + 1]) {
        if (Math.random() < extraLoopChance) grid[row][col] = true;
      } else if (isVerticalConnector && grid[row - 1][col] && grid[row + 1][col]) {
        if (Math.random() < extraLoopChance) grid[row][col] = true;
      }
    }
  }

  const playerStart = cellToGrid(0, 0);
  const hunterStarts = [
    cellToGrid(CELLS_X - 1, 0),
    cellToGrid(0, CELLS_Y - 1),
    cellToGrid(CELLS_X - 1, CELLS_Y - 1)
  ];

  return { grid, cols: GRID_COLS, rows: GRID_ROWS, playerStart, hunterStarts };
}

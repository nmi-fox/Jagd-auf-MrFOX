// =====================================================================
// leaderboard.js - Die Top10-Bestenliste.
//
// Die Liste liegt in einer Supabase-Datenbank (Tabelle "highscores" mit
// den Spalten player_name, points, time_seconds und pkt_pro_sek - die
// Rate wird direkt in der Datenbank berechnet, nicht hier). Der Rest des
// Spiels kennt nur zwei Funktionen aus dieser Datei:
//   - addLeaderboardEntry(name, points, timeMs)
//   - renderLeaderboardEverywhere()
// Nur diese beiden werden von game.js/ui.js aufgerufen - wie die Liste
// tatsächlich gespeichert wird, bleibt komplett in dieser Datei.
//
// Rangfolge: Nicht jedes Labyrinth hat gleich viele Punkte, deshalb wird
// nicht einfach nach Punktzahl sortiert, sondern nach Punkte pro Sekunde
// ("pkt_pro_sek") - wer im Schnitt schneller pro Punkt war, steht weiter
// oben. Da man einen Eintrag nur nach einem Sieg anlegen kann, haben
// alle Einträge sowieso "alle Punkte ihres Labyrinths" geschafft, damit
// ist die Rate ein fairer Vergleichswert zwischen unterschiedlich
// großen Labyrinthen.
// =====================================================================

// Zugangsdaten für die Supabase-Datenbank. Der "publishable"-Key ist
// bewusst für den Einsatz im Browser gedacht (vergleichbar mit dem alten
// "anon key") - der eigentliche Schutz der Daten passiert über
// Row-Level-Security-Regeln in Supabase selbst, nicht durch Geheimhaltung
// dieses Keys.
const SUPABASE_URL = 'https://yfxaclxugtrwrauaezch.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7XL6KNa7PxS1AZUBtvNJAA_kvpYjnwW';
const SUPABASE_TABLE = 'highscores';

const LEADERBOARD_MAX_ENTRIES = 10;

// n8n-Webhook, der bei einem neuen Highscore-Eintrag eine E-Mail-
// Benachrichtigung auslöst. Produktions-URL - setzt voraus, dass der
// n8n-Workflow veröffentlicht ("Publish") und damit dauerhaft aktiv ist,
// nicht nur über "Listen for test event" im Editor.
const N8N_HIGHSCORE_WEBHOOK_URL = 'https://nmi-fox.app.n8n.cloud/webhook/Highscore-Info';

function supabaseHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

// Holt die Top10 direkt aus Supabase, schon absteigend nach Punkte pro
// Sekunde sortiert. Gibt bei einem Fehler "null" zurück (nicht ein leeres
// Array), damit renderLeaderboardEverywhere() zwischen "wirklich noch
// leer" und "Liste konnte nicht geladen werden" unterscheiden kann.
async function fetchLeaderboard() {
  const params = new URLSearchParams({
    select: 'player_name,points,time_seconds,pkt_pro_sek',
    order: 'pkt_pro_sek.desc',
    limit: String(LEADERBOARD_MAX_ENTRIES),
  });

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?${params}`, {
      headers: supabaseHeaders(),
    });
    if (!response.ok) throw new Error(`Supabase antwortete mit Status ${response.status}`);

    const rows = await response.json();
    // In das Format übersetzen, das der Rest dieser Datei erwartet
    // (timeMs statt time_seconds, damit formatLeaderboardTime() gleich
    // bleiben kann).
    return rows.map((row) => ({
      name: row.player_name,
      points: row.points,
      timeMs: row.time_seconds * 1000,
      rate: Number(row.pkt_pro_sek),
    }));
  } catch (error) {
    console.error('Bestenliste konnte nicht geladen werden:', error);
    return null;
  }
}

// Speichert einen neuen Eintrag in Supabase. pkt_pro_sek wird bewusst
// NICHT mitgeschickt - die Datenbank berechnet die Spalte selbst.
async function addLeaderboardEntry(name, points, timeMs) {
  const body = {
    player_name: name,
    points,
    time_seconds: Math.floor(timeMs / 1000),
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Supabase antwortete mit Status ${response.status}`);
    notifyHighscoreWebhook(name, points, timeMs);
    return true;
  } catch (error) {
    console.error('Punktestand konnte nicht gespeichert werden:', error);
    return false;
  }
}

// Meldet n8n "nebenbei" (fire-and-forget) den neuen Eintrag. Schlägt das
// fehl (z.B. weil der Test-Webhook gerade nicht auf "Listen for test
// event" steht), soll das den eigentlichen Speichervorgang in Supabase
// NICHT als fehlgeschlagen erscheinen lassen - die Bestenliste ist die
// eigentliche Funktion, die E-Mail-Benachrichtigung nur ein Extra.
function notifyHighscoreWebhook(name, points, timeMs) {
  fetch(N8N_HIGHSCORE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      points,
      timeSeconds: Math.floor(timeMs / 1000),
    }),
  }).catch((error) => {
    console.error('n8n-Webhook konnte nicht benachrichtigt werden:', error);
  });
}

function formatLeaderboardTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Zeigt die Sortiergrundlage (Punkte pro Sekunde, direkt aus der
// Datenbank) an - sonst wirkt es irritierend, wenn z.B. 90 Punkte über
// 110 Punkten stehen, weil die 90er-Runde einfach flotter war.
function formatRate(entry) {
  return `${entry.rate.toFixed(1).replace('.', ',')} Pkt/Sek`;
}

// Zeichnet eine bereits geladene Liste in ein <ul>-Element (per ID).
function renderList(listElementId, list) {
  const el = document.getElementById(listElementId);
  if (!el) return;

  el.innerHTML = '';

  if (list === null) {
    const errorRow = document.createElement('li');
    errorRow.className = 'leaderboard-empty';
    errorRow.textContent = 'Bestenliste konnte nicht geladen werden.';
    el.appendChild(errorRow);
    return;
  }

  if (list.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'leaderboard-empty';
    empty.textContent = 'Noch keine Einträge - sei die/der Erste!';
    el.appendChild(empty);
    return;
  }

  list.forEach((entry, index) => {
    const li = document.createElement('li');
    li.className = 'leaderboard-row';

    const rank = document.createElement('span');
    rank.className = 'leaderboard-rank';
    rank.textContent = `${index + 1}.`;

    const name = document.createElement('span');
    name.className = 'leaderboard-name';
    name.textContent = entry.name; // textContent statt innerHTML - schützt vor Code-Einschleusung über den Namen

    const points = document.createElement('span');
    points.className = 'leaderboard-points';
    points.textContent = `${entry.points} Punkte`;

    const time = document.createElement('span');
    time.className = 'leaderboard-time';
    time.textContent = formatLeaderboardTime(entry.timeMs);

    const rate = document.createElement('span');
    rate.className = 'leaderboard-rate';
    rate.textContent = formatRate(entry);

    li.append(rank, name, points, time, rate);
    el.appendChild(li);
  });
}

function showLeaderboardLoading(listElementId) {
  const el = document.getElementById(listElementId);
  if (!el) return;
  el.innerHTML = '<li class="leaderboard-empty">Lade Bestenliste …</li>';
}

// Aktualisiert alle Stellen, an denen die Liste angezeigt wird
// (Startseite + Ergebnisseite). Lädt die Daten nur EINMAL und zeichnet
// sie dann an beiden Stellen ein, statt zweimal von Supabase abzufragen.
async function renderLeaderboardEverywhere() {
  showLeaderboardLoading('leaderboard-list-start');
  showLeaderboardLoading('leaderboard-list-result');

  const list = await fetchLeaderboard();

  renderList('leaderboard-list-start', list);
  renderList('leaderboard-list-result', list);
}

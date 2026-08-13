// =====================================================================
// register-sw.js - meldet den Service Worker (sw.js) an, damit das
// Spiel offline spielbar und "installierbar" wird (siehe manifest.json).
//
// Eigene, winzige Datei statt in ui.js untergebracht, damit dieser
// PWA-spezifische Teil klar abgegrenzt bleibt und notfalls leicht
// wieder entfernt werden kann.
// =====================================================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((error) => {
      // Schlägt die Registrierung fehl (z.B. nicht unterstützter
      // Browser, blockiert), spielt das Spiel trotzdem ganz normal
      // weiter - nur eben ohne Offline-Funktion.
      console.error('Service Worker Registrierung fehlgeschlagen (Spiel funktioniert trotzdem):', error);
    });
  });
}

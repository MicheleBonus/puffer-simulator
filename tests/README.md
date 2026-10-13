# Browser-Tests für den Puffer-Simulator

Prüft die Seite in einem headless Chrome (puppeteer-core, Chrome unter `C:\Program Files\Google\Chrome\Application\chrome.exe`):
Ausgangs-pH-Werte, Zugabe, Zurücksetzen, Säure-Base-Paar, Stoffmengenanteil, Indikatorfärbung der Lösung,
Verhältnisbalken, Schrift, alle 16 Schritte der Erklärung, Erklärungsleiste beim Scrollen, 1080p-Passung,
Handybreite ohne Querscrollen, Dunkelmodus und ein Stresstest gegen den früheren Absturz der Animation.

    cd tests
    npm install
    npm test            # nur Tests
    npm run test:shots  # zusätzlich Screenshots nach tests/shots/

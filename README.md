V139 — HYBRYDOWY ODCZYT FORMULARZA (Google Cloud Vision)

Zmiany:
- aplikacja lokalnie wykrywa kartkę, prostuje perspektywę i namierza dokładnie W1–W5/SUMA;
- lokalny kod nie rozpoznaje już cyfr — tylko rozstrzyga, czy komórka jest pusta;
- do zewnętrznego OCR wysyłane są wyłącznie małe wycinki komórek z odręcznym wpisem;
- nazwiska i pełne zdjęcie formularza nie są wysyłane do zewnętrznego OCR;
- zewnętrzny silnik: Google Cloud Vision DOCUMENT_TEXT_DETECTION (handwriting);
- maksymalnie 16 wycinków na jedno zapytanie do Google, większe importy są automatycznie dzielone;
- odczyt >5 cyfr jest odrzucany i oznaczany do sprawdzenia;
- pojedyncze 1 g jest zamieniane na 0;
- SUMA nadal jest nadrzędna;
- * oznacza BF; jeżeli SUMA jest wpisana, zwykła waga = SUMA - suma BF;
- ekran kontroli przed importem pozostaje obowiązkowy.

Konfiguracja Railway:
1. W Google Cloud włącz Cloud Vision API i utwórz API key.
2. W Railway dla usługi lowcy-methodowcy-app dodaj zmienną:
   GOOGLE_VISION_API_KEY=<Twój klucz>
3. Railway wykona redeploy po dodaniu zmiennej.

Klucz nigdy nie trafia do przeglądarki. Wywołanie Cloud Vision wykonuje backend.

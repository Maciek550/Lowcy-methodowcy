

V74: naprawa mobilnego przewijania po V73, aktualizacja PWA/cache, testy widoków i kafelków oraz czytelniejsze powiadomienia zawodnika.


V76 — poprawka desktopowego widoku zawodnika. Po kliknięciu Wyniki Tura 1 / Wyniki Tura 2 treść nie może już rozszerzać szerokości strony ani wypychać górnego menu poza ekran. Zachowana wersja mobilna, PWA, logo i powiadomienia.


V77 — naprawa mobilnego startu: ekran listy zawodów nie otwiera automatycznie ostatniego panelu wyników/losowania przy zwykłym uruchomieniu aplikacji. Otwarte zawody mogą zostać przywrócone wyłącznie po prawdziwym odświeżeniu strony. Zamknięcie panelu czyści stan i usuwa przyklejone menu.


V78 — twarda naprawa mobilnego startu: panel zawodów nigdy nie otwiera się automatycznie po starcie/reloadzie. Usunięto konflikt starego 6-kolumnowego grida z nowym paskiem: kafelki Losowanie/Wyniki mają pełną szerokość w układzie 5 kolumn, a GENERAL/STATYSTYKI są pionowo w ostatniej kolumnie. Wersja APP/SW/script query podniesiona do 78, aby telefon nie trzymał starego app.js.

V79 — odporna aktualizacja PWA: network-first dla HTML/app.js, osobny cache V79, automatyczne usuwanie starych cache, jednorazowy recovery po nieudanym starcie bez kasowania sesji i bez wyrejestrowania powiadomień, ekran 'Aktualizuję aplikację…' zamiast białego ekranu. Usunięto dolny panel Powiadomienia pod kafelkami (mobilny i desktop). W Wynikach T1/T2 usunięto powtórzony napis '1 tura/2 tura' pod nagłówkiem sektorowym. Skrót PWA i ikona rybki pozostają bez zmian.

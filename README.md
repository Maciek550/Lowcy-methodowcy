

V74: naprawa mobilnego przewijania po V73, aktualizacja PWA/cache, testy widoków i kafelków oraz czytelniejsze powiadomienia zawodnika.


V76 — poprawka desktopowego widoku zawodnika. Po kliknięciu Wyniki Tura 1 / Wyniki Tura 2 treść nie może już rozszerzać szerokości strony ani wypychać górnego menu poza ekran. Zachowana wersja mobilna, PWA, logo i powiadomienia.


V77 — naprawa mobilnego startu: ekran listy zawodów nie otwiera automatycznie ostatniego panelu wyników/losowania przy zwykłym uruchomieniu aplikacji. Otwarte zawody mogą zostać przywrócone wyłącznie po prawdziwym odświeżeniu strony. Zamknięcie panelu czyści stan i usuwa przyklejone menu.


V78 — twarda naprawa mobilnego startu: panel zawodów nigdy nie otwiera się automatycznie po starcie/reloadzie. Usunięto konflikt starego 6-kolumnowego grida z nowym paskiem: kafelki Losowanie/Wyniki mają pełną szerokość w układzie 5 kolumn, a GENERAL/STATYSTYKI są pionowo w ostatniej kolumnie. Wersja APP/SW/script query podniesiona do 78, aby telefon nie trzymał starego app.js.

V79 — odporna aktualizacja PWA: network-first dla HTML/app.js, osobny cache V79, automatyczne usuwanie starych cache, jednorazowy recovery po nieudanym starcie bez kasowania sesji i bez wyrejestrowania powiadomień, ekran 'Aktualizuję aplikację…' zamiast białego ekranu. Usunięto dolny panel Powiadomienia pod kafelkami (mobilny i desktop). W Wynikach T1/T2 usunięto powtórzony napis '1 tura/2 tura' pod nagłówkiem sektorowym. Skrót PWA i ikona rybki pozostają bez zmian.


V80 — tylko wersja zawodnika na komputerze: przywrócona maksymalna szerokość głównego obszaru 1220 px, a panele Wyniki Tura 1 / Wyniki Tura 2 są dodatkowo centrowane i ograniczone do 1080 px. Mobilka bez zmian.

V81 — zawodnik z listy głównej od 4 dni przed zawodami do dnia zawodów widzi pod ✓ ZAPISANY czerwony kafel POTWIERDŹ OBECNOŚĆ. Po kliknięciu kafel staje się zielony ✓ OBECNOŚĆ POTWIERDZONA. Zapis trafia do tego samego pola entries.confirmed, więc w panelu admina przy zawodniku automatycznie pojawia się zielone ✓. Rezerwowi nie mają przycisku. Zawodnik może potwierdzić tylko w jedną stronę; cofnięcie pozostaje wyłącznie po stronie admina. Zachowane poprawki v79/v80, PWA, mobile i desktop.


V82 — przebudowany panel „Moje stanowiska” dla zawodnika. Najważniejsze informacje (Tura, numer stanowiska, brzeg) mają osobne pola z krawędziami i większą typografią; sektor jest informacją drugorzędną. Układ wykorzystuje całą powierzchnię karty i ma osobne dopasowanie dla telefonu i desktopu. Zachowano potwierdzenie obecności z V81 oraz wcześniejsze poprawki PWA/wyników.


V84 — uporządkowany komputerowy widok zawodnika. Wszystkie kafle (Losowanie T1/T2, Wyniki T1/T2, General, Statystyki, Mapy) mają ten sam punkt przewinięcia i tę samą szerokość panelu. Pasek desktopowy korzysta z jednego stabilnego sticky slotu zamiast ręcznego fixed/left/width. Mobilka pozostaje bez zmian. Poprawiono też numery cache/recovery do V84.

V85 — desktop zawodnika: wszystkie kafle korzystają z jednego układu/punktu startu wzorowanego na działającym widoku GENERAL. Losowanie T1/T2, Wyniki T1/T2, Statystyki i Mapy mają jeden kontener 1080 px i identyczny początek panelu. Mobilka bez zmian. Dodatkowo ekran logowania/rejestracji otrzymał ciemny granatowy styl spójny z panelem zawodnika.


V86 — desktop zawodnika: wszystkie kafle mają ten sam mechanizm jak GENERAL. Ujednolicono szerokość i punkt przewijania, usunięto poziome rozpychanie przez mapy/tabele, statystyki dostały ten sam panel-kontener. Mobilne reguły nie zostały zmienione.


V87 — poprawka widoku zawodnika na komputerze: wszystkie kafelki (Losowanie T1/T2, Wyniki T1/T2, GENERAL, STATYSTYKI, Mapy T1/T2) przewijają pasek do jednego, identycznego punktu. Krótkie panele dostają minimalną wysokość viewportu, więc przeglądarka nie blokuje przewinięcia tak jak wcześniej. GENERAL pozostaje wzorcem zachowania. Mobile nie zmieniono funkcjonalnie; jego ścieżka przewijania została zachowana.


V88 — panel zawodnika stabilny po wejściu w szczegóły: pasek kafelków jest ustawiany na górze tylko raz przy otwarciu zawodów; kliknięcia Losowanie/Wyniki/General/Statystyki/Mapy nie przewijają strony. „Moje stanowiska” są wyświetlane wyłącznie w Losowaniu T1/T2; wyniki, General, Statystyki i mapy nie pokazują już elementów losowania. Zmiana obejmuje desktop i mobile. Usunięto obejście V87 z wymuszoną wysokością panelu.


V89 — stabilizacja nawigacji zawodnika:
- po wejściu w szczegóły pasek kafelków jest automatycznie dociągany do samej górnej krawędzi i od razu działa jako sticky/fixed,
- przełączanie Losowanie/Wyniki/GENERAL/Statystyki/Mapy zachowuje dokładnie tę samą pozycję scrolla (GENERAL nie może już obniżyć widoku),
- mapy mobilne są izolowane w kontenerze i skalowane do realnej szerokości ekranu, bez poszerzania dokumentu poza viewport,
- kontekst paneli pozostaje z V88: wyniki pokazują tylko wyniki, mapy tylko mapę, losowanie pokazuje moje stanowiska + sektory.

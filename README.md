

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


V90 — ADMIN: numery telefonów na liście głównej i rezerwowej zawodów oraz na liście zarejestrowanych zawodników są przyciskami `tel:`. Kliknięcie na telefonie otwiera ekran połączenia z gotowym numerem; na komputerze uruchamia dostępną aplikację obsługującą połączenia telefoniczne. Wypisani pozostają zwykłym tekstem. Zachowano poprawki V89.

V91 — Historia startów zawodnika.
- Nowy przycisk „Historia startów” obok „Mój profil” (tylko zawodnik).
- Historia jest liczona automatycznie z zakończonych startów, które mają komplet wyników T1 i T2.
- Każdy start zajmuje jeden zwarty wiersz: łowisko | data | T1 miejsce/liczba w sektorze + T2 miejsce/liczba w sektorze = miejsce GENERAL/liczba zawodników | łączna waga.
- Przykład: Lasomin | 12.09.2026 | 1/7 + 5/7 = 6/37 | 45 950 g.
- Układ desktop/mobile pozostaje jednowierszowy i oszczędza miejsce.
- Zachowane wszystkie funkcje V90, w tym przyciski telefoniczne w panelu administratora.


V92 — odświeżony ciemny panel administratora; nowe pola Zbiórka/godzina oraz Regulamin zawodów; dotychczasowe notatki są prezentowane zawodnikowi jako Informacje organizacyjne. Zawodnik ma nową zakładkę REGULAMIN oraz widzi godzinę zbiórki na listach i w szczegółach zawodów. Baza migruje automatycznie przez meeting_time i regulations.

V93 — Regulamin ogólny + naprawa edycji zawodów
- „Edytuj” przy zawodach otwiera bezpośrednio panel danych zawodów zamiast zwykłego panelu listy zawodników.
- Regulamin ogólny jest osobnym panelem dla zawodnika i administratora; admin może go edytować i zapisać globalnie.
- Pole regulaminu w konkretnych zawodach pozostaje osobne i jest opisane jako „Program / regulamin tych zawodów” — na harmonogram i zasady danego wydarzenia.
- Domyślna godzina zbiórki to 06:00; dotyczy nowych zawodów i wcześniejszych zawodów bez ustawionej godziny.
- Zachowany ciemny wygląd panelu administratora z V92 oraz wcześniejsze funkcje V91/V90.


V94 — delikatna poprawka wyłącznie menu stref admina na komputerze. Pięć kafelków (Lista zawodników, Losowanie i sektory, Wpisywanie wyników, Wyniki, Generowanie PDF) ma zawsze jeden rząd i nie znika przy przewijaniu krótszych paneli. Mobile pozostawiony bez zmian. Zachowane wszystkie funkcje V93.


V95 — zachowano poprawkę desktopowego menu admina z V94. Naprawiono żółte tło nieprzeczytanych powiadomień w panelu admina: powiadomienia mają ciemny granatowy motyw, nieprzeczytane są lekko jaśniejsze z niebieskim paskiem. Zmiana jest ograniczona do zakładki Powiadomienia admina; nie zmienia kolorów własnego stanowiska, gwiazdek nowych treści ani widoku zawodnika.


V96 — odświeżenie kart zawodów zawodnika: numer zawodów w jednej linii z nazwą, godzina zbiórki w prawym górnym rogu, dzień tygodnia i licznik START ZA w jednym wierszu, większe łowisko, status „ZAWODY OTWARTE”, czytelniejsze zapis/potwierdzenie oraz przyciski. Regulamin ogólny i Historia startów pozostają tylko w górnych zakładkach — nie są dokładane pod listą zawodów. Zachowano poprawki V95 admina i powiadomień.


V97 — zawodnik: górny przycisk Powiadomienia skrócony do NOWOŚCI; karty zawodów zagęszczone pionowo. Zawody Otwarte przeniesione do wiersza daty/odliczania, status zapisu i potwierdzenie obecności obok łowiska, a dół karty ma jeden wiersz: ZAPISANI | LOS/WYNIKI | ZAPISZ/REZYGNUJ. Poprawiony kontrast paneli Regulamin ogólny i Historia startów w ciemnym motywie.


## V98 — dopracowany kompaktowy panel zawodnika
- Regulamin ogólny oraz Historia startów w górnym menu są jawnie łamane na dwa wiersze u zawodnika.
- Karty zawodów zostały zagęszczone i uporządkowane w 4 stałych rzędach: numer/nazwa/godzina; data/dzień/start/status; łowisko/status zapisu/potwierdzenie; zapisani/LOS-WYNIKI/ZAPISZ-REZYGNUJ.
- Status ZAPISANY i OBECNOŚĆ POTWIERDZONA są w jednym rzędzie obok łowiska.
- Skrócono pusty panel „Brak zawodów w tej kategorii.”.
- Zmiany mobilne są ograniczone do widoku zawodnika; logika zapisów, losowań, wyników i panel admina pozostała bez zmian.


V99 — odporność uruchamiania PWA po aktualizacjach. Bez zmian wizualnych względem V98. Service Worker ma limit czasu dla nawigacji i app.js, navigation preload, natychmiastowy fallback z cache lub czytelny ekran offline. Boot watchdog po 8 s automatycznie usuwa tylko cache aplikacji i rejestrację Service Workera, zachowując token logowania, po czym wykonuje jeden czysty restart. Naprawiono klucz retry wersji. Manifest zachowuje id='/' i start_url='/', więc istniejącego skrótu z pulpitu nie trzeba tworzyć ponownie.


V100 — poprawa kontrastu w panelu administratora „Wpisywanie wyników”. Na mobile karty wpisów wyników mają spójne ciemne tło, jasne nazwiska i wartości, czytelne pola Stan./Sektor oraz etykiety. Tagi wag siatek i BF mają jawnie ustawione ciemne kolory tekstu na jasnych tłach również na desktopie. Placeholdery pól wag są czytelne. Zmiana jest ograniczona do strefy wpisywania wyników; zachowano odporność startu PWA z V99 i pozostałe funkcje bez zmian.


V101 — zachowany dobry widok wpisywania wyników z V100. Poprawiono wyłącznie czytelność strefy „Losowanie i sektory” w panelu admina: zagnieżdżone karty są ciemne, mapy pozostają jasne z wymuszonym ciemnym tekstem, nazwy sektorów/stanowisk i opisy są ponownie czytelne. Bez zmian logiki losowania, panelu zawodnika i PWA.

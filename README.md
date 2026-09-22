V124 — Naprawa dostarczania składników PDF

Serwer wysyła skrypty i czcionki jako pliki binarne, bez konwersji na JSON. Zmienione adresy składników omijają błędne kopie zapisane przez V123. Wszystkie funkcje i układy PDF z V123 pozostają. Sprawdzono rzeczywiste procedury obsługi pięciu plików: zgodność bajtów, poprawność JavaScript i nagłówków TTF. Wgraj cały komplet i zrestartuj aplikację.

V123 — Wszystkie PDF-y wektorowe

Tekst można zaznaczać i wyszukiwać, linie są wektorowe, czcionki z polskimi znakami osadzone w pliku. Dotyczy list startowych, losowań, wyników tur i sektorów, klasyfikacji generalnej oraz statystyk.

Losowanie T1 i T2: prosta tabela bez kolorowego wypełnienia i bez mapy, jedna strona na turę. Łączny plik T1 + T2 ma dwie strony.

Nowy przycisk w Generowaniu PDF: „PDF Tabelka wynikowa — 1 strona”. Wszyscy aktywni zawodnicy, kolumny Lp., Zawodnik, Waga 1–5, SUMA; pola wag i sumy puste do ręcznego wpisywania, co drugi wiersz delikatnie szary. Nagłówek: nazwa zawodów, data i łowisko w jednym wierszu.

WAŻNE: wgraj cały komplet, w tym pdf-vector.js oraz katalog pdf-assets z czcionkami i bibliotekami, następnie zrestartuj aplikację. PDF-y powstają w przeglądarce, bez wysyłania danych do zewnętrznych usług. Przy pierwszym eksporcie aplikacja pobiera składniki PDF z własnego serwera.

Weryfikacja: 16 wygenerowanych plików dla 40 i 100 zawodników; kontrola liczby stron, tekstu z polskimi znakami, ostatniego zawodnika i braku obrazów rastrowych. Podgląd wydruków tabelki wynikowej, losowania i wyników. Zachowane wcześniejsze funkcje aplikacji.

V122 — Nagłówek „Wpisz wagę” ma kolor aktywnej tury: T1 niebieski, T2 brązowy. Telefon i komputer.

V121 — Czytelne tury, kompaktowy panel admina, jednostronicowe PDF-y

• Sędzia: T1 niebieska, T2 pomarańczowa; aktywna tura ma białą ramkę i ✓, a formularz pasek w kolorze tury. Telefon i komputer.
• Usunięto powtórzony nagłówek pod filtrami zawodów (np. „Nadchodzące — 1”). Liczniki w przyciskach filtrów pozostają.
• Małe przyciski „Robimy zawody” i „Sędziowie wagowi” w jednym wierszu. Formularze domyślnie zwinięte.
• Lista startowa: jedna strona A4, wysokość wierszy dopasowana do liczby osób.
• Losowanie: mapa i kompletna lista na jednej stronie A4 dla każdej tury. Pakiet T1 + T2 ma łącznie dwie strony. Przy dłuższej liście tabela ma dwie kolumny.

Weryfikacja: rzeczywiście wygenerowane PDF-y dla 21, 40, 60 i 100 osób, jeden i dwa brzegi; kontrola liczby stron i obecności wszystkich nazwisk, podgląd graficzny wydruków dla 40 osób. Przy bardzo dużej liczbie osób tekst jest pomniejszany. Testy logiki sędziego i uprawnień przeszły. Interfejs nie był testowany wizualnie w przeglądarce.

Wgraj cały komplet plików i uruchom ponownie aplikację.

V120 — Sędzia wagowy

Tworzenie konta: zaloguj się jako administrator → Zawody → Sędziowie wagowi → Utwórz konto sędziego. Podaj imię, nazwisko, osobny nieużywany numer telefonu i hasło (minimum 8 znaków). Zaznacz zawody i zapisz.

Sędzia loguje się na zwykłym ekranie telefonem i hasłem. Ma trzy przyciski: Zawody, Wpisz wyniki, Wyniki. Widzi wyłącznie przypisane zawody. Wagi siatek i BF wpisuje w gramach dla T1 lub T2; zapis następuje po Enter lub opuszczeniu pola. Błędną wagę usuwa krzyżykiem. Dostęp do losowania, zarządzania zawodnikami i publikowania powiadomień jest zablokowany również na serwerze.

Administrator może zmienić przypisania, ustawić nowe hasło i wyłączyć konto w tej samej sekcji. Zmiany dostępu obowiązują przy kolejnych żądaniach. Aktualizacja tworzy potrzebną tabelę przypisań i kolumnę uprawnień podczas startu serwera. Wgraj komplet plików, w tym judge.cjs, i zrestartuj aplikację. Nie utworzono domyślnego konta ani wspólnego hasła.

Sprawdzono składnię oraz logikę dostępu i renderowanie menu w testach izolowanych. Testy nie obejmowały rzeczywistej bazy produkcyjnej ani wizualnego uruchomienia w przeglądarce.

Układ dymka V119: wielki puchar, miejsce, sektor/tura lub Klasyfikacja generalna, waga. Obsługuje również wcześniej zapisane gratulacje.

V119 — Duży puchar 104–144 px nad napisem Brawo TY! w dymkach sektorowych i generalnych, na telefonie i komputerze. W niskim widoku poziomym 72 px. Czas i zasady publikacji bez zmian.

V118 — Dodatkowo karp po publikacji T2 dla ostatnich miejsc w sektorach, także przy remisie; tekst TEN KARP CZEKA NA REWANŻ! Do zobaczenia na kolejnych zawodach! Obsługuje Ponów dymki T2.

V118 — Remisy dodatnich wag w sektorach T1 i T2: średnia zajmowanych miejsc, np. 1–2 = po 1,5 pkt, 2–4 = po 3 pkt. Ułamki zachowane w sumie miejsc i wyświetlane z przecinkiem w tabelach, historii, PDF i komunikatach. Dotychczasowa szczególna punktacja zerowych wag zachowana.

V117 — Zapis dymków przed powiadomieniami push, wysyłka push wyników nie blokuje publikacji. Awaria grafiki karpia pokazuje tekst zamiast zatrzymać kolejkę. Liczniki dymków T1/T2. Osobne Ponów dymki T1/T2/general z potwierdzeniem; standardowa publikacja nadal nie powtarza obejrzanych.

V116 — Realistyczna grafika karpia zamiast wektorowego rysunku, animowany wyskok z kroplami i falami. Grafika dołączona w paczce, cache przeglądarki; dymek startuje dopiero po wczytaniu ryby. Zasady publikacji i 8 sekund pozostają bez zmian.

V115 — Animowany karp wyskakujący z wody, krople, fale i POWODZENIA W 2 TURZE! po publikacji T1 dla ostatniego miejsca każdego sektora (także remisy). Pomija sektory jednoosobowe i bez przypisanego sektora. Dymek 8 s, raz na sektor/T1/zawodnika; pozostałe gratulacje zachowane. Lekka animacja SVG/CSS, z obsługą ograniczenia ruchu.

V114 — Dymki przez 8 sekund. Generalna osobno, z priorytetem przed turami. Potwierdzenie obejrzenia dopiero po wyświetleniu lub zamknięciu; ukrycie karty nie zużywa dymka. Publikacja generalnej pokazuje licznik oczekujących i już pokazanych gratulacji. Powtórna publikacja nie powtarza tego samego osiągnięcia.

V113 — Dymek na środku ekranu. Osobna publikacja klasyfikacji końcowej z przycisku w Wynikach admina; T1/T2 publikują wyłącznie swoje tury. Publikacja generalnej wymaga wyników obu tur, nie wymaga osobnego wpisu zerowej wagi każdemu zawodnikowi.

V112 — Gratulacje 1–3 po Powiadom o wynikach T1/T2. T2 publikuje także generalną; gratulacje generalne wymagają zapisanych wyników obu tur wszystkich aktywnych zawodników. Dymek 4 s, bez blokowania strony, raz dla osiągnięcia, przechowywany do zalogowania.

V111 — Czytelne, większe nazwiska i numeracja na białych kartach mobilnej listy zapisów admina. Przycisk Usuń obok Przywróć dla wypisanych, na komputerze i telefonie; usuwa wyłącznie zapis do danych zawodów, zachowuje konto.

V110 — Prośba o wypisanie na końcu wiersza zawodnika (komputer i telefon). Żółty kafelek widoczny tylko dla oczekujących próśb; jedno kliknięcie zatwierdza wypisanie i odświeża listy oraz powiadomienia.

V109 — mobilny podgląd całego łowiska w ustawieniach sektorów administratora.
Podgląd aktualizuje się podczas edycji. Sektory osobno dostępne po rozwinięciu. Duże mapy można przewijać poziomo.

ŁOWCY METHODOWCY — V108

Wgraj całą zawartość paczki, zastępując pliki aplikacji, i uruchom ją ponownie.
W nagłówku powinna pojawić się wersja V108.

Zebrane poprawki:
- Zawodnik: stały górny panel na komputerze, większe ikonki i napisy przy zachowaniu wymiarów przycisków.
- Dolny panel: same ikony, wysokość 44 px, bez dużych marginesów, na wszystkich zakładkach zawodnika.
- Domek: główna lista zawodów i góra strony. Mapa/puchar/statystyki: otwarte zawody lub najbliższe, gdy jesteś poza panelem zawodów. Dzwonek: powiadomienia. Strzałka: dół strony.
- Admin: osobna zakładka „Prośby o wypisanie”, czerwony licznik, zatwierdzanie i odrzucanie. Odczyt i zbiorcze usunięcie powiadomień nie rozstrzygają próśb.
- Lista bez dublowania: Nadchodzące, Zapisane, Historia od następnego dnia po zawodach (czas polski).
- Formularz tworzenia zawodów domyślnie zwinięty pod „Robimy zawody”.
- Pełny podpis „LOSOWANIE / WYNIKI” bez powiększania przycisku.
- Poprawiona czytelność listy zawodników i wyników administratora, w tym Waga, Stan., Sektor i BF.

Weryfikacja: składnia JavaScript; testy logiki skrótów, filtrów, przypięcia oraz obsługi oczekujących próśb z atrapą bazy. Nie wykonano testu wizualnego w przeglądarce ani integracyjnego na produkcyjnej bazie.

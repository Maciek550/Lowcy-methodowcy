V184 — LICZNIKI FILTRÓW W JEDNYM WIERSZU

- na telefonie liczba przy „Nadchodzące” i „Zapisane” jest obok nazwy, a nie pod nią;
- napisy i liczniki dopasowują się do szerokości ekranu, „Historia” pozostaje w drugim wierszu.

V183 — CZYTELNE KAFLE FILTRÓW ZAWODÓW

- większe napisy i liczniki „Nadchodzące”, „Zapisane”, „Historia”;
- na węższych telefonach dwa kafle są w pierwszym rzędzie, a „Historia” na całą szerokość w drugim;
- aktywny filtr ma mocny niebieski kolor i wyraźną krawędź;
- wybór miesiąca jest większy i czytelniejszy.

V182 — ZAKOŃCZONE ZAWODY TYLKO W HISTORII

- „Zapisane” pokazuje i liczy jedynie nadchodzące zawody, na które zawodnik jest zapisany;
- zawody z wcześniejszą datą pozostają w „Historii” i znikają z listy „Zapisane”;
- po dacie zawodów znika przycisk „Zrezygnuj”, a „Losowanie / wyniki” nadal otwiera szczegóły.

V181 — CZYTELNE PRZYCISKI ZAWODNIKA

- główna akcja na liście zawodów ma pełną szerokość: Zapisz się, Potwierdź obecność lub Losowanie / wyniki;
- Zrezygnuj oraz potwierdzony stan obecności są mniejsze, a wyniki pozostają dostępne podczas oczekiwania na potwierdzenie;
- data i godzina zbiórki mają mocny kontrast; godzina jest w prawym górnym rogu;
- liczba zapisanych, rezerwa oraz odliczanie do zawodów pozostają widoczne na telefonie i komputerze;
- przyciski i informacje zawijają się na węższych ekranach bez zmniejszania tekstu do nieczytelnych rozmiarów;
- powiadomienie o nowym wyniku nadal otwiera właściwy widok po dotknięciu dużego przycisku.

V156 — ARCHIWIZACJA ZAWODNIKA BEZ KASOWANIA HISTORII

- „Usuń zawodnika” archiwizuje konto zamiast fizycznie usuwać rekord z bazy;
- zapisane wyniki, wagi, losowania i udział w zawodach pozostają w historii i klasyfikacjach;
- zarchiwizowany zawodnik znika z aktywnej listy, nie może się logować i nie dostaje nowych powiadomień;
- ponowna rejestracja tym samym numerem telefonu przywraca ten sam rekord zawodnika wraz z historią;
- import zawodnika dodanego przez administratora może ponownie aktywować zarchiwizowany rekord.

V155 — CZYTELNY REGULAMIN OGÓLNY ADMINISTRATORA

- na białej karcie nagłówek, podpis i opis mają ciemny, czytelny tekst na telefonie i komputerze;
- ciemne karty pozostają czytelne, a wersja aplikacji i cache PWA są zaktualizowane do V155.

V154 — KONTRAST NA TELEFONIE SĘDZIEGO

- zapisane siatki i BF mają ciemne napisy na jasnych etykietach;
- wpisy oczekujące mają ciemny tekst, a błędne jasny na ciemnym tle;
- numer miejsca w klasyfikacji końcowej ma ciemny tekst na jasnym tle.

V153 — CZYTELNE WYNIKI SĘDZIEGO NA KOMPUTERZE

- w wynikach sektorowych i klasyfikacjach sędziego jasne komórki mają ciemne cyfry i nazwiska;
- kolorowe oznaczenia miejsc 1–3 mają jasną czcionkę, a BF wyraźną czerwień;
- na jasnej tabeli wpisów suma i BF są czytelne również po zapisaniu;

V152 — CZYTELNE WAGI SĘDZIEGO NA KOMPUTERZE

- biała tabela wpisywania wyników sędziego ma ciemny tekst w wierszach;
- zapisane wagi siatek i BF mają ciemny tekst na jasnych etykietach;
- oczekujące i błędne wpisy oraz pola nowej wagi zachowują czytelny kontrast;
- układ mobilny V151 pozostaje bez zmian.

V151 — ZWARTY IMPORT Z CHATGPT

- na telefonie każdy zawodnik mieści W1–W5 i SUMA w jednym wierszu, z numerem i inicjałami po prawej;
- jasne pola pokazują odczytane wagi bez przewijania przez puste, wysokie pola;
- lista kontrolna przewija się wewnątrz ekranu, a przyciski importu pozostają na dole;
- import wysyła pełną listę zawodników, również osoby bez wpisów niewidoczne w podglądzie;
- wersja/cache/probe zaktualizowane do V151.

V142 — HYBRYDOWY OCR / SUROWA KOLOROWA KOMÓRKA

- Google Vision dostaje prawie całą komórkę W1–W5/SUMA w oryginalnym kolorze;
- usunięto agresywne progowanie i sztuczne wzmacnianie kontrastu przed OCR;
- zwiększono margines odczytu przy lewej i prawej krawędzi, aby nie ucinać * i końcowych zer;
- wycinek OCR ma 700x210 px, JPEG 95%;
- lokalne wykrywanie pustej/zapisanej komórki pozostaje po stronie aplikacji;
- SUMA/BF i wszystkie reguły importu pozostają bez zmian;
- wersja/cache/probe zaktualizowane do V142.

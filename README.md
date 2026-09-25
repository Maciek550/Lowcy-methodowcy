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

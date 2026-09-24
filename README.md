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

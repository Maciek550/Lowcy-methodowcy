# Import historycznych zawodów (oddzielny moduł)

Dotychczasowy import listy startowej z zawody.pro pozostaje bez zmian.

## Zasady nowego importera

1. Dwa wejścia: adres zawodów zawody.pro oraz PDF wyników.
2. Parsowanie wyników i weryfikacja kompletności danych (zawodnik, tura, sektor, stanowisko, waga, BF, miejsce sektorowe, klasyfikacja).
3. Podgląd z ręczną edycją pól. Żadnych zapisów przed świadomym zatwierdzeniem.
4. Dopasowanie kont po znormalizowanym pełnym imieniu i nazwisku; preferowane konto z prawdziwym telefonem, następnie najstarsze.
5. Konflikty tożsamości i duplikaty prezentowane administratorowi; nie wolno automatycznie usuwać kont.
6. Zapis zatwierdzonego importu atomowo, z idempotentną identyfikacją zawodów i wyników, oraz pełnym wycofaniem transakcji w razie błędu.
7. Historia zawodnika łączona dopiero po weryfikacji i z zachowaniem danych logowania.
8. Przed wdrożeniem: testy parserów, klasyfikacji sektorowej, konfliktów ID, wielokrotnego importu i rollbacku.

## V302

- Osobny panel administratora: zawody.pro, pełny tekstowy PDF z tabelami sektorowymi, CSV.
- Edytowalna tabela, powiązania kont, ponowna walidacja i podpisany podgląd ważny 15 minut.
- Cyrylica i polskie znaki zachowane. Konto z telefonem ma pierwszeństwo; techniczne konto bez logowania może przekazać historię i zostać zarchiwizowane. Dwa rzeczywiste konta wymagają wyboru ID. Nakładająca się historia blokuje scalanie.
- Nowi zawodnicy dostają wpis historyczny EXTERNAL z losowym niedostępnym hasłem; istniejące dane logowania nie są zmieniane.
- Zapis transakcyjny, blokada powtórek, źródłowe punkty sektorowe, suma NET + BF równa wadze całkowitej, dziennik importu.
- PDF skanowany bez tekstu nie jest obsługiwany; importer zgłasza brak kompletnej tabeli zamiast zgadywać wyniki.
- Testy repozytorium używają wyłącznie sztucznych danych. Test integracyjny uruchamiać tylko na oddzielnej bazie: `DATABASE_URL=... node --test historical-import/integration.cjs`.

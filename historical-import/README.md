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

## Stan

To specyfikacja nowego modułu, nie ukończony importer. Moduł `import-preview.cjs` na tej gałęzi zapewnia wyłącznie wstępne dopasowanie kont, bez zapisu do bazy. Produkcja Railway nie została zmieniona.

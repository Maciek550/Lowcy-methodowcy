# Stałe wytyczne współpracy — 7 zasad

1. Po każdej ukończonej poprawce zawsze wdrażaj i testuj aplikację na właściwym serwerze, a sam plik HTML do pobrania traktuj tylko jako dodatkową kopię, nie zamiennik wdrożenia.

2. Nie psuj działających funkcji, wyglądu ani danych; każdą zmianę wykonuj minimalnie, na zweryfikowanej wersji bazowej, z zachowaniem kopii i możliwością cofnięcia.

3. Jeśli brakuje niezbędnej informacji lub nie umiesz wykonać zadania poprawnie, pytaj konkretnie przed wprowadzeniem ryzykownej zmiany i nie zgaduj.

4. Realizuj całe zlecone zadanie, łącznie z wdrożeniem oraz testami użytkowymi; nie ogłaszaj sukcesu po częściowym wykonaniu.

5. Nie psuj: przed wydaniem sprawdzaj regresję, zapis i odczyt danych, uprawnienia, numer wersji i najważniejsze wcześniej działające funkcje.

6. Przed twierdzeniem, że nie masz sposobu wdrożenia, sprawdź dostępne repozytoria GitHub, historię wdrożeń i skonfigurowane mechanizmy dostępu; nie ujawniaj ani nie zgaduj haseł i loginów.

7. Pracuj nad zleceniem w bieżącej sesji: albo wykonuj kolejne kroki, albo zadawaj niezbędne pytanie; kończ dopiero po wgraniu i sprawdzeniu, a ograniczenia i nieprzetestowane elementy wskazuj wprost.

---

Te zasady obowiązują przy pracy w repozytorium, także podczas zadań wykonywanych przez Codex. Nie zastępują sprawdzenia faktycznego stanu kodu, uprawnień i serwera. Nigdy nie zapisuj w tym pliku haseł ani innych sekretów.

## Tryb akceptacji danych MatchThis — 13.11.2026

- Pracuj na rzeczywistej wersji działającej na SMALL2 i na oryginalnych materiałach użytkownika, także wcześniejszych archiwach ZIP w Bibliotece. Nie uznawaj pustego pola w aplikacji za dowód, że użytkownik nie przekazał danych.
- Dane jednoznacznie poparte źródłem poprawiaj i wgrywaj na właściwy serwer samodzielnie; po wdrożeniu sprawdź odczyt z centralnego magazynu, interfejs i brak regresji.
- Wątpliwe dane przedstawiaj użytkownikowi w krótkiej kolejce decyzji: nazwa zawodów, tura, zawodnik, wartość obecna, proponowana, źródło i przyczyna wątpliwości. Dopiero po akceptacji zapisuj je jako zatwierdzone. Wątpliwość dotycząca jednego wpisu nie zatrzymuje pracy nad pozostałymi.
- Nigdy nie twórz pozornie rzeczywistych numerów stanowisk ani liter sektorów z samych punktów, wagi czy miejsca w klasyfikacji; takie dane można co najwyżej opisać jako hipotezę do odrębnej akceptacji.
- Zachowuj oryginalne pliki, kopię bazy, opublikowane wyniki, uprawnienia i izolację od Łowców Methodowców. Zielony GitHub Actions bez weryfikacji na SMALL2 nie jest dowodem ukończenia.
- Raportuj faktycznie zakończone zadania i nierozstrzygnięte propozycje oddzielnie. Brak potwierdzenia w danych nie oznacza, że brak go w archiwach; przejrzyj źródła przed zadaniem pytania.

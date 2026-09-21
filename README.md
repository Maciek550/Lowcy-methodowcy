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

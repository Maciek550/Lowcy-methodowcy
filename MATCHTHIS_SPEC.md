# MatchThis – specyfikacja robocza v1

## Założenie
Nowy projekt oparty funkcjonalnie na Łowcy Methodowcy, ale z całkowicie nowym UI inspirowanym stylistyką matchthis.pl. Projekt ma być wdrożony jako osobny projekt na Railway i nie może ingerować w produkcyjną aplikację Łowcy Methodowcy.

## Role

### ADMIN / ORGANIZATOR
- główna rola systemu
- tworzenie i edycja zawodów
- baza zawodników
- dodawanie zawodników do konkretnych zawodów
- konfiguracja sektorów i stanowisk
- losowanie automatyczne
- możliwość ręcznego wpisania / poprawienia losowania
- przypisywanie sędziów wagowych
- publikacja losowania i wyników
- kontrola aktywacji kont użytkowników

### SĘDZIA WAGOWY
- uproszczony panel operacyjny
- dostęp tylko do przypisanych zawodów / sektorów / stanowisk
- wpisywanie wag i wyników
- brak dostępu do ustawień administracyjnych

### USER / ZAWODNIK
- rola jest przygotowana w systemie, ale domyślnie NIEAKTYWNA
- admin decyduje, kiedy funkcja kont zawodników zostaje włączona
- przed aktywacją zawodnicy istnieją tylko jako rekordy w bazie i są obsługiwani przez admina
- po aktywacji użytkownik może dostać konto i własny widok

### GOŚĆ
- bez logowania
- publiczny podgląd opublikowanych zawodów
- oglądanie opublikowanego losowania, jeśli admin je udostępni
- oglądanie wyników i klasyfikacji
- brak możliwości edycji, zapisu i wpisywania danych

## Baza zawodników
- organizator prowadzi własną bazę zawodników
- zawodnika można dodać ręcznie
- z bazy zawodników admin dopisuje osoby do konkretnych zawodów
- baza zawodników nie wymaga aktywnego konta usera

## Zawody
- strona zawodów ma mieć nowe UI w stylu MatchThis: jasna baza, biel/szarość, pomarańczowe akcenty, duże czytelne sekcje
- sektory są zawsze prowadzone wzdłuż brzegu
- losowanie automatyczne + możliwość ręcznego wpisania i korekty

## Izolacja projektu
- MatchThis rozwijamy na osobnej gałęzi / osobnym wdrożeniu
- żadnych zmian w produkcyjnym Łowcy Methodowcy bez osobnej decyzji

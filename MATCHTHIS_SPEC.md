# MatchThis – specyfikacja robocza v1

## Założenie
Nowy projekt oparty funkcjonalnie na Łowcy Methodowcy, ale z całkowicie nowym UI inspirowanym stylistyką matchthis.pl. Projekt ma być wdrożony jako osobny projekt na Railway i nie może ingerować w produkcyjną aplikację Łowcy Methodowcy.

## Role

### ADMIN / ORGANIZATOR
- główna rola systemu
- tworzenie i edycja zawodów oraz cykli
- baza zawodników
- dodawanie zawodników do konkretnych zawodów / tur cyklu
- konfiguracja sektorów i stanowisk
- losowanie automatyczne
- możliwość ręcznego wpisania / poprawienia losowania
- przypisywanie sędziów wagowych
- publikacja losowania i wyników
- kontrola aktywacji kont użytkowników

### SĘDZIA WAGOWY
- uproszczony panel operacyjny
- dostęp tylko do przypisanych zawodów / sektorów / stanowisk
- wpisywanie maksymalnie dwóch wag siatek dla zawodnika
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
- baza zostanie dostarczona do importu
- zawodnika można dodać ręcznie
- z bazy zawodników admin dopisuje osoby do konkretnych zawodów / tur cyklu
- baza zawodników nie wymaga aktywnego konta usera

## Typy rozgrywek
Przy tworzeniu organizator wybiera:
1. Zawody 1-turowe
2. Zawody 2-turowe
3. Utwórz cykl

### Zawody 1-turowe
- jedna tura
- klasyfikacja na podstawie wyniku tej tury

### Zawody 2-turowe
- dwie tury
- klasyfikacja końcowa liczona z obu tur
- losowanie T2 musi uwzględniać historię T1

### Cykl
- cykl może zawierać wiele tur; obecny przypadek: 6 tur
- klasyfikacja całego cyklu liczona łącznie według zasad cyklu
- liczba osób awansujących do finału jest ustawiana przez admina, np. 45
- UI ma wyraźnie pokazywać linię odcięcia / AWANS
- system ma obsługiwać import wyników historycznych wcześniejszych tur i kontynuację kolejnych tur w tym samym cyklu

## Zawody i UI
- strona zawodów ma mieć nowe UI w stylu MatchThis: jasna baza, biel/szarość, pomarańczowe akcenty, duże czytelne sekcje
- interfejs ma być czytelny i kompaktowy
- automat proponuje ustawienia, ale użytkownik może je zmienić
- desktop i mobile mają być projektowane równolegle

## Sektory i stanowiska
- sektory są zawsze prowadzone wzdłuż brzegu
- admin podaje liczbę sektorów oraz liczbę zawodników w sektorze
- system zawsze pokazuje np. „A – 12 zawodników”, „B – 13 zawodników”
- system proponuje równy podział zawodników między sektory
- admin może ręcznie zmienić proponowane liczby
- system pokazuje także zakresy stanowisk dla każdego sektora
- zakresy stanowisk i wizualizacja brzegu mają być funkcjonalnie podobne do Łowców, ale w nowym UI
- automat proponuje zakresy stanowisk, admin może je poprawić
- możliwe jest wyłączanie pojedynczych stanowisk

## Losowanie
- losowanie automatyczne + możliwość ręcznego wpisania i korekty
- system nie może przydzielić tego samego stanowiska dwóm zawodnikom
- system nie może użyć stanowiska wyłączonego
- w zawodach 2-turowych oraz w cyklu automat ma pilnować historii sektorów zawodnika
- SEKTOR SKRAJNY – zasada specjalna: zawodnik nie może drugi raz otrzymać pierwszego sektora ani drugi raz otrzymać ostatniego sektora
- „pierwszy sektor” oznacza sektor o najniższej pozycji na brzegu, np. A
- „ostatni sektor” oznacza sektor o najwyższej pozycji na brzegu, np. D przy sektorach A–D
- w zawodach 2-turowych: jeśli zawodnik miał w T1 sektor A, nie może dostać A w T2; jeśli miał ostatni sektor, nie może dostać ostatniego sektora w T2
- w cyklu: historia skrajnych sektorów jest liczona przez wszystkie dotychczas rozegrane tury cyklu; po otrzymaniu pierwszego sektora zawodnik nie może dostać go ponownie w kolejnej turze cyklu, analogicznie dla ostatniego sektora
- sektory środkowe mogą się powtarzać, o ile inne reguły losowania tego nie zabraniają
- jeśli przy danej konfiguracji nie istnieje poprawne losowanie spełniające ograniczenia, system ma zgłosić konflikt zamiast łamać regułę po cichu

## Ważenie i wyniki
- brak BF
- dla zawodnika w danej turze maksymalnie dwie wagi siatek: SIATKA 1 i SIATKA 2
- druga waga jest opcjonalna
- wynik tury = suma SIATKA 1 + SIATKA 2
- wpisywanie wag przez admina lub sędziego wagowego
- klasyfikacje mają być liczone automatycznie według zasad danego typu rozgrywek

## Dane historyczne
- zostaną dostarczone wyniki 4 rozegranych tur cyklu
- dane mają zostać zaimportowane do tego samego modelu co nowe tury
- system ma następnie obsłużyć zaplanowanie i rozegranie 5. i 6. tury

## Izolacja projektu
- MatchThis rozwijamy na osobnej gałęzi / osobnym wdrożeniu
- żadnych zmian w produkcyjnym Łowcy Methodowcy bez osobnej decyzji

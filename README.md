# Carp Mobile App — MVP

Oddzielna aplikacja PWA do zapisów zawodników i panelu admina.

## Funkcje MVP
- rejestracja zawodnika bez zatwierdzania,
- logowanie telefon + hasło,
- zapamiętanie sesji w aplikacji,
- profil: imię, nazwisko, numer Koła PZW,
- panel admina,
- tworzenie zawodów,
- zapis i wypis zawodnika,
- powiadomienia w aplikacji dla admina,
- przygotowana obsługa Web Push.

## Zmienne środowiskowe
- `PORT=3000`
- `DATABASE_URL=postgresql://...`
- `JWT_SECRET=...`
- `ADMIN_SETUP_CODE=...`
- `VAPID_PUBLIC_KEY=...`
- `VAPID_PRIVATE_KEY=...`
- `VAPID_SUBJECT=mailto:...`

## Pierwsze konto admina
Po wejściu w aplikację rozwiń „Pierwsze konto admina”, wpisz `ADMIN_SETUP_CODE` i ustaw własny telefon oraz hasło.

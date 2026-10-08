# MatchThis Cloudflare v0.1

Całkowicie osobny prototyp MatchThis przygotowany pod Cloudflare Workers + D1. Nie korzysta z Railway i nie wpływa na produkcyjną aplikację Łowcy Methodowcy.

## Pierwsze wdrożenie przez Cloudflare
1. Cloudflare Dashboard → Workers & Pages → Create application → Import a repository.
2. Wybierz repozytorium `Maciek550/Lowcy-methodowcy`.
3. Branch: `matchthis`.
4. Root directory: `matchthis-cloudflare`.
5. Deploy command: `npx wrangler deploy`.
6. Build command: pozostaw puste.

## D1
Po uruchomieniu prototypu utwórz bazę D1 `matchthis-db`, wykonaj `schema.sql`, a następnie dodaj binding `DB` do `wrangler.toml` z identyfikatorem bazy.

## Zakres v0.1
- nowy UI MatchThis,
- panel admina,
- wejście do zawodów 1-turowych / 2-turowych / cyklu,
- konfigurator sektorów i zakresów stanowisk,
- automat proponujący podział,
- możliwość ręcznej korekty,
- wizualizacja brzegu,
- podgląd cyklu 6 tur / TOP 45,
- baza zawodników jako moduł importu,
- sędzia wagowy: SIATKA 1 + opcjonalna SIATKA 2, bez BF.

## Izolacja
Railway Łowców nie jest modyfikowany. MatchThis ma własny katalog, konfigurację Cloudflare i docelowo własną bazę D1.

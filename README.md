V141 — HYBRYDOWY ODCZYT FORMULARZA / SZYBSZY CLOUD OCR

Zmiany względem V140:
- przed analizą zdjęcia aplikacja sprawdza /api/config; jeśli Cloud Vision nie ma klucza, pokazuje od razu konkretny komunikat zamiast czekać na timeout;
- wycinki komórek są wysyłane jako lekkie JPEG 420×128 zamiast PNG 720×220 — znacznie mniejszy upload z telefonu;
- paczki po maks. 16 komórek są wysyłane do Google Cloud Vision równolegle zamiast sekwencyjnie;
- timeout każdej paczki backendu 35 s, timeout telefonu 50 s;
- log PHOTO_OCR_V141 pokazuje liczbę komórek, paczek i rzeczywisty czas OCR;
- zachowany wybór: ZRÓB ZDJĘCIE / WCZYTAJ Z PLIKU;
- zachowana logika SUMA/BF, pojedyncze 1 g -> 0 i większy zegar z V140.

WYMAGANE W RAILWAY:
GOOGLE_VISION_API_KEY oraz włączone Google Cloud Vision API.

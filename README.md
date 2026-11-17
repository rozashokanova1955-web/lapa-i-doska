# Лапа и доска: система заказов мебели для животных

Нужен только Python 3.8+ (сторонние библиотеки не требуются).

    python server.py

Сайт: http://localhost:8000 (другой порт: PORT=9000 python server.py).
База SQLite (pets.db) создаётся при первом запуске.

Демо-входы: client@lapa.ru / client123, manager@lapa.ru / manager123,
master@lapa.ru / master123, admin@lapa.ru / admin123.

Структура: server.py (API и база), static/index.html, static/style.css, static/app.js.
Перед публикацией в интернет смените демо-пароли и поставьте сервер за HTTPS.

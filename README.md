# Novel Reader - Telegram Mini App

Платформа для чтения и публикации переводов корейских новелл в Telegram.

## Функционал

- 📚 Чтение новелл
- 🔖 Закладки и подписки
- 📝 Кабинет переводчика
- 📊 Статистика просмотров и подписчиков

## Технологии

- Frontend: Telegram Mini Apps API
- Backend: FastAPI + Vercel PostgreSQL
- Деплой: Vercel

## Структура проекта

```
📁 novels-reader/
├── 📁 api/                    # Backend на FastAPI
│   ├── 📄 __init__.py
│   ├── 📄 database.py        # Работа с Postgres
│   └── 📄 main.py           # API эндпоинты
│
├── 📁 public/                # Статические файлы
│   ├── 📁 css/              # Стили
│   └── 📁 js/               # JavaScript
│
├── 📁 src/                   # HTML файлы
│   ├── 📄 index.html        # Главная
│   ├── 📄 novel.html        # Страница новеллы
│   ├── 📄 chapter.html      # Читалка
│   └── 📄 translator.html   # Кабинет переводчика
```

## Установка и запуск

1. Клонируйте репозиторий
```bash
git clone https://github.com/username/novels-reader.git
cd novels-reader
```

2. Установите зависимости
```bash
npm install
pip install -r requirements.txt
```

3. Создайте файл .env и добавьте переменные окружения
```
POSTGRES_URL=your_postgres_url
BOT_TOKEN=your_bot_token
```

4. Запустите локальный сервер
```bash
npm start
```

## Деплой

Проект автоматически деплоится на Vercel при пуше в main ветку.

Для ручного деплоя:
```bash
npm run deploy
```

## Разработка

1. Создайте новую ветку для фичи
```bash
git checkout -b feature/name
```

2. Внесите изменения и закоммитьте
```bash
git add .
git commit -m "Add feature"
```

3. Отправьте пулл реквест

## Лицензия

MIT

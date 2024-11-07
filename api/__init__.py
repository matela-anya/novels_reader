"""
Novels Reader API
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Создаем экземпляр FastAPI
app = FastAPI(
    title="Novels Reader API",
    description="API для чтения и публикации переводов корейских новелл",
    version="1.0.0"
)

# Настраиваем CORS для работы с Telegram Mini App
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене заменить на конкретный домен
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Импортируем роуты
from .main import *

# Обработчик ошибок для красивых JSON-ответов
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return {
        "status": "error",
        "message": str(exc),
        "path": request.url.path
    }

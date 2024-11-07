"""
Main API routes for Novels Reader
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
import json
from pydantic import BaseModel
from .database import db

router = APIRouter()

# Модели данных
class TranslatorCreate(BaseModel):
    user_id: str
    username: Optional[str]
    display_name: str
    bio: Optional[str]

class NovelCreate(BaseModel):
    title: str
    description: Optional[str]
    cover_url: Optional[str]
    translator_id: str

class ChapterCreate(BaseModel):
    novel_id: int
    chapter_number: int
    title: str
    content: str

# Middleware для подключения к БД
async def get_db():
    if not db.pool:
        await db.connect()
        await db.init_tables()
    return db

# Роуты для переводчиков
@router.post("/api/translators")
async def create_translator(data: TranslatorCreate, db = Depends(get_db)):
    try:
        translator = await db.create_translator(**data.dict())
        return {"status": "success", "data": translator}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/api/translators/{user_id}")
async def get_translator(user_id: str, db = Depends(get_db)):
    translator = await db.get_translator(user_id)
    if not translator:
        raise HTTPException(status_code=404, detail="Translator not found")
    return {"status": "success", "data": translator}

# Роуты для новелл
@router.get("/api/novels")
async def get_novels(
    limit: int = 20,
    offset: int = 0,
    translator_id: Optional[str] = None,
    db = Depends(get_db)
):
    novels = await db.get_novels(limit, offset, translator_id)
    return {"status": "success", "data": novels}

@router.post("/api/novels")
async def create_novel(data: NovelCreate, db = Depends(get_db)):
    try:
        novel = await db.create_novel(data.dict())
        return {"status": "success", "data": novel}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/api/novels/{novel_id}")
async def get_novel(novel_id: int, db = Depends(get_db)):
    novel = await db.get_novel(novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")
    
    # Увеличиваем счетчик просмотров
    await db.increment_novel_views(novel_id)
    return {"status": "success", "data": novel}

# Роуты для глав
@router.get("/api/novels/{novel_id}/chapters")
async def get_chapters(
    novel_id: int,
    limit: int = 20,
    offset: int = 0,
    db = Depends(get_db)
):
    chapters = await db.get_chapters(novel_id, limit, offset)
    return {"status": "success", "data": chapters}

@router.post("/api/chapters")
async def create_chapter(data: ChapterCreate, db = Depends(get_db)):
    try:
        chapter = await db.create_chapter(data.dict())
        return {"status": "success", "data": chapter}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/api/chapters/{chapter_id}")
async def get_chapter(chapter_id: int, db = Depends(get_db)):
    chapter = await db.get_chapter(chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Увеличиваем счетчик просмотров
    await db.increment_chapter_views(chapter_id)
    return {"status": "success", "data": chapter}

# Поиск
@router.get("/api/search")
async def search_novels(
    query: str,
    limit: int = 20,
    db = Depends(get_db)
):
    results = await db.search_novels(query, limit)
    return {"status": "success", "data": results}

# Подключаем роутер к приложению
from . import app
app.include_router(router)

```python
"""
Main API routes for Novels Reader
"""
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
from pydantic import BaseModel
import os
import asyncpg

# Создаем экземпляр FastAPI
app = FastAPI(
    title="Novels Reader API",
    description="API для чтения и публикации переводов корейских новелл",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Database connection
async def get_db():
    return await asyncpg.create_pool(
        os.environ["DATABASE_URL"],
        min_size=1,
        max_size=1
    )

# Функция для создания таблиц
async def ensure_tables(pool):
    async with pool.acquire() as conn:
        # Проверяем существование таблиц
        exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'novels'
            )
        """)
        
        if not exists:
            # Таблица переводчиков
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS translators (
                    user_id TEXT PRIMARY KEY,
                    username TEXT,
                    display_name TEXT NOT NULL,
                    bio TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Таблица новелл
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS novels (
                    id SERIAL PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    cover_url TEXT,
                    translator_id TEXT REFERENCES translators(user_id),
                    status TEXT DEFAULT 'ongoing',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    views INTEGER DEFAULT 0,
                    subscribers_count INTEGER DEFAULT 0,
                    chapters_count INTEGER DEFAULT 0
                )
            ''')

            # Таблица глав
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS chapters (
                    id SERIAL PRIMARY KEY,
                    novel_id INTEGER REFERENCES novels(id) ON DELETE CASCADE,
                    chapter_number INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    views INTEGER DEFAULT 0
                )
            ''')

# Обработчики ошибок
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": str(exc),
            "path": request.url.path
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "message": exc.detail,
            "path": request.url.path
        }
    )

# Роуты для переводчиков
@app.post("/api/translators")
async def create_translator(data: TranslatorCreate):
    pool = await get_db()
    try:
        await ensure_tables(pool)
        async with pool.acquire() as conn:
            translator = await conn.fetchrow("""
                INSERT INTO translators (user_id, username, display_name, bio)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            """, data.user_id, data.username, data.display_name, data.bio)
            return JSONResponse(content={"status": "success", "data": dict(translator)})
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await pool.close()

@app.get("/api/translators/{user_id}")
async def get_translator(user_id: str):
    pool = await get_db()
    try:
        await ensure_tables(pool)
        async with pool.acquire() as conn:
            translator = await conn.fetchrow(
                "SELECT * FROM translators WHERE user_id = $1",
                user_id
            )
            if not translator:
                raise HTTPException(status_code=404, detail="Translator not found")
            return JSONResponse(content={"status": "success", "data": dict(translator)})
    finally:
        await pool.close()

@app.get("/api/translators/{user_id}/stats")
async def get_translator_stats(user_id: str):
    pool = await get_db()
    try:
        await ensure_tables(pool)
        async with pool.acquire() as conn:
            stats = await conn.fetchrow("""
                SELECT 
                    COUNT(*) as novels_count,
                    COALESCE(SUM(chapters_count), 0) as chapters_count,
                    COALESCE(SUM(subscribers_count), 0) as subscribers_count,
                    COALESCE(SUM(views), 0) as total_views
                FROM novels 
                WHERE translator_id = $1
            """, user_id)
            return JSONResponse(content={
                "status": "success",
                "data": dict(stats) if stats else {
                    "novels_count": 0,
                    "chapters_count": 0,
                    "subscribers_count": 0,
                    "total_views": 0
                }
            })
    finally:
        await pool.close()

# Роуты для новелл
@app.get("/api/novels")
async def get_novels(
    page: int = 1,
    limit: int = 20,
    translator_id: Optional[str] = None,
    ids: Optional[str] = None
):
    pool = await get_db()
    try:
        await ensure_tables(pool)
        async with pool.acquire() as conn:
            query = "SELECT n.*, t.display_name as translator_name FROM novels n LEFT JOIN translators t ON n.translator_id = t.user_id"
            params = []
            conditions = []

            if translator_id:
                conditions.append(f"n.translator_id = ${len(params) + 1}")
                params.append(translator_id)

            if ids:
                id_list = [int(id_) for id_ in ids.split(",")]
                conditions.append(f"n.id = ANY(${len(params) + 1})")
                params.append(id_list)

            if conditions:
                query += " WHERE " + " AND ".join(conditions)

            query += f" ORDER BY n.updated_at DESC LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}"
            params.extend([limit, (page - 1) * limit])

            novels = await conn.fetch(query, *params)
            return JSONResponse(content={"status": "success", "data": [dict(n) for n in novels]})
    finally:
        await pool.close()

@app.post("/api/novels")
async def create_novel(data: NovelCreate):
    pool = await get_db()
    try:
        await ensure_tables(pool)
        async with pool.acquire() as conn:
            novel = await conn.fetchrow("""
                INSERT INTO novels (title, description, cover_url, translator_id)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            """, data.title, data.description, data.cover_url, data.translator_id)
            return JSONResponse(content={"status": "success", "data": dict(novel)})
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await pool.close()

@app.get("/api/novels/{novel_id}")
async def get_novel(novel_id: int):
    pool = await get_db()
    try:
        await ensure_tables(pool)
        async with pool.acquire() as conn:
            novel = await conn.fetchrow("""
                SELECT n.*, t.display_name as translator_name 
                FROM novels n 
                LEFT JOIN translators t ON n.translator_id = t.user_id 
                WHERE n.id = $1
            """, novel_id)
            if not novel:
                raise HTTPException(status_code=404, detail="Novel not found")
            
            # Увеличиваем счетчик просмотров
            await conn.execute(
                "UPDATE novels SET views = views + 1 WHERE id = $1",
                novel_id
            )
            return JSONResponse(content={"status": "success", "data": dict(novel)})
    finally:
        await pool.close()

@app.delete("/api/novels/{novel_id}")
async def delete_novel(novel_id: int):
    pool = await get_db()
    try:
        await ensure_tables(pool)
        async with pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM novels WHERE id = $1",
                novel_id
            )
            if result == "DELETE 0":
                raise HTTPException(status_code=404, detail="Novel not found")
            return JSONResponse(content={"status": "success"})
    finally:
        await pool.close()

# Роуты для глав
@app.get("/api/chapters/latest")
async def get_latest_chapters(
    page: int = 1,
    limit: int = 20
):
    pool = await get_db()
    try:
        await ensure_tables(pool)
        async with pool.acquire() as conn:
            chapters = await conn.fetch("""
                SELECT 
                    c.*,
                    n.title as novel_title,
                    t.display_name as translator_name
                FROM chapters c
                JOIN novels n ON c.novel_id = n.id
                LEFT JOIN translators t ON n.translator_id = t.user_id
                ORDER BY c.created_at DESC
                LIMIT $1 OFFSET $2
            """, limit, (page - 1) * limit)
            return JSONResponse(content={"status": "success", "data": [dict(ch) for ch in chapters]})
    finally:
        await pool.close()

@app.post("/api/novels/{novel_id}/chapters")
async def create_chapter(novel_id: int, data: ChapterCreate):
    pool = await get_db()
    try:
        await ensure_tables(pool)
        async with pool.acquire() as conn:
            async with conn.transaction():
                # Создаем главу
                chapter = await conn.fetchrow("""
                    INSERT INTO chapters (novel_id, chapter_number, title, content)
                    VALUES ($1, $2, $3, $4)
                    RETURNING *
                """, novel_id, data.chapter_number, data.title, data.content)

                # Обновляем количество глав и дату обновления новеллы
                await conn.execute("""
                    UPDATE novels 
                    SET chapters_count = chapters_count + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                """, novel_id)

                return JSONResponse(content={"status": "success", "data": dict(chapter)})
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await pool.close()

@app.get("/api/novels/{novel_id}/chapters/{chapter_id}")
async def get_chapter(novel_id: int, chapter_id: int):
    pool = await get_db()
    try:
        await ensure_tables(pool)
        async with pool.acquire() as conn:
            chapter = await conn.fetchrow(
                "SELECT * FROM chapters WHERE novel_id = $1 AND id = $2",
                novel_id, chapter_id
            )
            if not chapter:
                raise HTTPException(status_code=404, detail="Chapter not found")
            
            # Увеличиваем счетчик просмотров
            await conn.execute(
                "UPDATE chapters SET views = views + 1 WHERE id = $1",
                chapter_id
            )
            return JSONResponse(content={"status": "success", "data": dict(chapter)})
    finally:
        await pool.close()

# Дефолтный роут
@app.get("/")
async def root():
    return JSONResponse(content={
        "status": "success",
        "message": "Novels Reader API is running",
        "version": "1.0.0"
    })

# Если API запущено напрямую
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

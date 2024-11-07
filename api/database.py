"""
Database utilities for Novels Reader
"""
import os
from typing import Optional, List, Dict, Any
import asyncpg
from datetime import datetime

class Database:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.url = os.getenv('POSTGRES_URL')
        if not self.url:
            raise ValueError("POSTGRES_URL not found in environment variables")

    async def connect(self):
        """Создает пул соединений с базой данных"""
        if not self.pool:
            self.pool = await asyncpg.create_pool(self.url)

    async def init_tables(self):
        """Инициализирует таблицы в базе данных"""
        async with self.pool.acquire() as conn:
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
                    subscribers INTEGER DEFAULT 0
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

            # Таблица тегов
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS tags (
                    id SERIAL PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL
                )
            ''')

            # Связь новелл и тегов
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS novel_tags (
                    novel_id INTEGER REFERENCES novels(id) ON DELETE CASCADE,
                    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
                    PRIMARY KEY (novel_id, tag_id)
                )
            ''')

    # Методы для работы с переводчиками
    async def create_translator(self, user_id: str, username: str, display_name: str, bio: str = None) -> Dict[str, Any]:
        async with self.pool.acquire() as conn:
            return await conn.fetchrow('''
                INSERT INTO translators (user_id, username, display_name, bio)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            ''', user_id, username, display_name, bio)

    async def get_translator(self, user_id: str) -> Dict[str, Any]:
        async with self.pool.acquire() as conn:
            return await conn.fetchrow('SELECT * FROM translators WHERE user_id = $1', user_id)

    # Методы для работы с новеллами
    async def create_novel(self, data: Dict[str, Any]) -> Dict[str, Any]:
        async with self.pool.acquire() as conn:
            return await conn.fetchrow('''
                INSERT INTO novels (title, description, cover_url, translator_id)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            ''', data['title'], data.get('description'), data.get('cover_url'), data['translator_id'])

    async def get_novels(self, limit: int = 20, offset: int = 0, translator_id: str = None) -> List[Dict[str, Any]]:
        async with self.pool.acquire() as conn:
            query = 'SELECT * FROM novels'
            params = []
            
            if translator_id:
                query += ' WHERE translator_id = $1'
                params.append(translator_id)
            
            query += ' ORDER BY updated_at DESC LIMIT $%d OFFSET $%d' % (len(params) + 1, len(params) + 2)
            params.extend([limit, offset])
            
            return await conn.fetch(query, *params)

    async def get_novel(self, novel_id: int) -> Dict[str, Any]:
        async with self.pool.acquire() as conn:
            return await conn.fetchrow('SELECT * FROM novels WHERE id = $1', novel_id)

    # Методы для работы с главами
    async def create_chapter(self, data: Dict[str, Any]) -> Dict[str, Any]:
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                # Создаем главу
                chapter = await conn.fetchrow('''
                    INSERT INTO chapters (novel_id, chapter_number, title, content)
                    VALUES ($1, $2, $3, $4)
                    RETURNING *
                ''', data['novel_id'], data['chapter_number'], data['title'], data['content'])
                
                # Обновляем время последнего обновления новеллы
                await conn.execute('''
                    UPDATE novels 
                    SET updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                ''', data['novel_id'])
                
                return chapter

    async def get_chapters(self, novel_id: int, limit: int = 20, offset: int = 0) -> List[Dict[str, Any]]:
        async with self.pool.acquire() as conn:
            return await conn.fetch('''
                SELECT * FROM chapters 
                WHERE novel_id = $1 
                ORDER BY chapter_number DESC 
                LIMIT $2 OFFSET $3
            ''', novel_id, limit, offset)

    async def get_chapter(self, chapter_id: int) -> Dict[str, Any]:
        async with self.pool.acquire() as conn:
            return await conn.fetchrow('SELECT * FROM chapters WHERE id = $1', chapter_id)

    # Поиск
    async def search_novels(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        async with self.pool.acquire() as conn:
            return await conn.fetch('''
                SELECT * FROM novels
                WHERE 
                    title ILIKE $1 OR
                    description ILIKE $1
                ORDER BY updated_at DESC
                LIMIT $2
            ''', f'%{query}%', limit)

    # Статистика
    async def increment_novel_views(self, novel_id: int):
        async with self.pool.acquire() as conn:
            await conn.execute('UPDATE novels SET views = views + 1 WHERE id = $1', novel_id)

    async def increment_chapter_views(self, chapter_id: int):
        async with self.pool.acquire() as conn:
            await conn.execute('UPDATE chapters SET views = views + 1 WHERE id = $1', chapter_id)

# Создаем глобальный экземпляр базы данных
db = Database()

import os
import asyncio
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes
import sqlite3
from datetime import datetime, timedelta
import html
import json
import re

class NovelBot:
    def __init__(self):
        # Получаем токен из переменной окружения
        self.token = os.getenv('BOT_TOKEN')
        if not self.token:
            raise ValueError("BOT_TOKEN not found in environment variables")
            
        self.admin_id = 244436877  # Ваш ID
        self.channel_id = -1001464835008  # ID вашего канала
        
        self.application = Application.builder().token(self.token).build()
        self.setup_database()
        self.setup_handlers()
        
    def setup_database(self):
        """Инициализация базы данных"""
        self.conn = sqlite3.connect('novel_bot.db')
        self.cursor = self.conn.cursor()
        
        # Таблица подписчиков
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS subscribers (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                subscription_end DATE,
                hidden_mark TEXT,
                created_at TIMESTAMP
            )
        ''')
        
        # Таблица глав
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS chapters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                content TEXT,
                published_at TIMESTAMP,
                message_id INTEGER
            )
        ''')
        
        self.conn.commit()

    def setup_handlers(self):
        """Настройка обработчиков команд"""
        # Админские команды
        self.application.add_handler(CommandHandler("add_chapter", self.add_chapter_command, filters=filters.User(self.admin_id)))
        self.application.add_handler(CommandHandler("list_subscribers", self.list_subscribers_command, filters=filters.User(self.admin_id)))
        self.application.add_handler(CommandHandler("add_subscriber", self.add_subscriber_command, filters=filters.User(self.admin_id)))
        self.application.add_handler(CommandHandler("remove_subscriber", self.remove_subscriber_command, filters=filters.User(self.admin_id)))
        
        # Пользовательские команды
        self.application.add_handler(CommandHandler("start", self.start_command))
        self.application.add_handler(CommandHandler("subscribe", self.subscribe_command))
        self.application.add_handler(CommandHandler("status", self.status_command))
        
        # Обработчик текстовых сообщений (для получения глав от админа)
        self.application.add_handler(MessageHandler(
            filters.TEXT & filters.User(self.admin_id) & filters.ChatType.PRIVATE,
            self.handle_admin_message
        ))

    def generate_hidden_mark(self, user_id: int) -> str:
        """Генерация скрытой метки для подписчика"""
        # Используем Zero-Width символы для создания скрытой метки
        marks = {
            '0': '​',  # Zero-Width Space
            '1': '‌',  # Zero-Width Non-Joiner
            '2': '‍',  # Zero-Width Joiner
            '3': '﻿',  # Zero-Width No-Break Space
        }
        
        # Конвертируем user_id в строку и кодируем её
        binary = format(user_id, '012b')  # 12 бит для хранения ID
        return ''.join(marks[str(int(b) % 4)] for b in binary)

    def decode_hidden_mark(self, text: str) -> int:
        """Декодирование скрытой метки для определения подписчика"""
        marks = {
            '​': '0',  # Zero-Width Space
            '‌': '1',  # Zero-Width Non-Joiner
            '‍': '2',  # Zero-Width Joiner
            '﻿': '3',  # Zero-Width No-Break Space
        }
        
        # Ищем все скрытые метки в тексте
        binary = ''
        for char in text:
            if char in marks:
                binary += marks[char]
        
        if len(binary) >= 12:
            return int(binary[:12], 2)
        return None

    def protect_text(self, text: str, user_id: int) -> str:
        """Защита текста от копирования"""
        # Добавляем скрытую метку в начало каждого абзаца
        hidden_mark = self.generate_hidden_mark(user_id)
        paragraphs = text.split('\n\n')
        protected_paragraphs = [hidden_mark + p for p in paragraphs]
        
        # Добавляем HTML-обёртку для запрета выделения
        protected_text = """
<div style="user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;">
{}
</div>
""".format('\n\n'.join(protected_paragraphs))
        
        return protected_text

    async def add_chapter_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Команда для добавления новой главы"""
        await update.message.reply_text(
            "Отправьте главу в формате:\n\n"
            "Заголовок\n"
            "---\n"
            "Текст главы"
        )

    async def handle_admin_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка новой главы от админа"""
        try:
            # Разделяем заголовок и содержимое
            parts = update.message.text.split('\n---\n', 1)
            if len(parts) != 2:
                await update.message.reply_text("Неверный формат. Используйте разделитель '---'")
                return
                
            title, content = parts
            title = title.strip()
            content = content.strip()
            
            # Сохраняем главу в базу
            self.cursor.execute("""
                INSERT INTO chapters (title, content, published_at)
                VALUES (?, ?, ?)
            """, (title, content, datetime.now()))
            self.conn.commit()
            chapter_id = self.cursor.lastrowid
            
            # Получаем список активных подписчиков
            self.cursor.execute("""
                SELECT user_id FROM subscribers 
                WHERE subscription_end >= date('now')
            """)
            subscribers = self.cursor.fetchall()
            
            # Публикуем главу в канал для каждого подписчика
            for (user_id,) in subscribers:
                protected_content = self.protect_text(content, user_id)
                message = f"<b>{html.escape(title)}</b>\n\n{protected_content}"
                try:
                    # Отправляем в канал с HTML-форматированием
                    sent_msg = await context.bot.send_message(
                        chat_id=self.channel_id,
                        text=message,
                        parse_mode='HTML'
                    )
                    # Ограничиваем доступ только для конкретного подписчика
                    await context.bot.restrict_chat_member(
                        chat_id=self.channel_id,
                        user_id=user_id,
                        permissions={
                            'can_send_messages': False,
                            'can_send_media_messages': False,
                            'can_send_other_messages': False,
                            'can_add_web_page_previews': False
                        }
                    )
                except Exception as e:
                    await update.message.reply_text(f"Ошибка при отправке главы подписчику {user_id}: {str(e)}")
            
            await update.message.reply_text(f"Глава '{title}' успешно опубликована!")
            
        except Exception as e:
            await update.message.reply_text(f"Ошибка при публикации главы: {str(e)}")

    async def add_subscriber_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Команда для добавления подписчика (только для админа)"""
        args = context.args
        if len(args) < 1:
            await update.message.reply_text(
                "Использование: /add_subscriber <user_id> [дни_подписки]\n"
                "Пример: /add_subscriber 123456789 30"
            )
            return

        try:
            user_id = int(args[0])
            days = int(args[1]) if len(args) > 1 else 30  # По умолчанию 30 дней

            # Добавляем или обновляем подписчика
            subscription_end = (datetime.now() + timedelta(days=days)).date()
            self.cursor.execute("""
                INSERT OR REPLACE INTO subscribers 
                (user_id, subscription_end, created_at) 
                VALUES (?, ?, ?)
            """, (user_id, subscription_end, datetime.now()))
            self.conn.commit()

            # Генерируем ссылку-приглашение
            invite_link = await context.bot.create_chat_invite_link(
                chat_id=self.channel_id,
                member_limit=1,
                expire_date=datetime.now() + timedelta(days=1)
            )

            await update.message.reply_text(
                f"Подписчик {user_id} добавлен до {subscription_end}\n"
                f"Ссылка для входа в канал: {invite_link.invite_link}"
            )

        except Exception as e:
            await update.message.reply_text(f"Ошибка: {str(e)}")

    async def remove_subscriber_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Команда для удаления подписчика (только для админа)"""
        args = context.args
        if len(args) < 1:
            await update.message.reply_text(
                "Использование: /remove_subscriber <user_id>"
            )
            return

        try:
            user_id = int(args[0])
            
            # Удаляем подписчика из базы
            self.cursor.execute("DELETE FROM subscribers WHERE user_id = ?", (user_id,))
            self.conn.commit()
            
            # Удаляем из канала
            try:
                await context.bot.ban_chat_member(
                    chat_id=self.channel_id,
                    user_id=user_id
                )
                await context.bot.unban_chat_member(
                    chat_id=self.channel_id,
                    user_id=user_id
                )
            except Exception as e:
                await update.message.reply_text(f"Ошибка при удалении из канала: {str(e)}")

            await update.message.reply_text(f"Подписчик {user_id} удален")

        except Exception as e:
            await update.message.reply_text(f"Ошибка: {str(e)}")

    async def subscribe_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Команда для оформления подписки"""
        keyboard = [[InlineKeyboardButton("Оплатить подписку", url="https://t.me/your_payment_bot")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            "Стоимость подписки: XXX руб/мес\n"
            "После оплаты отправьте скриншот администратору: @your_username",
            reply_markup=reply_markup
        )

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Команда /start"""
        welcome_text = """
Добро пожаловать! 

Здесь вы можете подписаться на ранний доступ к главам новеллы.

Команды:
/subscribe - Оформить подписку
/status - Проверить статус подписки
"""
        await update.message.reply_text(welcome_text)

    async def status_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Проверка статуса подписки"""
        user_id = update.effective_user.id
        self.cursor.execute(
            "SELECT subscription_end FROM subscribers WHERE user_id = ?",
            (user_id,)
        )
        result = self.cursor.fetchone()
        
        if result:
            end_date = datetime.strptime(result[0], '%Y-%m-%d').date()
            days_left = (end_date - datetime.now().date()).days
            
            if days_left > 0:
                await update.message.reply_text(
                    f"Ваша подписка активна\n"
                    f"Дней до окончания: {days_left}"
                )
            else:
                await update.message.reply_text(
                    "Ваша подписка истекла\n"
                    "Используйте /subscribe для продления"
                )
        else:
            await update.message.reply_text(
                "У вас нет активной подписки\n"
                "Используйте /subscribe для оформления"
            )

    async def list_subscribers_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Список активных подписчиков (только для админа)"""
        self.cursor.execute("""
            SELECT user_id, username, subscription_end 
            FROM subscribers 
            WHERE subscription_end >= date('now')
            ORDER BY subscription_end DESC
        """)
        subscribers = self.cursor.fetchall()
        
        if subscribers:
            message = "Активные подписчики:\n\n"
            for user_id, username, end_date in subscribers:
                message += f"ID: {user_id}\n"
                message += f"Username: @{username}\n"
                message += f"Подписка до: {end_date}\n\n"
        else:
            message = "Активных подписчиков нет"
            
        await update.message.reply_text(message)

    def run(self):
        """Запуск бота"""
        print("Bot starting...")
        self.application.run_polling()

if __name__ == "__main__":
    bot = NovelBot()
    bot.run()

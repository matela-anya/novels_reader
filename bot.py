import os
import asyncio
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes
from telegram.error import Conflict, NetworkError
import sqlite3
from datetime import datetime, timedelta
import html
import logging
import time

# Настраиваем логирование
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

class NovelBot:
    def __init__(self):
        self.token = os.getenv('BOT_TOKEN')
        if not self.token:
            raise ValueError("BOT_TOKEN not found in environment variables")
            
        self.admin_id = 244436877
        self.channel_id = -1001464835008
        
        # Настройки приложения
        self.application = (
            Application.builder()
            .token(self.token)
            .concurrent_updates(True)
            .arbitrary_callback_data(True)
            .build()
        )
        
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
                message_id INTEGER,
                last_edited TIMESTAMP
            )
        ''')
        
        self.conn.commit()

    def setup_handlers(self):
        """Настройка обработчиков команд"""
        # Основной обработчик callback_query
        self.application.add_handler(CallbackQueryHandler(self.button_click))
        
        # Обработчик команды /start
        self.application.add_handler(CommandHandler('start', self.start_command))
        
        # Обработчик для текстовых сообщений
        self.application.add_handler(
            MessageHandler(
                filters.TEXT & ~filters.COMMAND & filters.User(self.admin_id),
                self.handle_admin_message
            )
        )

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Начальное меню с выбором роли"""
        keyboard = [
            [InlineKeyboardButton("🖋 Кабинет переводчика", callback_data='translator')],
            [InlineKeyboardButton("📚 Кабинет читателя", callback_data='reader')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        text = "👋 Добро пожаловать!\n\nВыберите режим работы:"
        
        if update.callback_query:
            await update.callback_query.message.edit_text(text, reply_markup=reply_markup)
        else:
            await update.message.reply_text(text, reply_markup=reply_markup)

    async def button_click(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработчик нажатий на кнопки"""
        query = update.callback_query
        await query.answer()

        data = query.data

        if data == 'add_chapter':
            await query.message.edit_text(
                "📝 Отправьте новую главу в формате:\n\n"
                "Заголовок\n"
                "---\n"
                "Текст главы",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("↩️ Отмена", callback_data='back_to_menu')
                ]])
            )
        elif data == 'back_to_menu':
            keyboard = [
                [InlineKeyboardButton("📝 Добавить главу", callback_data='add_chapter')],
                [InlineKeyboardButton("⚙️ Изменить условия подписки", callback_data='edit_subscription')],
                [InlineKeyboardButton("👥 Список подписчиков", callback_data='list_subscribers')],
                [InlineKeyboardButton("📚 Список глав", callback_data='list_chapters')],
                [InlineKeyboardButton("↩️ Назад", callback_data='back_to_start')]
            ]
            await query.message.edit_text(
                "🖋 Кабинет переводчика",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
        elif data == 'translator':
            if query.from_user.id != self.admin_id:
                await query.message.edit_text("⛔️ У вас нет доступа к кабинету переводчика")
                return
            keyboard = [
                [InlineKeyboardButton("📝 Добавить главу", callback_data='add_chapter')],
                [InlineKeyboardButton("⚙️ Изменить условия подписки", callback_data='edit_subscription')],
                [InlineKeyboardButton("👥 Список подписчиков", callback_data='list_subscribers')],
                [InlineKeyboardButton("📚 Список глав", callback_data='list_chapters')],
                [InlineKeyboardButton("↩️ Назад", callback_data='back_to_start')]
            ]
            await query.message.edit_text(
                "🖋 Кабинет переводчика",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
        elif data == 'reader':
            keyboard = [
                [InlineKeyboardButton("📚 Мои подписки", callback_data='show_subscriptions')],
                [InlineKeyboardButton("🆕 Новые главы", callback_data='show_new_chapters')],
                [InlineKeyboardButton("↩️ Назад", callback_data='back_to_start')]
            ]
            await query.message.edit_text(
                "📚 Кабинет читателя",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
        elif data == 'back_to_start':
            await self.start_command(update, context)
        elif data in ['show_subscriptions', 'show_new_chapters', 'list_subscribers', 
                     'list_chapters', 'edit_subscription']:
            # Заглушка для функций, которые будут реализованы позже
            await query.message.edit_text(
                "🚧 Эта функция в разработке",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("↩️ Назад", callback_data='back_to_menu')
                ]])
            )

    async def handle_admin_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка сообщений от админа"""
        if update.message.text.lower() == 'отмена':
            keyboard = [
                [InlineKeyboardButton("📝 Добавить главу", callback_data='add_chapter')],
                [InlineKeyboardButton("⚙️ Изменить условия подписки", callback_data='edit_subscription')],
                [InlineKeyboardButton("👥 Список подписчиков", callback_data='list_subscribers')],
                [InlineKeyboardButton("📚 Список глав", callback_data='list_chapters')],
                [InlineKeyboardButton("↩️ Назад", callback_data='back_to_start')]
            ]
            await update.message.reply_text(
                "🖋 Кабинет переводчика",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            return

        try:
            # Разделяем заголовок и содержимое
            parts = update.message.text.split('\n---\n', 1)
            if len(parts) != 2:
                await update.message.reply_text(
                    "❌ Неверный формат. Используйте разделитель '---'\n"
                    "Пример:\n\n"
                    "Заголовок главы\n"
                    "---\n"
                    "Текст главы"
                )
                return

            title, content = parts
            title = title.strip()
            content = content.strip()

            # Сохраняем главу
            self.cursor.execute("""
                INSERT INTO chapters (title, content, published_at, last_edited)
                VALUES (?, ?, ?, ?)
            """, (title, content, datetime.now(), datetime.now()))
            self.conn.commit()

            # Отправляем сообщение об успехе
            keyboard = [
                [InlineKeyboardButton("📚 К списку глав", callback_data='list_chapters')],
                [InlineKeyboardButton("📝 Добавить ещё", callback_data='add_chapter')],
                [InlineKeyboardButton("🏠 В главное меню", callback_data='back_to_menu')]
            ]
            await update.message.reply_text(
                "✅ Глава успешно добавлена!",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )

        except Exception as e:
            logger.error(f"Error in handle_admin_message: {e}")
            await update.message.reply_text(f"❌ Ошибка при публикации главы: {str(e)}")

    async def run_with_retry(self):
        """Запуск бота с автоматическим перезапуском при ошибках"""
        while True:
            try:
                logger.info("Starting bot...")
                await self.application.initialize()
                await self.application.start()
                await self.application.run_polling(allowed_updates=Update.ALL_TYPES)
            except Conflict as e:
                logger.error(f"Conflict error: {e}")
                logger.info("Waiting for other instance to stop...")
                await asyncio.sleep(10)
            except NetworkError as e:
                logger.error(f"Network error: {e}")
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                await asyncio.sleep(5)
            finally:
                await self.application.stop()
                await self.application.shutdown()

    def run(self):
        """Запуск бота с обработкой ошибок"""
        logger.info("Starting bot with error handling...")
        asyncio.run(self.run_with_retry())

if __name__ == "__main__":
    while True:
        try:
            bot = NovelBot()
            bot.run()
        except Exception as e:
            logger.error(f"Bot crashed: {e}")
            logger.info("Restarting bot in 5 seconds...")
            time.sleep(5)

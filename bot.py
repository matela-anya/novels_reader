import os
import asyncio
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes, ConversationHandler
import sqlite3
from datetime import datetime, timedelta
import html
import json
import re

# Состояния для ConversationHandler
(
    CHOOSING_ROLE,
    READER_MENU,
    TRANSLATOR_MENU,
    ADDING_CHAPTER,
    EDITING_CHAPTER,
    EDITING_SUBSCRIPTION,
    CHAPTER_TITLE,
    CHAPTER_CONTENT,
    CONFIRMING_DELETE
) = range(9)

class NovelBot:
    def __init__(self):
        self.token = os.getenv('BOT_TOKEN')
        if not self.token:
            raise ValueError("BOT_TOKEN not found in environment variables")
            
        self.admin_id = 244436877
        self.channel_id = -1001464835008
        
        self.application = Application.builder().token(self.token).build()
        self.setup_database()
        self.setup_handlers()

    def setup_database(self):
        """Расширенная инициализация базы данных"""
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
        
        # Таблица каналов переводчиков
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS translator_channels (
                channel_id INTEGER PRIMARY KEY,
                translator_id INTEGER,
                channel_name TEXT,
                subscription_price REAL,
                subscription_duration INTEGER
            )
        ''')
        
        self.conn.commit()

    def setup_handlers(self):
        """Настройка обработчиков команд с новым интерфейсом"""
        conv_handler = ConversationHandler(
            entry_points=[CommandHandler('start', self.start_command)],
            states={
                CHOOSING_ROLE: [
                    CallbackQueryHandler(self.translator_menu, pattern='^translator$'),
                    CallbackQueryHandler(self.reader_menu, pattern='^reader$')
                ],
                TRANSLATOR_MENU: [
                    CallbackQueryHandler(self.add_chapter_start, pattern='^add_chapter$'),
                    CallbackQueryHandler(self.edit_subscription, pattern='^edit_subscription$'),
                    CallbackQueryHandler(self.list_subscribers_menu, pattern='^list_subscribers$'),
                    CallbackQueryHandler(self.list_chapters, pattern='^list_chapters$'),
                    CallbackQueryHandler(self.start_command, pattern='^back_to_start$')
                ],
                READER_MENU: [
                    CallbackQueryHandler(self.show_subscriptions, pattern='^show_subscriptions$'),
                    CallbackQueryHandler(self.show_new_chapters, pattern='^show_new_chapters$'),
                    CallbackQueryHandler(self.start_command, pattern='^back_to_start$')
                ],
                ADDING_CHAPTER: [
                    MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_chapter_title),
                    CallbackQueryHandler(self.translator_menu, pattern='^cancel$')
                ],
                CHAPTER_CONTENT: [
                    MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_chapter_content),
                    CallbackQueryHandler(self.translator_menu, pattern='^cancel$')
                ],
                EDITING_CHAPTER: [
                    CallbackQueryHandler(self.edit_chapter_content, pattern='^edit_chapter_\d+$'),
                    CallbackQueryHandler(self.confirm_delete_chapter, pattern='^delete_chapter_\d+$'),
                    CallbackQueryHandler(self.translator_menu, pattern='^back_to_menu$')
                ],
                CONFIRMING_DELETE: [
                    CallbackQueryHandler(self.delete_chapter, pattern='^confirm_delete_\d+$'),
                    CallbackQueryHandler(self.list_chapters, pattern='^cancel_delete$')
                ]
            },
            fallbacks=[CommandHandler('cancel', self.cancel)]
        )

        self.application.add_handler(conv_handler)

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
        
        return CHOOSING_ROLE

    async def translator_menu(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Меню переводчика"""
        query = update.callback_query
        await query.answer()
        
        # Проверяем, является ли пользователь админом
        if query.from_user.id != self.admin_id:
            await query.message.edit_text("⛔️ У вас нет доступа к кабинету переводчика")
            return ConversationHandler.END
        
        keyboard = [
            [InlineKeyboardButton("📝 Добавить главу", callback_data='add_chapter')],
            [InlineKeyboardButton("⚙️ Изменить условия подписки", callback_data='edit_subscription')],
            [InlineKeyboardButton("👥 Список подписчиков", callback_data='list_subscribers')],
            [InlineKeyboardButton("📚 Список глав", callback_data='list_chapters')],
            [InlineKeyboardButton("↩️ Назад", callback_data='back_to_start')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.message.edit_text("🖋 Кабинет переводчика", reply_markup=reply_markup)
        return TRANSLATOR_MENU

    async def reader_menu(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Меню читателя"""
        query = update.callback_query
        await query.answer()
        
        keyboard = [
            [InlineKeyboardButton("📚 Мои подписки", callback_data='show_subscriptions')],
            [InlineKeyboardButton("🆕 Новые главы", callback_data='show_new_chapters')],
            [InlineKeyboardButton("↩️ Назад", callback_data='back_to_start')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.message.edit_text("📚 Кабинет читателя", reply_markup=reply_markup)
        return READER_MENU

    async def add_chapter_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Начало процесса добавления главы"""
        query = update.callback_query
        await query.answer()
        
        keyboard = [[InlineKeyboardButton("❌ Отмена", callback_data='cancel')]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.message.edit_text(
            "📝 Добавление новой главы\n\n"
            "Отправьте заголовок главы:",
            reply_markup=reply_markup
        )
        return ADDING_CHAPTER

    async def handle_chapter_title(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка заголовка главы"""
        context.user_data['chapter_title'] = update.message.text
        
        keyboard = [[InlineKeyboardButton("❌ Отмена", callback_data='cancel')]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            "📄 Теперь отправьте текст главы:",
            reply_markup=reply_markup
        )
        return CHAPTER_CONTENT

    async def handle_chapter_content(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка содержимого главы"""
        title = context.user_data['chapter_title']
        content = update.message.text
        
        try:
            # Сохраняем главу в базу
            self.cursor.execute("""
                INSERT INTO chapters (title, content, published_at, last_edited)
                VALUES (?, ?, ?, ?)
            """, (title, content, datetime.now(), datetime.now()))
            self.conn.commit()
            
            await self.publish_chapter_to_channel(update, context, title, content)
            
            keyboard = [
                [InlineKeyboardButton("📚 К списку глав", callback_data='list_chapters')],
                [InlineKeyboardButton("🏠 В главное меню", callback_data='back_to_menu')]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await update.message.reply_text(
                "✅ Глава успешно добавлена и опубликована!",
                reply_markup=reply_markup
            )
        except Exception as e:
            await update.message.reply_text(f"❌ Ошибка при сохранении главы: {str(e)}")
        
        return TRANSLATOR_MENU

    async def list_chapters(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Список всех глав с возможностью редактирования"""
        query = update.callback_query
        if query:
            await query.answer()
        
        self.cursor.execute("""
            SELECT id, title, published_at, last_edited 
            FROM chapters 
            ORDER BY published_at DESC
        """)
        chapters = self.cursor.fetchall()
        
        if not chapters:
            keyboard = [[InlineKeyboardButton("↩️ Назад", callback_data='back_to_menu')]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            text = "📚 Список глав пуст"
            
            if query:
                await query.message.edit_text(text, reply_markup=reply_markup)
            else:
                await update.message.reply_text(text, reply_markup=reply_markup)
            return TRANSLATOR_MENU
        
        keyboard = []
        for chapter_id, title, published_at, last_edited in chapters:
            pub_date = datetime.strptime(published_at, '%Y-%m-%d %H:%M:%S').strftime('%d.%m.%Y')
            keyboard.extend([
                [InlineKeyboardButton(f"📖 {title}", callback_data=f'view_chapter_{chapter_id}')],
                [
                    InlineKeyboardButton("✏️ Редактировать", callback_data=f'edit_chapter_{chapter_id}'),
                    InlineKeyboardButton("🗑 Удалить", callback_data=f'delete_chapter_{chapter_id}')
                ]
            ])
        
        keyboard.append([InlineKeyboardButton("↩️ Назад", callback_data='back_to_menu')])
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        text = "📚 Список опубликованных глав:"
        
        if query:
            await query.message.edit_text(text, reply_markup=reply_markup)
        else:
            await update.message.reply_text(text, reply_markup=reply_markup)
        
        return EDITING_CHAPTER

    async def edit_chapter_content(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Редактирование содержимого главы"""
        query = update.callback_query
        await query.answer()
        
        chapter_id = int(query.data.split('_')[2])
        context.user_data['editing_chapter_id'] = chapter_id
        
        self.cursor.execute("SELECT title, content FROM chapters WHERE id = ?", (chapter_id,))
        title, content = self.cursor.fetchone()
        
        keyboard = [[InlineKeyboardButton("❌ Отмена", callback_data='cancel')]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.message.edit_text(
            f"✏️ Редактирование главы: {title}\n\n"
            "Отправьте новый текст главы:",
            reply_markup=reply_markup
        )
        return CHAPTER_CONTENT

    async def confirm_delete_chapter(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Подтверждение удаления главы"""
        query = update.callback_query
        await query.answer()
        
        chapter_id = int(query.data.split('_')[2])
        context.user_data['deleting_chapter_id'] = chapter_id
        
        self.cursor.execute("SELECT title FROM chapters WHERE id = ?", (chapter_id,))
        title = self.cursor.fetchone()[0]
        
        keyboard = [
            [
                InlineKeyboardButton("✅ Да, удалить", callback_data=f'confirm_delete_{chapter_id}'),
                InlineKeyboardButton("❌ Нет, отмена", callback_data='cancel_delete')
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.message.edit_text(
            f"🗑 Удалить главу '{title}'?\n\n"
            "⚠️ Это действие нельзя отменить!",
            reply_markup=reply_markup
        )
        return CONFIRMING_DELETE

    async def delete_chapter(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Удаление главы"""
        query = update.callback_query
        await query.answer()
        
        chapter_id = int(query.data.split('_')[2])
        
        try:
            self.cursor.execute("DELETE FROM chapters WHERE id = ?", (chapter_id,))
            self.conn.commit()
            
            await query.message.edit_text("✅ Глава успешно удалена!")
            await asyncio.sleep(2)
            return await self.list_chapters(update, context)
            
        except Exception as e:
            await query.message.edit_text(f"❌ Ошибка при удалении главы: {str(e)}")
            return TRANSLATOR_MENU

    async def show_subscriptions(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Показ активных подписок пользователя"""
        query = update.callback_query
        await query.answer()
        
        user_id = query.from_user.id
        
        # Получаем активные подписки пользователя
        self.cursor.execute("""
            SELECT subscription_end 
            FROM subscribers 
            WHERE user_id = ? AND subscription_end >= date('now')
        """, (user_id,))
        subscription = self.cursor.fetchone()
        
        keyboard = [[InlineKeyboardButton("↩️ Назад", callback_data='back_to_start')]]
        if subscription:
            end_date = datetime.strptime(subscription[0], '%Y-%m-%d').date()
            days_left = (end_date - datetime.now().date()).days
            text = (
                "📚 Ваша подписка:\n\n"
                f"Статус: ✅ Активна\n"
                f"Дней до окончания: {days_left}\n"
                f"Дата окончания: {end_date.strftime('%d.%m.%Y')}"
            )
        else:
            keyboard.insert(0, [InlineKeyboardButton("💫 Оформить подписку", callback_data='subscribe')])
            text = "📚 У вас нет активных подписок"

        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.message.edit_text(text, reply_markup=reply_markup)
        return READER_MENU

    async def show_new_chapters(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Показ новых глав"""
        query = update.callback_query
        await query.answer()
        
        user_id = query.from_user.id
        
        # Проверяем, есть ли активная подписка
        self.cursor.execute("""
            SELECT subscription_end 
            FROM subscribers 
            WHERE user_id = ? AND subscription_end >= date('now')
        """, (user_id,))
        subscription = self.cursor.fetchone()
        
        if not subscription:
            keyboard = [
                [InlineKeyboardButton("💫 Оформить подписку", callback_data='subscribe')],
                [InlineKeyboardButton("↩️ Назад", callback_data='back_to_start')]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await query.message.edit_text(
                "⚠️ У вас нет активной подписки для просмотра новых глав",
                reply_markup=reply_markup
            )
            return READER_MENU
        
        # Получаем последние главы
        self.cursor.execute("""
            SELECT id, title, published_at 
            FROM chapters 
            ORDER BY published_at DESC 
            LIMIT 10
        """)
        chapters = self.cursor.fetchall()
        
        if not chapters:
            keyboard = [[InlineKeyboardButton("↩️ Назад", callback_data='back_to_start')]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await query.message.edit_text(
                "📚 Новых глав пока нет",
                reply_markup=reply_markup
            )
            return READER_MENU
        
        text = "📚 Последние главы:\n\n"
        keyboard = []
        
        for chapter_id, title, published_at in chapters:
            pub_date = datetime.strptime(published_at, '%Y-%m-%d %H:%M:%S').strftime('%d.%m.%Y')
            text += f"📖 {title}\n📅 {pub_date}\n\n"
            keyboard.append([InlineKeyboardButton(f"Читать: {title}", callback_data=f'read_chapter_{chapter_id}')])
        
        keyboard.append([InlineKeyboardButton("↩️ Назад", callback_data='back_to_start')])
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.message.edit_text(text, reply_markup=reply_markup)
        return READER_MENU

    async def edit_subscription(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Изменение условий подписки"""
        query = update.callback_query
        await query.answer()
        
        if query.from_user.id != self.admin_id:
            await query.message.edit_text("⛔️ У вас нет доступа к этой функции")
            return TRANSLATOR_MENU
        
        keyboard = [
            [InlineKeyboardButton("💰 Изменить стоимость", callback_data='change_price')],
            [InlineKeyboardButton("⏱ Изменить длительность", callback_data='change_duration')],
            [InlineKeyboardButton("↩️ Назад", callback_data='back_to_menu')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.message.edit_text(
            "⚙️ Настройки подписки\n\n"
            "Выберите параметр для изменения:",
            reply_markup=reply_markup
        )
        return TRANSLATOR_MENU

    async def list_subscribers_menu(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Показ списка подписчиков"""
        query = update.callback_query
        await query.answer()
        
        if query.from_user.id != self.admin_id:
            await query.message.edit_text("⛔️ У вас нет доступа к этой функции")
            return TRANSLATOR_MENU
        
        self.cursor.execute("""
            SELECT user_id, username, subscription_end 
            FROM subscribers 
            WHERE subscription_end >= date('now')
            ORDER BY subscription_end DESC
        """)
        subscribers = self.cursor.fetchall()
        
        if not subscribers:
            keyboard = [[InlineKeyboardButton("↩️ Назад", callback_data='back_to_menu')]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await query.message.edit_text(
                "👥 Активных подписчиков нет",
                reply_markup=reply_markup
            )
            return TRANSLATOR_MENU
        
        text = "👥 Список активных подписчиков:\n\n"
        for user_id, username, end_date in subscribers:
            end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
            days_left = (end_date_obj - datetime.now().date()).days
            text += (
                f"ID: {user_id}\n"
                f"Username: {('@' + username) if username else 'не указан'}\n"
                f"Подписка до: {end_date_obj.strftime('%d.%m.%Y')}\n"
                f"Осталось дней: {days_left}\n\n"
            )
        
        keyboard = [[InlineKeyboardButton("↩️ Назад", callback_data='back_to_menu')]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        # Разбиваем длинное сообщение, если нужно
        if len(text) > 4096:
            parts = [text[i:i+4096] for i in range(0, len(text), 4096)]
            for part in parts[:-1]:
                await query.message.reply_text(part)
            await query.message.reply_text(parts[-1], reply_markup=reply_markup)
        else:
            await query.message.edit_text(text, reply_markup=reply_markup)
        
        return TRANSLATOR_MENU

    async def cancel(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Отмена текущего действия"""
        if update.callback_query:
            await update.callback_query.message.edit_text("❌ Действие отменено")
        else:
            await update.message.reply_text("❌ Действие отменено")
        return ConversationHandler.END

    def run(self):
        """Запуск бота"""
        print("🚀 Бот запущен...")
        self.application.run_polling()

if __name__ == "__main__":
    bot = NovelBot()
    bot.run()

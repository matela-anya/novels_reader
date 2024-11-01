from telegram.ext import Application, CommandHandler
from telegram import WebAppInfo, KeyboardButton, ReplyKeyboardMarkup
import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv('BOT_TOKEN')

async def start(update, context):
    keyboard = ReplyKeyboardMarkup([
        [KeyboardButton('Открыть читалку', web_app=WebAppInfo(url='https://novels-reader-beta.vercel.app'))]
    ], resize_keyboard=True)
    
    await update.message.reply_text(
        'Добро пожаловать в Novels Reader! Нажмите кнопку ниже, чтобы открыть приложение:',
        reply_markup=keyboard
    )

def main():
    application = Application.builder().token(BOT_TOKEN).build()
    application.add_handler(CommandHandler("start", start))
    application.run_polling()

if __name__ == '__main__':
    main()

/**
 * Класс для работы с Telegram CloudStorage
 */
class TelegramStorage {
    constructor() {
        this.telegram = window.Telegram?.WebApp;
        if (!this.telegram?.CloudStorage) {
            throw new Error('Telegram CloudStorage is not available');
        }

        // Ключи для хранения
        this.keys = {
            USER_ROLE: 'user_role',
            READING_SETTINGS: 'reading_settings',
            SUBSCRIPTIONS: 'subscriptions',
            BOOKMARKS: 'bookmarks',
            READING_PROGRESS: 'reading_progress',
            LAST_READ: 'last_read'
        };

        // Кеш для оптимизации
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 минут
    }

    // Базовые методы для работы с CloudStorage
    async getItem(key) {
        // Проверяем кеш
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.value;
        }

        return new Promise((resolve, reject) => {
            this.telegram.CloudStorage.getItem(key, (error, value) => {
                if (error) {
                    reject(error);
                } else {
                    try {
                        const parsed = value ? JSON.parse(value) : null;
                        // Сохраняем в кеш
                        this.cache.set(key, {
                            value: parsed,
                            timestamp: Date.now()
                        });
                        resolve(parsed);
                    } catch (e) {
                        reject(e);
                    }
                }
            });
        });
    }

    async setItem(key, value) {
        // Обновляем кеш
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });

        return new Promise((resolve, reject) => {
            this.telegram.CloudStorage.setItem(
                key,
                JSON.stringify(value),
                (error) => {
                    if (error) reject(error);
                    else resolve(true);
                }
            );
        });
    }

    async removeItem(key) {
        // Удаляем из кеша
        this.cache.delete(key);

        return new Promise((resolve, reject) => {
            this.telegram.CloudStorage.removeItem(key, (error) => {
                if (error) reject(error);
                else resolve(true);
            });
        });
    }

    // Методы для работы с ролью пользователя
    async getUserRole() {
        const role = await this.getItem(this.keys.USER_ROLE);
        return role || 'reader';
    }

    async setUserRole(role) {
        if (!['reader', 'translator'].includes(role)) {
            throw new Error('Invalid role');
        }
        return this.setItem(this.keys.USER_ROLE, role);
    }

    // Методы для работы с настройками чтения
    async getReadingSettings() {
        const settings = await this.getItem(this.keys.READING_SETTINGS);
        return {
            fontSize: 18,
            theme: 'light',
            ...settings
        };
    }

    async saveReadingSettings(settings) {
        return this.setItem(this.keys.READING_SETTINGS, settings);
    }

    // Методы для работы с подписками
    async getSubscriptions() {
        const subs = await this.getItem(this.keys.SUBSCRIPTIONS);
        return subs || [];
    }

    async addSubscription(novelId) {
        const subs = await this.getSubscriptions();
        if (!subs.includes(novelId)) {
            subs.push(novelId);
            await this.setItem(this.keys.SUBSCRIPTIONS, subs);
        }
        return true;
    }

    async removeSubscription(novelId) {
        const subs = await this.getSubscriptions();
        const newSubs = subs.filter(id => id !== novelId);
        return this.setItem(this.keys.SUBSCRIPTIONS, newSubs);
    }

    // Методы для работы с закладками
    async getBookmarks() {
        const bookmarks = await this.getItem(this.keys.BOOKMARKS);
        return bookmarks || [];
    }

    async addBookmark(novelId) {
        const bookmarks = await this.getBookmarks();
        if (!bookmarks.includes(novelId)) {
            bookmarks.push(novelId);
            await this.setItem(this.keys.BOOKMARKS, bookmarks);
        }
        return true;
    }

    async removeBookmark(novelId) {
        const bookmarks = await this.getBookmarks();
        const newBookmarks = bookmarks.filter(id => id !== novelId);
        return this.setItem(this.keys.BOOKMARKS, newBookmarks);
    }

    // Методы для работы с прогрессом чтения
    async getReadingProgress(novelId) {
        const progress = await this.getItem(this.keys.READING_PROGRESS);
        return progress?.[novelId] || null;
    }

    async saveReadingProgress(novelId, chapterId, position) {
        const progress = await this.getItem(this.keys.READING_PROGRESS) || {};
        progress[novelId] = {
            lastChapter: chapterId,
            position: position,
            updatedAt: new Date().toISOString()
        };
        return this.setItem(this.keys.READING_PROGRESS, progress);
    }

    // Методы для работы с историей чтения
    async getLastRead() {
        const lastRead = await this.getItem(this.keys.LAST_READ);
        return lastRead || [];
    }

    async addLastRead(novelId, chapterId) {
        const lastRead = await this.getLastRead();
        const newLastRead = [
            {
                novelId,
                chapterId,
                timestamp: new Date().toISOString()
            },
            ...lastRead.filter(item => item.novelId !== novelId)
        ].slice(0, 20); // Храним только последние 20

        return this.setItem(this.keys.LAST_READ, newLastRead);
    }

    // Очистка данных
    async clearAll() {
        for (const key of Object.values(this.keys)) {
            await this.removeItem(key);
        }
        this.cache.clear();
        return true;
    }
}

// Создаем глобальный экземпляр
const storage = new TelegramStorage();

export default storage;

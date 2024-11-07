/**
 * API клиент для работы с бэкендом
 */
class NovelsAPI {
    constructor() {
        this.baseUrl = '/api';
    }

    async fetch(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'API Error');
            }

            const data = await response.json();
            return data.data; // Возвращаем только данные, без status
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Методы для работы с переводчиками
    async getTranslator(userId) {
        return this.fetch(`/translators/${userId}`);
    }

    async createTranslator(data) {
        return this.fetch('/translators', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // Методы для работы с новеллами
    async getNovels({ limit = 20, offset = 0, translatorId = null } = {}) {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString()
        });
        
        if (translatorId) {
            params.append('translator_id', translatorId);
        }

        return this.fetch(`/novels?${params}`);
    }

    async getNovel(novelId) {
        return this.fetch(`/novels/${novelId}`);
    }

    async createNovel(data) {
        return this.fetch('/novels', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // Методы для работы с главами
    async getChapters(novelId, { limit = 20, offset = 0 } = {}) {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString()
        });

        return this.fetch(`/novels/${novelId}/chapters?${params}`);
    }

    async getChapter(chapterId) {
        return this.fetch(`/chapters/${chapterId}`);
    }

    async createChapter(data) {
        return this.fetch('/chapters', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // Поиск
    async searchNovels(query, limit = 20) {
        const params = new URLSearchParams({
            query,
            limit: limit.toString()
        });

        return this.fetch(`/search?${params}`);
    }
}

// Создаем глобальный экземпляр API клиента
const api = new NovelsAPI();

export default api;

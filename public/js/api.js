/**
 * API клиент для работы с бэкендом
 */
class NovelsAPI {
    constructor() {
        this.baseUrl = '/api';
        this.defaultPageSize = 20;
    }

    /**
     * Базовый метод для отправки запросов к API
     */
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
            return data.data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    /**
     * Методы для работы с переводчиками
     */
    async getTranslator(userId) {
        return this.fetch(`/translators/${userId}`);
    }

    async createTranslator(data) {
        return this.fetch('/translators', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateTranslator(userId, data) {
        return this.fetch(`/translators/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async getTranslatorStats(userId) {
        return this.fetch(`/translators/${userId}/stats`);
    }

    /**
     * Методы для работы с новеллами
     */
    async getNovels({
        page = 1,
        limit = this.defaultPageSize,
        sort = 'updated_at',
        order = 'desc',
        translatorId = null,
        ids = null
    } = {}) {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            sort,
            order
        });

        if (translatorId) {
            params.append('translator_id', translatorId);
        }

        if (ids && ids.length) {
            params.append('ids', ids.join(','));
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

    async updateNovel(novelId, data) {
        return this.fetch(`/novels/${novelId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteNovel(novelId) {
        return this.fetch(`/novels/${novelId}`, {
            method: 'DELETE'
        });
    }

    /**
     * Методы для работы с главами
     */
    async getChapters(novelId, { 
        page = 1, 
        limit = this.defaultPageSize 
    } = {}) {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString()
        });

        return this.fetch(`/novels/${novelId}/chapters?${params}`);
    }

    async getChapter(novelId, chapterId) {
        return this.fetch(`/novels/${novelId}/chapters/${chapterId}`);
    }

    async createChapter(novelId, data) {
        return this.fetch(`/novels/${novelId}/chapters`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateChapter(novelId, chapterId, data) {
        return this.fetch(`/novels/${novelId}/chapters/${chapterId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteChapter(novelId, chapterId) {
        return this.fetch(`/novels/${novelId}/chapters/${chapterId}`, {
            method: 'DELETE'
        });
    }

    /**
     * Методы для работы с последними обновлениями
     */
    async getLatestChapters({
        page = 1,
        limit = this.defaultPageSize,
        subscribedOnly = false
    } = {}) {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            subscribed_only: subscribedOnly.toString()
        });

        return this.fetch(`/chapters/latest?${params}`);
    }

    /**
     * Поиск
     */
    async searchNovels(query, {
        page = 1,
        limit = this.defaultPageSize
    } = {}) {
        const params = new URLSearchParams({
            query,
            page: page.toString(),
            limit: limit.toString()
        });

        return this.fetch(`/novels/search?${params}`);
    }

    /**
     * Статистика
     */
    async incrementNovelViews(novelId) {
        return this.fetch(`/novels/${novelId}/views`, {
            method: 'POST'
        });
    }

    async incrementChapterViews(novelId, chapterId) {
        return this.fetch(`/novels/${novelId}/chapters/${chapterId}/views`, {
            method: 'POST'
        });
    }

    /**
     * Теги
     */
    async getTags() {
        return this.fetch('/tags');
    }

    async getNovelTags(novelId) {
        return this.fetch(`/novels/${novelId}/tags`);
    }

    async updateNovelTags(novelId, tags) {
        return this.fetch(`/novels/${novelId}/tags`, {
            method: 'PUT',
            body: JSON.stringify({ tags })
        });
    }
}

// Создаем глобальный экземпляр API клиента
const api = new NovelsAPI();

export default api;

import api from './api.js';
import storage from './storage.js';

/**
 * Главный класс приложения
 */
class NovelReader {
    constructor() {
        // Инициализация Telegram WebApp
        this.telegram = window.Telegram?.WebApp;
        if (!this.telegram) {
            throw new Error('Telegram WebApp is not available');
        }

        // Состояние приложения
        this.state = {
            activeTab: 'subscriptions',
            isTranslator: false,
            isLoading: false,
            subscriptions: [],
            bookmarks: [],
            latestChapters: [],
            searchQuery: '',
            currentPage: 1,
            hasMoreContent: true
        };

        // Привязка методов к контексту
        this.handleScroll = this.handleScroll.bind(this);
        this.handleTabClick = this.handleTabClick.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.handleBecomeTranslator = this.handleBecomeTranslator.bind(this);
    }

    async init() {
        try {
            // Инициализируем WebApp
            this.telegram.ready();
            this.telegram.expand();

            // Применяем тему
            this.initTheme();
            
            // Загружаем данные пользователя
            await this.loadUserData();
            
            // Инициализируем UI
            this.initUI();
            
            // Загружаем начальный контент
            await this.loadContent();

            // Инициализируем бесконечную прокрутку
            this.initInfiniteScroll();

            console.log('App initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Не удалось загрузить приложение');
        }
    }

    initTheme() {
        // Устанавливаем тему
        document.documentElement.className = this.telegram.colorScheme;
        
        // Слушаем изменения темы
        this.telegram.onEvent('themeChanged', () => {
            document.documentElement.className = this.telegram.colorScheme;
        });
    }

    async loadUserData() {
        try {
            // Загружаем роль пользователя
            const role = await storage.getUserRole();
            this.state.isTranslator = role === 'translator';

            // Загружаем данные пользователя
            const [subscriptions, bookmarks] = await Promise.all([
                storage.getSubscriptions(),
                storage.getBookmarks()
            ]);

            this.state.subscriptions = subscriptions;
            this.state.bookmarks = bookmarks;
        } catch (error) {
            console.error('Error loading user data:', error);
            throw error;
        }
    }

    initUI() {
        // Кнопка "Стать переводчиком"
        const translatorBtn = document.querySelector('[data-role="become-translator"]');
        if (translatorBtn && !this.state.isTranslator) {
            translatorBtn.style.display = 'block';
            translatorBtn.addEventListener('click', this.handleBecomeTranslator);
        }

        // Табы
        document.querySelectorAll('.tab-button').forEach(tab => {
            tab.addEventListener('click', this.handleTabClick);
        });

        // Поиск
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.handleSearch(e.target.value.trim());
                }, 300);
            });
        }

        // Кнопки фильтров и сортировки
        const filterBtn = document.querySelector('.filter-button');
        const sortBtn = document.querySelector('.sort-button');

        if (filterBtn) {
            filterBtn.addEventListener('click', () => this.showFilters());
        }

        if (sortBtn) {
            sortBtn.addEventListener('click', () => this.showSorting());
        }
    }

    initInfiniteScroll() {
        // Используем IntersectionObserver для бесконечной прокрутки
        const observer = new IntersectionObserver(
            (entries) => {
                const lastEntry = entries[0];
                if (lastEntry.isIntersecting && !this.state.isLoading && this.state.hasMoreContent) {
                    this.loadMoreContent();
                }
            },
            { threshold: 0.5 }
        );

        // Добавляем элемент-триггер
        const trigger = document.createElement('div');
        trigger.className = 'scroll-trigger';
        document.querySelector('.main-content').appendChild(trigger);
        observer.observe(trigger);
    }

    async loadContent(reset = false) {
        if (reset) {
            this.state.currentPage = 1;
            this.state.hasMoreContent = true;
        }

        const container = document.querySelector(`[data-section="${this.state.activeTab}"] .novels-list, [data-section="${this.state.activeTab}"] .chapters-list`);
        const emptyState = document.querySelector(`[data-section="${this.state.activeTab}"] .empty-state`);
        
        if (!container) return;

        try {
            this.state.isLoading = true;
            this.toggleLoading(true);

            let content = [];
            switch (this.state.activeTab) {
                case 'subscriptions':
                    content = await this.loadSubscriptions();
                    break;
                case 'bookmarks':
                    content = await this.loadBookmarks();
                    break;
                case 'latest':
                    content = await this.loadLatestChapters();
                    break;
            }

            // Проверяем, есть ли еще контент
            this.state.hasMoreContent = content.length === 20; // Предполагаем, что 20 - размер страницы

            if (content.length || !reset) {
                this.renderContent(container, content, reset);
                emptyState?.classList.remove('visible');
            } else {
                container.innerHTML = '';
                emptyState?.classList.add('visible');
            }
        } catch (error) {
            console.error('Error loading content:', error);
            this.showError('Не удалось загрузить контент');
        } finally {
            this.state.isLoading = false;
            this.toggleLoading(false);
        }
    }

    async loadMoreContent() {
        this.state.currentPage++;
        await this.loadContent(false);
    }

    async loadSubscriptions() {
        if (!this.state.subscriptions.length) return [];
        return api.getNovels({
            ids: this.state.subscriptions,
            page: this.state.currentPage
        });
    }

    async loadBookmarks() {
        if (!this.state.bookmarks.length) return [];
        return api.getNovels({
            ids: this.state.bookmarks,
            page: this.state.currentPage
        });
    }

    async loadLatestChapters() {
        const params = this.state.searchQuery ? 
            { query: this.state.searchQuery } : 
            { page: this.state.currentPage };
            
        return api.getLatestChapters(params);
    }

    renderContent(container, content, reset = false) {
        const template = document.getElementById(
            this.state.activeTab === 'latest' ? 
            'chapter-card-template' : 
            'novel-card-template'
        );

        const fragment = document.createDocumentFragment();

        content.forEach(item => {
            const element = template.content.cloneNode(true);
            
            if (this.state.activeTab === 'latest') {
                this.fillChapterCard(element, item);
            } else {
                this.fillNovelCard(element, item);
            }

            fragment.appendChild(element);
        });

        if (reset) {
            container.innerHTML = '';
        }
        container.appendChild(fragment);
    }

    fillNovelCard(element, novel) {
        element.querySelector('.novel-title').textContent = novel.title;
        element.querySelector('.translator').textContent = novel.translator_name;
        element.querySelector('.update-time').textContent = this.formatDate(novel.updated_at);
        
        const cover = element.querySelector('.novel-cover img');
        if (cover) {
            cover.src = novel.cover_url || '/static/images/no-cover.png';
            cover.alt = novel.title;
        }

        element.querySelector('.novel-card').addEventListener('click', () => {
            this.telegram.HapticFeedback.impactOccurred('light');
            window.location.href = `/novel.html?id=${novel.id}`;
        });
    }

    fillChapterCard(element, chapter) {
        element.querySelector('.chapter-title').textContent = chapter.title;
        element.querySelector('.novel-title').textContent = chapter.novel_title;
        element.querySelector('.publish-time').textContent = this.formatDate(chapter.published_at);

        element.querySelector('.chapter-card').addEventListener('click', () => {
            this.telegram.HapticFeedback.impactOccurred('light');
            window.location.href = `/chapter.html?novelId=${chapter.novel_id}&chapterId=${chapter.id}`;
        });
    }

    handleTabClick(event) {
        const tab = event.currentTarget;
        const section = tab.dataset.section;
        
        if (section && section !== this.state.activeTab) {
            // Haptic feedback
            this.telegram.HapticFeedback.selectionChanged();

            // Обновляем активный таб
            document.querySelectorAll('.tab-button').forEach(t => {
                t.classList.toggle('active', t === tab);
            });

            // Показываем нужную секцию
            document.querySelectorAll('.section').forEach(s => {
                s.classList.toggle('active', s.dataset.section === section);
            });

            // Обновляем состояние и загружаем контент
            this.state.activeTab = section;
            this.loadContent(true);
        }
    }

    async handleSearch(query) {
        this.state.searchQuery = query;
        await this.loadContent(true);
    }

    handleBecomeTranslator() {
        // Haptic feedback
        this.telegram.HapticFeedback.impactOccurred('medium');

        this.telegram.showPopup({
            title: 'Стать переводчиком',
            message: 'Хотите стать переводчиком и публиковать свои переводы?',
            buttons: [
                {id: 'yes', type: 'default', text: 'Да'},
                {id: 'no', type: 'cancel'}
            ]
        }, async (buttonId) => {
            if (buttonId === 'yes') {
                try {
                    await storage.setUserRole('translator');
                    this.state.isTranslator = true;
                    
                    // Success feedback
                    this.telegram.HapticFeedback.notificationOccurred('success');
                    
                    // Скрываем кнопку
                    document.querySelector('[data-role="become-translator"]')?.remove();

                    this.showSuccess('Теперь вы можете публиковать переводы');
                } catch (error) {
                    console.error('Error becoming translator:', error);
                    this.telegram.HapticFeedback.notificationOccurred('error');
                    this.showError('Не удалось обновить роль');
                }
            }
        });
    }

    showFilters() {
        this.telegram.HapticFeedback.impactOccurred('light');
        this.telegram.showPopup({
            title: 'Фильтры',
            message: 'Выберите фильтры:',
            buttons: [
                {
                    id: 'subscribed',
                    type: 'default',
                    text: 'Только подписки'
                },
                {
                    id: 'all',
                    type: 'default',
                    text: 'Все новеллы'
                },
                {
                    id: 'cancel',
                    type: 'cancel'
                }
            ]
        });
    }

    showSorting() {
        this.telegram.HapticFeedback.impactOccurred('light');
        this.telegram.showPopup({
            title: 'Сортировка',
            message: 'Выберите порядок:',
            buttons: [
                {
                    id: 'newest',
                    type: 'default',
                    text: 'Сначала новые'
                },
                {
                    id: 'oldest',
                    type: 'default',
                    text: 'Сначала старые'
                },
                {
                    id: 'cancel',
                    type: 'cancel'
                }
            ]
        });
    }

    showError(message) {
        this.telegram.HapticFeedback.notificationOccurred('error');
        this.telegram.showPopup({
            title: 'Ошибка',
            message: message,
            buttons: [{type: 'close'}]
        });
    }

    showSuccess(message) {
        this.telegram.HapticFeedback.notificationOccurred('success');
        this.telegram.showPopup({
            title: 'Успешно',
            message: message,
            buttons: [{type: 'close'}]
        });
    }

    toggleLoading(show) {
        const loader = document.querySelector('.loading-indicator');
        if (loader) {
            loader.style.display = show ? 'block' : 'none';
        }
    }

    formatDate(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 86400000) { // 24 часа
            return 'Сегодня';
        } else if (diff < 172800000) { // 48 часов
            return 'Вчера';
        } else {
            return date.toLocaleDateString('ru-RU');
        }
    }

    handleScroll() {
        if (this.state.isLoading || !this.state.hasMoreContent) return;

        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;

        if (scrollY + windowHeight >= documentHeight - 200) {
            this.loadMoreContent();
        }
    }
}

// Создаем и инициализируем приложение
document.addEventListener('DOMContentLoaded', () => {
    try {
        const app = new NovelReader();
        app.init();
        
        // Делаем доступным глобально для отладки
        window.app = app;
    } catch (error) {
        console.error('Failed to initialize app:', error);
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Не удалось запустить приложение',
                buttons: [{type: 'close'}]
            });
        }
    }
});

// Экспортируем класс для использования в других модулях
export default NovelReader;

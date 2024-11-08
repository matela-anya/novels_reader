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
        this.handleTabClick = this.handleTabClick.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
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
            await this.loadContent(true);

            console.log('App initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Не удалось загрузить приложение');
        }
    }

    initTheme() {
        document.documentElement.className = this.telegram.colorScheme;
        this.telegram.onEvent('themeChanged', () => {
            document.documentElement.className = this.telegram.colorScheme;
        });
    }

    async loadUserData() {
        try {
            // Проверяем роль пользователя
            const role = await storage.getUserRole();
            this.state.isTranslator = role === 'translator';

            // Загружаем пользовательские данные
            const [subscriptions, bookmarks] = await Promise.all([
                storage.getSubscriptions(),
                storage.getBookmarks()
            ]);

            this.state.subscriptions = subscriptions;
            this.state.bookmarks = bookmarks;

            console.log('User data loaded:', {
                role,
                subscriptions: subscriptions.length,
                bookmarks: bookmarks.length
            });
        } catch (error) {
            console.error('Error loading user data:', error);
            throw error;
        }
    }

    initUI() {
        // Кнопка "Стать переводчиком"
        const translatorBtn = document.querySelector('[data-role="become-translator"]');
        if (translatorBtn) {
            if (this.state.isTranslator) {
                translatorBtn.remove(); // Удаляем кнопку если уже переводчик
            } else {
                translatorBtn.style.display = 'block';
                translatorBtn.addEventListener('click', this.handleBecomeTranslator);
            }
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
        document.querySelectorAll('[data-haptic]').forEach(element => {
            element.addEventListener('click', () => {
                this.telegram.HapticFeedback.impactOccurred('light');
            });
        });

        // Бесконечная прокрутка
        window.addEventListener('scroll', this.handleScroll);
    }

    async handleBecomeTranslator() {
        // Вибрация при нажатии
        this.telegram.HapticFeedback.impactOccurred('medium');

        this.telegram.showPopup({
            title: 'Стать переводчиком',
            message: 'Вы хотите стать переводчиком и публиковать свои переводы новелл?',
            buttons: [
                {id: 'yes', type: 'default', text: 'Да'},
                {id: 'no', type: 'cancel'}
            ]
        }, async (buttonId) => {
            if (buttonId === 'yes') {
                try {
                    await storage.setUserRole('translator');
                    this.state.isTranslator = true;
                    
                    // Успешная вибрация
                    this.telegram.HapticFeedback.notificationOccurred('success');

                    // Удаляем кнопку
                    document.querySelector('[data-role="become-translator"]')?.remove();

                    this.showSuccess('Теперь вы можете публиковать свои переводы!');
                } catch (error) {
                    console.error('Error becoming translator:', error);
                    this.telegram.HapticFeedback.notificationOccurred('error');
                    this.showError('Не удалось обновить роль');
                }
            }
        });
    }

    async loadContent(reset = false) {
        if (reset) {
            this.state.currentPage = 1;
            this.state.hasMoreContent = true;
        }

        if (!this.state.hasMoreContent || this.state.isLoading) return;

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
            this.state.hasMoreContent = content.length === 20;

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
        return api.getLatestChapters({
            page: this.state.currentPage,
            query: this.state.searchQuery
        });
    }

    renderContent(container, items, reset = false) {
        const template = document.getElementById(
            this.state.activeTab === 'latest' ? 
            'chapter-card-template' : 
            'novel-card-template'
        );

        const fragment = document.createDocumentFragment();

        items.forEach(item => {
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
        if (query === this.state.searchQuery) return;
        
        this.state.searchQuery = query;
        await this.loadContent(true);
    }

    handleScroll() {
        if (this.state.isLoading || !this.state.hasMoreContent) return;

        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;

        if (scrollY + windowHeight >= documentHeight - 200) {
            this.loadContent();
        }
    }

    toggleLoading(show) {
        const loadingIndicator = document.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = show ? 'block' : 'none';
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

    showError(message) {
        this.telegram.HapticFeedback.notificationOccurred('error');
        this.telegram.showPopup({
            title: 'Ошибка',
            message,
            buttons: [{type: 'close'}]
        });
    }

    showSuccess(message) {
        this.telegram.HapticFeedback.notificationOccurred('success');
        this.telegram.showPopup({
            title: 'Успешно',
            message,
            buttons: [{type: 'close'}]
        });
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

export default NovelReader;

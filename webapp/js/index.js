// Получаем экземпляр WebApp
const tg = window.Telegram.WebApp;

// Состояние приложения
const state = {
    activeTab: 'subscriptions',
    subscriptions: [],
    bookmarks: [],
    latestChapters: [],
    showOnlySubscribed: false
};

// Менеджер данных
const DataManager = {
    async init() {
        await Promise.all([
            this.loadSubscriptions(),
            this.loadBookmarks(),
            this.loadLatestChapters()
        ]);
        
        this.renderContent();
    },

    async loadSubscriptions() {
        if (!tg.CloudStorage) return;

        await new Promise((resolve) => {
            tg.CloudStorage.getKeys((error, keys) => {
                if (error) {
                    console.error('Failed to get keys:', error);
                    resolve();
                    return;
                }

                // Фильтруем ключи подписок
                const subscriptionKeys = keys.filter(key => key.startsWith('subscribed_'));
                
                // Загружаем данные подписок
                Promise.all(subscriptionKeys.map(key => {
                    return new Promise((resolveItem) => {
                        const novelId = key.replace('subscribed_', '');
                        tg.CloudStorage.getItem(key, (error, value) => {
                            if (!error && value === 'true') {
                                state.subscriptions.push(novelId);
                            }
                            resolveItem();
                        });
                    });
                })).then(resolve);
            });
        });
    },

    async loadBookmarks() {
        if (!tg.CloudStorage) return;

        await new Promise((resolve) => {
            tg.CloudStorage.getKeys((error, keys) => {
                if (error) {
                    console.error('Failed to get keys:', error);
                    resolve();
                    return;
                }

                // Фильтруем ключи закладок
                const bookmarkKeys = keys.filter(key => key.startsWith('bookmark_'));
                
                // Загружаем данные закладок
                Promise.all(bookmarkKeys.map(key => {
                    return new Promise((resolveItem) => {
                        const novelId = key.replace('bookmark_', '');
                        tg.CloudStorage.getItem(key, (error, value) => {
                            if (!error && value === 'true') {
                                state.bookmarks.push(novelId);
                            }
                            resolveItem();
                        });
                    });
                })).then(resolve);
            });
        });
    },

    async loadLatestChapters() {
        // Здесь будет загрузка последних глав
        // Пока используем моковые данные
        state.latestChapters = [
            {
                id: '1',
                title: 'Глава 156: Начало конца',
                novelId: '1',
                novelTitle: 'Возрождение после смерти',
                date: 'Сегодня'
            },
            // ... другие главы
        ];
    },

    renderContent() {
        this.renderSubscriptions();
        this.renderBookmarks();
        this.renderLatestChapters();
    },

    renderSubscriptions() {
        const container = document.querySelector('.subscriptions .novels-list');
        const emptyState = document.querySelector('.subscriptions-empty');

        if (state.subscriptions.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        // Рендерим карточки новелл
        // В реальном приложении здесь будет загрузка данных с сервера
        container.innerHTML = state.subscriptions.map(id => `
            <a href="novel.html?id=${id}" class="novel-card">
                <div class="novel-info">
                    <h3 class="novel-title">Название новеллы #${id}</h3>
                    <div class="novel-meta">
                        <span class="translator">Переводчик</span>
                        <span class="chapter-count">156 глав</span>
                    </div>
                </div>
                <svg class="card-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18l6-6-6-6"/>
                </svg>
            </a>
        `).join('');
    },

    renderBookmarks() {
        const container = document.querySelector('.bookmarks .novels-list');
        const emptyState = document.querySelector('.bookmarks-empty');

        if (state.bookmarks.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        // Рендерим закладки
        container.innerHTML = state.bookmarks.map(id => `
            <a href="novel.html?id=${id}" class="novel-card">
                <div class="novel-info">
                    <h3 class="novel-title">Название новеллы #${id}</h3>
                    <div class="novel-meta">
                        <span class="translator">Переводчик</span>
                        <span class="chapter-count">156 глав</span>
                    </div>
                </div>
                <svg class="card-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18l6-6-6-6"/>
                </svg>
            </a>
        `).join('');
    },

    renderLatestChapters() {
        const container = document.querySelector('.latest-chapters .chapters-list');
        const chapters = state.showOnlySubscribed 
            ? state.latestChapters.filter(chapter => state.subscriptions.includes(chapter.novelId))
            : state.latestChapters;

        container.innerHTML = chapters.map(chapter => `
            <div class="chapter-card">
                <div class="chapter-content">
                    <h3 class="chapter-title">${chapter.title}</h3>
                    <div class="chapter-details">
                        <div class="chapter-meta">
                            <span class="novel-name">${chapter.novelTitle}</span>
                            <span class="chapter-date">${chapter.date}</span>
                        </div>
                        <button class="read-button">Читать</button>
                    </div>
                </div>
            </div>
        `).join('');
    }
};

// Менеджер интерфейса
const UIManager = {
    init() {
        this.initTabs();
        this.initSearch();
        this.initFilters();
    },

    initTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const sections = document.querySelectorAll('.section');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Убираем активный класс у всех кнопок и секций
                tabButtons.forEach(btn => btn.classList.remove('active'));
                sections.forEach(section => section.classList.remove('active'));

                // Активируем выбранную вкладку
                button.classList.add('active');
                const targetSection = document.querySelector(`.section[data-section="${button.dataset.tab}"]`);
                if (targetSection) {
                    targetSection.classList.add('active');
                }

                // Обновляем состояние
                state.activeTab = button.dataset.tab;
                // Вибрация при переключении
                tg.HapticFeedback.selectionChanged();
            });
        });
    },

    initSearch() {
        const searchInput = document.querySelector('.search-input');
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            // Здесь будет логика поиска
            console.log('Search:', e.target.value);
        });
    },

    initFilters() {
        const filterButton = document.querySelector('.filter-button');
        if (!filterButton) return;

        filterButton.addEventListener('click', () => {
            state.showOnlySubscribed = !state.showOnlySubscribed;
            filterButton.classList.toggle('active', state.showOnlySubscribed);
            DataManager.renderLatestChapters();
            // Вибрация при переключении
            tg.HapticFeedback.impactOccurred('light');
        });
    }
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    // Проверяем, что приложение запущено в Telegram
    if (!tg) {
        console.error('Telegram WebApp is not available');
        return;
    }

    tg.ready();
    tg.expand();

    // Применяем тему Telegram
    document.documentElement.className = tg.colorScheme;

    // Инициализируем менеджеры
    UIManager.init();
    await DataManager.init();
});

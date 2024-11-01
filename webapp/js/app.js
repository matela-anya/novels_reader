// Получаем экземпляр WebApp
const tg = window.Telegram.WebApp;

// Состояние приложения
const state = {
    activeSection: 'subscriptions',
    subscriptions: [],
    bookmarks: [],
    latestChapters: [],
    showOnlySubscribed: false,
    userSettings: null
};

// Главный класс приложения
const App = {
    init() {
        if (!tg) {
            console.error('Telegram WebApp is not available');
            return;
        }

        // Инициализация WebApp
        tg.ready();
        tg.expand();

        // Применяем тему
        this.initTheme();
        
        // Инициализируем компоненты
        UIManager.init();
        DataManager.init();
        ModalManager.init();
    },

    initTheme() {
        document.documentElement.className = tg.colorScheme;
        
        // Слушаем изменения темы
        tg.onEvent('themeChanged', () => {
            document.documentElement.className = tg.colorScheme;
        });
    }
};

// Менеджер пользовательского интерфейса
const UIManager = {
    init() {
        this.initTabs();
        this.initSearch();
        this.initButtons();
    },

    initTabs() {
        const tabs = document.querySelectorAll('.tab-button');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Убираем активный класс у всех вкладок
                tabs.forEach(t => t.classList.remove('active'));
                // Добавляем активный класс текущей вкладке
                tab.classList.add('active');

                // Переключаем секции
                const sectionId = tab.dataset.section;
                this.switchSection(sectionId);

                // Тактильный отклик
                tg.HapticFeedback.selectionChanged();
            });
        });
    },

    switchSection(sectionId) {
        // Скрываем все секции
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Показываем нужную секцию
        const activeSection = document.querySelector(`.section[data-section="${sectionId}"]`);
        if (activeSection) {
            activeSection.classList.add('active');
            state.activeSection = sectionId;
        }
    },

    initSearch() {
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                // Debounce поиска
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    DataManager.handleSearch(e.target.value.trim());
                }, 300);
            });
        }
    },

    initButtons() {
        // Кнопка фильтра
        const filterBtn = document.querySelector('.filter-button');
        if (filterBtn) {
            filterBtn.addEventListener('click', () => {
                state.showOnlySubscribed = !state.showOnlySubscribed;
                filterBtn.classList.toggle('active', state.showOnlySubscribed);
                DataManager.renderLatestChapters();
                tg.HapticFeedback.impactOccurred('light');
            });
        }

        // Кнопка сортировки
        const sortBtn = document.querySelector('.sort-button');
        if (sortBtn) {
            sortBtn.addEventListener('click', () => {
                tg.HapticFeedback.impactOccurred('light');
                tg.showPopup({
                    title: 'Сортировка',
                    message: 'Выберите порядок сортировки:',
                    buttons: [
                        { id: 'update', type: 'default', text: 'По обновлению' },
                        { id: 'name', type: 'default', text: 'По названию' },
                        { id: 'close', type: 'cancel', text: 'Закрыть' }
                    ]
                }, (buttonId) => {
                    if (buttonId !== 'close') {
                        DataManager.sortNovels(buttonId);
                    }
                });
            });
        }
    }
};

// Менеджер данных
const DataManager = {
    async init() {
        await this.loadData();
        this.renderContent();
    },

    async loadData() {
        if (!tg.CloudStorage) return;

        try {
            // Загружаем подписки
            const subscriptions = await this.loadFromStorage('subscriptions');
            if (subscriptions) state.subscriptions = JSON.parse(subscriptions);

            // Загружаем закладки
            const bookmarks = await this.loadFromStorage('bookmarks');
            if (bookmarks) state.bookmarks = JSON.parse(bookmarks);

            // Загружаем последние главы (пример данных)
            state.latestChapters = [
                {
                    id: 1,
                    title: 'Глава 156: Начало конца',
                    novelTitle: 'Возрождение после смерти',
                    date: 'Сегодня'
                }
                // Добавьте больше глав здесь
            ];
        } catch (error) {
            console.error('Error loading data:', error);
            // Показываем ошибку пользователю
            tg.showPopup({
                title: 'Ошибка',
                message: 'Не удалось загрузить данные. Попробуйте позже.',
                buttons: [{ type: 'ok' }]
            });
        }
    },

    async loadFromStorage(key) {
        return new Promise((resolve) => {
            tg.CloudStorage.getItem(key, (error, value) => {
                if (error) {
                    console.error(`Error loading ${key}:`, error);
                    resolve(null);
                } else {
                    resolve(value);
                }
            });
        });
    },

    renderContent() {
        this.renderSubscriptions();
        this.renderBookmarks();
        this.renderLatestChapters();
    },

    renderSubscriptions() {
        const container = document.querySelector('.subscriptions .novels-list');
        const emptyState = document.querySelector('.subscriptions .empty-state');
        
        if (!state.subscriptions.length) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        container.innerHTML = this.generateNovelsList(state.subscriptions);
    },

    renderBookmarks() {
        const container = document.querySelector('.bookmarks .novels-list');
        const emptyState = document.querySelector('.bookmarks .empty-state');
        
        if (!state.bookmarks.length) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        container.innerHTML = this.generateNovelsList(state.bookmarks);
    },

    renderLatestChapters() {
        const container = document.querySelector('.chapters-list');
        let chapters = [...state.latestChapters];

        if (state.showOnlySubscribed) {
            chapters = chapters.filter(chapter => 
                state.subscriptions.some(sub => sub.id === chapter.novelId)
            );
        }

        container.innerHTML = chapters.map(chapter => `
            <div class="chapter-card">
                <h3 class="chapter-title">${chapter.title}</h3>
                <div class="chapter-info">
                    <span class="novel-title">${chapter.novelTitle}</span>
                    <span class="chapter-date">${chapter.date}</span>
                </div>
                <button class="read-button" onclick="DataManager.openChapter(${chapter.id})">
                    Читать
                </button>
            </div>
        `).join('');
    },

    generateNovelsList(novels) {
        return novels.map(novel => `
            <div class="novel-card" onclick="DataManager.openNovel(${novel.id})">
                <div class="novel-info">
                    <h3 class="novel-title">${novel.title}</h3>
                    <div class="novel-meta">
                        <span class="translator">${novel.translator}</span>
                        <span class="chapters-count">${novel.chaptersCount} глав</span>
                    </div>
                </div>
                <div class="novel-arrow">→</div>
            </div>
        `).join('');
    },

    openNovel(id) {
        window.location.href = `novel.html?id=${id}`;
    },

    openChapter(id) {
        window.location.href = `chapter.html?id=${id}`;
    },

    handleSearch(query) {
        // Здесь будет логика поиска
        console.log('Searching for:', query);
    },

    sortNovels(method) {
        // Здесь будет логика сортировки
        console.log('Sorting by:', method);
    }
};

// Менеджер модальных окон
const ModalManager = {
    init() {
        this.initTranslatorModal();
    },

    initTranslatorModal() {
        const modal = document.getElementById('translatorModal');
        const openBtn = document.querySelector('.become-translator');
        const closeBtn = document.querySelector('.modal-close');
        const form = document.getElementById('translatorForm');

        if (openBtn) {
            openBtn.addEventListener('click', () => {
                modal.classList.add('visible');
                tg.MainButton.show();
                tg.MainButton.setParams({
                    text: 'Стать переводчиком',
                    is_active: true
                });
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('visible');
                tg.MainButton.hide();
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleTranslatorForm(form);
            });
        }

        // Закрытие по клику вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('visible');
                tg.MainButton.hide();
            }
        });

        // Обработка главной кнопки
        tg.MainButton.onClick(() => {
            if (form) form.dispatchEvent(new Event('submit'));
        });
    },

    async handleTranslatorForm(form) {
        const formData = new FormData(form);
        try {
            tg.MainButton.showProgress();
            
            // Здесь будет отправка данных на сервер
            await new Promise(resolve => setTimeout(resolve, 1000));

            tg.showPopup({
                title: 'Успешно!',
                message: 'Вы стали переводчиком',
                buttons: [{ type: 'ok' }]
            });

            document.getElementById('translatorModal').classList.remove('visible');
            tg.MainButton.hide();
        } catch (error) {
            tg.showPopup({
                title: 'Ошибка',
                message: 'Не удалось отправить форму. Попробуйте позже.',
                buttons: [{ type: 'ok' }]
            });
        } finally {
            tg.MainButton.hideProgress();
        }
    }
};

// Инициализация приложения при загрузке
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

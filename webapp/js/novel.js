// Получаем экземпляр WebApp
const tg = window.Telegram.WebApp;

// Состояние новеллы
const state = {
    novelId: null,
    isSubscribed: false,
    isBookmarked: false,
    currentChapter: null
};

// Менеджер данных новеллы
const NovelManager = {
    init() {
        // Получаем ID новеллы из URL
        const urlParams = new URLSearchParams(window.location.search);
        state.novelId = urlParams.get('id');
        
        if (!state.novelId) {
            tg.showPopup({
                title: 'Ошибка',
                message: 'Новелла не найдена',
                buttons: [{ type: 'close' }]
            });
            return;
        }

        // Инициализируем кнопки и состояния
        this.initSubscription();
        this.initBookmark();
        this.initChaptersList();
    },

    async initSubscription() {
        const subscribeButton = document.querySelector('.action-button.primary');
        if (!subscribeButton) return;

        // Проверяем статус подписки
        await this.checkSubscriptionStatus();

        // Обновляем текст кнопки
        subscribeButton.textContent = state.isSubscribed ? 'Отписаться' : 'Подписаться';

        // Добавляем обработчик
        subscribeButton.addEventListener('click', async () => {
            if (state.isSubscribed) {
                await this.unsubscribe();
            } else {
                await this.subscribe();
            }
            subscribeButton.textContent = state.isSubscribed ? 'Отписаться' : 'Подписаться';
        });
    },

    async checkSubscriptionStatus() {
        if (!tg.CloudStorage) return;

        await new Promise((resolve) => {
            tg.CloudStorage.getItem(`subscribed_${state.novelId}`, (error, value) => {
                if (!error && value === 'true') {
                    state.isSubscribed = true;
                }
                resolve();
            });
        });
    },

    async subscribe() {
        if (!tg.CloudStorage) return;

        await new Promise((resolve) => {
            tg.CloudStorage.setItem(`subscribed_${state.novelId}`, 'true', (error) => {
                if (!error) {
                    state.isSubscribed = true;
                    // Показываем уведомление
                    tg.HapticFeedback.notificationOccurred('success');
                }
                resolve();
            });
        });
    },

    async unsubscribe() {
        if (!tg.CloudStorage) return;

        await new Promise((resolve) => {
            tg.CloudStorage.removeItem(`subscribed_${state.novelId}`, (error) => {
                if (!error) {
                    state.isSubscribed = false;
                    // Показываем уведомление
                    tg.HapticFeedback.notificationOccurred('warning');
                }
                resolve();
            });
        });
    },

    async initBookmark() {
        const bookmarkButton = document.querySelector('.action-button.bookmark');
        if (!bookmarkButton) return;

        // Проверяем статус закладки
        await this.checkBookmarkStatus();

        // Обновляем состояние кнопки
        bookmarkButton.classList.toggle('active', state.isBookmarked);

        // Добавляем обработчик
        bookmarkButton.addEventListener('click', async () => {
            if (state.isBookmarked) {
                await this.removeBookmark();
            } else {
                await this.addBookmark();
            }
            bookmarkButton.classList.toggle('active', state.isBookmarked);
            // Тактильный отклик
            tg.HapticFeedback.impactOccurred('light');
        });
    },

    async checkBookmarkStatus() {
        if (!tg.CloudStorage) return;

        await new Promise((resolve) => {
            tg.CloudStorage.getItem(`bookmark_${state.novelId}`, (error, value) => {
                if (!error && value === 'true') {
                    state.isBookmarked = true;
                }
                resolve();
            });
        });
    },

    async addBookmark() {
        if (!tg.CloudStorage) return;

        await new Promise((resolve) => {
            tg.CloudStorage.setItem(`bookmark_${state.novelId}`, 'true', (error) => {
                if (!error) {
                    state.isBookmarked = true;
                }
                resolve();
            });
        });
    },

    async removeBookmark() {
        if (!tg.CloudStorage) return;

        await new Promise((resolve) => {
            tg.CloudStorage.removeItem(`bookmark_${state.novelId}`, (error) => {
                if (!error) {
                    state.isBookmarked = false;
                }
                resolve();
            });
        });
    },

    initChaptersList() {
        const chapterCards = document.querySelectorAll('.chapter-card');
        const loadMoreButton = document.querySelector('.load-more');

        // Помечаем прочитанные главы
        this.markReadChapters(chapterCards);

        // Обработчики для карточек глав
        chapterCards.forEach(card => {
            card.addEventListener('click', () => {
                const chapterId = card.dataset.chapterId;
                window.location.href = `/chapter.html?novelId=${state.novelId}&chapterId=${chapterId}`;
            });
        });

        // Обработчик кнопки "Загрузить еще"
        if (loadMoreButton) {
            loadMoreButton.addEventListener('click', () => {
                // Показываем индикатор загрузки
                loadMoreButton.textContent = 'Загрузка...';
                // Здесь будет логика загрузки дополнительных глав
                setTimeout(() => {
                    loadMoreButton.textContent = 'Загрузить еще';
                }, 1000);
            });
        }

        // Инициализация фильтров
        this.initFilters();
    },

    async markReadChapters(chapterCards) {
        if (!tg.CloudStorage) return;

        // Получаем список прочитанных глав
        await new Promise((resolve) => {
            tg.CloudStorage.getItem(`read_chapters_${state.novelId}`, (error, value) => {
                if (!error && value) {
                    try {
                        const readChapters = JSON.parse(value);
                        chapterCards.forEach(card => {
                            const chapterId = card.dataset.chapterId;
                            if (readChapters.includes(chapterId)) {
                                card.classList.add('read');
                                card.classList.remove('unread');
                            }
                        });
                    } catch (e) {
                        console.error('Failed to parse read chapters:', e);
                    }
                }
                resolve();
            });
        });
    },

    initFilters() {
        const filterButton = document.querySelector('.filter-button');
        const sortButton = document.querySelector('.sort-button');

        if (filterButton) {
            filterButton.addEventListener('click', () => {
                tg.showPopup({
                    title: 'Фильтры',
                    message: 'Выберите фильтры:',
                    buttons: [
                        {id: 'unread', type: 'default', text: 'Непрочитанные'},
                        {id: 'read', type: 'default', text: 'Прочитанные'},
                        {id: 'all', type: 'default', text: 'Все главы'},
                        {id: 'close', type: 'cancel', text: 'Закрыть'}
                    ]
                });
            });
        }

        if (sortButton) {
            sortButton.addEventListener('click', () => {
                tg.showPopup({
                    title: 'Сортировка',
                    message: 'Выберите порядок:',
                    buttons: [
                        {id: 'new', type: 'default', text: 'Сначала новые'},
                        {id: 'old', type: 'default', text: 'Сначала старые'},
                        {id: 'close', type: 'cancel', text: 'Закрыть'}
                    ]
                });
            });
        }
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

    // Инициализируем менеджер новеллы
    await NovelManager.init();

    // Показываем кнопку "Назад" в шапке WebApp
    tg.BackButton.show();
    tg.BackButton.onClick(() => {
        window.location.href = '/index.html';
    });
});

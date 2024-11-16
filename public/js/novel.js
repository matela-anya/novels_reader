```javascript
import api from './api.js';
import storage from './storage.js';

class NovelPage {
    constructor() {
        // Инициализация Telegram WebApp
        this.telegram = window.Telegram?.WebApp;
        if (!this.telegram) {
            throw new Error('Telegram WebApp is not available');
        }

        // Состояние страницы
        this.state = {
            novelId: null,
            novel: null,
            mode: null,
            chapters: [],
            isSubscribed: false,
            isBookmarked: false,
            isTranslator: false,
            isOwner: false,
            chaptersSort: 'desc',
            currentPage: 1,
            hasMoreChapters: true,
            isLoading: false
        };

        // Привязка методов
        this.handleSubscribe = this.handleSubscribe.bind(this);
        this.handleBookmark = this.handleBookmark.bind(this);
        this.handleSortChange = this.handleSortChange.bind(this);
        this.handleChapterClick = this.handleChapterClick.bind(this);
        this.handleAddChapter = this.handleAddChapter.bind(this);
        this.handleSave = this.handleSave.bind(this);
    }

    async init() {
        try {
            // Инициализируем WebApp
            this.telegram.ready();
            this.telegram.expand();

            // Получаем параметры из URL
            const params = new URLSearchParams(window.location.search);
            this.state.mode = params.get('mode');
            this.state.novelId = params.get('id');

            // Настраиваем UI в зависимости от режима
            if (this.state.mode === 'create' || this.state.mode === 'edit') {
                await this.initEditMode();
            } else {
                await this.initViewMode();
            }
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Не удалось загрузить новеллу');
        }
    }

    async initEditMode() {
        try {
            // Скрываем режим просмотра, показываем режим редактирования
            document.querySelector('.view-mode').style.display = 'none';
            document.querySelector('.edit-mode').style.display = 'block';

            // Показываем кнопку "Назад"
            this.telegram.BackButton.show();
            this.telegram.BackButton.onClick(() => window.history.back());

            // Проверяем роль пользователя
            const role = await storage.getUserRole();
            if (role !== 'translator') {
                throw new Error('Access denied');
            }

            // Настраиваем главную кнопку
            this.telegram.MainButton.setText(this.state.mode === 'create' ? 'Создать' : 'Сохранить');
            this.telegram.MainButton.show();
            this.telegram.MainButton.onClick(this.handleSave);

            if (this.state.mode === 'edit' && this.state.novelId) {
                // Загружаем данные новеллы для редактирования
                const novel = await api.getNovel(this.state.novelId);
                if (novel.translator_id !== this.telegram.initDataUnsafe?.user?.id) {
                    throw new Error('Access denied');
                }
                this.fillEditForm(novel);
            }
        } catch (error) {
            console.error('Edit mode initialization error:', error);
            this.showError(error.message);
            window.history.back();
        }
    }

    async initViewMode() {
        // Показываем режим просмотра
        document.querySelector('.view-mode').style.display = 'block';
        document.querySelector('.edit-mode').style.display = 'none';

        // Показываем кнопку "Назад"
        this.telegram.BackButton.show();
        this.telegram.BackButton.onClick(() => window.history.back());

        if (!this.state.novelId) {
            throw new Error('Novel ID is required for view mode');
        }

        // Загружаем данные
        await this.loadData();
        
        // Инициализируем UI
        this.initUI();

        // Обновляем просмотры
        await api.incrementNovelViews(this.state.novelId);
    }

    fillEditForm(novel) {
        document.getElementById('title').value = novel.title || '';
        document.getElementById('description').value = novel.description || '';
        if (novel.cover_url) {
            document.querySelector('.cover-image').src = novel.cover_url;
        }
    }

    async handleSave() {
        try {
            this.telegram.MainButton.showProgress();
            this.telegram.HapticFeedback.impactOccurred('medium');

            const formData = {
                title: document.getElementById('title').value.trim(),
                description: document.getElementById('description').value.trim(),
                cover_url: document.querySelector('.cover-image').src,
                translator_id: this.telegram.initDataUnsafe?.user?.id
            };

            if (!formData.title) {
                throw new Error('Название обязательно для заполнения');
            }

            if (!formData.translator_id) {
                throw new Error('Не удалось определить переводчика');
            }

            let novel;
            if (this.state.mode === 'create') {
                novel = await api.createNovel(formData);
                this.telegram.HapticFeedback.notificationOccurred('success');
                window.location.href = `/novel.html?id=${novel.id}`;
            } else {
                await api.updateNovel(this.state.novelId, formData);
                this.telegram.HapticFeedback.notificationOccurred('success');
                window.location.href = `/novel.html?id=${this.state.novelId}`;
            }
        } catch (error) {
            console.error('Save error:', error);
            this.telegram.HapticFeedback.notificationOccurred('error');
            this.showError(error.message || 'Не удалось сохранить новеллу');
        } finally {
            this.telegram.MainButton.hideProgress();
        }
    }

    async loadData() {
        try {
            // Загружаем данные параллельно
            const [novel, userRole, subscriptions, bookmarks] = await Promise.all([
                api.getNovel(this.state.novelId),
                storage.getUserRole(),
                storage.getSubscriptions(),
                storage.getBookmarks()
            ]);

            // Сохраняем в состояние
            this.state.novel = novel;
            this.state.isTranslator = userRole === 'translator';
            this.state.isOwner = novel.translator_id === this.telegram.initDataUnsafe?.user?.id;
            this.state.isSubscribed = subscriptions.includes(this.state.novelId);
            this.state.isBookmarked = bookmarks.includes(this.state.novelId);

            // Загружаем главы
            await this.loadChapters();

        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    async loadChapters(reset = false) {
        if (reset) {
            this.state.currentPage = 1;
            this.state.hasMoreChapters = true;
        }

        if (!this.state.hasMoreChapters || this.state.isLoading) return;

        try {
            this.state.isLoading = true;
            this.toggleLoading(true);

            const chapters = await api.getChapters(this.state.novelId, {
                page: this.state.currentPage,
                sort: this.state.chaptersSort
            });

            this.state.hasMoreChapters = chapters.length === 20;

            if (reset) {
                this.state.chapters = chapters;
            } else {
                this.state.chapters = [...this.state.chapters, ...chapters];
            }

            this.renderChapters();

        } catch (error) {
            console.error('Error loading chapters:', error);
            this.showError('Не удалось загрузить главы');
        } finally {
            this.state.isLoading = false;
            this.toggleLoading(false);
        }
    }

    initUI() {
        // Обновляем информацию о новелле
        this.updateNovelInfo();

        // Инициализируем кнопки
        const subscribeBtn = document.querySelector('.subscribe-button');
        const bookmarkBtn = document.querySelector('.bookmark-button');
        const sortBtn = document.querySelector('.sort-button');
        const loadMoreBtn = document.querySelector('.load-more');
        const addChapterBtn = document.querySelector('.add-chapter-button');

        if (subscribeBtn) {
            subscribeBtn.addEventListener('click', this.handleSubscribe);
            this.updateSubscribeButton();
        }

        if (bookmarkBtn) {
            bookmarkBtn.addEventListener('click', this.handleBookmark);
            this.updateBookmarkButton();
        }

        if (sortBtn) {
            sortBtn.addEventListener('click', this.handleSortChange);
        }

        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadChapters());
        }

        // Показываем кнопку добавления главы если это владелец
        if (addChapterBtn) {
            addChapterBtn.style.display = this.state.isOwner ? 'flex' : 'none';
            addChapterBtn.addEventListener('click', this.handleAddChapter);
        }
    }

    updateNovelInfo() {
        // Заголовок
        document.querySelector('.novel-title').textContent = this.state.novel.title;
        document.title = this.state.novel.title;

        // Обложка
        const coverImg = document.querySelector('.novel-cover-image');
        if (coverImg) {
            coverImg.src = this.state.novel.cover_url || '/api/placeholder/400/600';
            coverImg.alt = this.state.novel.title;
        }

        // Статистика
        const views = document.querySelector('.stat.views .stat-value');
        const subscribers = document.querySelector('.stat.subscribers .stat-value');
        const chapters = document.querySelector('.stat.chapters .stat-value');

        if (views) views.textContent = this.state.novel.views || 0;
        if (subscribers) subscribers.textContent = this.state.novel.subscribers_count || 0;
        if (chapters) chapters.textContent = this.state.novel.chapters_count || 0;

        // Информация о переводчике
        const translatorName = document.querySelector('.translator-name');
        if (translatorName) {
            translatorName.textContent = this.state.novel.translator_name;
        }

        // Описание и теги
        const description = document.querySelector('.description-text');
        if (description) {
            description.textContent = this.state.novel.description;
        }

        // Теги
        const tagsContainer = document.querySelector('.novel-tags');
        if (tagsContainer && this.state.novel.tags) {
            tagsContainer.innerHTML = this.state.novel.tags
                .map(tag => `<span class="tag">${tag}</span>`)
                .join('');
        }
    }

    renderChapters() {
        const container = document.querySelector('.chapters-list');
        const emptyState = document.querySelector('.empty-state');
        const template = document.getElementById('chapter-card-template');
        const loadMoreBtn = document.querySelector('.load-more');

        if (!container || !template) return;

        if (!this.state.chapters.length) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            loadMoreBtn.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        loadMoreBtn.style.display = this.state.hasMoreChapters ? 'block' : 'none';

        const fragment = document.createDocumentFragment();

        this.state.chapters.forEach(chapter => {
            const element = template.content.cloneNode(true);
            
            element.querySelector('.chapter-title').textContent = chapter.title;
            element.querySelector('.chapter-number').textContent = 
                `Глава ${chapter.chapter_number}`;
            element.querySelector('.chapter-date').textContent = 
                this.formatDate(chapter.published_at);

            const card = element.querySelector('.chapter-card');
            card.dataset.chapterId = chapter.id;
            card.addEventListener('click', () => this.handleChapterClick(chapter.id));

            fragment.appendChild(element);
        });

        if (this.state.currentPage === 1) {
            container.innerHTML = '';
        }
        container.appendChild(fragment);
    }

    async handleSubscribe() {
        try {
            this.telegram.HapticFeedback.impactOccurred('medium');

            if (this.state.isSubscribed) {
                await storage.removeSubscription(this.state.novelId);
                this.telegram.HapticFeedback.notificationOccurred('warning');
            } else {
                await storage.addSubscription(this.state.novelId);
                this.telegram.HapticFeedback.notificationOccurred('success');
            }

            this.state.isSubscribed = !this.state.isSubscribed;
            this.updateSubscribeButton();

        } catch (error) {
            console.error('Subscribe error:', error);
            this.showError('Не удалось обновить подписку');
        }
    }

    async handleBookmark() {
        try {
            this.telegram.HapticFeedback.impactOccurred('light');

            if (this.state.isBookmarked) {
                await storage.removeBookmark(this.state.novelId);
            } else {
                await storage.addBookmark(this.state.novelId);
            }

            this.state.isBookmarked = !this.state.isBookmarked;
            this.updateBookmarkButton();

        } catch (error) {
            console.error('Bookmark error:', error);
            this.showError('Не удалось обновить закладку');
        }
    }

    handleSortChange() {
        this.telegram.HapticFeedback.impactOccurred('light');
        
        this.telegram.showPopup({
            title: 'Сортировка',
            message: 'Выберите порядок:',
            buttons: [
                {
                    id: 'desc',
                    type: 'default',
                    text: this.state.chaptersSort === 'desc' ? '✓ Сначала новые' : 'Сначала новые'
                },
                {
                    id: 'asc',
                    type: 'default',
                    text: this.state.chaptersSort === 'asc' ? '✓ Сначала старые' : 'Сначала старые'
                },
                {
                    id: 'cancel',
                    type: 'cancel'
                }
            ]
        }, async (buttonId) => {
            if (buttonId === 'cancel' || buttonId === this.state.chaptersSort) return;
            
            this.state.chaptersSort = buttonId;
            const sortLabel = document.querySelector('.sort-label');
            if (sortLabel) {
                sortLabel.textContent = buttonId === 'desc' ? 'Сначала новые' : 'Сначала старые';
            }
            
            await this.loadChapters(true);
        });
    }

    handleChapterClick(chapterId) {
        this.telegram.HapticFeedback.impactOccurred('light');
        window.location.href = `/chapter.html?novelId=${this.state.novelId}&chapterId=${chapterId}`;
    }

    handleAddChapter() {
        this.telegram.HapticFeedback.impactOccurred('medium');

        this.telegram.showPopup({
            title: 'Новая глава',
            message: 'Добавить новую главу?',
            buttons: [
                {id: 'add', type: 'default', text: 'Добавить'},
                {id: 'cancel', type: 'cancel'}
            ]
        }, (buttonId) => {
            if (buttonId === 'add') {
                window.location.href = `/chapter.html?novelId=${this.state.novelId}&mode=create`;
            }
        });
    }

    updateSubscribeButton() {
        const button = document.querySelector('.subscribe-button');
        if (button) {
            button.textContent = this.state.isSubscribed ? 'Отписаться' : 'Подписаться';
            button.classList.toggle('subscribed', this.state.isSubscribed);
        }
    }

    updateBookmarkButton() {
        const button = document.querySelector('.bookmark-button');
        if (button) {
            button.classList.toggle('active', this.state.isBookmarked);
            const icon = button.querySelector('.icon');
            if (icon) {
                icon.textContent = this.state.isBookmarked ? '🔖' : '🔖';
            }
        }
    }

    toggleLoading(show) {
        const loadMoreBtn = document.querySelector('.load-more');
        if (loadMoreBtn) {
            loadMoreBtn.textContent = show ? 'Загрузка...' : 'Загрузить еще';
            loadMoreBtn.disabled = show;
        }

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
}

// Создаем и инициализируем страницу
document.addEventListener('DOMContentLoaded', () => {
    try {
        const page = new NovelPage();
        page.init();

        // Делаем доступным глобально для отладки
        window.novelPage = page;
    } catch (error) {
        console.error('Failed to initialize novel page:', error);
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Не удалось загрузить страницу',
                buttons: [{type: 'close'}]
            });
        }
    }
});

export default NovelPage;

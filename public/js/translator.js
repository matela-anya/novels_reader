import api from './api.js';
import storage from './storage.js';

/**
 * Класс для страницы переводчика
 */
class TranslatorPage {
    constructor() {
        // Инициализация Telegram WebApp
        this.telegram = window.Telegram?.WebApp;
        if (!this.telegram) {
            throw new Error('Telegram WebApp is not available');
        }

        // Состояние страницы
        this.state = {
            activeTab: 'novels',
            stats: {
                novelsCount: 0,
                chaptersCount: 0,
                subscribersCount: 0,
                views: 0
            },
            novels: [],
            isLoading: false
        };

        // Привязка методов
        this.handleTabClick = this.handleTabClick.bind(this);
        this.handleAddNovel = this.handleAddNovel.bind(this);
        this.handleNovelAction = this.handleNovelAction.bind(this);
        this.handleBackClick = this.handleBackClick.bind(this);
    }

    async init() {
        try {
            // Инициализируем WebApp
            this.telegram.ready();
            this.telegram.expand();

            // Проверяем права доступа
            const role = await storage.getUserRole();
            if (role !== 'translator') {
                throw new Error('Access denied');
            }

            // Инициализируем UI
            this.initUI();
            
            // Загружаем данные
            await this.loadData();

        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Не удалось загрузить данные');
        }
    }

    initUI() {
        // Кнопка "Назад"
        const backBtn = document.querySelector('.back-button');
        if (backBtn) {
            backBtn.addEventListener('click', this.handleBackClick);
        }

        // Табы
        document.querySelectorAll('.tab-button').forEach(tab => {
            tab.addEventListener('click', this.handleTabClick);
        });

        // Кнопка добавления новеллы
        const addBtn = document.querySelector('.add-button');
        if (addBtn) {
            addBtn.addEventListener('click', this.handleAddNovel);
        }
    }

    async loadData() {
        try {
            this.state.isLoading = true;
            this.toggleLoading(true);

            // Загружаем все данные параллельно
            const [novels, stats] = await Promise.all([
                api.getNovelsByTranslator(this.telegram.initDataUnsafe?.user?.id),
                api.getTranslatorStats(this.telegram.initDataUnsafe?.user?.id)
            ]);

            this.state.novels = novels;
            this.state.stats = stats;

            // Обновляем UI
            this.updateStats();
            this.renderNovels();

        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Не удалось загрузить данные');
        } finally {
            this.state.isLoading = false;
            this.toggleLoading(false);
        }
    }

    updateStats() {
        // Обновляем статистику в шапке
        const statsElements = document.querySelectorAll('.translator-stats .stat-value');
        statsElements[0].textContent = this.state.stats.novelsCount;
        statsElements[1].textContent = this.state.stats.chaptersCount;
        statsElements[2].textContent = this.state.stats.subscribersCount;

        // Обновляем карточки статистики
        const viewsElement = document.querySelector('.total-views .stat-value');
        const subsElement = document.querySelector('.total-subscribers .stat-value');
        const chaptersElement = document.querySelector('.chapters-published .stat-value');

        if (viewsElement) viewsElement.textContent = this.state.stats.views.toLocaleString();
        if (subsElement) subsElement.textContent = this.state.stats.subscribersCount.toLocaleString();
        if (chaptersElement) chaptersElement.textContent = this.state.stats.chaptersCount.toLocaleString();
    }

    renderNovels() {
        const container = document.querySelector('.novels-list');
        const emptyState = document.querySelector('[data-section="novels"] .empty-state');
        const template = document.getElementById('novel-card-template');

        if (!container || !template) return;

        if (!this.state.novels.length) {
            container.innerHTML = '';
            emptyState?.classList.add('visible');
            return;
        }

        emptyState?.classList.remove('visible');

        const fragment = document.createDocumentFragment();

        this.state.novels.forEach(novel => {
            const element = template.content.cloneNode(true);
            
            element.querySelector('.novel-title').textContent = novel.title;
            element.querySelector('.chapters-count').textContent = `${novel.chapters_count} глав`;
            element.querySelector('.subscribers-count').textContent = `${novel.subscribers_count} подписчиков`;

            // Добавляем обработчики
            const card = element.querySelector('.novel-card');
            const actionBtn = element.querySelector('.action-button');

            card.dataset.novelId = novel.id;
            card.addEventListener('click', (e) => {
                if (e.target !== actionBtn) {
                    window.location.href = `/novel.html?id=${novel.id}`;
                }
            });

            actionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleNovelAction(novel);
            });

            fragment.appendChild(element);
        });

        container.innerHTML = '';
        container.appendChild(fragment);
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

            this.state.activeTab = section;
        }
    }

    handleAddNovel() {
        this.telegram.HapticFeedback.impactOccurred('medium');
        
        // Показываем форму добавления новеллы
        this.telegram.showPopup({
            title: 'Новая новелла',
            message: 'Начать добавление новой новеллы?',
            buttons: [
                {id: 'add', type: 'default', text: 'Добавить'},
                {id: 'cancel', type: 'cancel'}
            ]
        }, (buttonId) => {
            if (buttonId === 'add') {
                window.location.href = '/novel-edit.html';
            }
        });
    }

    handleNovelAction(novel) {
        this.telegram.HapticFeedback.impactOccurred('light');
        
        this.telegram.showPopup({
            title: 'Действия с новеллой',
            message: novel.title,
            buttons: [
                {id: 'add_chapter', type: 'default', text: 'Добавить главу'},
                {id: 'edit', type: 'default', text: 'Редактировать'},
                {id: 'delete', type: 'destructive', text: 'Удалить'},
                {id: 'cancel', type: 'cancel'}
            ]
        }, async (buttonId) => {
            switch (buttonId) {
                case 'add_chapter':
                    window.location.href = `/chapter-edit.html?novelId=${novel.id}`;
                    break;
                case 'edit':
                    window.location.href = `/novel-edit.html?id=${novel.id}`;
                    break;
                case 'delete':
                    await this.confirmNovelDeletion(novel);
                    break;
            }
        });
    }

    async confirmNovelDeletion(novel) {
        this.telegram.HapticFeedback.impactOccurred('medium');
        
        this.telegram.showPopup({
            title: 'Удаление новеллы',
            message: `Вы уверены, что хотите удалить новеллу "${novel.title}"? Это действие нельзя отменить.`,
            buttons: [
                {id: 'delete', type: 'destructive', text: 'Удалить'},
                {id: 'cancel', type: 'cancel'}
            ]
        }, async (buttonId) => {
            if (buttonId === 'delete') {
                try {
                    await api.deleteNovel(novel.id);
                    this.telegram.HapticFeedback.notificationOccurred('success');
                    await this.loadData(); // Перезагружаем данные
                } catch (error) {
                    console.error('Error deleting novel:', error);
                    this.showError('Не удалось удалить новеллу');
                }
            }
        });
    }

    handleBackClick() {
        this.telegram.HapticFeedback.impactOccurred('light');
        window.location.href = '/';
    }

    toggleLoading(show) {
        const loader = document.querySelector('.loading-indicator');
        if (loader) {
            loader.style.display = show ? 'block' : 'none';
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
}

// Создаем и инициализируем страницу
document.addEventListener('DOMContentLoaded', () => {
    try {
        const page = new TranslatorPage();
        page.init();
        
        // Делаем доступным глобально для отладки
        window.translatorPage = page;
    } catch (error) {
        console.error('Failed to initialize translator page:', error);
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Не удалось загрузить страницу',
                buttons: [{type: 'close'}]
            });
        }
    }
});

export default TranslatorPage;

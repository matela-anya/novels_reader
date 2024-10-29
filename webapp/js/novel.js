document.addEventListener('DOMContentLoaded', function() {
    // Инициализация Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
        let tg = window.Telegram.WebApp;
        
        tg.ready();
        tg.expand();

        // Применяем тему Telegram
        document.documentElement.className = tg.colorScheme;
    }

    // Обработка кнопки "Закладка"
    const bookmarkButton = document.querySelector('.bookmark');
    if (bookmarkButton) {
        bookmarkButton.addEventListener('click', function() {
            this.classList.toggle('active');
        });
    }

    // Обработка фильтров
    const filterButton = document.querySelector('.filter-button');
    if (filterButton) {
        filterButton.addEventListener('click', function() {
            // Здесь будет логика открытия фильтров
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.showPopup({
                    title: 'Фильтры',
                    message: 'Функция фильтрации будет доступна позже',
                    buttons: [{text: 'OK', type: 'ok'}]
                });
            }
        });
    }

    // Обработка сортировки
    const sortButton = document.querySelector('.sort-button');
    if (sortButton) {
        sortButton.addEventListener('click', function() {
            // Здесь будет логика сортировки
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.showPopup({
                    title: 'Сортировка',
                    message: 'Функция сортировки будет доступна позже',
                    buttons: [{text: 'OK', type: 'ok'}]
                });
            }
        });
    }

    // Загрузка дополнительных глав
    const loadMoreButton = document.querySelector('.load-more');
    if (loadMoreButton) {
        loadMoreButton.addEventListener('click', function() {
            // Здесь будет логика загрузки дополнительных глав
            this.textContent = 'Загрузка...';
            setTimeout(() => {
                this.textContent = 'Загрузить еще';
            }, 1000);
        });
    }

    // Отправка комментария
    const commentForm = document.querySelector('.comment-form');
    const commentInput = document.querySelector('.comment-input');
    
    if (commentForm) {
        commentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (commentInput && commentInput.value.trim()) {
                // Здесь будет логика отправки комментария
                commentInput.value = '';
            }
        });
    }
});

// Объект для обработки формы
const FormHandler = {
    errorMessages: {
        translatorName: {
            valueMissing: 'Пожалуйста, введите имя переводчика',
            tooShort: 'Имя должно содержать минимум 2 символа',
            patternMismatch: 'Имя может содержать только буквы, цифры, пробелы и дефис'
        },
        description: {
            valueMissing: 'Пожалуйста, добавьте описание',
            tooShort: 'Описание должно содержать минимум 50 символов'
        },
        telegram: {
            patternMismatch: 'Неверный формат username Telegram'
        }
    },

    validateField(field) {
        const errorElement = document.querySelector(`[data-error="${field.name}"]`);
        field.classList.remove('error', 'valid');
        errorElement.classList.remove('visible');

        if (!field.checkValidity()) {
            field.classList.add('error');
            for (const type in this.errorMessages[field.name]) {
                if (field.validity[type]) {
                    errorElement.textContent = this.errorMessages[field.name][type];
                    errorElement.classList.add('visible');
                    break;
                }
            }
            return false;
        } else {
            field.classList.add('valid');
            return true;
        }
    },

    updateCharacterCount(field) {
        const counter = field.closest('.form-group').querySelector('.character-counter');
        if (counter) {
            const current = field.value.length;
            const max = field.maxLength;
            counter.textContent = `${current}/${max}`;
            counter.classList.toggle('limit', current >= max);
        }
    },

    async submitForm(formData) {
        try {
            // Показываем индикатор загрузки
            document.body.style.cursor = 'wait';
            
            // Имитация отправки на сервер
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Очищаем сохраненные данные
            localStorage.removeItem('translatorFormData');

            // Закрываем модальное окно
            document.getElementById('translatorModal').classList.remove('visible');
            document.body.style.overflow = '';

            // Уведомляем пользователя
            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.showPopup({
                    title: 'Успешно!',
                    message: 'Вы стали переводчиком',
                    buttons: [{type: 'ok'}]
                });
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.showPopup({
                    title: 'Ошибка',
                    message: 'Не удалось отправить форму. Попробуйте позже.',
                    buttons: [{type: 'ok'}]
                });
            }
        } finally {
            document.body.style.cursor = '';
        }
    }
};

// Объект для работы с аватаром
const AvatarHandler = {
    maxSize: 1024 * 1024, // 1MB

    async processFile(file) {
        // Проверка типа файла
        if (!file.type.startsWith('image/')) {
            throw new Error('Пожалуйста, выберите изображение');
        }

        // Проверка размера
        if (file.size > this.maxSize) {
            throw new Error('Размер файла не должен превышать 1MB');
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    removeAvatar() {
        const preview = document.getElementById('avatarPreview');
        preview.src = '/api/placeholder/80/80';
        
        // Очищаем input файла
        const input = document.getElementById('avatarInput');
        if (input) {
            input.value = '';
        }
    }
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация Telegram WebApp
    if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        
        // Инициализация веб-приложения
        tg.ready();
        tg.expand();

        // Применяем тему Telegram
        document.documentElement.setAttribute('data-theme', tg.colorScheme);

        // Применяем цвета из Telegram
        if (tg.themeParams) {
            document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color);
            document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color);
            document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color);
            document.documentElement.style.setProperty('--tg-theme-link-color', tg.themeParams.link_color);
            document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color);
            document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color);
            document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', tg.themeParams.secondary_bg_color);
        }
    } else {
        // Fallback для тестирования вне Telegram
        document.documentElement.setAttribute('data-theme', 'light');
    }

    // Инициализация модального окна
    const modal = {
        overlay: document.getElementById('translatorModal'),
        openButton: document.querySelector('.become-translator'),
        closeButton: document.querySelector('.modal-close'),
        
        init() {
            if (this.openButton) {
                this.openButton.addEventListener('click', () => this.open());
            }
            if (this.closeButton) {
                this.closeButton.addEventListener('click', () => this.close());
            }
            if (this.overlay) {
                this.overlay.addEventListener('click', (e) => {
                    if (e.target === this.overlay) {
                        this.close();
                    }
                });
            }
        },

        open() {
            this.overlay.classList.add('visible');
            document.body.style.overflow = 'hidden';
        },

        close() {
            this.overlay.classList.remove('visible');
            document.body.style.overflow = '';
        }
    };

    // Инициализация формы
    const form = {
        element: document.getElementById('translatorForm'),
        avatarInput: document.getElementById('avatarInput'),
        removeAvatarButton: document.getElementById('removeAvatar'),
        
        init() {
            if (this.element) {
                this.initInputs();
                this.initAvatarHandling();
                this.element.addEventListener('submit', (e) => this.handleSubmit(e));
            }
        },

        initInputs() {
            this.element.querySelectorAll('.form-input').forEach(input => {
                // Обработка ввода
                input.addEventListener('input', () => {
                    FormHandler.validateField(input);
                    FormHandler.updateCharacterCount(input);
                });

                // Валидация при потере фокуса
                input.addEventListener('blur', () => {
                    FormHandler.validateField(input);
                });

                // Инициализация счетчика символов
                if (input.maxLength) {
                    FormHandler.updateCharacterCount(input);
                }
            });
        },

        initAvatarHandling() {
            if (this.avatarInput) {
                this.avatarInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    try {
                        const imageUrl = await AvatarHandler.processFile(file);
                        document.getElementById('avatarPreview').src = imageUrl;
                    } catch (error) {
                        if (window.Telegram?.WebApp) {
                            window.Telegram.WebApp.showPopup({
                                title: 'Ошибка',
                                message: error.message,
                                buttons: [{type: 'ok'}]
                            });
                        }
                    }
                });
            }

            if (this.removeAvatarButton) {
                this.removeAvatarButton.addEventListener('click', () => {
                    AvatarHandler.removeAvatar();
                });
            }
        },

        async handleSubmit(e) {
            e.preventDefault();
            
            // Проверяем валидность всех обязательных полей
            let isValid = true;
            this.element.querySelectorAll('.form-input[required]').forEach(field => {
                if (!FormHandler.validateField(field)) {
                    isValid = false;
                }
            });

            if (!isValid) return;

            // Отправляем форму
            const formData = new FormData(this.element);
            await FormHandler.submitForm(formData);
        }
    };

    // Инициализация всех компонентов
    modal.init();
    form.init();
});

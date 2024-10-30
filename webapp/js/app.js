// Инициализация Telegram WebApp
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем, доступен ли объект Telegram
    if (window.Telegram && window.Telegram.WebApp) {
        let tg = window.Telegram.WebApp;
        
        // Инициализация веб-приложения
        tg.ready();
        tg.expand();

        // Применяем тему Telegram
        document.documentElement.className = tg.colorScheme;

        // Настраиваем основной цвет для кнопок и активных элементов
        if (tg.themeParams && tg.themeParams.button_color) {
            document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color);
        }
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
        
        init() {
            if (this.element) {
                this.initInputs();
                this.initAvatarUpload();
                this.element.addEventListener('submit', (e) => this.handleSubmit(e));
            }
        },

        initInputs() {
            this.element.querySelectorAll('.form-input').forEach(input => {
                input.addEventListener('input', () => {
                    FormHandler.validateField(input);
                    FormHandler.updateCharacterCount(input);
                });

                input.addEventListener('blur', () => {
                    FormHandler.validateField(input);
                });
            });
        },

        initAvatarUpload() {
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
        },

        async handleSubmit(e) {
            e.preventDefault();
            
            let isValid = true;
            this.element.querySelectorAll('.form-input[required]').forEach(field => {
                if (!FormHandler.validateField(field)) {
                    isValid = false;
                }
            });

            if (!isValid) return;

            const formData = new FormData(this.element);
            await FormHandler.submitForm(formData);
        }
    };

    // Инициализация всех компонентов
    modal.init();
    form.init();
});

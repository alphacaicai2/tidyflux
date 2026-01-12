import { createDialog } from './utils.js';
import { i18n } from '../i18n.js';

/**
 * Custom Modal Dialogs replacing native alert/confirm/prompt
 */
export class Modal {
    /**
     * Show an alert dialog
     * @param {string} message 
     * @param {string} [title] 
     * @returns {Promise<void>}
     */
    static alert(message, title = '') {
        return new Promise((resolve) => {
            const { dialog, close } = createDialog('custom-modal-dialog', `
                <div class="custom-modal-content">
                    ${title ? `<div class="custom-modal-header">${title}</div>` : ''}
                    <div class="custom-modal-body"><p>${message}</p></div>
                    <div class="custom-modal-footer">
                        <button class="appearance-mode-btn active ok-btn" style="padding: 8px 20px;">${i18n.t('common.ok') || 'OK'}</button>
                    </div>
                </div>
            `);

            const okBtn = dialog.querySelector('.ok-btn');
            const handleClose = () => {
                close();
                resolve();
            };

            okBtn.addEventListener('click', handleClose);



            const keyHandler = (e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    handleClose();
                    document.removeEventListener('keydown', keyHandler);
                }
            };
            document.addEventListener('keydown', keyHandler);


        });
    }

    /**
     * Show an alert dialog with a "Go to Settings" button
     * @param {string} message 
     * @param {string} settingsLabel
     * @param {Function} onSettings
     * @param {string} [title] 
     * @returns {Promise<void>}
     */
    static alertWithSettings(message, settingsLabel, onSettings, title = '') {
        return new Promise((resolve) => {
            const { dialog, close } = createDialog('custom-modal-dialog', `
                <div class="custom-modal-content">
                    ${title ? `<div class="custom-modal-header">${title}</div>` : ''}
                    <div class="custom-modal-body"><p>${message}</p></div>
                    <div class="custom-modal-footer">
                        <button class="appearance-mode-btn settings-btn" style="margin-right: 8px;">${settingsLabel}</button>
                        <button class="appearance-mode-btn active ok-btn" style="padding: 8px 20px;">${i18n.t('common.ok') || 'OK'}</button>
                    </div>
                </div>
            `);

            const okBtn = dialog.querySelector('.ok-btn');
            const settingsBtn = dialog.querySelector('.settings-btn');

            const handleClose = () => {
                close();
                resolve();
            };

            okBtn.addEventListener('click', handleClose);

            settingsBtn.addEventListener('click', () => {
                close();
                resolve();
                if (onSettings) onSettings();
            });

            const keyHandler = (e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    handleClose();
                    document.removeEventListener('keydown', keyHandler);
                }
            };
            document.addEventListener('keydown', keyHandler);
        });
    }

    /**
     * Show a confirm dialog
     * @param {string} message 
     * @param {string} [title] 
     * @returns {Promise<boolean>}
     */
    static confirm(message, title = '') {
        return new Promise((resolve) => {
            let resolved = false;
            const { dialog, close } = createDialog('custom-modal-dialog', `
                <div class="custom-modal-content">
                    ${title ? `<div class="custom-modal-header">${title}</div>` : ''}
                    <div class="custom-modal-body"><p>${message}</p></div>
                    <div class="custom-modal-footer">
                        <button class="appearance-mode-btn cancel-btn">${i18n.t('common.cancel') || 'Cancel'}</button>
                        <button class="appearance-mode-btn active confirm-btn" style="background: var(--accent-color); color: white;">${i18n.t('common.confirm') || 'Confirm'}</button>
                    </div>
                </div>
            `);

            const confirmBtn = dialog.querySelector('.confirm-btn');
            const cancelBtn = dialog.querySelector('.cancel-btn');

            const finalize = (result) => {
                if (resolved) return;
                resolved = true;
                close();
                resolve(result);
            };

            confirmBtn.addEventListener('click', () => finalize(true));
            cancelBtn.addEventListener('click', () => finalize(false));

            // Handle Esc -> Cancel
            const keyHandler = (e) => {
                if (resolved) return;
                if (e.key === 'Escape') {
                    finalize(false);
                } else if (e.key === 'Enter') {
                    finalize(true);
                }
            };
            document.addEventListener('keydown', keyHandler);

            // If the user clicks outside (handled by createDialog), we need to detect it.
            // We can add a click listener to the dialog wrapper (background) passed by createDialog.
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    finalize(false);
                }
            });
        });
    }

    /**
     * Show a prompt dialog
     * @param {string} message 
     * @param {string} [defaultValue] 
     * @param {string} [title] 
     * @returns {Promise<string|null>} null if cancelled
     */
    static prompt(message, defaultValue = '', title = '') {
        return new Promise((resolve) => {
            let resolved = false;
            const { dialog, close } = createDialog('custom-modal-dialog', `
                <div class="custom-modal-content">
                    ${title ? `<div class="custom-modal-header">${title}</div>` : ''}
                    <div class="custom-modal-body">
                        <p>${message}</p>
                        <input type="text" class="custom-modal-input" value="${defaultValue}" />
                    </div>
                    <div class="custom-modal-footer">
                        <button class="appearance-mode-btn cancel-btn">${i18n.t('common.cancel') || 'Cancel'}</button>
                        <button class="appearance-mode-btn active confirm-btn" style="background: var(--accent-color); color: white;">${i18n.t('common.confirm') || 'OK'}</button>
                    </div>
                </div>
            `);

            const input = dialog.querySelector('input');
            const confirmBtn = dialog.querySelector('.confirm-btn');
            const cancelBtn = dialog.querySelector('.cancel-btn');

            input.select();
            input.focus();

            const finalize = (result) => {
                if (resolved) return;
                resolved = true;
                close();
                resolve(result);
            };

            confirmBtn.addEventListener('click', () => finalize(input.value));
            cancelBtn.addEventListener('click', () => finalize(null));


            // Use keyup or keydown? keydown is better but ensure we don't capture global shortcuts unwantedly.
            // We attach to input specifically for Enter? No, dialog-wide.
            dialog.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finalize(input.value);
            });
            // Global escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') finalize(null);
            });

            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    finalize(null);
                }
            });
        });
    }
}

/**
 * Custom Select Component
 */
export class CustomSelect {
    /**
     * @param {HTMLSelectElement} selectElement 
     */
    constructor(selectElement) {
        if (!selectElement || selectElement.tagName !== 'SELECT') return;
        if (selectElement.dataset.customSelectInitialized) return;

        this.nativeSelect = selectElement;
        this.init();
    }

    init() {
        // Create Wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'custom-select-wrapper';
        this.nativeSelect.parentNode.insertBefore(this.wrapper, this.nativeSelect);
        this.wrapper.appendChild(this.nativeSelect);



        // Create Trigger
        this.trigger = document.createElement('div');
        this.trigger.className = 'custom-select-trigger';
        // Add tabindex for keyboard focus
        this.trigger.setAttribute('tabindex', '0');
        this.wrapper.appendChild(this.trigger);

        // Create Options List
        this.optionsList = document.createElement('div');
        this.optionsList.className = 'custom-select-options';
        this.wrapper.appendChild(this.optionsList);

        // Populate
        this.refresh();

        // Bind Events
        this.nativeSelect.addEventListener('change', () => this.refreshTrigger());


        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent closing immediately
            this.toggle();
        });

        this.trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            }
        });

        // Close when clicking outside
        this.clickOutsideHandler = (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.close();
            }
        };
        document.addEventListener('click', this.clickOutsideHandler);

        this.nativeSelect.dataset.customSelectInitialized = 'true';
    }

    refresh() {
        // Clear options
        this.optionsList.innerHTML = '';
        const options = Array.from(this.nativeSelect.options);

        options.forEach(opt => {
            const el = document.createElement('div');
            el.className = 'custom-select-option';
            if (opt.selected) el.classList.add('selected');
            el.textContent = opt.textContent;
            el.dataset.value = opt.value;

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.select(opt.value);
            });

            this.optionsList.appendChild(el);
        });

        this.refreshTrigger();
    }

    refreshTrigger() {
        const selected = this.nativeSelect.options[this.nativeSelect.selectedIndex];
        const text = selected ? selected.textContent : '';
        this.trigger.innerHTML = `
            <span>${text}</span>
            <div class="custom-select-arrow"></div>
        `;

        // Update selection in options list
        const optionEls = this.optionsList.querySelectorAll('.custom-select-option');
        optionEls.forEach(el => {
            if (el.dataset.value === (selected ? selected.value : '')) {
                el.classList.add('selected');
            } else {
                el.classList.remove('selected');
            }
        });
    }

    select(value) {
        this.nativeSelect.value = value;
        this.nativeSelect.dispatchEvent(new Event('change'));
        this.close();
    }

    toggle() {
        if (this.wrapper.classList.contains('open')) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        // Close other custom selects
        document.querySelectorAll('.custom-select-wrapper.open').forEach(el => el.classList.remove('open'));
        this.wrapper.classList.add('open');
        this.trigger.classList.add('open');
    }

    close() {
        this.wrapper.classList.remove('open');
        this.trigger.classList.remove('open');
    }

    /**
     * Replace all selects in a container
     * @param {HTMLElement} container 
     */
    static replaceAll(container) {
        const selects = container.querySelectorAll('select');
        selects.forEach(s => new CustomSelect(s));
    }
}

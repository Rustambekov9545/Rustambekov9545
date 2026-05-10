(function () {
    var EMAIL_DOMAIN_OPTIONS = [
        'mail.ru', 'yandex.ru', 'gmail.com', 'rambler.ru', 'bk.ru',
        'inbox.ru', 'list.ru', 'internet.ru', 'ya.ru', 'outlook.com',
        'hotmail.com', 'icloud.com', 'proton.me', 'yahoo.com'
    ];
    var TIME_OPTIONS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
    var DAY_OPTIONS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    var PAGE_STORAGE_KEY = 'emailSettingsState';
    var PASSWORD_STORAGE_KEY = 'emailSettingsPasswordsByEmail';
    var STORAGE_RESET_KEY = 'emailSettingsResetVersion';
    var STORAGE_RESET_VERSION = 'clear-added-data-2026-05-06';
    var DEFAULT_SEED_STATE = {
        quantity: '',
        emails: [
            { email: 'assadsa@mail.ru', password: 'assadsa123' },
            { email: 'asd@yandex.ru', password: 'yandex123' }
        ],
        events: [
            {
                number: '1',
                title: 'asdas',
                eventEmail: 'assadsa@mail.ru',
                time: '09:00',
                day: 'Вторник',
                director: 'wad@bk.ru',
                duplicateManager: false,
                duplicateDirector: true,
                editing: false
            },
            {
                number: '2',
                title: 'aadygasi',
                eventEmail: 'assadsa@mail.ru',
                time: '08:00',
                day: 'Вторник',
                director: 'asd@yandex.ru',
                duplicateManager: false,
                duplicateDirector: false,
                editing: false
            }
        ]
    };

    var state = {
        emails: [],
        events: [],
        quantity: ''
    };

    var activeSelect = null;
    var activeSuggest = null;
    var firefoxTextZoomProbe = null;
    var firefoxTextZoomProbeEm = null;
    var firefoxTextZoomProbePx = null;
    var firefoxTextZoomProbeGlyph = null;
    var firefoxTextZoomMeasureCanvas = null;
    var firefoxLastAppliedRatio = 1;
    var firefoxBaseLayoutWidth = 0;
    var firefoxBaseDesignUnit = 0;
    var firefoxLastFrozenUnitPx = 0;
    var firefoxLastFrozenUnitCss = '';
    var firefoxLastExtraMailSpacePx = 0;
    var firefoxLastDefaultZoomRatio = 1;
    var firefoxBaseDevicePixelRatio = 0;
    var firefoxLastCaretInverseCss = '1';
    var firefoxTextOnlyHintUntil = 0;
    var firefoxTextOnlyActive = false;
    var firefoxTextOnlyOffStableCount = 0;
    var firefoxDefaultZoomSettlingUntil = 0;
    var pageBottomLayoutRaf = 0;
    var zoomFreezeTimer = 0;

    document.addEventListener('DOMContentLoaded', function () {
        if (typeof renderStaticIcons === 'function') {
            renderStaticIcons(document.querySelector('.settings-canvas') || document);
        }

        resetStoredStateIfNeeded();
        collectInitialState();
        savePageState();
        bindEmailSettingsNav();
        bindStaticControls();
        bindDefaultZoomCompensation();
        bindFirefoxTextZoomCompensation();
        renderAll();
        updateTopButtons();
        syncPasswordStorage();
    });

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeEmail(value) {
        return String(value || '').trim().toLowerCase();
    }

    function isFullEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
    }

    function getNodeTextWithoutControls(node) {
        if (!node) return '';
        var clone = node.cloneNode(true);
        Array.prototype.forEach.call(clone.querySelectorAll('.es-inline-x, .es-caret, .es-icon-layer'), function (el) {
            el.remove();
        });
        return clone.textContent.trim();
    }

    function getFieldText(field) {
        if (!field) return '';
        var valueNode = field.querySelector('.es-select-value');
        if (valueNode) return valueNode.textContent.trim();
        var input = field.querySelector('input');
        if (input) return input.value.trim();
        return getNodeTextWithoutControls(field);
    }

    function getSelectOptions(role) {
        if (role === 'event-email' || role === 'card-email') {
            return state.emails.map(function (item) { return item.email; });
        }
        if (role === 'time') return TIME_OPTIONS.slice();
        if (role === 'day') return DAY_OPTIONS.slice();
        return [];
    }

    function resetStoredStateIfNeeded() {
        try {
            if (window.localStorage.getItem(STORAGE_RESET_KEY) === STORAGE_RESET_VERSION) return;
            window.localStorage.setItem(PAGE_STORAGE_KEY, JSON.stringify({
                version: 1,
                quantity: '',
                emails: [],
                events: []
            }));
            window.localStorage.setItem(PASSWORD_STORAGE_KEY, '{}');
            window.localStorage.setItem(STORAGE_RESET_KEY, STORAGE_RESET_VERSION);
        } catch (error) {
            window.emailSettingsState = {
                version: 1,
                quantity: '',
                emails: [],
                events: []
            };
        }
    }

    function collectInitialState() {
        var storedState = loadStoredPageState();
        if (storedState) {
            state.emails = storedState.emails;
            state.events = storedState.events;
            state.quantity = storedState.quantity;
            applySeedStateIfEmpty();
            return;
        }

        var storedPasswords = loadStoredPasswords();
        state.emails = [];

        Array.prototype.forEach.call(document.querySelectorAll('.es-mail-item'), function (item) {
            var emailNode = item.querySelector('.es-mail-link');
            var email = emailNode ? emailNode.textContent.trim() : '';
            if (!email || state.emails.some(function (entry) { return normalizeEmail(entry.email) === normalizeEmail(email); })) return;
            state.emails.push({ email: email, password: storedPasswords[normalizeEmail(email)] || '' });
        });

        var qtyInput = document.getElementById('emailQtyInput');
        var qtyValueNode = document.querySelector('.es-qty-value');
        state.quantity = sanitizeQuantity(qtyInput ? qtyInput.value : (qtyValueNode ? qtyValueNode.textContent : ''));

        state.events = [];
        Array.prototype.forEach.call(document.querySelectorAll('.es-card'), function (card, index) {
            var fields = card.querySelectorAll('.es-card-grid .es-card-input');
            var checks = card.querySelectorAll('.es-card-footer .check-input');
            var numberMatch = (card.querySelector('.es-card-title') ? card.querySelector('.es-card-title').textContent : '').match(/\d+/);
            var director = getFieldText(fields[4]);
            if (director.indexOf('...') !== -1 && index === 2) director = 'zaharov.1053@yandex.ru';

            state.events.push({
                number: numberMatch ? numberMatch[0] : String(index + 1),
                title: getFieldText(fields[0]),
                eventEmail: getFieldText(fields[1]),
                time: getFieldText(fields[2]),
                day: getFieldText(fields[3]),
                director: director,
                duplicateManager: Boolean(checks[0] && checks[0].checked),
                duplicateDirector: Boolean(checks[1] && checks[1].checked),
                editing: Boolean(card.querySelector('.es-select-field')) || card.classList.contains('is-editing')
            });
        });

        applySeedStateIfEmpty();
    }

    function cloneSeedState() {
        return {
            quantity: sanitizeQuantity(DEFAULT_SEED_STATE.quantity || ''),
            emails: DEFAULT_SEED_STATE.emails.map(function (item) {
                return {
                    email: String(item.email || '').trim(),
                    password: String(item.password || '')
                };
            }).filter(function (item) {
                return item.email;
            }),
            events: DEFAULT_SEED_STATE.events.map(normalizeSavedEvent)
        };
    }

    function applySeedStateIfEmpty() {
        if (state.emails.length || state.events.length) return;
        var seed = cloneSeedState();
        state.emails = seed.emails;
        state.events = seed.events;
        state.quantity = seed.quantity;
    }

    function loadStoredPageState() {
        try {
            var raw = JSON.parse(window.localStorage.getItem(PAGE_STORAGE_KEY) || 'null');
            if (!raw || !Array.isArray(raw.emails) || !Array.isArray(raw.events)) return null;

            var storedPasswords = loadStoredPasswords();
            return {
                emails: raw.emails.map(function (item) {
                    var email = typeof item === 'string' ? item : item.email;
                    return {
                        email: String(email || '').trim(),
                        password: String((item && item.password) || storedPasswords[normalizeEmail(email)] || '')
                    };
                }).filter(function (item, index, list) {
                    return item.email && list.findIndex(function (entry) {
                        return normalizeEmail(entry.email) === normalizeEmail(item.email);
                    }) === index;
                }),
                events: raw.events.map(normalizeSavedEvent),
                quantity: sanitizeQuantity(raw.quantity || '')
            };
        } catch (error) {
            return null;
        }
    }

    function normalizeSavedEvent(item, index) {
        item = item || {};
        return {
            number: String(item.number || index + 1),
            title: String(item.title || ''),
            eventEmail: String(item.eventEmail || ''),
            time: String(item.time || ''),
            day: String(item.day || ''),
            director: String(item.director || ''),
            duplicateManager: Boolean(item.duplicateManager),
            duplicateDirector: Boolean(item.duplicateDirector),
            editing: Boolean(item.editing)
        };
    }

    function savePageState() {
        var data = {
            version: 1,
            quantity: state.quantity || '',
            emails: state.emails.map(function (item) {
                return {
                    email: item.email || '',
                    password: item.password || ''
                };
            }),
            events: state.events.map(function (item, index) {
                return normalizeSavedEvent(item, index);
            })
        };

        try {
            window.localStorage.setItem(PAGE_STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            window.emailSettingsState = data;
        }
    }

    function loadStoredPasswords() {
        try {
            return JSON.parse(window.localStorage.getItem(PASSWORD_STORAGE_KEY) || '{}') || {};
        } catch (error) {
            return {};
        }
    }

    function syncPasswordStorage() {
        var map = {};
        state.emails.forEach(function (item) {
            map[normalizeEmail(item.email)] = item.password || '';
        });
        try {
            window.localStorage.setItem(PASSWORD_STORAGE_KEY, JSON.stringify(map));
        } catch (error) {
            window.emailSettingsPasswordsByEmail = map;
        }
        window.emailSettingsPasswordsByEmail = map;
    }

    function bindEmailSettingsNav() {
        var canvas = document.querySelector('.settings-canvas');
        document.querySelectorAll('.topbar .nav-link').forEach(function (link) {
            link.addEventListener('click', function (event) {
                var tab = link.getAttribute('data-tab');
                var href = String(link.getAttribute('href') || '').trim();
                var isRealNavigation = href && href !== '#';
                if (tab === 'settings') {
                    document.body.classList.remove('is-blank-tab');
                    return;
                }
                if (isRealNavigation) {
                    document.body.classList.remove('is-blank-tab');
                    return;
                }

                event.preventDefault();
                document.querySelectorAll('.topbar .nav-link').forEach(function (item) {
                    item.classList.toggle('active', item === link);
                    if (typeof renderNavIcon === 'function') renderNavIcon(item);
                    if (typeof renderNavText === 'function') renderNavText(item);
                });
                document.body.classList.add('is-blank-tab');
                if (canvas) canvas.setAttribute('aria-hidden', 'true');
            });
        });
    }

    function bindStaticControls() {
        var emailInput = document.getElementById('emailInput');
        var passwordInput = document.getElementById('emailPasswordInput');
        var qtyInput = document.getElementById('emailQtyInput');
        var eventName = document.getElementById('eventNameInput');
        var directorInput = document.getElementById('eventDirectorInput');
        var emailAddBtn = document.getElementById('emailAddBtn');
        var eventAddBtn = document.getElementById('eventAddBtn');

        protectTopCredentialInputs(emailInput, passwordInput);

        [emailInput, passwordInput].forEach(function (input) {
            if (!input) return;
            input.addEventListener('input', updateEmailAddButton);
            input.addEventListener('paste', function () { window.setTimeout(updateEmailAddButton, 0); });
        });

        if (emailInput) bindDomainSuggestInput(emailInput, function () { updateEmailAddButton(); });
        if (directorInput) bindDomainSuggestInput(directorInput, function () { updateEventAddButton(); });

        if (emailAddBtn) {
            emailAddBtn.addEventListener('click', function () {
                if (emailAddBtn.disabled) return;
                addEmailFromTop();
            });
        }

        if (qtyInput) {
            qtyInput.addEventListener('input', function () {
                qtyInput.value = sanitizeQuantity(qtyInput.value);
                state.quantity = qtyInput.value;
                savePageState();
                renderQuantityClear();
            });
            qtyInput.addEventListener('paste', function () {
                window.setTimeout(function () {
                    qtyInput.value = sanitizeQuantity(qtyInput.value);
                    state.quantity = qtyInput.value;
                    savePageState();
                    renderQuantityClear();
                }, 0);
            });
        }

        if (eventName) eventName.addEventListener('input', updateEventAddButton);
        if (directorInput) directorInput.addEventListener('input', updateEventAddButton);

        if (eventAddBtn) {
            eventAddBtn.addEventListener('click', function () {
                if (eventAddBtn.disabled) return;
                addEventFromTop();
            });
        }

        document.addEventListener('click', handleDocumentClick);
        document.addEventListener('input', handleDocumentInput);
        document.addEventListener('change', handleDocumentChange);
        document.addEventListener('focusout', handleDocumentFocusOut);
        document.addEventListener('keydown', handleDocumentKeydown);
        document.addEventListener('mouseover', handleTooltipMouseOver);
        document.addEventListener('mouseout', handleTooltipMouseOut);
        document.addEventListener('focusin', handleTooltipFocusIn);
        window.addEventListener('resize', function () {
            closeFloatingMenus();
            schedulePageBottomLayout();
        });
        window.addEventListener('scroll', closeFloatingMenus, true);
    }

    function protectTopCredentialInputs(emailInput, passwordInput) {
        [emailInput, passwordInput].forEach(function (input) {
            if (!input) return;

            input.setAttribute('autocomplete', input === passwordInput ? 'new-password' : 'off');
            input.setAttribute('autocorrect', 'off');
            input.setAttribute('autocapitalize', 'none');
            input.setAttribute('spellcheck', 'false');
            input.setAttribute('data-lpignore', 'true');
            input.setAttribute('data-1p-ignore', 'true');
            input.setAttribute('data-form-type', 'other');
            input.setAttribute('readonly', 'readonly');

            var unlock = function () { input.removeAttribute('readonly'); };
            var relock = function () { input.setAttribute('readonly', 'readonly'); };

            input.addEventListener('pointerdown', unlock, { passive: true });
            input.addEventListener('focus', unlock);
            input.addEventListener('keydown', unlock);
            input.addEventListener('blur', relock);
        });
    }

    function bindFirefoxTextZoomCompensation() {
        if (!/firefox/i.test(navigator.userAgent || '')) return;
        var rafId = 0;
        var isDisposed = false;
        var pollTimer = 0;

        function scheduleCompensation() {
            if (isDisposed) return;
            if (rafId) return;
            rafId = window.requestAnimationFrame(function () {
                rafId = 0;
                applyFirefoxTextZoomCompensation();
            });
        }

        function onZoomHotkey(event) {
            if (!(event.ctrlKey || event.metaKey)) return;
            var key = String(event.key || '').toLowerCase();
            if (key !== '+' && key !== '=' && key !== '-' && key !== '_' && key !== '0') return;
            firefoxTextOnlyHintUntil = Date.now() + 700;
            markZoomFreeze();
            scheduleCompensation();
            window.requestAnimationFrame(scheduleCompensation);
        }

        function onWheel(event) {
            if (!(event.ctrlKey || event.metaKey)) return;
            firefoxTextOnlyHintUntil = Date.now() + 700;
            markZoomFreeze();
            scheduleCompensation();
            window.requestAnimationFrame(scheduleCompensation);
        }

        window.addEventListener('resize', scheduleCompensation);
        window.addEventListener('pageshow', scheduleCompensation);
        window.addEventListener('focus', scheduleCompensation);
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) return;
            scheduleCompensation();
        });
        document.addEventListener('keydown', onZoomHotkey, true);
        window.addEventListener('wheel', onWheel, { passive: true });
        if (document.fonts && typeof document.fonts.ready === 'object' && typeof document.fonts.ready.then === 'function') {
            document.fonts.ready.then(scheduleCompensation)['catch'](function () {});
        }

        window.addEventListener('beforeunload', function () {
            isDisposed = true;
            if (rafId) {
                window.cancelAnimationFrame(rafId);
                rafId = 0;
            }
            if (pollTimer) {
                window.clearInterval(pollTimer);
                pollTimer = 0;
            }
        });

        // "Zoom text only" can be changed from Firefox UI without key/wheel events.
        // Poll lightly so the page remains visually frozen without requiring refresh.
        pollTimer = window.setInterval(function () {
            if (isDisposed || document.hidden) return;
            scheduleCompensation();
        }, 50);

        scheduleCompensation();
    }

    function bindDefaultZoomCompensation() {
        var rafId = 0;
        var isDisposed = false;
        var pollTimer = 0;

        function applyFirefoxDefaultZoomNeutral(body, canvas) {
            var currentLayoutWidth = Number.isFinite(window.innerWidth) && window.innerWidth > 0
                ? window.innerWidth
                : (window.visualViewport && Number.isFinite(window.visualViewport.width) && window.visualViewport.width > 0
                    ? window.visualViewport.width
                    : (document.documentElement && document.documentElement.clientWidth
                        ? document.documentElement.clientWidth
                        : 0));
            var currentDpr = Number(window.devicePixelRatio);
            if (!firefoxBaseDevicePixelRatio && Number.isFinite(currentDpr) && currentDpr > 0) {
                firefoxBaseDevicePixelRatio = currentDpr;
            }
            if (!firefoxBaseLayoutWidth && currentLayoutWidth > 0) firefoxBaseLayoutWidth = currentLayoutWidth;
            if (!firefoxBaseDesignUnit && firefoxBaseLayoutWidth > 0) {
                firefoxBaseDesignUnit = firefoxBaseLayoutWidth / 1920;
            }
            var baseUnitPx = firefoxBaseDesignUnit;
            if (!Number.isFinite(baseUnitPx) || baseUnitPx <= 0) {
                baseUnitPx = currentLayoutWidth > 0 ? (currentLayoutWidth / 1920) : 0;
            }
            if (Number.isFinite(baseUnitPx) && baseUnitPx > 0) {
                var baseUnitCss = baseUnitPx.toFixed(4) + 'px';
                if (baseUnitCss !== firefoxLastFrozenUnitCss) {
                    document.documentElement.style.setProperty('--u', baseUnitCss);
                    body.style.setProperty('--u', baseUnitCss);
                    canvas.style.setProperty('--u', baseUnitCss);
                    firefoxLastFrozenUnitCss = baseUnitCss;
                }
                if (!firefoxLastFrozenUnitPx || Math.abs(firefoxLastFrozenUnitPx - baseUnitPx) > 0.0015) {
                    firefoxLastFrozenUnitPx = baseUnitPx;
                    updateMailListLayout();
                    schedulePageBottomLayout();
                }
            }

            body.style.setProperty('--es-default-zoom-inverse', '1');
            canvas.style.setProperty('--es-default-zoom-inverse', '1');
            body.style.setProperty('--es-caret-default-zoom-inverse', '1');
            canvas.style.setProperty('--es-caret-default-zoom-inverse', '1');
            firefoxLastCaretInverseCss = '1';
            firefoxLastDefaultZoomRatio = 1;
        }

        function isFirefoxTextOnlyZoomActive(currentLayoutWidth) {
            if (!/firefox/i.test(navigator.userAgent || '')) return false;
            if (Date.now() < firefoxTextOnlyHintUntil) return true;
            if (firefoxTextOnlyActive) return true;
            if (Math.abs(firefoxLastAppliedRatio - 1) > 0.015) return true;
            if (document.body && document.body.classList.contains('is-text-zoomed')) return true;
            // While default-zoom is settling, avoid false positives from text probes.
            if (Date.now() < firefoxDefaultZoomSettlingUntil) return false;

            var defaultZoomRatio = detectFirefoxDefaultZoomRatio(currentLayoutWidth || 0);
            if (Math.abs(defaultZoomRatio - 1) > 0.015) return false;

            var ratio = detectFirefoxTextZoomRatio();
            if (!Number.isFinite(ratio) || ratio <= 0) return false;
            ratio = snapFirefoxZoomRatio(ratio);
            return Math.abs(ratio - 1) > 0.02;
        }

        function applyDefaultZoomNow() {
            var body = document.body;
            var canvas = document.querySelector('.settings-canvas');
            if (!body || !canvas) return;
            var currentLayoutWidth = Number.isFinite(window.innerWidth) && window.innerWidth > 0
                ? window.innerWidth
                : (window.visualViewport && Number.isFinite(window.visualViewport.width) && window.visualViewport.width > 0
                    ? window.visualViewport.width
                    : (document.documentElement && document.documentElement.clientWidth
                        ? document.documentElement.clientWidth
                        : 0));
            if (isFirefoxTextOnlyZoomActive(currentLayoutWidth)) {
                applyFirefoxDefaultZoomNeutral(body, canvas);
                return;
            }
            applyFirefoxCaretDefaultZoomCompensation(body, canvas);
        }

        function scheduleDefaultZoomCompensation() {
            if (isDisposed) return;
            if (rafId) return;
            rafId = window.requestAnimationFrame(function () {
                rafId = 0;
                applyDefaultZoomNow();
            });
        }

        function onZoomHotkey(event) {
            if (!(event.ctrlKey || event.metaKey)) return;
            var key = String(event.key || '').toLowerCase();
            if (key !== '+' && key !== '=' && key !== '-' && key !== '_' && key !== '0') return;
            firefoxDefaultZoomSettlingUntil = Date.now() + 700;
            markZoomFreeze();
            scheduleDefaultZoomCompensation();
            window.requestAnimationFrame(scheduleDefaultZoomCompensation);
        }

        function onWheel(event) {
            if (!(event.ctrlKey || event.metaKey)) return;
            firefoxDefaultZoomSettlingUntil = Date.now() + 700;
            markZoomFreeze();
            scheduleDefaultZoomCompensation();
            window.requestAnimationFrame(scheduleDefaultZoomCompensation);
        }

        window.addEventListener('resize', scheduleDefaultZoomCompensation);
        window.addEventListener('pageshow', scheduleDefaultZoomCompensation);
        window.addEventListener('focus', scheduleDefaultZoomCompensation);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', scheduleDefaultZoomCompensation);
        }
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) return;
            scheduleDefaultZoomCompensation();
        });
        document.addEventListener('keydown', onZoomHotkey, true);
        window.addEventListener('wheel', onWheel, { passive: true });
        if (document.fonts && typeof document.fonts.ready === 'object' && typeof document.fonts.ready.then === 'function') {
            document.fonts.ready.then(scheduleDefaultZoomCompensation)['catch'](function () {});
        }

        window.addEventListener('beforeunload', function () {
            isDisposed = true;
            if (rafId) {
                window.cancelAnimationFrame(rafId);
                rafId = 0;
            }
            if (pollTimer) {
                window.clearInterval(pollTimer);
                pollTimer = 0;
            }
        });

        // Browser toolbar zoom buttons may not emit key/wheel reliably in all cases.
        pollTimer = window.setInterval(function () {
            if (isDisposed || document.hidden) return;
            scheduleDefaultZoomCompensation();
        }, 40);

        applyDefaultZoomNow();
        scheduleDefaultZoomCompensation();
    }

    function ensureFirefoxTextZoomProbe() {
        if (firefoxTextZoomProbe && firefoxTextZoomProbe.isConnected) return firefoxTextZoomProbe;
        if (!document.body) return null;
        var probe = document.createElement('div');
        var emProbe = document.createElement('div');
        var pxProbe = document.createElement('div');
        var glyphProbe = document.createElement('span');

        probe.setAttribute('aria-hidden', 'true');
        probe.style.position = 'fixed';
        probe.style.left = '-99999px';
        probe.style.top = '-99999px';
        probe.style.width = '1px';
        probe.style.height = '1px';
        probe.style.opacity = '0';
        probe.style.pointerEvents = 'none';
        probe.style.userSelect = 'none';
        probe.style.overflow = 'hidden';
        probe.style.zIndex = '-1';

        emProbe.style.display = 'block';
        emProbe.style.fontSize = '1px';
        emProbe.style.width = '200em';
        emProbe.style.height = '1px';
        emProbe.style.margin = '0';
        emProbe.style.padding = '0';
        emProbe.style.border = '0';

        pxProbe.style.display = 'block';
        pxProbe.style.fontSize = '1px';
        pxProbe.style.width = '200px';
        pxProbe.style.height = '1px';
        pxProbe.style.margin = '0';
        pxProbe.style.padding = '0';
        pxProbe.style.border = '0';

        glyphProbe.textContent = 'MMMMMMMMMM';
        glyphProbe.style.display = 'inline-block';
        glyphProbe.style.fontFamily = 'Arial, sans-serif';
        glyphProbe.style.fontSize = '100px';
        glyphProbe.style.fontWeight = '400';
        glyphProbe.style.fontStyle = 'normal';
        glyphProbe.style.lineHeight = '1';
        glyphProbe.style.whiteSpace = 'nowrap';
        glyphProbe.style.letterSpacing = '0';
        glyphProbe.style.margin = '0';
        glyphProbe.style.padding = '0';
        glyphProbe.style.border = '0';

        probe.appendChild(emProbe);
        probe.appendChild(pxProbe);
        probe.appendChild(glyphProbe);
        document.body.appendChild(probe);

        firefoxTextZoomProbe = probe;
        firefoxTextZoomProbeEm = emProbe;
        firefoxTextZoomProbePx = pxProbe;
        firefoxTextZoomProbeGlyph = glyphProbe;
        return probe;
    }

    function detectFirefoxTextZoomRatio() {
        ensureFirefoxTextZoomProbe();
        var candidates = [1];

        if (firefoxTextZoomProbeEm && firefoxTextZoomProbePx) {
            var emWidth = firefoxTextZoomProbeEm.getBoundingClientRect().width;
            var pxWidth = firefoxTextZoomProbePx.getBoundingClientRect().width;
            if (Number.isFinite(emWidth) && Number.isFinite(pxWidth) && emWidth > 0 && pxWidth > 0) {
                candidates.push(emWidth / pxWidth);
            }
        }

        if (firefoxTextZoomProbeGlyph) {
            var renderedGlyphWidth = firefoxTextZoomProbeGlyph.getBoundingClientRect().width;
            if (Number.isFinite(renderedGlyphWidth) && renderedGlyphWidth > 0) {
                if (!firefoxTextZoomMeasureCanvas) {
                    firefoxTextZoomMeasureCanvas = document.createElement('canvas');
                }
                var ctx = firefoxTextZoomMeasureCanvas.getContext('2d');
                if (ctx) {
                    ctx.font = '400 100px Arial, sans-serif';
                    var baseGlyphWidth = ctx.measureText(firefoxTextZoomProbeGlyph.textContent || 'MMMMMMMMMM').width;
                    if (Number.isFinite(baseGlyphWidth) && baseGlyphWidth > 0) {
                        candidates.push(renderedGlyphWidth / baseGlyphWidth);
                    }
                }
            }
        }

        var ratio = 1;
        candidates.forEach(function (candidate) {
            if (!Number.isFinite(candidate) || candidate <= 0) return;
            if (Math.abs(candidate - 1) > Math.abs(ratio - 1)) ratio = candidate;
        });

        if (!Number.isFinite(ratio) || ratio <= 0) return 1;
        return Math.max(0.2, Math.min(8, ratio));
    }

    function resetFirefoxTextZoomCompensation(body, canvas) {
        if (firefoxLastAppliedRatio === 1 && !body.classList.contains('is-text-zoomed')) return;
        body.classList.remove('is-text-zoomed');
        body.style.setProperty('--es-text-zoom-ratio', '1');
        body.style.setProperty('--es-text-zoom-inverse', '1');
        canvas.style.setProperty('--es-text-zoom-ratio', '1');
        canvas.style.setProperty('--es-text-zoom-inverse', '1');
        firefoxLastAppliedRatio = 1;
        firefoxTextOnlyActive = false;
        firefoxTextOnlyOffStableCount = 0;
    }

    function snapFirefoxZoomRatio(ratio) {
        if (!Number.isFinite(ratio) || ratio <= 0) return 1;
        var zoomSteps = [
            0.3, 0.5, 0.67, 0.8, 0.85, 0.9, 0.95, 1,
            1.05, 1.1, 1.2, 1.25, 1.33, 1.5, 1.7, 2,
            2.4, 3, 4, 5
        ];
        var nearest = ratio;
        var minDiff = Number.POSITIVE_INFINITY;
        for (var i = 0; i < zoomSteps.length; i += 1) {
            var diff = Math.abs(zoomSteps[i] - ratio);
            if (diff < minDiff) {
                minDiff = diff;
                nearest = zoomSteps[i];
            }
        }
        // Firefox Default zoom uses discrete steps. Always snap to the nearest
        // step to avoid micro-jitter between frames while zoom is unchanged.
        return nearest;
    }

    function detectFirefoxDefaultZoomRatio(currentLayoutWidth) {
        var ratioFromDpr = NaN;
        var currentDpr = Number(window.devicePixelRatio);
        if (Number.isFinite(currentDpr) && currentDpr > 0) {
            if (!firefoxBaseDevicePixelRatio) firefoxBaseDevicePixelRatio = currentDpr;
            if (firefoxBaseDevicePixelRatio > 0) {
                ratioFromDpr = currentDpr / firefoxBaseDevicePixelRatio;
            }
        }

        var ratioFromWidth = NaN;
        if (firefoxBaseLayoutWidth > 0 && currentLayoutWidth > 0) {
            ratioFromWidth = firefoxBaseLayoutWidth / currentLayoutWidth;
        }

        // Prefer DPR-based ratio: it is stable and independent from scrollbar/layout changes.
        var ratio = Number.isFinite(ratioFromDpr) && ratioFromDpr > 0 ? ratioFromDpr : ratioFromWidth;
        if (!Number.isFinite(ratio) || ratio <= 0) ratio = 1;

        ratio = Math.max(0.01, Math.min(100, ratio));
        ratio = snapFirefoxZoomRatio(ratio);

        // Additional hysteresis to suppress tiny floating oscillations.
        if (firefoxLastDefaultZoomRatio && Math.abs(ratio - firefoxLastDefaultZoomRatio) <= 0.035) {
            ratio = firefoxLastDefaultZoomRatio;
        }
        return Math.round(ratio * 1000) / 1000;
    }

    function markZoomFreeze() {
        var body = document.body;
        if (!body) return;
        body.classList.add('is-zooming');
        if (zoomFreezeTimer) window.clearTimeout(zoomFreezeTimer);
        zoomFreezeTimer = window.setTimeout(function () {
            zoomFreezeTimer = 0;
            if (!document.body) return;
            document.body.classList.remove('is-zooming');
            schedulePageBottomLayout();
        }, 360);
    }

    function applyFirefoxCaretDefaultZoomCompensation(body, canvas) {
        var unitChanged = false;
        var zoomChanged = false;
        // innerWidth includes scrollbar width and is more stable for zoom detection.
        // This avoids false zoom deltas when vertical scrollbar appears/disappears.
        var currentLayoutWidth = Number.isFinite(window.innerWidth) && window.innerWidth > 0
            ? window.innerWidth
            : (window.visualViewport && Number.isFinite(window.visualViewport.width) && window.visualViewport.width > 0
                ? window.visualViewport.width
                : (document.documentElement && document.documentElement.clientWidth
                    ? document.documentElement.clientWidth
                    : 0));
        if (Number.isFinite(currentLayoutWidth) && currentLayoutWidth > 0) {
            currentLayoutWidth = Math.round(currentLayoutWidth * 100) / 100;
        }
        if (!firefoxBaseLayoutWidth && currentLayoutWidth > 0) firefoxBaseLayoutWidth = currentLayoutWidth;
        if (!firefoxBaseDesignUnit && firefoxBaseLayoutWidth > 0) {
            firefoxBaseDesignUnit = firefoxBaseLayoutWidth / 1920;
        }

        var zoomRatio = detectFirefoxDefaultZoomRatio(currentLayoutWidth);

        var inverseRatio = 1 / zoomRatio;
        if (!Number.isFinite(inverseRatio) || inverseRatio <= 0) inverseRatio = 1;
        inverseRatio = Math.max(0.01, Math.min(100, inverseRatio));
        inverseRatio = Math.round(inverseRatio * 1000) / 1000;
        if (Math.abs(zoomRatio - 1) <= 0.01) inverseRatio = 1;
        zoomChanged = !firefoxLastDefaultZoomRatio || Math.abs(firefoxLastDefaultZoomRatio - zoomRatio) > 0.001;
        if (zoomChanged) {
            firefoxDefaultZoomSettlingUntil = Date.now() + 700;
            markZoomFreeze();
        }

        // Keep page layout stable by removing global transforms and freezing design unit against Default zoom.
        body.style.zoom = '';
        body.style.transform = '';
        body.style.transformOrigin = '';
        body.style.width = '';
        body.style.minHeight = '';

        if (body) {
            // Freeze all UI sizes against browser Default zoom.
            var baseUnitPx = firefoxBaseDesignUnit;
            if (!Number.isFinite(baseUnitPx) || baseUnitPx <= 0) {
                baseUnitPx = currentLayoutWidth > 0 ? (currentLayoutWidth / 1920) : 0;
            }
            var frozenUnitPx = baseUnitPx > 0 ? (baseUnitPx / zoomRatio) : 0;
            if (Number.isFinite(frozenUnitPx) && frozenUnitPx > 0) {
                var frozenUnitCss = frozenUnitPx.toFixed(4) + 'px';
                if (frozenUnitCss !== firefoxLastFrozenUnitCss) {
                    document.documentElement.style.setProperty('--u', frozenUnitCss);
                    body.style.setProperty('--u', frozenUnitCss);
                    canvas.style.setProperty('--u', frozenUnitCss);
                    firefoxLastFrozenUnitCss = frozenUnitCss;
                }
                if (!firefoxLastFrozenUnitPx || Math.abs(firefoxLastFrozenUnitPx - frozenUnitPx) > 0.0015) {
                    unitChanged = true;
                    firefoxLastFrozenUnitPx = frozenUnitPx;
                }
            }
        }

        var inverseRatioString = String(inverseRatio);
        // Keep text scale neutral; freeze text/layout through --u only.
        body.style.setProperty('--es-default-zoom-inverse', '1');
        canvas.style.setProperty('--es-default-zoom-inverse', '1');
        // Keep caret/icon compensation separate.
        if (inverseRatioString !== firefoxLastCaretInverseCss) {
            body.style.setProperty('--es-caret-default-zoom-inverse', inverseRatioString);
            canvas.style.setProperty('--es-caret-default-zoom-inverse', inverseRatioString);
            firefoxLastCaretInverseCss = inverseRatioString;
        }
        firefoxLastDefaultZoomRatio = zoomRatio;

        if (unitChanged || zoomChanged) {
            updateMailListLayout();
            schedulePageBottomLayout();
        }
    }

    function applyFirefoxTextZoomCompensation() {
        var body = document.body;
        var canvas = document.querySelector('.settings-canvas');
        if (!body || !canvas) return;

        var normalizedRatio = detectFirefoxTextZoomRatio();
        if (!Number.isFinite(normalizedRatio) || normalizedRatio <= 0) {
            resetFirefoxTextZoomCompensation(body, canvas);
            return;
        }

        normalizedRatio = snapFirefoxZoomRatio(normalizedRatio);
        var textOnlyZoomActive = Math.abs(normalizedRatio - 1) > 0.02;

        // Prevent micro-jitter: do not leave text-only mode on a single near-1 sample.
        if (textOnlyZoomActive) {
            firefoxTextOnlyActive = true;
            firefoxTextOnlyOffStableCount = 0;
        } else if (firefoxTextOnlyActive) {
            firefoxTextOnlyOffStableCount += 1;
            if (firefoxTextOnlyOffStableCount < 4) {
                textOnlyZoomActive = true;
                normalizedRatio = firefoxLastAppliedRatio || 1;
            } else {
                firefoxTextOnlyActive = false;
                firefoxTextOnlyOffStableCount = 0;
            }
        } else {
            firefoxTextOnlyOffStableCount = 0;
        }

        // Keep Default-zoom compensation neutral while text-only mode is active,
        // otherwise both systems fight and cause micro-jitter.
        if (textOnlyZoomActive) {
            body.style.setProperty('--es-default-zoom-inverse', '1');
            canvas.style.setProperty('--es-default-zoom-inverse', '1');
            body.style.setProperty('--es-caret-default-zoom-inverse', '1');
            canvas.style.setProperty('--es-caret-default-zoom-inverse', '1');
            firefoxLastCaretInverseCss = '1';
            firefoxLastDefaultZoomRatio = 1;
        } else {
            applyFirefoxCaretDefaultZoomCompensation(body, canvas);
        }

        if (!textOnlyZoomActive && Math.abs(normalizedRatio - 1) <= 0.015) {
            resetFirefoxTextZoomCompensation(body, canvas);
            return;
        }

        if (body.classList.contains('is-text-zoomed') && Math.abs(firefoxLastAppliedRatio - normalizedRatio) <= 0.015) {
            return;
        }

        var inverseRatio = 1 / normalizedRatio;
        if (Math.abs(firefoxLastAppliedRatio - normalizedRatio) <= 0.001 && body.classList.contains('is-text-zoomed')) return;
        markZoomFreeze();
        body.style.setProperty('--es-text-zoom-ratio', String(normalizedRatio));
        body.style.setProperty('--es-text-zoom-inverse', String(inverseRatio));
        canvas.style.setProperty('--es-text-zoom-ratio', String(normalizedRatio));
        canvas.style.setProperty('--es-text-zoom-inverse', String(inverseRatio));
        body.classList.add('is-text-zoomed');
        firefoxLastAppliedRatio = normalizedRatio;
    }

    function sanitizeQuantity(value) {
        var digits = String(value || '').replace(/\D+/g, '');
        digits = digits.replace(/^0+/, '');
        return digits;
    }

    function getFrozenUnitPx() {
        var nodes = [
            document.body,
            document.querySelector('.settings-canvas'),
            document.documentElement
        ];
        for (var i = 0; i < nodes.length; i += 1) {
            var node = nodes[i];
            if (!node) continue;
            var raw = window.getComputedStyle(node).getPropertyValue('--u');
            var parsed = parseFloat(String(raw || '').trim());
            if (Number.isFinite(parsed) && parsed > 0) return parsed;
        }

        var fallback = window.innerWidth / 1920;
        return Number.isFinite(fallback) && fallback > 0 ? fallback : 1;
    }

    function updateTopButtons() {
        updateEmailAddButton();
        updateEventAddButton();
        renderQuantityClear();
    }

    function updateEmailAddButton() {
        var emailInput = document.getElementById('emailInput');
        var passwordInput = document.getElementById('emailPasswordInput');
        var button = document.getElementById('emailAddBtn');
        if (!button) return;

        var email = emailInput ? emailInput.value.trim() : '';
        var password = passwordInput ? passwordInput.value : '';
        var duplicate = state.emails.some(function (entry) { return normalizeEmail(entry.email) === normalizeEmail(email); });
        var enabled = isFullEmail(email) && password.length >= 6 && !duplicate;

        button.disabled = !enabled;
        button.classList.toggle('is-disabled', !enabled);
        if (emailInput) emailInput.classList.toggle('is-invalid', Boolean(email) && (!isFullEmail(email) || duplicate));
        if (passwordInput) passwordInput.classList.toggle('is-invalid', Boolean(password) && password.length < 6);
    }

    function updateEventAddButton() {
        var button = document.getElementById('eventAddBtn');
        if (!button) return;
        var director = getTopDirectorEmail();
        var directorValid = !director || isFullEmail(director);
        var enabled = Boolean(
            getTopEventName() &&
            getSelectValue(document.getElementById('eventEmailSelect')) &&
            getSelectValue(document.getElementById('eventTimeSelect')) &&
            getSelectValue(document.getElementById('eventDaySelect')) &&
            directorValid
        );
        var directorInput = document.getElementById('eventDirectorInput');
        if (directorInput) directorInput.classList.toggle('is-invalid', Boolean(director) && !directorValid);
        button.disabled = !enabled;
        button.classList.toggle('is-disabled', !enabled);
    }

    function addEmailFromTop() {
        var emailInput = document.getElementById('emailInput');
        var passwordInput = document.getElementById('emailPasswordInput');
        var email = emailInput ? emailInput.value.trim() : '';
        var password = passwordInput ? passwordInput.value : '';
        if (!isFullEmail(email) || password.length < 6) return;
        if (state.emails.some(function (entry) { return normalizeEmail(entry.email) === normalizeEmail(email); })) return;

        state.emails.push({ email: email, password: password });
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
        syncPasswordStorage();
        savePageState();
        renderMailList();
        refreshEmailSelectOptions();
        updateTopButtons();
    }

    function renderAll() {
        renderMailList();
        renderQuantityClear();
        refreshEmailSelectOptions();
        renderEvents();
        decorateEmailSettingIcons();
    }

    function renderMailList() {
        var list = document.querySelector('.es-mail-list');
        if (!list) return;
        list.innerHTML = state.emails.map(function (item) {
            return '<div class="es-mail-item" data-email="' + esc(item.email) + '">' +
                '<span class="es-mail-link">' + esc(item.email) + '</span>' +
                '<span class="es-x-chip" role="button" tabindex="0" aria-label="Очистить поле" data-tooltip="Очистить поле"></span>' +
                '</div>';
        }).join('');
        renderMailLinkStaticText(list);
        decorateEmailSettingIcons(list);
        updateMailListLayout();
    }

    function renderMailLinkStaticText(scope) {
        var root = scope || document;
        var canRenderSvgText = typeof renderElementText === 'function';
        var canMeasureTextWidth = typeof measureTextWidth === 'function';

        Array.prototype.forEach.call(root.querySelectorAll('.es-mail-link'), function (link) {
            var text = String(link.getAttribute('data-mail-text') || link.textContent || '').trim();
            if (!text) return;

            link.setAttribute('data-mail-text', text);
            link.setAttribute('aria-label', text);

            if (!canRenderSvgText) return;

            var measuredWidth = canMeasureTextWidth
                ? measureTextWidth(text, 22, 400, 'Roboto, Arial, sans-serif')
                : text.length * 11.2;
            var labelWidth = Math.max(80, Math.ceil(measuredWidth + 10));

            renderElementText(link, {
                text: text,
                size: 22,
                width: labelWidth,
                height: 30,
                y: 22,
                weight: 400,
                color: 'currentColor'
            });
            link.classList.add('is-static-svg-text');
        });
    }

    function updateMailListLayout() {
        var canvas = document.querySelector('.settings-canvas');
        var container = document.querySelector('.main-container');
        var list = document.querySelector('.es-mail-list');
        if (!canvas || !list) return;

        // Deterministic layout math (no DOM measurement) to avoid zoom rounding jitter.
        var unit = getFrozenUnitPx();
        var dividerBaseTopPx = 206 * unit;
        var listTopPx = 182 * unit;
        var mailRowHeightPx = 37 * unit;
        var mailRowGapPx = 6 * unit;
        var minGapPx = 6 * unit;
        var emailCount = state.emails.length;
        var listHeightPx = emailCount > 0
            ? (emailCount * mailRowHeightPx + Math.max(0, emailCount - 1) * mailRowGapPx)
            : 0;
        var requiredDividerTopPx = listTopPx + listHeightPx + minGapPx;
        var extraSpacePx = Math.max(0, requiredDividerTopPx - dividerBaseTopPx);
        firefoxLastExtraMailSpacePx = extraSpacePx;
        var extraSpace = Math.ceil(extraSpacePx) + 'px';

        canvas.style.setProperty('--es-extra-mail-space', extraSpace);
        if (container) container.style.setProperty('--es-extra-mail-space', extraSpace);
        schedulePageBottomLayout();
    }

    function renderQuantityClear() {
        var qtyInput = document.getElementById('emailQtyInput');
        var clear = document.querySelector('.es-x-chip.qty-x');
        if (qtyInput && qtyInput.value !== state.quantity) qtyInput.value = state.quantity;
        if (clear) {
            var isEmpty = !state.quantity;
            clear.hidden = isEmpty;
            clear.setAttribute('aria-hidden', isEmpty ? 'true' : 'false');
            clear.classList.toggle('is-hidden', isEmpty);
            clear.setAttribute('role', 'button');
            clear.setAttribute('tabindex', '0');
            clear.setAttribute('aria-label', 'Очистить поле');
            clear.setAttribute('data-tooltip', 'Очистить поле');
            decorateEmailSettingIcons(clear.parentNode || document);
        }
    }

    function refreshEmailSelectOptions() {
        var options = getSelectOptions('event-email').join('|');
        document.querySelectorAll('[data-select-role="event-email"], [data-select-role="card-email"]').forEach(function (field) {
            field.setAttribute('data-options', options);
        });
    }

    function getTopEventName() {
        var input = document.getElementById('eventNameInput');
        return input ? input.value.trim() : '';
    }

    function getTopDirectorEmail() {
        var input = document.getElementById('eventDirectorInput');
        return input ? input.value.trim() : '';
    }

    function getSelectValue(field) {
        var node = field ? field.querySelector('.es-select-value') : null;
        return node ? node.textContent.trim() : '';
    }

    function setSelectValue(field, value) {
        var node = field ? field.querySelector('.es-select-value') : null;
        if (!node) return;
        node.textContent = value || '';
        field.classList.toggle('is-empty', !value);
    }

    function addEventFromTop() {
        var title = getTopEventName();
        var email = getSelectValue(document.getElementById('eventEmailSelect'));
        var time = getSelectValue(document.getElementById('eventTimeSelect'));
        var day = getSelectValue(document.getElementById('eventDaySelect'));
        var director = getTopDirectorEmail();
        var directorValid = !director || isFullEmail(director);
        if (!title || !email || !time || !day || !directorValid) return;

        state.events.push({
            number: String(state.events.length + 1),
            title: title,
            eventEmail: email,
            time: time,
            day: day,
            director: director,
            duplicateManager: false,
            duplicateDirector: false,
            editing: false
        });

        document.getElementById('eventNameInput').value = '';
        document.getElementById('eventDirectorInput').value = '';
        setSelectValue(document.getElementById('eventEmailSelect'), '');
        setSelectValue(document.getElementById('eventTimeSelect'), '');
        setSelectValue(document.getElementById('eventDaySelect'), '');
        savePageState();
        renderEvents();
        updateEventAddButton();
    }

    function getDirectorWarning(eventItem) {
        if (!eventItem.duplicateDirector) return '';
        if (!eventItem.director.trim()) return 'Укажите почту';
        if (!isFullEmail(eventItem.director)) return 'Укажите правильный адрес почты';
        return '';
    }

    function renderEvents() {
        var cards = document.querySelector('.es-cards');
        if (!cards) return;
        cards.innerHTML = state.events.map(renderEventCard).join('');
        decorateEmailSettingIcons(cards);
        bindDomainSuggestForRenderedCards(cards);
        refreshEmailSelectOptions();
        schedulePageBottomLayout();
    }

    function schedulePageBottomLayout() {
        if (pageBottomLayoutRaf) return;
        pageBottomLayoutRaf = window.requestAnimationFrame(function () {
            pageBottomLayoutRaf = 0;
            updatePageBottomLayout();
        });
    }

    function updatePageBottomLayout() {
        if (document.body && document.body.classList.contains('is-zooming')) return;
        var container = document.querySelector('.main-container');
        var cards = document.querySelector('.es-cards');
        if (!container) return;

        // Deterministic formula to keep container height frozen across browser Default zoom.
        var unit = getFrozenUnitPx();
        var extraSpacePx = Number.isFinite(firefoxLastExtraMailSpacePx) ? firefoxLastExtraMailSpacePx : 0;
        var cardsTopPx = 325 * unit + extraSpacePx;
        var cardHeightPx = 145 * unit;
        var cardGapPx = 14 * unit;
        var bottomPaddingPx = 12 * unit;
        var minBaseHeightPx = 382 * unit + extraSpacePx;
        var cardCount = cards ? cards.children.length : 0;
        var bottom = minBaseHeightPx;

        if (cardCount > 0) {
            var cardsBlockHeightPx = cardCount * cardHeightPx + Math.max(0, cardCount - 1) * cardGapPx;
            bottom = cardsTopPx + cardsBlockHeightPx + bottomPaddingPx;
        }

        var height = Math.max(bottom, minBaseHeightPx);
        var heightCss = height.toFixed(3) + 'px';
        container.style.height = heightCss;
        container.style.minHeight = heightCss;
    }

    function renderEventCard(eventItem, index) {
        var warning = getDirectorWarning(eventItem);
        var isEditing = Boolean(eventItem.editing);
        var labels = [
            '',
            'Почта для события',
            'Время на отправку',
            'День недели',
            'Почта директора'
        ];

        return '<article class="es-card' + (isEditing ? ' is-editing' : '') + (warning ? ' has-warning' : '') + '" data-index="' + index + '">' +
            renderCardTitle(eventItem, index, isEditing) +
            '<div class="es-card-grid">' +
            labels.map(function (label, labelIndex) {
                return '<div class="es-card-label' + (labelIndex === 4 && warning ? ' error' : '') + '">' + esc(label) + '</div>';
            }).join('') +
            renderEditableTextField(index, 'title', eventItem.title, isEditing) +
            renderCardSelectField(index, 'eventEmail', eventItem.eventEmail, 'card-email', isEditing) +
            renderCardSelectField(index, 'time', eventItem.time, 'time', isEditing, true) +
            renderCardSelectField(index, 'day', eventItem.day, 'day', isEditing, true) +
            renderEditableTextField(index, 'director', eventItem.director, isEditing, true) +
            '</div>' +
            (warning ? '<div class="es-card-warning">' + esc(warning) + '</div>' : '') +
            '<div class="es-card-footer">' +
            renderCheckbox(index, 'duplicateManager', eventItem.duplicateManager, 'Дублировать менеджеру компании') +
            renderCheckbox(index, 'duplicateDirector', eventItem.duplicateDirector, 'Дублировать директору') +
            '</div>' +
            '<div class="es-actions">' +
            '<button class="es-edit' + (isEditing ? ' is-active' : '') + '" type="button" aria-label="Редактировать событие" aria-pressed="' + (isEditing ? 'true' : 'false') + '" data-tooltip="' + (isEditing ? 'Режим редактирования' : 'Редактировать') + '" data-action="edit"></button>' +
            '<button class="es-delete es-delete-link" type="button" aria-label="Удалить событие" data-tooltip="Удалить событие" data-action="delete">Delete</button>' +
            '</div>' +
            '</article>';
    }

    function renderCardTitle(eventItem, index, isEditing) {
        var number = String(eventItem.number || index + 1);
        var numberWidth = Math.max(1, number.length) + 0.15;
        if (!isEditing) return '<h3 class="es-card-title">Событие №' + esc(number) + '</h3>';
        return '<h3 class="es-card-title es-card-title-edit">Событие №' +
            '<input class="es-card-number-input" type="text" inputmode="numeric" value="' + esc(number) + '" style="width:' + numberWidth + 'ch" data-index="' + index + '" data-field="number" aria-label="Номер события">' +
            '</h3>';
    }

    function renderEditableTextField(index, field, value, isEditing, isEmail) {
        var shouldShowClear = Boolean(value);
        if (!isEditing) {
            return '<div class="es-card-input' + (field === 'director' && getDirectorWarning(state.events[index]) ? ' error' : ' soft') + '">' +
                esc(value) +
                '</div>';
        }

        return '<div class="es-card-input es-edit-field' + (field === 'director' && getDirectorWarning(state.events[index]) ? ' error' : '') + '">' +
            '<input class="es-card-inner-input' + (isEmail ? ' es-email-suggest-input' : '') + '" type="' + (isEmail ? 'email' : 'text') + '" value="' + esc(value) + '" data-index="' + index + '" data-field="' + field + '" autocomplete="off">' +
            (shouldShowClear ? '<span class="es-inline-x es-inline-x-btn" data-index="' + index + '" data-clear-field="' + field + '" role="button" tabindex="0" aria-label="Очистить поле" data-tooltip="Очистить поле"></span>' : '') +
            '</div>';
    }

    function renderCardSelectField(index, field, value, role, isEditing, hasClear) {
        if (!isEditing) {
            return '<div class="es-card-input soft">' + esc(value) + '</div>';
        }
        return '<div class="es-card-input es-select-field' + (value ? '' : ' is-empty') + (hasClear ? ' has-clear' : '') + '" tabindex="0" data-index="' + index + '" data-field="' + field + '" data-select-role="' + role + '" data-options="' + esc(getSelectOptions(role).join('|')) + '">' +
            '<span class="es-select-value">' + esc(value) + '</span>' +
            '<span class="es-caret"></span>' +
            (hasClear && value ? '<span class="es-inline-x es-inline-x-btn" data-index="' + index + '" data-clear-field="' + field + '" role="button" tabindex="0" aria-label="Очистить поле" data-tooltip="Очистить поле"></span>' : '') +
            '</div>';
    }

    function renderCheckbox(index, field, checked, label) {
        return '<label class="es-check"><input class="check-input" type="checkbox" data-index="' + index + '" data-field="' + field + '"' + (checked ? ' checked' : '') + '><span class="es-check-text">' + esc(label) + '</span></label>';
    }

    function handleDocumentClick(event) {
        var selectField = event.target.closest('.es-select-field');
        var clearBtn = event.target.closest('.es-inline-x, .es-x-chip');
        var editBtn = event.target.closest('.es-edit');
        var deleteBtn = event.target.closest('.es-delete');
        var suggestOption = event.target.closest('.es-suggest-option');
        var option = event.target.closest('.es-field-option');

        if (suggestOption && activeSuggest) {
            event.preventDefault();
            activeSuggest.input.value = suggestOption.textContent.trim();
            syncInputToState(activeSuggest.input);
            closeSuggestMenu();
            updateTopButtons();
            renderEvents();
            return;
        }

        if (option && activeSelect) {
            event.preventDefault();
            selectOption(activeSelect, option.textContent.trim());
            return;
        }

        if (clearBtn) {
            event.preventDefault();
            event.stopPropagation();
            handleClear(clearBtn);
            return;
        }

        if (editBtn) {
            event.preventDefault();
            toggleEdit(editBtn.closest('.es-card'));
            return;
        }

        if (deleteBtn) {
            event.preventDefault();
            deleteEvent(deleteBtn.closest('.es-card'));
            return;
        }

        if (selectField) {
            event.preventDefault();
            event.stopPropagation();
            if (isSelectOpenForField(selectField)) {
                closeSelectMenu();
            } else {
                openSelect(selectField);
            }
            return;
        }

        closeFloatingMenus();
    }

    function handleDocumentInput(event) {
        var target = event.target;
        if (target.matches('.es-card-inner-input, .es-card-number-input')) {
            syncInputToState(target);
        }
        if (target.matches('.es-email-suggest-input')) {
            showDomainSuggest(target);
        }
    }

    function handleDocumentChange(event) {
        var target = event.target;
        if (!target.matches('.es-card-footer .check-input')) return;
        var item = state.events[Number(target.dataset.index)];
        if (!item) return;
        item[target.dataset.field] = target.checked;
        savePageState();
        renderEvents();
    }

    function handleDocumentFocusOut(event) {
        if (event.target.closest('.es-edit, .es-delete, .es-inline-x, .es-x-chip')) {
            hideFloatingTooltip();
        }
        if (event.target.matches('.es-card-inner-input, .es-card-number-input')) {
            renderEvents();
        }
    }

    function getTooltipTriggerTarget(node) {
        return node ? node.closest('.es-edit, .es-delete, .es-inline-x, .es-x-chip') : null;
    }

    function handleTooltipMouseOver(event) {
        var target = getTooltipTriggerTarget(event.target);
        if (!target) return;
        showFloatingTooltip(target);
    }

    function handleTooltipMouseOut(event) {
        var target = getTooltipTriggerTarget(event.target);
        if (!target) return;
        if (event.relatedTarget && target.contains(event.relatedTarget)) return;
        hideFloatingTooltip();
    }

    function handleTooltipFocusIn(event) {
        var target = getTooltipTriggerTarget(event.target);
        if (!target) return;
        showFloatingTooltip(target);
    }

    function handleDocumentKeydown(event) {
        if (event.key === 'Escape') {
            closeFloatingMenus();
            return;
        }
        if (event.target.closest('.es-select-field') && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            var keyboardField = event.target.closest('.es-select-field');
            if (isSelectOpenForField(keyboardField)) {
                closeSelectMenu();
            } else {
                openSelect(keyboardField);
            }
        }
        if (event.target.closest('.es-inline-x, .es-x-chip') && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            handleClear(event.target.closest('.es-inline-x, .es-x-chip'));
        }
    }

    function syncInputToState(input) {
        var index = Number(input.dataset.index);
        var field = input.dataset.field;
        var item = state.events[index];
        if (!item || !field) return;
        if (field === 'number') {
            input.value = sanitizeQuantity(input.value) || '1';
            item.number = input.value;
        } else {
            item[field] = input.value;
        }
        savePageState();
    }

    function handleClear(button) {
        if (button.classList.contains('qty-x')) {
            state.quantity = '';
            var qtyInput = document.getElementById('emailQtyInput');
            if (qtyInput) qtyInput.value = '';
            savePageState();
            renderQuantityClear();
            return;
        }

        var mailItem = button.closest('.es-mail-item');
        if (mailItem) {
            removeEmail(mailItem.dataset.email || '');
            return;
        }

        var index = Number(button.dataset.index);
        var field = button.dataset.clearField;
        if (!Number.isNaN(index) && field && state.events[index]) {
            state.events[index][field] = '';
            savePageState();
            renderEvents();
            return;
        }
    }

    function removeEmail(email) {
        var normalized = normalizeEmail(email);
        state.emails = state.emails.filter(function (item) { return normalizeEmail(item.email) !== normalized; });
        state.events.forEach(function (item) {
            if (normalizeEmail(item.eventEmail) === normalized) item.eventEmail = '';
        });
        syncPasswordStorage();
        savePageState();
        renderMailList();
        refreshEmailSelectOptions();
        renderEvents();
        updateTopButtons();
    }

    function toggleEdit(card) {
        if (!card) return;
        var index = Number(card.dataset.index);
        var item = state.events[index];
        if (!item) return;
        item.editing = !item.editing;
        savePageState();
        closeFloatingMenus();
        renderEvents();
    }

    function deleteEvent(card) {
        if (!card) return;
        var index = Number(card.dataset.index);
        if (Number.isNaN(index)) return;
        state.events.splice(index, 1);
        state.events.forEach(function (item, itemIndex) {
            item.number = String(itemIndex + 1);
        });
        savePageState();
        renderEvents();
    }

    function openSelect(field) {
        var options = getSelectOptions(field.dataset.selectRole || '').length ? getSelectOptions(field.dataset.selectRole || '') : parseOptions(field);
        if (!options.length) return;
        closeSuggestMenu();

        var menu = getSelectMenu();
        if (!menu.isConnected || menu.parentElement !== document.body) {
            document.body.appendChild(menu);
        }
        var currentValue = getSelectValue(field);
        menu.innerHTML = options.map(function (value) {
            return '<button type="button" class="es-field-option' + (value === currentValue ? ' is-selected' : '') + '">' + esc(value) + '</button>';
        }).join('');

        var rect = field.getBoundingClientRect();
        var unit = getFrozenUnitPx();
        var optionHeight = Math.max(32, 58 * unit);
        var viewportGap = Math.max(8, 12 * unit);
        var spaceBelow = Math.max(optionHeight, window.innerHeight - rect.bottom - viewportGap);
        var spaceAbove = Math.max(optionHeight, rect.top - viewportGap);
        var desiredMenuHeight = options.length * optionHeight + 2;
        var preferredMaxHeight = Math.max(optionHeight, 522 * unit);
        var maxMenuHeightDown = Math.max(optionHeight, Math.min(desiredMenuHeight, preferredMaxHeight, spaceBelow));
        var maxMenuHeightUp = Math.max(optionHeight, Math.min(desiredMenuHeight, preferredMaxHeight, spaceAbove));
        var openUp = false;
        if (maxMenuHeightDown < desiredMenuHeight) {
            if (maxMenuHeightUp >= desiredMenuHeight || maxMenuHeightUp > maxMenuHeightDown) {
                openUp = true;
            }
        }
        var maxMenuHeight = openUp ? maxMenuHeightUp : maxMenuHeightDown;

        menu.style.left = rect.left + 'px';
        menu.style.top = (openUp ? (rect.top - maxMenuHeight) : rect.bottom) + 'px';
        menu.style.width = rect.width + 'px';
        menu.style.maxHeight = maxMenuHeight + 'px';
        menu.style.overflowY = 'auto';
        menu.classList.remove('open-up');
        menu.classList.add('open');
        if (activeSelect) {
            activeSelect.classList.remove('open');
            activeSelect.classList.remove('open-up');
        }
        activeSelect = field;
        activeSelect.classList.remove('open-up');
        activeSelect.classList.add('open');
        if (openUp) {
            menu.classList.add('open-up');
            activeSelect.classList.add('open-up');
        }
    }

    function isSelectOpenForField(field) {
        if (!field || activeSelect !== field) return false;
        var menu = document.querySelector('.es-field-menu');
        return Boolean(menu && menu.classList.contains('open'));
    }

    function parseOptions(field) {
        return String(field.getAttribute('data-options') || '').split('|').map(function (item) {
            return item.trim();
        }).filter(Boolean);
    }

    function selectOption(field, value) {
        if (!field) return;
        var index = Number(field.dataset.index);
        var dataField = field.dataset.field;
        if (!Number.isNaN(index) && dataField && state.events[index]) {
            state.events[index][dataField] = value;
            savePageState();
            closeSelectMenu();
            renderEvents();
            return;
        }
        setSelectValue(field, value);
        closeSelectMenu();
        updateEventAddButton();
    }

    function getSelectMenu() {
        var menu = document.querySelector('.es-field-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.className = 'es-field-menu';
            document.body.appendChild(menu);
        }
        return menu;
    }

    function closeSelectMenu() {
        var menu = document.querySelector('.es-field-menu');
        if (menu) {
            menu.classList.remove('open');
            menu.classList.remove('open-up');
        }
        if (activeSelect) {
            activeSelect.classList.remove('open');
            activeSelect.classList.remove('open-up');
        }
        activeSelect = null;
    }

    function bindDomainSuggestInput(input, onInput) {
        input.classList.add('es-email-suggest-input');
        input.addEventListener('input', function () {
            if (onInput) onInput();
            showDomainSuggest(input);
        });
        input.addEventListener('focus', function () { showDomainSuggest(input); });
    }

    function bindDomainSuggestForRenderedCards(root) {
        root.querySelectorAll('.es-email-suggest-input').forEach(function (input) {
            input.addEventListener('focus', function () { showDomainSuggest(input); });
        });
    }

    function showDomainSuggest(input) {
        var value = input.value.trim();
        var atIndex = value.indexOf('@');
        if (atIndex < 1) {
            closeSuggestMenu();
            return;
        }

        var local = value.slice(0, atIndex);
        var domainPart = value.slice(atIndex + 1).toLowerCase();
        var matches = EMAIL_DOMAIN_OPTIONS.filter(function (domain) {
            return !domainPart || domain.indexOf(domainPart) === 0 || domain.indexOf(domainPart) !== -1;
        }).slice(0, 10);

        if (!matches.length) {
            closeSuggestMenu();
            return;
        }

        var menu = getSuggestMenu();
        menu.innerHTML = matches.map(function (domain) {
            return '<button type="button" class="es-suggest-option">' + esc(local + '@' + domain) + '</button>';
        }).join('');

        var rect = input.getBoundingClientRect();
        menu.style.left = rect.left + 'px';
        menu.style.top = rect.bottom + 'px';
        menu.style.width = rect.width + 'px';
        menu.classList.add('open');
        activeSuggest = { input: input, menu: menu };
    }

    function getSuggestMenu() {
        var menu = document.querySelector('.es-suggest-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.className = 'es-suggest-menu';
            document.body.appendChild(menu);
        }
        return menu;
    }

    function closeSuggestMenu() {
        var menu = document.querySelector('.es-suggest-menu');
        if (menu) menu.classList.remove('open');
        activeSuggest = null;
    }

    function closeFloatingMenus() {
        closeSelectMenu();
        closeSuggestMenu();
        hideFloatingTooltip();
    }

    function getFloatingTooltip() {
        var tooltip = document.querySelector('.es-floating-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'es-floating-tooltip';
            document.body.appendChild(tooltip);
        }
        return tooltip;
    }

    function showFloatingTooltip(target) {
        var text = target.getAttribute('data-tooltip');
        if (!text) return;

        var tooltip = getFloatingTooltip();
        var action = target.getAttribute('data-action');
        var rect = target.getBoundingClientRect();
        var unit = getFrozenUnitPx();
        var viewportPad = Math.max(8, 12 * unit);
        var gap = Math.max(5, 5 * unit);

        tooltip.textContent = text;
        if (action) tooltip.setAttribute('data-action', action);
        else tooltip.removeAttribute('data-action');
        tooltip.classList.add('open');

        var tooltipWidth = tooltip.offsetWidth || 0;
        var tooltipHeight = tooltip.offsetHeight || 0;
        var centerX = rect.left + rect.width / 2;
        var minX = viewportPad + tooltipWidth / 2;
        var maxX = window.innerWidth - viewportPad - tooltipWidth / 2;
        var left = Math.min(maxX, Math.max(minX, centerX));
        var top = rect.bottom + gap;

        if (top + tooltipHeight > window.innerHeight - viewportPad) {
            top = rect.top - tooltipHeight - gap;
        }
        top = Math.max(viewportPad, top);

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    function hideFloatingTooltip() {
        var tooltip = document.querySelector('.es-floating-tooltip');
        if (tooltip) {
            tooltip.classList.remove('open');
            tooltip.removeAttribute('data-action');
        }
    }

    function decorateEmailSettingIcons(root) {
        var scope = root || document;
        var iconMap = [
            { selector: '.es-edit', glyphs: { default: '\uf000', hover: '\uf001', active: '\uf002' } },
            { selector: '.es-delete:not(.es-delete-link)', glyphs: { default: '\uf005', hover: '\uf004', active: '\uf004' } },
            { selector: '.es-inline-x, .es-x-chip', glyphs: { default: '\uf006', hover: '\uf007', active: '\uf008' } }
        ];

        iconMap.forEach(function (item) {
            Array.prototype.forEach.call(scope.querySelectorAll(item.selector), function (element) {
                addEmailIconLayers(element, item.glyphs);
            });
        });
    }

    function addEmailIconLayers(element, glyphs) {
        if (!element || element.querySelector('.es-icon-layer')) return;
        ['default', 'hover', 'active'].forEach(function (stateName) {
            var layer = document.createElement('span');
            layer.className = 'es-icon-layer es-icon-layer-' + stateName;
            layer.setAttribute('aria-hidden', 'true');
            layer.textContent = glyphs[stateName] || glyphs.hover || glyphs.default;
            element.appendChild(layer);
        });
        element.classList.add('has-icon-layers');
    }
})();

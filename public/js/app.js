// Конфигурация приложения
const AppConfig = {
    RES_LIST: [
        { id: 'adler', name: 'Адлерский ФЭС', color: '#1e40af' },
        { id: 'dagomys', name: 'Дагомысский ФЭС', color: '#0ea5e9' },
        { id: 'krasnopolyansky', name: 'Краснополянский ФЭС', color: '#8b5cf6' },
        { id: 'lazarevsky', name: 'Лазаревский ФЭС', color: '#06b6d4' },
        { id: 'sochi', name: 'Сочинский ФЭС', color: '#3b82f6' },
        { id: 'tuapse', name: 'Туапсинский ФЭС', color: '#6366f1' },
        { id: 'hostinsky', name: 'Хостинский ФЭС', color: '#2563eb' },
        { id: 'ps', name: 'ПС РЭС', color: '#7c3aed', isPsRes: true }
    ],
    
    USERS: {
        admin: {
            name: 'Администратор',
            role: 'admin',
            passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
            permissions: ['view', 'edit', 'delete', 'export', 'reports', 'input']
        },
        viewer: {
            name: 'Наблюдатель',
            role: 'viewer',
            passwordHash: '',
            permissions: ['view', 'reports', 'export', 'history']
        }
    }
};

class SurveyStatisticsApp {
    constructor() {
        this.weeklyData = [];
        this.verticalChart = null;
        this.currentUser = null;
        this.apiBaseUrl = window.location.hostname === 'localhost' ? 
            'http://localhost:3000/api' : 'https://opros-fes1.onrender.com/api';
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        await this.checkLogin();
        this.initializeInputGrid();
        this.setDefaultDate();
        await this.loadData();
        this.updateStats();
        this.updateDetailedTable();
        this.updateChart();
        this.updateReportDates();
        this.updateTabsForUserRole();
    }
    
    async checkLogin() {
        try {
            const savedUser = localStorage.getItem('surveyAppUser_v3');
            if (savedUser) {
                this.currentUser = JSON.parse(savedUser);
                this.showMainApp();
            } else {
                this.showLogin();
            }
        } catch (e) {
            console.error('Ошибка проверки авторизации:', e);
            this.showLogin();
        }
    }
    
    showLogin() {
        const loginModal = document.getElementById('loginModal');
        const mainContainer = document.getElementById('mainContainer');
        if (loginModal) {
            loginModal.style.display = 'flex';
            this.resetLoginForm();
        }
        if (mainContainer) mainContainer.style.display = 'none';
    }
    
    resetLoginForm() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.reset();
        }
        
        const usernameSelect = document.getElementById('username');
        if (usernameSelect) {
            usernameSelect.disabled = false;
            usernameSelect.innerHTML = `
                <option value="">Выберите пользователя</option>
                <option value="admin">Администратор</option>
                <option value="viewer">Наблюдатель</option>
            `;
        }
        
        const passwordInput = document.getElementById('password');
        if (passwordInput) {
            passwordInput.disabled = false;
            passwordInput.value = '';
        }
    }
    
    showMainApp() {
        const loginModal = document.getElementById('loginModal');
        const mainContainer = document.getElementById('mainContainer');
        if (loginModal) loginModal.style.display = 'none';
        if (mainContainer) mainContainer.style.display = 'block';
        
        this.updateUserInfo();
        this.updateUIForUserRole();
        this.updateTabsForUserRole();
        this.showTab({ currentTarget: document.querySelector('[data-tab="stats"]') });
    }
    
    updateUserInfo() {
        if (!this.currentUser) return;
        
        const userName = document.getElementById('userName');
        const userRole = document.getElementById('userRole');
        const avatar = document.getElementById('userAvatar');
        
        if (userName) userName.textContent = this.currentUser.name;
        if (userRole) userRole.textContent = this.currentUser.role === 'admin' ? 'Администратор' : 'Наблюдатель';
        
        if (avatar) {
            avatar.textContent = this.currentUser.name.charAt(0).toUpperCase();
            avatar.style.background = this.currentUser.role === 'admin' 
                ? 'linear-gradient(135deg, var(--primary), var(--primary-dark))' 
                : 'linear-gradient(135deg, var(--gray), #9ca3af)';
        }
    }
    
    updateTabsForUserRole() {
        const tabsContainer = document.getElementById('tabsContainer');
        if (!tabsContainer) return;
        
        tabsContainer.innerHTML = '';
        
        const commonTabs = [
            { id: 'stats', icon: 'chart-bar', label: 'Статистика по ФЭС' },
            { id: 'history', icon: 'history', label: 'История' },
            { id: 'reports', icon: 'file-chart-line', label: 'Отчёты' },
            { id: 'statistics', icon: 'chart-pie', label: 'В статистику' }
        ];
        
        if (this.currentUser?.role === 'admin') {
            const adminTabs = [
                { id: 'input', icon: 'database', label: 'Ввод данных' }
            ];
            commonTabs.splice(1, 0, ...adminTabs);
        }
        
        commonTabs.forEach(tab => {
            const button = document.createElement('button');
            button.className = 'tab-btn';
            button.dataset.tab = tab.id;
            button.innerHTML = `
                <i class="fas fa-${tab.icon}"></i> ${tab.label}
            `;
            button.addEventListener('click', (e) => this.showTab(e));
            
            if (tab.id === 'stats') {
                button.classList.add('active');
            }
            
            tabsContainer.appendChild(button);
        });
    }
    
    updateUIForUserRole() {
        const canEdit = this.currentUser?.permissions?.includes('edit');
        const canDelete = this.currentUser?.permissions?.includes('delete');
        const canExport = this.currentUser?.permissions?.includes('export');
        
        if (!canEdit) {
            const saveBtn = document.getElementById('saveDataBtn');
            const clearBtn = document.getElementById('clearAllDataBtn');
            const autofillBtn = document.getElementById('autofillBtn');
            if (saveBtn) saveBtn.classList.add('disabled');
            if (clearBtn) clearBtn.classList.add('disabled');
            if (autofillBtn) autofillBtn.classList.add('disabled');
            
            document.querySelectorAll('.form-control').forEach(input => {
                if (input.type !== 'date') {
                    input.disabled = true;
                }
            });
        }
        
        if (!canDelete) {
            const clearAllBtn = document.getElementById('clearAllDataBtn');
            if (clearAllBtn) clearAllBtn.disabled = true;
        }
        
        if (!canExport) {
            const exportBtn = document.getElementById('exportExcelBtn');
            if (exportBtn) exportBtn.disabled = true;
        }
    }
    
    async hashPassword(password) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.error('Ошибка хеширования пароля:', error);
            return password;
        }
    }
    
    async login(event) {
        event.preventDefault();
        
        try {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            if (!username) {
                this.showNotification('Выберите пользователя!', 'warning');
                return;
            }
            
            const user = AppConfig.USERS[username];
            
            if (!user) {
                this.showNotification('Пользователь не найден!', 'danger');
                return;
            }
            
            if (username === 'admin') {
                const inputHash = await this.hashPassword(password);
                if (inputHash !== user.passwordHash) {
                    this.showNotification('Неверный пароль!', 'danger');
                    return;
                }
            }
            
            if (username === 'viewer' && password !== '') {
                this.showNotification('Для наблюдателя пароль не требуется!', 'warning');
                return;
            }
            
            this.currentUser = { 
                name: user.name, 
                role: user.role,
                permissions: [...user.permissions]
            };
            
            localStorage.setItem('surveyAppUser_v3', JSON.stringify(this.currentUser));
            
            this.showNotification(`Добро пожаловать, ${user.name}!`, 'success');
            
            setTimeout(() => {
                this.showMainApp();
            }, 500);
            
        } catch (error) {
            console.error('Ошибка входа:', error);
            this.showNotification('Ошибка входа в систему', 'danger');
        }
    }
    
    logout() {
        if (confirm('Вы уверены, что хотите выйти из системы?')) {
            this.currentUser = null;
            localStorage.removeItem('surveyAppUser_v3');
            this.showLogin();
            this.showNotification('Вы успешно вышли из системы', 'info');
        }
    }
    
    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.login(e));
        }
        
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
        
        const saveDataBtn = document.getElementById('saveDataBtn');
        if (saveDataBtn) {
            saveDataBtn.addEventListener('click', () => this.saveData());
        }
        
        const clearFormBtn = document.getElementById('clearFormBtn');
        if (clearFormBtn) {
            clearFormBtn.addEventListener('click', () => this.clearForm());
        }
        
        const autofillBtn = document.getElementById('autofillBtn');
        if (autofillBtn) {
            autofillBtn.addEventListener('click', () => this.autofillFromPrevious());
        }
        
        const exportExcelBtn = document.getElementById('exportExcelBtn');
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => this.exportToExcel());
        }
        
        const clearAllDataBtn = document.getElementById('clearAllDataBtn');
        if (clearAllDataBtn) {
            clearAllDataBtn.addEventListener('click', () => this.clearAllData());
        }
        
        const generateWeeklyReport = document.getElementById('generateWeeklyReport');
        if (generateWeeklyReport) {
            generateWeeklyReport.addEventListener('click', () => this.generateWeeklyReport());
        }
        
        const generateAnalyticalReport = document.getElementById('generateAnalyticalReport');
        if (generateAnalyticalReport) {
            generateAnalyticalReport.addEventListener('click', () => this.generateAnalyticalReport());
        }
        
        const reportWeekSelect = document.getElementById('reportWeekSelect');
        if (reportWeekSelect) {
            reportWeekSelect.addEventListener('change', (e) => this.updateReportDate(e.target.value));
        }
        
        const generateChangesReport = document.getElementById('generateChangesReport');
        if (generateChangesReport) {
            generateChangesReport.addEventListener('click', () => this.generateChangesReport());
        }
        
        const generateComparisonReport = document.getElementById('generateComparisonReport');
        if (generateComparisonReport) {
            generateComparisonReport.addEventListener('click', () => this.generateComparisonReport());
        }
    }
    
    showTab(event) {
        event.preventDefault();
        const tabName = event.currentTarget.dataset.tab;
        
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.style.display = 'none';
        });
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const tabElement = document.getElementById(tabName);
        if (tabElement) {
            tabElement.style.display = 'block';
        }
        
        event.currentTarget.classList.add('active');
        
        switch(tabName) {
            case 'stats':
                this.updateStats();
                this.updateDetailedTable();
                this.updateChart();
                break;
            case 'history':
                this.updateHistoryTable();
                break;
            case 'reports':
                this.updateReportDates();
                break;
            case 'statistics':
                this.updateStatisticsSelects();
                break;
            case 'input':
                this.setDefaultDate();
                break;
        }
    }
    
    formatDate(date) {
        try {
            if (!(date instanceof Date) || isNaN(date.getTime())) {
                return 'Некорректная дата';
            }
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
        } catch (error) {
            console.error('Ошибка форматирования даты:', error);
            return 'Ошибка даты';
        }
    }
    
    setDefaultDate() {
        const today = new Date();
        const dateInput = document.getElementById('dateInput');
        if (dateInput) {
            const dayOfWeek = today.getDay();
            const diff = dayOfWeek === 6 ? 0 : dayOfWeek === 0 ? -6 : 6 - dayOfWeek;
            const lastSaturday = new Date(today);
            lastSaturday.setDate(today.getDate() - diff - 7);
            dateInput.value = lastSaturday.toISOString().split('T')[0];
        }
    }
    
    initializeInputGrid() {
        try {
            const container = document.getElementById('resInputGrid');
            if (!container) return;
            
            container.innerHTML = '';
            
            AppConfig.RES_LIST.forEach(res => {
                const card = document.createElement('div');
                card.className = 'input-card';
                const isPsRes = res.id === 'ps';
                
                card.innerHTML = `
                    <div style="background: ${res.color}08; padding: 25px; border-radius: 12px; border-left: 5px solid ${res.color}; border: 1px solid ${res.color}20; ${isPsRes ? 'opacity: 0.9;' : ''}">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                            <h4 style="color: ${res.color}; font-weight: 900; font-size: 16px;">
                                ${res.name}
                                ${isPsRes ? '<span style="font-size: 11px; color: var(--gray); background: #f8fafc; padding: 2px 8px; border-radius: 12px; margin-left: 8px;">не в общем %</span>' : ''}
                            </h4>
                            <div style="color: ${res.color}; font-size: 22px;">
                                <i class="fas fa-bolt"></i>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 18px;">
                            <label style="font-size: 13px; color: var(--gray); display: block; margin-bottom: 6px; font-weight: 600;">
                                <i class="fas fa-bolt"></i> Всего ПУ:
                            </label>
                            <input type="number" class="form-control" id="total_${res.id}" placeholder="0" 
                                   min="0" oninput="app.calculatePercentages('${res.id}')">
                            <div class="error-message" id="error_total_${res.id}"></div>
                        </div>
                        
                        <div style="margin-bottom: 18px;">
                            <label style="font-size: 13px; color: var(--gray); display: block; margin-bottom: 6px; font-weight: 600;">
                                <i class="fas fa-check-circle"></i> ПУ в опросе:
                            </label>
                            <input type="number" class="form-control" id="survey_${res.id}" placeholder="0"
                                   min="0" oninput="app.calculatePercentages('${res.id}')">
                            <div class="error-message" id="error_survey_${res.id}"></div>
                        </div>
                        
                        <div style="margin-bottom: 18px;">
                            <label style="font-size: 13px; color: var(--gray); display: block; margin-bottom: 6px; font-weight: 600;">
                                <i class="fas fa-bolt"></i> СПОДЭС ПУ:
                            </label>
                            <input type="number" class="form-control" id="total_spo_${res.id}" placeholder="0"
                                   min="0" oninput="app.calculatePercentages('${res.id}')">
                            <div class="error-message" id="error_total_spo_${res.id}"></div>
                        </div>
                        
                        <div style="margin-bottom: 25px;">
                            <label style="font-size: 13px; color: var(--gray); display: block; margin-bottom: 6px; font-weight: 600;">
                                <i class="fas fa-check-circle"></i> СПОДЭС в опросе:
                            </label>
                            <input type="number" class="form-control" id="survey_spo_${res.id}" placeholder="0"
                                   min="0" oninput="app.calculatePercentages('${res.id}')">
                            <div class="error-message" id="error_survey_spo_${res.id}"></div>
                        </div>
                        
                        <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; align-items: center;">
                                <span style="font-size: 13px; color: var(--gray); font-weight: 600;">% опроса:</span>
                                <span style="font-weight: 900; color: ${res.color}; font-size: 16px;" id="percent_${res.id}">0.00%</span>
                            </div>
                            <div class="progress-bar-inline">
                                <div class="progress-fill" id="progress_${res.id}" 
                                     style="width: 0%; background: ${res.color};"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-top: 15px; align-items: center;">
                                <span style="font-size: 13px; color: var(--gray); font-weight: 600;">% СПОДЭС:</span>
                                <span style="font-weight: 900; color: ${res.color}; font-size: 16px;" id="percent_spo_${res.id}">0.00%</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px; font-size: 12px; color: var(--gray);">
                                <div style="text-align: center; padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                                    <div style="font-weight: 600; margin-bottom: 3px;">ПУ не в опросе</div>
                                    <div style="font-weight: 900; color: var(--danger); font-size: 14px;" id="not_in_survey_${res.id}">0</div>
                                </div>
                                <div style="text-align: center; padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                                    <div style="font-weight: 600; margin-bottom: 3px;">СПОДЭС не в опросе</div>
                                    <div style="font-weight: 900; color: var(--danger); font-size: 14px;" id="spo_not_in_survey_${res.id}">0</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                container.appendChild(card);
            });
        } catch (error) {
            console.error('Ошибка инициализации сетки ввода:', error);
            this.showNotification('Ошибка создания формы ввода', 'danger');
        }
    }
    
    calculatePercentages(resId) {
        try {
            const total = parseInt(document.getElementById(`total_${resId}`)?.value) || 0;
            const survey = parseInt(document.getElementById(`survey_${resId}`)?.value) || 0;
            const totalSpo = parseInt(document.getElementById(`total_spo_${resId}`)?.value) || 0;
            const surveySpo = parseInt(document.getElementById(`survey_spo_${resId}`)?.value) || 0;
            
            let hasError = false;
            
            if (survey > total) {
                document.getElementById(`survey_${resId}`).classList.add('error');
                hasError = true;
            } else {
                document.getElementById(`survey_${resId}`).classList.remove('error');
            }
            
            if (surveySpo > totalSpo) {
                document.getElementById(`survey_spo_${resId}`).classList.add('error');
                hasError = true;
            } else {
                document.getElementById(`survey_spo_${resId}`).classList.remove('error');
            }
            
            if (totalSpo > total) {
                document.getElementById(`total_spo_${resId}`).classList.add('error');
                hasError = true;
            } else {
                document.getElementById(`total_spo_${resId}`).classList.remove('error');
            }
            
            if (hasError) return false;
            
            const percent = total > 0 ? (survey / total) * 100 : 0;
            const percentSpo = totalSpo > 0 ? (surveySpo / totalSpo) * 100 : 0;
            const notInSurvey = Math.max(0, total - survey);
            const spoNotInSurvey = Math.max(0, totalSpo - surveySpo);
            
            const percentElement = document.getElementById(`percent_${resId}`);
            const percentSpoElement = document.getElementById(`percent_spo_${resId}`);
            const progressElement = document.getElementById(`progress_${resId}`);
            const notInSurveyElement = document.getElementById(`not_in_survey_${resId}`);
            const spoNotInSurveyElement = document.getElementById(`spo_not_in_survey_${resId}`);
            
            if (percentElement) percentElement.textContent = percent.toFixed(2) + '%';
            if (percentSpoElement) percentSpoElement.textContent = percentSpo.toFixed(2) + '%';
            if (progressElement) progressElement.style.width = Math.min(percent, 100) + '%';
            if (notInSurveyElement) notInSurveyElement.textContent = notInSurvey.toLocaleString();
            if (spoNotInSurveyElement) spoNotInSurveyElement.textContent = spoNotInSurvey.toLocaleString();
            
            return true;
        } catch (error) {
            console.error('Ошибка расчета процентов:', error);
            return false;
        }
    }
    
    validateAllInputs() {
        let isValid = true;
        AppConfig.RES_LIST.forEach(res => {
            if (!this.calculatePercentages(res.id)) {
                isValid = false;
            }
        });
        return isValid;
    }
    
    async autofillFromPrevious() {
        if (!this.currentUser?.permissions?.includes('edit')) {
            this.showNotification('У вас нет прав на редактирование данных!', 'warning');
            return;
        }
        
        if (this.weeklyData.length === 0) {
            this.showNotification('Нет предыдущих данных для автозаполнения', 'warning');
            return;
        }
        
        const lastWeek = this.weeklyData[0];
        lastWeek.data.forEach(item => {
            const resId = item.id;
            const totalInput = document.getElementById(`total_${resId}`);
            const surveyInput = document.getElementById(`survey_${resId}`);
            const totalSpoInput = document.getElementById(`total_spo_${resId}`);
            const surveySpoInput = document.getElementById(`survey_spo_${resId}`);
            
            if (totalInput) totalInput.value = item.total;
            if (surveyInput) surveyInput.value = item.survey;
            if (totalSpoInput) totalSpoInput.value = item.totalSpo;
            if (surveySpoInput) surveySpoInput.value = item.surveySpo;
            
            this.calculatePercentages(resId);
        });
        
        this.showNotification('Форма заполнена из последних данных', 'success');
    }
    
    async saveData() {
        try {
            if (!this.currentUser?.permissions?.includes('edit')) {
                this.showNotification('У вас нет прав на сохранение данных!', 'warning');
                return;
            }

            const dateInput = document.getElementById('dateInput');
            const date = dateInput ? dateInput.value : '';
            
            if (!date) {
                this.showNotification('Пожалуйста, укажите дату!', 'warning');
                return;
            }

            if (!this.validateAllInputs()) {
                this.showNotification('Исправьте ошибки в данных!', 'danger');
                return;
            }

            const weekData = {
                date: date,
                timestamp: new Date(date).getTime(),
                data: []
            };

            let hasData = false;
            
            AppConfig.RES_LIST.forEach(res => {
                const total = parseInt(document.getElementById(`total_${res.id}`)?.value) || 0;
                const survey = parseInt(document.getElementById(`survey_${res.id}`)?.value) || 0;
                const totalSpo = parseInt(document.getElementById(`total_spo_${res.id}`)?.value) || 0;
                const surveySpo = parseInt(document.getElementById(`survey_spo_${res.id}`)?.value) || 0;

                if (total > 0 || survey > 0) {
                    hasData = true;
                }

                const percent = total > 0 ? (survey / total) : 0;
                const percentSpo = totalSpo > 0 ? (surveySpo / totalSpo) : 0;
                const notInSurvey = Math.max(0, total - survey);
                const spoNotInSurvey = Math.max(0, totalSpo - surveySpo);

                weekData.data.push({
                    id: res.id,
                    name: res.name,
                    total: total,
                    survey: survey,
                    notInSurvey: notInSurvey,
                    spoNotInSurvey: spoNotInSurvey,
                    percent: isFinite(percent) ? percent : 0,
                    totalSpo: totalSpo,
                    surveySpo: surveySpo,
                    percentSpo: isFinite(percentSpo) ? percentSpo : 0,
                    percentDisplay: (isFinite(percent) ? percent * 100 : 0).toFixed(2),
                    percentSpoDisplay: (isFinite(percentSpo) ? percentSpo * 100 : 0).toFixed(2),
                    isPsRes: res.id === 'ps'
                });
            });

            if (!hasData) {
                this.showNotification('Пожалуйста, введите данные хотя бы для одного ФЭС!', 'warning');
                return;
            }

            // Сохраняем в базу данных
            const response = await fetch(`${this.apiBaseUrl}/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    date: weekData.date,
                    data: weekData.data
                })
            });

            if (!response.ok) {
                throw new Error('Ошибка сохранения данных');
            }

            await this.loadData();
            
            this.updateStats();
            this.updateDetailedTable();
            this.updateChart();
            this.updateHistoryTable();
            this.updateReportDates();
            this.updateStatisticsSelects();
            
            this.clearForm();
            
            this.showNotification(`Данные за ${this.formatDate(new Date(date))} успешно сохранены!`, 'success');
            
        } catch (error) {
            console.error('Ошибка сохранения данных:', error);
            this.showNotification('Ошибка сохранения данных', 'danger');
        }
    }
    
    clearForm() {
        try {
            AppConfig.RES_LIST.forEach(res => {
                const totalInput = document.getElementById(`total_${res.id}`);
                const surveyInput = document.getElementById(`survey_${res.id}`);
                const totalSpoInput = document.getElementById(`total_spo_${res.id}`);
                const surveySpoInput = document.getElementById(`survey_spo_${res.id}`);
                
                if (totalInput) totalInput.value = '';
                if (surveyInput) surveyInput.value = '';
                if (totalSpoInput) totalSpoInput.value = '';
                if (surveySpoInput) surveySpoInput.value = '';
                
                this.calculatePercentages(res.id);
            });
            
            const dateInput = document.getElementById('dateInput');
            if (dateInput && this.weeklyData.length > 0) {
                const lastDate = new Date(this.weeklyData[0].date);
                const nextWeek = new Date(lastDate);
                nextWeek.setDate(lastDate.getDate() + 7);
                dateInput.value = nextWeek.toISOString().split('T')[0];
            } else {
                this.setDefaultDate();
            }
            
        } catch (error) {
            console.error('Ошибка очистки формы:', error);
            this.showNotification('Ошибка очистки формы', 'danger');
        }
    }
    
    async loadData() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/data`);
            if (response.ok) {
                this.weeklyData = await response.json();
                this.weeklyData.sort((a, b) => b.timestamp - a.timestamp);
            }
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            this.weeklyData = [];
        }
    }
    
    updateStats() {
        const container = document.getElementById('statsGrid');
        if (!container) return;
        
        try {
            if (this.weeklyData.length === 0) {
                container.innerHTML = `
                    <div class="stat-card" style="grid-column: 1 / -1;">
                        <div class="empty-state" style="padding: 40px 20px;">
                            <div class="empty-state-icon">
                                <i class="fas fa-database"></i>
                            </div>
                            <div class="empty-state-title">Нет статистических данных</div>
                            <div class="empty-state-description">
                                Добавьте данные на вкладке "Ввод данных" для создания статистики
                            </div>
                        </div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = '';
            
            const currentWeek = this.weeklyData[0];
            const bestRES = this.findBestRES(currentWeek);
            const worstRES = this.findWorstRES(currentWeek);
            
            const card1 = this.createCurrentWeekCard(currentWeek, bestRES, worstRES);
            container.appendChild(card1);
            
            const lastTwoWeeks = this.weeklyData.slice(1, 3);
            
            lastTwoWeeks.forEach((week, index) => {
                const bestRESWeek = this.findBestRES(week);
                const worstRESWeek = this.findWorstRES(week);
                const card = this.createPreviousWeekCard(week, index + 1, bestRESWeek, worstRESWeek);
                container.appendChild(card);
            });
            
            if (this.weeklyData.length > 1) {
                const bestWeek = this.findBestWeek();
                if (bestWeek) {
                    const bestRESBestWeek = this.findBestRES(bestWeek);
                    const worstRESBestWeek = this.findWorstRES(bestWeek);
                    const bestCard = this.createBestPerformanceCard(bestWeek, bestRESBestWeek, worstRESBestWeek);
                    container.appendChild(bestCard);
                }
            }
            
            if (this.weeklyData.length >= 2) {
                const changesCard = this.createChangesCard();
                container.appendChild(changesCard);
            }
            
        } catch (error) {
            console.error('Ошибка обновления статистики:', error);
        }
    }
    
    createCurrentWeekCard(weekData, bestRES, worstRES) {
        const card = document.createElement('div');
        card.className = 'stat-card';
        
        const filteredData = weekData.data.filter(item => !item.isPsRes);
        const totalSurvey = filteredData.reduce((sum, item) => sum + item.survey, 0);
        const totalPU = filteredData.reduce((sum, item) => sum + item.total, 0);
        const avgPercent = totalPU > 0 ? (totalSurvey / totalPU) * 100 : 0;
        
        const totalSpoSurvey = filteredData.reduce((sum, item) => sum + item.surveySpo, 0);
        const totalSpo = filteredData.reduce((sum, item) => sum + item.totalSpo, 0);
        const avgSpoPercent = totalSpo > 0 ? (totalSpoSurvey / totalSpo) * 100 : 0;
        
        const notInSurvey = filteredData.reduce((sum, item) => sum + item.notInSurvey, 0);
        const spoNotInSurvey = filteredData.reduce((sum, item) => sum + item.spoNotInSurvey, 0);
        
        card.innerHTML = `
            <div class="stat-header">
                <div class="stat-title">
                    <div class="stat-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div>
                        <div>Текущая неделя</div>
                        <div class="stat-date">${this.formatDate(new Date(weekData.date))}</div>
                    </div>
                </div>
            </div>
            <div class="stat-content">
                <div class="stat-main">
                    <div class="stat-values">
                        <div class="stat-value-row">
                            <span class="stat-value-label">Средний % опроса:</span>
                            <span class="stat-value current">${avgPercent.toFixed(2)}%</span>
                        </div>
                        <div class="stat-value-row">
                            <span class="stat-value-label">Лучший показатель:</span>
                            <span class="stat-value best">${(bestRES.percent * 100).toFixed(2)}%</span>
                        </div>
                        <div class="stat-value-row">
                            <span class="stat-value-label">Худший показатель:</span>
                            <span class="stat-value worst">${(worstRES.percent * 100).toFixed(2)}%</span>
                        </div>
                    </div>
                    <div class="stat-details" style="margin-top: 15px;">
                        <div class="stat-detail-item">
                            <div class="stat-detail-value" style="color: var(--success);">${totalSurvey.toLocaleString()}</div>
                            <div class="stat-detail-label">ПУ в опросе</div>
                        </div>
                        <div class="stat-detail-item">
                            <div class="stat-detail-value" style="color: var(--danger);">${notInSurvey.toLocaleString()}</div>
                            <div class="stat-detail-label">ПУ не в опросе</div>
                        </div>
                        <div class="stat-detail-item">
                            <div class="stat-detail-value" style="color: var(--info);">${totalSpoSurvey.toLocaleString()}</div>
                            <div class="stat-detail-label">СПОДЭС в опросе</div>
                        </div>
                        <div class="stat-detail-item">
                            <div class="stat-detail-value" style="color: var(--warning);">${spoNotInSurvey.toLocaleString()}</div>
                            <div class="stat-detail-label">СПОДЭС не в опросе</div>
                        </div>
                    </div>
                </div>
                <div class="stat-footer">
                    <div style="display: flex; gap: 10px; font-size: 12px;">
                        <span class="badge badge-best">Лучший: ${bestRES.name}</span>
                        <span class="badge badge-worst">Худший: ${worstRES.name}</span>
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="app.showWeekDetails('${weekData.date}')">
                        <i class="fas fa-eye"></i> Показать детали
                    </button>
                </div>
            </div>
        `;
        
        return card;
    }
    
    createPreviousWeekCard(weekData, weeksAgo, bestRES, worstRES) {
        const card = document.createElement('div');
        card.className = 'stat-card';
        
        const filteredData = weekData.data.filter(item => !item.isPsRes);
        const totalSurvey = filteredData.reduce((sum, item) => sum + item.survey, 0);
        const totalPU = filteredData.reduce((sum, item) => sum + item.total, 0);
        const avgPercent = totalPU > 0 ? (totalSurvey / totalPU) * 100 : 0;
        
        const icons = ['calendar-alt', 'calendar-day'];
        const colors = ['#0ea5e9', '#f59e0b'];
        const titles = ['Предыдущая неделя', '2 недели назад'];
        
        card.innerHTML = `
            <div class="stat-header">
                <div class="stat-title">
                    <div class="stat-icon">
                        <i class="fas fa-${icons[weeksAgo-1]}"></i>
                    </div>
                    <div>
                        <div>${titles[weeksAgo-1]}</div>
                        <div class="stat-date">${this.formatDate(new Date(weekData.date))}</div>
                    </div>
                </div>
            </div>
            <div class="stat-content">
                <div class="stat-main">
                    <div class="stat-values">
                        <div class="stat-value-row">
                            <span class="stat-value-label">Средний % опроса:</span>
                            <span class="stat-value" style="color: ${colors[weeksAgo-1]};">${avgPercent.toFixed(2)}%</span>
                        </div>
                        <div class="stat-value-row">
                            <span class="stat-value-label">Лучший показатель:</span>
                            <span class="stat-value" style="color: var(--success);">${(bestRES.percent * 100).toFixed(2)}%</span>
                        </div>
                        <div class="stat-value-row">
                            <span class="stat-value-label">Худший показатель:</span>
                            <span class="stat-value" style="color: var(--danger);">${(worstRES.percent * 100).toFixed(2)}%</span>
                        </div>
                    </div>
                    <div class="stat-details" style="margin-top: 15px;">
                        <div class="stat-detail-item">
                            <div class="stat-detail-value" style="color: var(--success);">${totalSurvey.toLocaleString()}</div>
                            <div class="stat-detail-label">ПУ в опросе</div>
                        </div>
                        <div class="stat-detail-item">
                            <div class="stat-detail-value" style="color: var(--danger);">${filteredData.reduce((sum, item) => sum + item.notInSurvey, 0).toLocaleString()}</div>
                            <div class="stat-detail-label">ПУ не в опросе</div>
                        </div>
                        <div class="stat-detail-item">
                            <div class="stat-detail-value" style="color: var(--info);">${filteredData.reduce((sum, item) => sum + item.surveySpo, 0).toLocaleString()}</div>
                            <div class="stat-detail-label">СПОДЭС в опросе</div>
                        </div>
                        <div class="stat-detail-item">
                            <div class="stat-detail-value" style="color: var(--warning);">${filteredData.reduce((sum, item) => sum + item.spoNotInSurvey, 0).toLocaleString()}</div>
                            <div class="stat-detail-label">СПОДЭС не в опросе</div>
                        </div>
                    </div>
                </div>
                <div class="stat-footer">
                    <div style="display: flex; gap: 10px; font-size: 12px;">
                        <span class="badge badge-best">Лучший: ${bestRES.name}</span>
                        <span class="badge badge-worst">Худший: ${worstRES.name}</span>
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="app.showWeekDetails('${weekData.date}')">
                        <i class="fas fa-eye"></i> Показать детали
                    </button>
                </div>
            </div>
        `;
        
        return card;
    }
    
    createBestPerformanceCard(bestWeek, bestRES, worstRES) {
        const card = document.createElement('div');
        card.className = 'stat-card';
        
        const filteredData = bestWeek.data.filter(item => !item.isPsRes);
        const totalSurvey = filteredData.reduce((sum, item) => sum + item.survey, 0);
        const totalPU = filteredData.reduce((sum, item) => sum + item.total, 0);
        const avgPercent = totalPU > 0 ? (totalSurvey / totalPU) * 100 : 0;
        
        card.innerHTML = `
            <div class="stat-header">
                <div class="stat-title">
                    <div class="stat-icon">
                        <i class="fas fa-trophy"></i>
                    </div>
                    <div>
                        <div>Рекордная неделя</div>
                        <div class="stat-date">${this.formatDate(new Date(bestWeek.date))}</div>
                    </div>
                </div>
            </div>
            <div class="stat-content">
                <div class="stat-main">
                    <div class="stat-values">
                        <div class="stat-value-row">
                            <span class="stat-value-label">Средний % опроса:</span>
                            <span class="stat-value" style="color: #10b981;">${avgPercent.toFixed(2)}%</span>
                        </div>
                        <div class="stat-value-row">
                            <span class="stat-value-label">Лучший показатель:</span>
                            <span class="stat-value" style="color: var(--success);">${(bestRES.percent * 100).toFixed(2)}%</span>
                        </div>
                        <div class="stat-value-row">
                            <span class="stat-value-label">Худший показатель:</span>
                            <span class="stat-value" style="color: var(--danger);">${(worstRES.percent * 100).toFixed(2)}%</span>
                        </div>
                    </div>
                    <div class="stat-details" style="margin-top: 15px;">
                        <div class="stat-detail-item">
                            <div class="stat-detail-value" style="color: var(--success);">${totalSurvey.toLocaleString()}</div>
                            <div class="stat-detail-label">Охвачено ПУ</div>
                        </div>
                        <div class="stat-detail-item">
                            <div class="stat-detail-value" style="color: #10b981;">${(filteredData.reduce((sum, item) => sum + item.surveySpo, 0) / filteredData.reduce((sum, item) => sum + item.totalSpo, 0) * 100 || 0).toFixed(2)}%</div>
                            <div class="stat-detail-label">% СПОДЭС</div>
                        </div>
                        <div class="stat-detail-item">
                            <div class="stat-detail-value" style="color: var(--success);">${bestRES.name}</div>
                            <div class="stat-detail-label">Лучший ФЭС</div>
                        </div>
                        <div class="stat-detail-item">
                            <div class="stat-detail-value" style="color: var(--danger);">${worstRES.name}</div>
                            <div class="stat-detail-label">Худший ФЭС</div>
                        </div>
                    </div>
                </div>
                <div class="stat-footer">
                    <button class="btn btn-outline btn-sm" onclick="app.showWeekDetails('${bestWeek.date}')">
                        <i class="fas fa-eye"></i> Показать детали
                    </button>
                </div>
            </div>
        `;
        
        return card;
    }
    
    createChangesCard() {
        const card = document.createElement('div');
        card.className = 'stat-card';
        
        if (this.weeklyData.length < 2) {
            card.innerHTML = `
                <div class="stat-header">
                    <div class="stat-title">
                        <div class="stat-icon">
                            <i class="fas fa-exchange-alt"></i>
                        </div>
                        <div>
                            <div>Изменения ПУ</div>
                            <div class="stat-date">Недостаточно данных</div>
                        </div>
                    </div>
                </div>
                <div class="stat-content">
                    <div class="empty-state" style="padding: 20px 0;">
                        <div class="empty-state-icon" style="font-size: 32px;">
                            <i class="fas fa-info-circle"></i>
                        </div>
                        <div class="empty-state-description" style="font-size: 13px;">
                            Нужно минимум 2 недели данных для анализа изменений
                        </div>
                    </div>
                </div>
            `;
            return card;
        }
        
        const currentWeek = this.weeklyData[0];
        const previousWeek = this.weeklyData[1];
        
        const currentTotal = currentWeek.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.total, 0);
        const previousTotal = previousWeek.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.total, 0);
        const totalChange = currentTotal - previousTotal;
        
        const currentSurvey = currentWeek.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.survey, 0);
        const previousSurvey = previousWeek.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.survey, 0);
        const surveyChange = currentSurvey - previousSurvey;
        
        const currentSpoTotal = currentWeek.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.totalSpo, 0);
        const previousSpoTotal = previousWeek.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.totalSpo, 0);
        const spoTotalChange = currentSpoTotal - previousSpoTotal;
        
        const currentSpoSurvey = currentWeek.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.surveySpo, 0);
        const previousSpoSurvey = previousWeek.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.surveySpo, 0);
        const spoSurveyChange = currentSpoSurvey - previousSpoSurvey;
        
        card.innerHTML = `
            <div class="stat-header">
                <div class="stat-title">
                    <div class="stat-icon">
                        <i class="fas fa-exchange-alt"></i>
                    </div>
                    <div>
                        <div>Изменения ПУ</div>
                        <div class="stat-date">за прошедшую неделю</div>
                    </div>
                </div>
            </div>
            <div class="stat-content">
                <div class="stat-main">
                    <div class="stat-values">
                        <div class="stat-value-row">
                            <span class="stat-value-label">Всего ПУ:</span>
                            <span class="stat-value" style="color: ${totalChange > 0 ? 'var(--success)' : totalChange < 0 ? 'var(--danger)' : 'var(--gray)'};">
                                ${totalChange > 0 ? '+' : ''}${totalChange.toLocaleString()}
                            </span>
                        </div>
                        <div class="stat-value-row">
                            <span class="stat-value-label">ПУ в опросе:</span>
                            <span class="stat-value" style="color: ${surveyChange > 0 ? 'var(--success)' : surveyChange < 0 ? 'var(--danger)' : 'var(--gray)'};">
                                ${surveyChange > 0 ? '+' : ''}${surveyChange.toLocaleString()}
                            </span>
                        </div>
                        <div class="stat-value-row">
                            <span class="stat-value-label">СПОДЭС ПУ:</span>
                            <span class="stat-value" style="color: ${spoTotalChange > 0 ? 'var(--success)' : spoTotalChange < 0 ? 'var(--danger)' : 'var(--gray)'};">
                                ${spoTotalChange > 0 ? '+' : ''}${spoTotalChange.toLocaleString()}
                            </span>
                        </div>
                        <div class="stat-value-row">
                            <span class="stat-value-label">СПОДЭС в опросе:</span>
                            <span class="stat-value" style="color: ${spoSurveyChange > 0 ? 'var(--success)' : spoSurveyChange < 0 ? 'var(--danger)' : 'var(--gray)'};">
                                ${spoSurveyChange > 0 ? '+' : ''}${spoSurveyChange.toLocaleString()}
                            </span>
                        </div>
                    </div>
                    <div class="stat-details" style="margin-top: 15px;">
                        <div class="stat-detail-item">
                            <div class="stat-detail-value" style="color: ${totalChange > 0 ? 'var(--success)' : totalChange < 0 ? 'var(--danger)' : 'var(--gray)'};">
                                ${totalChange > 0 ? '+' : ''}${totalChange}
                            </div>
                            <div class="stat-detail-label">Δ Всего ПУ</div>
                        </div>
                        <div class="stat-detail-item">
                            <div class="stat-detail-value" style="color: ${surveyChange > 0 ? 'var(--success)' : surveyChange < 0 ? 'var(--danger)' : 'var(--gray)'};">
                                ${surveyChange > 0 ? '+' : ''}${surveyChange}
                            </div>
                            <div class="stat-detail-label">Δ ПУ в опросе</div>
                        </div>
                        <div class="stat-detail-item">
                            <div class="stat-detail-value">${currentTotal.toLocaleString()}</div>
                            <div class="stat-detail-label">Текущие ПУ</div>
                        </div>
                        <div class="stat-detail-item">
                            <div class="stat-detail-value">${currentSurvey.toLocaleString()}</div>
                            <div class="stat-detail-label">Текущие в опросе</div>
                        </div>
                    </div>
                </div>
                <div class="stat-footer">
                    <div style="display: flex; gap: 8px; font-size: 12px;">
                        <span class="badge ${totalChange > 0 ? 'badge-positive' : totalChange < 0 ? 'badge-negative' : 'badge-neutral'}">
                            Всего ПУ: ${totalChange > 0 ? '+' : ''}${totalChange}
                        </span>
                        <span class="badge ${surveyChange > 0 ? 'badge-positive' : surveyChange < 0 ? 'badge-negative' : 'badge-neutral'}">
                            В опросе: ${surveyChange > 0 ? '+' : ''}${surveyChange}
                        </span>
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="app.showComparisonDetails('${currentWeek.date}', '${previousWeek.date}')">
                        <i class="fas fa-chart-line"></i> Детали изменений
                    </button>
                </div>
            </div>
        `;
        
        return card;
    }
    
    findBestWeek() {
        if (this.weeklyData.length === 0) return null;
        
        let bestWeek = this.weeklyData[0];
        let bestAvg = 0;
        
        this.weeklyData.forEach(week => {
            const filteredData = week.data.filter(item => !item.isPsRes);
            const totalSurvey = filteredData.reduce((sum, item) => sum + item.survey, 0);
            const totalPU = filteredData.reduce((sum, item) => sum + item.total, 0);
            const avgPercent = totalPU > 0 ? (totalSurvey / totalPU) * 100 : 0;
            
            if (avgPercent > bestAvg) {
                bestAvg = avgPercent;
                bestWeek = week;
            }
        });
        
        return bestWeek;
    }
    
    findBestRES(weekData) {
        if (!weekData || !weekData.data.length) return { name: 'Нет данных', percent: 0, isPsRes: true };
        
        const filteredData = weekData.data.filter(item => !item.isPsRes);
        if (filteredData.length === 0) return { name: 'Нет данных', percent: 0, isPsRes: true };
        
        let bestRES = filteredData[0];
        
        filteredData.forEach(item => {
            if (item.percent > bestRES.percent) {
                bestRES = item;
            }
        });
        
        return bestRES;
    }
    
    findWorstRES(weekData) {
        if (!weekData || !weekData.data.length) return { name: 'Нет данных', percent: 0, isPsRes: true };
        
        const filteredData = weekData.data.filter(item => !item.isPsRes);
        if (filteredData.length === 0) return { name: 'Нет данных', percent: 0, isPsRes: true };
        
        let worstRES = filteredData[0];
        
        filteredData.forEach(item => {
            if (item.percent < worstRES.percent) {
                worstRES = item;
            }
        });
        
        return worstRES;
    }
    
    showWeekDetails(date) {
        const weekData = this.weeklyData.find(w => w.date === date);
        if (!weekData) return;
        
        this.updateDetailedTable(date);
        this.showTab({ currentTarget: document.querySelector('[data-tab="stats"]') });
        
        const weekLabel = document.getElementById('currentWeekLabel');
        if (weekLabel) {
            weekLabel.textContent = `(${this.formatDate(new Date(date))})`;
        }
    }
    
    showComparisonDetails(date1, date2) {
        this.generateComparisonReport(date1, date2);
    }
    
    updateDetailedTable(date = null) {
        const tbody = document.getElementById('detailedTableBody');
        const weekLabel = document.getElementById('currentWeekLabel');
        
        if (!tbody) return;
        
        try {
            tbody.innerHTML = '';
            
            let weekData;
            if (date) {
                weekData = this.weeklyData.find(w => w.date === date);
            } else {
                weekData = this.weeklyData[0];
            }
            
            if (!weekData) {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td colspan="11">
                        <div class="empty-state" style="padding: 40px 20px;">
                            <div class="empty-state-icon">
                                <i class="fas fa-database"></i>
                            </div>
                            <div class="empty-state-title">Нет данных для отображения</div>
                            <div class="empty-state-description">
                                Добавьте данные на вкладке "Ввод данных" для отображения статистики
                            </div>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
                
                if (weekLabel) weekLabel.textContent = '';
                return;
            }
            
            if (weekLabel) {
                weekLabel.textContent = `(${this.formatDate(new Date(weekData.date))})`;
            }
            
            const filteredData = weekData.data.filter(item => !item.isPsRes);
            const sortedData = [...filteredData].sort((a, b) => b.percent - a.percent);
            
            sortedData.forEach((item, index) => {
                const res = AppConfig.RES_LIST.find(r => r.id === item.id);
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="number-cell">${index + 1}</td>
                    <td class="res-name" style="color: ${res.color}; font-weight: 900;">
                        <i class="fas fa-bolt" style="margin-right: 8px; color: ${res.color};"></i>
                        ${item.name}
                    </td>
                    <td style="font-weight: 700;">${item.total.toLocaleString()}</td>
                    <td style="color: var(--success); font-weight: 900;">${item.survey.toLocaleString()}</td>
                    <td style="color: var(--danger); font-weight: 900;">${item.notInSurvey.toLocaleString()}</td>
                    <td class="percentage-cell" style="color: ${this.getColorByPercentage(item.percent * 100)}; font-weight: 900;">
                        ${(item.percent * 100).toFixed(2)}%
                    </td>
                    <td class="progress-cell">
                        <div class="progress-bar-inline">
                            <div class="progress-fill" style="width: ${Math.min(item.percent * 100, 100)}%; background: ${res.color};"></div>
                        </div>
                        <div style="font-size: 11px; color: var(--gray); margin-top: 4px; text-align: center; font-weight: 600;">
                            ${(item.percent * 100).toFixed(1)}%
                        </div>
                    </td>
                    <td style="font-weight: 700;">${item.totalSpo.toLocaleString()}</td>
                    <td style="color: var(--success); font-weight: 900;">${item.surveySpo.toLocaleString()}</td>
                    <td style="color: var(--danger); font-weight: 900;">${item.spoNotInSurvey.toLocaleString()}</td>
                    <td class="percentage-cell" style="color: ${this.getColorByPercentage(item.percentSpo * 100)}; font-weight: 900;">
                        ${(item.percentSpo * 100).toFixed(2)}%
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            const psResData = weekData.data.find(item => item.isPsRes);
            if (psResData) {
                const res = AppConfig.RES_LIST.find(r => r.id === 'ps');
                const row = document.createElement('tr');
                row.style.backgroundColor = '#f8fafc';
                row.innerHTML = `
                    <td class="number-cell" style="border-right: 2px solid var(--gray);">8</td>
                    <td class="res-name" style="color: ${res.color}; font-weight: 900; border-left: 3px solid ${res.color};">
                        <i class="fas fa-building" style="margin-right: 8px; color: ${res.color};"></i>
                        ${psResData.name}
                        <span style="font-size: 11px; color: var(--gray); background: #e2e8f0; padding: 2px 6px; border-radius: 10px; margin-left: 8px;">
                            не в общем %
                        </span>
                    </td>
                    <td style="font-weight: 700;">${psResData.total.toLocaleString()}</td>
                    <td style="color: var(--success); font-weight: 900;">${psResData.survey.toLocaleString()}</td>
                    <td style="color: var(--danger); font-weight: 900;">${psResData.notInSurvey.toLocaleString()}</td>
                    <td class="percentage-cell" style="color: ${this.getColorByPercentage(psResData.percent * 100)}; font-weight: 900;">
                        ${(psResData.percent * 100).toFixed(2)}%
                    </td>
                    <td class="progress-cell">
                        <div class="progress-bar-inline">
                            <div class="progress-fill" style="width: ${Math.min(psResData.percent * 100, 100)}%; background: ${res.color};"></div>
                        </div>
                        <div style="font-size: 11px; color: var(--gray); margin-top: 4px; text-align: center; font-weight: 600;">
                            ${(psResData.percent * 100).toFixed(1)}%
                        </div>
                    </td>
                    <td style="font-weight: 700;">${psResData.totalSpo.toLocaleString()}</td>
                    <td style="color: var(--success); font-weight: 900;">${psResData.surveySpo.toLocaleString()}</td>
                    <td style="color: var(--danger); font-weight: 900;">${psResData.spoNotInSurvey.toLocaleString()}</td>
                    <td class="percentage-cell" style="color: ${this.getColorByPercentage(psResData.percentSpo * 100)}; font-weight: 900;">
                        ${(psResData.percentSpo * 100).toFixed(2)}%
                    </td>
                `;
                tbody.appendChild(row);
            }
            
        } catch (error) {
            console.error('Ошибка обновления детальной таблицы:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center" style="color: var(--danger); padding: 40px;">
                        <i class="fas fa-exclamation-triangle"></i> Ошибка загрузки данных
                    </td>
                </tr>
            `;
        }
    }
    
    getColorByPercentage(percent) {
        if (percent >= 95) return 'var(--success)';
        if (percent >= 90) return 'var(--warning)';
        if (percent >= 85) return '#f97316';
        return 'var(--danger)';
    }
    
    updateChart() {
        try {
            if (this.weeklyData.length < 2) {
                if (this.verticalChart) {
                    this.verticalChart.destroy();
                    this.verticalChart = null;
                }
                return;
            }
            
            const canvas = document.getElementById('verticalChart');
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            
            const chartData = this.weeklyData.slice(0, 4).reverse();
            const dates = chartData.map(d => this.formatDate(new Date(d.date)));
            
            const resNames = AppConfig.RES_LIST.filter(res => res.id !== 'ps').map(res => res.name);
            const datasets = chartData.map((week, weekIndex) => {
                const data = AppConfig.RES_LIST.filter(res => res.id !== 'ps').map(res => {
                    const weekRes = week.data.find(w => w.id === res.id);
                    return weekRes ? weekRes.percent * 100 : 0;
                });
                
                return {
                    label: dates[weekIndex],
                    data: data,
                    backgroundColor: this.getColorForWeek(weekIndex),
                    borderColor: this.getColorForWeek(weekIndex),
                    borderWidth: 1
                };
            });
            
            if (this.verticalChart) {
                this.verticalChart.destroy();
                this.verticalChart = null;
            }
            
            this.verticalChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: resNames,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                },
                                font: {
                                    size: 12,
                                    weight: '600'
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            },
                            title: {
                                display: true,
                                text: 'Процент опроса (%)',
                                font: {
                                    size: 14,
                                    weight: '800'
                                }
                            }
                        },
                        x: {
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            },
                            ticks: {
                                font: {
                                    size: 11,
                                    weight: '600'
                                },
                                maxRotation: 45
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `${context.dataset.label}: ${context.raw?.toFixed(2) || '0.00'}%`;
                                }
                            }
                        },
                        legend: {
                            position: 'top',
                            labels: {
                                font: {
                                    size: 12,
                                    weight: '600'
                                }
                            }
                        }
                    },
                    barPercentage: 0.8,
                    categoryPercentage: 0.9
                }
            });
        } catch (error) {
            console.error('Ошибка создания графика:', error);
        }
    }
    
    getColorForWeek(weekIndex) {
        const colors = [
            'rgba(30, 64, 175, 0.7)',
            'rgba(14, 165, 233, 0.7)',
            'rgba(245, 158, 11, 0.7)',
            'rgba(16, 185, 129, 0.7)'
        ];
        return colors[weekIndex] || 'rgba(100, 116, 139, 0.7)';
    }
    
    updateHistoryTable() {
        const container = document.getElementById('historyContainer');
        if (!container) return;
        
        try {
            if (this.weeklyData.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <i class="fas fa-database"></i>
                        </div>
                        <div class="empty-state-title">История данных пуста</div>
                        <div class="empty-state-description">
                            Добавьте данные на вкладке "Ввод данных" чтобы они появились в истории
                        </div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = '';
            
            this.weeklyData.forEach((week, index) => {
                const dateGroup = document.createElement('div');
                dateGroup.className = 'history-date-group';
                
                const filteredData = week.data.filter(item => !item.isPsRes);
                const totalSurvey = filteredData.reduce((sum, item) => sum + item.survey, 0);
                const totalPU = filteredData.reduce((sum, item) => sum + item.total, 0);
                const avgPercent = totalPU > 0 ? (totalSurvey / totalPU) * 100 : 0;
                
                const dateHeader = document.createElement('div');
                dateHeader.className = 'history-date-header';
                dateHeader.innerHTML = `
                    <div class="history-date-title">
                        <i class="far fa-calendar-alt"></i>
                        ${this.formatDate(new Date(week.date))}
                        <span style="font-size: 13px; color: var(--gray); font-weight: 600; margin-left: 10px;">
                            ${totalSurvey.toLocaleString()} ПУ опрошено (${avgPercent.toFixed(2)}%)
                        </span>
                    </div>
                    <div style="font-size: 13px; color: var(--gray); background: white; padding: 5px 12px; border-radius: 20px; border: 1px solid #e2e8f0; font-weight: 600;">
                        Неделя ${index + 1}
                    </div>
                `;
                
                dateHeader.addEventListener('click', () => {
                    const table = dateGroup.querySelector('.history-table');
                    if (table.style.display === 'none' || table.style.display === '') {
                        table.style.display = 'table';
                        dateHeader.querySelector('i').className = 'far fa-calendar-minus';
                    } else {
                        table.style.display = 'none';
                        dateHeader.querySelector('i').className = 'far fa-calendar-alt';
                    }
                });
                
                dateGroup.appendChild(dateHeader);
                
                const table = document.createElement('table');
                table.className = 'history-table';
                table.style.display = 'none';
                
                let tableHTML = `
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>ФЭС</th>
                            <th>Всего ПУ</th>
                            <th>В опросе</th>
                            <th>Не в опросе</th>
                            <th>% опроса</th>
                            <th>СПОДЭС ПУ</th>
                            <th>СПОДЭС в опросе</th>
                            <th>СПОДЭС не в опросе</th>
                            <th>% СПОДЭС</th>
                        </tr>
                    </thead>
                    <tbody>
                `;
                
                const sortedData = [...week.data].sort((a, b) => {
                    if (a.isPsRes) return 1;
                    if (b.isPsRes) return -1;
                    return b.percent - a.percent;
                });
                
                sortedData.forEach((item, idx) => {
                    const res = AppConfig.RES_LIST.find(r => r.id === item.id);
                    const number = item.isPsRes ? 8 : idx + 1;
                    
                    tableHTML += `
                        <tr ${item.isPsRes ? 'style="background-color: #f8fafc;"' : ''}>
                            <td style="font-weight: 700; color: ${item.isPsRes ? 'var(--gray)' : 'var(--primary)'};">${number}</td>
                            <td style="font-weight: 700; color: ${res.color};">${item.name}</td>
                            <td>${item.total.toLocaleString()}</td>
                            <td style="color: var(--success); font-weight: 700;">${item.survey.toLocaleString()}</td>
                            <td style="color: var(--danger); font-weight: 700;">${item.notInSurvey.toLocaleString()}</td>
                            <td style="font-weight: 800; color: ${this.getColorByPercentage(item.percent * 100)};">
                                ${(item.percent * 100).toFixed(2)}%
                            </td>
                            <td>${item.totalSpo.toLocaleString()}</td>
                            <td>${item.surveySpo.toLocaleString()}</td>
                            <td style="color: var(--danger); font-weight: 700;">${item.spoNotInSurvey.toLocaleString()}</td>
                            <td style="font-weight: 800; color: ${this.getColorByPercentage(item.percentSpo * 100)};">
                                ${(item.percentSpo * 100).toFixed(2)}%
                            </td>
                        </tr>
                    `;
                });
                
                tableHTML += '</tbody>';
                table.innerHTML = tableHTML;
                dateGroup.appendChild(table);
                container.appendChild(dateGroup);
            });
        } catch (error) {
            console.error('Ошибка обновления истории:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="empty-state-title">Ошибка загрузки истории</div>
                </div>
            `;
        }
    }
    
    async clearAllData() {
        try {
            if (!this.currentUser?.permissions?.includes('delete')) {
                this.showNotification('У вас нет прав на удаление данных!', 'warning');
                return;
            }
            
            if (!confirm('ВЫ УВЕРЕНЫ, ЧТО ХОТИТЕ УДАЛИТЬ ВСЕ ДАННЫЕ?\n\nЭто действие нельзя отменить. Все данные будут удалены безвозвратно.')) {
                return;
            }
            
            const response = await fetch(`${this.apiBaseUrl}/data`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Ошибка удаления данных');
            }
            
            this.weeklyData = [];
            
            this.updateStats();
            this.updateDetailedTable();
            this.updateHistoryTable();
            this.updateReportDates();
            this.updateStatisticsSelects();
            
            if (this.verticalChart) {
                this.verticalChart.destroy();
                this.verticalChart = null;
            }
            
            this.showNotification('Все данные успешно очищены!', 'info');
        } catch (error) {
            console.error('Ошибка очистки данных:', error);
            this.showNotification('Ошибка очистки данных', 'danger');
        }
    }
    
    updateReportDates() {
        const weeklyDate = document.getElementById('weeklyReportDate');
        const analyticalDate = document.getElementById('analyticalReportDate');
        const weekSelect = document.getElementById('reportWeekSelect');
        
        if (this.weeklyData.length > 0) {
            const latestDate = this.weeklyData[0].date;
            if (weeklyDate) weeklyDate.textContent = this.formatDate(new Date(latestDate));
            
            if (weekSelect) {
                weekSelect.innerHTML = '<option value="">Выберите неделю...</option>';
                this.weeklyData.forEach(week => {
                    const option = document.createElement('option');
                    option.value = week.date;
                    option.textContent = this.formatDate(new Date(week.date));
                    if (week.date === latestDate) {
                        option.selected = true;
                    }
                    weekSelect.appendChild(option);
                });
            }
        } else {
            if (weeklyDate) weeklyDate.textContent = '—';
            if (analyticalDate) analyticalDate.textContent = '—';
            if (weekSelect) weekSelect.innerHTML = '<option value="">Нет данных</option>';
        }
        
        if (this.weeklyData.length >= 4) {
            const firstDate = this.weeklyData[3].date;
            const lastDate = this.weeklyData[0].date;
            if (analyticalDate) {
                analyticalDate.textContent = `${this.formatDate(new Date(firstDate))} - ${this.formatDate(new Date(lastDate))}`;
            }
        } else if (analyticalDate) {
            analyticalDate.textContent = 'Недостаточно данных';
        }
    }
    
    updateStatisticsSelects() {
        const changesSelect = document.getElementById('changesWeekSelect');
        const comparisonWeek1Select = document.getElementById('comparisonWeek1Select');
        const comparisonWeek2Select = document.getElementById('comparisonWeek2Select');
        const changesDate = document.getElementById('changesReportDate');
        const comparisonDate = document.getElementById('comparisonReportDate');
        
        if (this.weeklyData.length > 0) {
            const latestDate = this.weeklyData[0].date;
            if (changesDate) changesDate.textContent = this.formatDate(new Date(latestDate));
            
            [changesSelect, comparisonWeek1Select, comparisonWeek2Select].forEach(select => {
                if (select) {
                    select.innerHTML = '<option value="">Выберите неделю...</option>';
                    this.weeklyData.forEach(week => {
                        const option = document.createElement('option');
                        option.value = week.date;
                        option.textContent = this.formatDate(new Date(week.date));
                        if (week.date === latestDate && (select === changesSelect || select === comparisonWeek1Select)) {
                            option.selected = true;
                        }
                        if (week.date === this.weeklyData[1]?.date && select === comparisonWeek2Select) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                }
            });
        } else {
            if (changesDate) changesDate.textContent = '—';
            if (comparisonDate) comparisonDate.textContent = '—';
            [changesSelect, comparisonWeek1Select, comparisonWeek2Select].forEach(select => {
                if (select) select.innerHTML = '<option value="">Нет данных</option>';
            });
        }
        
        if (this.weeklyData.length >= 2) {
            const firstDate = this.weeklyData[1].date;
            const lastDate = this.weeklyData[0].date;
            if (comparisonDate) {
                comparisonDate.textContent = `${this.formatDate(new Date(firstDate))} - ${this.formatDate(new Date(lastDate))}`;
            }
        } else if (comparisonDate) {
            comparisonDate.textContent = 'Недостаточно данных';
        }
    }
    
    updateReportDate(date) {
        const weeklyDate = document.getElementById('weeklyReportDate');
        if (weeklyDate && date) {
            weeklyDate.textContent = this.formatDate(new Date(date));
        }
    }
    
    exportToExcel() {
        try {
            if (!this.currentUser?.permissions?.includes('export')) {
                this.showNotification('У вас нет прав на экспорт данных!', 'warning');
                return;
            }
            
            if (this.weeklyData.length === 0) {
                this.showNotification('Нет данных для экспорта!', 'warning');
                return;
            }
            
            let csvContent = "data:text/csv;charset=utf-8,";
            
            csvContent += "Дата,ФЭС,Всего ПУ,ПУ в опросе,ПУ не в опросе,% опроса,СПОДЭС ПУ,СПОДЭС в опросе,СПОДЭС не в опросе,% СПОДЭС,Примечание\n";
            
            this.weeklyData.forEach(week => {
                const formattedDate = this.formatDate(new Date(week.date));
                week.data.forEach(item => {
                    const note = item.isPsRes ? "не в общем %" : "";
                    const row = [
                        formattedDate,
                        `"${item.name}"`,
                        item.total,
                        item.survey,
                        item.notInSurvey,
                        (item.percent * 100).toFixed(2),
                        item.totalSpo,
                        item.surveySpo,
                        item.spoNotInSurvey,
                        (item.percentSpo * 100).toFixed(2),
                        note
                    ];
                    csvContent += row.join(",") + "\n";
                });
            });
            
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `опрос_фес_${this.formatDate(new Date())}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification('Данные экспортированы в CSV!', 'success');
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            this.showNotification('Ошибка экспорта данных', 'danger');
        }
    }
    
    generateWeeklyReport() {
        try {
            if (!this.currentUser?.permissions?.includes('reports')) {
                this.showNotification('У вас нет прав на генерацию отчетов!', 'warning');
                return;
            }
            
            if (this.weeklyData.length === 0) {
                this.showNotification('Нет данных для отчета!', 'warning');
                return;
            }
            
            const weekSelect = document.getElementById('reportWeekSelect');
            let selectedDate = weekSelect ? weekSelect.value : '';
            
            let weekData;
            if (selectedDate) {
                weekData = this.weeklyData.find(w => w.date === selectedDate);
            } else {
                weekData = this.weeklyData[0];
            }
            
            if (!weekData) {
                this.showNotification('Не выбрана неделя для отчета!', 'warning');
                return;
            }
            
            const reportDate = this.formatDate(new Date(weekData.date));
            
            let htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Еженедельный отчет по опросу ФЭС</title>
                    <style>
                        body { font-family: 'Inter', Arial, sans-serif; margin: 25px; color: #1e293b; }
                        h1 { color: #1e40af; margin-bottom: 10px; font-size: 28px; font-weight: 900; }
                        h2 { color: #333; margin-top: 25px; font-size: 22px; font-weight: 800; }
                        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
                        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                        th { background-color: #f8fafc; font-weight: 700; }
                        .summary { background: #f1f5f9; padding: 20px; border-radius: 10px; margin: 20px 0; }
                        .footer { margin-top: 40px; font-size: 13px; color: #64748b; border-top: 1px solid #ddd; padding-top: 20px; }
                        .header-info { margin-bottom: 20px; }
                        .ps-res { background-color: #f8fafc; font-style: italic; }
                        .note { font-size: 12px; color: #64748b; margin-top: 5px; }
                    </style>
                </head>
                <body>
                    <div class="header-info">
                        <h1>Еженедельный отчет по опросу ФЭС</h1>
                        <p><strong>Отчет за неделю:</strong> ${reportDate}</p>
                        <p><strong>Дата формирования отчета:</strong> ${new Date().toLocaleString('ru-RU')}</p>
                        <p><strong>Сформировал:</strong> ${this.currentUser?.name || 'Неизвестно'}</p>
                        <p><strong>Роль:</strong> ${this.currentUser?.role === 'admin' ? 'Администратор' : 'Наблюдатель'}</p>
                        <p class="note"><strong>Примечание:</strong> ПС РЭС не учитывается в общих показателях опроса.</p>
                    </div>
                    
                    <div class="summary">
                        <h2>Итоги недели (без учета ПС РЭС)</h2>
                        <p>Всего опрошено ПУ: <strong>${weekData.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.survey, 0).toLocaleString()}</strong></p>
                        <p>Всего ПУ в системе: <strong>${weekData.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.total, 0).toLocaleString()}</strong></p>
                        <p>Средний процент опроса: <strong>${(weekData.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.survey, 0) / 
                            weekData.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.total, 0) * 100 || 0).toFixed(2)}%</strong></p>
                        <p>ПУ не в опросе: <strong>${weekData.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.notInSurvey, 0).toLocaleString()}</strong></p>
                        <p>СПОДЭС в опросе: <strong>${weekData.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.surveySpo, 0).toLocaleString()}</strong></p>
                        <p>СПОДЭС не в опросе: <strong>${weekData.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.spoNotInSurvey, 0).toLocaleString()}</strong></p>
                    </div>
                    
                    <h2>Детализация по ФЭС</h2>
                    <table>
                        <tr>
                            <th>№</th>
                            <th>ФЭС</th>
                            <th>Всего ПУ</th>
                            <th>В опросе</th>
                            <th>Не в опросе</th>
                            <th>% опроса</th>
                            <th>СПОДЭС ПУ</th>
                            <th>СПОДЭС в опросе</th>
                            <th>СПОДЭС не в опросе</th>
                            <th>% СПОДЭС</th>
                        </tr>
            `;
            
            const filteredData = weekData.data.filter(item => !item.isPsRes);
            const sortedData = [...filteredData].sort((a, b) => b.percent - a.percent);
            
            sortedData.forEach((item, index) => {
                htmlContent += `
                    <tr>
                        <td>${index + 1}</td>
                        <td><strong>${item.name}</strong></td>
                        <td>${item.total.toLocaleString()}</td>
                        <td>${item.survey.toLocaleString()}</td>
                        <td>${item.notInSurvey.toLocaleString()}</td>
                        <td>${(item.percent * 100).toFixed(2)}%</td>
                        <td>${item.totalSpo.toLocaleString()}</td>
                        <td>${item.surveySpo.toLocaleString()}</td>
                        <td>${item.spoNotInSurvey.toLocaleString()}</td>
                        <td>${(item.percentSpo * 100).toFixed(2)}%</td>
                    </tr>
                `;
            });
            
            const psResData = weekData.data.find(item => item.isPsRes);
            if (psResData) {
                htmlContent += `
                    <tr class="ps-res">
                        <td>8</td>
                        <td><strong>${psResData.name} (не в общем %)</strong></td>
                        <td>${psResData.total.toLocaleString()}</td>
                        <td>${psResData.survey.toLocaleString()}</td>
                        <td>${psResData.notInSurvey.toLocaleString()}</td>
                        <td>${(psResData.percent * 100).toFixed(2)}%</td>
                        <td>${psResData.totalSpo.toLocaleString()}</td>
                        <td>${psResData.surveySpo.toLocaleString()}</td>
                        <td>${psResData.spoNotInSurvey.toLocaleString()}</td>
                        <td>${(psResData.percentSpo * 100).toFixed(2)}%</td>
                    </tr>
                `;
            }
            
            htmlContent += `
                    </table>
                    
                    <div class="footer">
                        <p><strong>Примечание:</strong> Отчет сгенерирован автоматически системой статистики опроса ФЭС.</p>
                        <p>ПАО "Россети-Юг" - Еженедельный мониторинг показателей опроса приборов учёта.</p>
                        <p>Отчет относится к неделе, завершившейся ${reportDate}.</p>
                    </div>
                </body>
                </html>
            `;
            
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `отчет_опрос_фес_${reportDate}.html`);
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.showNotification(`Еженедельный отчет за ${reportDate} сгенерирован!`, 'success');
        } catch (error) {
            console.error('Ошибка генерации отчета:', error);
            this.showNotification('Ошибка генерации отчета', 'danger');
        }
    }
    
    generateAnalyticalReport() {
        try {
            if (!this.currentUser?.permissions?.includes('reports')) {
                this.showNotification('У вас нет прав на генерацию отчетов!', 'warning');
                return;
            }
            
            if (this.weeklyData.length < 4) {
                this.showNotification('Для аналитического отчета нужно минимум 4 недели данных!', 'warning');
                return;
            }
            
            const last4Weeks = this.weeklyData.slice(0, 4);
            const firstWeek = last4Weeks[3];
            const lastWeek = last4Weeks[0];
            
            let htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Аналитический отчет по опросу ФЭС</title>
                    <style>
                        body { font-family: 'Inter', Arial, sans-serif; margin: 25px; color: #1e293b; }
                        h1 { color: #1e40af; margin-bottom: 10px; font-size: 28px; font-weight: 900; }
                        h2 { color: #333; margin-top: 25px; font-size: 22px; font-weight: 800; }
                        .section { background: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 5px solid #1e40af; }
                        .insight { background: white; padding: 15px; border-radius: 8px; margin: 10px 0; border: 1px solid #e2e8f0; }
                        .footer { margin-top: 40px; font-size: 13px; color: #64748b; border-top: 1px solid #ddd; padding-top: 20px; }
                        .header-info { margin-bottom: 20px; }
                        .period { color: #64748b; font-size: 14px; margin-bottom: 10px; }
                        .note { font-size: 12px; color: #64748b; margin-top: 5px; }
                    </style>
                </head>
                <body>
                    <div class="header-info">
                        <h1>Аналитический отчет по опросу ФЭС</h1>
                        <div class="period">
                            <p><strong>Период анализа:</strong> ${this.formatDate(new Date(firstWeek.date))} - ${this.formatDate(new Date(lastWeek.date))}</p>
                            <p><strong>Дата формирования отчета:</strong> ${new Date().toLocaleString('ru-RU')}</p>
                            <p><strong>Сформировал:</strong> ${this.currentUser?.name || 'Неизвестно'}</p>
                            <p><strong>Роль:</strong> ${this.currentUser?.role === 'admin' ? 'Администратор' : 'Наблюдатель'}</p>
                            <p class="note"><strong>Примечание:</strong> ПС РЭС не учитывается в общих показателях опроса.</p>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h2>Основные тренды за 4 недели (без учета ПС РЭС)</h2>
                        <div class="insight">
                            <h3>📈 Динамика охвата опроса</h3>
                            <p>За анализируемый период общий охват опроса изменился с 
                            <strong>${firstWeek.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.survey, 0).toLocaleString()}</strong> до 
                            <strong>${lastWeek.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.survey, 0).toLocaleString()}</strong> ПУ.</p>
                            <p>Изменение: <strong>${(lastWeek.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.survey, 0) - 
                              firstWeek.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.survey, 0)).toLocaleString()}</strong> ПУ</p>
                        </div>
                        
                        <div class="insight">
                            <h3>🎯 Лучшие и худшие показатели</h3>
                            <p>ФЭС с наивысшим процентом опроса в последнюю неделю: 
                            <strong>${this.findBestRES(lastWeek).name}</strong> 
                            (${(this.findBestRES(lastWeek).percent * 100).toFixed(2)}%)</p>
                            <p>ФЭС с наименьшим процентом опроса в последнюю неделю: 
                            <strong>${this.findWorstRES(lastWeek).name}</strong> 
                            (${(this.findWorstRES(lastWeek).percent * 100).toFixed(2)}%)</p>
                        </div>
                        
                        <div class="insight">
                            <h3>📊 Динамика среднего процента опроса</h3>
                            <p>Неделя 1 (${this.formatDate(new Date(firstWeek.date))}): 
                            <strong>${(firstWeek.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.survey, 0) / 
                                      firstWeek.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.total, 0) * 100 || 0).toFixed(2)}%</strong></p>
                            <p>Неделя 4 (${this.formatDate(new Date(lastWeek.date))}): 
                            <strong>${(lastWeek.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.survey, 0) / 
                                      lastWeek.data.filter(item => !item.isPsRes).reduce((sum, item) => sum + item.total, 0) * 100 || 0).toFixed(2)}%</strong></p>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h2>Рекомендации</h2>
                        <div class="insight">
                            <h3>✅ Приоритетные действия</h3>
                            <ul>
                                <li>Сфокусироваться на ФЭС с низким процентом опроса</li>
                                <li>Увеличить охват СПОДЭС в опросе</li>
                                <li>Провести анализ причин низкого охвата в отдельных районах</li>
                                <li>Оптимизировать процесс сбора данных</li>
                                <li>Внедрить еженедельный мониторинг ключевых показателей</li>
                            </ul>
                        </div>
                        
                        <div class="insight">
                            <h3>📊 Ключевые метрики для мониторинга</h3>
                            <ul>
                                <li>Процент опроса по каждому ФЭС (цель: >95%)</li>
                                <li>Количество ПУ не в опросе</li>
                                <li>Процент СПОДЭС в опросе</li>
                                <li>Динамика изменения показателей за 4 недели</li>
                                <li>Сравнение с предыдущими периодами</li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p><strong>Примечание:</strong> Аналитический отчет основан на данных за последние 4 недели (без учета ПС РЭС).</p>
                        <p>ПАО "Россети-Юг" - Система мониторинга показателей опроса приборов учёта.</p>
                        <p>Отчет относится к периоду с ${this.formatDate(new Date(firstWeek.date))} по ${this.formatDate(new Date(lastWeek.date))}.</p>
                    </div>
                </body>
                </html>
            `;
            
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `аналитический_отчет_фес_${this.formatDate(new Date(firstWeek.date))}_${this.formatDate(new Date(lastWeek.date))}.html`);
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.showNotification('Аналитический отчет сгенерирован!', 'success');
        } catch (error) {
            console.error('Ошибка генерации отчета:', error);
            this.showNotification('Ошибка генерации отчета', 'danger');
        }
    }
    
    generateChangesReport(date = null) {
        try {
            if (!this.currentUser?.permissions?.includes('reports')) {
                this.showNotification('У вас нет прав на генерацию отчетов!', 'warning');
                return;
            }
            
            if (this.weeklyData.length < 2) {
                this.showNotification('Для отчета по изменениям нужно минимум 2 недели данных!', 'warning');
                return;
            }
            
            const changesSelect = document.getElementById('changesWeekSelect');
            let selectedDate = date || (changesSelect ? changesSelect.value : '');
            
            let weekData;
            let previousWeekData;
            
            if (selectedDate) {
                weekData = this.weeklyData.find(w => w.date === selectedDate);
                const weekIndex = this.weeklyData.findIndex(w => w.date === selectedDate);
                previousWeekData = this.weeklyData[weekIndex + 1];
            } else {
                weekData = this.weeklyData[0];
                previousWeekData = this.weeklyData[1];
            }
            
            if (!weekData || !previousWeekData) {
                this.showNotification('Недостаточно данных для сравнения!', 'warning');
                return;
            }
            
            const reportDate = this.formatDate(new Date(weekData.date));
            const previousDate = this.formatDate(new Date(previousWeekData.date));
            
            let htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Отчет по изменениям количества ПУ</title>
                    <style>
                        body { font-family: 'Inter', Arial, sans-serif; margin: 25px; color: #1e293b; }
                        h1 { color: #1e40af; margin-bottom: 10px; font-size: 28px; font-weight: 900; }
                        h2 { color: #333; margin-top: 25px; font-size: 22px; font-weight: 800; }
                        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
                        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                        th { background-color: #f8fafc; font-weight: 700; }
                        .summary { background: #f1f5f9; padding: 20px; border-radius: 10px; margin: 20px 0; }
                        .footer { margin-top: 40px; font-size: 13px; color: #64748b; border-top: 1px solid #ddd; padding-top: 20px; }
                        .header-info { margin-bottom: 20px; }
                        .increase { color: #10b981; font-weight: 700; }
                        .decrease { color: #ef4444; font-weight: 700; }
                        .no-change { color: #64748b; font-weight: 700; }
                        .note { font-size: 12px; color: #64748b; margin-top: 5px; }
                    </style>
                </head>
                <body>
                    <div class="header-info">
                        <h1>Отчет по изменениям количества ПУ</h1>
                        <p><strong>Период сравнения:</strong> ${previousDate} → ${reportDate}</p>
                        <p><strong>Дата формирования отчета:</strong> ${new Date().toLocaleString('ru-RU')}</p>
                        <p><strong>Сформировал:</strong> ${this.currentUser?.name || 'Неизвестно'}</p>
                        <p><strong>Роль:</strong> ${this.currentUser?.role === 'admin' ? 'Администратор' : 'Наблюдатель'}</p>
                        <p class="note"><strong>Примечание:</strong> ПС РЭС не учитывается в общих показателях опроса.</p>
                    </div>
                    
                    <div class="summary">
                        <h2>Сводка изменений (без учета ПС РЭС)</h2>
            `;
            
            const currentFiltered = weekData.data.filter(item => !item.isPsRes);
            const previousFiltered = previousWeekData.data.filter(item => !item.isPsRes);
            
            const currentTotal = currentFiltered.reduce((sum, item) => sum + item.total, 0);
            const previousTotal = previousFiltered.reduce((sum, item) => sum + item.total, 0);
            const totalChange = currentTotal - previousTotal;
            
            const currentSurvey = currentFiltered.reduce((sum, item) => sum + item.survey, 0);
            const previousSurvey = previousFiltered.reduce((sum, item) => sum + item.survey, 0);
            const surveyChange = currentSurvey - previousSurvey;
            
            const currentSpoTotal = currentFiltered.reduce((sum, item) => sum + item.totalSpo, 0);
            const previousSpoTotal = previousFiltered.reduce((sum, item) => sum + item.totalSpo, 0);
            const spoTotalChange = currentSpoTotal - previousSpoTotal;
            
            const currentSpoSurvey = currentFiltered.reduce((sum, item) => sum + item.surveySpo, 0);
            const previousSpoSurvey = previousFiltered.reduce((sum, item) => sum + item.surveySpo, 0);
            const spoSurveyChange = currentSpoSurvey - previousSpoSurvey;
            
            htmlContent += `
                        <p>Всего ПУ: <strong>${previousTotal.toLocaleString()}</strong> → <strong>${currentTotal.toLocaleString()}</strong> 
                        <span class="${totalChange > 0 ? 'increase' : totalChange < 0 ? 'decrease' : 'no-change'}">
                            (${totalChange > 0 ? '+' : ''}${totalChange})
                        </span></p>
                        <p>ПУ в опросе: <strong>${previousSurvey.toLocaleString()}</strong> → <strong>${currentSurvey.toLocaleString()}</strong> 
                        <span class="${surveyChange > 0 ? 'increase' : surveyChange < 0 ? 'decrease' : 'no-change'}">
                            (${surveyChange > 0 ? '+' : ''}${surveyChange})
                        </span></p>
                        <p>СПОДЭС ПУ: <strong>${previousSpoTotal.toLocaleString()}</strong> → <strong>${currentSpoTotal.toLocaleString()}</strong> 
                        <span class="${spoTotalChange > 0 ? 'increase' : spoTotalChange < 0 ? 'decrease' : 'no-change'}">
                            (${spoTotalChange > 0 ? '+' : ''}${spoTotalChange})
                        </span></p>
                        <p>СПОДЭС в опросе: <strong>${previousSpoSurvey.toLocaleString()}</strong> → <strong>${currentSpoSurvey.toLocaleString()}</strong> 
                        <span class="${spoSurveyChange > 0 ? 'increase' : spoSurveyChange < 0 ? 'decrease' : 'no-change'}">
                            (${spoSurveyChange > 0 ? '+' : ''}${spoSurveyChange})
                        </span></p>
                    </div>
                    
                    <h2>Детализация изменений по ФЭС</h2>
                    <table>
                        <tr>
                            <th>№</th>
                            <th>ФЭС</th>
                            <th>Всего ПУ (было)</th>
                            <th>Всего ПУ (стало)</th>
                            <th>Изменение</th>
                            <th>ПУ в опросе (было)</th>
                            <th>ПУ в опросе (стало)</th>
                            <th>Изменение</th>
                            <th>% опроса (было)</th>
                            <th>% опроса (стало)</th>
                            <th>Δ %</th>
                        </tr>
            `;
            
            AppConfig.RES_LIST.filter(res => res.id !== 'ps').forEach((res, index) => {
                const currentRes = weekData.data.find(item => item.id === res.id);
                const previousRes = previousWeekData.data.find(item => item.id === res.id);
                
                if (!currentRes || !previousRes) return;
                
                const totalChangeRes = currentRes.total - previousRes.total;
                const surveyChangeRes = currentRes.survey - previousRes.survey;
                const percentChange = (currentRes.percent * 100) - (previousRes.percent * 100);
                
                htmlContent += `
                    <tr>
                        <td>${index + 1}</td>
                        <td><strong>${res.name}</strong></td>
                        <td>${previousRes.total.toLocaleString()}</td>
                        <td>${currentRes.total.toLocaleString()}</td>
                        <td class="${totalChangeRes > 0 ? 'increase' : totalChangeRes < 0 ? 'decrease' : 'no-change'}">
                            ${totalChangeRes > 0 ? '+' : ''}${totalChangeRes}
                        </td>
                        <td>${previousRes.survey.toLocaleString()}</td>
                        <td>${currentRes.survey.toLocaleString()}</td>
                        <td class="${surveyChangeRes > 0 ? 'increase' : surveyChangeRes < 0 ? 'decrease' : 'no-change'}">
                            ${surveyChangeRes > 0 ? '+' : ''}${surveyChangeRes}
                        </td>
                        <td>${(previousRes.percent * 100).toFixed(2)}%</td>
                        <td>${(currentRes.percent * 100).toFixed(2)}%</td>
                        <td class="${percentChange > 0 ? 'increase' : percentChange < 0 ? 'decrease' : 'no-change'}">
                            ${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%
                        </td>
                    </tr>
                `;
            });
            
            htmlContent += `
                    </table>
                    
                    <h2>Анализ изменений</h2>
                    <div class="summary">
                        <h3>📊 Ключевые изменения:</h3>
                        <ul>
            `;
            
            const resChanges = [];
            AppConfig.RES_LIST.filter(res => res.id !== 'ps').forEach(res => {
                const currentRes = weekData.data.find(item => item.id === res.id);
                const previousRes = previousWeekData.data.find(item => item.id === res.id);
                
                if (currentRes && previousRes) {
                    const percentChange = (currentRes.percent * 100) - (previousRes.percent * 100);
                    resChanges.push({
                        name: res.name,
                        change: percentChange,
                        currentPercent: currentRes.percent * 100,
                        previousPercent: previousRes.percent * 100
                    });
                }
            });
            
            resChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
            
            resChanges.slice(0, 3).forEach(change => {
                htmlContent += `
                    <li><strong>${change.name}:</strong> ${change.previousPercent.toFixed(2)}% → ${change.currentPercent.toFixed(2)}% 
                    <span class="${change.change > 0 ? 'increase' : change.change < 0 ? 'decrease' : 'no-change'}">
                        (${change.change > 0 ? '+' : ''}${change.change.toFixed(2)}%)
                    </span></li>
                `;
            });
            
            htmlContent += `
                        </ul>
                    </div>
                    
                    <div class="footer">
                        <p><strong>Примечание:</strong> Отчет показывает изменения количества приборов учёта и процента опроса за прошедшую неделю.</p>
                        <p>ПАО "Россети-Юг" - Система мониторинга показателей опроса приборов учёта.</p>
                        <p>Отчет относится к сравнению недель ${previousDate} и ${reportDate}.</p>
                    </div>
                </body>
                </html>
            `;
            
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `отчет_изменения_пу_${previousDate}_${reportDate}.html`);
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.showNotification(`Отчет по изменениям за ${reportDate} сгенерирован!`, 'success');
        } catch (error) {
            console.error('Ошибка генерации отчета:', error);
            this.showNotification('Ошибка генерации отчета', 'danger');
        }
    }
    
    generateComparisonReport(date1 = null, date2 = null) {
        try {
            if (!this.currentUser?.permissions?.includes('reports')) {
                this.showNotification('У вас нет прав на генерацию отчетов!', 'warning');
                return;
            }
            
            if (this.weeklyData.length < 2) {
                this.showNotification('Для сравнительного отчета нужно минимум 2 недели данных!', 'warning');
                return;
            }
            
            let week1Data, week2Data;
            
            if (date1 && date2) {
                week1Data = this.weeklyData.find(w => w.date === date1);
                week2Data = this.weeklyData.find(w => w.date === date2);
            } else {
                const week1Select = document.getElementById('comparisonWeek1Select');
                const week2Select = document.getElementById('comparisonWeek2Select');
                
                if (!week1Select || !week2Select || !week1Select.value || !week2Select.value) {
                    this.showNotification('Выберите обе недели для сравнения!', 'warning');
                    return;
                }
                
                week1Data = this.weeklyData.find(w => w.date === week1Select.value);
                week2Data = this.weeklyData.find(w => w.date === week2Select.value);
            }
            
            if (!week1Data || !week2Data) {
                this.showNotification('Не найдены данные для выбранных недель!', 'warning');
                return;
            }
            
            const date1Formatted = this.formatDate(new Date(week1Data.date));
            const date2Formatted = this.formatDate(new Date(week2Data.date));
            
            let htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Сравнительный отчет по опросу ФЭС</title>
                    <style>
                        body { font-family: 'Inter', Arial, sans-serif; margin: 25px; color: #1e293b; }
                        h1 { color: #1e40af; margin-bottom: 10px; font-size: 28px; font-weight: 900; }
                        h2 { color: #333; margin-top: 25px; font-size: 22px; font-weight: 800; }
                        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
                        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                        th { background-color: #f8fafc; font-weight: 700; }
                        .summary { background: #f1f5f9; padding: 20px; border-radius: 10px; margin: 20px 0; }
                        .footer { margin-top: 40px; font-size: 13px; color: #64748b; border-top: 1px solid #ddd; padding-top: 20px; }
                        .header-info { margin-bottom: 20px; }
                        .increase { color: #10b981; font-weight: 700; }
                        .decrease { color: #ef4444; font-weight: 700; }
                        .no-change { color: #64748b; font-weight: 700; }
                        .note { font-size: 12px; color: #64748b; margin-top: 5px; }
                        .week1 { background-color: #f0f9ff; }
                        .week2 { background-color: #fef7cd; }
                    </style>
                </head>
                <body>
                    <div class="header-info">
                        <h1>Сравнительный отчет по опросу ФЭС</h1>
                        <p><strong>Сравниваемые недели:</strong> ${date1Formatted} vs ${date2Formatted}</p>
                        <p><strong>Дата формирования отчета:</strong> ${new Date().toLocaleString('ru-RU')}</p>
                        <p><strong>Сформировал:</strong> ${this.currentUser?.name || 'Неизвестно'}</p>
                        <p><strong>Роль:</strong> ${this.currentUser?.role === 'admin' ? 'Администратор' : 'Наблюдатель'}</p>
                        <p class="note"><strong>Примечание:</strong> ПС РЭС не учитывается в общих показателях опроса.</p>
                    </div>
                    
                    <div class="summary">
                        <h2>Сводка сравнения (без учета ПС РЭС)</h2>
            `;
            
            const week1Filtered = week1Data.data.filter(item => !item.isPsRes);
            const week2Filtered = week2Data.data.filter(item => !item.isPsRes);
            
            const week1Total = week1Filtered.reduce((sum, item) => sum + item.total, 0);
            const week2Total = week2Filtered.reduce((sum, item) => sum + item.total, 0);
            const totalChange = week2Total - week1Total;
            
            const week1Survey = week1Filtered.reduce((sum, item) => sum + item.survey, 0);
            const week2Survey = week2Filtered.reduce((sum, item) => sum + item.survey, 0);
            const surveyChange = week2Survey - week1Survey;
            
            const week1AvgPercent = week1Total > 0 ? (week1Survey / week1Total) * 100 : 0;
            const week2AvgPercent = week2Total > 0 ? (week2Survey / week2Total) * 100 : 0;
            const avgPercentChange = week2AvgPercent - week1AvgPercent;
            
            htmlContent += `
                        <p>Всего ПУ: <strong>${week1Total.toLocaleString()}</strong> → <strong>${week2Total.toLocaleString()}</strong> 
                        <span class="${totalChange > 0 ? 'increase' : totalChange < 0 ? 'decrease' : 'no-change'}">
                            (${totalChange > 0 ? '+' : ''}${totalChange})
                        </span></p>
                        <p>ПУ в опросе: <strong>${week1Survey.toLocaleString()}</strong> → <strong>${week2Survey.toLocaleString()}</strong> 
                        <span class="${surveyChange > 0 ? 'increase' : surveyChange < 0 ? 'decrease' : 'no-change'}">
                            (${surveyChange > 0 ? '+' : ''}${surveyChange})
                        </span></p>
                        <p>Средний % опроса: <strong>${week1AvgPercent.toFixed(2)}%</strong> → <strong>${week2AvgPercent.toFixed(2)}%</strong> 
                        <span class="${avgPercentChange > 0 ? 'increase' : avgPercentChange < 0 ? 'decrease' : 'no-change'}">
                            (${avgPercentChange > 0 ? '+' : ''}${avgPercentChange.toFixed(2)}%)
                        </span></p>
                    </div>
                    
                    <h2>Детальное сравнение по ФЭС</h2>
                    <table>
                        <tr>
                            <th>№</th>
                            <th>ФЭС</th>
                            <th>Всего ПУ (${date1Formatted})</th>
                            <th>Всего ПУ (${date2Formatted})</th>
                            <th>Δ Всего ПУ</th>
                            <th>% опроса (${date1Formatted})</th>
                            <th>% опроса (${date2Formatted})</th>
                            <th>Δ % опроса</th>
                            <th>Статус</th>
                        </tr>
            `;
            
            AppConfig.RES_LIST.filter(res => res.id !== 'ps').forEach((res, index) => {
                const week1Res = week1Data.data.find(item => item.id === res.id);
                const week2Res = week2Data.data.find(item => item.id === res.id);
                
                if (!week1Res || !week2Res) return;
                
                const totalChangeRes = week2Res.total - week1Res.total;
                const percentChange = (week2Res.percent * 100) - (week1Res.percent * 100);
                
                let status = '🔷 Нет изменений';
                if (percentChange > 1) status = '📈 Улучшение';
                else if (percentChange > 0.1) status = '↗️ Незначительное улучшение';
                else if (percentChange < -1) status = '📉 Ухудшение';
                else if (percentChange < -0.1) status = '↘️ Незначительное ухудшение';
                
                htmlContent += `
                    <tr>
                        <td>${index + 1}</td>
                        <td><strong>${res.name}</strong></td>
                        <td class="week1">${week1Res.total.toLocaleString()}</td>
                        <td class="week2">${week2Res.total.toLocaleString()}</td>
                        <td class="${totalChangeRes > 0 ? 'increase' : totalChangeRes < 0 ? 'decrease' : 'no-change'}">
                            ${totalChangeRes > 0 ? '+' : ''}${totalChangeRes}
                        </td>
                        <td class="week1">${(week1Res.percent * 100).toFixed(2)}%</td>
                        <td class="week2">${(week2Res.percent * 100).toFixed(2)}%</td>
                        <td class="${percentChange > 0 ? 'increase' : percentChange < 0 ? 'decrease' : 'no-change'}">
                            ${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%
                        </td>
                        <td>${status}</td>
                    </tr>
                `;
            });
            
            htmlContent += `
                    </table>
                    
                    <h2>Анализ результатов</h2>
                    <div class="summary">
                        <h3>📊 Ключевые выводы:</h3>
            `;
            
            const improvements = [];
            const deteriorations = [];
            
            AppConfig.RES_LIST.filter(res => res.id !== 'ps').forEach(res => {
                const week1Res = week1Data.data.find(item => item.id === res.id);
                const week2Res = week2Data.data.find(item => item.id === res.id);
                
                if (week1Res && week2Res) {
                    const percentChange = (week2Res.percent * 100) - (week1Res.percent * 100);
                    if (percentChange > 0.5) {
                        improvements.push({
                            name: res.name,
                            change: percentChange,
                            from: week1Res.percent * 100,
                            to: week2Res.percent * 100
                        });
                    } else if (percentChange < -0.5) {
                        deteriorations.push({
                            name: res.name,
                            change: percentChange,
                            from: week1Res.percent * 100,
                            to: week2Res.percent * 100
                        });
                    }
                }
            });
            
            improvements.sort((a, b) => b.change - a.change);
            deteriorations.sort((a, b) => a.change - b.change);
            
            htmlContent += '<h4>✅ Улучшились показатели:</h4>';
            if (improvements.length > 0) {
                htmlContent += '<ul>';
                improvements.forEach(imp => {
                    htmlContent += `
                        <li><strong>${imp.name}:</strong> ${imp.from.toFixed(2)}% → ${imp.to.toFixed(2)}% 
                        <span class="increase">(+${imp.change.toFixed(2)}%)</span></li>
                    `;
                });
                htmlContent += '</ul>';
            } else {
                htmlContent += '<p>Нет значительных улучшений</p>';
            }
            
            htmlContent += '<h4>⚠️ Ухудшились показатели:</h4>';
            if (deteriorations.length > 0) {
                htmlContent += '<ul>';
                deteriorations.forEach(det => {
                    htmlContent += `
                        <li><strong>${det.name}:</strong> ${det.from.toFixed(2)}% → ${det.to.toFixed(2)}% 
                        <span class="decrease">(${det.change.toFixed(2)}%)</span></li>
                    `;
                });
                htmlContent += '</ul>';
            } else {
                htmlContent += '<p>Нет значительных ухудшений</p>';
            }
            
            htmlContent += `
                    </div>
                    
                    <div class="footer">
                        <p><strong>Примечание:</strong> Отчет сравнивает показатели двух выбранных недель.</p>
                        <p>ПАО "Россети-Юг" - Система мониторинга показателей опроса приборов учёта.</p>
                        <p>Отчет относится к сравнению недель ${date1Formatted} и ${date2Formatted}.</p>
                    </div>
                </body>
                </html>
            `;
            
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `сравнительный_отчет_${date1Formatted}_${date2Formatted}.html`);
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.showNotification(`Сравнительный отчет сгенерирован!`, 'success');
        } catch (error) {
            console.error('Ошибка генерации отчета:', error);
            this.showNotification('Ошибка генерации отчета', 'danger');
        }
    }
    
    showNotification(message, type) {
        try {
            const existingNotifications = document.querySelectorAll('.notification');
            existingNotifications.forEach(n => n.remove());
            
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            
            let icon = 'info-circle';
            if (type === 'success') icon = 'check-circle';
            else if (type === 'warning') icon = 'exclamation-triangle';
            else if (type === 'danger') icon = 'exclamation-circle';
            
            notification.innerHTML = `
                <i class="fas fa-${icon}"></i>
                ${message}
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }, 4000);
        } catch (error) {
            console.error('Ошибка показа уведомления:', error);
        }
    }
}

// Инициализация приложения
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new SurveyStatisticsApp();
});

// Экспорт объекта app в глобальную область видимости
window.app = app;
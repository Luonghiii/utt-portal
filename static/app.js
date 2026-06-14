// UTT Dashboard Client Application Logic

document.addEventListener('DOMContentLoaded', () => {
    // --- Persistent Auth State ---
    // Stored in localStorage so token survives tab-close and browser restarts.
    // Remember-me credentials are stored with a simple obfuscation (XOR) — enough to
    // prevent casual shoulder-surfing; NOT cryptographic security.
    function xorObfuscate(str) {
        const key = 'UTT_PRT';
        return btoa(str.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join(''));
    }
    function xorDeobfuscate(b64) {
        try {
            const key = 'UTT_PRT';
            const str = atob(b64);
            return str.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join('');
        } catch { return null; }
    }

    let userId    = localStorage.getItem('userId');
    let tokenJWT  = localStorage.getItem('tokenJWT');
    let studentName = localStorage.getItem('studentName') || 'Sinh viên';
    let isReAuthing = false; // guard against re-entrant re-auth loops
    let currentWeekOffset = 0;
    let cachedDiemThanhPhan = [];
    let cachedGradesList = [];
    let examsList = [];

    // DOM Elements - Auth
    const loginContainer = document.getElementById('loginContainer');
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const loginErrorMessage = document.getElementById('loginErrorMessage');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    
    // DOM Elements - App Layout
    const appContainer = document.getElementById('appContainer');
    const sidebarStudentName = document.getElementById('sidebarStudentName');
    const sidebarStudentClass = document.getElementById('sidebarStudentClass');
    const welcomeGreeting = document.getElementById('welcomeGreeting');
    const currentDateString = document.getElementById('currentDateString');
    const userAvatar = document.getElementById('userAvatar');
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutBtnMobile = document.getElementById('logoutBtnMobile');
    
    // DOM Elements - Navigation Tabs
    const navTabs = document.querySelectorAll('.nav-item');
    const panels = document.querySelectorAll('.tab-panel');

    // DOM Elements - Dashboard Overview Page
    const profileStudentCode = document.getElementById('profileStudentCode');
    const profileStudentName = document.getElementById('profileStudentName');
    const profileStudentDob = document.getElementById('profileStudentDob');
    const profileStudentClass = document.getElementById('profileStudentClass');
    const profileStudentMajor = document.getElementById('profileStudentMajor');
    const profileStudentProgram = document.getElementById('profileStudentProgram');
    
    const gpaTen = document.getElementById('gpaTen');
    const gpaFour = document.getElementById('gpaFour');
    const accumulatedCredits = document.getElementById('accumulatedCredits');
    
    const todayClassesCount = document.getElementById('todayClassesCount');
    const todayScheduleList = document.getElementById('todayScheduleList');
    
    const tuitionRemaining = document.getElementById('tuitionRemaining');
    const tuitionTotalPaid = document.getElementById('tuitionTotalPaid');
    const tuitionTotalPayable = document.getElementById('tuitionTotalPayable');
    const tuitionDonut = document.getElementById('tuitionDonut');

    // DOM Elements - Timetable Page
    const prevWeekBtn = document.getElementById('prevWeekBtn');
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    const currentWeekLabel = document.getElementById('currentWeekLabel');
    const timetableWeekGrid = document.getElementById('timetableWeekGrid');

    // DOM Elements - Grades Page
    const gradesGpaTen = document.getElementById('gradesGpaTen');
    const gradesGpaFour = document.getElementById('gradesGpaFour');
    const gradesCredits = document.getElementById('gradesCredits');
    const gradesAccumulatedCredits = document.getElementById('gradesAccumulatedCredits');
    const gradesAccordion = document.getElementById('gradesAccordion');

    // DOM Elements - Finance Page
    const finTotalPayable = document.getElementById('finTotalPayable');
    const finTotalPaid = document.getElementById('finTotalPaid');
    const finTotalExempt = document.getElementById('finTotalExempt');
    const finTotalRemaining = document.getElementById('finTotalRemaining');
    const tabPayableFees = document.getElementById('tabPayableFees');
    const tabPaidFees = document.getElementById('tabPaidFees');
    const subpanelPayable = document.getElementById('subpanelPayable');
    const subpanelPaid = document.getElementById('subpanelPaid');
    const tablePayableFees = document.getElementById('tablePayableFees').querySelector('tbody');
    const tablePaidFees = document.getElementById('tablePaidFees').querySelector('tbody');

    // Particles and Toast Utility
    const particlesContainer = document.getElementById('particlesContainer');
    const toastContainer = document.getElementById('toastContainer');

    // Init App
    init();

    function init() {
        renderDateHeader();
        createAmbientParticles();

        if (userId && tokenJWT) {
            showApp();
        } else {
            // Try silent auto-login using saved remember-me credentials
            const savedUser = localStorage.getItem('remember_user');
            const savedPass = localStorage.getItem('remember_pass');
            if (savedUser && savedPass) {
                const plainUser = xorDeobfuscate(savedUser);
                const plainPass = xorDeobfuscate(savedPass);
                if (plainUser && plainPass) {
                    silentAutoLogin(plainUser, plainPass);
                    return; // wait for silentAutoLogin to finish
                }
            }
            showLogin();
        }

        // Event Listeners - Auth
        togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
        loginForm.addEventListener('submit', handleLogin);
        if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
        if (logoutBtnMobile) logoutBtnMobile.addEventListener('click', handleLogout);

        // Event Listeners - Navigation Tabs Switching
        navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.getAttribute('data-tab');
                
                navTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                panels.forEach(p => {
                    p.classList.remove('active');
                    p.style.opacity = '0';
                    p.style.transform = 'translateY(10px)';
                });
                
                const matchingPanel = document.getElementById(`panel${capitalizeFirstLetter(targetTab)}`);
                if (matchingPanel) {
                    matchingPanel.classList.add('active');
                    // Force reflow and apply transitions
                    setTimeout(() => {
                        matchingPanel.style.opacity = '1';
                        matchingPanel.style.transform = 'translateY(0)';
                    }, 50);
                }
            });
        });

        // Event Listeners - Timetable Navigation
        prevWeekBtn.addEventListener('click', () => navigateWeek(-1));
        nextWeekBtn.addEventListener('click', () => navigateWeek(1));

        // Event Listeners - Finance Subtabs Switching
        tabPayableFees.addEventListener('click', () => {
            tabPayableFees.classList.add('active');
            tabPaidFees.classList.remove('active');
            subpanelPayable.classList.add('active');
            subpanelPaid.classList.remove('active');
        });

        tabPaidFees.addEventListener('click', () => {
            tabPaidFees.classList.add('active');
            tabPayableFees.classList.remove('active');
            subpanelPaid.classList.add('active');
            subpanelPayable.classList.remove('active');
        });

        // Component Grades Modal Close Listeners
        const closeGradesModalBtn = document.getElementById('closeGradesModalBtn');
        const gradesModalBackdrop = document.getElementById('gradesModalBackdrop');
        if (closeGradesModalBtn && gradesModalBackdrop) {
            closeGradesModalBtn.addEventListener('click', () => {
                gradesModalBackdrop.classList.add('hidden');
            });
            gradesModalBackdrop.addEventListener('click', (e) => {
                if (e.target === gradesModalBackdrop) {
                    gradesModalBackdrop.classList.add('hidden');
                }
            });
        }

        initAvatarUpload();
    }

    // Modern Toast Notification Generator
    function showToast(title, message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconClass = 'fa-circle-info';
        if (type === 'success') iconClass = 'fa-circle-check';
        if (type === 'error') iconClass = 'fa-circle-exclamation';

        toast.innerHTML = `
            <div class="toast-icon"><i class="fa-solid ${iconClass}"></i></div>
            <div class="toast-body">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close"><i class="fa-solid fa-xmark"></i></button>
        `;

        toastContainer.appendChild(toast);

        // Close button click handler
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.add('toast-fade-out');
            setTimeout(() => toast.remove(), 400);
        });

        // Auto remove after 4.5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('toast-fade-out');
                setTimeout(() => toast.remove(), 400);
            }
        }, 4500);
    }

    // Creating beautiful ambient floating orbs
    function createAmbientParticles() {
        if (!particlesContainer) return;
        particlesContainer.innerHTML = '';
        
        const count = 6;
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'orb-particle';
            
            const size = Math.random() * 200 + 100; // 100px to 300px
            const left = Math.random() * 100; // 0% to 100%
            const duration = Math.random() * 15 + 15; // 15s to 30s
            const delay = Math.random() * -20; // immediate randomized startup offsets

            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${left}%`;
            particle.style.animationDuration = `${duration}s`;
            particle.style.animationDelay = `${delay}s`;
            
            // Random colors (blue, purple, indigo hints)
            const hue = Math.random() > 0.5 ? 220 : 270; // Blue or Purple HSL
            particle.style.background = `radial-gradient(circle, hsla(${hue}, 80%, 60%, 0.15) 0%, transparent 70%)`;

            particlesContainer.appendChild(particle);
        }
    }

    function togglePasswordVisibility() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        const icon = togglePasswordBtn.querySelector('i');
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    }

    // ─── Core login API call (used by form submit AND silent auto-login) ─────────
    async function performLogin(username, password) {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        return response.json();
    }

    // ─── Silent auto-login on page load ──────────────────────────────────────────
    async function silentAutoLogin(username, password) {
        // Show a subtle loading indicator on the login screen while we silently auth
        showLogin();
        loginSubmitBtn.classList.add('loading');
        try {
            const result = await performLogin(username, password);
            if (result.success) {
                userId    = result.userId;
                tokenJWT  = result.tokenJWT;
                localStorage.setItem('userId',   userId);
                localStorage.setItem('tokenJWT', tokenJWT);
                showToast('Đăng nhập tự động', `Chào mừng trở lại, ${username}!`, 'success');
                showApp();
            } else {
                // Saved credentials invalid — clear them and show login normally
                localStorage.removeItem('remember_user');
                localStorage.removeItem('remember_pass');
                loginSubmitBtn.classList.remove('loading');
                showLogin();
            }
        } catch {
            loginSubmitBtn.classList.remove('loading');
            showLogin();
        }
    }

    // ─── Silent re-auth when token expires mid-session ────────────────────────────
    // Returns true if re-auth succeeded and caller should retry, false otherwise.
    async function reAuth() {
        if (isReAuthing) return false;
        const savedUser = localStorage.getItem('remember_user');
        const savedPass = localStorage.getItem('remember_pass');
        if (!savedUser || !savedPass) return false;
        const u = xorDeobfuscate(savedUser);
        const p = xorDeobfuscate(savedPass);
        if (!u || !p) return false;

        isReAuthing = true;
        showToast('Phiên hết hạn', 'Token hết hạn, đang tự động làm mới...', 'info');
        try {
            const result = await performLogin(u, p);
            if (result.success) {
                userId   = result.userId;
                tokenJWT = result.tokenJWT;
                localStorage.setItem('userId',   userId);
                localStorage.setItem('tokenJWT', tokenJWT);
                showToast('Làm mới thành công', 'Token đã được cập nhật, tiếp tục tải dữ liệu...', 'success');
                isReAuthing = false;
                return true;
            }
        } catch { /* fall through */ }
        isReAuthing = false;
        return false;
    }

    // ─── Fetch wrapper with one auto-retry on auth failure ────────────────────────
    async function apiFetch(url, options) {
        let resp = await fetch(url, options);
        let data = await resp.json();
        // Detect token-expired signal: UTT typically returns success:false with an
        // auth-related message, or HTTP 401.
        const isAuthFail = resp.status === 401 ||
            (data && !data.success && typeof data.message === 'string' &&
             /token|expire|auth|login|unauthori/i.test(data.message));
        if (isAuthFail) {
            const refreshed = await reAuth();
            if (refreshed) {
                // Re-build the options with the new token
                const newBody = JSON.parse(options.body || '{}');
                if ('tokenJWT' in newBody) newBody.tokenJWT = tokenJWT;
                resp = await fetch(url, { ...options, body: JSON.stringify(newBody) });
                data = await resp.json();
            }
        }
        return data;
    }

    // ─── Form submit handler ──────────────────────────────────────────────────────
    async function handleLogin(e) {
        e.preventDefault();
        loginErrorMessage.style.display = 'none';
        loginSubmitBtn.classList.add('loading');
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const rememberMe = document.getElementById('rememberMeCheck')?.checked || false;

        showToast('Xác thực', 'Đang kết nối đến máy chủ trường UTT...', 'info');

        try {
            const result = await performLogin(username, password);
            if (result.success) {
                userId    = result.userId;
                tokenJWT  = result.tokenJWT;
                localStorage.setItem('userId',   userId);
                localStorage.setItem('tokenJWT', tokenJWT);

                // Save or clear remembered credentials based on checkbox
                if (rememberMe) {
                    localStorage.setItem('remember_user', xorObfuscate(username));
                    localStorage.setItem('remember_pass', xorObfuscate(password));
                } else {
                    localStorage.removeItem('remember_user');
                    localStorage.removeItem('remember_pass');
                }

                passwordInput.value = '';
                showToast('Thành công', 'Đăng nhập thành công! Đang lấy dữ liệu học tập...', 'success');
                showApp();
            } else {
                const errMsg = result.message || 'Mã sinh viên hoặc mật khẩu không chính xác.';
                loginErrorMessage.textContent = errMsg;
                loginErrorMessage.style.display = 'block';
                showToast('Thất bại', errMsg, 'error');
                loginSubmitBtn.classList.remove('loading');
            }
        } catch (error) {
            console.error('Login error:', error);
            const connError = 'Lỗi kết nối đến proxy server hoặc cổng trường UTT.';
            loginErrorMessage.textContent = connError;
            loginErrorMessage.style.display = 'block';
            showToast('Lỗi kết nối', connError, 'error');
            loginSubmitBtn.classList.remove('loading');
        }
    }

    function handleLogout() {
        // Clear auth tokens but KEEP remember_user/remember_pass so auto-login still works.
        // If the user wants to fully sign out and forget credentials, they should uncheck
        // "Ghi nhớ đăng nhập" before logging out — or we could add a "Thoát hoàn toàn" option.
        localStorage.removeItem('userId');
        localStorage.removeItem('tokenJWT');
        localStorage.removeItem('studentName');
        userId = null;
        tokenJWT = null;
        studentName = 'Sinh viên';
        showToast('Đăng xuất', 'Đã đăng xuất. Token xóa, credentials giữ lại nếu đã tick Ghi nhớ.', 'info');
        showLogin();
        // Pre-fill username if remember-me is set
        const savedUser = localStorage.getItem('remember_user');
        if (savedUser) {
            const u = xorDeobfuscate(savedUser);
            if (u) usernameInput.value = u;
            const remBox = document.getElementById('rememberMeCheck');
            if (remBox) remBox.checked = true;
        }
    }

    function showLogin() {
        loginContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
        loginSubmitBtn.classList.remove('loading');
    }

    function showApp() {
        loginContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        
        loadStudentData();
    }

    async function loadStudentData() {
        const hour = new Date().getHours();
        let greeting = 'Chào sinh viên!';
        if (hour >= 5 && hour < 12) greeting = 'Chào buổi sáng!';
        else if (hour >= 12 && hour < 18) greeting = 'Chào buổi chiều!';
        else greeting = 'Chào buổi tối!';
        welcomeGreeting.textContent = greeting;

        // Render Skeletons before loading
        renderSkeletons();

        loadGradesAndProfile();
        loadSchedule();
        loadTuition();
        loadExams();
    }

    // Skeleton screens loader UI helper
    function renderSkeletons() {
        // 1. Profile skeletons
        profileStudentCode.innerHTML = '<span class="skeleton" style="width: 80px"></span>';
        profileStudentName.innerHTML = '<span class="skeleton" style="width: 150px"></span>';
        profileStudentDob.innerHTML = '<span class="skeleton" style="width: 100px"></span>';
        profileStudentClass.innerHTML = '<span class="skeleton" style="width: 90px"></span>';
        profileStudentMajor.innerHTML = '<span class="skeleton" style="width: 180px"></span>';
        profileStudentProgram.innerHTML = '<span class="skeleton" style="width: 120px"></span>';

        // 2. Schedule skeletons
        todayScheduleList.innerHTML = `
            <div class="schedule-item-card skeleton skeleton-box"></div>
            <div class="schedule-item-card skeleton skeleton-box"></div>
        `;

        // 3. Grades skeletons
        gradesAccordion.innerHTML = `
            <div class="accordion-item glass-panel skeleton skeleton-box" style="height: 58px; width: 100%;"></div>
            <div class="accordion-item glass-panel skeleton skeleton-box" style="height: 58px; width: 100%; margin-top: 15px;"></div>
        `;

        // 4. Finance skeletons
        tablePayableFees.innerHTML = '<tr><td colspan="6"><span class="skeleton"></span></td></tr>';
        tablePaidFees.innerHTML = '<tr><td colspan="6"><span class="skeleton"></span></td></tr>';
    }

    async function loadGradesAndProfile() {
        try {
            const opts = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tokenJWT, userId })
            };
            const result = await apiFetch('/api/grades', opts);
            
            if (result.success && result.data) {
                const data = result.data;
                
                // Populate Profile
                if (data.rsThongTinNguoiHoc && data.rsThongTinNguoiHoc.length > 0) {
                    const info = data.rsThongTinNguoiHoc[0];
                    studentName = `${info.QLSV_NGUOIHOC_HODEM} ${info.QLSV_NGUOIHOC_TEN}`;
                    localStorage.setItem('studentName', studentName);
                    
                    sidebarStudentName.textContent = studentName;
                    sidebarStudentClass.textContent = `Mã: ${info.QLSV_NGUOIHOC_MASO}`;
                    
                    profileStudentCode.textContent = info.QLSV_NGUOIHOC_MASO;
                    profileStudentName.textContent = studentName;
                    profileStudentDob.textContent = info.QLSV_NGUOIHOC_NGAYSINH;
                    profileStudentClass.textContent = info.DAOTAO_LOPQUANLY_TEN;
                    profileStudentMajor.textContent = info.DAOTAO_CHUONGTRINH_TEN;
                    profileStudentProgram.textContent = info.DAOTAO_HEDAOTAO_TEN;
                    
                    welcomeGreeting.textContent = `${welcomeGreeting.textContent.replace('!', '')}, ${info.QLSV_NGUOIHOC_TEN}!`;
                    const cachedAvatar = localStorage.getItem(`custom_avatar_${info.QLSV_NGUOIHOC_MASO}`);
                    if (cachedAvatar) {
                        userAvatar.src = cachedAvatar;
                    } else {
                        userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(studentName)}&background=3b82f6&color=fff&size=128`;
                    }
                }

                // Render GPAs
                const gradesList = data.rsDiemKetThucHocPhan || [];
                let totalCredits = 0;
                let totalAccumulatedCredits = 0;
                let weightedScore10 = 0;
                let weightedScore4 = 0;
                
                gradesList.forEach(item => {
                    const credits = parseFloat(item.DAOTAO_HOCPHAN_HOCTRINH) || 0;
                    totalCredits += credits;
                    if (item.DANHGIA_MA === 'DAT') totalAccumulatedCredits += credits;
                    
                    const score10 = parseFloat(item.DIEM) || 0;
                    const score4 = parseFloat(item.DIEMQUYDOI) || 0;
                    weightedScore10 += (score10 * credits);
                    weightedScore4 += (score4 * credits);
                });

                const finalGpa10 = totalCredits > 0 ? (weightedScore10 / totalCredits) : 0;
                const finalGpa4 = totalCredits > 0 ? (weightedScore4 / totalCredits) : 0;

                // Animate numbers counting up beautifully
                animateCountUp(gpaTen, finalGpa10, 2);
                animateCountUp(gpaFour, finalGpa4, 2);
                animateCountUp(accumulatedCredits, totalAccumulatedCredits, 0);

                animateCountUp(gradesGpaTen, finalGpa10, 2);
                animateCountUp(gradesGpaFour, finalGpa4, 2);
                animateCountUp(gradesCredits, totalCredits, 0);
                animateCountUp(gradesAccumulatedCredits, totalAccumulatedCredits, 0);

                cachedDiemThanhPhan = data.rsDiemThanhPhan || [];
                cachedGradesList = gradesList;

                renderGradesAccordion(gradesList);
                renderNewGrades(data.rsDiemMoiNhat || []);
                initGpaPlanner(data.rsDiemTrungBinhChung || [], gradesList);
                initPredictor(data.rsDiemThanhPhan || [], gradesList);
            } else {
                gradesAccordion.innerHTML = `<div class="no-schedule"><i class="fa-solid fa-triangle-exclamation"></i><p>Lỗi tải bảng điểm: ${result.message || 'Lỗi server trường'}</p></div>`;
            }
        } catch (error) {
            console.error('Grades error:', error);
            gradesAccordion.innerHTML = '<div class="no-schedule"><i class="fa-solid fa-triangle-exclamation"></i><p>Không thể kết nối đến API bảng điểm.</p></div>';
        }
    }

    // Number counting up animation utility
    function animateCountUp(element, endVal, decimals = 0, duration = 1000) {
        const startVal = 0;
        let startTime = null;

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            // Ease out quad formula
            const easeProgress = progress * (2 - progress);
            const currentVal = startVal + easeProgress * (endVal - startVal);
            
            element.textContent = currentVal.toFixed(decimals);
            
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                element.textContent = endVal.toFixed(decimals);
            }
        }
        
        window.requestAnimationFrame(step);
    }

    function renderGradesAccordion(gradesList) {
        if (gradesList.length === 0) {
            gradesAccordion.innerHTML = '<div class="no-schedule"><i class="fa-solid fa-clipboard-question"></i><p>Chưa có dữ liệu bảng điểm học tập.</p></div>';
            return;
        }

        const semesters = {};
        gradesList.forEach(item => {
            const semKey = `${item.NAMHOC} - Học kỳ ${item.HOCKY}`;
            if (!semesters[semKey]) semesters[semKey] = [];
            semesters[semKey].push(item);
        });

        const sortedSemKeys = Object.keys(semesters).sort((a, b) => b.localeCompare(a));
        
        gradesAccordion.innerHTML = '';
        sortedSemKeys.forEach((semName, index) => {
            const semGrades = semesters[semName];
            
            let semCredits = 0;
            let semWeighted10 = 0;
            let semWeighted4 = 0;
            semGrades.forEach(g => {
                const credits = parseFloat(g.DAOTAO_HOCPHAN_HOCTRINH) || 0;
                semCredits += credits;
                semWeighted10 += ((parseFloat(g.DIEM) || 0) * credits);
                semWeighted4 += ((parseFloat(g.DIEMQUYDOI) || 0) * credits);
            });
            const semGpa10 = semCredits > 0 ? (semWeighted10 / semCredits).toFixed(2) : '0.0';
            const semGpa4 = semCredits > 0 ? (semWeighted4 / semCredits).toFixed(2) : '0.0';

            const accordionItem = document.createElement('div');
            accordionItem.className = `accordion-item glass-panel ${index === 0 ? 'active' : ''}`;
            
            const header = document.createElement('div');
            header.className = 'accordion-header';
            header.innerHTML = `
                <h4>${semName}</h4>
                <div class="accordion-header-info">
                    <span>ĐTB: <strong>${semGpa10}</strong> (Hệ 10) | <strong>${semGpa4}</strong> (Hệ 4)</span>
                    <span>TC: <strong>${semCredits}</strong></span>
                    <i class="fa-solid fa-chevron-down"></i>
                </div>
            `;
            
            header.addEventListener('click', () => {
                accordionItem.classList.toggle('active');
            });
            
            const content = document.createElement('div');
            content.className = 'accordion-content';
            
            const tableDiv = document.createElement('div');
            tableDiv.className = 'table-responsive';
            
            let rowsHtml = '';
            semGrades.forEach((g, rowIdx) => {
                const statusTag = g.DANHGIA_MA === 'DAT' ? 'tag-green' : 'tag-red';
                rowsHtml += `
                    <tr>
                        <td class="text-center">${rowIdx + 1}</td>
                        <td>${g.DAOTAO_HOCPHAN_MA}</td>
                        <td><strong>${g.DAOTAO_HOCPHAN_TEN}</strong></td>
                        <td class="text-center">${g.DAOTAO_HOCPHAN_HOCTRINH}</td>
                        <td class="text-center">${g.LANHOC}</td>
                        <td class="text-center">${g.LANTHI}</td>
                        <td class="text-center font-bold text-blue">${g.DIEM !== null ? g.DIEM : '---'}</td>
                        <td class="text-center text-purple">${g.DIEMQUYDOI !== null ? g.DIEMQUYDOI : '---'}</td>
                        <td class="text-center">${g.DIEMQUYDOI_TEN || '---'}</td>
                        <td class="text-center"><span class="tag ${statusTag}">${g.DANHGIA_TEN || 'K.Đánh giá'}</span></td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-icon btn-view-component" data-id="${g.DIEM_DANHSACHHOC_ID}" data-title="${g.DAOTAO_HOCPHAN_TEN}">
                                <i class="fa-solid fa-eye"></i> Xem
                            </button>
                        </td>
                    </tr>
                `;
            });

            tableDiv.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="text-center" style="width: 50px">STT</th>
                            <th style="width: 120px">Mã HP</th>
                            <th>Tên học phần</th>
                            <th class="text-center" style="width: 80px">Số TC</th>
                            <th class="text-center" style="width: 80px">Lần học</th>
                            <th class="text-center" style="width: 80px">Lần thi</th>
                            <th class="text-center" style="width: 100px">Điểm Hệ 10</th>
                            <th class="text-center" style="width: 100px">Điểm Hệ 4</th>
                            <th class="text-center" style="width: 80px">Điểm chữ</th>
                            <th class="text-center" style="width: 120px">Kết quả</th>
                            <th class="text-center" style="width: 100px">Chi tiết</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            `;
            
            content.appendChild(tableDiv);
            accordionItem.appendChild(header);
            accordionItem.appendChild(content);
            gradesAccordion.appendChild(accordionItem);
        });

        // Register view component buttons click handler
        const viewCompButtons = gradesAccordion.querySelectorAll('.btn-view-component');
        viewCompButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const courseId = btn.getAttribute('data-id');
                const courseTitle = btn.getAttribute('data-title');
                openComponentGradesModal(courseId, courseTitle);
            });
        });
    }

    async function loadSchedule() {
        const dates = getWeekDates(currentWeekOffset);
        const startDateStr = formatDateToVN(dates.start);
        const endDateStr = formatDateToVN(dates.end);

        currentWeekLabel.textContent = `Tuần từ ${startDateStr} đến ${endDateStr}`;

        // Populate weekly grid with day headers and loading skeleton loaders
        timetableWeekGrid.innerHTML = '';
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(dates.start);
            dayDate.setDate(dates.start.getDate() + i);
            const label = getDayLabel(dayDate.getDay());
            const col = document.createElement('div');
            col.className = 'day-column';
            col.innerHTML = `
                <div class="day-header">
                    <h4>${label}</h4>
                    <p>${formatDateToVN(dayDate).substring(0, 5)}</p>
                </div>
                <div class="timetable-day-cards">
                    <div class="timetable-card skeleton" style="height: 80px;"></div>
                </div>
            `;
            timetableWeekGrid.appendChild(col);
        }

        try {
            const schedOpts = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tokenJWT, userId, startDate: startDateStr, endDate: endDateStr })
            };
            const result = await apiFetch('/api/schedule', schedOpts);
            
            if (result.success) {
                const scheduleList = result.data || [];
                renderTodaySchedule(scheduleList);
                renderWeekGrid(scheduleList, dates.start);
            } else {
                todayScheduleList.innerHTML = `<div class="no-schedule"><i class="fa-solid fa-triangle-exclamation"></i><p>Lỗi tải lịch học: ${result.message}</p></div>`;
                timetableWeekGrid.innerHTML = `<div class="no-schedule col-span-7"><i class="fa-solid fa-triangle-exclamation"></i><p>Lỗi tải thời khóa biểu: ${result.message}</p></div>`;
            }
        } catch (error) {
            console.error('Schedule error:', error);
            todayScheduleList.innerHTML = '<div class="no-schedule"><i class="fa-solid fa-triangle-exclamation"></i><p>Không thể kết nối đến API lịch học.</p></div>';
            timetableWeekGrid.innerHTML = '<div class="no-schedule col-span-7"><i class="fa-solid fa-triangle-exclamation"></i><p>Không thể kết nối đến API thời khóa biểu.</p></div>';
        }
    }

    function renderTodaySchedule(scheduleList) {
        const todayFormatted = formatDateToVN(new Date());
        const todayClasses = scheduleList.filter(item => item.NGAYHOC === todayFormatted);
        
        todayClassesCount.textContent = `${todayClasses.length} tiết học`;
        
        if (todayClasses.length === 0) {
            todayScheduleList.innerHTML = `
                <div class="no-schedule text-muted">
                    <i class="fa-solid fa-calendar-check"></i>
                    <p>Hôm nay cậu không có lịch học nào cả. Nghỉ ngơi nhé!</p>
                </div>
            `;
            return;
        }

        todayClasses.sort((a, b) => {
            const timeA = (a.GIOBATDAU || 0) * 60 + (a.PHUTBATDAU || 0);
            const timeB = (b.GIOBATDAU || 0) * 60 + (b.PHUTBATDAU || 0);
            return timeA - timeB;
        });

        todayScheduleList.innerHTML = '';
        todayClasses.forEach(c => {
            const timeStr = `${formatTwoDigits(c.GIOBATDAU)}h${formatTwoDigits(c.PHUTBATDAU)} - ${formatTwoDigits(c.GIOKETTHUC)}h${formatTwoDigits(c.PHUTKETTHUC)}`;
            const isAttended = c.THONGTINCHUYENCAN && c.THONGTINCHUYENCAN.toLowerCase().includes('vắng') ? 'absent' : 'attended';
            const statusLabel = c.THONGTINCHUYENCAN || 'Chưa học';
            const statusTag = isAttended === 'absent' ? 'tag-red' : 'tag-green';

            const item = document.createElement('div');
            item.className = `schedule-item-card ${isAttended}`;
            item.innerHTML = `
                <div class="course-info">
                    <h4>${c.TENHOCPHAN}</h4>
                    <div class="course-meta">
                        <span><i class="fa-solid fa-clock"></i> ${timeStr} (Tiết ${c.TIETBATDAU}-${c.TIETKETTHUC})</span>
                        <span><i class="fa-solid fa-door-open"></i> Phòng: <strong>${c.PHONGHOC_TEN}</strong></span>
                        <span><i class="fa-solid fa-chalkboard-user"></i> ${c.GIANGVIEN || 'Chưa cập nhật'}</span>
                    </div>
                </div>
                <div class="course-status">
                    <span class="tag ${statusTag}">${statusLabel}</span>
                </div>
            `;
            todayScheduleList.appendChild(item);
        });
    }

    function renderWeekGrid(scheduleList, weekStartDate) {
        timetableWeekGrid.innerHTML = '';
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(weekStartDate);
            dayDate.setDate(weekStartDate.getDate() + i);
            
            const dayFormatted = formatDateToVN(dayDate);
            const dayLabel = getDayLabel(dayDate.getDay());
            const isToday = formatDateToVN(new Date()) === dayFormatted;
            const dayClasses = scheduleList.filter(item => item.NGAYHOC === dayFormatted);
            
            dayClasses.sort((a, b) => {
                const timeA = (a.GIOBATDAU || 0) * 60 + (a.PHUTBATDAU || 0);
                const timeB = (b.GIOBATDAU || 0) * 60 + (b.PHUTBATDAU || 0);
                return timeA - timeB;
            });

            const column = document.createElement('div');
            column.className = 'day-column';
            column.innerHTML = `
                <div class="day-header ${isToday ? 'active' : ''}">
                    <h4>${dayLabel}</h4>
                    <p>${dayFormatted.substring(0, 5)}</p>
                </div>
            `;
            
            const cardsListDiv = document.createElement('div');
            cardsListDiv.className = 'timetable-day-cards';
            
            if (dayClasses.length === 0) {
                cardsListDiv.innerHTML = `<div class="day-no-class">Không có lịch</div>`;
            } else {
                dayClasses.forEach(c => {
                    const timeStr = `${formatTwoDigits(c.GIOBATDAU)}h${formatTwoDigits(c.PHUTBATDAU)}-${formatTwoDigits(c.GIOKETTHUC)}h${formatTwoDigits(c.PHUTKETTHUC)}`;
                    const isAttended = c.THONGTINCHUYENCAN && c.THONGTINCHUYENCAN.toLowerCase().includes('vắng') ? 'absent' : 'attended';
                    
                    const card = document.createElement('div');
                    card.className = `timetable-card ${isAttended}`;
                    card.innerHTML = `
                        <span class="course-title" title="${c.TENHOCPHAN}">${c.TENHOCPHAN}</span>
                        <span class="course-time"><i class="fa-solid fa-clock"></i> ${timeStr} (T${c.TIETBATDAU}-${c.TIETKETTHUC})</span>
                        <span class="course-room"><i class="fa-solid fa-door-open"></i> Phòng: ${c.PHONGHOC_TEN}</span>
                        <span class="course-teacher" title="${c.GIANGVIEN || ''}"><i class="fa-solid fa-user"></i> ${(c.GIANGVIEN || 'Chưa cập nhật').split(' ').pop()}</span>
                    `;
                    cardsListDiv.appendChild(card);
                });
            }
            column.appendChild(cardsListDiv);
            timetableWeekGrid.appendChild(column);
        }
    }

    function navigateWeek(direction) {
        currentWeekOffset += direction;
        loadSchedule();
    }

    async function loadTuition() {
        try {
            const tuOpts = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tokenJWT, userId })
            };
            const result = await apiFetch('/api/tuition', tuOpts);
            
            if (result.success) {
                const summaryList = result.summary || [];
                const payableList = result.payable || [];
                const paidList = result.paid || [];
                
                let totalPayable = 0;
                let totalPaid = 0;
                let totalExempt = 0;
                
                if (summaryList.length > 0) {
                    const s = summaryList[0];
                    totalPayable = parseFloat(s.TONGKHOANPHAINOP) || 0;
                    totalPaid = parseFloat(s.TONGKHOANDANOP) || 0;
                    totalExempt = parseFloat(s.TONGKHOANDUOCMIEN) || 0;
                } else {
                    payableList.forEach(item => totalPayable += (parseFloat(item.SOTIEN) || 0));
                    paidList.forEach(item => totalPaid += (parseFloat(item.SOTIEN) || 0));
                }
                
                const totalRemaining = Math.max(0, totalPayable - totalPaid - totalExempt);

                tuitionRemaining.textContent = formatCurrency(totalRemaining);
                tuitionTotalPaid.textContent = formatCurrency(totalPaid);
                tuitionTotalPayable.textContent = formatCurrency(totalPayable);

                // Animate donut chart filling up
                const paidPercent = totalPayable > 0 ? (totalPaid / totalPayable) * 100 : 100;
                let currentPercent = 0;
                const donutInterval = setInterval(() => {
                    if (currentPercent >= paidPercent) {
                        clearInterval(donutInterval);
                        tuitionDonut.style.background = `conic-gradient(var(--green) 0% ${paidPercent}%, rgba(255,255,255,0.08) ${paidPercent}% 100%)`;
                    } else {
                        currentPercent += 2; // draw gradually
                        tuitionDonut.style.background = `conic-gradient(var(--green) 0% ${Math.min(currentPercent, paidPercent)}%, rgba(255,255,255,0.08) ${Math.min(currentPercent, paidPercent)}% 100%)`;
                    }
                }, 16); // ~60fps drawing speed

                finTotalPayable.textContent = formatCurrency(totalPayable);
                finTotalPaid.textContent = formatCurrency(totalPaid);
                finTotalExempt.textContent = formatCurrency(totalExempt);
                finTotalRemaining.textContent = formatCurrency(totalRemaining);

                renderPayableTable(payableList);
                renderPaidTable(paidList);
            }
        } catch (error) {
            console.error('Tuition error:', error);
        }
    }

    function renderPayableTable(payableList) {
        tablePayableFees.innerHTML = '';
        if (payableList.length === 0) {
            tablePayableFees.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Không có khoản phải nộp nào cần đóng.</td></tr>';
            return;
        }

        payableList.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-center">${index + 1}</td>
                <td>${item.SEMESTER || '---'}</td>
                <td><strong>${item.TAICHINH_CACKHOANTHU_TEN}</strong></td>
                <td>${item.NOIDUNG || 'Học phí môn học'}</td>
                <td class="text-right text-red font-bold">${formatCurrency(item.SOTIEN)}</td>
                <td>${item.NGAYTAO_DD_MM_YYYY || '---'}</td>
            `;
            tablePayableFees.appendChild(tr);
        });
    }

    function renderPaidTable(paidList) {
        tablePaidFees.innerHTML = '';
        if (paidList.length === 0) {
            tablePaidFees.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Chưa ghi nhận lịch sử giao dịch đóng tiền học.</td></tr>';
            return;
        }

        paidList.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-center">${index + 1}</td>
                <td>${item.SEMESTER || '---'}</td>
                <td><strong>${item.TAICHINH_CACKHOANTHU_TEN}</strong></td>
                <td>${item.NOIDUNG || 'Nộp tiền học phí'}</td>
                <td class="text-right text-green font-bold">${formatCurrency(item.SOTIEN)}</td>
                <td>${item.NGAYTAO_DD_MM_YYYY || '---'}</td>
            `;
            tablePaidFees.appendChild(tr);
        });
    }

    function getWeekDates(weekOffset) {
        const today = new Date();
        const currentDay = today.getDay();
        const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
        
        const monday = new Date(today.setDate(diff + (weekOffset * 7)));
        monday.setHours(0, 0, 0, 0);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        
        return { start: monday, end: sunday };
    }

    function formatDateToVN(date) {
        const d = new Date(date);
        const day = formatTwoDigits(d.getDate());
        const month = formatTwoDigits(d.getMonth() + 1);
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }

    function formatDateToDB(date) {
        const d = new Date(date);
        const day = formatTwoDigits(d.getDate());
        const month = formatTwoDigits(d.getMonth() + 1);
        const year = d.getFullYear();
        return `${year}-${month}-${day}`;
    }

    function formatTwoDigits(val) {
        if (val === undefined || val === null) return '00';
        const str = '' + val;
        return str.length === 1 ? '0' + str : str;
    }

    function formatCurrency(val) {
        const num = parseFloat(val) || 0;
        return num.toLocaleString('vi-VN') + 'đ';
    }

    function getDayLabel(dayIdx) {
        const labels = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
        return labels[dayIdx];
    }

    function renderDateHeader() {
        const today = new Date();
        const label = getDayLabel(today.getDay());
        const dateStr = formatDateToVN(today);
        currentDateString.textContent = `${label}, ngày ${dateStr}`;
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    // New premium features logic functions

    function initAvatarUpload() {
        const avatarUploadInput = document.getElementById('avatarUploadInput');
        const userAvatar = document.getElementById('userAvatar');
        
        if (!avatarUploadInput || !userAvatar) return;
        
        userAvatar.addEventListener('click', () => {
            avatarUploadInput.click();
        });
        
        avatarUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!file.type.startsWith('image/')) {
                showToast('Lỗi định dạng', 'Vui lòng chọn file hình ảnh!', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64String = event.target.result;
                const masv = profileStudentCode.textContent || userId;
                localStorage.setItem(`custom_avatar_${masv}`, base64String);
                userAvatar.src = base64String;
                showToast('Thành công', 'Đã cập nhật ảnh đại diện mới!', 'success');
            };
            reader.readAsDataURL(file);
        });
    }

    async function loadExams() {
        try {
            const exOpts = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tokenJWT, userId })
            };
            const result = await apiFetch('/api/exams', exOpts);
            
            if (result.success) {
                examsList = (result.data || []).filter(item => item.PHANLOAI === 'LICHTHI');
                renderExamsTable();
                renderDashboardExams();
            } else {
                console.error('Failed to load exams:', result.message);
            }
        } catch (error) {
            console.error('Error fetching exams:', error);
        }
    }

    function parseDate(dateStr) {
        if (!dateStr) return new Date();
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        return new Date(dateStr);
    }

    function findCourseDetailsByName(courseName) {
        if (!cachedGradesList || cachedGradesList.length === 0) return null;
        return cachedGradesList.find(g => 
            g.DAOTAO_HOCPHAN_TEN && g.DAOTAO_HOCPHAN_TEN.toLowerCase().trim() === courseName.toLowerCase().trim()
        );
    }

    function renderExamsTable() {
        const tbody = document.getElementById('tableExams').querySelector('tbody');
        if (!tbody) return;
        
        if (examsList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">Không có lịch thi nào được ghi nhận.</td></tr>';
            return;
        }
        
        // Sort exams by date
        const sortedExams = [...examsList].sort((a, b) => {
            const dateA = parseDate(a.NGAYHOC);
            const dateB = parseDate(b.NGAYHOC);
            return dateA - dateB;
        });
        
        tbody.innerHTML = '';
        sortedExams.forEach((ex, index) => {
            const details = findCourseDetailsByName(ex.TENHOCPHAN);
            const hocphanMa = details ? details.DAOTAO_HOCPHAN_MA : '---';
            const soTinChi = details ? details.DAOTAO_HOCPHAN_HOCTRINH : '---';
            
            const timeStr = `${formatTwoDigits(ex.GIOBATDAU)}h${formatTwoDigits(ex.PHUTBATDAU)} - ${formatTwoDigits(ex.GIOKETTHUC)}h${formatTwoDigits(ex.PHUTKETTHUC)}`;
            
            let formStr = 'Tập trung';
            if (ex.DANGKY_LOPHOCPHAN_TEN && ex.DANGKY_LOPHOCPHAN_TEN.includes('TNM')) {
                formStr = 'Trắc nghiệm máy';
            } else if (ex.DANGKY_LOPHOCPHAN_TEN && ex.DANGKY_LOPHOCPHAN_TEN.includes('TL')) {
                formStr = 'Tự luận';
            }
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-center">${index + 1}</td>
                <td>${hocphanMa}</td>
                <td><strong>${ex.TENHOCPHAN}</strong></td>
                <td class="text-center">${soTinChi}</td>
                <td class="text-center text-blue font-bold">${ex.NGAYHOC}</td>
                <td class="text-center">${ex.CATHI} (${timeStr})</td>
                <td class="text-center">${formStr}</td>
                <td class="text-center">---</td>
                <td class="text-center text-purple font-bold">${ex.PHONGHOC_TEN}</td>
                <td>${ex.THONGTINCHUYENCAN || '---'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderDashboardExams() {
        const upcomingExamsList = document.getElementById('upcomingExamsList');
        if (!upcomingExamsList) return;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const upcoming = examsList.filter(ex => {
            const examDate = parseDate(ex.NGAYHOC);
            return examDate >= today;
        }).sort((a, b) => parseDate(a.NGAYHOC) - parseDate(b.NGAYHOC));
        
        if (upcoming.length === 0) {
            upcomingExamsList.innerHTML = `
                <div class="no-schedule text-muted">
                    <i class="fa-solid fa-circle-check"></i>
                    <p>Cậu không có lịch thi nào sắp tới. Yên tâm nhé!</p>
                </div>
            `;
            return;
        }
        
        upcomingExamsList.innerHTML = '';
        upcoming.slice(0, 5).forEach(ex => {
            const examDate = parseDate(ex.NGAYHOC);
            const timeDiff = examDate - today;
            const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            
            let badgeClass = 'tag-blue';
            let badgeText = `Còn ${daysLeft} ngày`;
            if (daysLeft === 0) {
                badgeClass = 'tag-red';
                badgeText = 'HÔM NAY';
            } else if (daysLeft === 1) {
                badgeClass = 'tag-orange';
                badgeText = 'Ngày mai';
            }
            
            const timeStr = `${formatTwoDigits(ex.GIOBATDAU)}h${formatTwoDigits(ex.PHUTBATDAU)}`;
            
            const item = document.createElement('div');
            item.className = 'new-grade-item-card'; // re-use dashboard flex row card style
            item.style.padding = '10px 0';
            item.innerHTML = `
                <div class="course-info">
                    <h4>${ex.TENHOCPHAN}</h4>
                    <div class="course-meta" style="font-size: 0.8rem; color: var(--text-muted);">
                        <span>${ex.NGAYHOC} (${ex.CATHI}) lúc ${timeStr}</span> | 
                        <span>Phòng: <strong>${ex.PHONGHOC_TEN}</strong></span>
                    </div>
                </div>
                <div class="exam-status">
                    <span class="tag ${badgeClass}">${badgeText}</span>
                </div>
            `;
            upcomingExamsList.appendChild(item);
        });
    }

    function openComponentGradesModal(courseId, courseTitle) {
        const modal = document.getElementById('gradesModalBackdrop');
        const modalTitle = document.getElementById('modalCourseTitle');
        const tbody = document.getElementById('tableComponentGrades').querySelector('tbody');
        
        modalTitle.textContent = `${courseTitle} - Điểm chi tiết`;
        tbody.innerHTML = '';
        
        const components = cachedDiemThanhPhan.filter(c => c.DIEM_DANHSACHHOC_ID === courseId);
        
        if (components.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Không có dữ liệu điểm thành phần.</td></tr>';
        } else {
            components.forEach(c => {
                const name = c.DIEM_THANHPHANDIEM_TEN || 'Thành phần khác';
                const ma = (c.DIEM_THANHPHANDIEM_MA || '').toLowerCase();
                let weightStr = '---';
                
                if (name.toLowerCase().includes('chuyên cần') || ma.includes('cc')) weightStr = '20%';
                else if (name.toLowerCase().includes('giữa kỳ') || name.toLowerCase().includes('kiểm tra') || ma.includes('gk')) weightStr = '30%';
                else if (name.toLowerCase().includes('thi kết thúc') || ma.includes('thi') || ma.includes('ck')) weightStr = '50%';
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${name}</strong></td>
                    <td class="text-center">${weightStr}</td>
                    <td class="text-center font-bold text-blue">${c.DIEM !== null ? c.DIEM : '---'}</td>
                    <td class="text-center">${c.LANHOC}</td>
                    <td class="text-center">${c.LANTHI}</td>
                `;
                tbody.appendChild(tr);
            });
        }
        
        modal.classList.remove('hidden');
    }

    function renderNewGrades(newGrades) {
        const newGradesList = document.getElementById('newGradesList');
        if (!newGradesList) return;
        
        if (newGrades.length === 0) {
            newGradesList.innerHTML = `
                <div class="no-schedule text-muted">
                    <i class="fa-solid fa-circle-check"></i>
                    <p>Không có điểm số mới cập nhật gần đây.</p>
                </div>
            `;
            return;
        }
        
        newGradesList.innerHTML = '';
        newGrades.forEach(g => {
            const statusTag = g.DANHGIA_MA === 'DAT' ? 'tag-green' : 'tag-red';
            const gradeItem = document.createElement('div');
            gradeItem.className = 'new-grade-item-card';
            gradeItem.style.padding = '10px 0';
            gradeItem.innerHTML = `
                <div class="course-info">
                    <h4>${g.DAOTAO_HOCPHAN_TEN}</h4>
                    <div class="course-meta" style="font-size: 0.8rem; color: var(--text-muted);">
                        <span>Mã HP: ${g.DAOTAO_HOCPHAN_MA}</span> | 
                        <span>TC: ${g.DAOTAO_HOCPHAN_HOCTRINH}</span>
                    </div>
                </div>
                <div class="grade-badge-group" style="display: flex; align-items: center; gap: 8px;">
                    <div class="grade-circle" style="width: 36px; height: 36px; border-radius: 50%; background: rgba(59,130,246,0.12); display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--blue); font-size: 0.9rem;">
                        ${g.DIEM !== null ? g.DIEM : '---'}
                    </div>
                    <span class="tag ${statusTag}">${g.DIEMQUYDOI_TEN || 'Đạt'}</span>
                </div>
            `;
            newGradesList.appendChild(gradeItem);
        });
    }

    function initGpaPlanner(diemTrungBinhChung, gradesList) {
        const planTotalCredits = document.getElementById('planTotalCredits');
        const planCurrentCredits = document.getElementById('planCurrentCredits');
        const planRemainingCredits = document.getElementById('planRemainingCredits');
        const planCurrentGpa = document.getElementById('planCurrentGpa');
        const gpaPlannerTableBody = document.getElementById('gpaPlannerTableBody');
        
        if (!gpaPlannerTableBody) return;
        
        let cumRecord = diemTrungBinhChung.find(r => 
            (r.LOAIDIEMTRUNGBINH_MA === 'TRUNGBINHTICHLUY' || r.LOAIDIEMTRUNGBINH_TEN === 'TRUNGBINHTICHLUY') && 
            (r.THANGDIEM_MA === '4' || r.THANGDIEM_TEN === '4')
        );
        
        let totalC = 150;
        if (cumRecord && cumRecord.TONGSOTINCHICTDT) {
            totalC = parseFloat(cumRecord.TONGSOTINCHICTDT) || 150;
        }
        
        let currC = 0;
        let weighted4 = 0;
        gradesList.forEach(g => {
            const credits = parseFloat(g.DAOTAO_HOCPHAN_HOCTRINH) || 0;
            if (g.DANHGIA_MA === 'DAT') currC += credits;
            weighted4 += ((parseFloat(g.DIEMQUYDOI) || 0) * credits);
        });
        
        let totalCreditsRegistered = gradesList.reduce((sum, g) => sum + (parseFloat(g.DAOTAO_HOCPHAN_HOCTRINH) || 0), 0);
        let currGpa = totalCreditsRegistered > 0 ? (weighted4 / totalCreditsRegistered) : 0;
        
        if (cumRecord && cumRecord.DIEMTRUNGBINH) {
            currGpa = parseFloat(cumRecord.DIEMTRUNGBINH);
            currC = parseFloat(cumRecord.TONGSOTINCHI) || currC;
        }
        
        const remC = Math.max(0, totalC - currC);
        
        planTotalCredits.textContent = totalC;
        planCurrentCredits.textContent = currC;
        planRemainingCredits.textContent = remC;
        planCurrentGpa.textContent = currGpa.toFixed(2);
        
        const targets = [
            { name: 'Bằng Xuất sắc', gpa: 3.60, color: 'text-purple' },
            { name: 'Bằng Giỏi', gpa: 3.20, color: 'text-blue' },
            { name: 'Bằng Khá', gpa: 2.50, color: 'text-green' },
            { name: 'Đủ tốt nghiệp', gpa: 2.00, color: 'text-yellow' }
        ];
        
        gpaPlannerTableBody.innerHTML = '';
        targets.forEach(t => {
            let reqGpa = 0;
            let reqGpa10 = 0;
            let statusText = '';
            let statusClass = '';
            
            if (currGpa >= t.gpa) {
                reqGpa = 0;
                reqGpa10 = 0;
                statusText = 'Đã đạt được! 🎉';
                statusClass = 'tag-green';
            } else if (remC <= 0) {
                statusText = 'Không thể đạt';
                statusClass = 'tag-red';
            } else {
                reqGpa = (t.gpa * totalC - currGpa * currC) / remC;
                reqGpa10 = reqGpa * 2.5;
                
                if (reqGpa > 4.0) {
                    statusText = 'Không khả thi';
                    statusClass = 'tag-red';
                } else if (reqGpa > 3.6) {
                    statusText = 'Rất khó đạt';
                    statusClass = 'tag-orange';
                } else if (reqGpa > 3.2) {
                    statusText = 'Cần nỗ lực cao';
                    statusClass = 'tag-yellow';
                } else {
                    statusText = 'Khả thi';
                    statusClass = 'tag-blue';
                }
            }
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${t.name}</strong></td>
                <td class="text-center font-bold">${t.gpa.toFixed(2)}</td>
                <td class="text-center font-bold ${t.color}">${reqGpa === 0 ? '---' : reqGpa > 4.0 ? 'N/A' : reqGpa.toFixed(2)}</td>
                <td class="text-center text-muted">${reqGpa10 === 0 ? '---' : reqGpa > 4.0 ? 'N/A' : reqGpa10.toFixed(2)}</td>
                <td><span class="tag ${statusClass}">${statusText}</span></td>
            `;
            gpaPlannerTableBody.appendChild(tr);
        });
    }

    function initPredictor(diemThanhPhan, gradesList) {
        const predictorCourseSelect = document.getElementById('predictorCourseSelect');
        const predictorCalculatorArea = document.getElementById('predictorCalculatorArea');
        const predictorEmptyMsg = document.getElementById('predictorEmptyMsg');
        
        if (!predictorCourseSelect) return;
        
        const courseMap = {};
        diemThanhPhan.forEach(item => {
            const courseId = item.DIEM_DANHSACHHOC_ID;
            if (!courseMap[courseId]) {
                courseMap[courseId] = {
                    id: courseId,
                    code: item.DAOTAO_HOCPHAN_MA,
                    name: item["P.DAOTAO_HOCPHAN_TEN||CASEWHENCT.DAOTAO_HOCPHAN_IDISNULLTHEN'(NGOAICHUONGTRINH)'ELSE''END"] || item.DAOTAO_HOCPHAN_TEN,
                    components: []
                };
            }
            courseMap[courseId].components.push(item);
        });
        
        Object.values(courseMap).forEach(course => {
            let ccScore = null;
            let gkScore = null;
            course.components.forEach(c => {
                const name = (c.DIEM_THANHPHANDIEM_TEN || '').toLowerCase();
                const ma = (c.DIEM_THANHPHANDIEM_MA || '').toLowerCase();
                if (name.includes('chuyên cần') || ma.includes('cc') || ma.includes('chuyencan')) {
                    ccScore = parseFloat(c.DIEM);
                } else if (name.includes('kiểm tra') || name.includes('giữa kỳ') || ma.includes('gk') || ma.includes('kiemtra')) {
                    gkScore = parseFloat(c.DIEM);
                }
            });
            course.cc = ccScore;
            course.gk = gkScore;
        });
        
        predictorCourseSelect.innerHTML = '<option value="">-- Chọn môn học --</option>';
        
        // Filter eligible courses (have CC or GK components)
        const eligibleCourses = Object.values(courseMap).filter(c => c.cc !== null || c.gk !== null);
        
        if (eligibleCourses.length === 0) {
            predictorEmptyMsg.classList.remove('hidden');
            predictorCalculatorArea.classList.add('hidden');
            return;
        }
        
        eligibleCourses.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.name} (${c.code})`;
            predictorCourseSelect.appendChild(opt);
        });
        
        predictorCourseSelect.addEventListener('change', (e) => {
            const courseId = e.target.value;
            if (!courseId) {
                predictorCalculatorArea.classList.add('hidden');
                predictorEmptyMsg.classList.remove('hidden');
                return;
            }
            
            predictorCalculatorArea.classList.remove('hidden');
            predictorEmptyMsg.classList.add('hidden');
            
            const course = eligibleCourses.find(c => c.id === courseId);
            const cc = course.cc !== null ? course.cc : 10.0;
            const gk = course.gk !== null ? course.gk : 8.0;
            
            document.getElementById('predScoreCc').textContent = cc.toFixed(1);
            document.getElementById('predScoreGk').textContent = gk.toFixed(1);
            
            renderTargetTable(cc, gk);
            
            const slider = document.getElementById('predScoreSlider');
            slider.value = 5.0;
            updateForecast(cc, gk, 5.0);
            
            slider.replaceWith(slider.cloneNode(true));
            const newSlider = document.getElementById('predScoreSlider');
            newSlider.addEventListener('input', (event) => {
                const val = parseFloat(event.target.value);
                updateForecast(cc, gk, val);
            });
        });
    }

    function renderTargetTable(cc, gk) {
        const tbody = document.getElementById('predScoreTargetTableBody');
        const targets = [
            { grade: 'A', minScore: 8.5, gpa: '4.0' },
            { grade: 'B+', minScore: 8.0, gpa: '3.5' },
            { grade: 'B', minScore: 7.0, gpa: '3.0' },
            { grade: 'C+', minScore: 6.0, gpa: '2.5' },
            { grade: 'C', minScore: 5.5, gpa: '2.0' },
            { grade: 'D+', minScore: 5.0, gpa: '1.5' },
            { grade: 'D', minScore: 4.0, gpa: '1.0' }
        ];
        
        tbody.innerHTML = '';
        targets.forEach(t => {
            // formula: 0.2*cc + 0.3*gk + 0.5*ck >= minScore => ck >= (minScore - 0.2*cc - 0.3*gk)/0.5
            let reqCk = (t.minScore - (cc * 0.2 + gk * 0.3)) / 0.5;
            
            let displayVal = '';
            let cellClass = '';
            
            if (reqCk > 10.0) {
                displayVal = 'Không thể đạt';
                cellClass = 'text-red';
            } else {
                // UTT rule: exam score must be >= 2.0 to pass, avoiding "điểm liệt"
                if (reqCk < 2.0) {
                    displayVal = '2.0 (Tránh điểm liệt)';
                    cellClass = 'text-green';
                } else {
                    displayVal = reqCk.toFixed(2);
                    cellClass = 'text-blue font-bold';
                }
            }
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${t.grade}</strong></td>
                <td class="text-center">${t.minScore.toFixed(1)}</td>
                <td class="text-center">${t.gpa}</td>
                <td class="text-center ${cellClass}">${displayVal}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function updateForecast(cc, gk, ck) {
        document.getElementById('sliderValueDisplay').textContent = ck.toFixed(1);
        
        const total = cc * 0.2 + gk * 0.3 + ck * 0.5;
        document.getElementById('forecastTotalScore').textContent = total.toFixed(2);
        
        let letterGrade = 'F';
        let gpaVal = '0.0';
        let isPassed = false;
        let isDiemLiet = ck < 2.0;
        
        if (!isDiemLiet) {
            if (total >= 8.5) { letterGrade = 'A'; gpaVal = '4.0'; isPassed = true; }
            else if (total >= 8.0) { letterGrade = 'B+'; gpaVal = '3.5'; isPassed = true; }
            else if (total >= 7.0) { letterGrade = 'B'; gpaVal = '3.0'; isPassed = true; }
            else if (total >= 6.0) { letterGrade = 'C+'; gpaVal = '2.5'; isPassed = true; }
            else if (total >= 5.5) { letterGrade = 'C'; gpaVal = '2.0'; isPassed = true; }
            else if (total >= 5.0) { letterGrade = 'D+'; gpaVal = '1.5'; isPassed = true; }
            else if (total >= 4.0) { letterGrade = 'D'; gpaVal = '1.0'; isPassed = true; }
        }
        
        document.getElementById('forecastLetterGrade').textContent = `${letterGrade} (${gpaVal})`;
        
        const tag = document.getElementById('forecastResultTag');
        if (isPassed) {
            tag.textContent = 'ĐẠT';
            tag.className = 'tag tag-green';
        } else {
            tag.textContent = 'TRƯỢT';
            tag.className = 'tag tag-red';
        }
        
        const warningBox = document.getElementById('forecastWarningBox');
        if (isDiemLiet) {
            warningBox.classList.remove('hidden');
        } else {
            warningBox.classList.add('hidden');
        }
    }
});

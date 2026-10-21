/**
 * SYS.CORE v7.1 - STABLE & QA CERTIFIED
 * Features: Centralized Leveling, Strict Reversion Logic, DST-Safe Dates, Safe DOM Injections.
 */

const system = (function() {
    // --- CONSTANTS & CONFIG ---
    const CURRENT_VERSION = 7.1;
    const VALID_STATS = ['str', 'agi', 'int', 'vit', 'per'];
    const STORAGE_KEY = 'sysCoreData_v7';
    const BASE_EXP = 100;
    const EXP_MULTIPLIER = 1.5;

    const METRICS_DEF = {
        study: { id: 'study', name: "Belajar", unit: "menit", defaultTarget: 300 },
        coding: { id: 'coding', name: "Coding", unit: "sesi", defaultTarget: 5 },
        workout: { id: 'workout', name: "Olahraga", unit: "menit", defaultTarget: 150 },
        health: { id: 'health', name: "Kesehatan", unit: "sesi", defaultTarget: 7 }
    };

    const RANKS_DEF = [
        { id: 'E', name: 'E-Rank', reqLvl: 1, reqQuests: 0, color: 'text-gray-400' },
        { id: 'D', name: 'D-Rank', reqLvl: 5, reqQuests: 20, color: 'text-sys-emerald' },
        { id: 'C', name: 'C-Rank', reqLvl: 15, reqQuests: 50, color: 'text-sys-accent' },
        { id: 'B', name: 'B-Rank', reqLvl: 30, reqQuests: 150, color: 'text-sys-purple' },
        { id: 'A', name: 'A-Rank', reqLvl: 50, reqQuests: 300, color: 'text-sys-warning' },
        { id: 'S', name: 'S-Rank', reqLvl: 80, reqQuests: 500, color: 'text-sys-danger' },
    ];

    const ACHIEVEMENTS_DEF = [
        { id: 'first_blood', name: 'First Blood', desc: 'Menyelesaikan Quest pertama dalam Ledger.', icon: 'fa-droplet', color: 'text-sys-danger' },
        { id: 'consistency_7', name: 'Unbroken', desc: 'Mencapai streak 7 hari berturut-turut pada Daily Quest.', icon: 'fa-fire', color: 'text-sys-warning' },
        { id: 'scholar', name: 'Scholar', desc: 'Mencatat total 1000 menit belajar di Analytics.', icon: 'fa-book-open', color: 'text-sys-accent' },
        { id: 'builder', name: 'Architect', desc: 'Mencatat 20 sesi koding/proyek selesai.', icon: 'fa-code', color: 'text-sys-emerald' },
        { id: 'boss_slayer', name: 'Raid Clear', desc: 'Menyelesaikan 1 Boss Quest (Raid) utuh.', icon: 'fa-skull', color: 'text-sys-purple' },
        { id: 'milestone_hunter', name: 'Milestone Hunter', desc: 'Menyelesaikan total 5 target Mingguan (Weekly Quests).', icon: 'fa-calendar-check', color: 'text-sys-emerald' }
    ];

    const SKILLS_DEF = [
        { id: 'lrn_1', name: 'Fast Learner', desc: 'Meningkatkan kecepatan memproses informasi dasar.', cost: 1, category: 'Learning', req: [] },
        { id: 'lrn_2', name: 'Deep Focus', desc: 'Ketahanan mempertahankan fokus dalam durasi panjang.', cost: 2, category: 'Learning', req: ['lrn_1'] },
        { id: 'fit_1', name: 'Endurance', desc: 'Peningkatan stamina kardiovaskular dasar.', cost: 1, category: 'Fitness', req: [] },
        { id: 'fit_2', name: 'Iron Body', desc: 'Kekuatan otot inti dan daya tahan tubuh.', cost: 2, category: 'Fitness', req: ['fit_1'] },
        { id: 'dsc_1', name: 'Willpower', desc: 'Disiplin mengesampingkan prokrastinasi instan.', cost: 1, category: 'Discipline', req: [] },
        { id: 'tch_1', name: 'Logic Gate', desc: 'Pemahaman alur logika teknis dan algoritma sistematis.', cost: 1, category: 'Technical', req: [] },
        { id: 'crt_1', name: 'Brainstorm', desc: 'Kapasitas menghasilkan ide kreatif mentah (Ideation).', cost: 1, category: 'Creativity', req: [] },
        { id: 'crt_2', name: 'Design Thinker', desc: 'Merancang arsitektur solusi berbasis empati subjek/pengguna.', cost: 2, category: 'Creativity', req: ['crt_1'] }
    ];

    const DateUtils = {
        getLocalDate: (date = new Date()) => {
            const d = new Date(date);
            return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        },
        getWeekStart: (date = new Date()) => {
            const d = new Date(date);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            d.setDate(diff);
            return DateUtils.getLocalDate(d);
        },
        getLastPeriods: (type, n = 7) => {
            let periods = [];
            const today = new Date();
            for(let i=n-1; i>=0; i--) {
                let d = new Date(today.getFullYear(), today.getMonth(), today.getDate()); 
                if (type === 'daily') {
                    d.setDate(d.getDate() - i);
                    periods.push(DateUtils.getLocalDate(d));
                } else if (type === 'weekly') {
                    d.setDate(d.getDate() - (i*7));
                    periods.push(DateUtils.getWeekStart(d));
                }
            }
            return periods;
        }
    };

    const defaultState = {
        version: CURRENT_VERSION,
        player: { totalExp: 0, statPoints: 0, skillPoints: 0 },
        stats: { str: 10, agi: 10, int: 10, vit: 10, per: 10 },
        quests: [], bossQuests: [], ledger: [], achievements: [], skills: [], activityLogs: [],
        metrics: {
            study: { target: METRICS_DEF.study.defaultTarget },
            coding: { target: METRICS_DEF.coding.defaultTarget },
            workout: { target: METRICS_DEF.workout.defaultTarget },
            health: { target: METRICS_DEF.health.defaultTarget }
        }
    };

    let state;
    let currentFilter = 'all';
    let charts = { radar: null, targetBar: null, trendLine: null };

    // --- XSS SECURE UI HELPERS ---
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-enter p-4 rounded-lg border font-mono text-sm flex items-start gap-3 backdrop-blur-md pointer-events-auto shadow-lg z-[200]`;

        let iconStr = '';
        if (type === 'success') { toast.classList.add('bg-sys-emerald/10', 'border-sys-emerald/30', 'text-sys-emerald'); iconStr = '<i class="fa-solid fa-circle-check mt-0.5"></i>'; }
        else if (type === 'level-up') { toast.classList.add('bg-sys-accent/20', 'border-sys-accent', 'text-white', 'neon-text-blue'); iconStr = '<i class="fa-solid fa-angles-up mt-0.5 text-sys-accent"></i>'; }
        else if (type === 'error') { toast.classList.add('bg-sys-danger/10', 'border-sys-danger/30', 'text-sys-danger'); iconStr = '<i class="fa-solid fa-triangle-exclamation mt-0.5"></i>'; }
        else { toast.classList.add('bg-sys-panel', 'border-sys-border', 'text-white'); iconStr = '<i class="fa-solid fa-info-circle mt-0.5 text-sys-accent"></i>'; }

        const iconWrap = document.createElement('span'); iconWrap.innerHTML = iconStr; 
        const msgWrap = document.createElement('div'); msgWrap.textContent = message; 

        toast.appendChild(iconWrap); toast.appendChild(msgWrap);
        document.getElementById('toast-container').appendChild(toast);

        setTimeout(() => { toast.classList.remove('toast-enter'); toast.classList.add('toast-exit'); setTimeout(() => toast.remove(), 300); }, 4000);
    }

    function showConfirmModal(title, message, onConfirm) {
        const modal = document.getElementById('sys-modal'); const content = document.getElementById('sys-modal-content');
        document.getElementById('sys-modal-title').textContent = title; 
        document.getElementById('sys-modal-msg').textContent = message; 

        modal.classList.remove('hidden'); modal.classList.add('flex'); requestAnimationFrame(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); });
        const close = () => { modal.classList.add('opacity-0'); content.classList.add('scale-95'); setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300); };

        const cancelBtn = document.getElementById('sys-modal-cancel'); const confirmBtn = document.getElementById('sys-modal-confirm');
        const newCancel = cancelBtn.cloneNode(true); const newConfirm = confirmBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn); confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);

        newCancel.addEventListener('click', close); newConfirm.addEventListener('click', () => { close(); onConfirm(); });
    }

    // --- SCHEMA & DATA MIGRATION ---
    function validateSchema(parsedData) {
        if (!parsedData || typeof parsedData !== 'object') throw new Error("Format JSON tidak valid.");
        let s = { ...parsedData };
        
        if (Array.isArray(s.quests) && s.quests.length > 2000) throw new Error("Terlalu banyak quest (Melebihi batas aman).");
        if (!s.player || typeof s.player.totalExp !== 'number' || isNaN(s.player.totalExp)) s.player = { ...defaultState.player };
        if (!s.stats || typeof s.stats !== 'object') s.stats = { ...defaultState.stats };
        
        VALID_STATS.forEach(st => { if (typeof s.stats[st] !== 'number' || isNaN(s.stats[st])) s.stats[st] = 10; });
        if (!Array.isArray(s.quests)) s.quests = []; if (!Array.isArray(s.bossQuests)) s.bossQuests = [];
        if (!Array.isArray(s.ledger)) s.ledger = []; if (!Array.isArray(s.activityLogs)) s.activityLogs = [];
        if (!Array.isArray(s.achievements)) s.achievements = []; if (!Array.isArray(s.skills)) s.skills = [];
        if (!s.metrics) s.metrics = { ...defaultState.metrics };

        return s;
    }

    function executeMigration(data) {
        if (!data.version || data.version < CURRENT_VERSION) {
            try { localStorage.setItem(STORAGE_KEY + '_backup', JSON.stringify(data)); } catch(e) {}
            let migrated = { ...data };
            if (!migrated.achievements) migrated.achievements = [];
            if (!migrated.skills) migrated.skills = [];
            if (!migrated.bossQuests) migrated.bossQuests = [];
            if (!migrated.player.skillPoints || isNaN(migrated.player.skillPoints)) migrated.player.skillPoints = 0;
            if (!migrated.metrics) migrated.metrics = { ...defaultState.metrics };
            migrated.version = CURRENT_VERSION;
            return validateSchema(migrated);
        }
        return validateSchema(data);
    }

    function loadState() {
        try {
            const rawData = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('sysCoreData_v6');
            if (rawData) { state = executeMigration(JSON.parse(rawData)); } 
            else { state = JSON.parse(JSON.stringify(defaultState)); }
        } catch (e) {
            showToast("Gagal memuat penyimpanan lokal. Menggunakan State Default.", "error");
            state = JSON.parse(JSON.stringify(defaultState));
        }
    }

    function saveState() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); checkAchievements(); } 
        catch (e) { showToast("CRITICAL ERROR: Gagal menyimpan. Storage mungkin penuh.", "error"); }
    }

    // --- CALCULUS & LOGIC ---
    function calculateLevelInfo(totalExp) {
        let lvl = 1; let neededForNext = BASE_EXP; let cumulativeExp = 0;
        while (totalExp >= cumulativeExp + neededForNext) {
            cumulativeExp += neededForNext; 
            lvl++; 
            neededForNext = Math.floor(neededForNext * EXP_MULTIPLIER);
        }
        return { level: lvl, currentExp: totalExp - cumulativeExp, maxExp: neededForNext };
    }

    function getCombatPower(stats, level) {
        const base = (stats.str * 1.5) + (stats.agi * 1.2) + (stats.int * 1.4) + (stats.vit * 1.3) + (stats.per * 1.1);
        return Math.floor(base * (1 + (level * 0.05)));
    }

    function calculateRank() {
        const lvl = calculateLevelInfo(state.player.totalExp).level;
        const totalQuestsDone = state.ledger.filter(l => l.type === 'GAIN' && !l.txId.startsWith('boss')).length;
        let currentRank = RANKS_DEF[0];
        for (let i = RANKS_DEF.length - 1; i >= 0; i--) {
            if (lvl >= RANKS_DEF[i].reqLvl && totalQuestsDone >= RANKS_DEF[i].reqQuests) { currentRank = RANKS_DEF[i]; break; }
        }
        return currentRank;
    }

    function checkAchievements() {
        let newlyUnlocked = false;
        const totalGains = state.ledger.filter(l => l.type === 'GAIN').length;
        const maxStreak = Math.max(...state.quests.map(q => q.streak ? q.streak.longest : 0), 0);

        let studyTotal = 0; let codingTotal = 0;
        state.activityLogs.forEach(l => {
            if (l.metricId === 'study') studyTotal += Number(l.value);
            if (l.metricId === 'coding') codingTotal += Number(l.value);
        });

        const bossDone = state.bossQuests.filter(b => b.claimed).length;
        let weeklyDoneCount = 0;
        state.quests.forEach(q => { if(q.type === 'weekly' && q.history) weeklyDoneCount += q.history.length; });

        const checks = {
            'first_blood': totalGains >= 1, 'consistency_7': maxStreak >= 7, 'scholar': studyTotal >= 1000,
            'builder': codingTotal >= 20, 'boss_slayer': bossDone >= 1, 'milestone_hunter': weeklyDoneCount >= 5
        };

        ACHIEVEMENTS_DEF.forEach(ach => {
            if (checks[ach.id] && !state.achievements.includes(ach.id)) {
                state.achievements.push(ach.id);
                showToast(`ACHIEVEMENT UNLOCKED: ${ach.name}!`, 'success');
                newlyUnlocked = true;
            }
        });

        if (newlyUnlocked) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){} if(document.getElementById('section-progression').classList.contains('block')) renderProgression(); }
    }

    function processExpAndLog(quest, isCompleting, periodStr, isBoss = false) {
        const txId = isBoss ? `boss-${quest.id}-${periodStr}` : `${quest.id}-${periodStr}`;
        const amount = isCompleting ? quest.exp : -quest.exp;

        if (isCompleting) {
            if (state.ledger.some(l => l.txId === txId && l.type === 'GAIN')) return false; 
            const oldLvl = calculateLevelInfo(state.player.totalExp).level;
            state.player.totalExp += amount;
            state.ledger.push({ txId, type: 'GAIN', amount, timestamp: Date.now() });
            const newLvl = calculateLevelInfo(state.player.totalExp).level;

            if (newLvl > oldLvl) {
                const levelDiff = newLvl - oldLvl;
                state.player.statPoints += levelDiff * 3;
                state.player.skillPoints += levelDiff * 1;
                showToast(`LEVEL UP! (Lv.${newLvl}) +${levelDiff * 3} Stat Pts, +${levelDiff} SP.`, 'level-up');
            }
        } else {
            const oldLvl = calculateLevelInfo(state.player.totalExp).level;
            const newLvl = calculateLevelInfo(state.player.totalExp + amount).level;
            
            if (newLvl < oldLvl) {
                const statPtsRevoked = (oldLvl - newLvl) * 3;
                const skillPtsRevoked = (oldLvl - newLvl);
                if (state.player.statPoints < statPtsRevoked || state.player.skillPoints < skillPtsRevoked) {
                    return 'BLOCKED_BY_STATS';
                }
                state.player.statPoints -= statPtsRevoked;
                state.player.skillPoints -= skillPtsRevoked;
            }
            state.player.totalExp += amount;
            state.ledger.push({ txId, type: 'REVERT', amount, timestamp: Date.now() });
        }

        if (!isBoss && quest.metricId && quest.metricId !== 'none') {
            if (isCompleting) {
                state.activityLogs.push({ id: txId, questId: quest.id, metricId: quest.metricId, value: quest.metricValue, dateStr: DateUtils.getLocalDate(), timestamp: Date.now() });
            } else {
                state.activityLogs = state.activityLogs.filter(log => log.id !== txId);
            }
        }
        return true;
    }

    // --- CHART RENDERING (Duplication Safe) ---
    function updateChartRadar() {
        const canvas = document.getElementById('statRadarChart'); if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dataValues = [state.stats.str, state.stats.agi, state.stats.int, state.stats.vit, state.stats.per];

        if (charts.radar) { charts.radar.data.datasets[0].data = dataValues; charts.radar.update(); return; }
        charts.radar = new Chart(ctx, {
            type: 'radar',
            data: { labels: ['STR', 'AGI', 'INT', 'VIT', 'PER'], datasets: [{ data: dataValues, backgroundColor: 'rgba(0, 240, 255, 0.2)', borderColor: '#00F0FF', borderWidth: 2, pointBackgroundColor: '#00F0FF', pointBorderColor: '#fff', pointHoverBackgroundColor: '#fff', pointHoverBorderColor: '#00F0FF' }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { r: { grid: { color: 'rgba(30, 45, 74, 0.8)' }, angleLines: { color: 'rgba(30, 45, 74, 0.8)' }, ticks: { display: false, maxTicksLimit: 5 }, pointLabels: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 11 } } } }, plugins: { legend: { display: false } } }
        });
    }

    function updateAnalyticsCharts() {
        const dailyQuests = state.quests.filter(q => q.type === 'daily');
        const last7Days = DateUtils.getLastPeriods('daily', 7);
        let possible = dailyQuests.length * 7;
        let completedCount = 0;

        dailyQuests.forEach(q => { if (q.history) { q.history.forEach(h => { if (last7Days.includes(h)) completedCount++; }); } });

        const disciplinePct = possible > 0 ? Math.min(Math.round((completedCount / possible) * 100), 100) : 0;
        document.getElementById('ui-metric-discipline').textContent = `${disciplinePct}%`;

        let activeDaysCount = 0;
        last7Days.forEach(dayStr => { if (state.activityLogs.some(l => l.dateStr === dayStr)) activeDaysCount++; });
        document.getElementById('ui-metric-consistency').textContent = `${activeDaysCount}/7`;

        const targetBarCanvas = document.getElementById('targetBarChart');
        if (targetBarCanvas) {
            const tCtx = targetBarCanvas.getContext('2d');
            const metricKeys = Object.keys(METRICS_DEF);
            const totals = metricKeys.map(k => { let sum = 0; state.activityLogs.forEach(l => { if (l.metricId === k && last7Days.includes(l.dateStr)) sum += Number(l.value); }); return sum; });
            const targets = metricKeys.map(k => state.metrics[k].target || METRICS_DEF[k].defaultTarget);
            const percentages = totals.map((val, idx) => Math.min(Math.round((val / targets[idx]) * 100), 100));

            if (charts.targetBar) { charts.targetBar.data.datasets[0].data = percentages; charts.targetBar.update(); } 
            else { charts.targetBar = new Chart(tCtx, { type: 'bar', data: { labels: metricKeys.map(k => METRICS_DEF[k].name), datasets: [{ data: percentages, backgroundColor: ['#00F0FF', '#00FFA3', '#FFB800', '#B534FF'], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, grid: { color: 'rgba(30, 45, 74, 0.5)' }, ticks: { color: '#94A3B8' } }, x: { grid: { display: false }, ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono' } } } }, plugins: { legend: { display: false } } } }); }
        }

        const trendLineCanvas = document.getElementById('trendLineChart');
        if (trendLineCanvas) {
            const lCtx = trendLineCanvas.getContext('2d');
            const selectedMetric = document.getElementById('trend-metric-selector').value;
            const trendData = last7Days.map(dayStr => { let sum = 0; state.activityLogs.forEach(l => { if (l.metricId === selectedMetric && l.dateStr === dayStr) sum += Number(l.value); }); return sum; });

            if (charts.trendLine) { charts.trendLine.data.datasets[0].data = trendData; charts.trendLine.update(); } 
            else { charts.trendLine = new Chart(lCtx, { type: 'line', data: { labels: last7Days.map(d => d.slice(5)), datasets: [{ label: 'Aktivitas', data: trendData, borderColor: '#00FFA3', backgroundColor: 'rgba(0, 255, 163, 0.1)', fill: true, tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(30, 45, 74, 0.5)' }, ticks: { color: '#94A3B8' } }, x: { grid: { display: false }, ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono' } } } }, plugins: { legend: { display: false } } } }); }
        }
    }

    // --- DOM RENDERERS (XSS SAFE) ---
    function renderProgression() {
        const achList = document.getElementById('achievements-list'); achList.innerHTML = '';
        ACHIEVEMENTS_DEF.forEach(ach => {
            const isUnlocked = state.achievements.includes(ach.id);
            const div = document.createElement('div'); div.className = `p-4 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all tooltip-container ${isUnlocked ? 'bg-sys-dark border-' + ach.color.split('-')[1] : 'bg-sys-dark/30 border-sys-border opacity-50 grayscale'}`;
            const icon = document.createElement('i'); icon.className = `fa-solid ${ach.icon} text-3xl ${isUnlocked ? ach.color : 'text-sys-textMuted'}`; icon.setAttribute('aria-hidden', 'true');
            const title = document.createElement('span'); title.className = `font-mono text-xs font-bold ${isUnlocked ? 'text-white' : 'text-sys-textMuted'}`; title.textContent = ach.name;
            const tooltip = document.createElement('span'); tooltip.className = "tooltip-text absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 invisible transition-opacity whitespace-nowrap z-20 font-mono"; tooltip.textContent = ach.desc;
            div.appendChild(icon); div.appendChild(title); div.appendChild(tooltip); achList.appendChild(div);
        });

        const skillTree = document.getElementById('skill-tree-container'); skillTree.innerHTML = '';
        SKILLS_DEF.forEach(skill => {
            const isUnlocked = state.skills.includes(skill.id); const canAfford = state.player.skillPoints >= skill.cost; const prereqMet = skill.req.length === 0 || skill.req.every(r => state.skills.includes(r));
            const div = document.createElement('div'); div.className = `p-4 rounded-xl border flex gap-4 transition-all relative ${isUnlocked ? 'bg-sys-emerald/10 border-sys-emerald' : (prereqMet ? 'bg-sys-dark border-sys-border hover:border-sys-accent/50' : 'bg-sys-dark/50 border-sys-border skill-node-locked')}`;
            const leftCol = document.createElement('div'); leftCol.className = "flex flex-col items-center gap-2";
            const iconWrap = document.createElement('div'); iconWrap.className = `w-10 h-10 rounded-full flex items-center justify-center border ${isUnlocked ? 'bg-sys-emerald text-sys-dark border-sys-emerald' : 'bg-sys-dark text-sys-textMuted border-sys-textMuted'}`; iconWrap.innerHTML = `<i class="fa-solid fa-atom"></i>`;
            leftCol.appendChild(iconWrap); div.appendChild(leftCol);

            const rightCol = document.createElement('div'); rightCol.className = "flex-1 flex flex-col justify-between";
            const topRow = document.createElement('div');
            const catBadge = document.createElement('span'); catBadge.className = "text-[9px] bg-sys-border px-1.5 py-0.5 rounded font-mono text-sys-textMuted"; catBadge.textContent = skill.category;
            const title = document.createElement('h4'); title.className = `font-bold font-mono text-sm mt-1 ${isUnlocked ? 'text-sys-emerald' : 'text-white'}`; title.textContent = skill.name;
            const desc = document.createElement('p'); desc.className = "text-xs text-sys-textMuted mt-1"; desc.textContent = skill.desc;
            topRow.appendChild(catBadge); topRow.appendChild(title); topRow.appendChild(desc); rightCol.appendChild(topRow);

            if (!isUnlocked) {
                const btn = document.createElement('button'); btn.className = `mt-3 text-xs font-mono px-3 py-1.5 rounded self-start ${canAfford && prereqMet ? 'bg-sys-accent text-sys-dark hover:bg-white' : 'bg-sys-border/50 text-sys-textMuted cursor-not-allowed'}`; btn.textContent = `UNLOCK (${skill.cost} SP)`;
                if(canAfford && prereqMet) btn.onclick = () => unlockSkill(skill.id); rightCol.appendChild(btn);
            } else { const status = document.createElement('span'); status.className = "mt-3 text-xs font-mono text-sys-emerald"; status.innerHTML = `<i class="fa-solid fa-check"></i> ACTIVE`; rightCol.appendChild(status); }
            div.appendChild(rightCol); skillTree.appendChild(div);
        });
    }

    function renderBossQuests() {
        const list = document.getElementById('boss-quest-list'); list.innerHTML = '';
        if (state.bossQuests.length === 0) { list.innerHTML = `<div class="text-sys-textMuted font-mono text-sm text-center py-4 opacity-50">NO ACTIVE RAID SIGNALS.</div>`; return; }

        state.bossQuests.forEach(boss => {
            const wrapper = document.createElement('div'); wrapper.className = `p-5 rounded-lg border ${boss.claimed ? 'bg-sys-dark border-sys-purple/50 opacity-60' : 'bg-sys-danger/5 border-sys-danger/30 hover:border-sys-danger/60'} transition-all`;
            const headerDiv = document.createElement('div'); headerDiv.className = "flex justify-between items-start mb-4";
            const titleDiv = document.createElement('div');
            const badge = document.createElement('span'); badge.className = `text-[9px] bg-sys-dark border px-2 py-0.5 rounded font-mono mr-2 ${boss.claimed ? 'text-sys-purple border-sys-purple' : 'text-sys-danger border-sys-danger'}`; badge.textContent = boss.claimed ? "CLEARED" : "RAID ACTIVE";
            const title = document.createElement('h4'); title.className = `inline text-lg font-bold font-mono ${boss.claimed ? 'text-white' : 'text-sys-danger'}`; title.textContent = boss.title;
            const desc = document.createElement('p'); desc.className = "text-xs text-sys-textMuted mt-1"; desc.textContent = boss.desc;
            if(boss.deadline && !boss.claimed) { const dl = document.createElement('p'); dl.className="text-[10px] text-sys-warning mt-1 font-mono"; dl.innerHTML = `<i class="fa-regular fa-clock"></i> Deadline: ${boss.deadline}`; desc.appendChild(dl); }
            titleDiv.appendChild(badge); titleDiv.appendChild(title); titleDiv.appendChild(desc);

            const expDiv = document.createElement('div'); expDiv.className = `font-bold font-mono ${boss.claimed ? 'text-sys-textMuted' : 'text-sys-danger'}`; expDiv.textContent = `+${boss.exp} EXP`;
            headerDiv.appendChild(titleDiv); headerDiv.appendChild(expDiv); wrapper.appendChild(headerDiv);

            const totalTasks = boss.subtasks.length; const completedTasks = boss.subtasks.filter(t => t.completed).length; const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const progContainer = document.createElement('div'); progContainer.className = "w-full bg-sys-dark h-1.5 rounded mb-4 overflow-hidden";
            const progBar = document.createElement('div'); progBar.className = `h-full ${boss.claimed ? 'bg-sys-purple' : 'bg-sys-danger'} transition-all`; progBar.style.width = `${progressPct}%`;
            progContainer.appendChild(progBar); wrapper.appendChild(progContainer);

            const subTasksDiv = document.createElement('div'); subTasksDiv.className = "space-y-2 mb-4";
            let allDone = true;
            boss.subtasks.forEach((task) => {
                if (!task.completed) allDone = false;
                const taskRow = document.createElement('label'); taskRow.className = `flex items-center gap-3 p-2 rounded bg-sys-dark/50 border border-sys-border ${boss.claimed ? 'cursor-default' : 'cursor-pointer hover:bg-sys-border/30'}`;
                const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = "cyber-checkbox"; cb.checked = task.completed; cb.disabled = boss.claimed; cb.setAttribute('aria-label', `Tandai subtask ${task.text}`);
                if(!boss.claimed) { cb.onchange = (e) => { task.completed = e.target.checked; saveState(); renderBossQuests(); }; }
                const text = document.createElement('span'); text.className = `text-sm font-mono ${task.completed ? 'text-sys-emerald line-through opacity-70' : 'text-white'}`; text.textContent = task.text;
                taskRow.appendChild(cb); taskRow.appendChild(text); subTasksDiv.appendChild(taskRow);
            });
            wrapper.appendChild(subTasksDiv);

            if (!boss.claimed && allDone && totalTasks > 0) {
                const claimBtn = document.createElement('button'); claimBtn.className = "w-full py-3 bg-sys-danger text-white font-bold font-mono rounded hover:bg-white hover:text-sys-danger transition-colors animate-pulse"; claimBtn.innerHTML = "<i class='fa-solid fa-bolt'></i> CLAIM RAID REWARD";
                claimBtn.onclick = () => claimBossQuest(boss.id); wrapper.appendChild(claimBtn);
            }

            const delBtn = document.createElement('button'); delBtn.className = "mt-2 text-[10px] text-sys-textMuted hover:text-sys-danger font-mono uppercase underline"; 
            delBtn.textContent = boss.claimed ? "Hapus Catatan Raid" : "Abort Raid (Delete)";
            delBtn.setAttribute('aria-label', "Hapus Boss Quest");
            delBtn.onclick = () => deleteBossQuest(boss.id); wrapper.appendChild(delBtn);
            list.appendChild(wrapper);
        });
    }

    function renderQuests() {
        const list = document.getElementById('quest-list'); list.innerHTML = ''; 
        let filtered = state.quests; if (currentFilter !== 'all') filtered = state.quests.filter(q => q.type === currentFilter);
        if (filtered.length === 0) { list.innerHTML = `<div class="flex flex-col items-center justify-center py-12 text-sys-border font-mono text-sm"><i class="fa-solid fa-satellite-dish text-5xl mb-4 block opacity-30"></i>Tidak ada sinyal quest.</div>`; return; }

        filtered.sort((a, b) => {
            const aDone = isQuestCompletedNow(a); const bDone = isQuestCompletedNow(b);
            if (aDone !== bDone) return aDone ? 1 : -1;
            if (b.exp !== a.exp) return b.exp - a.exp; return b.createdAt - a.createdAt;
        });

        filtered.forEach(quest => {
            const isDone = isQuestCompletedNow(quest);
            const wrapper = document.createElement('div'); wrapper.className = `p-4 rounded-lg border ${isDone ? 'bg-sys-dark/50 border-sys-emerald/20 opacity-70' : 'bg-sys-panel border-sys-border hover:border-sys-accent/50'} transition-all group flex flex-col md:flex-row gap-4 justify-between relative overflow-hidden`;

            const leftDiv = document.createElement('div'); leftDiv.className = "flex items-start gap-4 flex-1";
            const btnToggle = document.createElement('button'); btnToggle.onclick = () => toggleQuest(quest.id); btnToggle.setAttribute('aria-label', `Toggle Quest ${quest.title}`);
            btnToggle.className = `mt-1 min-w-[28px] h-7 rounded border flex items-center justify-center transition-colors ${isDone ? 'bg-sys-emerald border-sys-emerald text-sys-dark' : 'border-sys-textMuted hover:border-sys-accent text-transparent'} shadow-sm`;
            btnToggle.innerHTML = '<i class="fa-solid fa-check text-sm" aria-hidden="true"></i>'; leftDiv.appendChild(btnToggle);

            const textDiv = document.createElement('div');
            const titleWrap = document.createElement('div'); titleWrap.className = "flex flex-wrap items-center gap-2 mb-1";
            const typeBadge = document.createElement('span'); typeBadge.className = "text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-sys-dark border border-sys-border text-sys-textMuted font-mono"; typeBadge.textContent = quest.type; titleWrap.appendChild(typeBadge);

            if (quest.metricId && quest.metricId !== 'none') {
                const metricBadge = document.createElement('span'); metricBadge.className = "text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-sys-accent/10 border border-sys-accent/30 text-sys-accent font-mono flex items-center gap-1";
                const icon = document.createElement('i'); icon.className = "fa-solid fa-link"; const mText = document.createTextNode(` ${METRICS_DEF[quest.metricId].name} (${quest.metricValue} ${METRICS_DEF[quest.metricId].unit})`);
                metricBadge.appendChild(icon); metricBadge.appendChild(mText); titleWrap.appendChild(metricBadge);
            }

            const titleSpan = document.createElement('h4'); titleSpan.className = `${isDone ? 'line-through text-sys-textMuted' : 'text-white'} font-mono text-base font-bold w-full mt-1`; titleSpan.textContent = quest.title; titleWrap.appendChild(titleSpan); textDiv.appendChild(titleWrap);
            if (quest.desc) { const descSpan = document.createElement('p'); descSpan.className = "text-xs text-sys-textMuted font-sans max-w-md line-clamp-2 leading-relaxed mt-1"; descSpan.textContent = quest.desc; textDiv.appendChild(descSpan); }
            leftDiv.appendChild(textDiv); wrapper.appendChild(leftDiv);

            const rightDiv = document.createElement('div'); rightDiv.className = "flex items-center gap-6 md:pl-4 md:border-l border-sys-border/50";
            const infoDiv = document.createElement('div'); infoDiv.className = "text-right whitespace-nowrap min-w-[80px]"; infoDiv.innerHTML = `<span class="text-xs text-sys-warning font-mono">+${quest.exp} EXP</span>`; rightDiv.appendChild(infoDiv);

            if (quest.type === 'daily' || quest.type === 'weekly') {
                const streakDiv = document.createElement('div'); streakDiv.className = "hidden sm:flex flex-col items-end gap-1";
                const onFire = quest.streak && quest.streak.current >= 3;
                const streakText = document.createElement('div'); streakText.className = `text-[10px] font-mono font-bold flex items-center gap-1 ${onFire ? 'text-sys-danger neon-text-danger' : 'text-sys-textMuted'}`; streakText.innerHTML = `<i class="fa-solid fa-fire"></i> ${quest.streak ? quest.streak.current : 0} STRK`;
                streakDiv.appendChild(streakText); rightDiv.appendChild(streakDiv);
            }

            const actionsDiv = document.createElement('div'); actionsDiv.className = "flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity";
            const btnEdit = document.createElement('button'); btnEdit.onclick = () => editQuest(quest.id); btnEdit.setAttribute('aria-label', `Edit Quest`); btnEdit.className = "w-8 h-8 rounded text-sys-textMuted hover:bg-sys-accent/20 hover:text-sys-accent transition-colors flex items-center justify-center"; btnEdit.innerHTML = '<i class="fa-solid fa-pen text-xs" aria-hidden="true"></i>';
            const btnDel = document.createElement('button'); btnDel.onclick = () => deleteQuest(quest.id); btnDel.setAttribute('aria-label', `Hapus Quest`); btnDel.className = "w-8 h-8 rounded text-sys-textMuted hover:bg-sys-danger/20 hover:text-sys-danger transition-colors flex items-center justify-center"; btnDel.innerHTML = '<i class="fa-solid fa-trash text-xs" aria-hidden="true"></i>';

            actionsDiv.appendChild(btnEdit); actionsDiv.appendChild(btnDel); rightDiv.appendChild(actionsDiv); wrapper.appendChild(rightDiv); list.appendChild(wrapper);
        });
    }

    // --- INTERACTION APIS ---
    function unlockSkill(id) {
        const skill = SKILLS_DEF.find(s => s.id === id); if (!skill || state.skills.includes(id)) return;
        const prereqMet = skill.req.length === 0 || skill.req.every(r => state.skills.includes(r));
        if (state.player.skillPoints >= skill.cost && prereqMet) { state.player.skillPoints -= skill.cost; state.skills.push(id); saveState(); updateUI(); showToast(`SKILL ACQUIRED: ${skill.name}`, 'success'); }
    }

    function addStat(statName) {
        if (!VALID_STATS.includes(statName)) return;
        if (state.player.statPoints > 0) { state.stats[statName]++; state.player.statPoints--; saveState(); updateUI(); }
    }

    function getPeriodString(quest) {
        if (quest.type === 'weekly') return DateUtils.getWeekStart();
        if (quest.type === 'one-time' || quest.type === 'milestone') return 'LIFETIME'; return DateUtils.getLocalDate();
    }

    function isQuestCompletedNow(quest) {
        if (quest.type === 'one-time' || quest.type === 'milestone') return quest.history && quest.history.includes('LIFETIME');
        return quest.history && quest.history.includes(getPeriodString(quest));
    }

    function toggleQuest(id) {
        const quest = state.quests.find(q => q.id === id); if (!quest) return;
        if (!quest.history) quest.history = []; if (!quest.streak) quest.streak = { current: 0, longest: 0 };
        const periodStr = getPeriodString(quest); const isCompleted = isQuestCompletedNow(quest);

        if (!isCompleted) {
            if (quest.type === 'daily' || quest.type === 'weekly') {
                const d = new Date();
                if(quest.type === 'daily') d.setDate(d.getDate() - 1);
                if(quest.type === 'weekly') d.setDate(d.getDate() - 7);
                
                const prevPeriod = (quest.type === 'daily') ? DateUtils.getLocalDate(d) : DateUtils.getWeekStart(d);
                if (quest.history.includes(prevPeriod)) quest.streak.current++; else quest.streak.current = 1;
                quest.streak.longest = Math.max(quest.streak.current, quest.streak.longest);
            }
            if (!quest.history.includes(periodStr)) quest.history.push(periodStr);
            if(processExpAndLog(quest, true, periodStr)) { showToast(`Quest Selesai! +${quest.exp} EXP.`, 'success'); }
            saveState(); updateUI();
        } else {
            if (periodStr !== 'LIFETIME' && quest.history[quest.history.length - 1] !== periodStr) { showToast("Akses ditolak: Data masa lalu terkunci.", "error"); return; }
            const result = processExpAndLog(quest, false, periodStr);
            if (result === 'BLOCKED_BY_STATS') { 
                showConfirmModal("ERROR: REVERSI DITOLAK", "Pembatalan quest ini akan mengurangi level. Anda sudah menghabiskan Stat Pts / Skill Pts untuk level tersebut.", () => {}); 
                return; 
            }
            if (periodStr === 'LIFETIME') { quest.history = quest.history.filter(h => h !== 'LIFETIME'); } else { quest.history.pop(); }
            if (quest.streak && quest.streak.current > 0) quest.streak.current--;
            showToast("Sinyal dibatalkan. EXP ditarik.", "warning"); saveState(); updateUI();
        }
    }

    function claimBossQuest(id) {
        const boss = state.bossQuests.find(b => b.id === id); if (!boss || boss.claimed) return;
        const allDone = boss.subtasks.every(t => t.completed);
        if (allDone) {
            boss.claimed = true;
            if(processExpAndLog(boss, true, 'LIFETIME', true)) { showToast(`RAID CLEARED: Klaim berhasil. (+${boss.exp} EXP)`, 'success'); }
            saveState(); updateUI();
        }
    }

    function deleteBossQuest(id) {
        showConfirmModal("HAPUS CATATAN RAID?", "Catatan Raid yang dihapus tidak bisa dikembalikan.", () => {
            state.bossQuests = state.bossQuests.filter(b => b.id !== id); saveState(); updateUI();
        });
    }

    function deleteQuest(id) {
        showConfirmModal("HAPUS PERMANEN?", "Menghapus Quest dari daftar. EXP yang pernah diraih tidak ditarik.", () => {
            state.quests = state.quests.filter(q => q.id !== id); showToast("Data dihapus.", "info"); saveState(); updateUI();
        });
    }

    // --- MAIN UI SYSTEM ---
    function updateUI() {
        const lvlData = calculateLevelInfo(state.player.totalExp); const rankData = calculateRank();
        document.getElementById('ui-level').textContent = lvlData.level; document.getElementById('ui-exp').textContent = lvlData.currentExp; document.getElementById('ui-max-exp').textContent = lvlData.maxExp; document.getElementById('ui-combat-power').textContent = getCombatPower(state.stats, lvlData.level).toLocaleString();
        document.getElementById('ui-hunter-rank-badge').innerHTML = `[RANK: <span class="${rankData.color} font-bold">${rankData.id}</span>]`; document.getElementById('ui-big-rank').textContent = rankData.id; document.getElementById('ui-big-rank').className = `text-6xl font-bold ${rankData.color} ${rankData.color.replace('text-', 'neon-text-')}`;
        const xpPercentage = Math.min((lvlData.currentExp / lvlData.maxExp) * 100, 100); document.getElementById('ui-xp-bar').style.width = `${xpPercentage}%`; document.getElementById('ui-level-message').textContent = `Membutuhkan ${lvlData.maxExp - lvlData.currentExp} EXP untuk Level Up.`;
        const statAlert = document.getElementById('ui-stat-point-alert'); const statBtns = document.querySelectorAll('.stat-btn');
        VALID_STATS.forEach(s => { document.getElementById(`ui-stat-${s}`).textContent = state.stats[s]; });
        if (state.player.statPoints > 0) { statAlert.classList.remove('hidden'); document.getElementById('ui-unallocated-pts').textContent = state.player.statPoints; statBtns.forEach(btn => { btn.classList.remove('opacity-50', 'cursor-not-allowed'); btn.disabled = false; }); } else { statAlert.classList.add('hidden'); statBtns.forEach(btn => { btn.classList.add('opacity-50', 'cursor-not-allowed'); btn.disabled = true; }); }
        document.getElementById('ui-skill-points').textContent = state.player.skillPoints;

        renderQuests(); renderBossQuests();
        if(document.getElementById('section-status').classList.contains('block')) updateChartRadar();
        if(document.getElementById('section-analytics').classList.contains('block')) updateAnalyticsCharts();
        if(document.getElementById('section-progression').classList.contains('block')) renderProgression();
    }

    function switchTab(tabId) {
        ['status', 'progression', 'quest', 'analytics', 'settings'].forEach(id => {
            document.getElementById(`section-${id}`).classList.add('hidden'); document.getElementById(`section-${id}`).classList.remove('block');
            document.getElementById(`nav-${id}`).classList.remove('nav-active', 'text-sys-purple');
        });
        document.getElementById(`section-${tabId}`).classList.remove('hidden'); document.getElementById(`section-${tabId}`).classList.add('block');
        document.getElementById(`nav-${tabId}`).classList.add('nav-active');
        if(tabId === 'progression') document.getElementById(`nav-${tabId}`).classList.add('text-sys-purple');

        const titles = { status: "Player Status", progression: "Awakening System", quest: "Quest Board", analytics: "Real-Life Analytics", settings: "System Center" };
        const subs = { status: "Sistem Atribut & Level RPG.", progression: "Peringkat Hunter, Achievements, & Pohon Skill.", quest: "Sistem Pelacakan Kebiasaan & Raid.", analytics: "Analisis Data Aksi Dunia Nyata.", settings: "Manajemen Integritas Data." };
        document.getElementById('page-title').textContent = titles[tabId]; document.getElementById('page-subtitle').innerHTML = `<i class="fa-solid fa-terminal text-xs mr-2" aria-hidden="true"></i>${subs[tabId]}`;
        updateUI();
    }

    function setFilter(f) {
        currentFilter = f; document.querySelectorAll('#filter-tabs button').forEach(btn => { if (btn.dataset.filter === f) btn.classList.add('tab-active'); else btn.classList.remove('tab-active'); }); renderQuests();
    }

    // --- MODALS FORMS ---
    const DOM = { qModal: document.getElementById('quest-modal'), qContent: document.getElementById('quest-modal-content'), form: document.getElementById('quest-form'), bModal: document.getElementById('boss-modal'), bContent: document.getElementById('boss-modal-content'), bForm: document.getElementById('boss-form'), tModal: document.getElementById('target-modal'), tContent: document.getElementById('target-modal-content'), tForm: document.getElementById('target-form')};
    
    function openQuestModal() { DOM.form.reset(); document.getElementById('q-id').value = ''; DOM.qModal.classList.remove('hidden'); DOM.qModal.classList.add('flex'); requestAnimationFrame(() => { DOM.qModal.classList.remove('opacity-0'); DOM.qContent.classList.remove('scale-95'); }); }
    function closeQuestModal() { DOM.qModal.classList.add('opacity-0'); DOM.qContent.classList.add('scale-95'); setTimeout(() => { DOM.qModal.classList.add('hidden'); DOM.qModal.classList.remove('flex'); }, 300); }
    function editQuest(id) {
        const quest = state.quests.find(q => q.id === id); if(!quest) return;
        document.getElementById('quest-modal-title').textContent = 'EDIT QUEST PROTOCOL';
        document.getElementById('q-id').value = quest.id; document.getElementById('q-title').value = quest.title; document.getElementById('q-desc').value = quest.desc || ''; document.getElementById('q-type').value = quest.type; document.getElementById('q-rank').value = quest.exp;
        if (quest.metricId) { document.getElementById('q-metric-id').value = quest.metricId; document.getElementById('q-metric-val').value = quest.metricValue || ''; document.getElementById('q-metric-unit').textContent = quest.metricId === 'none' ? 'Unit' : METRICS_DEF[quest.metricId].unit; }
        DOM.qModal.classList.remove('hidden'); DOM.qModal.classList.add('flex'); requestAnimationFrame(() => { DOM.qModal.classList.remove('opacity-0'); DOM.qContent.classList.remove('scale-95'); });
    }

    let bTaskCount = 0;
    function addBossSubtaskField() {
        bTaskCount++; const container = document.getElementById('boss-subtasks-container');
        const div = document.createElement('div'); div.className = "flex gap-2 items-center"; div.id = `btask-row-${bTaskCount}`;
        const input = document.createElement('input'); input.type = "text"; input.required = true; input.className = "flex-1 bg-sys-dark border border-sys-border rounded px-3 py-1.5 text-white focus:border-sys-danger focus:outline-none font-mono text-sm boss-subtask-input"; input.placeholder = `Subtask ${bTaskCount}`; input.setAttribute('aria-label', `Nama subtask ${bTaskCount}`);
        const btn = document.createElement('button'); btn.type = "button"; btn.className = "text-sys-danger hover:text-white px-2"; btn.innerHTML = "<i class='fa-solid fa-xmark' aria-hidden='true'></i>"; btn.setAttribute('aria-label', 'Hapus kolom subtask');
        btn.onclick = () => container.removeChild(div); div.appendChild(input); div.appendChild(btn); container.appendChild(div);
    }
    function openBossModal() { DOM.bForm.reset(); document.getElementById('boss-subtasks-container').innerHTML = ''; bTaskCount = 0; addBossSubtaskField(); addBossSubtaskField(); DOM.bModal.classList.remove('hidden'); DOM.bModal.classList.add('flex'); requestAnimationFrame(() => { DOM.bModal.classList.remove('opacity-0'); DOM.bContent.classList.remove('scale-95'); }); }
    function closeBossModal() { DOM.bModal.classList.add('opacity-0'); DOM.bContent.classList.add('scale-95'); setTimeout(() => { DOM.bModal.classList.add('hidden'); DOM.bModal.classList.remove('flex'); }, 300); }

    function openTargetModal() {
        const container = document.getElementById('target-inputs-container'); container.innerHTML = '';
        Object.keys(METRICS_DEF).forEach(k => {
            const div = document.createElement('div');
            const label = document.createElement('label'); label.className = "block text-sys-textMuted text-xs font-mono mb-1"; label.textContent = `Target Mingguan: ${METRICS_DEF[k].name}`;
            const inputWrap = document.createElement('div'); inputWrap.className = "flex";
            const input = document.createElement('input'); input.type = "number"; input.id = `target-${k}`; input.value = state.metrics[k].target || METRICS_DEF[k].defaultTarget; input.min = 1; input.required = true; input.className = "w-full bg-sys-dark border border-sys-border rounded-l px-3 py-2 text-white focus:border-sys-accent focus:outline-none font-mono text-sm";
            const unit = document.createElement('div'); unit.className = "bg-sys-border px-3 py-2 text-sys-textMuted font-mono text-xs rounded-r flex items-center"; unit.textContent = METRICS_DEF[k].unit;
            inputWrap.appendChild(input); inputWrap.appendChild(unit); div.appendChild(label); div.appendChild(inputWrap); container.appendChild(div);
        });
        DOM.tModal.classList.remove('hidden'); DOM.tModal.classList.add('flex'); requestAnimationFrame(() => { DOM.tModal.classList.remove('opacity-0'); DOM.tContent.classList.remove('scale-95'); });
    }
    function closeTargetModal() { DOM.tModal.classList.add('opacity-0'); DOM.tContent.classList.add('scale-95'); setTimeout(() => { DOM.tModal.classList.add('hidden'); DOM.tModal.classList.remove('flex'); }, 300); }

    document.getElementById('q-metric-id').addEventListener('change', (e) => { const val = e.target.value; document.getElementById('q-metric-unit').textContent = val === 'none' ? 'Unit' : METRICS_DEF[val].unit; });

    DOM.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = { id: document.getElementById('q-id').value, title: document.getElementById('q-title').value.trim(), desc: document.getElementById('q-desc').value.trim(), type: document.getElementById('q-type').value, exp: parseInt(document.getElementById('q-rank').value), metricId: document.getElementById('q-metric-id').value, metricValue: document.getElementById('q-metric-id').value !== 'none' ? parseInt(document.getElementById('q-metric-val').value || 1) : 0 };
        if (!data.title || isNaN(data.exp)) return;
        
        if (data.id) { 
            const q = state.quests.find(x => x.id === data.id); 
            if (q) {
                if (q.type !== data.type) { q.history = []; q.streak = { current:0, longest:0 }; } 
                Object.assign(q, {title: data.title, desc: data.desc, type: data.type, exp: data.exp, metricId: data.metricId, metricValue: data.metricValue}); 
            }
        } 
        else { state.quests.unshift({ id: Date.now().toString(), ...data, createdAt: Date.now(), history: [], streak: { current: 0, longest: 0 } }); }
        saveState(); updateUI(); closeQuestModal();
    });

    DOM.bForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('b-title').value.trim(); const desc = document.getElementById('b-desc').value.trim(); const exp = parseInt(document.getElementById('b-exp').value); const deadline = document.getElementById('b-deadline').value;
        const inputs = document.querySelectorAll('.boss-subtask-input'); const subtasks = Array.from(inputs).map((inp, idx) => ({ id: idx, text: inp.value.trim(), completed: false })).filter(t => t.text !== '');
        if(!title || isNaN(exp) || subtasks.length === 0) { showToast("Data Raid tidak lengkap.", "error"); return; }
        state.bossQuests.unshift({ id: Date.now().toString(), title, desc, exp, subtasks, claimed: false, deadline, createdAt: Date.now() });
        saveState(); updateUI(); closeBossModal(); showToast("RAID DIINISIASI.", "success");
    });

    DOM.tForm.addEventListener('submit', (e) => {
        e.preventDefault();
        Object.keys(METRICS_DEF).forEach(k => { const val = parseInt(document.getElementById(`target-${k}`).value); if(!isNaN(val)) state.metrics[k].target = val; });
        saveState(); updateUI(); closeTargetModal(); showToast("Target Metrik Diperbarui", "success");
    });

    // --- INIT EXPORT ---
    window.addEventListener('DOMContentLoaded', () => { loadState(); updateUI(); showToast(`Awakening System V7.1 Online.`, "success"); });

    return { 
        addStat, toggleQuest, deleteQuest, resetData: () => { showConfirmModal("FORMAT SYSTEM", "Yakin hapus semua profil, ledger, dan riwayat? Data tidak dapat dipulihkan.", () => { localStorage.removeItem(STORAGE_KEY); location.reload(); })}, 
        openQuestModal, closeQuestModal, openBossModal, closeBossModal, addBossSubtaskField, setFilter, switchTab, openTargetModal, closeTargetModal,
        exportData: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); a.download = `SYS_CORE_V7.1_${Date.now()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); },
        handleFileSelect: (e) => { const file = e.target.files[0]; if(!file) return; e.target.value = ''; const reader = new FileReader(); reader.onload = (ev) => { try { const parsed = JSON.parse(ev.target.result); const valid = executeMigration(parsed); showConfirmModal("IMPORT?", "Tindakan ini akan menimpa seluruh state data Anda saat ini.", () => { state = valid; saveState(); updateUI(); showToast("Impor Data Sukses.", "success"); }); } catch(err) { showToast(`Impor dibatalkan: ${err.message}`, "error"); } }; reader.readAsText(file); }, 
        updateAnalyticsUI: () => { updateAnalyticsCharts(); }
    };
})();
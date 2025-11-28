/**
 * MODULE: SAVINGS (Revisi #4 - Total Summary)
 * Menangani Tujuan Tabungan, Top Up, dan Penarikan
 */

// =======================================================
// 1. DATA SERVICE
// =======================================================
if (!window.SavingsService) {
    window.SavingsService = {
        async getAll() {
            return new Promise(resolve => setTimeout(() => resolve(db.savings || []), 300));
        },

        async create(name, target, icon) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    const newGoal = { id: Date.now(), name, target, current: 0, icon };
                    db.savings.push(newGoal);
                    saveDataToLocalStorage();
                    resolve(newGoal);
                }, 300);
            });
        },

        async topUp(goalId, sourceAccountId, amount) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const goal = db.savings.find(g => g.id === goalId);
                    const account = db.accounts.find(a => a.id === sourceAccountId);
                    if (!goal) return reject("Tujuan tidak ditemukan");
                    if (!account) return reject("Akun sumber tidak ditemukan");
                    if (account.balance < amount) return reject("Saldo akun tidak mencukupi");

                    goal.current += amount;
                    account.balance -= amount;
                    db.transactions.push({
                        id: Date.now(),
                        type: 'expense',
                        amount: amount,
                        category: 'Tabungan',
                        description: `Menabung ke: ${goal.name}`,
                        date: new Date().toISOString().split('T')[0],
                        sourceAccountId: sourceAccountId,
                        destinationAccountId: null
                    });
                    saveDataToLocalStorage();
                    resolve({ success: true });
                }, 400);
            });
        },

        async withdraw(goalId, destAccountId, amount) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const goal = db.savings.find(g => g.id === goalId);
                    const account = db.accounts.find(a => a.id === destAccountId);
                    if (!goal) return reject("Tujuan tidak ditemukan");
                    if (!account) return reject("Akun tujuan tidak ditemukan");
                    if (goal.current < amount) return reject("Saldo tabungan tidak mencukupi");

                    goal.current -= amount;
                    account.balance += amount;
                    db.transactions.push({
                        id: Date.now(),
                        type: 'income',
                        amount: amount,
                        category: 'Hasil Tabungan',
                        description: `Cairkan dari: ${goal.name}`,
                        date: new Date().toISOString().split('T')[0],
                        sourceAccountId: null,
                        destinationAccountId: destAccountId
                    });
                    saveDataToLocalStorage();
                    resolve({ success: true });
                }, 400);
            });
        },

        async delete(id) {
            return new Promise(resolve => {
                setTimeout(() => {
                    db.savings = db.savings.filter(g => g.id !== id);
                    saveDataToLocalStorage();
                    resolve({ success: true });
                }, 300);
            });
        }
    };
}

// =======================================================
// 2. VIEW CONTROLLER
// =======================================================
window.SavingsView = {
    modals: {},
    activeGoal: null,

    async init() {
        console.log("SavingsView initialized");
        const modalCreate = document.getElementById('modal-create-goal');
        const modalTopup = document.getElementById('modal-topup');
        const modalWithdraw = document.getElementById('modal-withdraw');

        if (modalCreate) this.modals.create = new bootstrap.Modal(modalCreate);
        if (modalTopup) this.modals.topup = new bootstrap.Modal(modalTopup);
        if (modalWithdraw) this.modals.withdraw = new bootstrap.Modal(modalWithdraw);

        await this.render();
    },

    async render() {
        const container = document.getElementById('savings-list');
        if (!container) return;

        try {
            const goals = await window.SavingsService.getAll();
            
            // --- RENDER SUMMARY (BARU) ---
            this.renderSummary(goals);

            if (goals.length === 0) {
                container.innerHTML = `
                    <div class="col-12 text-center py-5 text-muted opacity-50">
                        <i class="bi bi-piggy-bank display-4 d-block mb-3"></i>
                        <p>Belum ada target tabungan.</p>
                        <button class="btn btn-outline-primary btn-sm" onclick="window.SavingsView.openCreateModal()">Buat Sekarang</button>
                    </div>`;
                return;
            }

            // --- RENDER LIST ---
            container.innerHTML = goals.map(goal => {
                let percent = 0;
                let progressColor = 'bg-success';
                let progressHTML = '';
                
                if (goal.target > 0) {
                    percent = (goal.current / goal.target) * 100;
                    if (percent >= 100) progressColor = 'bg-primary';
                    progressHTML = `
                        <div class="d-flex justify-content-between small mb-1 mt-3">
                            <span class="text-muted">Target: ${formatCurrency(goal.target)}</span>
                            <span class="fw-bold ${percent >= 100 ? 'text-primary' : 'text-success'}">${Math.min(percent, 100).toFixed(0)}%</span>
                        </div>
                        <div class="progress" style="height: 8px;">
                            <div class="progress-bar ${progressColor}" role="progressbar" style="width: ${Math.min(percent, 100)}%"></div>
                        </div>`;
                } else {
                    progressHTML = `<div class="mt-3 text-muted small fst-italic">Tidak ada target nominal</div>`;
                }

                return `
                <div class="col-12 col-md-6 col-lg-4">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-body p-4">
                            <div class="d-flex justify-content-between align-items-start">
                                <div class="d-flex align-items-center">
                                    <div class="rounded-circle bg-light d-flex align-items-center justify-content-center me-3" style="width: 50px; height: 50px;">
                                        <i class="bi ${goal.icon} fs-4 text-primary"></i>
                                    </div>
                                    <div class="overflow-hidden">
                                        <h6 class="fw-bold mb-0 text-dark text-truncate">${goal.name}</h6>
                                        <small class="text-muted">Terkumpul</small>
                                    </div>
                                </div>
                                <div class="dropdown">
                                    <button class="btn btn-light btn-sm" data-bs-toggle="dropdown"><i class="bi bi-three-dots"></i></button>
                                    <ul class="dropdown-menu dropdown-menu-end border-0 shadow">
                                        <li><a class="dropdown-item text-danger" href="#" onclick="window.SavingsView.handleDelete(${goal.id})">Hapus Tujuan</a></li>
                                    </ul>
                                </div>
                            </div>
                            <h3 class="fw-bold mt-2 mb-0 text-dark">${formatCurrency(goal.current)}</h3>
                            ${progressHTML}
                            <div class="mt-4 d-flex gap-2">
                                <button class="btn btn-success flex-grow-1" onclick="window.SavingsView.openTopUpModal(${goal.id})"><i class="bi bi-plus-circle me-1"></i> Isi</button>
                                <button class="btn btn-outline-secondary flex-grow-1" onclick="window.SavingsView.openWithdrawModal(${goal.id})"><i class="bi bi-arrow-up-right me-1"></i> Pakai</button>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">Gagal memuat data.</div>`;
        }
    },

    // --- LOGIKA SUMMARY (BARU) ---
    renderSummary(goals) {
        // Hitung Total
        const totalSaved = goals.reduce((sum, g) => sum + g.current, 0);
        const totalTarget = goals.reduce((sum, g) => sum + g.target, 0);
        
        // Hitung Global Progress
        let globalPercent = 0;
        if (totalTarget > 0) {
            globalPercent = (totalSaved / totalTarget) * 100;
        } else if (totalSaved > 0 && totalTarget === 0) {
            // Kasus khusus: ada tabungan tapi tanpa target, anggap 100% atau N/A
            globalPercent = 100; 
        }

        const remaining = Math.max(0, totalTarget - totalSaved);

        // Update DOM
        const elTotal = document.getElementById('summary-total-saved');
        const elCount = document.getElementById('summary-goal-count');
        const elPercent = document.getElementById('summary-percentage');
        const elBar = document.getElementById('summary-progress-bar');
        const elTarget = document.getElementById('summary-total-target');
        const elRemaining = document.getElementById('summary-remaining');

        if(elTotal) elTotal.textContent = formatCurrency(totalSaved);
        if(elCount) elCount.textContent = goals.length;
        if(elPercent) elPercent.textContent = Math.min(globalPercent, 100).toFixed(0) + "%";
        if(elBar) elBar.style.width = Math.min(globalPercent, 100) + "%";
        if(elTarget) elTarget.textContent = formatCurrency(totalTarget);
        if(elRemaining) elRemaining.textContent = formatCurrency(remaining);
    },

    openCreateModal() {
        document.getElementById('form-create-goal').reset();
        this.modals.create.show();
    },

    async handleSaveGoal() {
        const name = document.getElementById('goal-name').value;
        const targetStr = document.getElementById('goal-target').value;
        const icon = document.getElementById('goal-icon').value;
        const target = parseFloat(unformatNumberInput(targetStr)) || 0;
        if (!name) return alert("Nama tujuan harus diisi");
        await window.SavingsService.create(name, target, icon);
        this.modals.create.hide();
        await this.render();
    },

    async openTopUpModal(id) {
        const goals = await window.SavingsService.getAll();
        this.activeGoal = goals.find(g => g.id === id);
        document.getElementById('topup-goal-name').textContent = this.activeGoal.name;
        document.getElementById('topup-goal-id').value = id;
        document.getElementById('topup-amount').value = '';
        
        const accounts = db.accounts || [];
        document.getElementById('topup-source-account').innerHTML = accounts.map(a => `<option value="${a.id}">${a.name} (${formatCurrency(a.balance)})</option>`).join('');
        this.modals.topup.show();
    },

    async handleTopUp() {
        const goalId = parseInt(document.getElementById('topup-goal-id').value);
        const sourceId = parseInt(document.getElementById('topup-source-account').value);
        const amount = parseFloat(unformatNumberInput(document.getElementById('topup-amount').value));
        if (!amount || amount <= 0) return alert("Jumlah tidak valid");
        try {
            await window.SavingsService.topUp(goalId, sourceId, amount);
            this.modals.topup.hide();
            await this.render();
        } catch(e) { alert(e); }
    },

    async openWithdrawModal(id) {
        const goals = await window.SavingsService.getAll();
        this.activeGoal = goals.find(g => g.id === id);
        document.getElementById('withdraw-goal-name').textContent = this.activeGoal.name;
        document.getElementById('withdraw-goal-id').value = id;
        document.getElementById('withdraw-amount').value = '';
        document.getElementById('withdraw-available-balance').textContent = formatCurrency(this.activeGoal.current);
        
        const accounts = db.accounts || [];
        document.getElementById('withdraw-dest-account').innerHTML = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
        this.modals.withdraw.show();
    },

    useMaxWithdraw() {
        if(this.activeGoal) {
            document.getElementById('withdraw-amount').value = formatNumberInput(this.activeGoal.current.toString());
        }
    },

    async handleWithdraw() {
        const goalId = parseInt(document.getElementById('withdraw-goal-id').value);
        const destId = parseInt(document.getElementById('withdraw-dest-account').value);
        const amount = parseFloat(unformatNumberInput(document.getElementById('withdraw-amount').value));
        if (!amount || amount <= 0) return alert("Jumlah tidak valid");
        try {
            await window.SavingsService.withdraw(goalId, destId, amount);
            this.modals.withdraw.hide();
            await this.render();
        } catch(e) { alert(e); }
    },

    async handleDelete(id) {
        if(!confirm("Hapus tujuan tabungan ini? Data saldo hilang.")) return;
        await window.SavingsService.delete(id);
        await this.render();
    }
};

window.SavingsView.init();
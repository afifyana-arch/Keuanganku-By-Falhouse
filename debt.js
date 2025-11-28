/**
 * MODULE: DEBT (Revisi #5 - Smart Sorting & Alerts)
 * Menangani Monitoring dan Pembayaran Hutang
 */

// =======================================================
// 1. DATA SERVICE
// =======================================================
if (!window.DebtService) {
    window.DebtService = {
        async getAll() {
            return new Promise(resolve => {
                setTimeout(() => {
                    const debts = db.debts || [];
                    resolve(debts);
                }, 300);
            });
        },

        async pay(debtId, sourceAccountId, amount) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const debt = db.debts.find(d => d.id === debtId);
                    const account = db.accounts.find(a => a.id === sourceAccountId);
                    if (!debt) return reject("Data hutang tidak ditemukan");
                    if (!account) return reject("Akun sumber tidak ditemukan");
                    if (account.balance < amount) return reject("Saldo akun tidak mencukupi");
                    if (amount > debt.remainingAmount) return reject("Jumlah bayar melebihi sisa hutang");

                    account.balance -= amount;
                    debt.remainingAmount -= amount;
                    
                    // Cek Lunas dengan toleransi kecil (floating point safety)
                    if (debt.remainingAmount <= 0) {
                        debt.remainingAmount = 0;
                        debt.isPaid = true;
                    }
                    
                    db.transactions.push({
                        id: Date.now(),
                        type: 'expense',
                        amount: amount,
                        category: 'Bayar Hutang',
                        description: `Bayar ke: ${debt.lender}`,
                        date: new Date().toISOString().split('T')[0],
                        sourceAccountId: sourceAccountId,
                        destinationAccountId: null,
                        linkedDebtId: debtId
                    });
                    saveDataToLocalStorage();
                    resolve({ success: true });
                }, 500);
            });
        },

        async delete(id) {
            return new Promise(resolve => {
                setTimeout(() => {
                    db.debts = db.debts.filter(d => d.id !== id);
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
window.DebtView = {
    payModal: null,
    activeDebt: null,
    currentFilter: 'active', // 'active' or 'paid'

    async init() {
        console.log("DebtView initialized");
        const modalEl = document.getElementById('modal-pay-debt');
        if (modalEl) {
            this.payModal = new bootstrap.Modal(modalEl);
        }
        await this.render();
    },

    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update UI Tab active state
        document.querySelectorAll('#debt-tabs .nav-link').forEach(el => el.classList.remove('active'));
        const activeText = filter === 'active' ? 'Tagihan Aktif' : 'Riwayat Lunas';
        const activeEl = Array.from(document.querySelectorAll('#debt-tabs .nav-link')).find(el => el.textContent === activeText);
        if(activeEl) activeEl.classList.add('active');

        this.render();
    },

    async render() {
        const container = document.getElementById('debt-list');
        if (!container) return;

        try {
            const allDebts = await window.DebtService.getAll();
            
            // --- UPDATE SUMMARY (Selalu hitung dari yang aktif) ---
            const activeDebts = allDebts.filter(d => !d.isPaid);
            this.renderSummary(activeDebts);

            // --- FILTER & SORT LIST ---
            let displayDebts = [];
            if (this.currentFilter === 'active') {
                // Tampilkan yang belum lunas, urutkan berdasarkan Jatuh Tempo Terdekat (Ascending)
                displayDebts = activeDebts.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
            } else {
                // Tampilkan yang lunas, urutkan ID (Terbaru dibuat)
                displayDebts = allDebts.filter(d => d.isPaid).sort((a, b) => b.id - a.id);
            }

            if (displayDebts.length === 0) {
                container.innerHTML = `
                    <div class="col-12 text-center py-5 text-muted opacity-50">
                        <i class="bi bi-file-earmark-check display-4 d-block mb-3"></i>
                        <p>${this.currentFilter === 'active' ? 'Hore! Tidak ada tagihan aktif.' : 'Belum ada riwayat pelunasan.'}</p>
                        ${this.currentFilter === 'active' ? '<button class="btn btn-outline-primary btn-sm" onclick="loadFragment(\'tracking\')">Catat Baru</button>' : ''}
                    </div>`;
                return;
            }

            container.innerHTML = displayDebts.map(debt => {
                const paidAmount = debt.totalAmount - debt.remainingAmount;
                const percent = (paidAmount / debt.totalAmount) * 100;
                
                // Logika Tanggal & Warna
                const today = new Date().toISOString().split('T')[0];
                const isOverdue = !debt.isPaid && debt.dueDate < today;
                const isNear = !debt.isPaid && !isOverdue && this.getDaysDiff(today, debt.dueDate) <= 3;
                
                let cardBorder = 'border-0';
                let dateBadge = '';
                
                if (debt.isPaid) {
                    dateBadge = `<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-check-circle me-1"></i>Lunas</span>`;
                } else if (isOverdue) {
                    cardBorder = 'border border-danger border-2'; // Border Merah Tebal
                    dateBadge = `<span class="badge bg-danger text-white blink-animation"><i class="bi bi-exclamation-triangle-fill me-1"></i>Telat: ${formatDate(debt.dueDate)}</span>`;
                } else if (isNear) {
                    cardBorder = 'border border-warning';
                    dateBadge = `<span class="badge bg-warning text-dark"><i class="bi bi-clock-history me-1"></i>Tempo: ${formatDate(debt.dueDate)}</span>`;
                } else {
                    dateBadge = `<span class="badge bg-light text-secondary border"><i class="bi bi-calendar-event me-1"></i>Tempo: ${formatDate(debt.dueDate)}</span>`;
                }

                return `
                <div class="col-12 col-md-6 col-lg-6">
                    <div class="card h-100 shadow-sm ${cardBorder}">
                        <div class="card-body p-4">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <div>
                                    <h5 class="fw-bold mb-1 text-dark">${debt.lender}</h5>
                                    <small class="text-muted d-block text-truncate" style="max-width: 200px;">${debt.description}</small>
                                </div>
                                <div class="dropdown">
                                    <button class="btn btn-light btn-sm p-1" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button>
                                    <ul class="dropdown-menu dropdown-menu-end border-0 shadow">
                                        <li><a class="dropdown-item text-danger" href="#" onclick="window.DebtView.handleDelete(${debt.id})">Hapus Data</a></li>
                                    </ul>
                                </div>
                            </div>

                            <div class="d-flex justify-content-between small mb-1">
                                <span class="text-muted">Dibayar: ${formatCurrency(paidAmount)}</span>
                                <span class="fw-bold">${Math.floor(percent)}%</span>
                            </div>
                            <div class="progress mb-3" style="height: 8px;">
                                <div class="progress-bar ${debt.isPaid ? 'bg-success' : (isOverdue ? 'bg-danger' : 'bg-warning')}" role="progressbar" style="width: ${percent}%"></div>
                            </div>

                            <div class="d-flex justify-content-between align-items-end mt-2">
                                <div>
                                    <div class="small text-muted mb-1">Sisa Tagihan</div>
                                    <div class="fw-bold fs-5 ${debt.isPaid ? 'text-success' : 'text-danger'}">${formatCurrency(debt.remainingAmount)}</div>
                                </div>
                                <div class="text-end">
                                    <div class="mb-2">${dateBadge}</div>
                                    ${!debt.isPaid ? `<button class="btn btn-success btn-sm px-3 shadow-sm" onclick="window.DebtView.openPayModal(${debt.id})">Bayar</button>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">Gagal memuat data: ${error}</div>`;
        }
    },

    renderSummary(activeDebts) {
        const total = activeDebts.reduce((sum, d) => sum + d.remainingAmount, 0);
        const count = activeDebts.length;
        
        const elTotal = document.getElementById('debt-summary-total');
        const elCount = document.getElementById('debt-summary-count');
        const elNearest = document.getElementById('debt-summary-nearest');

        if(elTotal) elTotal.textContent = formatCurrency(total);
        if(elCount) elCount.textContent = count;

        if (activeDebts.length > 0) {
            // Karena activeDebts belum disortir di parameter, kita sort dulu
            const sorted = [...activeDebts].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
            const nearest = sorted[0];
            const today = new Date().toISOString().split('T')[0];
            const diff = this.getDaysDiff(today, nearest.dueDate);
            
            let badgeColor = diff < 0 ? 'text-danger fw-bold' : (diff < 3 ? 'text-warning fw-bold' : 'text-dark');
            let diffText = diff < 0 ? `Telat ${Math.abs(diff)} hari` : (diff === 0 ? 'Hari ini!' : `${diff} hari lagi`);

            if(elNearest) elNearest.innerHTML = `
                <div class="me-3 text-center bg-white rounded p-1 shadow-sm border" style="min-width: 50px;">
                    <small class="d-block text-danger fw-bold" style="font-size: 0.6rem; line-height:1;">DEADLINE</small>
                    <span class="fw-bold fs-5 text-dark">${formatDate(nearest.dueDate).split(' ')[0]}</span>
                </div>
                <div>
                    <div class="fw-bold text-dark text-truncate" style="max-width: 140px;">${nearest.lender}</div>
                    <small class="${badgeColor}">${diffText}</small>
                </div>
            `;
        } else {
            if(elNearest) elNearest.innerHTML = `<span class="text-muted small fst-italic">Aman, tidak ada tagihan.</span>`;
        }
    },

    // Helper: Hitung selisih hari
    getDaysDiff(start, end) {
        const d1 = new Date(start);
        const d2 = new Date(end);
        const timeDiff = d2.getTime() - d1.getTime();
        return Math.ceil(timeDiff / (1000 * 3600 * 24)); 
    },

    async openPayModal(id) {
        const debts = await window.DebtService.getAll();
        this.activeDebt = debts.find(d => d.id === id);
        
        document.getElementById('pay-debt-name').textContent = this.activeDebt.lender;
        document.getElementById('pay-debt-remaining').textContent = formatCurrency(this.activeDebt.remainingAmount);
        document.getElementById('pay-debt-id').value = id;
        document.getElementById('pay-amount').value = '';
        
        const accounts = db.accounts || [];
        document.getElementById('pay-source-account').innerHTML = accounts.map(a => `<option value="${a.id}">${a.name} (${formatCurrency(a.balance)})</option>`).join('');
        this.payModal.show();
    },

    useFullAmount() {
        if(this.activeDebt) {
            document.getElementById('pay-amount').value = formatNumberInput(this.activeDebt.remainingAmount.toString());
        }
    },

    async handlePay() {
        const debtId = parseInt(document.getElementById('pay-debt-id').value);
        const sourceId = parseInt(document.getElementById('pay-source-account').value);
        const amount = parseFloat(unformatNumberInput(document.getElementById('pay-amount').value));
        
        const btn = document.getElementById('btn-confirm-pay');
        btn.disabled = true;
        
        try {
            if (!amount || amount <= 0) throw new Error("Jumlah bayar tidak valid");
            await window.DebtService.pay(debtId, sourceId, amount);
            this.payModal.hide();
            await this.render();
        } catch (error) {
            alert(error);
        } finally {
            btn.disabled = false;
        }
    },

    async handleDelete(id) {
        if(!confirm("Hapus data hutang ini?")) return;
        await window.DebtService.delete(id);
        await this.render();
    }
};

window.DebtView.init();
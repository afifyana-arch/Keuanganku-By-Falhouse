/**
 * MODULE: BUDGETING (Revisi #6 - Drill Down & Daily Advice)
 * Menangani Penetapan Anggaran, Monitoring, dan Analisis Detail
 */

// =======================================================
// 1. DATA SERVICE
// =======================================================
if (!window.BudgetService) {
    window.BudgetService = {
        async getAnalysis(monthStr) { 
            return new Promise(resolve => {
                setTimeout(() => {
                    const budgets = db.budgets[monthStr] || {};
                    const expenseMap = {};
                    
                    // Hitung Pengeluaran
                    (db.transactions || []).forEach(tx => {
                        if (tx.type === 'expense' || tx.type === 'debt_expense') {
                            const txMonth = tx.date.substring(0, 7);
                            if (txMonth === monthStr) {
                                const cat = tx.category || 'Lainnya';
                                if (!expenseMap[cat]) expenseMap[cat] = 0;
                                expenseMap[cat] += tx.amount;
                            }
                        }
                    });

                    const allCategories = new Set([...Object.keys(budgets), ...Object.keys(expenseMap)]);
                    const analysis = [];

                    allCategories.forEach(cat => {
                        const limit = budgets[cat] || 0;
                        const spent = expenseMap[cat] || 0;
                        analysis.push({
                            category: cat,
                            limit: limit,
                            spent: spent,
                            remaining: limit - spent,
                            percent: limit > 0 ? (spent / limit) * 100 : (spent > 0 ? 100 : 0),
                            hasBudget: limit > 0
                        });
                    });

                    analysis.sort((a, b) => b.percent - a.percent);
                    resolve(analysis);
                }, 300);
            });
        },

        // FITUR BARU: Ambil list transaksi spesifik untuk popup detail
        async getTransactionsByCategory(monthStr, category) {
            return new Promise(resolve => {
                const txs = (db.transactions || []).filter(tx => {
                    const isExpense = tx.type === 'expense' || tx.type === 'debt_expense';
                    const isMonth = tx.date.substring(0, 7) === monthStr;
                    const isCat = tx.category === category;
                    return isExpense && isMonth && isCat;
                });
                // Sort tanggal terbaru
                txs.sort((a, b) => new Date(b.date) - new Date(a.date));
                resolve(txs);
            });
        },

        async setBudget(monthStr, category, amount) {
            return new Promise(resolve => {
                setTimeout(() => {
                    if (!db.budgets[monthStr]) db.budgets[monthStr] = {};
                    if (amount > 0) db.budgets[monthStr][category] = amount;
                    else delete db.budgets[monthStr][category];
                    saveDataToLocalStorage();
                    resolve({ success: true });
                }, 200);
            });
        },

        async copyFromPrevious(currentMonthStr) {
            return new Promise((resolve, reject) => {
                const [year, month] = currentMonthStr.split('-').map(Number);
                const prevDate = new Date(year, month - 2, 1);
                const prevMonthStr = prevDate.toISOString().slice(0, 7);
                const prevBudget = db.budgets[prevMonthStr];
                
                if (!prevBudget || Object.keys(prevBudget).length === 0) {
                    return reject("Tidak ada data budget di bulan sebelumnya.");
                }
                db.budgets[currentMonthStr] = { ...prevBudget };
                saveDataToLocalStorage();
                resolve({ success: true });
            });
        }
    };
}

// =======================================================
// 2. VIEW CONTROLLER
// =======================================================
window.BudgetView = {
    currentMonth: '',
    detailModal: null,
    CATEGORIES: ["Makanan", "Transportasi", "Tagihan", "Hiburan", "Belanja", "Tabungan", "Bayar Hutang", "Lainnya"],

    async init() {
        console.log("BudgetView initialized");
        
        // Init Modal
        const modalEl = document.getElementById('modal-budget-detail');
        if (modalEl) this.detailModal = new bootstrap.Modal(modalEl);

        // Date Picker
        const dateInput = document.getElementById('budget-month');
        if (dateInput) {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            
            // Jika belum ada value, set ke bulan ini
            if(!this.currentMonth) this.currentMonth = `${yyyy}-${mm}`;
            dateInput.value = this.currentMonth;
            
            dateInput.addEventListener('change', (e) => {
                this.currentMonth = e.target.value;
                this.render();
            });
        }

        // Form Categories
        const catSelect = document.getElementById('budget-category');
        if (catSelect) catSelect.innerHTML = this.CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');

        const form = document.getElementById('budget-form');
        if (form) form.onsubmit = (e) => this.handleSave(e);

        await this.render();
    },

    toggleForm() {
        const collapse = document.getElementById('collapse-budget-form');
        if (collapse) {
            // Toggle manual class atau pakai Bootstrap Collapse API
            const bsCollapse = new bootstrap.Collapse(collapse, { toggle: true });
        }
    },

    async render() {
        const container = document.getElementById('budget-list');
        const btnCopy = document.getElementById('btn-copy-prev');
        if (!container) return;

        try {
            const data = await window.BudgetService.getAnalysis(this.currentMonth);
            
            // 1. Render Top Summary
            this.renderSummary(data);

            // 2. Handle Copy Button
            const currentIsEmpty = data.every(d => !d.hasBudget);
            if (btnCopy) currentIsEmpty ? btnCopy.classList.remove('d-none') : btnCopy.classList.add('d-none');

            // 3. Render List
            if (data.length === 0) {
                container.innerHTML = `
                    <div class="col-12 text-center py-5 text-muted opacity-50">
                        <i class="bi bi-wallet2 display-4 d-block mb-3"></i>
                        <p>Belum ada data di bulan ini.</p>
                    </div>`;
                return;
            }

            container.innerHTML = data.map(item => {
                // Tentukan Warna
                let progressColor = 'bg-success';
                let textColor = 'text-success';
                let statusText = 'Aman';
                let cardBorder = 'border-0';
                
                if (item.percent >= 100) {
                    progressColor = 'bg-danger';
                    textColor = 'text-danger';
                    statusText = 'Over!';
                    cardBorder = 'border border-danger border-2';
                } else if (item.percent >= 80) {
                    progressColor = 'bg-warning';
                    textColor = 'text-warning';
                    statusText = 'Hati-hati';
                } else if (!item.hasBudget) {
                    progressColor = 'bg-secondary';
                    textColor = 'text-secondary';
                    statusText = 'Unbudgeted';
                }

                // Daily Advice (Saran Harian)
                let adviceHTML = '';
                if (item.hasBudget && item.remaining > 0) {
                    const daysLeft = this.getDaysLeftInMonth();
                    const dailySafe = item.remaining / daysLeft;
                    adviceHTML = `<div class="mt-2 pt-2 border-top small text-muted fst-italic">
                        <i class="bi bi-info-circle me-1"></i>Sisa ${daysLeft} hari, aman belanja <b>${formatCurrency(dailySafe)}</b> /hari.
                    </div>`;
                } else if (item.remaining < 0) {
                    adviceHTML = `<div class="mt-2 pt-2 border-top small text-danger fw-bold">
                        <i class="bi bi-exclamation-circle me-1"></i>Stop belanja kategori ini!
                    </div>`;
                }

                return `
                <div class="col-12 col-md-6 col-xl-4">
                    <div class="card h-100 shadow-sm ${cardBorder} cursor-pointer hover-lift" onclick="window.BudgetView.openDetail('${item.category}')">
                        <div class="card-body p-4">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h6 class="fw-bold mb-0 text-dark">${item.category}</h6>
                                <span class="badge ${progressColor} bg-opacity-10 ${textColor} border border-${progressColor.replace('bg-','')}">
                                    ${statusText}
                                </span>
                            </div>

                            <div class="mb-2">
                                <div class="d-flex justify-content-between align-items-end mb-1">
                                    <span class="small text-muted">Terpakai</span>
                                    <span class="fw-bold fs-5 text-dark">${formatCurrency(item.spent)}</span>
                                </div>
                                <div class="progress" style="height: 8px; border-radius: 4px;">
                                    <div class="progress-bar ${progressColor}" role="progressbar" style="width: ${Math.min(item.percent, 100)}%"></div>
                                </div>
                                <div class="d-flex justify-content-between mt-1 small text-muted">
                                    <span>Limit: ${item.hasBudget ? formatCurrency(item.limit) : '∞'}</span>
                                    <span class="${item.remaining < 0 ? 'text-danger fw-bold' : ''}">Sisa: ${item.hasBudget ? formatCurrency(item.remaining) : '-'}</span>
                                </div>
                            </div>
                            
                            ${adviceHTML}

                            <div class="text-end mt-3 d-flex justify-content-end gap-3 position-relative z-2">
                                <button class="btn btn-sm btn-link text-decoration-none text-muted p-0" 
                                    onclick="event.stopPropagation(); window.BudgetView.fillForm('${item.category}', ${item.limit})">
                                    <i class="bi bi-pencil me-1"></i>Edit
                                </button>
                                <button class="btn btn-sm btn-link text-decoration-none text-primary p-0">
                                    <i class="bi bi-search me-1"></i>Detail
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');

        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">${error}</div>`;
        }
    },

    renderSummary(data) {
        let totalLimit = 0;
        let totalSpent = 0;
        data.forEach(d => {
            if (d.hasBudget) totalLimit += d.limit;
            totalSpent += d.spent;
        });

        const percent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
        const remaining = totalLimit - totalSpent;

        document.getElementById('summary-total-budget').textContent = formatCurrency(totalLimit);
        document.getElementById('summary-total-spent').textContent = formatCurrency(totalSpent);
        document.getElementById('summary-progress-bar').style.width = Math.min(percent, 100) + "%";
        
        const elStatus = document.getElementById('summary-text-status');
        if (remaining < 0) {
            elStatus.innerHTML = `<span class="text-danger fw-bold">Over Budget ${formatCurrency(Math.abs(remaining))}</span>`;
        } else {
            elStatus.innerHTML = `Sisa Global: <span class="fw-bold text-success">${formatCurrency(remaining)}</span>`;
        }
    },

    // FITUR BARU: Buka Modal Detail
    async openDetail(category) {
        document.getElementById('detail-category-title').textContent = category;
        document.getElementById('detail-month-subtitle').textContent = `Periode: ${this.currentMonth}`;
        const container = document.getElementById('detail-transaction-list');
        
        container.innerHTML = `<div class="text-center py-4"><div class="spinner-border spinner-border-sm"></div></div>`;
        this.detailModal.show();

        const txs = await window.BudgetService.getTransactionsByCategory(this.currentMonth, category);

        if (txs.length === 0) {
            container.innerHTML = `<div class="text-center py-4 text-muted small">Tidak ada transaksi.</div>`;
            return;
        }

        container.innerHTML = txs.map(tx => `
            <div class="list-group-item d-flex justify-content-between align-items-center px-3 py-3">
                <div class="overflow-hidden me-2">
                    <div class="fw-bold text-dark text-truncate">${tx.description || 'Tanpa keterangan'}</div>
                    <div class="small text-muted">${formatDate(tx.date)}</div>
                </div>
                <div class="fw-bold text-danger text-nowrap">
                    -${formatCurrency(tx.amount)}
                </div>
            </div>
        `).join('');
    },

    async handleSave(e) {
        e.preventDefault();
        const category = document.getElementById('budget-category').value;
        const amount = parseFloat(unformatNumberInput(document.getElementById('budget-amount').value)) || 0;
        
        // Button Loading State
        const btn = document.getElementById('btn-save-budget');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
        btn.disabled = true;

        await window.BudgetService.setBudget(this.currentMonth, category, amount);
        
        // Reset & Close
        document.getElementById('budget-amount').value = '';
        btn.innerHTML = originalText;
        btn.disabled = false;
        
        // Tutup form collapse jika di mobile
        const collapse = document.getElementById('collapse-budget-form');
        if(collapse.classList.contains('show')) {
            new bootstrap.Collapse(collapse).hide();
        }

        await this.render();
    },

    async handleCopy() {
        if(!confirm("Salin dari bulan lalu?")) return;
        try {
            await window.BudgetService.copyFromPrevious(this.currentMonth);
            await this.render();
        } catch (e) { alert(e); }
    },

    fillForm(category, limit) {
        document.getElementById('budget-category').value = category;
        document.getElementById('budget-amount').value = formatNumberInput(limit.toString());
        
        // Buka form
        const collapse = document.getElementById('collapse-budget-form');
        new bootstrap.Collapse(collapse).show();
        
        document.getElementById('budget-amount').focus();
    },

    getDaysLeftInMonth() {
        const now = new Date();
        const [y, m] = this.currentMonth.split('-').map(Number);
        
        // Jika melihat bulan lalu, days left = 0
        if (y < now.getFullYear() || (y === now.getFullYear() && m < (now.getMonth() + 1))) {
            return 0;
        }
        
        // Hitung hari tersisa di bulan ini
        const lastDayOfMonth = new Date(y, m, 0).getDate();
        const today = now.getDate();
        return Math.max(1, lastDayOfMonth - today);
    }
};

window.BudgetView.init();
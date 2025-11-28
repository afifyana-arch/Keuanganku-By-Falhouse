/**
 * MODULE: TRACKING (Revisi #13 - Classic Look + Smart Features)
 */

// =======================================================
// 1. DATA SERVICE
// =======================================================
if (!window.TransactionService) {
    window.TransactionService = {
        async save(transactionData, debtData = null) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    try {
                        if (debtData) db.debts.push(debtData);
                        db.transactions.push(transactionData);
                        this.updateLocalBalance(transactionData);
                        saveDataToLocalStorage(); 
                        resolve({ success: true, message: "Transaksi berhasil disimpan" });
                    } catch (error) {
                        reject({ success: false, message: error.message });
                    }
                }, 300); 
            });
        },

        async getAccounts() { return db.accounts || []; },

        async getRecent(limit = 6) {
            return new Promise(resolve => {
                const sorted = [...(db.transactions || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
                resolve(sorted.slice(0, limit));
            });
        },

        // Smart Budget Logic
        async getCategoryBudgetStatus(category, dateStr) {
            return new Promise(resolve => {
                const monthStr = dateStr.slice(0, 7);
                const budgets = db.budgets[monthStr] || {};
                const limit = budgets[category] || 0;

                if (limit === 0) return resolve(null);

                let spent = 0;
                (db.transactions || []).forEach(tx => {
                    if ((tx.type === 'expense' || tx.type === 'debt_expense') && 
                        tx.category === category && 
                        tx.date.startsWith(monthStr)) {
                        spent += tx.amount;
                    }
                });

                resolve({ limit, spent, remaining: limit - spent });
            });
        },

        updateLocalBalance(tx) {
            if (tx.type === 'income' && tx.destinationAccountId) {
                const acc = db.accounts.find(a => a.id === parseInt(tx.destinationAccountId));
                if (acc) acc.balance += tx.amount;
            } 
            else if ((tx.type === 'expense' || tx.type === 'debt_expense') && tx.sourceAccountId) {
                const acc = db.accounts.find(a => a.id === parseInt(tx.sourceAccountId));
                if (acc) acc.balance -= tx.amount;
            }
            else if (tx.type === 'transfer') {
                const src = db.accounts.find(a => a.id === parseInt(tx.sourceAccountId));
                const dst = db.accounts.find(a => a.id === parseInt(tx.destinationAccountId));
                if (src) src.balance -= tx.amount;
                if (dst) dst.balance += tx.amount;
            }
        }
    };
}

// =======================================================
// 2. VIEW CONTROLLER
// =======================================================
window.TrackingView = {
    type: 'expense',
    CATEGORIES: {
        expense: ["Makanan", "Transportasi", "Tagihan", "Hiburan", "Belanja", "Tabungan", "Bayar Hutang", "Lainnya"],
        income: ["Gaji", "Bonus", "Freelance", "Hadiah", "Hasil Tabungan", "Pinjaman", "Lainnya"]
    },

    async init() {
        console.log("TrackingView initialized (Rev #13)");

        const dateInput = document.getElementById('date');
        if (dateInput && !dateInput.value) {
            this.setQuickDate(0);
        }
        
        await this.populateAccountDropdowns();
        this.updateFormView('expense');
        this.setupEventListeners();
        this.renderMiniHistory();
    },

    setQuickDate(offsetDays) {
        const dateInput = document.getElementById('date');
        const d = new Date();
        d.setDate(d.getDate() + offsetDays); 
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dateInput.value = `${yyyy}-${mm}-${dd}`;
        this.checkBudget();
    },

    async populateAccountDropdowns() {
        const accounts = await window.TransactionService.getAccounts();
        const sourceSelect = document.getElementById('source-account');
        const destSelect = document.getElementById('destination-account');
        
        // Simpan data akun ke properti elemen agar bisa diakses saat onchange
        if(sourceSelect) sourceSelect.dataset.accounts = JSON.stringify(accounts);
        if(destSelect) destSelect.dataset.accounts = JSON.stringify(accounts);

        // Format Dropdown: Nama Akun (Saldo)
        const options = accounts.map(acc => 
            `<option value="${acc.id}" data-balance="${acc.balance}">${acc.name} (${formatCurrency(acc.balance)})</option>`
        ).join('');
        
        if (sourceSelect) sourceSelect.innerHTML = `<option value="" disabled selected>Pilih Akun...</option>` + options;
        if (destSelect) destSelect.innerHTML = `<option value="" disabled selected>Pilih Akun...</option>` + options;
    },

    // --- REVERT KE MINI HISTORY CARD ---
    async renderMiniHistory() {
        const container = document.getElementById('mini-history-list');
        if(!container) return;

        const recents = await window.TransactionService.getRecent(6);

        if (recents.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5 opacity-50">
                    <i class="bi bi-journal-x display-6"></i>
                    <p class="small mt-2">Belum ada data hari ini.</p>
                </div>`;
            return;
        }

        container.innerHTML = recents.map(tx => {
            const isIncome = tx.type === 'income';
            const isTransfer = tx.type === 'transfer';
            
            let color = isIncome ? 'text-success' : (isTransfer ? 'text-primary' : 'text-danger');
            let icon = isIncome ? 'bi-arrow-down-left' : (isTransfer ? 'bi-arrow-left-right' : 'bi-arrow-up-right');
            let bgIcon = isIncome ? 'bg-success-subtle' : (isTransfer ? 'bg-primary-subtle' : 'bg-danger-subtle');
            let sign = isIncome ? '+' : (isTransfer ? '' : '-');

            return `
            <div class="card border-0 shadow-sm mb-1">
                <div class="card-body p-3 d-flex align-items-center">
                    <div class="rounded-circle ${bgIcon} ${color} d-flex align-items-center justify-content-center me-3" style="width: 38px; height: 38px; flex-shrink: 0;">
                        <i class="bi ${icon}"></i>
                    </div>
                    <div class="flex-grow-1 overflow-hidden" style="line-height: 1.2;">
                        <div class="d-flex justify-content-between">
                            <span class="fw-bold text-dark small text-truncate">${tx.category}</span>
                            <span class="fw-bold ${color} small text-nowrap">${sign} ${formatCurrency(tx.amount)}</span>
                        </div>
                        <div class="d-flex justify-content-between mt-1">
                            <small class="text-muted text-truncate" style="font-size: 0.75rem;">${tx.description || '-'}</small>
                            <small class="text-secondary" style="font-size: 0.7rem;">${formatDate(tx.date).split(',')[0]}</small>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    async checkBudget() {
        const alertBox = document.getElementById('budget-status-alert');
        if (!alertBox) return;
        
        if (this.type !== 'expense') {
            alertBox.style.display = 'none';
            return;
        }

        const category = document.getElementById('category').value;
        const dateStr = document.getElementById('date').value;

        if (!category || !dateStr) return;

        const status = await window.TransactionService.getCategoryBudgetStatus(category, dateStr);

        if (!status) {
            alertBox.style.display = 'none';
        } else {
            alertBox.style.display = 'block';
            if (status.remaining < 0) {
                alertBox.className = 'alert alert-danger py-2 px-3 small mb-0 d-flex align-items-center';
                alertBox.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-2"></i> <div><strong>Over!</strong> Sisa budget: ${formatCurrency(status.remaining)}</div>`;
            } else if (status.remaining < (status.limit * 0.2)) {
                alertBox.className = 'alert alert-warning py-2 px-3 small mb-0 d-flex align-items-center';
                alertBox.innerHTML = `<i class="bi bi-exclamation-circle-fill me-2"></i> <div><strong>Tipis!</strong> Sisa budget: ${formatCurrency(status.remaining)}</div>`;
            } else {
                alertBox.className = 'alert alert-success py-2 px-3 small mb-0 d-flex align-items-center';
                alertBox.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i> <div>Aman. Sisa budget: ${formatCurrency(status.remaining)}</div>`;
            }
        }
    },

    // Helper untuk update tampilan saldo saat dropdown berubah
    updateBalanceDisplay(selectId, displayId) {
        const select = document.getElementById(selectId);
        const display = document.getElementById(displayId);
        if(!select || !display) return;
        
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption && selectedOption.dataset.balance) {
            display.textContent = `Saldo: ${formatCurrency(selectedOption.dataset.balance)}`;
        } else {
            display.textContent = '';
        }
    },

    updateFormView(type) {
        this.type = type;
        const txTypeInput = document.getElementById('tx-type');
        if(txTypeInput) txTypeInput.value = type;

        document.querySelectorAll('#tx-type-selector .nav-link').forEach(el => el.classList.remove('active', 'bg-white', 'shadow-sm'));
        const activeTab = document.getElementById(`tab-${type}`);
        if(activeTab) activeTab.classList.add('active', 'bg-white', 'shadow-sm');

        const fieldSource = document.getElementById('field-source');
        const fieldDest = document.getElementById('field-destination');
        const fieldCat = document.getElementById('field-category');
        const advancedOpts = document.getElementById('advanced-options');
        const catSelect = document.getElementById('category');
        const toggleDebt = document.getElementById('toggle-debt');
        const labelToggle = document.getElementById('label-toggle-debt');

        if(toggleDebt) toggleDebt.checked = false;
        document.getElementById('debt-details')?.classList.add('d-none');

        // Reset Visibilitas
        if (fieldSource) fieldSource.classList.remove('d-none');
        if (fieldDest) fieldDest.classList.add('d-none');
        if (fieldCat) fieldCat.classList.remove('d-none');

        if (type === 'expense') {
            if(labelToggle) labelToggle.textContent = "Gunakan PayLater / Hutang?";
            if(catSelect) {
                catSelect.innerHTML = this.CATEGORIES.expense.map(c => `<option value="${c}">${c}</option>`).join('');
                this.checkBudget();
            }
        } else if (type === 'income') {
            fieldSource.classList.add('d-none');
            fieldDest.classList.remove('d-none');
            if(labelToggle) labelToggle.textContent = "Ini adalah Uang Pinjaman?";
            if(catSelect) {
                catSelect.innerHTML = this.CATEGORIES.income.map(c => `<option value="${c}">${c}</option>`).join('');
                this.checkBudget(); 
            }
        } else if (type === 'transfer') {
            fieldDest.classList.remove('d-none');
            fieldCat.classList.add('d-none');
            this.checkBudget(); 
        }
    },

    setupEventListeners() {
        const typeSelector = document.getElementById('tx-type-selector');
        if (typeSelector) {
            typeSelector.querySelectorAll('.nav-link').forEach(link => {
                link.onclick = (e) => {
                    e.preventDefault();
                    this.updateFormView(e.target.dataset.type);
                };
            });
        }
        
        const toggleDebt = document.getElementById('toggle-debt');
        if (toggleDebt) {
            toggleDebt.onchange = (e) => {
                const isChecked = e.target.checked;
                const debtDetails = document.getElementById('debt-details');
                const sourceField = document.getElementById('field-source');
                isChecked ? debtDetails.classList.remove('d-none') : debtDetails.classList.add('d-none');
                if (this.type === 'expense') isChecked ? sourceField.classList.add('d-none') : sourceField.classList.remove('d-none');
            };
        }

        // Listener Saldo & Budget
        const srcSelect = document.getElementById('source-account');
        const dstSelect = document.getElementById('destination-account');
        if(srcSelect) srcSelect.addEventListener('change', () => this.updateBalanceDisplay('source-account', 'source-balance-display'));
        if(dstSelect) dstSelect.addEventListener('change', () => this.updateBalanceDisplay('destination-account', 'dest-balance-display'));

        const catSelect = document.getElementById('category');
        const dateInput = document.getElementById('date');
        if (catSelect) catSelect.addEventListener('change', () => this.checkBudget());
        if (dateInput) dateInput.addEventListener('change', () => this.checkBudget());

        const form = document.getElementById('transaction-form');
        if (form) form.onsubmit = (e) => this.handleFormSubmit(e);
    },

    async handleFormSubmit(e) {
        e.preventDefault();
        const btnSave = document.getElementById('btn-save');
        const originalBtnText = btnSave.innerHTML;
        btnSave.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Menyimpan...`;
        btnSave.disabled = true;

        try {
            const amountInput = document.getElementById('amount');
            const amount = parseFloat(unformatNumberInput(amountInput.value));
            const date = document.getElementById('date').value;
            const desc = document.getElementById('description').value;
            const isDebt = document.getElementById('toggle-debt') ? document.getElementById('toggle-debt').checked : false;

            if (!amount || amount <= 0) throw new Error("Jumlah harus lebih besar dari 0");

            let transaction = {
                id: Date.now(),
                type: this.type,
                amount: amount,
                date: date,
                description: desc,
                sourceAccountId: null,
                destinationAccountId: null,
                linkedDebtId: null
            };

            let debtData = null;

            if (this.type === 'expense') {
                transaction.category = document.getElementById('category').value;
                if (isDebt) { 
                    const lender = document.getElementById('debt-lender').value || "PayLater";
                    debtData = this.createDebtObject(lender, amount, date, true);
                    transaction.sourceAccountId = null;
                    transaction.description += ` (via ${lender})`;
                    transaction.linkedDebtId = debtData.id;
                } else {
                    transaction.sourceAccountId = document.getElementById('source-account').value;
                    if (!transaction.sourceAccountId) throw new Error("Pilih akun sumber");
                }
            } else if (this.type === 'income') {
                transaction.destinationAccountId = document.getElementById('destination-account').value;
                if (!transaction.destinationAccountId) throw new Error("Pilih akun tujuan");
                if (isDebt) { 
                    transaction.category = "Pinjaman";
                    const lender = document.getElementById('debt-lender').value || "Pemberi Pinjaman";
                    debtData = this.createDebtObject(lender, amount, date, true);
                    transaction.description += ` (Pinjaman dari ${lender})`;
                    transaction.linkedDebtId = debtData.id;
                } else { 
                    transaction.category = document.getElementById('category').value;
                }
            } else if (this.type === 'transfer') {
                transaction.category = "Transfer";
                transaction.sourceAccountId = document.getElementById('source-account').value;
                transaction.destinationAccountId = document.getElementById('destination-account').value;
                if (!transaction.sourceAccountId || !transaction.destinationAccountId) throw new Error("Pilih akun sumber dan tujuan");
                if (transaction.sourceAccountId === transaction.destinationAccountId) throw new Error("Akun sumber dan tujuan tidak boleh sama");
            }

            await window.TransactionService.save(transaction, debtData);
            
            await this.renderMiniHistory();
            this.checkBudget(); 
            // Update Balance Display jika akun berubah saldo
            if(srcSelect && this.type !== 'income') this.updateBalanceDisplay('source-account', 'source-balance-display');
            if(dstSelect && this.type !== 'expense') this.updateBalanceDisplay('destination-account', 'dest-balance-display');

            const isAddAnother = document.getElementById('check-add-another').checked;
            
            if (isAddAnother) {
                amountInput.value = '';
                document.getElementById('description').value = '';
                amountInput.focus();
                
                btnSave.classList.remove('btn-brand-primary');
                btnSave.classList.add('btn-success');
                btnSave.innerHTML = `<i class="bi bi-check-lg"></i> Tersimpan!`;
                setTimeout(() => {
                    btnSave.classList.remove('btn-success');
                    btnSave.classList.add('btn-brand-primary');
                    btnSave.innerHTML = originalBtnText;
                    btnSave.disabled = false;
                }, 1500);
            } else {
                alert("Transaksi berhasil disimpan!");
                loadFragment('dashboard');
            }

        } catch (error) {
            alert("Gagal menyimpan: " + error.message);
            btnSave.innerHTML = originalBtnText;
            btnSave.disabled = false;
        }
    },

    createDebtObject(lender, amount, date, isPayable) {
        return {
            id: Date.now() + 1,
            lender: lender,
            totalAmount: amount,
            remainingAmount: amount,
            dueDate: document.getElementById('debt-due-date').value || date,
            tenor: parseInt(document.getElementById('debt-tenor').value) || 1,
            description: isPayable ? `Hutang ke ${lender}` : `Piutang dari ${lender}`,
            isPaid: false
        };
    }
};

window.TrackingView.init();
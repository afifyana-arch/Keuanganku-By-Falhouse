/**
 * MODULE: TRACKING (Revisi #10 - Final CSS Injection Fix)
 * Perbaikan:
 * 1. Menyuntikkan <style> khusus ke head untuk memaksa konsistensi.
 * 2. Class '.tracking-box-fix' diterapkan ke Akun & Kategori.
 * 3. Reset margin label agar sejajar vertikal.
 */

// =======================================================
// 1. DATA SERVICE (Tidak Berubah)
// =======================================================
if (!window.TransactionService) {
    window.TransactionService = {
        async save(transactionData, debtDataList = null) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    try {
                        db.transactions.push(transactionData);
                        this.updateLocalBalance(transactionData);

                        if (debtDataList) {
                            const debts = Array.isArray(debtDataList) ? debtDataList : [debtDataList];
                            debts.forEach(d => db.debts.push(d));
                        }

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
        console.log("TrackingView initialized (Rev #10 - CSS Inject)");

        // 1. INJECT CSS KHUSUS (Agresif Fix)
        this.injectCustomStyles();

        // 2. FIX NOMINAL FONT
        const inputAmount = document.getElementById('amount');
        if (inputAmount) {
            inputAmount.classList.remove('fs-3');
            inputAmount.classList.add('fs-6', 'fw-bold'); 
            const addon = inputAmount.previousElementSibling;
            if (addon && addon.classList.contains('input-group-text')) {
                addon.classList.remove('fw-bold');
                addon.style.fontSize = '0.9rem';
                addon.style.color = '#adb5bd';
            }
        }

        // 3. TERAPKAN CLASS FIX KE KATEGORI
        const catSelect = document.getElementById('category');
        if (catSelect) {
            catSelect.classList.add('tracking-box-fix');
            // Reset style inline jika ada sisa revisi sebelumnya
            catSelect.style.height = ''; 
            catSelect.style.padding = '';
        }

        const dateInput = document.getElementById('date');
        if (dateInput && !dateInput.value) {
            this.setQuickDate(0);
        }
        
        await this.populateAccountDropdowns();
        this.updateFormView('expense');
        this.setupEventListeners();
        this.renderMiniHistory();
    },

    // --- FUNGSI BARU: INJECT STYLE ---
    injectCustomStyles() {
        if (document.getElementById('tracking-fix-style')) return;

        const style = document.createElement('style');
        style.id = 'tracking-fix-style';
        style.innerHTML = `
            /* Class Penyeragam */
            .tracking-box-fix {
                height: 50px !important;
                min-height: 50px !important;
                max-height: 50px !important;
                padding: 0 16px !important;
                border-radius: 10px !important;
                border: 1px solid #dee2e6 !important;
                background-color: #fff !important;
                font-size: 1rem !important;
                width: 100% !important;
                box-sizing: border-box !important;
                display: flex !important;
                align-items: center !important;
                box-shadow: none !important;
            }
            
            /* Khusus Select asli (Kategori) perlu penyesuaian sedikit agar teks vertikal pas */
            select.tracking-box-fix {
                /* Select native tidak support display:flex untuk contentnya di beberapa browser */
                display: block !important; 
                padding-top: 12px !important; /* Fallback vertical center */
                padding-bottom: 12px !important;
                line-height: 1.5 !important;
            }

            /* Tombol Custom Dropdown */
            div.tracking-box-fix {
                justify-content: space-between !important;
                cursor: pointer !important;
            }
        `;
        document.head.appendChild(style);
    },

    showNotification(message, type = 'success') {
        const oldToast = document.getElementById('custom-toast');
        if (oldToast) oldToast.remove();

        const toast = document.createElement('div');
        toast.id = 'custom-toast';
        const icon = type === 'success' ? '<i class="bi bi-check-circle-fill me-2"></i>' : '<i class="bi bi-exclamation-triangle-fill me-2"></i>';
        const bgColor = type === 'success' ? '#2ecc71' : '#e74c3c';

        toast.className = 'shadow-sm d-flex align-items-center px-4 py-3 rounded-pill text-white';
        toast.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            z-index: 9999; background-color: ${bgColor}; font-size: 0.9rem; font-weight: 500;
            opacity: 0; transition: opacity 0.3s ease, top 0.3s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        toast.innerHTML = `${icon} ${message}`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.top = '30px'; });
        setTimeout(() => { toast.style.opacity = '0'; toast.style.top = '20px'; setTimeout(() => toast.remove(), 300); }, 3000);
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
        
        if(sourceSelect) sourceSelect.dataset.accounts = JSON.stringify(accounts);
        
        const optionsHTML = accounts.map(acc => `<option value="${acc.id}">${acc.name}</option>`).join('');
        
        if (sourceSelect) sourceSelect.innerHTML = `<option value="" disabled selected>Pilih Akun...</option>` + optionsHTML;
        if (destSelect) destSelect.innerHTML = `<option value="" disabled selected>Pilih Akun...</option>` + optionsHTML;

        this.renderCustomDropdown('source-account', accounts, 'Pilih Akun Sumber...');
        this.renderCustomDropdown('destination-account', accounts, 'Pilih Akun Tujuan...');
    },

    renderCustomDropdown(selectId, accounts, placeholder) {
        const originalSelect = document.getElementById(selectId);
        if (!originalSelect) return;

        originalSelect.style.display = 'none';

        let wrapper = document.getElementById(`wrapper-${selectId}`);
        if (wrapper) wrapper.remove(); 

        wrapper = document.createElement('div');
        wrapper.id = `wrapper-${selectId}`;
        wrapper.className = 'dropdown w-100';

        // 3. TOMBOL TRIGGER (Gunakan class inject .tracking-box-fix)
        const btnToggle = document.createElement('div'); 
        btnToggle.className = 'tracking-box-fix'; // CLASS BARU
        btnToggle.setAttribute('data-bs-toggle', 'dropdown');
        
        btnToggle.innerHTML = `<span class="text-muted">${placeholder}</span> <i class="bi bi-chevron-down small"></i>`;

        const menu = document.createElement('ul');
        menu.className = 'dropdown-menu w-100 shadow border-0 mt-1';
        menu.style.borderRadius = '12px';
        menu.style.maxHeight = '300px';
        menu.style.overflowY = 'auto';

        accounts.forEach(acc => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.className = 'dropdown-item py-2 px-3';
            a.style.cursor = 'pointer';

            const balanceColor = acc.balance > 0 ? 'text-success' : 'text-danger';
            
            a.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="me-3">
                        <i class="bi ${acc.icon || 'bi-wallet2'} fs-5 text-secondary opacity-50"></i>
                    </div>
                    <div>
                        <div class="text-dark fw-medium" style="font-size: 0.9rem;">${acc.name}</div>
                        <div class="small ${balanceColor}" style="font-size: 0.75rem;">Saldo: ${formatCurrency(acc.balance)}</div>
                    </div>
                </div>
            `;

            a.onclick = () => {
                originalSelect.value = acc.id.toString(); 
                
                btnToggle.innerHTML = `
                    <div class="d-flex align-items-center">
                        <i class="bi ${acc.icon || 'bi-wallet2'} me-2 text-secondary small"></i>
                        <span class="text-dark fw-medium" style="font-size: 0.9rem;">${acc.name}</span>
                    </div>
                    <i class="bi bi-chevron-down small text-muted"></i>
                `;
                // Simulasi Focus Border
                btnToggle.style.borderColor = '#86b7fe'; 
                btnToggle.style.boxShadow = '0 0 0 0.25rem rgba(13, 110, 253, 0.25)';
                setTimeout(() => { 
                    btnToggle.style.borderColor = '#dee2e6'; 
                    btnToggle.style.boxShadow = 'none'; 
                }, 200);

                originalSelect.dispatchEvent(new Event('change'));
            };

            li.appendChild(a);
            menu.appendChild(li);
        });

        wrapper.appendChild(btnToggle);
        wrapper.appendChild(menu);
        originalSelect.parentNode.insertBefore(wrapper, originalSelect.nextSibling);
    },

    async renderMiniHistory() {
        const container = document.getElementById('mini-history-list');
        if(!container) return;

        const recents = await window.TransactionService.getRecent(6);

        if (recents.length === 0) {
            container.innerHTML = `<div class="text-center text-muted py-5 opacity-50"><p class="small mt-2">Belum ada data hari ini.</p></div>`;
            return;
        }

        container.innerHTML = recents.map(tx => {
            const isIncome = tx.type === 'income';
            const isTransfer = tx.type === 'transfer';
            let color = isIncome ? 'text-success' : (isTransfer ? 'text-primary' : 'text-danger');
            let icon = isIncome ? 'bi-arrow-down-left' : (isTransfer ? 'bi-arrow-left-right' : 'bi-arrow-up-right');
            let bgIcon = isIncome ? 'bg-success-subtle' : (isTransfer ? 'bg-primary-subtle' : 'bg-danger-subtle');
            let sign = isIncome ? '+' : (isTransfer ? '' : '-');
            
            const dateObj = new Date(tx.date);
            const prettyDate = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

            return `
            <div class="card border-0 shadow-sm mb-2" style="border-radius: 12px;">
                <div class="card-body p-3 d-flex align-items-center">
                    <div class="rounded-circle ${bgIcon} ${color} d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px; flex-shrink: 0;">
                        <i class="bi ${icon}"></i>
                    </div>
                    <div class="flex-grow-1 overflow-hidden" style="line-height: 1.3;">
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="fw-bold text-dark text-truncate" style="font-size: 0.9rem;">${tx.category}</span>
                            <span class="fw-bold ${color} text-nowrap" style="font-size: 0.9rem;">${sign} ${formatCurrency(tx.amount)}</span>
                        </div>
                        <div class="d-flex justify-content-between mt-1">
                            <small class="text-muted text-truncate me-2" style="font-size: 0.75rem;">${tx.description || '-'}</small>
                            <small class="text-secondary fw-medium" style="font-size: 0.7rem; background: #f8f9fa; padding: 2px 6px; border-radius: 4px;">${prettyDate}</small>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    async checkBudget() {
        const alertBox = document.getElementById('budget-status-alert');
        if (!alertBox || this.type !== 'expense') {
            if(alertBox) alertBox.style.display = 'none';
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
                alertBox.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-2"></i> <div><strong>Over!</strong> Sisa: ${formatCurrency(status.remaining)}</div>`;
            } else if (status.remaining < (status.limit * 0.2)) {
                alertBox.className = 'alert alert-warning py-2 px-3 small mb-0 d-flex align-items-center';
                alertBox.innerHTML = `<i class="bi bi-exclamation-circle-fill me-2"></i> <div><strong>Tipis!</strong> Sisa: ${formatCurrency(status.remaining)}</div>`;
            } else {
                alertBox.className = 'alert alert-success py-2 px-3 small mb-0 d-flex align-items-center';
                alertBox.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i> <div>Aman. Sisa: ${formatCurrency(status.remaining)}</div>`;
            }
        }
    },

    updateFormView(type) {
        this.type = type;
        document.getElementById('tx-type').value = type;
        document.querySelectorAll('#tx-type-selector .nav-link').forEach(el => el.classList.remove('active', 'bg-white', 'shadow-sm'));
        document.getElementById(`tab-${type}`).classList.add('active', 'bg-white', 'shadow-sm');

        const fieldSource = document.getElementById('field-source');
        const fieldDest = document.getElementById('field-destination');
        const fieldCat = document.getElementById('field-category');
        const catSelect = document.getElementById('category');
        const toggleDebt = document.getElementById('toggle-debt');
        const labelToggle = document.getElementById('label-toggle-debt');

        if(toggleDebt) toggleDebt.checked = false;
        document.getElementById('debt-details')?.classList.add('d-none');

        fieldSource.classList.remove('d-none');
        fieldDest.classList.add('d-none');
        fieldCat.classList.remove('d-none');

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

            let debtDataList = null;

            if (this.type === 'expense') {
                transaction.category = document.getElementById('category').value;
                if (isDebt) { 
                    const lender = document.getElementById('debt-lender').value || "PayLater";
                    const tenor = parseInt(document.getElementById('debt-tenor').value) || 1;
                    const firstDueDate = document.getElementById('debt-due-date').value || date;

                    debtDataList = this.calculateInstallments(lender, amount, firstDueDate, tenor, desc, true);
                    transaction.sourceAccountId = null;
                    transaction.description += ` (via ${lender} - ${tenor}x Cicilan)`;
                    transaction.linkedDebtId = debtDataList[0].id; 
                } else {
                    transaction.sourceAccountId = document.getElementById('source-account').value;
                    if (!transaction.sourceAccountId) throw new Error("Pilih akun sumber");
                    
                    const accounts = JSON.parse(document.getElementById('source-account').dataset.accounts || "[]");
                    const selectedAcc = accounts.find(a => a.id == transaction.sourceAccountId);
                    
                    if (selectedAcc) {
                        const available = selectedAcc.balance - (selectedAcc.reserved || 0); 
                        if (amount > available) {
                            throw new Error(`Saldo tidak cukup! Sisa: ${formatCurrency(available)}`);
                        }
                    }
                }
            } else if (this.type === 'income') {
                transaction.destinationAccountId = document.getElementById('destination-account').value;
                if (!transaction.destinationAccountId) throw new Error("Pilih akun tujuan");
                if (isDebt) { 
                    transaction.category = "Pinjaman";
                    const lender = document.getElementById('debt-lender').value || "Pemberi Pinjaman";
                    debtDataList = [this.createSingleDebt(lender, amount, date, true)]; 
                    transaction.description += ` (Pinjaman dari ${lender})`;
                    transaction.linkedDebtId = debtDataList[0].id;
                } else { 
                    transaction.category = document.getElementById('category').value;
                }
            } else if (this.type === 'transfer') {
                transaction.category = "Transfer";
                transaction.sourceAccountId = document.getElementById('source-account').value;
                transaction.destinationAccountId = document.getElementById('destination-account').value;
                if (!transaction.sourceAccountId || !transaction.destinationAccountId) throw new Error("Pilih akun sumber dan tujuan");
                if (transaction.sourceAccountId === transaction.destinationAccountId) throw new Error("Akun sumber dan tujuan tidak boleh sama");

                const accounts = JSON.parse(document.getElementById('source-account').dataset.accounts || "[]");
                const selectedAcc = accounts.find(a => a.id == transaction.sourceAccountId);
                if (selectedAcc) {
                    const available = selectedAcc.balance - (selectedAcc.reserved || 0);
                    if (amount > available) {
                        throw new Error(`Saldo transfer tidak cukup! Sisa: ${formatCurrency(available)}`);
                    }
                }
            }

            await window.TransactionService.save(transaction, debtDataList);
            
            await this.populateAccountDropdowns(); 
            
            await this.renderMiniHistory();
            this.checkBudget(); 

            const isAddAnother = document.getElementById('check-add-another').checked;
            
            if (isAddAnother) {
                amountInput.value = '';
                document.getElementById('description').value = '';
                amountInput.focus();
                this.showNotification("Transaksi berhasil disimpan!", "success");
            } else {
                this.showNotification("Tersimpan! Mengalihkan...", "success");
                setTimeout(() => loadFragment('dashboard'), 1000);
            }

        } catch (error) {
            this.showNotification(error.message, "error");
        } finally {
            btnSave.innerHTML = originalBtnText;
            btnSave.disabled = false;
        }
    },

    calculateInstallments(lender, totalAmount, firstDueDate, tenor, originalDesc, isPayable) {
        const debts = [];
        const baseAmount = Math.floor(totalAmount / tenor);
        const remainder = totalAmount - (baseAmount * tenor);
        let currentDate = new Date(firstDueDate);

        for (let i = 0; i < tenor; i++) {
            let amount = baseAmount;
            if (i === tenor - 1) amount += remainder; 
            let dueDateStr = currentDate.toISOString().split('T')[0];
            
            debts.push({
                id: Date.now() + i, 
                lender: lender,
                totalAmount: amount,
                remainingAmount: amount,
                dueDate: dueDateStr,
                tenor: 1, 
                description: `${originalDesc} (Cicilan ${i + 1}/${tenor})`,
                isPaid: false
            });

            const currentDay = currentDate.getDate();
            currentDate.setMonth(currentDate.getMonth() + 1);
            if (currentDate.getDate() !== currentDay) {
                currentDate.setDate(0);
            }
        }
        return debts;
    },

    createSingleDebt(lender, amount, date, isPayable) {
        return {
            id: Date.now() + 1,
            lender: lender,
            totalAmount: amount,
            remainingAmount: amount,
            dueDate: document.getElementById('debt-due-date').value || date,
            tenor: 1,
            description: isPayable ? `Pinjaman dari ${lender}` : `Piutang ke ${lender}`,
            isPaid: false
        };
    }
};

window.TrackingView.init();
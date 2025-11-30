/**
 * MODULE: HISTORY (Revisi #4 - Smart PayLater Delete)
 * Fix: Hapus Transaksi PayLater Cicilan kini menghapus SELURUH tagihan bulanan terkait.
 */

if (!window.HistoryService) {
    window.HistoryService = {
        async fetch(filters) {
            return new Promise(resolve => {
                setTimeout(() => {
                    let data = [...db.transactions];
                    
                    // 1. FILTERING
                    if (filters.type !== 'all') {
                        if (filters.type === 'expense') data = data.filter(tx => tx.type === 'expense' || tx.type === 'debt_expense');
                        else data = data.filter(tx => tx.type === filters.type);
                    }
                    if (filters.startDate) data = data.filter(tx => tx.date >= filters.startDate);
                    if (filters.endDate) data = data.filter(tx => tx.date <= filters.endDate);
                    if (filters.search) {
                        const k = filters.search.toLowerCase();
                        data = data.filter(tx => (tx.description && tx.description.toLowerCase().includes(k)) || (tx.category && tx.category.toLowerCase().includes(k)));
                    }
                    
                    // 2. SORTING (Descending: Date -> ID)
                    data.sort((a, b) => {
                        const dateA = new Date(a.date);
                        const dateB = new Date(b.date);
                        if (dateB - dateA !== 0) return dateB - dateA;
                        return b.id - a.id;
                    });

                    resolve(data);
                }, 300);
            });
        },

        async getById(id) { return db.transactions.find(tx => tx.id === id); },

        async update(id, newData) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const idx = db.transactions.findIndex(tx => tx.id === id);
                    if (idx === -1) return reject("Data tidak ditemukan");
                    
                    const oldTx = db.transactions[idx];
                    
                    if(oldTx.type === 'lock' || oldTx.type === 'unlock') {
                        return reject("Untuk keamanan data, transaksi Tabungan tidak bisa diedit. Silakan hapus dan buat ulang.");
                    }

                    // 1. Revert Saldo Lama
                    this.adjustBalance(oldTx, true); 

                    // 2. Update Data
                    db.transactions[idx] = { ...oldTx, ...newData, type: oldTx.type }; 
                    
                    // 3. Apply Saldo Baru
                    this.adjustBalance(db.transactions[idx], false);

                    saveDataToLocalStorage();
                    resolve({ success: true });
                }, 400);
            });
        },

        async delete(id) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const idx = db.transactions.findIndex(tx => tx.id === id);
                    if (idx > -1) {
                        const tx = db.transactions[idx];
                        
                        // --- HANDLING KHUSUS BERDASARKAN TIPE ---

                        // CASE A: SALDO AWAL
                        if (tx.type === 'opening') {
                            const acc = db.accounts.find(a => a.id === parseInt(tx.destinationAccountId));
                            if (acc) acc.balance -= tx.amount;
                        }

                        // CASE B: TABUNGAN / SAVINGS
                        else if (tx.type === 'lock') { 
                            const goalName = tx.description.replace('Alokasi ke: ', '').trim();
                            const goal = db.savings.find(g => g.name === goalName);
                            const acc = db.accounts.find(a => a.id === parseInt(tx.sourceAccountId));
                            
                            if (acc) {
                                acc.reserved = (acc.reserved || 0) - tx.amount;
                                if (acc.reserved < 0) acc.reserved = 0;
                            }
                            if (goal) {
                                goal.current -= tx.amount;
                                if (goal.current < 0) goal.current = 0;
                            }
                        }
                        else if (tx.type === 'unlock') {
                            const goalName = tx.description.replace('Cair dari: ', '').trim();
                            const goal = db.savings.find(g => g.name === goalName);
                            const acc = db.accounts.find(a => a.id === parseInt(tx.destinationAccountId));

                            if (acc) {
                                acc.reserved = (acc.reserved || 0) + tx.amount;
                            }
                            if (goal) {
                                goal.current += tx.amount;
                            }
                        }

                        // CASE C: HUTANG / PAYLATER (Fix Bugs 1: Hapus Semua Cicilan)
                        else {
                            if (tx.linkedDebtId) {
                                // Cari data hutang "utama" yang terhubung
                                const firstDebt = db.debts.find(d => d.id === tx.linkedDebtId);
                                
                                if (firstDebt) {
                                    // Cek pola teks: "Nama Barang (Cicilan 1/6)"
                                    // Regex menangkap: (Nama Barang) dan (Total Tenor)
                                    const installmentMatch = firstDebt.description.match(/(.*) \(Cicilan \d+\/(\d+)\)/);

                                    if (installmentMatch) {
                                        // INI ADALAH CICILAN. Hapus semua saudaranya.
                                        const baseDesc = installmentMatch[1]; // contoh: "HP Baru"
                                        const totalTenor = installmentMatch[2]; // contoh: "6"

                                        // Filter: Pertahankan hutang yang BUKAN bagian dari seri cicilan ini
                                        db.debts = db.debts.filter(d => {
                                            const isSibling = 
                                                d.lender === firstDebt.lender && 
                                                d.description.startsWith(`${baseDesc} (Cicilan`) &&
                                                d.description.includes(`/${totalTenor})`);
                                            
                                            // Jika isSibling TRUE, berarti data ini harus dihapus (return false untuk filter)
                                            return !isSibling;
                                        });

                                    } else {
                                        // INI BUKAN CICILAN (Hutang Sekali Bayar). Hapus ID itu saja.
                                        db.debts = db.debts.filter(d => d.id !== tx.linkedDebtId);
                                    }
                                }
                            }
                            // Revert saldo akun (hanya jika ada sourceAccount, PayLater biasanya null source-nya jadi aman)
                            this.adjustBalance(tx, true);
                        }

                        // HAPUS TRANSAKSI DARI LIST
                        db.transactions.splice(idx, 1);
                        saveDataToLocalStorage();
                        resolve({ success: true });
                    } else reject("Tidak ditemukan");
                }, 300);
            });
        },

        // Helper untuk Transaksi Biasa
        adjustBalance(tx, isReverse) {
            const factor = isReverse ? -1 : 1; 
            
            if (tx.type === 'income' && tx.destinationAccountId) {
                const acc = db.accounts.find(a => a.id === parseInt(tx.destinationAccountId));
                if (acc) acc.balance += (tx.amount * factor);
            }
            else if (tx.type === 'opening' && tx.destinationAccountId) {
                const acc = db.accounts.find(a => a.id === parseInt(tx.destinationAccountId));
                if (acc) acc.balance += (tx.amount * factor);
            } 
            else if ((tx.type === 'expense' || tx.type === 'debt_expense') && tx.sourceAccountId) {
                const acc = db.accounts.find(a => a.id === parseInt(tx.sourceAccountId));
                if (acc) acc.balance -= (tx.amount * factor);
            }
            else if (tx.type === 'transfer') {
                const src = db.accounts.find(a => a.id === parseInt(tx.sourceAccountId));
                const dst = db.accounts.find(a => a.id === parseInt(tx.destinationAccountId));
                if (src) src.balance -= (tx.amount * factor);
                if (dst) dst.balance += (tx.amount * factor);
            }
        }
    };
}

window.HistoryView = {
    filters: { search: '', type: 'all', startDate: '', endDate: '' },
    editModal: null,

    async init() {
        const modalEl = document.getElementById('modal-edit-transaction');
        if (modalEl) this.editModal = new bootstrap.Modal(modalEl);

        document.getElementById('filter-search').addEventListener('input', (e) => {
            this.filters.search = e.target.value; this.render();
        });
        document.getElementById('filter-type').addEventListener('change', (e) => {
            this.filters.type = e.target.value; this.render();
        });

        await this.render();
    },

    setPeriod(period, btnElement) {
        document.querySelectorAll('#quick-filter-container .btn').forEach(btn => {
            btn.classList.remove('btn-dark');
            btn.classList.add('btn-outline-secondary');
        });
        btnElement.classList.remove('btn-outline-secondary');
        btnElement.classList.add('btn-dark');

        const today = new Date();
        let start = '', end = '';

        if (period === '7days') {
            const d = new Date();
            d.setDate(today.getDate() - 7);
            start = d.toISOString().split('T')[0];
            end = today.toISOString().split('T')[0];
        } else if (period === 'thisMonth') {
            start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        } else if (period === 'lastMonth') {
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
            end = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
        } else {
            start = ''; end = '';
        }

        this.filters.startDate = start;
        this.filters.endDate = end;
        this.render();
    },

    async render() {
        const container = document.getElementById('history-list');
        if (!container) return;
        
        const transactions = await window.HistoryService.fetch(this.filters);
        this.renderSummaryStats(transactions);

        if (transactions.length === 0) {
            container.innerHTML = `<div class="text-center py-5 text-muted opacity-50"><p>Tidak ada data.</p></div>`;
            return;
        }

        let html = ''; let lastDate = '';
        transactions.forEach(tx => {
            if (tx.date !== lastDate) {
                html += `
                    <div class="d-flex align-items-center mt-3 mb-2 px-1">
                        <small class="fw-bold text-secondary text-uppercase" style="font-size: 0.65rem; letter-spacing:1px;">
                            ${this.formatDateHeader(tx.date)}
                        </small>
                        <div class="flex-grow-1 border-bottom ms-2 opacity-25"></div>
                    </div>`;
                lastDate = tx.date;
            }

            const isIncome = tx.type === 'income';
            const isLock = tx.type === 'lock';
            const isUnlock = tx.type === 'unlock';
            const isTransfer = tx.type === 'transfer';
            const isOpening = tx.type === 'opening';
            
            let color = 'text-danger', icon = 'bi-arrow-up-right', bg = 'bg-danger-subtle', sign = '-';
            
            if (isIncome) { color='text-success'; icon='bi-arrow-down-left'; bg='bg-success-subtle'; sign='+'; }
            else if (isTransfer) { color='text-primary'; icon='bi-arrow-left-right'; bg='bg-primary-subtle'; sign=''; }
            else if (isLock) { color='text-info'; icon='bi-piggy-bank'; bg='bg-info-subtle'; sign=''; }
            else if (isUnlock) { color='text-secondary'; icon='bi-unlock'; bg='bg-secondary-subtle'; sign=''; }
            else if (isOpening) { color='text-info'; icon='bi-box-arrow-in-down'; bg='bg-info-subtle'; sign='+'; }

            const canEdit = !(isLock || isUnlock); 
            const canDelete = true; 

            const editButtonHtml = canEdit ? 
                `<li><a class="dropdown-item small" href="#" onclick="window.HistoryView.openEditModal(${tx.id})"><i class="bi bi-pencil me-2"></i>Edit</a></li>` : '';
            
            const deleteButtonHtml = canDelete ? 
                `<li><a class="dropdown-item small text-danger" href="#" onclick="window.HistoryView.handleDelete(${tx.id})"><i class="bi bi-trash me-2"></i>Hapus</a></li>` : '';

            // INFO AKUN
            let accountLabel = '';
            const srcAcc = db.accounts.find(a => a.id === parseInt(tx.sourceAccountId))?.name || 'Unknown';
            const dstAcc = db.accounts.find(a => a.id === parseInt(tx.destinationAccountId))?.name || 'Unknown';

            if (isTransfer) accountLabel = `Transfer: ${srcAcc} <i class="bi bi-arrow-right mx-1"></i> ${dstAcc}`;
            else if (isIncome) accountLabel = `Masuk ke: ${dstAcc}`;
            else if (isLock) accountLabel = `Terkunci di: ${srcAcc}`;
            else if (isUnlock) accountLabel = `Cair ke: ${dstAcc}`;
            else if (isOpening) accountLabel = `Saldo Awal Akun`;
            else accountLabel = `Dari: ${tx.sourceAccountId ? srcAcc : 'PayLater'}`;

            html += `
            <div class="card border-0 shadow-sm mb-1 position-relative history-card">
                <div class="card-body p-3 d-flex align-items-center">
                    <div class="rounded-circle ${bg} ${color} d-flex align-items-center justify-content-center me-3" style="width: 42px; height: 42px;">
                        <i class="bi ${icon}"></i>
                    </div>
                    <div class="flex-grow-1 overflow-hidden me-2" style="line-height: 1.2;">
                        <div class="d-flex justify-content-between">
                            <span class="fw-bold text-dark text-truncate">${tx.category}</span>
                            <span class="${color} fw-bold text-nowrap">${sign} ${formatCurrency(tx.amount)}</span>
                        </div>
                        <div class="text-muted text-truncate mb-1" style="font-size: 0.8rem;">${tx.description || '-'}</div>
                        <div class="badge bg-light text-secondary border fw-normal" style="font-size: 0.65rem;">
                            ${accountLabel}
                        </div>
                    </div>
                    <div class="dropdown">
                        <button class="btn btn-link btn-sm text-muted p-0" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button>
                        <ul class="dropdown-menu dropdown-menu-end border-0 shadow">
                            ${editButtonHtml}
                            ${deleteButtonHtml}
                        </ul>
                    </div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
        
        container.querySelectorAll('.dropdown').forEach(dropdown => {
            dropdown.addEventListener('show.bs.dropdown', function () {
                const card = this.closest('.card');
                if(card) { card.style.zIndex = 1000; card.style.transform = 'scale(1.01)'; card.style.transition = 'all 0.2s'; }
            });
            dropdown.addEventListener('hide.bs.dropdown', function () {
                const card = this.closest('.card');
                if(card) { setTimeout(() => { card.style.zIndex = ''; card.style.transform = ''; }, 200); }
            });
        });
    },

    renderSummaryStats(transactions) {
        let income = 0; let expense = 0;
        transactions.forEach(tx => {
            if (tx.type === 'income') income += tx.amount;
            else if (tx.type === 'expense' || tx.type === 'debt_expense') expense += tx.amount;
        });
        document.getElementById('filter-total-income').textContent = formatCurrency(income);
        document.getElementById('filter-total-expense').textContent = formatCurrency(expense);
    },

    formatDateHeader(dStr) {
        const d = new Date(dStr), today = new Date(), yest = new Date(); yest.setDate(today.getDate()-1);
        if(d.toDateString()===today.toDateString()) return "Hari Ini";
        if(d.toDateString()===yest.toDateString()) return "Kemarin";
        return d.toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'short'});
    },

    async handleDelete(id) { 
        if(confirm("Yakin ingin menghapus? Jika ini Hutang/Cicilan, SEMUA tagihan bulan terkait akan dihapus.")) { 
            await window.HistoryService.delete(id); 
            await this.render(); 
        } 
    },

    async openEditModal(id) {
        try {
            const tx = await window.HistoryService.getById(id);
            if (!tx) throw new Error("Data tidak ditemukan");

            document.getElementById('edit-id').value = tx.id;
            document.getElementById('edit-amount').value = formatNumberInput(tx.amount.toString());
            document.getElementById('edit-date').value = tx.date;
            document.getElementById('edit-description').value = tx.description;
            document.getElementById('edit-type').value = tx.type;

            const catSelect = document.getElementById('edit-category');
            let categories = [];
            
            if (tx.type === 'expense') categories = ["Makanan", "Transportasi", "Tagihan", "Hiburan", "Belanja", "Tabungan", "Bayar Hutang", "Lainnya"];
            else if (tx.type === 'income') categories = ["Gaji", "Bonus", "Freelance", "Hadiah", "Hasil Tabungan", "Pinjaman", "Lainnya"];
            else if (tx.type === 'opening') categories = ["Saldo Awal"];
            else categories = ["Transfer"];

            catSelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
            catSelect.value = tx.category;

            this.editModal.show();
        } catch (e) { alert(e); }
    },

    async handleSaveEdit() {
        const id = parseInt(document.getElementById('edit-id').value);
        const amount = parseFloat(unformatNumberInput(document.getElementById('edit-amount').value));
        const date = document.getElementById('edit-date').value;
        const category = document.getElementById('edit-category').value;
        const desc = document.getElementById('edit-description').value;

        if (!amount || amount <= 0) return alert("Jumlah tidak valid");
        try {
            await window.HistoryService.update(id, { amount, date, category, description: desc });
            this.editModal.hide();
            await this.render();
        } catch (e) { alert(e); }
    }
};
window.HistoryView.init();
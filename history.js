/**
 * MODULE: HISTORY (Revisi #8 - Grouping, Summary, Edit)
 * Menampilkan Riwayat dengan Pengelompokan Tanggal dan Fitur Edit
 */

// =======================================================
// 1. DATA SERVICE
// =======================================================
if (!window.HistoryService) {
    window.HistoryService = {
        async fetch(filters) {
            return new Promise(resolve => {
                setTimeout(() => {
                    let data = [...db.transactions];
                    
                    // Filter Logic
                    if (filters.type !== 'all') {
                        if (filters.type === 'expense') data = data.filter(tx => tx.type === 'expense' || tx.type === 'debt_expense');
                        else data = data.filter(tx => tx.type === filters.type);
                    }
                    if (filters.accountId !== 'all') {
                        const accId = parseInt(filters.accountId);
                        data = data.filter(tx => tx.sourceAccountId === accId || tx.destinationAccountId === accId);
                    }
                    if (filters.startDate) data = data.filter(tx => tx.date >= filters.startDate);
                    if (filters.endDate) data = data.filter(tx => tx.date <= filters.endDate);
                    if (filters.search) {
                        const keyword = filters.search.toLowerCase();
                        data = data.filter(tx => 
                            (tx.description && tx.description.toLowerCase().includes(keyword)) ||
                            (tx.category && tx.category.toLowerCase().includes(keyword))
                        );
                    }
                    
                    // Sort Descending (Terbaru di atas)
                    data.sort((a, b) => new Date(b.date) - new Date(a.date));
                    resolve(data);
                }, 300);
            });
        },

        async getById(id) {
            return db.transactions.find(tx => tx.id === id);
        },

        // LOGIKA EDIT: Kembalikan saldo lama -> Update Data -> Kurangi saldo baru
        async update(id, newData) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const index = db.transactions.findIndex(tx => tx.id === id);
                    if (index === -1) return reject("Transaksi tidak ditemukan");
                    
                    const oldTx = db.transactions[index];

                    // 1. REVERSE BALANCE (Batalkan efek transaksi lama)
                    this.adjustBalance(oldTx, true); // true = reverse

                    // 2. UPDATE DATA
                    db.transactions[index] = { ...oldTx, ...newData };
                    const newTx = db.transactions[index];

                    // 3. APPLY NEW BALANCE (Terapkan efek transaksi baru)
                    this.adjustBalance(newTx, false); // false = apply

                    saveDataToLocalStorage();
                    resolve({ success: true });
                }, 400);
            });
        },

        async delete(id) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const index = db.transactions.findIndex(tx => tx.id === id);
                    if (index > -1) {
                        const tx = db.transactions[index];
                        this.adjustBalance(tx, true); // Reverse balance sebelum hapus
                        db.transactions.splice(index, 1);
                        saveDataToLocalStorage();
                        resolve({ success: true });
                    } else {
                        reject("Transaksi tidak ditemukan");
                    }
                }, 300);
            });
        },

        // Helper: Mengatur Saldo (Reverse atau Apply)
        adjustBalance(tx, isReverse) {
            const factor = isReverse ? -1 : 1; 
            // Jika isReverse=true: Expense (dikurang) jadi ditambah. Income (ditambah) jadi dikurang.
            
            if (tx.type === 'income' && tx.destinationAccountId) {
                const acc = db.accounts.find(a => a.id === parseInt(tx.destinationAccountId));
                if (acc) acc.balance += (tx.amount * factor); // Normal: +Amount. Reverse: -Amount.
            } 
            else if ((tx.type === 'expense' || tx.type === 'debt_expense') && tx.sourceAccountId) {
                const acc = db.accounts.find(a => a.id === parseInt(tx.sourceAccountId));
                if (acc) acc.balance -= (tx.amount * factor); // Normal: -Amount. Reverse: +Amount.
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

// =======================================================
// 2. VIEW CONTROLLER
// =======================================================
window.HistoryView = {
    filters: {
        search: '',
        type: 'all',
        accountId: 'all',
        startDate: '',
        endDate: ''
    },
    editModal: null,

    async init() {
        console.log("HistoryView initialized");
        
        // Init Filter Dropdown
        const accSelect = document.getElementById('filter-account');
        if (accSelect) {
            const accounts = db.accounts || []; 
            accSelect.innerHTML = `<option value="all">Semua Akun</option>` + 
                accounts.map(acc => `<option value="${acc.id}">${acc.name}</option>`).join('');
        }

        // Init Edit Modal
        const modalEl = document.getElementById('modal-edit-transaction');
        if (modalEl) this.editModal = new bootstrap.Modal(modalEl);

        // Event Listeners
        const searchInput = document.getElementById('filter-search');
        if (searchInput) {
            searchInput.oninput = (e) => {
                this.filters.search = e.target.value;
                this.render(); 
            };
        }

        ['filter-type', 'filter-account', 'filter-date-start', 'filter-date-end'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.onchange = () => this.updateFilters();
        });

        await this.render();
    },

    updateFilters() {
        this.filters.type = document.getElementById('filter-type').value;
        this.filters.accountId = document.getElementById('filter-account').value;
        this.filters.startDate = document.getElementById('filter-date-start').value;
        this.filters.endDate = document.getElementById('filter-date-end').value;
        this.render();
    },

    resetFilter() {
        document.getElementById('filter-search').value = '';
        document.getElementById('filter-type').value = 'all';
        document.getElementById('filter-account').value = 'all';
        document.getElementById('filter-date-start').value = '';
        document.getElementById('filter-date-end').value = '';
        
        this.filters = { search: '', type: 'all', accountId: 'all', startDate: '', endDate: '' };
        this.render();
    },

    async render() {
        const container = document.getElementById('history-list');
        if (!container) return;
        
        try {
            const transactions = await window.HistoryService.fetch(this.filters);
            
            // 1. Update Dynamic Summary
            this.renderSummaryStats(transactions);

            // 2. Check Empty
            if (transactions.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-5 text-muted opacity-50">
                        <i class="bi bi-inbox display-1 d-block mb-3"></i>
                        <p class="fw-medium">Tidak ada data yang cocok.</p>
                    </div>`;
                return;
            }

            // 3. Render Grouped List
            let html = '';
            let lastDate = '';

            transactions.forEach(tx => {
                // Header Tanggal (Grouping)
                if (tx.date !== lastDate) {
                    html += `
                        <div class="d-flex align-items-center mt-2 mb-1">
                            <h6 class="fw-bold text-secondary mb-0 small text-uppercase" style="letter-spacing: 1px;">
                                ${this.formatDateHeader(tx.date)}
                            </h6>
                            <div class="flex-grow-1 border-bottom ms-3"></div>
                        </div>`;
                    lastDate = tx.date;
                }

                // Item Card
                const isIncome = tx.type === 'income';
                const isTransfer = tx.type === 'transfer';
                
                let colorClass = isIncome ? 'text-success' : (isTransfer ? 'text-primary' : 'text-danger');
                let bgIcon = isIncome ? 'bg-success-subtle' : (isTransfer ? 'bg-primary-subtle' : 'bg-danger-subtle');
                let iconClass = isIncome ? 'bi-arrow-down-left' : (isTransfer ? 'bi-arrow-left-right' : 'bi-arrow-up-right');
                let amountPrefix = isIncome ? '+' : (isTransfer ? '' : '-');
                
                let accountLabel = '';
                const srcAcc = db.accounts.find(a => a.id === parseInt(tx.sourceAccountId))?.name || 'Unknown';
                const dstAcc = db.accounts.find(a => a.id === parseInt(tx.destinationAccountId))?.name || 'Unknown';

                if (isTransfer) accountLabel = `${srcAcc} <i class="bi bi-arrow-right small mx-1"></i> ${dstAcc}`;
                else if (isIncome) accountLabel = dstAcc;
                else accountLabel = tx.sourceAccountId ? srcAcc : 'PayLater';

                html += `
                <div class="card border-0 shadow-sm transaction-card">
                    <div class="card-body p-3 d-flex align-items-center">
                        <div class="rounded-circle ${bgIcon} ${colorClass} d-flex align-items-center justify-content-center me-3" style="width: 42px; height: 42px; flex-shrink: 0;">
                            <i class="bi ${iconClass}"></i>
                        </div>
                        <div class="flex-grow-1 overflow-hidden me-3">
                            <div class="d-flex justify-content-between">
                                <h6 class="mb-0 fw-bold text-dark text-truncate">${tx.category}</h6>
                                <span class="${colorClass} fw-bold text-nowrap">${amountPrefix} ${formatCurrency(tx.amount)}</span>
                            </div>
                            <div class="d-flex justify-content-between mt-1">
                                <small class="text-muted text-truncate" style="max-width: 200px;">${tx.description || '-'}</small>
                                <small class="text-secondary fw-medium fst-italic text-truncate" style="font-size: 0.75rem;">${accountLabel}</small>
                            </div>
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-light btn-sm p-1 text-muted" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button>
                            <ul class="dropdown-menu dropdown-menu-end border-0 shadow">
                                <li><a class="dropdown-item small" href="#" onclick="window.HistoryView.openEditModal(${tx.id})"><i class="bi bi-pencil me-2"></i>Edit</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item small text-danger" href="#" onclick="window.HistoryView.handleDelete(${tx.id})"><i class="bi bi-trash me-2"></i>Hapus</a></li>
                            </ul>
                        </div>
                    </div>
                </div>`;
            });

            container.innerHTML = html;
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">Error: ${error}</div>`;
        }
    },

    renderSummaryStats(transactions) {
        let income = 0;
        let expense = 0;
        transactions.forEach(tx => {
            if (tx.type === 'income') income += tx.amount;
            else if (tx.type === 'expense' || tx.type === 'debt_expense') expense += tx.amount;
        });

        const elInc = document.getElementById('filter-total-income');
        const elExp = document.getElementById('filter-total-expense');
        
        if (elInc) elInc.textContent = formatCurrency(income);
        if (elExp) elExp.textContent = formatCurrency(expense);
    },

    formatDateHeader(dateStr) {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        const isToday = date.toDateString() === today.toDateString();
        const isYesterday = date.toDateString() === yesterday.toDateString();

        if (isToday) return "Hari Ini";
        if (isYesterday) return "Kemarin";
        
        // Format: Jumat, 28 Nov 2025
        return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
    },

    async handleDelete(id) {
        if (!confirm("Hapus transaksi ini? Saldo akan dikembalikan ke akun.")) return;
        try {
            await window.HistoryService.delete(id);
            await this.render();
        } catch (e) { alert(e); }
    },

    // --- LOGIKA EDIT ---
    async openEditModal(id) {
        try {
            const tx = await window.HistoryService.getById(id);
            if (!tx) throw new Error("Data tidak ditemukan");

            // Populate Form
            document.getElementById('edit-id').value = tx.id;
            document.getElementById('edit-amount').value = formatNumberInput(tx.amount.toString());
            document.getElementById('edit-date').value = tx.date;
            document.getElementById('edit-description').value = tx.description;
            document.getElementById('edit-type').value = tx.type;

            // Populate Kategori (Sesuai Tipe)
            const catSelect = document.getElementById('edit-category');
            let categories = [];
            if (tx.type === 'expense') categories = ["Makanan", "Transportasi", "Tagihan", "Hiburan", "Belanja", "Tabungan", "Bayar Hutang", "Lainnya"];
            else if (tx.type === 'income') categories = ["Gaji", "Bonus", "Freelance", "Hadiah", "Hasil Tabungan", "Pinjaman", "Lainnya"];
            else categories = ["Transfer"]; // Transfer biasanya fix

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

        const newData = {
            amount: amount,
            date: date,
            category: category,
            description: desc
        };

        try {
            await window.HistoryService.update(id, newData);
            this.editModal.hide();
            await this.render(); // Refresh list
        } catch (e) {
            alert("Gagal update: " + e);
        }
    }
};

window.HistoryView.init();
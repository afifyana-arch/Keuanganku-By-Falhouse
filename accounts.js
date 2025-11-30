/**
 * MODULE: ACCOUNTS (Revisi #23 - Fix Initial Balance as Non-Income)
 */

if (!window.AccountService) {
    window.AccountService = {
        async getAll() { return new Promise(resolve => setTimeout(() => resolve(db.accounts || []), 300)); },
        
        async getById(id) { 
            return new Promise((resolve, reject) => { 
                const acc = db.accounts.find(a => a.id === id); 
                acc ? resolve(acc) : reject("Akun tidak ditemukan"); 
            }); 
        },
        
        async save(data, initBal = 0) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    try {
                        if (data.id) {
                            // Logic Edit Akun
                            const idx = db.accounts.findIndex(a => a.id === data.id);
                            if (idx === -1) throw new Error("Akun tidak ditemukan");
                            db.accounts[idx].name = data.name;
                            db.accounts[idx].icon = data.icon;
                            db.accounts[idx].accountNumber = data.accountNumber;
                        } else {
                            // Logic Buat Akun Baru
                            const newAcc = { 
                                id: Date.now(), 
                                name: data.name, 
                                icon: data.icon, 
                                accountNumber: data.accountNumber, 
                                balance: 0, 
                                reserved: 0 
                            };
                            
                            db.accounts.push(newAcc);

                            // --- PERUBAHAN DI SINI ---
                            if (initBal > 0) {
                                db.transactions.push({
                                    id: Date.now() + 1, 
                                    type: 'opening', // Diganti dari 'income' menjadi 'opening'
                                    amount: initBal, 
                                    category: 'Saldo Awal',
                                    description: `Saldo awal ${newAcc.name}`, 
                                    date: new Date().toISOString().split('T')[0],
                                    sourceAccountId: null, 
                                    destinationAccountId: newAcc.id
                                });
                                // Saldo tetap bertambah, tapi type 'opening' tidak dihitung di Dashboard Income
                                newAcc.balance = initBal;
                            }
                        }
                        saveDataToLocalStorage(); 
                        resolve({ success: true });
                    } catch (e) { reject(e); }
                }, 400);
            });
        },
        
        async delete(id) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const isUsed = db.transactions.some(tx => tx.sourceAccountId === id || tx.destinationAccountId === id);
                    if (isUsed) reject("Akun tidak bisa dihapus karena memiliki riwayat transaksi.");
                    else { 
                        db.accounts = db.accounts.filter(a => a.id !== id); 
                        saveDataToLocalStorage(); 
                        resolve({ success: true }); 
                    }
                }, 300);
            });
        }
    };
}

window.AccountsView = {
    modal: null,
    
    async init() {
        console.log("AccountsView Initialized (Rev 23)");
        const modalEl = document.getElementById('account-modal');
        if (modalEl) this.modal = new bootstrap.Modal(modalEl);
        
        const iconSelect = document.getElementById('account-icon');
        const iconPreview = document.getElementById('icon-display-preview');
        if (iconSelect && iconPreview) {
            iconSelect.onchange = (e) => iconPreview.innerHTML = `<i class="bi ${e.target.value}"></i>`;
        }
        await this.renderList();
    },

    async renderList() {
        const container = document.getElementById('accounts-list');
        const elTotal = document.getElementById('total-assets');
        const elCount = document.getElementById('total-accounts-count');
        if (!container) return;

        const accounts = await window.AccountService.getAll();
        const totalAssets = accounts.reduce((sum, acc) => sum + acc.balance, 0); 
        if(elTotal) elTotal.textContent = formatCurrency(totalAssets);
        if(elCount) elCount.textContent = accounts.length;

        if (accounts.length === 0) {
            container.innerHTML = `<div class="col-12 text-center py-5 text-muted"><p>Belum ada akun.</p><button class="btn btn-primary btn-sm" onclick="window.AccountsView.openModal()">Tambah</button></div>`;
            return;
        }

        container.innerHTML = accounts.map(acc => {
            const reserved = acc.reserved || 0;
            const available = acc.balance - reserved;
            const accNum = acc.accountNumber ? acc.accountNumber : '';
            const copyBtn = accNum ? `<button class="btn btn-sm btn-light border ms-2" onclick="window.AccountsView.copy('${accNum}')"><i class="bi bi-copy"></i></button>` : '';

            return `
            <div class="col-12 col-md-6 col-xl-4">
                <div class="card h-100 border shadow-sm" style="border-radius: 16px;">
                    <div class="card-body p-4 d-flex flex-column justify-content-between">
                        
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div class="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center" style="width: 48px; height: 48px; font-size: 1.25rem;">
                                <i class="bi ${acc.icon || 'bi-wallet2'}"></i>
                            </div>
                            <div class="text-end">
                                <small class="text-muted fw-bold" style="font-size: 0.65rem;">SALDO REAL</small>
                                <div class="fw-bold text-dark fs-5">${formatCurrency(acc.balance)}</div>
                            </div>
                        </div>

                        <div class="p-3 bg-light rounded-3 mb-3">
                            <div class="d-flex justify-content-between mb-2">
                                <span class="small text-secondary"><i class="bi bi-check-circle-fill text-success me-1"></i>Aktif</span>
                                <span class="fw-bold text-success">${formatCurrency(available)}</span>
                            </div>
                            <div class="d-flex justify-content-between">
                                <span class="small text-secondary"><i class="bi bi-lock-fill text-secondary me-1"></i>Tabungan</span>
                                <span class="fw-bold text-muted">${formatCurrency(reserved)}</span>
                            </div>
                        </div>

                        <div class="d-flex justify-content-between pt-3 border-top align-items-center">
                            <div class="overflow-hidden flex-grow-1 me-2">
                                <div class="fw-bold text-dark small text-truncate">${acc.name}</div>
                                <div class="d-flex align-items-center mt-1">
                                    <span class="font-monospace small text-muted bg-white border px-2 rounded">${accNum || '-'}</span>
                                    ${copyBtn}
                                </div>
                            </div>
                            
                            <div class="dropdown">
                                <button class="btn btn-light btn-sm text-muted" type="button" data-bs-toggle="dropdown">
                                    <i class="bi bi-three-dots-vertical"></i>
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end border-0 shadow">
                                    <li><a class="dropdown-item small" href="#" onclick="window.AccountsView.openModal(${acc.id})"><i class="bi bi-pencil me-2"></i> Edit</a></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item small text-danger" href="#" onclick="window.AccountsView.handleDelete(${acc.id})"><i class="bi bi-trash me-2"></i> Hapus</a></li>
                                </ul>
                            </div>
                        </div>

                    </div>
                </div>
            </div>`;
        }).join('');

        // Z-Index fix
        container.querySelectorAll('.dropdown').forEach(dropdown => {
            dropdown.addEventListener('show.bs.dropdown', function () {
                const card = this.closest('.card');
                if(card) { card.style.zIndex = 100; card.style.position = 'relative'; }
            });
            dropdown.addEventListener('hide.bs.dropdown', function () {
                const card = this.closest('.card');
                if(card) { card.style.zIndex = ''; card.style.position = ''; }
            });
        });
    },

    async openModal(id = null) {
        const form = document.getElementById('account-form');
        const title = document.getElementById('account-modal-title');
        const fieldInit = document.getElementById('field-initial-balance');
        form.reset(); document.getElementById('account-id').value = '';
        
        const iconPreview = document.getElementById('icon-display-preview');
        if(iconPreview) iconPreview.innerHTML = `<i class="bi bi-wallet2"></i>`;

        if (id) {
            title.textContent = "Edit Akun"; 
            fieldInit.classList.add('d-none');
            try {
                const acc = await window.AccountService.getById(id);
                document.getElementById('account-id').value = acc.id;
                document.getElementById('account-name').value = acc.name;
                document.getElementById('account-number').value = acc.accountNumber || '';
                document.getElementById('account-icon').value = acc.icon || 'bi-wallet2';
                
                if(iconPreview) iconPreview.innerHTML = `<i class="bi ${acc.icon || 'bi-wallet2'}"></i>`;
            } catch(e) { alert(e); return; }
        } else {
            title.textContent = "Tambah Akun"; 
            fieldInit.classList.remove('d-none');
        }
        this.modal.show();
    },

    async handleSave() {
        const id = document.getElementById('account-id').value;
        const name = document.getElementById('account-name').value;
        const icon = document.getElementById('account-icon').value;
        const num = document.getElementById('account-number').value;
        const initBal = document.getElementById('initial-balance').value;
        
        if (!name) return alert("Nama wajib diisi");
        
        const data = { id: id ? parseInt(id) : null, name, icon, accountNumber: num };
        const bal = id ? 0 : (parseFloat(unformatNumberInput(initBal)) || 0);
        
        try { 
            await window.AccountService.save(data, bal); 
            this.modal.hide(); 
            await this.renderList(); 
        } catch (e) { alert(e.message); }
    },

    async handleDelete(id) { 
        if(confirm("Yakin ingin menghapus akun ini?")) {
            try { 
                await window.AccountService.delete(id); 
                await this.renderList(); 
            } catch(e){ alert(e); } 
        }
    },

    copy(text) { 
        navigator.clipboard.writeText(text).then(() => alert("No. Rekening disalin!")); 
    }
};

window.AccountsView.init();
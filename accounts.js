/**
 * MODULE: ACCOUNTS (Revisi #7 - Visual Fix & Fitur Copy Rekening)
 */

// =======================================================
// 1. DATA SERVICE
// =======================================================
if (!window.AccountService) {
    window.AccountService = {
        async getAll() {
            return new Promise(resolve => setTimeout(() => resolve(db.accounts || []), 300));
        },

        async getById(id) {
            return new Promise((resolve, reject) => {
                const acc = db.accounts.find(a => a.id === id);
                acc ? resolve(acc) : reject("Akun tidak ditemukan");
            });
        },

        async save(accountData, initialBalance = 0) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    try {
                        if (accountData.id) {
                            // Edit Mode
                            const index = db.accounts.findIndex(a => a.id === accountData.id);
                            if (index === -1) throw new Error("Akun tidak ditemukan");
                            
                            // Update field
                            db.accounts[index].name = accountData.name;
                            db.accounts[index].icon = accountData.icon;
                            db.accounts[index].accountNumber = accountData.accountNumber;
                        } else {
                            // Create Mode
                            const newAccount = {
                                id: Date.now(),
                                name: accountData.name,
                                icon: accountData.icon,
                                accountNumber: accountData.accountNumber, // New Field
                                balance: 0
                            };
                            db.accounts.push(newAccount);

                            // Handle Saldo Awal
                            if (initialBalance > 0) {
                                const initialTx = {
                                    id: Date.now() + 1,
                                    type: 'income',
                                    amount: initialBalance,
                                    category: 'Saldo Awal',
                                    description: `Saldo awal akun ${newAccount.name}`,
                                    date: new Date().toISOString().split('T')[0],
                                    sourceAccountId: null,
                                    destinationAccountId: newAccount.id,
                                    linkedDebtId: null
                                };
                                db.transactions.push(initialTx);
                                newAccount.balance = initialBalance;
                            }
                        }
                        saveDataToLocalStorage();
                        resolve({ success: true });
                    } catch (e) {
                        reject(e);
                    }
                }, 400);
            });
        },

        async delete(id) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const isUsed = db.transactions.some(tx => 
                        tx.sourceAccountId === id || tx.destinationAccountId === id
                    );
                    if (isUsed) {
                        reject("Akun tidak bisa dihapus karena memiliki riwayat transaksi.");
                    } else {
                        db.accounts = db.accounts.filter(a => a.id !== id);
                        saveDataToLocalStorage();
                        resolve({ success: true });
                    }
                }, 300);
            });
        }
    };
}

// =======================================================
// 2. VIEW CONTROLLER
// =======================================================
window.AccountsView = {
    modal: null,

    async init() {
        console.log("AccountsView initialized");
        const modalEl = document.getElementById('account-modal');
        if (modalEl) this.modal = new bootstrap.Modal(modalEl);

        // Live Preview Icon di Modal
        const iconSelect = document.getElementById('account-icon');
        const iconPreview = document.getElementById('icon-display-preview');
        if (iconSelect && iconPreview) {
            iconSelect.onchange = (e) => {
                // Pastikan class 'bi' ada
                iconPreview.innerHTML = `<i class="bi ${e.target.value}"></i>`;
            };
        }

        await this.renderList();
    },

    async renderList() {
        const container = document.getElementById('accounts-list');
        const elTotal = document.getElementById('total-assets');
        const elCount = document.getElementById('total-accounts-count');

        if (!container) return;

        try {
            const accounts = await window.AccountService.getAll();
            
            // Hitung Total Aset
            const totalAssets = accounts.reduce((sum, acc) => sum + acc.balance, 0);
            if(elTotal) elTotal.textContent = formatCurrency(totalAssets);
            if(elCount) elCount.textContent = accounts.length;

            if (accounts.length === 0) {
                container.innerHTML = `
                    <div class="col-12 text-center py-5 text-muted">
                        <i class="bi bi-wallet2 display-4 d-block mb-3 opacity-50"></i>
                        <p>Belum ada akun tersimpan.</p>
                        <button class="btn btn-outline-primary btn-sm" onclick="window.AccountsView.openModal()">Buat Akun Pertama</button>
                    </div>`;
                return;
            }

            container.innerHTML = accounts.map(acc => {
                // Tentukan style kartu (Gradient acak atau berdasarkan jenis ikon)
                // Kita pakai style bersih saja: Putih dengan border halus
                const iconClass = acc.icon || 'bi-wallet2'; 
                const accNum = acc.accountNumber ? acc.accountNumber : '';
                const copyBtn = accNum ? 
                    `<button class="btn btn-sm btn-light border text-muted ms-2" onclick="window.AccountsView.copyToClipboard('${accNum}')" title="Salin No. Rek">
                        <i class="bi bi-copy"></i>
                     </button>` : '';

                return `
                <div class="col-12 col-md-6 col-xl-4">
                    <div class="card h-100 border shadow-sm account-card-hover" style="border-radius: 16px;">
                        <div class="card-body p-4 d-flex flex-column justify-content-between">
                            
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <div class="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center" 
                                     style="width: 48px; height: 48px; font-size: 1.25rem;">
                                    <i class="bi ${iconClass}"></i>
                                </div>
                                <div class="dropdown">
                                    <button class="btn btn-link text-muted p-0" type="button" data-bs-toggle="dropdown">
                                        <i class="bi bi-three-dots-vertical"></i>
                                    </button>
                                    <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0">
                                        <li><a class="dropdown-item small" href="#" onclick="window.AccountsView.openModal(${acc.id})"><i class="bi bi-pencil me-2"></i>Edit</a></li>
                                        <li><hr class="dropdown-divider"></li>
                                        <li><a class="dropdown-item small text-danger" href="#" onclick="window.AccountsView.handleDelete(${acc.id})"><i class="bi bi-trash me-2"></i>Hapus</a></li>
                                    </ul>
                                </div>
                            </div>

                            <div>
                                <small class="text-muted text-uppercase fw-bold" style="font-size: 0.7rem; letter-spacing: 1px;">Saldo Tersedia</small>
                                <h3 class="fw-bold text-dark mt-1 mb-0">${formatCurrency(acc.balance)}</h3>
                            </div>

                            <div class="mt-3 pt-3 border-top d-flex align-items-center justify-content-between">
                                <div class="d-flex align-items-center overflow-hidden">
                                    <span class="text-truncate fw-medium text-secondary small me-1">${acc.name}</span>
                                </div>
                                <div class="d-flex align-items-center">
                                    <span class="font-monospace small text-muted bg-light px-2 py-1 rounded">${accNum || 'N/A'}</span>
                                    ${copyBtn}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
                `;
            }).join('');
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger w-100">Gagal memuat data: ${error}</div>`;
        }
    },

    async openModal(id = null) {
        const form = document.getElementById('account-form');
        const title = document.getElementById('account-modal-title');
        const fieldInitBalance = document.getElementById('field-initial-balance');
        const iconSelect = document.getElementById('account-icon');
        const iconPreview = document.getElementById('icon-display-preview');
        
        if(form) form.reset();
        document.getElementById('account-id').value = '';
        
        // Reset preview icon
        if(iconPreview) iconPreview.innerHTML = `<i class="bi bi-wallet2"></i>`;

        if (id) {
            // EDIT MODE
            title.textContent = "Edit Akun";
            fieldInitBalance.classList.add('d-none'); // Tidak boleh edit saldo awal
            try {
                const acc = await window.AccountService.getById(id);
                document.getElementById('account-id').value = acc.id;
                document.getElementById('account-name').value = acc.name;
                document.getElementById('account-number').value = acc.accountNumber || '';
                
                if(iconSelect) iconSelect.value = acc.icon || 'bi-wallet2';
                if(iconPreview) iconPreview.innerHTML = `<i class="bi ${acc.icon || 'bi-wallet2'}"></i>`;
            } catch (e) {
                alert(e);
                return;
            }
        } else {
            // CREATE MODE
            title.textContent = "Tambah Akun Baru";
            fieldInitBalance.classList.remove('d-none');
        }

        if(this.modal) this.modal.show();
    },

    async handleSave() {
        const btnSave = document.getElementById('btn-save-account');
        const originalText = btnSave.innerHTML;
        
        const id = document.getElementById('account-id').value;
        const name = document.getElementById('account-name').value.trim();
        const icon = document.getElementById('account-icon').value;
        const accNum = document.getElementById('account-number').value.trim();
        const initialBalanceStr = document.getElementById('initial-balance').value;
        
        if (!name) return alert("Nama akun wajib diisi.");

        const accountData = {
            id: id ? parseInt(id) : null,
            name: name,
            icon: icon,
            accountNumber: accNum
        };
        const initialBalance = id ? 0 : (parseFloat(unformatNumberInput(initialBalanceStr)) || 0);

        try {
            btnSave.disabled = true;
            btnSave.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            await window.AccountService.save(accountData, initialBalance);
            this.modal.hide();
            await this.renderList();
        } catch (error) {
            alert("Gagal menyimpan: " + error.message);
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = originalText;
        }
    },

    async handleDelete(id) {
        if (!confirm("Yakin ingin menghapus akun ini?")) return;
        try {
            await window.AccountService.delete(id);
            await this.renderList();
        } catch (error) {
            alert(error);
        }
    },

    // Utility: Copy to Clipboard
    copyToClipboard(text) {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            // Bisa ganti dengan Toast notification jika mau
            alert("No. Rekening disalin: " + text);
        }).catch(err => {
            console.error('Gagal menyalin', err);
        });
    }
};

window.AccountsView.init();
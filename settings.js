/**
 * MODULE: SETTINGS (Final Complete Version)
 * Menggabungkan fitur Profil User dengan Backup & Restore Data
 */

// =======================================================
// 1. DATA SERVICE
// =======================================================
if (!window.SettingsService) {
    window.SettingsService = {
        
        // --- 1. UPDATE PROFILE (Dari kodemu) ---
        async updateProfile(name, role) {
            return new Promise(resolve => {
                setTimeout(() => {
                    db.profile = { name, role };
                    saveDataToLocalStorage(); 
                    
                    // Update Header Langsung (Visual)
                    const elName = document.getElementById('header-user-name');
                    const elRole = document.getElementById('header-user-role');
                    if (elName) elName.textContent = name;
                    if (elRole) elRole.textContent = role;
                    
                    resolve({ success: true });
                }, 300);
            });
        },

        // --- 2. EXPORT JSON (Backup System) ---
        async exportJSON() {
            return new Promise((resolve, reject) => {
                try {
                    if (typeof db === 'undefined') throw new Error("Database belum siap.");
                    const dataStr = JSON.stringify(db, null, 2);
                    const blob = new Blob([dataStr], { type: 'application/json' });
                    this.triggerDownload(blob, `keuanganku_backup_${this.getDateStr()}.json`);
                    resolve({ success: true });
                } catch (e) {
                    reject(e.message);
                }
            });
        },

        // --- 3. EXPORT CSV (Laporan Excel) ---
        async exportCSV() {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    try {
                        if (typeof db === 'undefined') throw new Error("Database belum siap.");
                        const transactions = db.transactions || [];
                        if (transactions.length === 0) throw new Error("Belum ada data transaksi.");

                        let csvContent = "TANGGAL,TIPE,KATEGORI,KETERANGAN,NOMINAL,AKUN SUMBER,AKUN TUJUAN\n";

                        transactions.forEach(tx => {
                            // Helper agar koma dalam teks tidak merusak kolom CSV
                            const clean = (t) => `"${(t || '').replace(/"/g, '""')}"`;
                            
                            // Mapping Nama Akun
                            let srcName = '-';
                            let dstName = '-';
                            
                            if (tx.sourceAccountId) {
                                const acc = db.accounts.find(a => a.id == tx.sourceAccountId);
                                srcName = acc ? acc.name : 'Unknown';
                            }
                            if (tx.destinationAccountId) {
                                const acc = db.accounts.find(a => a.id == tx.destinationAccountId);
                                dstName = acc ? acc.name : 'Unknown';
                            }
                            
                            // Handling label khusus hutang
                            if (!tx.sourceAccountId && tx.type === 'expense') srcName = 'Hutang/PayLater';
                            if (!tx.destinationAccountId && tx.type === 'income') dstName = 'Pinjaman Masuk';

                            csvContent += `${tx.date},${tx.type},${clean(tx.category)},${clean(tx.description)},${tx.amount},${clean(srcName)},${clean(dstName)}\n`;
                        });

                        // Tambahkan BOM agar Excel membaca UTF-8 dengan benar
                        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
                        this.triggerDownload(blob, `Laporan_Keuanganku_${this.getDateStr()}.csv`);
                        resolve({ success: true });
                    } catch (e) {
                        reject(e.message);
                    }
                }, 500);
            });
        },

        // --- 4. IMPORT DATA (Restore/Upload) ---
        async importData(file) {
            return new Promise((resolve, reject) => {
                if (!file) return reject("Pilih file .json terlebih dahulu.");
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedData = JSON.parse(e.target.result);
                        // Validasi sederhana struktur file
                        if (!importedData.transactions || !importedData.accounts) throw new Error("Format file salah/tidak valid.");
                        
                        // Replace DB
                        Object.keys(db).forEach(key => delete db[key]);
                        Object.assign(db, importedData);
                        saveDataToLocalStorage();
                        resolve({ success: true });
                    } catch (error) {
                        reject("Gagal membaca file: " + error.message);
                    }
                };
                reader.readAsText(file);
            });
        },

        // --- 5. RESET DATA ---
        async resetData() {
            return new Promise(resolve => {
                const cleanData = JSON.parse(JSON.stringify(defaultDB)); // Reset ke default dr app.js
                Object.keys(db).forEach(key => delete db[key]);
                Object.assign(db, cleanData);
                saveDataToLocalStorage();
                resolve({ success: true });
            });
        },

        // --- HELPER PRIVATE ---
        triggerDownload(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);
        },

        getDateStr() {
            return new Date().toISOString().split('T')[0];
        }
    };
}

// =======================================================
// 2. VIEW CONTROLLER
// =======================================================
window.SettingsView = {
    async init() {
        console.log("SettingsView initialized");
        
        // Isi Form dengan Data Saat Ini
        if (typeof db !== 'undefined' && db.profile) {
            const elName = document.getElementById('setting-name');
            const elRole = document.getElementById('setting-role');
            if(elName) elName.value = db.profile.name || '';
            if(elRole) elRole.value = db.profile.role || '';
        }
    },

    // 1. SAVE PROFILE
    async handleSaveProfile(btnElement) {
        // Fallback jika dipanggil tanpa parameter (misal dari form onsubmit)
        const btn = btnElement || document.getElementById('btn-save-profile');
        
        const name = document.getElementById('setting-name').value.trim();
        const role = document.getElementById('setting-role').value.trim();
        
        if (!name) return alert("Nama tidak boleh kosong");

        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        btn.disabled = true;

        try {
            await window.SettingsService.updateProfile(name, role);
            alert("Profil berhasil diperbarui!");
        } catch (e) {
            alert("Gagal update: " + e);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    // 2. EXPORT CSV
    async handleExportCSV(btnElement) {
        const btn = btnElement || document.querySelector('button[onclick*="handleExportCSV"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>';
        btn.disabled = true;

        try {
            await window.SettingsService.exportCSV();
        } catch (e) {
            alert("Gagal export: " + e);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    // 3. EXPORT JSON
    async handleExportJSON(btnElement) {
        try {
            await window.SettingsService.exportJSON();
        } catch (e) { alert("Error: " + e); }
    },

    // 4. IMPORT JSON
    async handleImport(btnElement) {
        const fileInput = document.getElementById('import-file');
        const file = fileInput.files[0];
        
        if (!file) return alert("Pilih file backup (.json) dulu.");
        if (!confirm("PERINGATAN: Data lama akan ditimpa dengan data baru. Lanjutkan?")) return;

        // Visual loading di tombol upload
        const btn = btnElement || document.querySelector('button[onclick*="handleImport"]');
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        btn.disabled = true;

        try {
            await window.SettingsService.importData(file);
            alert("Data berhasil dipulihkan!");
            location.reload(); 
        } catch (e) {
            alert(e);
            btn.innerHTML = originalIcon;
            btn.disabled = false;
        } finally {
            fileInput.value = '';
        }
    },

    // 5. RESET
    async handleReset() { 
        if(!confirm("BAHAYA! Yakin hapus SEMUA data? Aplikasi kembali kosong.")) return;
        try {
            await window.SettingsService.resetData();
            alert("Aplikasi telah di-reset.");
            location.reload();
        } catch (e) {
            alert("Gagal reset: " + e);
        }
    }
};

window.SettingsView.init();
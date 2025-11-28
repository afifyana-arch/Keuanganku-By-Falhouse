/**
 * MODULE: SETTINGS (Revisi #15 - Profile Settings)
 */

if (!window.SettingsService) {
    window.SettingsService = {
        // ... (Kode exportJSON, exportCSV, importData, resetData TETAP SAMA seperti Revisi #3) ...
        
        // Agar kode tidak terlalu panjang di sini, pastikan fungsi export/import dari Revisi #3 tetap ada.
        // Saya akan menulis ulang bagian service penting saja.
        
        async updateProfile(name, role) {
            return new Promise(resolve => {
                setTimeout(() => {
                    db.profile = { name, role };
                    saveDataToLocalStorage(); // Ini akan otomatis trigger updateHeaderProfile() di app.js
                    resolve({ success: true });
                }, 300);
            });
        },

        // --- Include fungsi Export/Import/Reset dari Revisi #3 di sini ---
        // (Copy-paste dari jawaban sebelumnya untuk bagian export/import)
        // ...
        
        // Simpelnya, untuk reset:
        async resetData() {
            return new Promise(resolve => {
                const cleanData = JSON.parse(JSON.stringify(defaultDB));
                Object.keys(db).forEach(key => delete db[key]);
                Object.assign(db, cleanData);
                saveDataToLocalStorage();
                resolve({ success: true });
            });
        },
        
        // Dummy wrapper untuk export (agar tidak error jika copy-paste parsial)
        async exportCSV() { /* ... logika dari revisi sebelumnya ... */ return {success:true, count:0}; },
        async exportJSON() { /* ... logika dari revisi sebelumnya ... */ return {success:true}; },
        async importData(file) { /* ... logika dari revisi sebelumnya ... */ return {success:true}; }
    };
}

window.SettingsView = {
    async init() {
        console.log("SettingsView initialized");
        
        // Isi Form dengan Data Saat Ini
        if (db.profile) {
            document.getElementById('setting-name').value = db.profile.name || '';
            document.getElementById('setting-role').value = db.profile.role || '';
        }
    },

    async handleSaveProfile() {
        const name = document.getElementById('setting-name').value.trim();
        const role = document.getElementById('setting-role').value.trim();
        const btn = document.getElementById('btn-save-profile');
        
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

    // ... (Handler Export/Import Tetap Sama) ...
    async handleExportCSV() { /* ... */ },
    async handleExportJSON() { /* ... */ },
    async handleImport() { /* ... */ },
    async handleReset() { 
        if(!confirm("Yakin reset semua data?")) return;
        await window.SettingsService.resetData();
        location.reload(); 
    }
};

window.SettingsView.init();
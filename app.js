// =======================================================
// CORE APPLICATION (GLOBAL STATE & ROUTER)
// =======================================================

// --- 1. GLOBAL STATE ---
const defaultDB = {
    // Tambahkan Default Profile
    profile: {
        name: 'User',
        role: 'Owner'
    },
    accounts: [
        { id: 1, name: 'Tunai', balance: 0, icon: 'bi-cash' },
        { id: 2, name: 'Rekening Bank (BCA)', balance: 0, icon: 'bi-bank' }
    ],
    transactions: [],
    budgets: {}, 
    savings: [],
    debts: [] 
};

let db = JSON.parse(JSON.stringify(defaultDB));

// --- 2. GLOBAL HELPERS ---

function loadDataFromLocalStorage() {
    const data = localStorage.getItem('keuangankuDB');
    if (data) {
        try {
            db = JSON.parse(data);
            // Migrasi: Pastikan field profile ada jika data lama belum punya
            if (!db.profile) db.profile = { name: 'Afif Shafly', role: 'Owner' };
            if (!db.savings) db.savings = [];
            if (!db.debts) db.debts = [];
        } catch (e) {
            console.error("Data error, reset to default", e);
            db = JSON.parse(JSON.stringify(defaultDB));
        }
    }
}

function saveDataToLocalStorage() {
    localStorage.setItem('keuangankuDB', JSON.stringify(db));
    // Update tampilan header setiap kali simpan (jika nama berubah)
    updateHeaderProfile(); 
}

// Fungsi Baru: Update Tampilan Nama di Header
function updateHeaderProfile() {
    const elName = document.getElementById('header-user-name');
    const elRole = document.getElementById('header-user-role');
    
    if (elName && db.profile) elName.textContent = db.profile.name;
    if (elRole && db.profile) elRole.textContent = db.profile.role;
}

// ... (Fungsi formatCurrency, unformatNumberInput, dll TETAP SAMA seperti sebelumnya) ...
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0 
    }).format(amount).replace('Rp', 'Rp ');
}

function unformatNumberInput(value) {
    if (!value) return '';
    return value.replace(/\./g, '');
}

function formatNumberInput(value) {
    if (!value) return '';
    const num = value.replace(/\D/g, '');
    if(num === '') return '';
    return new Intl.NumberFormat('id-ID').format(num);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('id-ID', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
}

// --- 3. ROUTER / FRAGMENT SYSTEM ---

async function loadFragment(fragmentName) {
    const container = document.getElementById('fragment-container');
    const pageTitle = document.getElementById('page-title');
    
    document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.querySelector(`.sidebar-link[onclick="loadFragment('${fragmentName}')"]`);
    if (activeLink) activeLink.classList.add('active');

    pageTitle.textContent = fragmentName.charAt(0).toUpperCase() + fragmentName.slice(1).replace('-', ' ');

    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if(sidebar) sidebar.classList.remove('active');
    if(overlay) overlay.classList.remove('active');

    try {
        const response = await fetch(`${fragmentName}.html`);
        if (!response.ok) throw new Error(`Gagal memuat ${fragmentName}.html`);
        const html = await response.text();
        container.innerHTML = html;

        const oldScript = document.getElementById('fragment-script');
        if (oldScript) oldScript.remove();

        const script = document.createElement('script');
        script.src = `${fragmentName}.js`;
        script.id = 'fragment-script';
        document.body.appendChild(script);

    } catch (error) {
        container.innerHTML = `<div class="alert alert-danger m-4">Error: ${error.message}</div>`;
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

// --- 4. INIT APP ---
document.addEventListener('DOMContentLoaded', () => {
    loadDataFromLocalStorage();
    
    // Set Nama di Header saat pertama kali buka
    updateHeaderProfile();
    
    // Set Tanggal di Header
    const dateDisplay = document.getElementById('current-date-display');
    if(dateDisplay) {
        const now = new Date();
        dateDisplay.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    loadFragment('dashboard');
    
    document.body.addEventListener('input', (e) => {
        if (e.target.matches('[data-currency-input="true"]')) {
            let value = e.target.value;
            let cleanValue = unformatNumberInput(value);
            if (cleanValue.match(/[^0-9]/g)) cleanValue = cleanValue.replace(/\D/g, '');
            if(cleanValue === '') { e.target.value = ''; return; }
            const num = parseInt(cleanValue, 10);
            e.target.value = formatNumberInput(num.toString());
        }
    });
});
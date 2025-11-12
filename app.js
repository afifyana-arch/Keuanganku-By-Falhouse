// =========================================
// === 1. STATE APLIKASI & INISIALISASI  ===
// =========================================

// === STATE GLOBAL ===
const defaultDB = {
    accounts: [
        { id: 1, name: 'Tunai', balance: 0, icon: 'bi-cash' },
        { id: 2, name: 'Rekening Bank (BCA)', balance: 0, icon: 'bi-bank' }
    ],
    transactions: [],
    budgets: {}, 
    savings: [],
    debts: [] 
};

let db; 
let editState = { active: false, txId: null };
let editAccountState = { active: false, accountId: null };
let expenseChartInstance = null;
let incomeChartInstance = null;
let currentSavingGoalId = null;
let addSavingsModal = null;
let payDebtModal = null; 
let currentDebtPaymentId = null; 
let accountModal = null; 
let spendSavingsModal = null; 
let currentSpendGoalId = null; 

// Daftar Ikon Kategori untuk Konsistensi UI Budget
const CATEGORY_ICONS = {
    "Makanan": "bi-cup-hot-fill",
    "Transportasi": "bi-bus-front-fill",
    "Tagihan": "bi-lightning-charge-fill",
    "Hiburan": "bi-controller",
    "Belanja": "bi-bag-fill",
    "Tabungan": "bi-piggy-bank-fill",
    "Bayar Hutang": "bi-cash-coin",
    "Lainnya": "bi-three-dots",
    "Gaji": "bi-briefcase-fill",
    "Bonus": "bi-gift-fill",
    "Freelance": "bi-code-slash",
    "Hadiah": "bi-balloon-heart-fill",
    "Hasil Tabungan": "bi-box-arrow-in-down-right",
    "Pinjaman": "bi-wallet-fill" // Mengganti ikon agar lebih jelas
};


// === FUNGSI DATA STORAGE & MIGRASI ===
function loadDataFromLocalStorage() {
    const data = localStorage.getItem('keuangankuDB');
    if (!data) {
        db = JSON.parse(JSON.stringify(defaultDB)); // Deep copy
        return;
    }
    try {
        db = JSON.parse(data);
        
        // --- LOGIKA MIGRASI DATA (DIJAGA KONSISTEN) ---
        if (db.accounts && db.accounts.length > 0 && !db.accounts[0].icon) {
            console.warn("Migrasi data: Menambahkan ikon default ke akun lama.");
            db.accounts.forEach(account => {
                const nameLower = account.name.toLowerCase();
                if (nameLower.includes('bank') || nameLower.includes('bca')) {
                    account.icon = 'bi-bank';
                } else if (nameLower.includes('tunai')) {
                    account.icon = 'bi-cash';
                } else if (nameLower.includes('gopay') || nameLower.includes('ovo')) {
                    account.icon = 'bi-phone-fill';
                } else {
                    account.icon = 'bi-wallet2';
                }
            });
        }
        
        if (!db.accounts || db.accounts.length === 0) {
            console.warn("Migrasi data: 'accounts' tidak ditemukan. Membuat akun 'Tunai' default.");
            db.accounts = [{ id: 1, name: 'Tunai', balance: 0, icon: 'bi-cash' }]; 
            db.transactions.forEach(tx => {
                if (tx.type === 'income') {
                    tx.destinationAccountId = 1;
                } else {
                    tx.sourceAccountId = 1;
                }
            });
            console.log("Migrasi data selesai.");
        }
        
        if (db.budgets && Object.keys(db.budgets).length > 0 && !Object.keys(db.budgets).some(k => k.includes('-'))) {
            console.warn("Migrasi data: 'budgets' format lama terdeteksi. Memindahkan ke bulan ini.");
            const currentMonthKey = new Date().toISOString().slice(0, 7); 
            const oldBudgets = { ...db.budgets }; 
            db.budgets = {}; 
            db.budgets[currentMonthKey] = oldBudgets; 
            console.log("Migrasi budget selesai.");
        } else if (!db.budgets) {
            db.budgets = {}; 
        }

        if (!db.transactions) db.transactions = [];
        if (!db.savings) db.savings = [];
        if (!db.debts) db.debts = []; 

    } catch (e) {
        console.error("Gagal memuat localStorage, data di-reset:", e);
        db = JSON.parse(JSON.stringify(defaultDB));
    }
}

function saveDataToLocalStorage() {
    localStorage.setItem('keuangankuDB', JSON.stringify(db));
}

// === PENYIMPANAN ELEMEN DOM ===
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarOverlay = document.querySelector('.sidebar-overlay');
const allNavLinks = document.querySelectorAll('.sidebar-link');
const allAppViews = document.querySelectorAll('.app-view');
const pageTitle = document.getElementById('page-title');
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const currentBalanceEl = document.getElementById('current-balance');
const recentTransactionsTable = document.getElementById('recent-transactions-table');
const transactionForm = document.getElementById('transaction-form');
const trackingViewTitle = document.getElementById('tracking-view-title'); 
const btnSubmitTransaction = document.getElementById('btn-submit-transaction'); 
const btnCancelEdit = document.getElementById('btn-cancel-edit'); 
// [DIHAPUS] const transactionTypeSelect = document.getElementById('transaction-type');

// [BARU] Elemen untuk Form Tipe Transaksi Baru
const txTypeSelector = document.getElementById('tx-type-selector');
const txTypeButtons = document.querySelectorAll('#tx-type-selector .nav-link');
const txSwitchPaylaterWrapper = document.getElementById('tx-switch-paylater-wrapper');
const txSwitchPaylater = document.getElementById('tx-switch-paylater');
const txSwitchDebtWrapper = document.getElementById('tx-switch-debt-wrapper');
const txSwitchDebt = document.getElementById('tx-switch-debt');


const categoryWrapper = document.getElementById('category-wrapper');
const categoryIncomeWrapper = document.getElementById('category-income-wrapper'); 
const sourceAccountWrapper = document.getElementById('source-account-wrapper');
const destinationAccountWrapper = document.getElementById('destination-account-wrapper');
const sourceAccountInput = document.getElementById('source-account');
const destinationAccountInput = document.getElementById('destination-account');
const amountInput = document.getElementById('amount');
const categoryInput = document.getElementById('category'); 
const categoryIncomeInput = document.getElementById('category-income'); 
const descriptionInput = document.getElementById('description');
const dateInput = document.getElementById('date');
const checkAddAnother = document.getElementById('check-add-another');

const debtDetailsWrapper = document.getElementById('debt-details-wrapper');
const debtLenderInput = document.getElementById('debt-lender');
const debtDueDateInput = document.getElementById('debt-due-date');
const debtTenorInput = document.getElementById('debt-tenor');
const expenseDebtWrapper = document.getElementById('expense-debt-wrapper');
const expenseSelectDebt = document.getElementById('expense-select-debt');

const budgetForm = document.getElementById('budget-form');
const budgetCategoryInput = document.getElementById('budget-category');
const budgetAmountInput = document.getElementById('budget-amount'); 
const budgetList = document.getElementById('budget-list');
const budgetMonthSelect = document.getElementById('budget-month-select'); 
const budgetMonthDisplay = document.getElementById('budget-month-display'); 
const btnCopyLastMonth = document.getElementById('btn-copy-last-month'); 
const searchHistoryInput = document.getElementById('search-history');
const historyTransactionsTable = document.getElementById('history-transactions-table');
const historyTransactionsCards = document.getElementById('history-transactions-cards'); 
const historyFilterType = document.getElementById('history-filter-type'); 
const historyFilterAccount = document.getElementById('history-filter-account'); 
const historyFilterDateStart = document.getElementById('history-filter-date-start'); 
const historyFilterDateEnd = document.getElementById('history-filter-date-end'); 
const savingsGoalForm = document.getElementById('savings-goal-form');
const goalNameInput = document.getElementById('goal-name');
const goalTargetInput = document.getElementById('goal-target');
const goalIconInput = document.getElementById('goal-icon');
const savingsGoalList = document.getElementById('savings-goal-list');
const addSavingsForm = document.getElementById('add-savings-form');
const modalGoalName = document.getElementById('modal-goal-name');
const modalSavingsAmount = document.getElementById('modal-savings-amount');
const modalSavingsSourceAccountInput = document.getElementById('modal-savings-source-account');
const btnAddSavings = document.getElementById('btn-add-savings');
const debtList = document.getElementById('debt-list'); 
const btnAddSpendSavings = document.getElementById('btn-spend-savings');
const modalSpendGoalName = document.getElementById('modal-spend-goal-name');
const modalSpendGoalCurrent = document.getElementById('modal-spend-goal-current');
const modalSpendAmount = document.getElementById('modal-spend-amount');
const modalSpendDestinationAccountInput = document.getElementById('modal-spend-destination-account');
const btnSpendUseAll = document.getElementById('btn-spend-use-all');
const payDebtForm = document.getElementById('pay-debt-form');
const modalDebtLender = document.getElementById('modal-debt-lender');
const modalDebtRemaining = document.getElementById('modal-debt-remaining');
const modalDebtSourceAccountInput = document.getElementById('modal-debt-source-account');
const modalDebtPaymentAmount = document.getElementById('modal-debt-payment-amount');
const btnAddDebtPayment = document.getElementById('btn-add-debt-payment');

const accountForm = document.getElementById('account-form');
const accountModalTitle = document.getElementById('account-modal-title'); 
const accountIdEditInput = document.getElementById('account-id-edit');
const accountNameInput = document.getElementById('account-name');
const accountIconInput = document.getElementById('account-icon'); 
const accountInitialBalanceInput = document.getElementById('account-initial-balance');
const btnSubmitAccount = document.getElementById('btn-submit-account');
const btnCancelAccountEdit = document.getElementById('btn-cancel-account-edit');
const accountsListContainer = document.getElementById('accounts-list-container'); 
const btnOpenAccountModal = document.getElementById('btn-open-account-modal'); 

const btnExportData = document.getElementById('btn-export-data');
const btnImportData = document.getElementById('btn-import-data');
const importFileInput = document.getElementById('import-file');
const btnClearData = document.getElementById('btn-clear-data');


// === FUNGSI INISIALISASI UTAMA (INIT) ===
function init() {
    loadDataFromLocalStorage();
    addSavingsModal = new bootstrap.Modal(document.getElementById('add-savings-modal'));
    payDebtModal = new bootstrap.Modal(document.getElementById('pay-debt-modal')); 
    accountModal = new bootstrap.Modal(document.getElementById('account-modal')); 
    spendSavingsModal = new bootstrap.Modal(document.getElementById('spend-savings-modal')); 

    dateInput.valueAsDate = new Date();
    debtDueDateInput.valueAsDate = new Date(); 
    debtTenorInput.value = 1; 
    
    budgetMonthSelect.value = new Date().toISOString().slice(0, 7);

    const expenseCategories = ["Makanan", "Transportasi", "Tagihan", "Hiburan", "Belanja", "Tabungan", "Bayar Hutang", "Lainnya"];
    budgetCategoryInput.innerHTML = expenseCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');

    masterUpdateUI();
    
    // Listener Navigasi
    allNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetViewId = e.currentTarget.getAttribute('data-target-view');
            switchView(targetViewId);
        });
    });
    
    // Listener Sidebar & Overlay
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
    });
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    });

    // Listener Form
    transactionForm.addEventListener('submit', handleTransactionSubmit);
    budgetForm.addEventListener('submit', handleBudgetSubmit);
    btnCancelEdit.addEventListener('click', resetTransactionForm); 

    // Listener Budget
    budgetMonthSelect.addEventListener('change', () => {
        masterUpdateUI(); 
    });
    btnCopyLastMonth.addEventListener('click', handleCopyLastMonthBudget);
    
    // [MODIFIKASI] Listener 'Catat Transaksi' (Dropdown diganti Tab)
    txTypeSelector.addEventListener('click', (e) => {
        e.preventDefault();
        const clickedTab = e.target.closest('.nav-link');
        if (!clickedTab || clickedTab.classList.contains('active')) return; 
        
        const newType = clickedTab.dataset.txType;

        // Update UI Tab
        txTypeButtons.forEach(btn => btn.classList.remove('active'));
        clickedTab.classList.add('active');
        
        // Update UI Form
        updateTransactionFormUI(newType);
    });

    // [BARU] Listener untuk Switch PayLater
    txSwitchPaylater.addEventListener('change', () => {
        const isPaylater = txSwitchPaylater.checked;
        sourceAccountWrapper.classList.toggle('hidden', isPaylater);
        debtDetailsWrapper.classList.toggle('hidden', !isPaylater);
        
        sourceAccountInput.required = !isPaylater;
        debtLenderInput.required = isPaylater;
        debtDueDateInput.required = isPaylater;
        debtTenorInput.required = isPaylater;
    });

    // [BARU] Listener untuk Switch Hutang (Pinjaman)
    txSwitchDebt.addEventListener('change', () => {
        const isDebt = txSwitchDebt.checked;
        categoryIncomeWrapper.classList.toggle('hidden', isDebt);
        debtDetailsWrapper.classList.toggle('hidden', !isDebt);

        categoryIncomeInput.required = !isDebt;
        debtLenderInput.required = isDebt;
        debtDueDateInput.required = isDebt;
        debtTenorInput.required = isDebt;
    });
    
    
    // [DIHAPUS] Listener lama untuk transactionTypeSelect
    // transactionTypeSelect.addEventListener('change', (e) => {
    //     updateTransactionFormUI(e.target.value);
    // });
    
    categoryInput.addEventListener('change', (e) => {
        const isDebtPayment = (e.target.value === 'Bayar Hutang');
        expenseDebtWrapper.classList.toggle('hidden', !isDebtPayment);
        expenseSelectDebt.required = isDebtPayment;
        
        if (isDebtPayment) {
            populateActiveDebtsDropdown();
        }
    });
    
    // Listener Filter Riwayat
    searchHistoryInput.addEventListener('input', () => renderHistoryTable());
    historyFilterType.addEventListener('change', () => renderHistoryTable());
    historyFilterAccount.addEventListener('change', () => renderHistoryTable());
    historyFilterDateStart.addEventListener('change', () => renderHistoryTable());
    historyFilterDateEnd.addEventListener('change', () => renderHistoryTable());
    
    // Listener Akun
    btnSubmitAccount.addEventListener('click', handleAccountSubmit); 
    btnOpenAccountModal.addEventListener('click', () => {
        resetAccountForm(); 
        accountModal.show(); 
    });
    btnCancelAccountEdit.addEventListener('click', () => {
        resetAccountForm();
        accountModal.hide(); 
    });

    // ===============================================
    // === OPTIMALISASI 1: DELEGASI EVENT GLOBAL ===
    // ===============================================

    // Listener Format Angka (Delegasi Global)
    document.body.addEventListener('input', (e) => {
        if (e.target.matches('[data-currency-input="true"]')) {
            handleAmountInput(e);
        }
    });

    // Listener global (Dropdown & Tombol Aksi)
    document.body.addEventListener('click', (e) => {
        // Toggle Custom Dropdown
        const selectedDropdown = e.target.closest('.custom-dropdown-selected');
        if (selectedDropdown) {
            const optionsEl = selectedDropdown.nextElementSibling;
            optionsEl.style.display = optionsEl.style.display === 'block' ? 'none' : 'block';
            return; 
        }

        // Tutup semua custom dropdown jika klik di luar
        document.querySelectorAll('.custom-dropdown-options').forEach(optionsEl => {
            if (!optionsEl.parentElement.contains(e.target)) {
                optionsEl.style.display = 'none';
            }
        });

        // Peta Aksi Global (Menggabungkan Edit/Hapus Transaksi/Akun, Open Modals)
        const actionMap = [
            { selector: '.btn-delete', handler: (id) => handleDeleteTransaction(parseInt(id)) },
            { selector: '.btn-edit', handler: (id) => handleEditTransaction(parseInt(id)) },
            { selector: '.btn-open-savings-modal', handler: (id) => openAddSavingsModal(parseInt(id)) },
            { selector: '.btn-open-spend-modal', handler: (id) => openSpendSavingsModal(parseInt(id)) },
            { selector: '.btn-open-pay-debt-modal', handler: (id) => openPayDebtModal(parseInt(id)) },
            { selector: '.btn-edit-account', handler: (id) => handleEditAccount(parseInt(id)) },
            { selector: '.btn-delete-account', handler: (id) => handleDeleteAccount(parseInt(id)) },
        ];

        for (const action of actionMap) {
            const button = e.target.closest(action.selector);
            if (button) {
                e.preventDefault(); 
                const id = button.getAttribute('data-id');
                action.handler(id); 
                return; 
            }
        }
        
        // Tombol Edit/Hapus Budget (Membutuhkan penanganan khusus untuk Dropdown Bootstrap)
        const editBudgetButton = e.target.closest('.btn-edit-budget');
        if(editBudgetButton) {
            const category = editBudgetButton.getAttribute('data-category');
            const amount = parseFloat(editBudgetButton.getAttribute('data-amount'));
            handleEditBudget(category, amount);
            const dropdown = editBudgetButton.closest('.dropdown');
            if (dropdown) bootstrap.Dropdown.getInstance(dropdown.querySelector('.btn')).hide();
            return;
        }
        const deleteBudgetButton = e.target.closest('.btn-delete-budget');
        if(deleteBudgetButton) {
            const month = deleteBudgetButton.getAttribute('data-month');
            const category = deleteBudgetButton.getAttribute('data-category');
            handleDeleteBudget(month, category);
            const dropdown = deleteBudgetButton.closest('.dropdown');
            if (dropdown) bootstrap.Dropdown.getInstance(dropdown.querySelector('.btn')).hide();
            return;
        }
    });
    // ===============================================
    // === AKHIR OPTIMALISASI 1 ======================
    // ===============================================

    // Listener Form Tabungan
    savingsGoalForm.addEventListener('submit', handleSavingsGoalSubmit);
    btnAddSavings.addEventListener('click', handleAddSavingsSubmit);
    
    btnAddSpendSavings.addEventListener('click', handleSpendSavingsSubmit);
    btnSpendUseAll.addEventListener('click', handleSpendUseAll);

    // Listener Pembayaran Hutang (Modal)
    btnAddDebtPayment.addEventListener('click', handlePayDebtSubmit);

    // Listener Pengaturan
    btnExportData.addEventListener('click', handleExportData);
    importFileInput.addEventListener('change', () => {
        btnImportData.disabled = importFileInput.files.length === 0;
    });
    btnImportData.addEventListener('click', handleImportData);
    btnClearData.addEventListener('click', handleClearData);

    // [MODIFIKASI] Panggil `updateTransactionFormUI` dengan tipe default
    updateTransactionFormUI('expense');
}

// =========================================
// === 2. NAVIGASI & UI INTI             ===
// =========================================

function switchView(targetViewId) {
    allAppViews.forEach(view => view.classList.remove('active'));
    const targetView = document.getElementById(targetViewId);
    if (targetView) {
        setTimeout(() => targetView.classList.add('active'), 50);
    }
    allNavLinks.forEach(link => link.classList.remove('active'));
    const targetLink = document.querySelector(`.sidebar-link[data-target-view="${targetViewId}"]`);
    if (targetLink) {
        targetLink.classList.add('active');
        pageTitle.textContent = targetLink.textContent.trim();
    }
    if (targetViewId !== 'tracking-view' && editState.active) {
        resetTransactionForm();
    }
    
    if (targetViewId !== 'accounts-view' && editAccountState.active) {
        resetAccountForm();
    }
    
    if (window.innerWidth < 992) {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    }
    
    // [BARU] Auto-fokus ke input jumlah saat pindah ke view tracking
    if (targetViewId === 'tracking-view') {
        setTimeout(() => amountInput.focus(), 100);
    }
}

// ========================================================
// === [FUNGSI YANG DIGANTI TOTAL] updateTransactionFormUI ===
// ========================================================
function updateTransactionFormUI(type) {
    // 1. Sembunyikan semua wrapper kustom
    sourceAccountWrapper.classList.add('hidden');
    destinationAccountWrapper.classList.add('hidden');
    categoryWrapper.classList.add('hidden');
    categoryIncomeWrapper.classList.add('hidden');
    expenseDebtWrapper.classList.add('hidden');
    debtDetailsWrapper.classList.add('hidden');
    
    // 2. Sembunyikan semua wrapper switch
    txSwitchPaylaterWrapper.classList.remove('active');
    txSwitchDebtWrapper.classList.remove('active');

    // 3. Reset semua 'required'
    sourceAccountInput.required = false;
    destinationAccountInput.required = false;
    categoryInput.required = false;
    categoryIncomeInput.required = false;
    expenseSelectDebt.required = false;
    debtLenderInput.required = false;
    debtDueDateInput.required = false;
    debtTenorInput.required = false;

    // 4. Reset state switch
    txSwitchPaylater.checked = false;
    txSwitchDebt.checked = false;

    // 5. Tampilkan field berdasarkan Tipe Transaksi
    if (type === 'expense') {
        sourceAccountWrapper.classList.remove('hidden');
        categoryWrapper.classList.remove('hidden');
        txSwitchPaylaterWrapper.classList.add('active'); // Tampilkan switch

        sourceAccountInput.required = true;
        categoryInput.required = true;

        // Cek sub-kategori "Bayar Hutang" (logika ini tetap ada)
        if (categoryInput.value === 'Bayar Hutang') {
            expenseDebtWrapper.classList.remove('hidden');
            expenseSelectDebt.required = true;
            populateActiveDebtsDropdown();
        }
    } else if (type === 'income') {
        destinationAccountWrapper.classList.remove('hidden');
        categoryIncomeWrapper.classList.remove('hidden');
        txSwitchDebtWrapper.classList.add('active'); // Tampilkan switch

        destinationAccountInput.required = true;
        categoryIncomeInput.required = true;
    } else if (type === 'transfer') {
        sourceAccountWrapper.classList.remove('hidden');
        destinationAccountWrapper.classList.remove('hidden');

        sourceAccountInput.required = true;
        destinationAccountInput.required = true;
    }
}


// =========================================
// === 3. FUNGSI RENDER & KALKULASI      ===
// =========================================

function masterUpdateUI() {
    recalculateAllDebtBalances();
    recalculateAllAccountBalances(); 
    
    const { totalIncome, totalExpense, currentBalance } = calculateDashboardTotals();
    
    totalIncomeEl.textContent = formatCurrency(totalIncome);
    totalExpenseEl.textContent = formatCurrency(totalExpense);
    currentBalanceEl.textContent = formatCurrency(currentBalance);
    
    populateAccountDropdowns(); 
    renderAccountsList(); 
    
    renderRecentTransactionTable();
    renderHistoryTable(); 
    
    updateBudgetList();
    
    renderExpenseChart();
    renderIncomeExpenseChart(totalIncome, totalExpense);
    renderSavingsGoals();
    
    renderDebtList(); 
}

function recalculateAllAccountBalances() {
    if (!db.accounts) db.accounts = [];
    if (!db.transactions) db.transactions = [];

    db.accounts.forEach(account => {
        account.balance = 0;
    });

    db.transactions.forEach(tx => {
        try {
            if (tx.type === 'income' && tx.destinationAccountId) {
                const account = db.accounts.find(a => a.id === tx.destinationAccountId);
                if (account) account.balance += tx.amount;
            } 
            else if ((tx.type === 'expense' || tx.type === 'debt_expense') && tx.sourceAccountId) { 
                const account = db.accounts.find(a => a.id === tx.sourceAccountId);
                if (account) account.balance -= tx.amount;
            } 
            else if (tx.type === 'transfer') {
                const sourceAccount = db.accounts.find(a => a.id === tx.sourceAccountId);
                const destAccount = db.accounts.find(a => a.id === tx.destinationAccountId);
                if (sourceAccount) sourceAccount.balance -= tx.amount;
                if (destAccount) destAccount.balance += tx.amount;
            }
        } catch(e) {
            console.error("Gagal memproses transaksi:", tx, e);
        }
    });

    saveDataToLocalStorage();
}

function recalculateAllDebtBalances() {
    if (!db.debts) db.debts = [];
    if (!db.transactions) db.transactions = [];

    db.debts.forEach(debt => {
        let totalPayments = 0;
        
        db.transactions.forEach(tx => {
            if (tx.linkedDebtId === debt.id && (tx.type === 'expense' || tx.type === 'debt_expense')) {
                totalPayments += tx.amount;
            }
        });
        
        debt.remainingAmount = debt.totalAmount - totalPayments;
    });
}

function calculateDashboardTotals() {
    let totalIncome = 0;
    let totalExpense = 0;
    
    if (!db.transactions) db.transactions = [];

    db.transactions.forEach(tx => {
        if (tx.type === 'income') {
            totalIncome += tx.amount;
        } else if (tx.type === 'expense' || tx.type === 'debt_expense') {
            totalExpense += tx.amount;
        }
    });
    
    const currentBalance = db.accounts.reduce((sum, account) => sum + account.balance, 0);
    
    return { totalIncome, totalExpense, currentBalance };
}

function renderRecentTransactionTable() {
    if (!db.transactions || db.transactions.length === 0) {
        recentTransactionsTable.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-muted">Belum ada transaksi</td></tr>`; return;
    }
    recentTransactionsTable.innerHTML = ''; 
    const recentTransactions = [...db.transactions].reverse().slice(0, 5);
    
    recentTransactions.forEach(tx => { 
        const tr = createHistoryTableRow(tx, true); 
        recentTransactionsTable.appendChild(tr); 
    });
}

function renderHistoryTable() {
    if (!db.transactions) db.transactions = [];

    const tableBody = document.getElementById('history-transactions-table');
    const cardsContainer = document.getElementById('history-transactions-cards');

    // 2. Ambil Filter
    const searchText = searchHistoryInput.value.toLowerCase();
    const filterType = historyFilterType.value;
    const filterAccount = historyFilterAccount.value;
    const filterDateStart = historyFilterDateStart.value;
    const filterDateEnd = historyFilterDateEnd.value;

    // 3. Proses Filter
    let filteredTransactions = [...db.transactions].reverse();

    if (searchText) {
        filteredTransactions = filteredTransactions.filter(tx =>
            (tx.description && tx.description.toLowerCase().includes(searchText)) ||
            (tx.category && tx.category.toLowerCase().includes(searchText))
        );
    }
    if (filterType !== 'all') {
        if (filterType === 'expense') {
            filteredTransactions = filteredTransactions.filter(tx => tx.type === 'expense' || tx.type === 'debt_expense');
        } else {
            filteredTransactions = filteredTransactions.filter(tx => tx.type === filterType);
        }
    }
    
    if (filterAccount !== 'all') {
        const accountId = parseInt(filterAccount);
        filteredTransactions = filteredTransactions.filter(tx =>
            tx.sourceAccountId === accountId || tx.destinationAccountId === accountId
        );
    }

    if (filterDateStart) {
        filteredTransactions = filteredTransactions.filter(tx => tx.date >= filterDateStart);
    }
    if (filterDateEnd) {
        filteredTransactions = filteredTransactions.filter(tx => tx.date <= filterDateEnd);
    }

    // 4. Kosongkan Tampilan
    tableBody.innerHTML = '';
    cardsContainer.innerHTML = '';

    // 5. Render atau Tampilkan Pesan Kosong
    if (filteredTransactions.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-muted">Tidak ada transaksi ditemukan sesuai filter</td></tr>`;
        cardsContainer.innerHTML = '<div class="card shadow-sm"><div class="card-body text-center p-4 text-muted">Tidak ada transaksi ditemukan sesuai filter.</div></div>';
        return;
    }
    
    // 6. Loop dan Render Kedua Tampilan (Menggunakan Helper Konsisten)
    filteredTransactions.forEach(tx => {
        tableBody.appendChild(createHistoryTableRow(tx));
        cardsContainer.appendChild(createHistoryCard(tx));
    });
}

function updateBudgetList() {
    const selectedMonth = budgetMonthSelect.value; 
    
    const monthDate = new Date(selectedMonth + "-02T00:00:00"); 
    const monthYearString = monthDate.toLocaleString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    budgetMonthDisplay.textContent = monthYearString;
    
    const monthlyBudgets = db.budgets[selectedMonth] || {};
    const categoriesInBudget = Object.keys(monthlyBudgets).filter(cat => monthlyBudgets[cat] > 0);

    const lastMonthKey = getLastMonthKey(selectedMonth);
    const hasLastMonthBudget = db.budgets[lastMonthKey] && Object.keys(db.budgets[lastMonthKey]).length > 0;
    
    if (categoriesInBudget.length === 0) {
        budgetList.innerHTML = `<div class="col-12"><div class="card shadow-sm"><div class="card-body text-center p-4 text-muted">Belum ada budget yang diatur untuk ${monthYearString}.</div></div></div>`;
        
        if (hasLastMonthBudget) {
            btnCopyLastMonth.style.display = 'block';
        } else {
            btnCopyLastMonth.style.display = 'none';
        }
        return;
    }

    btnCopyLastMonth.style.display = 'none';
    budgetList.innerHTML = ''; 
    
    for (const category of categoriesInBudget) {
        const budgetAmount = monthlyBudgets[category];
        const categoryIcon = CATEGORY_ICONS[category] || 'bi-bookmark-fill'; 
        
        const spentAmount = db.transactions
            .filter(tx => 
                (tx.type === 'expense' || tx.type === 'debt_expense') && 
                tx.category === category && 
                tx.date.startsWith(selectedMonth)
            )
            .reduce((sum, tx) => sum + tx.amount, 0);
        
        const remainingAmount = budgetAmount - spentAmount;
        const percentage = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;
        
        // Kelas warna progress bar
        let progressBarClass = 'bg-success';
        if (percentage > 75 && percentage < 100) progressBarClass = 'bg-warning';
        if (percentage >= 100) progressBarClass = 'bg-danger';
        
        const displayPercentage = percentage.toFixed(0);
        
        const budgetCard = `
            <div class="col-md-6 col-lg-4">
                <div class="card shadow-sm mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between mb-1 align-items-start">
                            <h5 class="card-title mb-0 d-flex align-items-center">
                                <i class="bi ${categoryIcon} me-2" style="color: var(--sidebar-link-active);"></i>
                                ${category}
                            </h5>
                            
                            <div class="dropdown">
                                <button class="btn btn-sm btn-action-soft" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Aksi">
                                    <i class="bi bi-three-dots-vertical"></i>
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end">
                                    <li><a class="dropdown-item btn-edit-budget" href="#" 
                                        data-month="${selectedMonth}" 
                                        data-category="${category}" 
                                        data-amount="${budgetAmount}">Edit Budget</a></li>
                                    <li><a class="dropdown-item text-danger btn-delete-budget" href="#" 
                                        data-month="${selectedMonth}" 
                                        data-category="${category}">Hapus Budget</a></li>
                                </ul>
                            </div>
                            </div>
                        
                        <div class="d-flex justify-content-between">
                            <small class="text-muted">Sisa: ${formatCurrency(remainingAmount)}</small>
                            <span class="fw-bold">${formatCurrency(spentAmount)} / ${formatCurrency(budgetAmount)}</span>
                        </div>

                        <div class="progress mt-2" role="progressbar" style="height: 20px;">
                            <div class="progress-bar ${progressBarClass}" style="width: ${Math.min(percentage, 100)}%" title="${displayPercentage}%">
                                ${displayPercentage}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        budgetList.innerHTML += budgetCard;
    }
}


// --- Chart Renderers (Tetap Sama) ---
function renderExpenseChart() {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (!db.transactions) db.transactions = [];
    
    const expenseData = db.transactions
        .filter(tx => tx.type === 'expense' || tx.type === 'debt_expense') 
        .reduce((acc, tx) => {
            const category = tx.category || 'Lainnya';
            if (!acc[category]) { acc[category] = 0; }
            acc[category] += tx.amount; return acc;
        }, {});
    
    const labels = Object.keys(expenseData); const data = Object.values(expenseData);
    if (expenseChartInstance) { expenseChartInstance.destroy(); }
    
    expenseChartInstance = new Chart(ctx, {
        type: 'doughnut', data: { labels: labels, datasets: [{ label: 'Pengeluaran', data: data, backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E74C3C'], }] },
        options: { responsive: true, plugins: { legend: { position: 'top', } } }
    });
}

function renderIncomeExpenseChart(totalIncome, totalExpense) {
    const ctx = document.getElementById('incomeExpenseChart').getContext('2d');
    if (incomeChartInstance) { incomeChartInstance.destroy(); }
    incomeChartInstance = new Chart(ctx, {
        type: 'bar', data: { labels: ['Ringkasan Finansial'], datasets: [
                { label: 'Pemasukan', data: [totalIncome], backgroundColor: 'rgba(75, 192, 192, 0.6)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1 },
                { label: 'Pengeluaran', data: [totalExpense], backgroundColor: 'rgba(255, 99, 132, 0.6)', borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 1 }
            ] },
        options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'top', } } }
    });
}

// =========================================
// === 4. EVENT HANDLERS (TRANSAKSI & BUDGET) ===
// =========================================

// ========================================================
// === [FUNGSI YANG DIGANTI TOTAL] handleTransactionSubmit ===
// ========================================================
function handleTransactionSubmit(e) {
    e.preventDefault();
    
    // 1. Dapatkan tipe dasar dari tab yang aktif
    const activeTab = document.querySelector('#tx-type-selector .nav-link.active');
    const type = activeTab.dataset.txType; // "expense", "income", atau "transfer"
    
    // 2. Dapatkan data umum
    const amount = parseFloat(unformatNumberInput(amountInput.value));
    let description = descriptionInput.value.trim(); 
    const date = dateInput.value;
    
    // 3. Siapkan variabel untuk disimpan
    let txTypeForSave; 
    let category; 
    let sourceAccountId = null, destinationAccountId = null;
    let linkedDebtId = null; 
    let debtLender = null, debtDueDate = null, debtTenor = null; 

    if (isNaN(amount) || amount <= 0) {
        alert('Jumlah harus berupa angka positif.'); return;
    }

    // 4. Logika berdasarkan Tipe Tab dan Switch
    if (type === 'expense') {
        if (txSwitchPaylater.checked) {
            // --- Ini adalah PAYLATER ---
            txTypeForSave = 'expense';
            sourceAccountId = null; // Kunci PayLater
            category = categoryInput.value;
            debtLender = debtLenderInput.value.trim();
            debtDueDate = debtDueDateInput.value;
            debtTenor = parseInt(debtTenorInput.value) || 1;
            description = description ? `${description} (via ${debtLender})` : `${category} (via ${debtLender})`;
            
            if (!category || !debtLender || !debtDueDate) {
                alert('Kategori, Penyedia, dan Jatuh Tempo harus diisi untuk PayLater.'); return;
            }

        } else {
            // --- Ini adalah EXPENSE BIASA ---
            txTypeForSave = 'expense';
            sourceAccountId = parseInt(sourceAccountInput.value);
            category = categoryInput.value;
            if (isNaN(sourceAccountId)) { alert('Pilih Akun Sumber.'); return; }

            if (category === 'Bayar Hutang') {
                txTypeForSave = 'debt_expense'; // Tandai sebagai bayar hutang
                linkedDebtId = parseInt(expenseSelectDebt.value);
                if (isNaN(linkedDebtId)) {
                    alert('Pilih hutang yang ingin Anda bayar.'); return;
                }
            }
        }
    } else if (type === 'income') {
        if (txSwitchDebt.checked) {
            // --- Ini adalah PINJAMAN (DEBT) ---
            txTypeForSave = 'income';
            category = 'Pinjaman'; // Kategori otomatis
            destinationAccountId = parseInt(destinationAccountInput.value);
            debtLender = debtLenderInput.value.trim();
            debtDueDate = debtDueDateInput.value;
            debtTenor = parseInt(debtTenorInput.value) || 1;
            description = description || `Pinjaman dari ${debtLender}`;

            if (isNaN(destinationAccountId) || !debtLender || !debtDueDate) {
                alert('Akun Tujuan, Pemberi Pinjaman, dan Jatuh Tempo harus diisi.'); return;
            }

        } else {
            // --- Ini adalah INCOME BIASA ---
            txTypeForSave = 'income';
            destinationAccountId = parseInt(destinationAccountInput.value);
            category = categoryIncomeInput.value;
            if (isNaN(destinationAccountId)) { alert('Pilih Akun Tujuan.'); return; }
        }
    } else if (type === 'transfer') {
        txTypeForSave = 'transfer';
        sourceAccountId = parseInt(sourceAccountInput.value);
        destinationAccountId = parseInt(destinationAccountInput.value);
        category = 'Transfer';
        if (isNaN(sourceAccountId) || isNaN(destinationAccountId)) { alert('Pilih Akun Sumber dan Tujuan.'); return; }
        if (sourceAccountId === destinationAccountId) { alert('Akun Sumber dan Tujuan tidak boleh sama.'); return; }
    }
    
    // --- Data Transaksi yang Akan Disimpan ---
    const transactionData = { 
        type: txTypeForSave,
        amount: amount, 
        category, 
        description, 
        date, 
        sourceAccountId, 
        destinationAccountId,
        linkedDebtId 
    };

    if (editState.active) {
        // --- Update Transaksi ---
        const index = db.transactions.findIndex(tx => tx.id === editState.txId);
        if (index > -1) {
            // Pertahankan linkedDebtId jika ada (khususnya saat edit Bayar Hutang)
            const oldLinkedDebtId = db.transactions[index].linkedDebtId || null;
            transactionData.linkedDebtId = transactionData.linkedDebtId || oldLinkedDebtId;
            
            db.transactions[index] = { ...db.transactions[index], ...transactionData };
            alert('Transaksi berhasil diperbarui!');
        }
    } else {
        // --- Buat Transaksi Baru ---
        
        // Cek apakah ini transaksi yang membuat data hutang baru
        if ((type === 'expense' && txSwitchPaylater.checked) || (type === 'income' && txSwitchDebt.checked)) {
            const newDebt = {
                id: Date.now() + 1, 
                lender: debtLender,
                totalAmount: amount, 
                remainingAmount: amount, // Sisa hutang awal = jumlah total
                dueDate: debtDueDate,
                tenor: debtTenor, 
                description: (type === 'expense') ? `Tagihan ${debtLender} (${category})` : `Pinjaman dari ${debtLender}`,
                isPaid: false
            };
            db.debts.push(newDebt);
        }
        
        const newTransaction = { id: Date.now(), ...transactionData };
        db.transactions.push(newTransaction);
        
        if (!checkAddAnother.checked) {
            alert('Transaksi berhasil disimpan!');
        }
    }

    saveDataToLocalStorage(); 
    masterUpdateUI();         
    
    if (checkAddAnother.checked) {
        amountInput.value = '';
        descriptionInput.value = '';
        amountInput.focus();
    } else {
        resetTransactionForm();   
        switchView('dashboard-view'); 
    }
}


function handleBudgetSubmit(e) {
    e.preventDefault();
    const category = budgetCategoryInput.value;
    const amount = parseFloat(unformatNumberInput(budgetAmountInput.value));
    
    const selectedMonth = budgetMonthSelect.value; 

    if (isNaN(amount) || amount < 0) {
        alert('Jumlah budget harus berupa angka positif.'); return;
    }
    
    if (!db.budgets[selectedMonth]) {
        db.budgets[selectedMonth] = {};
    }
    
    db.budgets[selectedMonth][category] = amount;
    
    saveDataToLocalStorage();
    masterUpdateUI(); 
    budgetAmountInput.value = ''; 
    
    const monthDate = new Date(selectedMonth + "-02T00:00:00");
    const monthYearString = monthDate.toLocaleString('id-ID', { month: 'long', timeZone: 'UTC' });
    alert(`Budget untuk ${category} di bulan ${monthYearString} berhasil diatur!`);
}

function handleCopyLastMonthBudget() {
    const selectedMonth = budgetMonthSelect.value;
    const lastMonthKey = getLastMonthKey(selectedMonth);

    const lastMonthBudget = db.budgets[lastMonthKey];
    
    if (!lastMonthBudget || Object.keys(lastMonthBudget).length === 0) {
        alert('Tidak ditemukan data budget di bulan lalu.');
        return;
    }
    
    const lastMonthDate = new Date(lastMonthKey + "-02T00:00:00");
    const lastMonthString = lastMonthDate.toLocaleString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    if (confirm(`Anda yakin ingin menyalin ${Object.keys(lastMonthBudget).length} kategori budget dari ${lastMonthString}?`)) {
        db.budgets[selectedMonth] = JSON.parse(JSON.stringify(lastMonthBudget));
        saveDataToLocalStorage();
        masterUpdateUI(); 
        alert('Budget bulan lalu berhasil disalin!');
    }
}

function handleDeleteTransaction(txId) {
    if (!confirm('Anda yakin ingin menghapus transaksi ini?')) return;

    const index = db.transactions.findIndex(tx => tx.id === txId);
    if (index > -1) {
        const tx = db.transactions[index];
        // Logika Paylater/Pinjaman yang membuat Hutang
        if ((tx.type === 'expense' && tx.sourceAccountId === null && tx.category !== 'Bayar Hutang') || (tx.type === 'income' && tx.category === 'Pinjaman')) {
            if(confirm('Transaksi ini terkait dengan Hutang/PayLater. Menghapusnya juga akan menghapus data hutang terkait. Lanjutkan?')) {
                // Cari data hutang terkait
                const debtIndex = db.debts.findIndex(d => 
                    (d.totalAmount === tx.amount) && 
                    (d.description.includes(tx.category) || d.description.includes('Pinjaman'))
                );
                if (debtIndex > -1) {
                    db.debts.splice(debtIndex, 1);
                    alert('Data hutang terkait telah dihapus.');
                }
            } else {
                return; 
            }
        }
        
        db.transactions.splice(index, 1);
        saveDataToLocalStorage();
        masterUpdateUI();
    }
}

// ========================================================
// === [FUNGSI YANG DIGANTI TOTAL] handleEditTransaction ===
// ========================================================
function handleEditTransaction(txId) {
    const txToEdit = db.transactions.find(tx => tx.id === txId);
    if (!txToEdit) return;

    // 1. Tentukan Tipe Dasar dan apakah itu PayLater/Debt
    let baseType = txToEdit.type;
    let isPaylater = (txToEdit.type === 'expense' && txToEdit.sourceAccountId === null && txToEdit.category !== 'Bayar Hutang');
    let isDebt = (txToEdit.type === 'income' && txToEdit.category === 'Pinjaman');

    if (isPaylater) {
        baseType = 'expense';
        alert('PERINGATAN!\n\nAnda sedang mengedit transaksi PayLater. Mengubah jumlah akan MENGACAUKAN data sisa hutang.');
    } else if (isDebt) {
        baseType = 'income';
        alert('PERINGATAN!\n\nAnda sedang mengedit transaksi Pinjaman. Mengubah jumlah akan MENGACAUKAN data sisa hutang.');
    } else if (txToEdit.linkedDebtId) {
        baseType = 'expense'; // Tipe aslinya 'debt_expense', tapi tab-nya 'expense'
        alert('PERINGATAN!\n\nAnda sedang mengedit transaksi "Bayar Hutang". Mengubah jumlahnya akan otomatis memperbarui sisa hutang terkait.');
    }

    editState.active = true;
    editState.txId = txId;

    // 2. Klik tab yang benar secara programatik
    // Ini akan memicu listener 'click' dan memanggil `updateTransactionFormUI`
    document.getElementById(`tx-type-${baseType}`).click();

    // 3. Isi form umum
    amountInput.value = formatNumberInput(txToEdit.amount.toString());
    descriptionInput.value = txToEdit.description;
    dateInput.value = txToEdit.date;

    // 4. Isi form spesifik (setelah UI di-update oleh .click())
    if (baseType === 'income') {
        setCustomDropdownValue('destination-account-custom', 'destination-account', txToEdit.destinationAccountId);
        if (isDebt) {
            txSwitchDebt.checked = true;
            // Panggil event 'change' secara manual untuk memicu logika hide/show
            txSwitchDebt.dispatchEvent(new Event('change')); 
            // TODO: Isi detail hutang jika diperlukan (lender, due date, tenor)
            // debtLenderInput.value = ... (perlu cari data debt terkait)
        } else {
            categoryIncomeInput.value = txToEdit.category;
        }
    } else if (baseType === 'expense') {
        categoryInput.value = txToEdit.category;
        if (isPaylater) {
            txSwitchPaylater.checked = true;
            txSwitchPaylater.dispatchEvent(new Event('change')); // Panggil event 'change'
            // TODO: Isi detail hutang jika diperlukan
        } else {
            // Ini untuk expense biasa atau bayar hutang
            setCustomDropdownValue('source-account-custom', 'source-account', txToEdit.sourceAccountId);
            if (txToEdit.category === 'Bayar Hutang' && txToEdit.linkedDebtId) {
                // `updateTransactionFormUI` sudah memanggil `populateActiveDebtsDropdown`
                expenseSelectDebt.value = txToEdit.linkedDebtId;
            }
        }
    } else if (baseType === 'transfer') {
        setCustomDropdownValue('source-account-custom', 'source-account', txToEdit.sourceAccountId);
        setCustomDropdownValue('destination-account-custom', 'destination-account', txToEdit.destinationAccountId);
    }

    // 5. Update UI Tombol
    trackingViewTitle.textContent = 'Edit Transaksi';
    btnSubmitTransaction.textContent = 'Update Transaksi';
    btnSubmitTransaction.classList.remove('btn-brand-primary');
    btnSubmitTransaction.classList.add('btn-warning');
    btnCancelEdit.style.display = 'inline-block';

    // 6. Pindah View
    switchView('tracking-view');
    amountInput.focus();
}

// ========================================================
// === [FUNGSI YANG DIGANTI] resetTransactionForm       ===
// ========================================================
function resetTransactionForm() {
    editState.active = false;
    editState.txId = null;
    transactionForm.reset(); 
    checkAddAnother.checked = false;
    
    // [MODIFIKASI] Reset tanggal ke hari ini
    dateInput.valueAsDate = new Date(); 
    debtDueDateInput.valueAsDate = new Date(); 
    debtTenorInput.value = 1; 
    debtLenderInput.value = ''; 
    
    trackingViewTitle.textContent = 'Catat Transaksi Baru';
    btnSubmitTransaction.textContent = 'Simpan';
    btnSubmitTransaction.classList.remove('btn-warning');
    btnSubmitTransaction.classList.add('btn-brand-primary'); 
    btnCancelEdit.style.display = 'none';
    
    resetCustomDropdown('source-account-custom', 'source-account', 'Pilih Akun Sumber...');
    resetCustomDropdown('destination-account-custom', 'destination-account', 'Pilih Akun Tujuan...');

    // [MODIFIKASI] Reset UI ke tab default 'expense'
    const expenseTab = document.getElementById('tx-type-expense');
    if (expenseTab && !expenseTab.classList.contains('active')) {
        // Klik tab "Pengeluaran" untuk mereset UI
        expenseTab.click();
    } else {
        // Jika sudah aktif, panggil manual untuk reset (karena .click() tidak akan trigger)
        updateTransactionFormUI('expense');
    }
}


function handleEditBudget(category, amount) {
    budgetCategoryInput.value = category;
    budgetAmountInput.value = formatNumberInput(amount.toString()); 
    budgetAmountInput.focus();
    budgetForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function handleDeleteBudget(month, category) {
    if (!confirm(`Anda yakin ingin menghapus budget untuk kategori "${category}" di bulan ini?`)) {
        return;
    }
    try {
        if (db.budgets[month] && db.budgets[month][category] !== undefined) {
            db.budgets[month][category] = 0;
            saveDataToLocalStorage();
            masterUpdateUI();
            alert(`Budget untuk "${category}" telah dihapus.`);
        } else {
            throw new Error("Data budget tidak ditemukan.");
        }
    } catch (error) {
        console.error("Gagal menghapus budget:", error);
        alert("Terjadi kesalahan saat mencoba menghapus budget.");
    }
}


// =========================================
// === 5. FITUR AKUN (Accounts)          ===
// =========================================

function populateAccountDropdowns() {
    setupCustomAccountDropdown('source-account-custom', 'source-account');
    setupCustomAccountDropdown('destination-account-custom', 'destination-account');
    setupCustomAccountDropdown('modal-savings-source-account-custom', 'modal-savings-source-account');
    setupCustomAccountDropdown('modal-debt-source-account-custom', 'modal-debt-source-account');
    setupCustomAccountDropdown('modal-spend-destination-account-custom', 'modal-spend-destination-account'); 
    
    const optionsHTMLWithAll = `<option value="all" selected>Semua Akun</option>` + db.accounts.map(account => 
        `<option value="${account.id}">${account.name}</option>`
    ).join('');
    
    historyFilterAccount.innerHTML = optionsHTMLWithAll;
}

function setupCustomAccountDropdown(containerId, inputId) {
    const dropdownContainer = document.getElementById(containerId);
    if (!dropdownContainer) return; 
    
    const selectedEl = dropdownContainer.querySelector('.custom-dropdown-selected span');
    const optionsEl = dropdownContainer.querySelector('.custom-dropdown-options');
    const hiddenInput = document.getElementById(inputId);
    
    const placeholderText = selectedEl.classList.contains('placeholder') ? selectedEl.textContent : 'Pilih Akun...';

    optionsEl.innerHTML = ''; 

    db.accounts.forEach(account => {
        const option = document.createElement('div');
        option.className = 'custom-dropdown-option';
        option.dataset.value = account.id;
        
        let balanceLevel = "normal";
        if (account.balance >= 1000000) balanceLevel = "high"; 
        if (account.balance < 100000) balanceLevel = "low";   
        option.dataset.balanceLevel = balanceLevel;

        const iconClass = account.icon || 'bi-wallet2'; 

        option.innerHTML = `
            <i class="bi ${iconClass} account-icon"></i>
            <div class="account-details">
                <span class="account-name">${account.name}</span>
                <span class="account-balance">Saldo: ${formatCurrency(account.balance)}</span>
            </div>
        `;
        
        option.addEventListener('click', (e) => {
            e.stopPropagation(); 
            selectedEl.textContent = account.name; 
            selectedEl.classList.remove('placeholder'); 
            hiddenInput.value = account.id; 
            optionsEl.style.display = 'none'; 
            
            hiddenInput.dispatchEvent(new Event('change'));
        });
        
        optionsEl.appendChild(option);
    });
    
    if (!hiddenInput.value) {
        selectedEl.textContent = placeholderText;
        selectedEl.classList.add('placeholder');
    }
}

function resetCustomDropdown(containerId, inputId, placeholder) {
     const dropdownContainer = document.getElementById(containerId);
     if (!dropdownContainer) return;
     
     const selectedEl = dropdownContainer.querySelector('.custom-dropdown-selected span');
     const hiddenInput = document.getElementById(inputId);
     
     selectedEl.textContent = placeholder;
     selectedEl.classList.add('placeholder');
     hiddenInput.value = "";
}

function setCustomDropdownValue(containerId, inputId, value) {
    const account = db.accounts.find(a => a.id === value);
    if (!account) return;
    
    const dropdownContainer = document.getElementById(containerId);
    if (!dropdownContainer) return;
    
    const selectedEl = dropdownContainer.querySelector('.custom-dropdown-selected span');
    const hiddenInput = document.getElementById(inputId);
    
    selectedEl.textContent = account.name;
    selectedEl.classList.remove('placeholder');
    hiddenInput.value = account.id;
}


function renderAccountsList() {
    accountsListContainer.innerHTML = ''; 

    if (!db.accounts || db.accounts.length === 0) {
        accountsListContainer.innerHTML = `<div class="col-12"><p class="text-center p-4 text-muted">Belum ada akun. Silakan tambahkan.</p></div>`; return;
    }
    
    db.accounts.forEach(account => {
        const iconClass = account.icon || 'bi-wallet2'; 

        const cardHTML = `
            <div class="account-card">
                <div class="account-card-info">
                    <i class="bi ${iconClass} account-icon"></i>
                    <div class="account-details">
                        <span class="account-name">${account.name}</span>
                        <span class="account-balance">${formatCurrency(account.balance)}</span>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-warning btn-sm btn-edit-account me-1" data-id="${account.id}" title="Edit Nama"><i class="bi bi-pencil-fill"></i></button>
                    <button class="btn btn-danger btn-sm btn-delete-account" data-id="${account.id}" title="Hapus Akun"><i class="bi bi-trash-fill"></i></button>
                </div>
            </div>
        `;
        
        accountsListContainer.innerHTML += cardHTML;
    });
}

function handleAccountSubmit(e) {
    e.preventDefault();
    const name = accountNameInput.value.trim();
    const icon = accountIconInput.value; 
    const initialBalance = parseFloat(unformatNumberInput(accountInitialBalanceInput.value)) || 0;
    
    if (!name) {
        alert('Nama akun tidak boleh kosong.'); return;
    }

    if (editAccountState.active) {
        const account = db.accounts.find(a => a.id === editAccountState.accountId);
        if (account) {
            account.name = name;
            account.icon = icon; 
            alert('Nama akun berhasil diperbarui!');
        }
    } else {
        if (db.accounts.find(a => a.name.toLowerCase() === name.toLowerCase())) {
            alert('Nama akun sudah ada.'); return;
        }
        
        const newAccount = {
            id: Date.now(),
            name: name,
            balance: 0,
            icon: icon 
        };
        db.accounts.push(newAccount);

        if (initialBalance > 0) {
            const newTransaction = {
                id: Date.now() + 1,
                type: 'income',
                amount: initialBalance,
                category: 'Saldo Awal',
                description: `Saldo awal untuk ${name}`,
                date: new Date().toISOString().split('T')[0],
                sourceAccountId: null,
                destinationAccountId: newAccount.id,
                linkedDebtId: null
            };
            db.transactions.push(newTransaction);
        }
        alert('Akun baru berhasil ditambahkan!');
    }
    
    saveDataToLocalStorage();
    masterUpdateUI();
    resetAccountForm();
    accountModal.hide(); 
}

function handleEditAccount(accountId) {
    const account = db.accounts.find(a => a.id === accountId);
    if (!account) return;
    
    editAccountState.active = true;
    editAccountState.accountId = accountId;

    accountModalTitle.textContent = 'Edit Nama Akun';
    accountIdEditInput.value = account.id;
    accountNameInput.value = account.name;
    accountIconInput.value = account.icon || 'bi-wallet2'; 
    
    accountInitialBalanceInput.value = '';
    accountInitialBalanceInput.disabled = true;
    accountInitialBalanceInput.closest('.mb-3').style.display = 'none';
    
    btnSubmitAccount.innerHTML = '<i class="bi bi-check-circle-fill"></i> Update Nama'; 
    btnSubmitAccount.classList.add('btn-warning');
    btnCancelAccountEdit.style.display = 'inline-block';
    
    accountModal.show(); 
}

function handleDeleteAccount(accountId) {
    if (db.accounts.length <= 1) {
        alert('Tidak dapat menghapus. Anda harus memiliki minimal satu akun.'); return;
    }
    
    const isUsed = db.transactions.some(tx => tx.sourceAccountId === accountId || tx.destinationAccountId === accountId);
    if (isUsed) {
        alert('Tidak dapat menghapus akun ini karena sudah memiliki riwayat transaksi.\n(Fitur arsip akun belum tersedia)');
        return;
    }

    if (!confirm(`Anda yakin ingin menghapus akun "${db.accounts.find(a=>a.id === accountId).name}"?\nAkun ini tidak memiliki transaksi.`)) return;

    db.accounts = db.accounts.filter(a => a.id !== accountId);
    saveDataToLocalStorage();
    masterUpdateUI();
}

function resetAccountForm() {
    editAccountState.active = false;
    editAccountState.accountId = null;
    accountForm.reset();

    accountIconInput.value = 'bi-wallet2'; 
    accountModalTitle.textContent = 'Tambah Akun Baru';
    
    accountInitialBalanceInput.disabled = false;
    accountInitialBalanceInput.closest('.mb-3').style.display = 'block';

    btnSubmitAccount.innerHTML = '<i class="bi bi-plus-circle"></i> Tambah Akun';
    btnSubmitAccount.classList.remove('btn-warning');
    btnCancelAccountEdit.style.display = 'none';
}


// =========================================
// === 6. FITUR TABUNGAN (Savings)       ===
// =========================================

function renderSavingsGoals() {
    if (!db.savings || db.savings.length === 0) {
        savingsGoalList.innerHTML = `<div class="col-12"><div class="card shadow-sm"><div class="card-body text-center p-4 text-muted">Belum ada tujuan tabungan. Mulai buat satu!</div></div></div>`; return;
    }
    
    savingsGoalList.innerHTML = '';
    
    db.savings.forEach(goal => {
        const iconClass = goal.icon || 'bi-piggy-bank-fill'; 
        
        let targetInfoHTML = '';
        let progressInfoHTML = '';
        let remainingInfoHTML = '';

        if (goal.target > 0) {
            const percentage = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
            const remaining = goal.target - goal.current;
            
            targetInfoHTML = `<small class="text-muted">Target: ${formatCurrency(goal.target)}</small>`;
            
            progressInfoHTML = `
                <div class="d-flex justify-content-between mt-2"> 
                    <span>Terkumpul: ${formatCurrency(goal.current)}</span> 
                    <span>${percentage.toFixed(1)}%</span> 
                </div>
                <div class="progress mt-1" role="progressbar" style="height: 20px;"> 
                    <div class="progress-bar bg-success" style="width: ${Math.min(percentage, 100)}%"> 
                        ${percentage.toFixed(0)}% 
                    </div> 
                </div>`;
                
            remainingInfoHTML = `
                <div class="text-end mt-1"> 
                    <small class="text-muted">Kurang: ${formatCurrency(remaining)}</small> 
                </div>`;

        } else {
            targetInfoHTML = `<small class="text-muted">Tabungan Terbuka (Tanpa Target)</small>`;
            
            progressInfoHTML = `
                <div class="mt-3">
                    <span class="text-muted">Terkumpul Saat Ini:</span>
                    <h4 class="fw-bold" style="color: var(--sidebar-link-active); margin-top: 4px;">
                        ${formatCurrency(goal.current)}
                    </h4>
                </div>`;
        }

        const cardHTML = `
            <div class="col-md-6"> 
                <div class="card shadow-sm savings-goal-card"> 
                    <div class="card-body p-4">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div> 
                                <h5 class="card-title mb-1 d-flex align-items-center">
                                    <i class="bi ${iconClass} me-2" style="font-size: 1.2rem; color: var(--sidebar-link-active);"></i>
                                    ${goal.name}
                                </h5> 
                                ${targetInfoHTML}
                            </div>
                            
                            <div class="btn-group" role="group">
                                <button class="btn btn-sm btn-outline-success btn-open-spend-modal" data-id="${goal.id}" title="Gunakan/Ambil">
                                    <i class="bi bi-box-arrow-up-right"></i> Gunakan
                                </button>
                                <button class="btn btn-sm btn-brand-primary btn-open-savings-modal" data-id="${goal.id}" title="Tambah Tabungan">
                                    <i class="bi bi-plus-lg"></i> Tambah
                                </button>
                            </div>
                        </div>
                        
                        ${progressInfoHTML}
                        ${remainingInfoHTML}

                    </div> 
                </div> 
            </div>`;
        savingsGoalList.innerHTML += cardHTML;
    });
}

function handleSavingsGoalSubmit(e) {
    e.preventDefault();
    const name = goalNameInput.value;
    const icon = goalIconInput.value;
    const target = parseFloat(unformatNumberInput(goalTargetInput.value)) || 0; 

    if (!name) {
        alert('Nama tujuan harus diisi.'); return;
    }
    
    const newGoal = { 
        id: Date.now(), 
        name: name, 
        target: target, 
        current: 0,
        icon: icon 
    };

    db.savings.push(newGoal);
    saveDataToLocalStorage();
    renderSavingsGoals();
    
    goalNameInput.value = '';
    goalTargetInput.value = '';
    goalIconInput.value = 'bi-piggy-bank-fill'; 
}

function openAddSavingsModal(goalId) {
    const goal = db.savings.find(g => g.id === goalId);
    if (!goal) return;
    if (db.accounts.length === 0) {
        alert('Anda harus membuat Akun (misal: Tunai) terlebih dahulu sebelum bisa menabung.');
        switchView('accounts-view');
        return;
    }
    currentSavingGoalId = goalId;
    modalGoalName.textContent = goal.name;
    addSavingsForm.reset();
    resetCustomDropdown('modal-savings-source-account-custom', 'modal-savings-source-account', 'Pilih Akun...');
    addSavingsModal.show();
}

function handleAddSavingsSubmit() {
    const amount = parseFloat(unformatNumberInput(modalSavingsAmount.value));
    const sourceAccountId = parseInt(modalSavingsSourceAccountInput.value); 

    if (isNaN(amount) || amount <= 0) {
        alert('Jumlah tabungan harus berupa angka positif.'); return;
    }
    if (isNaN(sourceAccountId)) {
        alert('Pilih akun sumber untuk menabung.'); return;
    }

    const goalIndex = db.savings.findIndex(g => g.id === currentSavingGoalId);
    if (goalIndex === -1) return;
    
    const goalName = db.savings[goalIndex].name;
    
    const sourceAccount = db.accounts.find(a => a.id === sourceAccountId);
    if (sourceAccount.balance < amount) {
        alert(`Saldo di akun "${sourceAccount.name}" (Rp ${formatCurrency(sourceAccount.balance)}) tidak mencukupi untuk menabung Rp ${formatCurrency(amount)}.`);
        return;
    }

    db.savings[goalIndex].current += amount;
    
    const newTransaction = { 
        id: Date.now(), 
        type: 'expense', 
        amount: amount, 
        category: 'Tabungan', 
        description: `Menabung untuk: ${goalName}`, 
        date: new Date().toISOString().split('T')[0],
        sourceAccountId: sourceAccountId,
        destinationAccountId: null,
        linkedDebtId: null
    };
    db.transactions.push(newTransaction);
    
    saveDataToLocalStorage();
    masterUpdateUI();
    addSavingsModal.hide();
    currentSavingGoalId = null;
}

function openSpendSavingsModal(goalId) {
    const goal = db.savings.find(g => g.id === goalId);
    if (!goal) return;
    if (db.accounts.length === 0) {
        alert('Anda harus membuat Akun (misal: Tunai) terlebih dahulu sebelum bisa mengambil tabungan.');
        switchView('accounts-view');
        return;
    }
    
    currentSpendGoalId = goalId;
    modalSpendGoalName.textContent = goal.name;
    modalSpendGoalCurrent.textContent = formatCurrency(goal.current);
    
    document.getElementById('spend-savings-form').reset();
    modalSpendAmount.value = ''; 
    
    resetCustomDropdown('modal-spend-destination-account-custom', 'modal-spend-destination-account', 'Pilih Akun...');
    spendSavingsModal.show();
}

function handleSpendSavingsSubmit() {
    const amount = parseFloat(unformatNumberInput(modalSpendAmount.value));
    const destinationAccountId = parseInt(modalSpendDestinationAccountInput.value); 

    if (isNaN(amount) || amount <= 0) {
        alert('Jumlah pengambilan harus berupa angka positif.'); return;
    }
    if (isNaN(destinationAccountId)) {
        alert('Pilih akun tujuan untuk menerima dana.'); return;
    }

    const goalIndex = db.savings.findIndex(g => g.id === currentSpendGoalId);
    if (goalIndex === -1) return;
    
    const goal = db.savings[goalIndex];
    
    if (amount > goal.current) {
        alert(`Jumlah pengambilan (Rp ${formatCurrency(amount)}) melebihi tabungan yang ada (Rp ${formatCurrency(goal.current)}).`);
        return;
    }

    db.savings[goalIndex].current -= amount;
    
    const newTransaction = { 
        id: Date.now(), 
        type: 'income', 
        amount: amount, 
        category: 'Hasil Tabungan', 
        description: `Ambil tabungan dari: ${goal.name}`, 
        date: new Date().toISOString().split('T')[0],
        sourceAccountId: null,
        destinationAccountId: destinationAccountId,
        linkedDebtId: null
    };
    db.transactions.push(newTransaction);
    
    saveDataToLocalStorage();
    masterUpdateUI();
    spendSavingsModal.hide();
    currentSpendGoalId = null;
}

function handleSpendUseAll(e) {
    e.preventDefault();
    const goal = db.savings.find(g => g.id === currentSpendGoalId);
    if (goal) {
        modalSpendAmount.value = formatNumberInput(goal.current.toString());
    }
}


// =========================================
// === 7. FITUR HUTANG (Debts / PayLater) ===
// =========================================

function populateActiveDebtsDropdown() {
    const activeDebts = db.debts.filter(d => d.remainingAmount > 0);
    
    if(activeDebts.length === 0) {
        expenseSelectDebt.innerHTML = '<option value="">Tidak ada hutang aktif</option>';
        return;
    }
    
    expenseSelectDebt.innerHTML = activeDebts.map(debt => 
        `<option value="${debt.id}">${debt.lender} (Sisa: ${formatCurrency(debt.remainingAmount)})</option>`
    ).join('');
}

function renderDebtList() {
    if (!db.debts || db.debts.length === 0) {
        debtList.innerHTML = `<div class="col-12"><div class="card shadow-sm"><div class="card-body text-center p-4 text-muted">Belum ada data hutang.</div></div></div>`; return;
    }
    
    debtList.innerHTML = '';
    const activeDebts = db.debts.filter(d => d.remainingAmount > 0);
    
    if (activeDebts.length === 0) {
         debtList.innerHTML = `<div class="col-12"><div class="card shadow-sm"><div class="card-body text-center p-4 text-muted">Semua hutang sudah lunas!</div></div></div>`; return;
    }
    
    activeDebts.forEach(debt => {
        const percentage = debt.totalAmount > 0 ? ((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100 : 0;
        const today = new Date().toISOString().split('T')[0];
        let dueDateClass = 'text-muted';
        if (debt.dueDate < today) {
            dueDateClass = 'text-danger fw-bold'; 
        }

        const cardHTML = `
            <div class="col-md-6 col-lg-4"> 
                <div class="card shadow-sm debt-card"> 
                    <div class="card-body p-4">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div> 
                                <h5 class="card-title mb-1">${debt.lender}</h5> 
                                <small class="${dueDateClass}">Jatuh Tempo: ${formatDate(debt.dueDate)}</small> 
                            </div>
                            <button class="btn btn-sm btn-success btn-open-pay-debt-modal" data-id="${debt.id}"> 
                                <i class="bi bi-cash-coin"></i> Bayar 
                            </button>
                        </div>
                        <div class="d-flex justify-content-between"> 
                            <span>Terbayar: ${formatCurrency(debt.totalAmount - debt.remainingAmount)}</span> 
                            <span>${percentage.toFixed(1)}%</span> 
                        </div>
                        <div class="progress mt-1" role="progressbar" style="height: 20px;"> 
                            <div class="progress-bar bg-info" style="width: ${Math.min(percentage, 100)}%"> 
                                ${percentage.toFixed(0)}% 
                            </div> 
                        </div>
                        <div class="text-end mt-1"> 
                            <small class="text-muted">Sisa: ${formatCurrency(debt.remainingAmount)} dari ${formatCurrency(debt.totalAmount)}</small>
                        </div>
                    </div> 
                </div> 
            </div>`;
        debtList.innerHTML += cardHTML;
    });
}

function openPayDebtModal(debtId) {
    const debt = db.debts.find(d => d.id === debtId);
    if (!debt) return;
    if (db.accounts.length === 0) {
        alert('Anda harus membuat Akun (misal: Tunai) terlebih dahulu sebelum bisa membayar hutang.');
        switchView('accounts-view');
        return;
    }
    
    currentDebtPaymentId = debtId;
    modalDebtLender.textContent = debt.lender;
    modalDebtRemaining.textContent = formatCurrency(debt.remainingAmount);
    
    modalDebtPaymentAmount.value = formatNumberInput(debt.remainingAmount.toString()); 
    
    // payDebtForm.reset(); // Jangan reset formnya agar jumlah terisi
    resetCustomDropdown('modal-debt-source-account-custom', 'modal-debt-source-account', 'Pilih Akun...');
    payDebtModal.show();
}

function handlePayDebtSubmit() {
    const amount = parseFloat(unformatNumberInput(modalDebtPaymentAmount.value));
    const sourceAccountId = parseInt(modalDebtSourceAccountInput.value); 

    if (isNaN(amount) || amount <= 0) {
        alert('Jumlah pembayaran harus berupa angka positif.'); return;
    }
    if (isNaN(sourceAccountId)) {
        alert('Pilih akun sumber untuk membayar.'); return;
    }

    const debtIndex = db.debts.findIndex(d => d.id === currentDebtPaymentId);
    if (debtIndex === -1) return;
    
    const debt = db.debts[debtIndex];
    
    const sourceAccount = db.accounts.find(a => a.id === sourceAccountId);
    if (sourceAccount.balance < amount) {
        alert(`Saldo di akun "${sourceAccount.name}" (${formatCurrency(sourceAccount.balance)}) tidak mencukupi untuk membayar Rp ${formatCurrency(amount)}.`);
        return;
    }
    
    if (amount > debt.remainingAmount) {
        if (!confirm(`Jumlah pembayaran (Rp ${formatCurrency(amount)}) lebih besar dari sisa hutang (Rp ${formatCurrency(debt.remainingAmount)}).\nLanjutkan membayar?`)) {
            return;
        }
    }

    const newTransaction = { 
        id: Date.now(), 
        type: 'debt_expense', // Tipe khusus untuk bayar hutang
        amount: amount, 
        category: 'Bayar Hutang', 
        description: `Bayar hutang ke: ${debt.lender}`, 
        date: new Date().toISOString().split('T')[0],
        sourceAccountId: sourceAccountId,
        destinationAccountId: null,
        linkedDebtId: currentDebtPaymentId 
    };
    db.transactions.push(newTransaction);
    
    saveDataToLocalStorage();
    masterUpdateUI(); 
    payDebtModal.hide();
    
    alert('Pembayaran hutang berhasil dicatat!');
    currentDebtPaymentId = null;
}


// =========================================
// === 8. FITUR PENGATURAN (Settings)    ===
// =========================================

function handleExportData() {
    try {
        const dataToExport = JSON.stringify(db, null, 2);
        const blob = new Blob([dataToExport], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        const tgl = new Date().toISOString().split('T')[0];
        a.download = `keuanganku_backup_${tgl}.json`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        alert('File backup sedang diunduh!');
    } catch (error) {
        console.error("Gagal mengekspor data:", error);
        alert("Terjadi kesalahan saat mencoba mengekspor data.");
    }
}

function handleImportData() {
    const file = importFileInput.files[0];
    if (!file) {
        alert('Silakan pilih file terlebih dahulu.'); return;
    }
    if (!confirm("PERINGATAN!\n\nIni akan menimpa dan menghapus SEMUA data Anda saat ini. Apakah Anda yakin ingin melanjutkan?")) {
        importFileInput.value = "";
        btnImportData.disabled = true;
        return; 
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData.transactions || typeof importedData.budgets !== 'object' || !importedData.savings || !importedData.accounts) {
                throw new Error("File tidak valid. Properti data (transactions, budgets(object), savings, accounts) tidak ditemukan.");
            }
            if (!importedData.debts) {
                console.warn("File backup lama, properti 'debts' ditambahkan.");
                importedData.debts = [];
            }
            
            db = importedData;
            saveDataToLocalStorage();
            masterUpdateUI();
            alert('Data berhasil diimpor! Aplikasi akan me-refresh tampilan.');
            switchView('dashboard-view');
        } catch (error) {
            console.error("Gagal mengimpor data:", error);
            alert("Gagal mengimpor data. Pastikan file backup Anda valid dan tidak rusak.");
        } finally {
            importFileInput.value = "";
            btnImportData.disabled = true;
        }
    };
    reader.onerror = function() {
        alert("Gagal membaca file.");
        importFileInput.value = "";
        btnImportData.disabled = true;
    };
    reader.readAsText(file);
}

function handleClearData() {
    if (!confirm("PERINGATAN!\n\nAnda yakin ingin menghapus SEMUA data?")) {
        return;
    }
    if (!confirm("INI AKSI FINAL dan TIDAK BISA DIBATALKAN.\nKlik 'OK' untuk menghapus semua data secara permanen.")) {
        return;
    }
    try {
        localStorage.removeItem('keuangankuDB');
        db = JSON.parse(JSON.stringify(defaultDB));
        masterUpdateUI();
        switchView('dashboard-view');
        alert('Semua data telah berhasil dihapus!');
    } catch (error) {
        console.error("Gagal menghapus data:", error);
        alert("Terjadi kesalahan saat mencoba menghapus data.");
    }
}


// =========================================
// === 9. FUNGSI HELPER / UTILITAS       ===
// =========================================

// =========================================
// === 9A. HELPER KONSISTENSI TAMPILAN TRANSAKSI ===
// =========================================

function getTransactionDisplayDetails(tx) {
    let typeClass, iconClass, amountSign, accountName, accountIcon;

    // Tentukan Tipe, Warna, dan Ikon
    if (tx.type === 'income') {
        typeClass = 'tx-income';
        iconClass = 'bi-arrow-down-circle';
        amountSign = '+ ';
        
        const account = db.accounts.find(a => a.id === tx.destinationAccountId);
        accountName = account ? account.name : 'N/A (Akun Dihapus)';
        accountIcon = account ? (account.icon || 'bi-wallet') : 'bi-question-circle';
        
    } else if (tx.type === 'expense' || tx.type === 'debt_expense') {
        typeClass = 'tx-expense';
        iconClass = 'bi-arrow-up-circle';
        amountSign = '- ';

        const account = db.accounts.find(a => a.id === tx.sourceAccountId);
        // Jika Paylater/Pinjaman yang membuat hutang, sourceAccountId bisa null.
        if (!tx.sourceAccountId && (tx.category !== 'Bayar Hutang')) {
             accountName = tx.description.includes('via') ? tx.description.match(/\(([^)]+)\)/)[1].replace(')', '') : 'Non-Tunai';
             accountIcon = 'bi-credit-card';
        } else {
             accountName = account ? account.name : 'N/A (Akun Dihapus)';
             accountIcon = account ? (account.icon || 'bi-wallet') : 'bi-question-circle';
        }
        
    } else if (tx.type === 'transfer') {
        typeClass = 'tx-transfer';
        iconClass = 'bi-arrow-left-right';
        amountSign = '';
        
        const source = db.accounts.find(a => a.id === tx.sourceAccountId);
        const dest = db.accounts.find(a => a.id === tx.destinationAccountId);
        accountName = `${source ? source.name.split(' ')[0] : '?'} → ${dest ? dest.name.split(' ')[0] : '?'}`;
        accountIcon = 'bi-repeat';

    } else {
        typeClass = 'text-muted';
        iconClass = 'bi-question-circle';
        amountSign = '';
        accountName = 'Unknown';
        accountIcon = 'bi-question-circle';
    }
    
    return {
        typeClass,
        iconClass,
        amountSign,
        accountName,
        accountIcon,
        formattedAmount: amountSign + formatCurrency(tx.amount),
    };
}


/**
 * HELPER 1: Membuat Baris Tabel (Desktop)
 */
function createHistoryTableRow(tx, isRecent = false) {
    const details = getTransactionDisplayDetails(tx);
    
    // Perbaikan: Gunakan jenis transaksi asli untuk label Tipe
    const typeLabel = (tx.type === 'expense' && !tx.sourceAccountId && tx.category !== 'Bayar Hutang') ? 'Paylater' : 
                      (tx.type === 'income' && tx.category === 'Pinjaman') ? 'Pinjaman' : 
                      (tx.type === 'debt_expense') ? 'Bayar Hutang' :
                      tx.type.charAt(0).toUpperCase() + tx.type.slice(1);

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${formatDate(tx.date)}</td>
        ${isRecent ? '' : `<td><span class="tx-indicator ${details.typeClass}"><i class="bi ${details.iconClass}"></i> ${typeLabel}</span></td>`}
        <td>${tx.category || '-'}</td>
        <td>${tx.description || '-'}</td>
        <td>${details.accountName}</td>
        <td class="text-end ${details.typeClass}" style="font-weight: 500;">${details.formattedAmount}</td>
        <td class="action-buttons">
            <button class="btn btn-action-soft btn-edit" data-id="${tx.id}" title="Edit">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-action-soft btn-delete" data-id="${tx.id}" title="Hapus">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;
    return tr;
}

/**
 * HELPER 2: Membuat Kartu Riwayat (Mobile)
 */
function createHistoryCard(tx) {
    const card = document.createElement('div');
    card.className = 'history-card';
    const details = getTransactionDisplayDetails(tx);
    
    // Perbaikan: Gunakan jenis transaksi asli untuk label Kategori
    const categoryLabel = (tx.type === 'expense' && !tx.sourceAccountId && tx.category !== 'Bayar Hutang') ? `[${tx.category}] Paylater` : 
                          (tx.type === 'income' && tx.category === 'Pinjaman') ? `[${tx.category}] Diterima` :
                          tx.category;

    card.innerHTML = `
        <div class="history-card-header">
            <div class="history-card-info">
                <span class="history-card-icon ${details.typeClass}"><i class="bi ${details.iconClass}"></i></span>
                <div class="history-card-details">
                    <div class="history-card-category">${categoryLabel}</div>
                    <div class="history-card-description">${tx.description || '&nbsp;'}</div>
                </div>
            </div>
            <div class="history-card-amount ${details.typeClass}">${details.formattedAmount}</div>
        </div>
        <div class="history-card-footer">
            <div class="history-card-meta">
                <span><i class="bi ${details.accountIcon}"></i> ${details.accountName}</span>
                <span><i class="bi bi-calendar3"></i> ${formatDate(tx.date)}</span>
            </div>
            <div class="history-card-actions dropdown">
                <button class="btn btn-sm btn-link dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="bi bi-three-dots-vertical"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                    <li><a class="dropdown-item btn-edit" href="#" data-id="${tx.id}">Edit</a></li>
                    <li><a class="dropdown-item btn-delete" href="#" data-id="${tx.id}">Hapus</a></li>
                </ul>
            </div>
        </div>
    `;
    return card;
}


function handleAmountInput(e) {
    let value = e.target.value;
    let cleanValue = unformatNumberInput(value);
    if (cleanValue.match(/[^0-9]/g)) {
        cleanValue = cleanValue.replace(/\D/g, '');
    }
    if(cleanValue === '') {
        e.target.value = ''; return;
    }
    const num = parseInt(cleanValue, 10);
    e.target.value = formatNumberInput(num.toString());
}

function formatNumberInput(value) {
    if (!value) return '';
    const num = value.replace(/\D/g, '');
    if(num === '') return '';
    return new Intl.NumberFormat('id-ID').format(num);
}

function unformatNumberInput(value) {
    if (!value) return '';
    return value.replace(/\./g, '');
}

function formatCurrency(amount) {
    const options = { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 };
    return new Intl.NumberFormat('id-ID', options).format(amount).replace('Rp', 'Rp ');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('id-ID', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
}

function getLastMonthKey(monthYearKey) {
    const date = new Date(monthYearKey + '-02T00:00:00'); 
    date.setMonth(date.getMonth() - 1); 
    return date.toISOString().slice(0, 7); 
}


// =========================================
// === 10. JALANKAN APLIKASI             ===
// =========================================
init();
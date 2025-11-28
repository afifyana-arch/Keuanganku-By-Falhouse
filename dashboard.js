/**
 * MODULE: DASHBOARD (Revisi #11 - Month Filter Enabled)
 */

// =======================================================
// 1. DATA SERVICE
// =======================================================
if (!window.DashboardService) {
    window.DashboardService = {
        
        async getSummary(targetMonthStr) { // Param: "YYYY-MM"
            return new Promise(resolve => {
                setTimeout(() => {
                    // Default to current month if null
                    const now = new Date();
                    const monthStr = targetMonthStr || now.toISOString().slice(0, 7);
                    
                    let totalIncomeMonth = 0;
                    let totalExpenseMonth = 0;
                    const expenseByCategory = {};
                    const dailyTrendMap = {};

                    // Init days for the selected month (untuk Line Chart)
                    const [y, m] = monthStr.split('-');
                    const daysInMonth = new Date(y, m, 0).getDate();
                    
                    for(let i=1; i<=daysInMonth; i++) {
                        const dayStr = `${monthStr}-${String(i).padStart(2, '0')}`;
                        dailyTrendMap[dayStr] = 0;
                    }

                    (db.transactions || []).forEach(tx => {
                        const txDateStr = tx.date;
                        const txMonth = txDateStr.slice(0, 7);

                        // Filter by Selected Month
                        if (txMonth === monthStr) {
                            if (tx.type === 'income') totalIncomeMonth += tx.amount;
                            else if (tx.type === 'expense' || tx.type === 'debt_expense') {
                                totalExpenseMonth += tx.amount;
                                
                                // Group Category
                                const cat = tx.category || 'Lainnya';
                                expenseByCategory[cat] = (expenseByCategory[cat] || 0) + tx.amount;

                                // Group Trend (Harian)
                                if (dailyTrendMap.hasOwnProperty(txDateStr)) {
                                    dailyTrendMap[txDateStr] += tx.amount;
                                }
                            }
                        }
                    });

                    // Total Global Balance (Tetap Real-time, tidak terpengaruh filter)
                    const currentBalance = (db.accounts || []).reduce((sum, acc) => sum + acc.balance, 0);

                    resolve({
                        balance: currentBalance,
                        incomeMonth: totalIncomeMonth,
                        expenseMonth: totalExpenseMonth,
                        categories: expenseByCategory,
                        trend: dailyTrendMap,
                        currentMonthStr: monthStr
                    });
                }, 300);
            });
        },

        async getBudgetStatus(monthStr, totalExpense) {
            return new Promise(resolve => {
                const budgets = db.budgets[monthStr] || {};
                let totalLimit = 0;
                Object.values(budgets).forEach(limit => totalLimit += limit);
                
                resolve({
                    limit: totalLimit,
                    percent: totalLimit > 0 ? (totalExpense / totalLimit) * 100 : 0,
                    hasBudget: totalLimit > 0
                });
            });
        },

        async getRecent(limit = 5) {
            return new Promise(resolve => {
                const recent = [...(db.transactions || [])]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .slice(0, limit);
                resolve(recent);
            });
        }
    };
}

// =======================================================
// 2. VIEW CONTROLLER
// =======================================================
window.DashboardView = {
    lineChart: null,
    doughnutChart: null,
    selectedMonth: '',

    async init() {
        console.log("DashboardView initialized (Rev #11)");
        
        if (this.lineChart) { this.lineChart.destroy(); this.lineChart = null; }
        if (this.doughnutChart) { this.doughnutChart.destroy(); this.doughnutChart = null; }

        // Setup Month Picker
        const picker = document.getElementById('dash-month-picker');
        if (picker) {
            // Set Default (Bulan Ini)
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            this.selectedMonth = `${yyyy}-${mm}`;
            picker.value = this.selectedMonth;

            // Listener Change
            picker.addEventListener('change', (e) => {
                this.selectedMonth = e.target.value;
                this.renderAll(); // Re-render saat ganti bulan
            });
        }

        await this.renderAll();
    },

    async renderAll() {
        try {
            // Gunakan selectedMonth untuk fetch data
            const data = await window.DashboardService.getSummary(this.selectedMonth);
            const budget = await window.DashboardService.getBudgetStatus(data.currentMonthStr, data.expenseMonth);
            const recent = await window.DashboardService.getRecent();

            this.renderHero(data);
            this.renderBudget(budget);
            this.renderCharts(data);
            this.renderRecentList(recent);

        } catch (e) {
            console.error("Dashboard error:", e);
        }
    },

    renderHero(data) {
        if(document.getElementById('dash-total-balance'))
            document.getElementById('dash-total-balance').textContent = formatCurrency(data.balance);
        if(document.getElementById('dash-month-income'))
            document.getElementById('dash-month-income').textContent = formatCurrency(data.incomeMonth);
        if(document.getElementById('dash-month-expense'))
            document.getElementById('dash-month-expense').textContent = formatCurrency(data.expenseMonth);
    },

    renderBudget(budget) {
        const bar = document.getElementById('dash-budget-bar');
        const txtPercent = document.getElementById('dash-budget-percent');
        const txtDesc = document.getElementById('dash-budget-text');
        
        if (!bar) return;

        if (!budget.hasBudget) {
            bar.style.width = '0%';
            bar.className = 'progress-bar bg-secondary';
            txtPercent.textContent = '-';
            txtDesc.textContent = "Belum ada anggaran yang diatur periode ini.";
        } else {
            const percent = Math.min(budget.percent, 100);
            bar.style.width = `${percent}%`;
            txtPercent.textContent = `${budget.percent.toFixed(0)}%`;
            
            if (budget.percent >= 100) {
                bar.className = 'progress-bar bg-danger';
                txtDesc.innerHTML = `<span class="text-danger fw-bold">Over Budget!</span> Melewati batas anggaran.`;
            } else if (budget.percent >= 80) {
                bar.className = 'progress-bar bg-warning';
                txtDesc.textContent = "Hati-hati, anggaran hampir habis.";
            } else {
                bar.className = 'progress-bar bg-success';
                txtDesc.textContent = "Pengeluaran masih aman.";
            }
        }
    },

    renderCharts(data) {
        // LINE CHART (Harian di bulan terpilih)
        const ctxLine = document.getElementById('dashboard-line-chart');
        if (ctxLine) {
            const labels = Object.keys(data.trend).map(d => parseInt(d.split('-')[2])); // Ambil tanggalnya saja (1, 2, 3...)
            const values = Object.values(data.trend);

            // Jika chart sudah ada, destroy dulu (penting saat refresh filter)
            if (this.lineChart) this.lineChart.destroy();

            this.lineChart = new Chart(ctxLine, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Pengeluaran (IDR)',
                        data: values,
                        borderColor: '#739072',
                        backgroundColor: 'rgba(115, 144, 114, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true,
                        pointRadius: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { borderDash: [5, 5], color: '#f0f0f0' }, ticks: { font: { size: 10 } } },
                        x: { grid: { display: false }, ticks: { font: { size: 10 } } }
                    }
                }
            });
        }

        // PIE CHART
        const ctxPie = document.getElementById('dashboard-doughnut-chart');
        if (ctxPie) {
            const sortedCats = Object.entries(data.categories)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            
            const catLabels = sortedCats.map(x => x[0]);
            const catValues = sortedCats.map(x => x[1]);

            if (catLabels.length === 0) {
                catLabels.push("Kosong");
                catValues.push(1);
            }

            if (this.doughnutChart) this.doughnutChart.destroy();

            this.doughnutChart = new Chart(ctxPie, {
                type: 'doughnut',
                data: {
                    labels: catLabels,
                    datasets: [{
                        data: catValues,
                        backgroundColor: ['#739072', '#D3E4CD', '#ADC2A9', '#99A799', '#FEF5ED'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    cutout: '75%'
                }
            });

            // Update Custom Legend
            const legendContainer = document.getElementById('dash-top-category-legend');
            if (legendContainer) {
                if(sortedCats.length > 0) {
                    legendContainer.innerHTML = sortedCats.map((item, idx) => `
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <div class="d-flex align-items-center">
                                <span class="d-inline-block rounded-circle me-2" style="width: 10px; height: 10px; background-color: ${['#739072', '#D3E4CD', '#ADC2A9', '#99A799', '#FEF5ED'][idx]}"></span>
                                <span class="text-muted">${item[0]}</span>
                            </div>
                            <span class="fw-bold text-dark small">${formatCurrency(item[1])}</span>
                        </div>
                    `).join('');
                } else {
                    legendContainer.innerHTML = `<div class="text-center text-muted small fst-italic">Belum ada data</div>`;
                }
            }
        }
    },

    renderRecentList(transactions) {
        const container = document.getElementById('dash-recent-list');
        if (!container) return;

        if (transactions.length === 0) {
            container.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted small">Belum ada transaksi</td></tr>`;
            return;
        }

        container.innerHTML = transactions.map(tx => {
            const isIncome = tx.type === 'income';
            const colorClass = isIncome ? 'text-success' : 'text-danger';
            const amountPrefix = isIncome ? '+' : '-';
            const category = tx.category || 'Umum';

            return `
            <tr>
                <td class="ps-4 text-muted small">${formatDate(tx.date)}</td>
                <td><span class="badge bg-light text-dark border fw-normal">${category}</span></td>
                <td class="text-dark small text-truncate" style="max-width: 150px;">${tx.description || '-'}</td>
                <td class="pe-4 text-end fw-bold ${colorClass}">${amountPrefix} ${formatCurrency(tx.amount)}</td>
            </tr>
            `;
        }).join('');
    }
};

window.DashboardView.init();
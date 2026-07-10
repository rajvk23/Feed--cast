// App State
let sales = [];
let purchases = [];
let activeTab = 'dashboard';
let trendChart = null;
let statsBarChart = null;
let statsRadarChart = null;
let statsPieChart = null;
let statsSupplierChart = null;

// Inventory Database
let inventory = [
  { name: 'Super Cow Feed (Premium)', category: 'Cattle Feed', stock: 450, minStock: 100, price: 1150 },
  { name: 'Gold Buffalo Mash', category: 'Buffalo Special', stock: 85, minStock: 120, price: 1100 },
  { name: 'Premium Calf Starter', category: 'Calf Feed', stock: 210, minStock: 50, price: 1300 },
  { name: 'SVT Mineral Mixture', category: 'Supplements', stock: 15, minStock: 30, price: 950 }
];

// Currency Formatter (Indian style: ₹14,78,568)
let historicalData = null;
const rupeeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

// Format numbers nicely
function formatRupee(amount) {
  return rupeeFormatter.format(amount);
}

// DOM Elements
const navTabs = document.querySelectorAll('.nav-tab');
const tabContents = document.querySelectorAll('.tab-content');
const dashboardMonthSelect = document.getElementById('dashboardMonth');
const retailerSearchInput = document.getElementById('retailerSearch');
const saleForm = document.getElementById('saleForm');
const saleDateInput = document.getElementById('saleDate');
const customerInputGroup = document.getElementById('customerInputGroup');
const typeCounter = document.getElementById('typeCounter');
const typeRetailer = document.getElementById('typeRetailer');
const customerNameInput = document.getElementById('customerName');
const retailerListDatalist = document.getElementById('retailerList');
const toastElement = document.getElementById('toast');
const toastMessageElement = document.getElementById('toastMessage');

// Sub-tabs for Retailers history
const btnLedgerSummary = document.getElementById('btnLedgerSummary');
const btnPurchaseForecast = document.getElementById('btnPurchaseForecast');
const ledgerCard = document.getElementById('ledgerCard');
const forecastCard = document.getElementById('forecastCard');
const forecastBody = document.getElementById('forecastBody');

// New DOM Elements for Purchase
const purchaseForm = document.getElementById('purchaseForm');
const purchaseDateInput = document.getElementById('purchaseDate');
const purchaseSupplierInput = document.getElementById('purchaseSupplier');
const supplierListDatalist = document.getElementById('supplierList');

// Initialize App
window.addEventListener('DOMContentLoaded', () => {
  // Set default date to today dynamically based on calendar clock
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  saleDateInput.value = dateStr;
  purchaseDateInput.value = dateStr;

  // Fetch Data
  fetchData();

  // Setup Event Listeners
  setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
  // Navigation Tabs
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      switchTab(tabName);
    });
  });

  // Handle month selection change
  dashboardMonthSelect.addEventListener('change', () => {
    renderDashboard();
  });

  // Retailer Search
  retailerSearchInput.addEventListener('input', () => {
    renderRetailers();
    if (btnPurchaseForecast.classList.contains('active')) {
      renderCustomerPredictions();
    }
  });

  // Retailer sub-tabs toggles
  btnLedgerSummary.addEventListener('click', () => {
    btnLedgerSummary.classList.add('active');
    btnPurchaseForecast.classList.remove('active');
    ledgerCard.style.display = 'block';
    forecastCard.style.display = 'none';
  });

  btnPurchaseForecast.addEventListener('click', () => {
    btnPurchaseForecast.classList.add('active');
    btnLedgerSummary.classList.remove('active');
    ledgerCard.style.display = 'none';
    forecastCard.style.display = 'block';
    renderCustomerPredictions();
  });

  // Form Radio toggles
  typeCounter.addEventListener('change', () => {
    customerInputGroup.style.display = 'none';
    customerNameInput.removeAttribute('required');
  });

  typeRetailer.addEventListener('change', () => {
    customerInputGroup.style.display = 'flex';
    customerNameInput.setAttribute('required', 'true');
    customerNameInput.focus();
  });

  // Form Submission
  saleForm.addEventListener('submit', handleSaleSubmit);
  purchaseForm.addEventListener('submit', handlePurchaseSubmit);

  // Link quick action clicks (like Record Sale triggers)
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('nav-trigger')) {
      const targetTab = e.target.getAttribute('data-tab');
      switchTab(targetTab);
    }
  });
}

// Fetch Data from Backend
async function fetchData() {
  try {
    const [resData, resHist] = await Promise.all([
      fetch('/api/data'),
      fetch('/api/historical')
    ]);
    
    if (!resData.ok || !resHist.ok) throw new Error('Failed to fetch data');
    
    const data = await resData.json();
    historicalData = await resHist.json();
    
    sales = data.sales || [];
    purchases = data.purchases || [];

    // Populate Dynamic Month Dropdowns
    populateMonthDropdowns();
    
    // Populate Datalists
    populateRetailerDatalist();
    populateSupplierDatalist();

    // Render current active states
    renderActiveTab();
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    showToast('Failed to load shop records. Please check server.');
  }
}

// Switch tabs
function switchTab(tabName) {
  activeTab = tabName;
  
  navTabs.forEach(t => {
    if (t.getAttribute('data-tab') === tabName) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });

  tabContents.forEach(content => {
    if (content.id === tabName) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  renderActiveTab();
}

// Render active tab contents
function renderActiveTab() {
  if (activeTab === 'dashboard') {
    renderDashboard();
  } else if (activeTab === 'retailers') {
    renderRetailers();
    if (btnPurchaseForecast.classList.contains('active')) {
      renderCustomerPredictions();
    }
  } else if (activeTab === 'prediction') {
    calculatePrediction();
  } else if (activeTab === 'statistics') {
    renderStatisticsTab();
  }
}

// Populate retailer datalist for auto-complete
function populateRetailerDatalist() {
  const uniqueRetailers = [...new Set(sales
    .map(s => s.Customer)
    .filter(name => name && name !== 'COUNTER SALES')
  )].sort();

  retailerListDatalist.innerHTML = '';
  uniqueRetailers.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    retailerListDatalist.appendChild(option);
  });
}

// Populate supplier datalist for auto-complete
function populateSupplierDatalist() {
  const uniqueSuppliers = [...new Set(purchases
    .map(p => p.Supplier)
    .filter(name => name)
  )].sort();

  supplierListDatalist.innerHTML = '';
  uniqueSuppliers.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    supplierListDatalist.appendChild(option);
  });
}

// Render Dashboard View
function renderDashboard() {
  const selectedMonth = dashboardMonthSelect.value;
  
  // Filter sales and purchases based on month
  let filteredSales = [];
  let filteredPurchases = [];

  if (selectedMonth === 'All Time') {
    filteredSales = sales;
    filteredPurchases = purchases;
  } else {
    filteredSales = sales.filter(s => s.Month === selectedMonth);
    filteredPurchases = purchases.filter(p => p.Month === selectedMonth);
  }

  // Calculate Totals
  const totalPurchases = filteredPurchases.reduce((sum, p) => sum + p.Net_Amount, 0);
  const totalSales = filteredSales.reduce((sum, s) => sum + s.Net_Amount, 0);
  const netMargin = totalSales - totalPurchases;

  // Update DOM Totals
  document.getElementById('totalPurchases').innerText = formatRupee(totalPurchases);
  document.getElementById('totalSales').innerText = formatRupee(totalSales);
  
  const profitCardVal = document.getElementById('netProfit');
  profitCardVal.innerText = formatRupee(netMargin);
  if (netMargin >= 0) {
    profitCardVal.style.color = 'var(--primary-color)';
  } else {
    profitCardVal.style.color = '#dc3545'; // Red for negative net flow
  }

  // Update card metadata
  document.getElementById('purchaseMeta').innerText = `${filteredPurchases.length} supplier invoices`;
  document.getElementById('salesMeta').innerText = `${filteredSales.length} retail invoices`;
  document.getElementById('profitMeta').innerText = netMargin >= 0 ? 'Cash surplus' : 'Inventory investment';

  // Balance progress bar logic
  const pBar = document.getElementById('pBarWidth');
  const sBar = document.getElementById('sBarWidth');
  const balanceText = document.getElementById('balanceText');

  if (totalPurchases === 0 && totalSales === 0) {
    pBar.style.width = '0%';
    sBar.style.width = '0%';
    balanceText.innerText = 'No transaction data for this period';
  } else {
    const totalMax = Math.max(totalPurchases, totalSales);
    const pPercent = (totalPurchases / totalMax) * 100;
    const sPercent = (totalSales / totalMax) * 100;

    pBar.style.width = `${pPercent}%`;
    sBar.style.width = `${sPercent}%`;
    
    if (totalPurchases > 0) {
      const ratio = ((totalSales / totalPurchases) * 100).toFixed(1);
      balanceText.innerText = `Sales cover ${ratio}% of purchase costs`;
    } else {
      balanceText.innerText = '100% sales profit (No purchases registered)';
    }
  }

  // Split details (Counter Sales vs Retailers)
  const counterSalesTotal = filteredSales
    .filter(s => s.Customer === 'COUNTER SALES')
    .reduce((sum, s) => sum + s.Net_Amount, 0);
  
  const retailerSalesTotal = totalSales - counterSalesTotal;
  
  document.getElementById('summaryCounterSales').innerText = formatRupee(counterSalesTotal);
  document.getElementById('summaryRetailerSales').innerText = formatRupee(retailerSalesTotal);
  
  // Season label
  const seasonLabel = document.getElementById('summarySeason');
  if (seasonLabel) {
    const matchingTrans = sales.find(s => s.Month === selectedMonth) || purchases.find(p => p.Month === selectedMonth);
    if (matchingTrans && matchingTrans.Season) {
      const cleanSeason = matchingTrans.Season.replace(' Demand', '');
      seasonLabel.innerText = cleanSeason;
      seasonLabel.className = 'summary-item-value badge';
      if (cleanSeason.includes('Kharif')) {
        seasonLabel.style.backgroundColor = 'var(--primary-light)';
        seasonLabel.style.color = 'var(--primary-color)';
      } else if (cleanSeason.includes('Rabi')) {
        seasonLabel.style.backgroundColor = 'var(--accent-light)';
        seasonLabel.style.color = 'var(--accent-hover)';
      } else {
        seasonLabel.style.backgroundColor = '#e8f5e9';
        seasonLabel.style.color = '#2e7d32';
      }
    } else {
      seasonLabel.innerText = selectedMonth === 'All Time' ? 'Combined' : 'N/A';
      seasonLabel.className = 'summary-item-value badge';
      seasonLabel.style.backgroundColor = '#e2e8f0';
      seasonLabel.style.color = '#475569';
    }
  }

  // Populate Recent Sales Table (limit to 7)
  const recentSalesBody = document.getElementById('recentSalesBody');
  recentSalesBody.innerHTML = '';
  
  const sortedRecent = [...filteredSales].sort((a,b) => new Date(b.Date) - new Date(a.Date));
  const displayCount = Math.min(sortedRecent.length, 7);

  if (displayCount === 0) {
    recentSalesBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No sales logged in this period. Click 'Record Sale' above.</td></tr>`;
  } else {
    for (let i = 0; i < displayCount; i++) {
      const s = sortedRecent[i];
      const row = document.createElement('tr');
      
      const badgeClass = s.Customer === 'COUNTER SALES' ? 'badge-counter' : 'badge-retailer';
      const customerTypeLabel = s.Customer === 'COUNTER SALES' ? 'Counter' : 'Retailer';

      row.innerHTML = `
        <td>${s.Date}</td>
        <td><code>${s.Voucher}</code></td>
        <td><strong>${s.Customer}</strong></td>
        <td><span class="badge-type ${badgeClass}">${customerTypeLabel}</span></td>
        <td class="text-right"><strong>${formatRupee(s.Net_Amount)}</strong></td>
      `;
      recentSalesBody.appendChild(row);
    }
  }

  // Populate Product Inventory Table
  const inventoryBody = document.getElementById('inventoryBody');
  if (inventoryBody) {
    inventoryBody.innerHTML = '';
    inventory.forEach(item => {
      const isLow = item.stock < item.minStock;
      const statusText = isLow ? 'Low Stock' : 'In Stock';
      const statusClass = isLow ? 'badge-overdue' : 'badge-active';
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${item.name}</strong></td>
        <td><span class="badge-type badge-retailer">${item.category}</span></td>
        <td class="text-center"><strong>${item.stock} Bags</strong></td>
        <td class="text-center"><span class="badge-status ${statusClass}">${statusText}</span></td>
        <td class="text-right"><strong>${formatRupee(item.stock * item.price)}</strong></td>
      `;
      inventoryBody.appendChild(row);
    });
  }
}

// Render Retailers List showing individual transactions (unsummed) with dates/months
function renderRetailers() {
  const searchTerm = retailerSearchInput.value.toLowerCase().trim();
  const selectedMonth = dashboardMonthSelect.value;
  
  // Filter sales based on customer existence
  let filteredSales = sales.filter(s => s.Customer);
  
  // Filter by selected month
  if (selectedMonth !== 'All Time') {
    filteredSales = filteredSales.filter(s => s.Month === selectedMonth);
  }
  
  // Filter by search query
  if (searchTerm) {
    filteredSales = filteredSales.filter(s => s.Customer.toLowerCase().includes(searchTerm));
  }

  // Sort chronologically (latest transactions first)
  filteredSales.sort((a, b) => new Date(b.Date) - new Date(a.Date));

  // Update DOM stats
  document.getElementById('totalRetailerCount').innerText = filteredSales.length;
  
  const topCustomerNameEl = document.getElementById('topCustomerName');
  const topCustomerAmountEl = document.getElementById('topCustomerAmount');

  if (filteredSales.length > 0) {
    topCustomerNameEl.innerText = filteredSales[0].Customer;
    topCustomerAmountEl.innerText = `${formatRupee(filteredSales[0].Net_Amount)} (Max Sale)`;
  } else {
    topCustomerNameEl.innerText = '-';
    topCustomerAmountEl.innerText = '₹0 (Max Sale)';
  }

  // Populate Retailers Table with unsummed transactions
  const retailersBody = document.getElementById('retailersBody');
  retailersBody.innerHTML = '';

  if (filteredSales.length === 0) {
    retailersBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No transactions found matching search and month selection.</td></tr>`;
  } else {
    filteredSales.forEach((s, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><span class="rank-badge" style="background-color: var(--primary-light); color: var(--primary-color);">${index + 1}</span></td>
        <td><strong>${s.Customer}</strong></td>
        <td class="text-center">${s.Date}</td>
        <td class="text-center">${s.Month}</td>
        <td class="text-right"><strong>${formatRupee(s.Net_Amount)}</strong></td>
        <td class="text-right">
          <button class="btn btn-sm btn-outline" onclick="triggerRetailerSale('${s.Customer.replace(/'/g, "\\'")}')">Add Sale</button>
        </td>
      `;
      retailersBody.appendChild(row);
    });
  }
}

// Action triggered from Retailers list: add sale for this retailer
window.triggerRetailerSale = function(retailerName) {
  if (retailerName === 'COUNTER SALES') {
    typeCounter.checked = true;
    customerInputGroup.style.display = 'none';
    customerNameInput.removeAttribute('required');
  } else {
    typeRetailer.checked = true;
    customerInputGroup.style.display = 'flex';
    customerNameInput.value = retailerName;
    customerNameInput.setAttribute('required', 'true');
  }
  switchTab('add-sale');
};

// Calculate and Render AI Prediction
// Calculate dynamic RAST model forecasts automatically matching the current calendar month
function calculatePrediction() {
  let salesGrowthRate = 0.125; // Fallback +12.5%
  let purchasesGrowthRate = 0.10; // Fallback +10%
  const bufferRate = 0.10;  // +10% safety buffer

  let predictedSales = 1663389;
  let predictedPurchases = 1663389;

  // Determine target predicted month dynamically based on dropdown selection
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  let selectedMonth = dashboardMonthSelect.value;
  if (!selectedMonth || selectedMonth === 'All Time') {
    const now = new Date();
    selectedMonth = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  }
  const [monthName, yearStr] = selectedMonth.split(' ');
  const year = parseInt(yearStr);

  const monthIdx = monthNames.indexOf(monthName);
  
  // Determine baseline (previous) month dynamically
  let prevMonthIdx = monthIdx - 1;
  let prevYear = year;
  if (prevMonthIdx < 0) {
    prevMonthIdx = 11;
    prevYear = year - 1;
  }
  const prevMonthName = monthNames[prevMonthIdx];
  const prevMonthStr = `${prevMonthName} ${prevYear}`;

  // Update headers and text in the predictions page dynamically
  const predHeaderEl = document.getElementById('predictionHeader');
  if (predHeaderEl) {
    predHeaderEl.innerText = `${selectedMonth} Demand Prediction`;
  }
  
  const fHeaderEl = document.getElementById('forecastHeader');
  if (fHeaderEl) {
    fHeaderEl.innerText = `Sales Channels Demand Forecast (${selectedMonth})`;
  }

  const fDescEl = document.getElementById('forecastDesc');
  if (fDescEl) {
    fDescEl.innerText = `Breakdown of predicted exact demand and recorded sales progress for ${selectedMonth}.`;
  }

  if (historicalData) {
    const histInput = historicalData.gst_summary.input;
    const histOutput = historicalData.gst_summary.output;

    const histSales = histOutput.map(r => r.Exempted + r.Taxable);
    const histPurchases = histInput.map(r => r.Exempted + r.Taxable);

    const avgSales = histSales.reduce((a,b) => a+b, 0) / 12;
    const avgPurchases = histPurchases.reduce((a,b) => a+b, 0) / 12;

    const salesSeasonalIndex = histSales[monthIdx] / avgSales;
    const purchasesSeasonalIndex = histPurchases[monthIdx] / avgPurchases;

    // Previous month baseline actuals (e.g. June 2026 data in June, or May 2026 baseline if predicting June)
    const baseSales2026 = sales.filter(s => s.Month === prevMonthStr).reduce((sum, s) => sum + s.Net_Amount, 0);
    const basePurchases2026 = purchases.filter(p => p.Month === prevMonthStr).reduce((sum, p) => sum + p.Net_Amount, 0);

    // Baseline actuals for last year (e.g. June 2025)
    const baseSales2025 = histSales[prevMonthIdx];
    const basePurchases2025 = histPurchases[prevMonthIdx];

    // Compute YoY growth trend dynamically
    const salesGrowthTrend = baseSales2025 > 0 && baseSales2026 > 0 ? (baseSales2026 / baseSales2025) : 1.055;
    const purchasesGrowthTrend = basePurchases2025 > 0 && basePurchases2026 > 0 ? (basePurchases2026 / basePurchases2025) : 1.055;

    predictedSales = avgSales * salesSeasonalIndex * salesGrowthTrend;
    predictedPurchases = avgPurchases * purchasesSeasonalIndex * purchasesGrowthTrend;

    salesGrowthRate = baseSales2026 > 0 ? (predictedSales - baseSales2026) / baseSales2026 : 0.125;
    purchasesGrowthRate = basePurchases2026 > 0 ? (predictedPurchases - basePurchases2026) / basePurchases2026 : 0.10;

    // Populate dynamic texts in the formulas
    const sIndexEl = document.getElementById('salesSeasonalIndexText');
    const pIndexEl = document.getElementById('purchasesSeasonalIndexText');
    const trendEl = document.getElementById('yoyGrowthTrendText');
    
    if (sIndexEl && pIndexEl && trendEl) {
      sIndexEl.innerText = `${salesSeasonalIndex.toFixed(2)} (${monthName} Index)`;
      pIndexEl.innerText = `${purchasesSeasonalIndex.toFixed(2)} (${monthName} Index)`;
      trendEl.innerText = `Sales: +${((salesGrowthTrend - 1) * 100).toFixed(1)}% | Purchases: +${((purchasesGrowthTrend - 1) * 100).toFixed(1)}%`;
    }

    // Update baseline analysers description card
    const baselineMonthTextEl = document.getElementById('baselineMonthText');
    if (baselineMonthTextEl) {
      baselineMonthTextEl.innerText = `${prevMonthStr} (Baseline Sales: ${formatRupee(Math.round(baseSales2026))})`;
    }
  }

  // Update UI values
  const projectedDemand = Math.round(predictedSales);
  const recommendedOrder = Math.round(projectedDemand * (1 + bufferRate));

  document.getElementById('predDemand').innerText = formatRupee(projectedDemand);
  document.getElementById('predOrder').innerText = formatRupee(recommendedOrder);
  
  const metaNoteEl = document.getElementById('predictionMetaNote');
  if (metaNoteEl) {
    metaNoteEl.innerHTML = `This recommendation is calculated to cover your expected sales of <strong>${formatRupee(projectedDemand)}</strong> plus a <strong>10%</strong> safety stock buffer.`;
  }

  // Dynamic Supplier Recommendations
  const supplierBaselines = [
    { name: 'PST TRADERS', amount: 707130, type: 'Within State' },
    { name: 'SRI AISHWARYA FEED', amount: 368165, type: 'Within State' },
    { name: 'DHARWAL FOOD', amount: 322850, type: 'Out of State' },
    { name: 'VIJAY NAGAR BIO', amount: 210000, type: 'Within State' },
    { name: 'KAMDHENU FEED', amount: 73900, type: 'Within State' }
  ];
  const totalSupplierMayPurchases = 1682045;

  const supplierRecBody = document.getElementById('supplierRecBody');
  if (supplierRecBody) {
    supplierRecBody.innerHTML = '';
    supplierBaselines.forEach(sup => {
      const ratio = sup.amount / totalSupplierMayPurchases;
      const recommendedAmount = recommendedOrder * ratio;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${sup.name}</strong></td>
        <td><span class="badge-type badge-retailer">${sup.type}</span></td>
        <td class="text-center text-muted">${(ratio * 100).toFixed(1)}%</td>
        <td class="text-right text-muted">${formatRupee(sup.amount)}</td>
        <td class="text-right highlight-col"><strong>${formatRupee(recommendedAmount)}</strong></td>
      `;
      supplierRecBody.appendChild(row);
    });
  }

  // Sales Channels Forecast progress calculations
  const prevMonthSales = sales.filter(s => s.Month === prevMonthStr);
  const prevCounterBaseline = prevMonthSales.filter(s => s.Customer === 'COUNTER SALES').reduce((sum, s) => sum + s.Net_Amount, 0) || 858762;
  const prevRetailerBaseline = prevMonthSales.filter(s => s.Customer !== 'COUNTER SALES').reduce((sum, s) => sum + s.Net_Amount, 0) || 619806;

  const counterPredVal = prevCounterBaseline * (1 + salesGrowthRate);
  const retailerPredVal = prevRetailerBaseline * (1 + salesGrowthRate);

  // Calculate actual recorded sales for current target month
  const currentMonthSales = sales.filter(s => s.Month === selectedMonth);
  const currentCounterRecorded = currentMonthSales.filter(s => s.Customer === 'COUNTER SALES').reduce((sum, s) => sum + s.Net_Amount, 0);
  const currentRetailerRecorded = currentMonthSales.filter(s => s.Customer !== 'COUNTER SALES').reduce((sum, s) => sum + s.Net_Amount, 0);

  // Update dynamic month labels on channel metrics
  document.getElementById('counterBaselineLabel').innerText = `${prevMonthName} Baseline`;
  document.getElementById('counterPredLabel').innerText = `${monthName} Exact Prediction`;
  document.getElementById('counterRecordedLabel').innerText = `${monthName} Recorded`;

  document.getElementById('retailerBaselineLabel').innerText = `${prevMonthName} Baseline`;
  document.getElementById('retailerPredLabel').innerText = `${monthName} Exact Prediction`;
  document.getElementById('retailerRecordedLabel').innerText = `${monthName} Recorded`;

  // Update DOM elements for channel baselines and predictions
  document.getElementById('counterMayBaseline').innerText = formatRupee(prevCounterBaseline);
  document.getElementById('counterJunePred').innerText = formatRupee(counterPredVal);
  document.getElementById('counterJuneRecorded').innerText = formatRupee(currentCounterRecorded);

  document.getElementById('retailerMayBaseline').innerText = formatRupee(prevRetailerBaseline);
  document.getElementById('retailerJunePred').innerText = formatRupee(retailerPredVal);
  document.getElementById('retailerJuneRecorded').innerText = formatRupee(currentRetailerRecorded);

  // Progress Bar widths & text
  const counterPct = Math.min(100, Math.round((currentCounterRecorded / counterPredVal) * 100)) || 0;
  const retailerPct = Math.min(100, Math.round((currentRetailerRecorded / retailerPredVal) * 100)) || 0;

  document.getElementById('counterProgressPercent').innerText = `${counterPct}%`;
  document.getElementById('counterProgressAmt').innerText = `${formatRupee(currentCounterRecorded)} of ${formatRupee(counterPredVal)}`;
  document.getElementById('counterProgressBar').style.width = `${counterPct}%`;

  document.getElementById('retailerProgressPercent').innerText = `${retailerPct}%`;
  document.getElementById('retailerProgressAmt').innerText = `${formatRupee(currentRetailerRecorded)} of ${formatRupee(retailerPredVal)}`;
  document.getElementById('retailerProgressBar').style.width = `${retailerPct}%`;

  // Daily run rate needed
  const currentDayNum = now.getDate();
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemainingVal = Math.max(1, totalDaysInMonth - currentDayNum);

  const counterRemaining = counterPredVal - currentCounterRecorded;
  const counterPaceEl = document.getElementById('counterPace');
  if (counterPaceEl) {
    if (counterRemaining <= 0) {
      counterPaceEl.innerText = 'Target Achieved!';
      counterPaceEl.style.color = 'var(--success-color)';
    } else {
      counterPaceEl.innerText = `Pace: ${formatRupee(Math.round(counterRemaining / daysRemainingVal))}/day needed`;
      counterPaceEl.style.color = 'var(--text-muted)';
    }
  }

  const retailerRemaining = retailerPredVal - currentRetailerRecorded;
  const retailerPaceEl = document.getElementById('retailerPace');
  if (retailerPaceEl) {
    if (retailerRemaining <= 0) {
      retailerPaceEl.innerText = 'Target Achieved!';
      retailerPaceEl.style.color = 'var(--success-color)';
    } else {
      retailerPaceEl.innerText = `Pace: ${formatRupee(Math.round(retailerRemaining / daysRemainingVal))}/day needed`;
      retailerPaceEl.style.color = 'var(--text-muted)';
    }
  }
}

// Dynamically populate month options in select dropdowns based on calendar progress
function populateMonthDropdowns() {
  const monthSelect = document.getElementById('dashboardMonth');
  if (!monthSelect) return;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // We start at May 2026
  const startMonthIdx = 4; // May
  const startYear = 2026;

  // We go up to the current system date's month and year
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();

  // Find all unique months present in sales and purchases to make sure we don't miss anything
  const transactionMonths = new Set();
  sales.forEach(s => { if (s.Month) transactionMonths.add(s.Month); });
  purchases.forEach(p => { if (p.Month) transactionMonths.add(p.Month); });

  // Generate sequence of months from May 2026 to current calendar month
  const options = [];
  let y = startYear;
  let m = startMonthIdx;

  while (y < currentYear || (y === currentYear && m <= currentMonthIdx)) {
    const monthStr = `${monthNames[m]} ${y}`;
    options.push(monthStr);
    
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }

  // Also add any other months that exist in the transactions but are outside the range
  transactionMonths.forEach(mStr => {
    if (!options.includes(mStr)) {
      options.push(mStr);
    }
  });

  // Sort options chronologically (May 2026, June 2026, July 2026, etc.)
  options.sort((a, b) => {
    const [ma, ya] = a.split(' ');
    const [mb, yb] = b.split(' ');
    const ia = monthNames.indexOf(ma) + parseInt(ya) * 12;
    const ib = monthNames.indexOf(mb) + parseInt(yb) * 12;
    return ia - ib;
  });

  // Save the currently selected value if any
  const previousValue = monthSelect.value;

  // Clear existing options
  monthSelect.innerHTML = '';

  const currentMonthStr = `${monthNames[currentMonthIdx]} ${currentYear}`;
  
  options.forEach(mStr => {
    const opt = document.createElement('option');
    opt.value = mStr;
    
    // Label
    if (mStr === 'May 2026') {
      opt.innerText = `${mStr} (Baseline)`;
    } else if (mStr === currentMonthStr) {
      opt.innerText = `${mStr} (Current Month)`;
    } else {
      opt.innerText = mStr;
    }
    
    monthSelect.appendChild(opt);
  });

  // Add All Time option
  const optAll = document.createElement('option');
  optAll.value = 'All Time';
  optAll.innerText = 'All Time Summary';
  monthSelect.appendChild(optAll);

  // Set default selection
  if (previousValue && options.includes(previousValue)) {
    monthSelect.value = previousValue;
  } else if (options.includes(currentMonthStr)) {
    monthSelect.value = currentMonthStr;
  } else {
    monthSelect.value = options[options.length - 1];
  }
}

// Predict individual customer purchases and render forecast list
function renderCustomerPredictions() {
  const searchTerm = retailerSearchInput.value.toLowerCase().trim();

  // Include all customer sales, including counter value
  const retailerSalesOnly = sales.filter(s => s.Customer);

  // Group sales by customer
  const customerSalesMap = {};
  retailerSalesOnly.forEach(s => {
    if (!customerSalesMap[s.Customer]) {
      customerSalesMap[s.Customer] = [];
    }
    customerSalesMap[s.Customer].push(s);
  });

  const today = new Date('2026-06-10'); // Simulated today date
  const forecastDataList = [];

  Object.keys(customerSalesMap).forEach(customerName => {
    if (searchTerm && !customerName.toLowerCase().includes(searchTerm)) {
      return;
    }

    const customerSales = customerSalesMap[customerName];

    // Sort by date ascending
    customerSales.sort((a, b) => new Date(a.Date) - new Date(b.Date));

    // Calculate intervals between consecutive purchases
    let totalIntervalDays = 0;
    let intervalCount = 0;

    for (let i = 1; i < customerSales.length; i++) {
      const diffTime = new Date(customerSales[i].Date) - new Date(customerSales[i - 1].Date);
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (diffDays > 0) {
        totalIntervalDays += diffDays;
        intervalCount++;
      }
    }

    // Fallback if less than 2 purchases
    const avgInterval = intervalCount > 0 ? (totalIntervalDays / intervalCount) : 10;

    // Calculate average amount
    const totalAmount = customerSales.reduce((sum, s) => sum + s.Net_Amount, 0);
    const avgAmount = totalAmount / customerSales.length;

    // Predict exact purchase amount with 12.5% Kharif increase
    const predictedAmount = Math.round(avgAmount * 1.125);

    // Last purchase date
    const lastPurchase = customerSales[customerSales.length - 1];
    const lastPurchaseDate = new Date(lastPurchase.Date);

    // Predict next purchase date
    const nextPurchaseDate = new Date(lastPurchaseDate.getTime() + avgInterval * 24 * 60 * 60 * 1000);

    // Format next purchase date YYYY-MM-DD
    const yyyy = nextPurchaseDate.getFullYear();
    const mm = String(nextPurchaseDate.getMonth() + 1).padStart(2, '0');
    const dd = String(nextPurchaseDate.getDate()).padStart(2, '0');
    const formattedNextDate = `${yyyy}-${mm}-${dd}`;

    // Calculate status relative to simulated today (2026-06-10)
    const diffFromToday = Math.ceil((nextPurchaseDate - today) / (1000 * 60 * 60 * 24));

    let status = 'Active';
    let statusClass = 'badge-active';
    let statusWeight = 3;

    if (diffFromToday < 0) {
      status = 'Overdue';
      statusClass = 'badge-overdue';
      statusWeight = 0;
    } else if (diffFromToday === 0) {
      status = 'Due Today';
      statusClass = 'badge-due-today';
      statusWeight = 1;
    } else if (diffFromToday <= 2) {
      status = 'Due Soon';
      statusClass = 'badge-due-soon';
      statusWeight = 2;
    }

    forecastDataList.push({
      name: customerName,
      avgInterval: Math.round(avgInterval),
      lastDate: lastPurchase.Date,
      nextDate: formattedNextDate,
      nextAmount: predictedAmount,
      status: status,
      statusClass: statusClass,
      statusWeight: statusWeight
    });
  });

  // Sort: Overdue (0) -> Due Today (1) -> Due Soon (2) -> Active (3)
  forecastDataList.sort((a, b) => {
    if (a.statusWeight !== b.statusWeight) {
      return a.statusWeight - b.statusWeight;
    }
    return b.nextAmount - a.nextAmount;
  });

  // Render forecast table
  forecastBody.innerHTML = '';
  if (forecastDataList.length === 0) {
    forecastBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No matching retailer forecasts.</td></tr>`;
  } else {
    forecastDataList.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${item.name}</strong></td>
        <td class="text-center">Every ${item.avgInterval} days</td>
        <td class="text-center">${item.lastDate}</td>
        <td class="text-center"><strong>${item.nextDate}</strong></td>
        <td class="text-right"><strong>${formatRupee(item.nextAmount)}</strong></td>
        <td class="text-center"><span class="badge-status ${item.statusClass}">${item.status}</span></td>
        <td class="text-right">
          <button class="btn btn-sm btn-outline" onclick="triggerRetailerSale('${item.name.replace(/'/g, "\\'")}')">Add Sale</button>
        </td>
      `;
      forecastBody.appendChild(row);
    });
  }
}

// Handle Sale Submission
async function handleSaleSubmit(e) {
  e.preventDefault();
  
  const isCounter = typeCounter.checked;
  const customer = isCounter ? 'COUNTER SALES' : customerNameInput.value.trim();
  const amount = parseFloat(document.getElementById('saleAmount').value);
  const date = saleDateInput.value;

  if (!customer) {
    showToast('Please specify a retailer name.');
    return;
  }
  
  if (isNaN(amount) || amount <= 0) {
    showToast('Please enter a valid sale amount.');
    return;
  }

  const submitButton = document.getElementById('btnSubmitSale');
  submitButton.disabled = true;
  submitButton.innerText = 'Saving...';

  try {
    const response = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Customer: customer,
        Date: date,
        Net_Amount: amount,
        Customer_Type: isCounter ? 'Walk-in' : 'Retailer/Wholesaler'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to save sale');
    }

    const savedSale = await response.json();
    
    // Success State
    showToast(`Bill ${savedSale.Voucher} saved for ${customer}!`);
    
    // Reset form
    document.getElementById('saleAmount').value = '';
    if (!isCounter) {
      customerNameInput.value = '';
    }

    // Refresh Data
    await fetchData();

    // Select the month of the saved transaction in dashboard dropdown so they see it
    dashboardMonthSelect.value = monthStr;

    // Switch to dashboard tab to view
    setTimeout(() => {
      switchTab('dashboard');
    }, 1000);

  } catch (err) {
    console.error('Error saving sale:', err);
    showToast(err.message || 'Error occurred while saving.');
  } finally {
    submitButton.disabled = false;
    submitButton.innerText = 'Save Daily Sale';
  }
}

// Show toast helper
let toastTimeout;
function showToast(message) {
  clearTimeout(toastTimeout);
  toastMessageElement.innerText = message;
  toastElement.classList.add('show');
  
  toastTimeout = setTimeout(() => {
    toastElement.classList.remove('show');
  }, 3000);
}

// Handle Purchase Submission
async function handlePurchaseSubmit(e) {
  e.preventDefault();
  
  const supplier = purchaseSupplierInput.value.trim();
  const invoice = document.getElementById('purchaseInvoice').value.trim();
  const amount = parseFloat(document.getElementById('purchaseAmount').value);
  const date = purchaseDateInput.value;
  const type = document.querySelector('input[name="purchaseType"]:checked').value;

  if (!supplier) {
    showToast('Please specify a supplier name.');
    return;
  }
  
  if (isNaN(amount) || amount <= 0) {
    showToast('Please enter a valid purchase amount.');
    return;
  }

  const submitButton = document.getElementById('btnSubmitPurchase');
  submitButton.disabled = true;
  submitButton.innerText = 'Saving...';

  try {
    const response = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Supplier: supplier,
        Date: date,
        Invoice: invoice,
        Net_Amount: amount,
        Type: type
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to save purchase');
    }

    const savedPur = await response.json();
    
    // Success State
    showToast(`Invoice ${savedPur.Invoice} (${savedPur.Voucher}) saved!`);
    
    // Reset form
    purchaseSupplierInput.value = '';
    document.getElementById('purchaseInvoice').value = '';
    document.getElementById('purchaseAmount').value = '';

    // Refresh Data
    await fetchData();

    // Select the month of the saved transaction in dashboard dropdown
    dashboardMonthSelect.value = monthStr;

    // Switch to dashboard tab to view
    setTimeout(() => {
      switchTab('dashboard');
    }, 1000);

  } catch (err) {
    console.error('Error saving purchase:', err);
    showToast(err.message || 'Error occurred while saving purchase.');
  } finally {
    submitButton.disabled = false;
    submitButton.innerText = 'Save Supplier Purchase';
  }
}

// Render YoY & MoM detailed comparison with pictorial progress stats
function renderYoYMoM() {
  if (!historicalData) return;

  const selectedMonth = dashboardMonthSelect.value;
  const yoyMomSec = document.getElementById('yoyMomSection');
  if (!yoyMomSec) return;

  if (selectedMonth === 'All Time') {
    yoyMomSec.style.display = 'none';
    return;
  }
  yoyMomSec.style.display = 'block';

  const [monthName, yearStr] = selectedMonth.split(' ');
  const year = parseInt(yearStr);

  // 1. Current Month values
  const currentSales = sales.filter(s => s.Month === selectedMonth).reduce((sum, s) => sum + s.Net_Amount, 0);
  const currentPurchases = purchases.filter(p => p.Month === selectedMonth).reduce((sum, p) => sum + p.Net_Amount, 0);

  // 2. Previous Month values
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthIdx = monthNames.indexOf(monthName);
  let prevMonthIdx = monthIdx - 1;
  let prevYear = year;
  if (prevMonthIdx < 0) {
    prevMonthIdx = 11;
    prevYear = year - 1;
  }
  const prevMonthName = monthNames[prevMonthIdx];
  const prevMonthStr = `${prevMonthName} ${prevYear}`;

  const prevSales = sales.filter(s => s.Month === prevMonthStr).reduce((sum, s) => sum + s.Net_Amount, 0);
  const prevPurchases = purchases.filter(p => p.Month === prevMonthStr).reduce((sum, p) => sum + p.Net_Amount, 0);

  // 3. Previous Year Current Month values
  function toHistKey(mName, yVal) {
    const abbr = mName.substring(0, 3);
    return `${abbr} - ${yVal}`;
  }
  const targetKeyPrevYear = toHistKey(monthName, year - 1);
  const prevKeyPrevYear = toHistKey(prevMonthName, prevYear - 1);

  const histInput = historicalData.gst_summary.input;
  const histOutput = historicalData.gst_summary.output;

  const prevYearSalesRec = histOutput.find(r => r["Month-Year"] === targetKeyPrevYear);
  const prevYearSales = prevYearSalesRec ? (prevYearSalesRec.Exempted + prevYearSalesRec.Taxable) : 0;

  const prevYearPurRec = histInput.find(r => r["Month-Year"] === targetKeyPrevYear);
  const prevYearPurchases = prevYearPurRec ? (prevYearPurRec.Exempted + prevYearPurRec.Taxable) : 0;

  // 4. Update Labels
  document.getElementById('salesYoYLabelCurrent').innerText = `Sales (${selectedMonth})`;
  document.getElementById('salesYoYLabelPrevious').innerText = `Sales (${monthName} ${year - 1})`;
  document.getElementById('purchasesYoYLabelCurrent').innerText = `Purchases (${selectedMonth})`;
  document.getElementById('purchasesYoYLabelPrevious').innerText = `Purchases (${monthName} ${year - 1})`;

  document.getElementById('salesMoMLabelCurrent').innerText = `Sales (${selectedMonth})`;
  document.getElementById('salesMoMLabelPrevious').innerText = `Sales (${prevMonthStr})`;
  document.getElementById('purchasesMoMLabelCurrent').innerText = `Purchases (${selectedMonth})`;
  document.getElementById('purchasesMoMLabelPrevious').innerText = `Purchases (${prevMonthStr})`;

  // 5. Update Values
  document.getElementById('salesYoYCurrent').innerText = formatRupee(currentSales);
  document.getElementById('salesYoYPrevious').innerText = formatRupee(prevYearSales);
  document.getElementById('purchasesYoYCurrent').innerText = formatRupee(currentPurchases);
  document.getElementById('purchasesYoYPrevious').innerText = formatRupee(prevYearPurchases);

  document.getElementById('salesMoMCurrent').innerText = formatRupee(currentSales);
  document.getElementById('salesMoMPrevious').innerText = formatRupee(prevSales);
  document.getElementById('purchasesMoMCurrent').innerText = formatRupee(currentPurchases);
  document.getElementById('purchasesMoMPrevious').innerText = formatRupee(prevPurchases);

  // 6. Calculate Growth Rates & Update UI
  function updateComparison(current, previous, rateElId, barElId) {
    let rateText = 'N/A';
    let percent = 0;
    
    if (previous > 0) {
      const growth = ((current - previous) / previous) * 100;
      const sign = growth >= 0 ? '+' : '';
      rateText = `${sign}${growth.toFixed(1)}%`;
      percent = Math.min(100, Math.round((current / previous) * 100));
      
      const rateEl = document.getElementById(rateElId);
      rateEl.innerText = `${rateText} YoY`;
      if (rateElId.includes('MoM')) {
        rateEl.innerText = `${rateText} MoM`;
      }
      
      if (growth >= 0) {
        rateEl.style.color = 'var(--success-color)';
        rateEl.style.fontWeight = '700';
      } else {
        rateEl.style.color = '#dc3545'; // red
        rateEl.style.fontWeight = '700';
      }
    } else {
      document.getElementById(rateElId).innerText = rateText;
      document.getElementById(rateElId).style.color = 'var(--text-muted)';
    }
    
    document.getElementById(barElId).style.width = `${percent}%`;
  }

  updateComparison(currentSales, prevYearSales, 'salesYoYRate', 'salesYoYBar');
  updateComparison(currentPurchases, prevYearPurchases, 'purchasesYoYRate', 'purchasesYoYBar');
  
  updateComparison(currentSales, prevSales, 'salesMoMRate', 'salesMoMBar');
  updateComparison(currentPurchases, prevPurchases, 'purchasesMoMRate', 'purchasesMoMBar');
}

// Render Interactive Annual Trends Line Graph showing last year baseline vs current live progress
function renderTrendChart() {
  if (!historicalData) return;
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;

  const monthNames = [
    "April", "May", "June", "July", "August", "September",
    "October", "November", "December", "January", "February", "March"
  ];

  const monthLabels = [
    "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"
  ];

  // Extract 12 months historical (FY 2025-2026)
  const salesHist = historicalData.gst_summary.output.map(r => r.Exempted + r.Taxable);
  const purchasesHist = historicalData.gst_summary.input.map(r => r.Exempted + r.Taxable);

  // Group current year sales & purchases (FY 2026-2027) dynamically
  const currentSalesByMonth = new Array(12).fill(null);
  const currentPurchasesByMonth = new Array(12).fill(null);

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();

  monthNames.forEach((mName, idx) => {
    // Map idx (0 = Apr, 1 = May, etc.) to calendar year: Apr-Dec is 2026, Jan-Mar is 2027
    const calendarYear = idx < 9 ? 2026 : 2027;
    const calendarMonthIdx = (idx + 3) % 12; // April (3), Jan (0)

    let isPastOrCurrent = false;
    if (calendarYear < nowYear) {
      isPastOrCurrent = true;
    } else if (calendarYear === nowYear && calendarMonthIdx <= nowMonth) {
      isPastOrCurrent = true;
    }

    if (isPastOrCurrent) {
      const monthStr = `${mName} ${calendarYear}`;
      const salesSum = sales.filter(s => s.Month === monthStr).reduce((sum, s) => sum + s.Net_Amount, 0);
      const purchasesSum = purchases.filter(p => p.Month === monthStr).reduce((sum, p) => sum + p.Net_Amount, 0);
      
      currentSalesByMonth[idx] = salesSum;
      currentPurchasesByMonth[idx] = purchasesSum;
    }
  });

  if (trendChart) {
    trendChart.destroy();
  }

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthLabels,
      datasets: [
        {
          label: 'Sales (Last Year FY 25-26)',
          data: salesHist,
          borderColor: 'rgba(16, 185, 129, 0.45)', // faded green
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 2,
          fill: false
        },
        {
          label: 'Sales (Current Year FY 26-27)',
          data: currentSalesByMonth,
          borderColor: '#10b981', // solid green
          backgroundColor: 'rgba(16, 185, 129, 0.04)',
          borderWidth: 3.5,
          pointRadius: 4,
          pointBackgroundColor: '#10b981',
          tension: 0.35,
          fill: true
        },
        {
          label: 'Purchases (Last Year FY 25-26)',
          data: purchasesHist,
          borderColor: 'rgba(59, 130, 246, 0.45)', // faded blue
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 2,
          fill: false
        },
        {
          label: 'Purchases (Current Year FY 26-27)',
          data: currentPurchasesByMonth,
          borderColor: '#3b82f6', // solid blue
          backgroundColor: 'rgba(59, 130, 246, 0.04)',
          borderWidth: 3.5,
          pointRadius: 4,
          pointBackgroundColor: '#3b82f6',
          tension: 0.35,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: 'Inter', size: 11, weight: '500' },
            boxWidth: 12,
            padding: 12
          }
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleFont: { family: 'Outfit', size: 13, weight: '600' },
          bodyFont: { family: 'Inter', size: 12 },
          padding: 10,
          boxPadding: 5,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label.split(' ')[0] || '';
              if (label) {
                label += ' ' + (context.dataset.label.includes('Current') ? '(26-27)' : '(25-26)') + ': ';
              }
              if (context.parsed.y !== null) {
                label += rupeeFormatter.format(context.parsed.y);
              }
              return label;
            }
          }
        }
      },
      scales: {
        y: {
          grid: { color: '#f1f5f9' },
          ticks: {
            font: { family: 'Inter', size: 11 },
            color: '#64748b',
            callback: function(value) {
              return '₹' + (value / 100000).toFixed(1) + 'L';
            }
          }
        },
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'Inter', size: 11 },
            color: '#64748b'
          }
        }
      }
    }
  });
}

// Render Analytics & Statistics tab containing Charts and metric summaries
function renderStatisticsTab() {
  if (!historicalData) return;

  // Render the trend line chart and YoY/MoM comparisons
  renderTrendChart();
  renderYoYMoM();

  const monthNames = [
    "April", "May", "June", "July", "August", "September",
    "October", "November", "December", "January", "February", "March"
  ];
  
  const shortMonthLabels = [
    "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"
  ];

  // Extract 12 months historical (FY 2025-2026)
  const salesHist = historicalData.gst_summary.output.map(r => r.Exempted + r.Taxable);
  const purchasesHist = historicalData.gst_summary.input.map(r => r.Exempted + r.Taxable);

  // Group current year sales & purchases (FY 2026-2027) dynamically
  const currentSalesByMonth = new Array(12).fill(null);
  const currentPurchasesByMonth = new Array(12).fill(null);

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();

  monthNames.forEach((mName, idx) => {
    const calendarYear = idx < 9 ? 2026 : 2027;
    const calendarMonthIdx = (idx + 3) % 12;

    let isPastOrCurrent = false;
    if (calendarYear < nowYear) {
      isPastOrCurrent = true;
    } else if (calendarYear === nowYear && calendarMonthIdx <= nowMonth) {
      isPastOrCurrent = true;
    }

    if (isPastOrCurrent) {
      const monthStr = `${mName} ${calendarYear}`;
      const salesSum = sales.filter(s => s.Month === monthStr).reduce((sum, s) => sum + s.Net_Amount, 0);
      const purchasesSum = purchases.filter(p => p.Month === monthStr).reduce((sum, p) => sum + p.Net_Amount, 0);
      
      currentSalesByMonth[idx] = salesSum;
      currentPurchasesByMonth[idx] = purchasesSum;
    }
  });

  // Calculate Metric Summaries using active current year data
  const totalSalesVal = currentSalesByMonth.reduce((a,b) => a ? a+b : b, 0) || 0;
  const totalPurVal = currentPurchasesByMonth.reduce((a,b) => a ? a+b : b, 0) || 0;
  
  const activeMonthsCount = Math.max(1, currentSalesByMonth.filter((v, i) => v !== null || currentPurchasesByMonth[i] !== null).length);
  const avgSalesVal = Math.round(totalSalesVal / activeMonthsCount);
  const avgPurVal = Math.round(totalPurVal / activeMonthsCount);

  // Find Peak Month in current year
  let maxSales = 0;
  let maxMonthIdx = 0;
  currentSalesByMonth.forEach((val, idx) => {
    if (val !== null && val > maxSales) {
      maxSales = val;
      maxMonthIdx = idx;
    }
  });

  // Update UI cards
  document.getElementById('statsAvgSales').innerText = formatRupee(avgSalesVal);
  document.getElementById('statsAvgPurchases').innerText = formatRupee(avgPurVal);
  document.getElementById('statsPeakMonth').innerText = `${monthNames[maxMonthIdx]} 2026 (₹${(maxSales/100000).toFixed(1)}L)`;

  // 2. Bar Chart: Sales vs Purchases Comparison (Shows last year vs this year side-by-side)
  const barCtx = document.getElementById('statsBarChart');
  if (barCtx) {
    if (statsBarChart) statsBarChart.destroy();
    statsBarChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: shortMonthLabels,
        datasets: [
          {
            label: 'Sales (Last Year)',
            data: salesHist,
            backgroundColor: 'rgba(16, 185, 129, 0.3)', // faded green
            borderColor: 'rgba(16, 185, 129, 0.5)',
            borderWidth: 1,
            borderRadius: 3
          },
          {
            label: 'Sales (Current Year)',
            data: currentSalesByMonth,
            backgroundColor: '#10b981', // solid green
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 3
          },
          {
            label: 'Purchases (Last Year)',
            data: purchasesHist,
            backgroundColor: 'rgba(59, 130, 246, 0.3)', // faded blue
            borderColor: 'rgba(59, 130, 246, 0.5)',
            borderWidth: 1,
            borderRadius: 3
          },
          {
            label: 'Purchases (Current Year)',
            data: currentPurchasesByMonth,
            backgroundColor: '#3b82f6', // solid blue
            borderColor: '#3b82f6',
            borderWidth: 1,
            borderRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Inter', size: 10 } } },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + rupeeFormatter.format(context.raw);
              }
            }
          }
        },
        scales: {
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { family: 'Inter', size: 10 },
              callback: function(value) { return '₹' + (value/100000).toFixed(1) + 'L'; }
            }
          },
          x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 } } }
        }
      }
    });
  }

  // 3. Radar Chart: Seasonal Demand Comparison
  // Seasons: Kharif (Jun-Oct), Rabi (Nov-Feb), Summer (Mar-May)
  // Last Year values
  const lastYearKharifSales = salesHist.slice(2, 7).reduce((a,b) => a+b, 0);
  const lastYearKharifPurchases = purchasesHist.slice(2, 7).reduce((a,b) => a+b, 0);
  const lastYearRabiSales = salesHist.slice(7, 11).reduce((a,b) => a+b, 0);
  const lastYearRabiPurchases = purchasesHist.slice(7, 11).reduce((a,b) => a+b, 0);
  const lastYearSummerSales = salesHist[11] + salesHist[0] + salesHist[1];
  const lastYearSummerPurchases = purchasesHist[11] + purchasesHist[0] + purchasesHist[1];

  // Current Year values
  const currentKharifSales = currentSalesByMonth.slice(2, 7).reduce((a,b) => a + (b || 0), 0);
  const currentKharifPurchases = currentPurchasesByMonth.slice(2, 7).reduce((a,b) => a + (b || 0), 0);
  const currentRabiSales = currentSalesByMonth.slice(7, 11).reduce((a,b) => a + (b || 0), 0);
  const currentRabiPurchases = currentPurchasesByMonth.slice(7, 11).reduce((a,b) => a + (b || 0), 0);
  const currentSummerSales = (currentSalesByMonth[11] || 0) + (currentSalesByMonth[0] || 0) + (currentSalesByMonth[1] || 0);
  const currentSummerPurchases = (currentPurchasesByMonth[11] || 0) + (currentPurchasesByMonth[0] || 0) + (currentPurchasesByMonth[1] || 0);

  const radarCtx = document.getElementById('statsRadarChart');
  if (radarCtx) {
    if (statsRadarChart) statsRadarChart.destroy();
    statsRadarChart = new Chart(radarCtx, {
      type: 'radar',
      data: {
        labels: ['Kharif Season (Jun-Oct)', 'Rabi Season (Nov-Feb)', 'Summer Season (Mar-May)'],
        datasets: [
          {
            label: 'Sales Demand (Last Year)',
            data: [lastYearKharifSales, lastYearRabiSales, lastYearSummerSales],
            backgroundColor: 'rgba(16, 185, 129, 0.03)',
            borderColor: 'rgba(16, 185, 129, 0.4)',
            borderWidth: 1.5,
            borderDash: [3, 3],
            pointBackgroundColor: 'rgba(16, 185, 129, 0.4)'
          },
          {
            label: 'Sales Demand (Current Year)',
            data: [currentKharifSales, currentRabiSales, currentSummerSales],
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            borderColor: '#10b981',
            borderWidth: 2.5,
            pointBackgroundColor: '#10b981'
          },
          {
            label: 'Purchase Expenses (Last Year)',
            data: [lastYearKharifPurchases, lastYearRabiPurchases, lastYearSummerPurchases],
            backgroundColor: 'rgba(59, 130, 246, 0.03)',
            borderColor: 'rgba(59, 130, 246, 0.4)',
            borderWidth: 1.5,
            borderDash: [3, 3],
            pointBackgroundColor: 'rgba(59, 130, 246, 0.4)'
          },
          {
            label: 'Purchase Expenses (Current Year)',
            data: [currentKharifPurchases, currentRabiPurchases, currentSummerPurchases],
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderColor: '#3b82f6',
            borderWidth: 2.5,
            pointBackgroundColor: '#3b82f6'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Inter', size: 11 } } },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + rupeeFormatter.format(context.raw);
              }
            }
          }
        },
        scales: {
          r: {
            ticks: { display: false },
            pointLabels: { font: { family: 'Outfit', size: 11, weight: '600' } }
          }
        }
      }
    });
  }

  // 4. Pie Chart: Customer Distribution Share
  let counterTotal = sales.filter(s => s.Customer === 'COUNTER SALES').reduce((a,b) => a + b.Net_Amount, 0);
  let retailerTotal = sales.filter(s => s.Customer !== 'COUNTER SALES').reduce((a,b) => a + b.Net_Amount, 0);
  
  if (counterTotal === 0 && retailerTotal === 0) {
    counterTotal = 858762;
    retailerTotal = 619806;
  }

  const pieCtx = document.getElementById('statsPieChart');
  if (pieCtx) {
    if (statsPieChart) statsPieChart.destroy();
    statsPieChart = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: ['Counter Sales (Walk-ins)', 'Regular Retailer Ledgers'],
        datasets: [{
          data: [counterTotal, retailerTotal],
          backgroundColor: ['#0f766e', '#3b82f6'], // Teal and Blue
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { family: 'Inter', size: 11 } } },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw;
                const total = counterTotal + retailerTotal;
                const percentage = ((value / total) * 100).toFixed(1);
                return context.label + ': ' + rupeeFormatter.format(value) + ' (' + percentage + '%)';
              }
            }
          }
        }
      }
    });
  }

  // 5. Supplier Allocation Share
  const supplierSums = {};
  purchases.forEach(p => {
    if (p.Supplier) {
      supplierSums[p.Supplier] = (supplierSums[p.Supplier] || 0) + p.Net_Amount;
    }
  });

  let supplierLabels = Object.keys(supplierSums);
  let supplierData = Object.values(supplierSums);

  if (supplierLabels.length === 0) {
    supplierLabels = ['PST TRADERS', 'SRI AISHWARYA FEED', 'DHARWAL FOOD', 'VIJAY NAGAR BIO', 'KAMDHENU FEED'];
    supplierData = [707130, 368165, 322850, 210000, 73900];
  }

  const supCtx = document.getElementById('statsSupplierChart');
  if (supCtx) {
    if (statsSupplierChart) statsSupplierChart.destroy();
    statsSupplierChart = new Chart(supCtx, {
      type: 'pie',
      data: {
        labels: supplierLabels,
        datasets: [{
          data: supplierData,
          backgroundColor: ['#1e3a8a', '#10b981', '#f59e0b', '#3b82f6', '#0f766e'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { family: 'Inter', size: 10 } } },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw;
                const total = supplierData.reduce((a,b)=>a+b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return context.label + ': ' + rupeeFormatter.format(value) + ' (' + percentage + '%)';
              }
            }
          }
        }
      }
    });
  }
}




// App State
let sales = [];
let purchases = [];
let activeTab = 'dashboard';

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
  // Set default date to today (June 10, 2026 in metadata)
  const today = new Date('2026-06-10');
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
  if (selectedMonth === 'May 2026') {
    seasonLabel.innerText = 'Summer (Low)';
    seasonLabel.className = 'summary-item-value badge';
  } else if (selectedMonth === 'June 2026') {
    seasonLabel.innerText = 'Kharif (High)';
    seasonLabel.className = 'summary-item-value badge';
    seasonLabel.style.backgroundColor = 'var(--primary-light)';
    seasonLabel.style.color = 'var(--primary-color)';
  } else {
    seasonLabel.innerText = 'Combined';
    seasonLabel.className = 'summary-item-value badge';
    seasonLabel.style.backgroundColor = '#e2e8f0';
    seasonLabel.style.color = '#475569';
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

  // Render YoY & MoM Detailed Analysis
  renderYoYMoM();
}

// Render Retailers List
function renderRetailers() {
  const searchTerm = retailerSearchInput.value.toLowerCase().trim();
  
  // Include all customer sales, including counter value
  const retailerSalesOnly = sales.filter(s => s.Customer);
  
  // Group sales by retailer
  const customerSummary = {};
  retailerSalesOnly.forEach(s => {
    if (!customerSummary[s.Customer]) {
      customerSummary[s.Customer] = {
        name: s.Customer,
        totalBought: 0,
        visitCount: 0
      };
    }
    customerSummary[s.Customer].totalBought += s.Net_Amount;
    customerSummary[s.Customer].visitCount += 1;
  });

  // Convert to array and filter/sort
  let retailersList = Object.values(customerSummary);
  
  if (searchTerm) {
    retailersList = retailersList.filter(r => r.name.toLowerCase().includes(searchTerm));
  }

  // Sort by total bought descending
  retailersList.sort((a,b) => b.totalBought - a.totalBought);

  // Update DOM stats
  document.getElementById('totalRetailerCount').innerText = retailersList.length;
  
  const topCustomerNameEl = document.getElementById('topCustomerName');
  const topCustomerAmountEl = document.getElementById('topCustomerAmount');

  if (retailersList.length > 0) {
    topCustomerNameEl.innerText = retailersList[0].name;
    topCustomerAmountEl.innerText = `${formatRupee(retailersList[0].totalBought)} bought total`;
  } else {
    topCustomerNameEl.innerText = '-';
    topCustomerAmountEl.innerText = '₹0 bought total';
  }

  // Populate Retailers Table
  const retailersBody = document.getElementById('retailersBody');
  retailersBody.innerHTML = '';

  if (retailersList.length === 0) {
    retailersBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No retailers found matching your search.</td></tr>`;
  } else {
    retailersList.forEach((r, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><span class="rank-badge">${index + 1}</span></td>
        <td><strong>${r.name}</strong></td>
        <td class="text-center">${r.visitCount} times</td>
        <td class="text-right"><strong>${formatRupee(r.totalBought)}</strong></td>
        <td class="text-right">
          <button class="btn btn-sm btn-outline" onclick="triggerRetailerSale('${r.name.replace(/'/g, "\\'")}')">Add Sale</button>
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
function calculatePrediction() {
  let salesGrowthRate = 0.125; // Fallback +12.5%
  let purchasesGrowthRate = 0.10; // Fallback +10%
  const bufferRate = 0.10;  // +10% safety buffer

  let predictedSales = 1663389;
  let predictedPurchases = 1663389;

  // Calculate dynamic growth rates from last year (FY 2025-2026) using RAST
  if (historicalData) {
    const selectedMonth = 'June 2026';
    const [monthName, yearStr] = selectedMonth.split(' ');
    const year = parseInt(yearStr);

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

    const histInput = historicalData.gst_summary.input;
    const histOutput = historicalData.gst_summary.output;

    const histSales = histOutput.map(r => r.Exempted + r.Taxable);
    const histPurchases = histInput.map(r => r.Exempted + r.Taxable);

    const avgSales = histSales.reduce((a,b) => a+b, 0) / 12;
    const avgPurchases = histPurchases.reduce((a,b) => a+b, 0) / 12;

    const salesSeasonalIndex = histSales[monthIdx] / avgSales;
    const purchasesSeasonalIndex = histPurchases[monthIdx] / avgPurchases;

    // May baseline comparison (May is index 1: April=0, May=1)
    const baseMaySales2025 = histSales[1];
    const baseMayPurchases2025 = histPurchases[1];

    const baseMaySales2026 = 1478568;
    const baseMayPurchases2026 = 1682045;

    const salesGrowthTrend = baseMaySales2026 / baseMaySales2025;
    const purchasesGrowthTrend = baseMayPurchases2026 / baseMayPurchases2025;

    predictedSales = avgSales * salesSeasonalIndex * salesGrowthTrend;
    predictedPurchases = avgPurchases * purchasesSeasonalIndex * purchasesGrowthTrend;

    salesGrowthRate = (predictedSales - baseMaySales2026) / baseMaySales2026;
    purchasesGrowthRate = (predictedPurchases - baseMayPurchases2026) / baseMayPurchases2026;

    // Populate dynamic texts in the formulas
    const sIndexEl = document.getElementById('salesSeasonalIndexText');
    const pIndexEl = document.getElementById('purchasesSeasonalIndexText');
    const trendEl = document.getElementById('yoyGrowthTrendText');
    
    if (sIndexEl && pIndexEl && trendEl) {
      sIndexEl.innerText = `${salesSeasonalIndex.toFixed(2)} (${monthName} Index)`;
      pIndexEl.innerText = `${purchasesSeasonalIndex.toFixed(2)} (${monthName} Index)`;
      trendEl.innerText = `Sales: +${((salesGrowthTrend - 1) * 100).toFixed(1)}% | Purchases: +${((purchasesGrowthTrend - 1) * 100).toFixed(1)}%`;
    }
  }

  // Update UI values
  const projectedJuneDemand = Math.round(predictedSales);
  const recommendedJuneOrder = Math.round(predictedPurchases * (1 + bufferRate));

  document.getElementById('predDemand').innerText = formatRupee(projectedJuneDemand);
  document.getElementById('predOrder').innerText = formatRupee(recommendedJuneOrder);
  
  // Supplier Allocation Logic
  // May purchases details: Total = 1,682,045
  const supplierBaselines = [
    { name: 'PST TRADERS', amount: 707130, type: 'Within State' },
    { name: 'SRI AISHWARYA FEED', amount: 368165, type: 'Within State' },
    { name: 'DHARWAL FOOD', amount: 322850, type: 'Out of State' },
    { name: 'VIJAY NAGAR BIO', amount: 210000, type: 'Within State' },
    { name: 'KAMDHENU FEED', amount: 73900, type: 'Within State' }
  ];
  const totalMayPurchases = 1682045;

  const supplierRecBody = document.getElementById('supplierRecBody');
  supplierRecBody.innerHTML = '';

  supplierBaselines.forEach(sup => {
    const ratio = sup.amount / totalMayPurchases;
    const recommendedAmount = recommendedJuneOrder * ratio;

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

  // Sales Channels Demand Forecast
  const mayCounterBaseline = 858762;
  const mayRetailerBaseline = baseMaySales - mayCounterBaseline;

  const juneCounterPred = mayCounterBaseline * (1 + salesGrowthRate);
  const juneRetailerPred = mayRetailerBaseline * (1 + salesGrowthRate);

  // Calculate recorded sales for June 2026
  const juneSales = sales.filter(s => s.Month === 'June 2026');

  const juneCounterRecorded = juneSales
    .filter(s => s.Customer === 'COUNTER SALES')
    .reduce((sum, s) => sum + s.Net_Amount, 0);

  const juneRetailerRecorded = juneSales
    .filter(s => s.Customer !== 'COUNTER SALES')
    .reduce((sum, s) => sum + s.Net_Amount, 0);

  // Update DOM elements for channel baselines and predictions
  document.getElementById('counterMayBaseline').innerText = formatRupee(mayCounterBaseline);
  document.getElementById('counterJunePred').innerText = formatRupee(juneCounterPred);
  document.getElementById('counterJuneRecorded').innerText = formatRupee(juneCounterRecorded);

  document.getElementById('retailerMayBaseline').innerText = formatRupee(mayRetailerBaseline);
  document.getElementById('retailerJunePred').innerText = formatRupee(juneRetailerPred);
  document.getElementById('retailerJuneRecorded').innerText = formatRupee(juneRetailerRecorded);

  // Progress Bar widths & text
  const counterPct = Math.min(100, Math.round((juneCounterRecorded / juneCounterPred) * 100)) || 0;
  const retailerPct = Math.min(100, Math.round((juneRetailerRecorded / juneRetailerPred) * 100)) || 0;

  document.getElementById('counterProgressPercent').innerText = `${counterPct}%`;
  document.getElementById('counterProgressAmt').innerText = `${formatRupee(juneCounterRecorded)} of ${formatRupee(juneCounterPred)}`;
  document.getElementById('counterProgressBar').style.width = `${counterPct}%`;

  document.getElementById('retailerProgressPercent').innerText = `${retailerPct}%`;
  document.getElementById('retailerProgressAmt').innerText = `${formatRupee(juneRetailerRecorded)} of ${formatRupee(juneRetailerPred)}`;
  document.getElementById('retailerProgressBar').style.width = `${retailerPct}%`;

  // Daily run rate needed (current day = June 10, so 20 days remaining)
  const currentDay = 10;
  const daysRemaining = 30 - currentDay;

  const counterRemaining = juneCounterPred - juneCounterRecorded;
  const counterPaceEl = document.getElementById('counterPace');
  if (counterRemaining <= 0) {
    counterPaceEl.innerText = 'Target Achieved!';
    counterPaceEl.style.color = 'var(--success-color)';
  } else {
    counterPaceEl.innerText = `Pace: ${formatRupee(Math.round(counterRemaining / daysRemaining))}/day needed`;
    counterPaceEl.style.color = 'var(--text-muted)';
  }

  const retailerRemaining = juneRetailerPred - juneRetailerRecorded;
  const retailerPaceEl = document.getElementById('retailerPace');
  if (retailerRemaining <= 0) {
    retailerPaceEl.innerText = 'Target Achieved!';
    retailerPaceEl.style.color = 'var(--success-color)';
  } else {
    retailerPaceEl.innerText = `Pace: ${formatRupee(Math.round(retailerRemaining / daysRemaining))}/day needed`;
    retailerPaceEl.style.color = 'var(--text-muted)';
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

    // Select June 2026 in dashboard dropdown so they see it
    dashboardMonthSelect.value = 'June 2026';

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

    // Select June 2026 in dashboard dropdown
    dashboardMonthSelect.value = 'June 2026';

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


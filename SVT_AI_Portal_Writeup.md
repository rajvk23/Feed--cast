# Satya Venkateswara Traders — AI Business Intelligence & Demand Forecasting Portal

## 📋 Executive Summary
This project delivers a custom-tailored, responsive single-page web application (SPA) built to automate inventory procurement, cash flow analysis, and customer ledger management for **Satya Venkateswara Traders**, a leading cattle feed wholesaler located in Ambajipeta, Andhra Pradesh. The application features a calendar-dynamic interface, a custom Seasonal Indexing forecasting model, and real-time localized weather analytics to help the merchant make data-driven ordering decisions.

---

## ⚠️ Problem Statement
Before implementation, the merchant managed operations manually on paper logs. This created three core operational bottlenecks:
1. **Inefficient Ordering:** Estimating stock order volume led to feed stockouts during peak agricultural demand (Kharif season) or excess capital locked up in feed bags during low-demand months.
2. **Reconciliation Overhead:** Reconciling daily counter cash sales and credit ledger bills for 30+ retailers consumed over 45 minutes every evening.
3. **Advance Stock Tracking:** Recording advance supplier orders made before a calendar month started skewed monthly cash flow reporting.

---

## 🛠️ Solution & Technical Architecture
The portal is implemented as a lightweight, performant stack using **Node.js/Express** on the backend and **Vanilla HTML5, CSS3, and ES6 JavaScript** on the frontend, deployed live on **Render**.

### Key Technical Implementations:
* **RAST AI Demand Forecasting:** Computes monthly seasonal indices relative to a 12-month historical baseline derived from the business's actual past-year GST returns. It multiplies the baseline by YoY growth trends to predict upcoming customer demand.
* **Carry-over Excess Stock Model:** Dynamically tracks stock purchased but not sold during the baseline month ($\text{Purchases} - \text{Sales}$) and subtracts this carry-over stock from the next month’s recommended supplier order:
  $$\text{Recommended Order} = \max(0, \text{Predicted Sales} \times 1.10 - \text{Excess Stock})$$
* **Decoupled Advance Booking:** The purchase recorder features a *Target Inventory Month* field, allowing the merchant to book advance transactions into the upcoming month's budget regardless of the invoice date.
* **Live Environmental Context:** Integrates the public Open-Meteo API to stream real-time localized temperature and weather conditions for Ambajipeta coordinates ($16.5939^\circ\text{ N}, 81.9453^\circ\text{ E}$) with a 10-minute auto-refresh cycle.

---

## 📈 Validated Outcomes
* **Time Saved:** Automated invoice listing and cash reconciliation reduced daily bookkeeping overhead from 45 minutes to **under 10 minutes** (saving ~35 mins/day).
* **Capital Efficiency:** The carry-over inventory model automatically subtracted ₹6.63 Lakhs of excess June stock from the July ordering recommendation, preventing unnecessary cash lock-up.
* **Adoption Rate:** High merchant engagement with 5–6 weekly active sessions, tracking 151 sales and 11 major supplier invoices dynamically.

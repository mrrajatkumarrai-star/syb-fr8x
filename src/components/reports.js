import { getCollection } from "../services/db.js";
import { showToast, showReportPreview } from "../services/ui.js";

export class Reports {
  async render() {
    const container = document.createElement("div");
    container.innerHTML = `
      <div class="grid3">
        <div class="card" data-report="Shipment Report" style="cursor:pointer">
          <div style="margin-bottom:12px"><i class="ti ti-box" style="font-size:24px;color:var(--primary)" aria-hidden="true"></i></div>
          <div style="font-size:14px;font-weight:600;color:var(--text-main);margin-bottom:6px">Shipment Log Report</div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:16px;line-height:1.4">Complete listing of FCL/LCL and Air jobs grouped by milestones, destinations, and dates.</div>
          <div style="display:flex;gap:8px">
            <button class="btn sm" data-fmt="csv"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Export CSV</button>
            <button class="btn sm" data-fmt="print"><i class="ti ti-printer" aria-hidden="true"></i> Print Report</button>
          </div>
        </div>

        <div class="card" data-report="Customer Report" style="cursor:pointer">
          <div style="margin-bottom:12px"><i class="ti ti-building" style="font-size:24px;color:var(--success)" aria-hidden="true"></i></div>
          <div style="font-size:14px;font-weight:600;color:var(--text-main);margin-bottom:6px">Customer Volume Report</div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:16px;line-height:1.4">Summary of total bookings, container volumes, and gross invoiced collections per customer.</div>
          <div style="display:flex;gap:8px">
            <button class="btn sm" data-fmt="csv"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Export CSV</button>
            <button class="btn sm" data-fmt="print"><i class="ti ti-printer" aria-hidden="true"></i> Print Report</button>
          </div>
        </div>

        <div class="card" data-report="Container Report" style="cursor:pointer">
          <div style="margin-bottom:12px"><i class="ti ti-container" style="font-size:24px;color:var(--warning)" aria-hidden="true"></i></div>
          <div style="font-size:14px;font-weight:600;color:var(--text-main);margin-bottom:6px">Detention &amp; Lease Report</div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:16px;line-height:1.4">Tracking report detailing gate-ins, ETA alerts, free-time expiries, and accrued detention fees.</div>
          <div style="display:flex;gap:8px">
            <button class="btn sm" data-fmt="csv"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Export CSV</button>
            <button class="btn sm" data-fmt="print"><i class="ti ti-printer" aria-hidden="true"></i> Print Report</button>
          </div>
        </div>

        <div class="card" data-report="Revenue Report" style="cursor:pointer">
          <div style="margin-bottom:12px"><i class="ti ti-report-money" style="font-size:24px;color:var(--primary)" aria-hidden="true"></i></div>
          <div style="font-size:14px;font-weight:600;color:var(--text-main);margin-bottom:6px">Revenue Ledger</div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:16px;line-height:1.4">Monthly gross invoicing ledger broken down by client entities, GST collection, and total bills.</div>
          <div style="display:flex;gap:8px">
            <button class="btn sm" data-fmt="csv"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Export CSV</button>
            <button class="btn sm" data-fmt="print"><i class="ti ti-printer" aria-hidden="true"></i> Print Report</button>
          </div>
        </div>

        <div class="card" data-report="Profitability Report" style="cursor:pointer">
          <div style="margin-bottom:12px"><i class="ti ti-chart-line" style="font-size:24px;color:var(--success)" aria-hidden="true"></i></div>
          <div style="font-size:14px;font-weight:600;color:var(--text-main);margin-bottom:6px">P&amp;L Profitability Report</div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:16px;line-height:1.4">Direct comparison of invoice receipts and supplier expenses, highlighting job-by-job margins.</div>
          <div style="display:flex;gap:8px">
            <button class="btn sm" data-fmt="csv"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Export CSV</button>
            <button class="btn sm" data-fmt="print"><i class="ti ti-printer" aria-hidden="true"></i> Print Report</button>
          </div>
        </div>

        <div class="card" data-report="Invoice Report" style="cursor:pointer">
          <div style="margin-bottom:12px"><i class="ti ti-receipt" style="font-size:24px;color:var(--danger)" aria-hidden="true"></i></div>
          <div style="font-size:14px;font-weight:600;color:var(--text-main);margin-bottom:6px">Invoice Aging &amp; Overdue</div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:16px;line-height:1.4">Summary listing unpaid and overdue invoices with credit terms, due dates, and outstanding age.</div>
          <div style="display:flex;gap:8px">
            <button class="btn sm" data-fmt="csv"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Export CSV</button>
            <button class="btn sm" data-fmt="print"><i class="ti ti-printer" aria-hidden="true"></i> Print Report</button>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      container.querySelectorAll(".card").forEach(card => {
        const reportName = card.dataset.report;
        card.querySelectorAll("button").forEach(btn => {
          btn.onclick = async (e) => {
            e.stopPropagation();
            const format = btn.dataset.fmt;
            await this.generateReport(reportName, format);
          };
        });
      });
    }, 50);

    return container;
  }

  async generateReport(name, format) {
    const shipments = await getCollection("shipments");
    const customers = await getCollection("customers");
    const containers = await getCollection("containers");
    const invoices = await getCollection("invoices");
    const expenses = await getCollection("expenses");

    let header = "";
    let rows = [];

    if (name === "Shipment Report") {
      header = "Job No,Customer,Type,POL,POD,Vessel,ETD,ETA,Status,Containers";
      rows = shipments.map(s => `"${s.jobNo}","${s.customer}","${s.type}","${s.pol || ''}","${s.pod || ''}","${s.vessel || ''}","${s.etd || ''}","${s.eta || ''}","${s.status}","${s.containerDetails || ''}"`);
    } else if (name === "Customer Report") {
      header = "Customer,Code,Country,Credit Limit,Outstanding Invoices,Active Bookings";
      rows = customers.map(c => {
        const custInvs = invoices.filter(i => i.customer === c.company);
        const unpaid = custInvs.filter(i => i.status === 'Unpaid' || i.status === 'Overdue').reduce((a, b) => a + b.total, 0);
        const activeCount = shipments.filter(s => s.customer === c.company && s.status !== 'Closed').length;
        return `"${c.company}","${c.code}","${c.country}",${c.creditLimit || 0},${unpaid},${activeCount}`;
      });
    } else if (name === "Container Report") {
      header = "Container No,Job No,Size,Shipping Line,Free Expiry,Status,Days Late,Detention Cost (INR)";
      rows = containers.map(c => {
        let days = 0;
        let cost = 0;
        if (c.freeTimeExpiry && c.status !== 'Returned' && c.status !== 'Available') {
          const exp = new Date(c.freeTimeExpiry);
          const now = new Date();
          exp.setHours(0,0,0,0);
          now.setHours(0,0,0,0);
          if (now > exp) {
            days = Math.ceil(Math.abs(now - exp) / (1000 * 60 * 60 * 24));
            cost = days * (c.size && c.size.includes('20') ? 4000 : 8000);
          }
        }
        return `"${c.containerNo}","${c.jobNo || ''}","${c.size}","${c.shippingLine || ''}","${c.freeTimeExpiry || ''}","${c.status}",${days},${cost}`;
      });
    } else if (name === "Revenue Report") {
      header = "Invoice No,Job No,Customer,Invoice Date,Due Date,Subtotal,GST %,GST Amt,Total,Status";
      rows = invoices.map(i => `"${i.invNo}","${i.jobNo || ''}","${i.customer}","${i.invoiceDate}","${i.dueDate}",${i.subtotal || 0},${i.gstRate || 0},${i.gstAmount || 0},${i.total || 0},"${i.status}"`);
    } else if (name === "Profitability Report") {
      header = "Job No,Customer,Revenue,Expenses,Net Profit,Profit Margin %";
      const byJob = {};
      invoices.forEach(i => {
        if (!i.jobNo) return;
        if (!byJob[i.jobNo]) byJob[i.jobNo] = { cust: i.customer, rev: 0, exp: 0 };
        byJob[i.jobNo].rev += i.total || 0;
      });
      expenses.forEach(e => {
        if (!e.jobNo) return;
        if (!byJob[e.jobNo]) byJob[e.jobNo] = { cust: '—', rev: 0, exp: 0 };
        byJob[e.jobNo].exp += e.amount || 0;
      });
      rows = Object.entries(byJob).map(([jobNo, data]) => {
        const net = data.rev - data.exp;
        const pct = data.rev > 0 ? Math.round((net / data.rev) * 100) : 0;
        return `"${jobNo}","${data.cust}",${data.rev},${data.exp},${net},${pct}%`;
      });
    } else if (name === "Invoice Report") {
      header = "Invoice No,Customer,Invoice Date,Due Date,Total,Status,Days Overdue";
      rows = invoices.map(i => {
        let days = 0;
        if (i.status === 'Overdue' || (i.status === 'Unpaid' && new Date(i.dueDate) < new Date())) {
          days = Math.ceil(Math.abs(new Date() - new Date(i.dueDate)) / (1000 * 60 * 60 * 24));
        }
        return `"${i.invNo}","${i.customer}","${i.invoiceDate}","${i.dueDate}",${i.total || 0},"${i.status}",${days}`;
      });
    }

    const csvContent = [header, ...rows].join("\n");

    if (format === "csv") {
      // Simulate download link in client-side
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${name.toLowerCase().replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`CSV file for "${name}" exported successfully.`, "success");
    } else {
      // Print Report
      showReportPreview(`${name} Print Preview`, csvContent);
    }
  }
}

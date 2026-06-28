import { getCollection } from "../services/db.js";
import { fmtAmt } from "../services/ui.js";

export class Finance {
  async render() {
    const invoices = await getCollection("invoices");
    const expenses = await getCollection("expenses");

    const totalRev = invoices.reduce((a, i) => a + i.total, 0);
    const totalExp = expenses.reduce((a, e) => a + e.amount, 0);
    const profit = totalRev - totalExp;

    const byShip = {};
    invoices.forEach(i => {
      if (i.jobNo) {
        if (!byShip[i.jobNo]) byShip[i.jobNo] = { rev: 0, exp: 0 };
        byShip[i.jobNo].rev += i.total;
      }
    });
    expenses.forEach(e => {
      if (e.jobNo) {
        if (!byShip[e.jobNo]) byShip[e.jobNo] = { rev: 0, exp: 0 };
        byShip[e.jobNo].exp += e.amount;
      }
    });

    const profRows = Object.entries(byShip).map(([jobNo, v]) => {
      const rev = v.rev || 0;
      const exp = v.exp || 0;
      return {
        jobNo,
        rev,
        exp,
        profit: rev - exp,
        margin: rev > 0 ? Math.round(((rev - exp) / rev) * 100) : 0
      };
    }).sort((a, b) => b.profit - a.profit);

    const container = document.createElement("div");
    container.innerHTML = `
      <div class="grid3" style="margin-bottom:20px">
        <div class="stat-card"><div class="stat-lbl">Total Revenue</div><div class="stat-val">${fmtAmt(totalRev)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Total Expenses</div><div class="stat-val" style="color:var(--danger)">${fmtAmt(totalExp)}</div></div>
        <div class="stat-card">
          <div class="stat-lbl">Net Profit</div>
          <div class="stat-val" style="color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmtAmt(profit)}</div>
          <div class="stat-sub ${profit >= 0 ? 'up' : 'dn'}">${totalRev > 0 ? Math.round((profit / totalRev) * 100) : 0}% margin</div>
        </div>
      </div>
      <div class="card" style="margin-bottom:20px">
        <div class="sec-title">Revenue vs Expense Comparison</div>
        <div id="finance-chart-container" style="height:180px;"></div>
      </div>
      <div class="tbl-wrap">
        <div class="tbl-hdr"><span style="font-size:13px;font-weight:600;color:var(--text-main)">Profitability by shipment</span></div>
        <table>
          <thead>
            <tr>
              <th>Job #</th>
              <th>Revenue</th>
              <th>Expenses</th>
              <th>Profit</th>
              <th>Margin</th>
              <th>Profit Bar</th>
            </tr>
          </thead>
          <tbody>
            ${profRows.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><i class="ti ti-chart-pie" aria-hidden="true"></i>No financial data available yet.</div></td></tr>` :
            profRows.map(r => `
              <tr>
                <td style="color:var(--primary);font-weight:600">${r.jobNo}</td>
                <td>${fmtAmt(r.rev)}</td>
                <td>${fmtAmt(r.exp)}</td>
                <td style="font-weight:600;color:${r.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmtAmt(r.profit)}</td>
                <td>${r.margin}%</td>
                <td style="min-width:80px">
                  <div class="profit-bar">
                    <div class="profit-fill" style="width:${Math.max(0, r.margin)}%; background:${r.profit >= 0 ? 'var(--primary)' : 'var(--danger)'}"></div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    setTimeout(() => {
      if (profRows.length > 0) {
        this.drawPLChart(container.querySelector('#finance-chart-container'), profRows.slice(0, 5));
      }
    }, 50);

    return container;
  }

  drawPLChart(container, jobs) {
    if (!container) return;
    const width = container.clientWidth || 500;
    const height = 180;
    const paddingLeft = 50;
    const paddingRight = 10;
    const paddingTop = 25;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const maxVal = Math.max(...jobs.map(j => Math.max(j.rev, j.exp)), 1000) * 1.1;

    let svg = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="overflow:visible; font-family:var(--font-sans);">`;

    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const val = Math.round((maxVal / steps) * i);
      const y = height - paddingBottom - (chartHeight / steps) * i;
      svg += `<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2 2" />`;

      let label = val.toString();
      if (val >= 100000) label = (val / 100000).toFixed(1) + 'L';
      else if (val >= 1000) label = (val / 1000).toFixed(0) + 'k';
      svg += `<text x="${paddingLeft - 8}" y="${y + 4}" font-size="9" fill="var(--text-muted)" text-anchor="end">${label}</text>`;
    }

    const groupSpacing = chartWidth / jobs.length;
    const barWidth = groupSpacing * 0.28;

    jobs.forEach((job, i) => {
      const revHeight = (job.rev / maxVal) * chartHeight;
      const expHeight = (job.exp / maxVal) * chartHeight;

      const xGroup = paddingLeft + (groupSpacing * i);
      const xRev = xGroup + (groupSpacing - barWidth * 2 - 4) / 2;
      const xExp = xRev + barWidth + 4;

      const yRev = height - paddingBottom - revHeight;
      const yExp = height - paddingBottom - expHeight;

      svg += `
        <rect x="${xRev}" y="${yRev}" width="${barWidth}" height="${revHeight}" rx="2" ry="2" fill="var(--primary)" opacity="0.85">
          <title>Revenue: ${fmtAmt(job.rev)}</title>
        </rect>
        <rect x="${xExp}" y="${yExp}" width="${barWidth}" height="${expHeight}" rx="2" ry="2" fill="var(--danger)" opacity="0.85">
          <title>Expense: ${fmtAmt(job.exp)}</title>
        </rect>
      `;
      svg += `<text x="${xGroup + groupSpacing / 2}" y="${height - paddingBottom + 16}" font-size="9" fill="var(--text-muted)" text-anchor="middle">${job.jobNo}</text>`;
    });

    svg += `</svg>`;
    container.innerHTML = svg;
  }
}

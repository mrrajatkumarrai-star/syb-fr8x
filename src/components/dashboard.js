import { getCollection } from "../services/db.js";
import { fmtAmt, fmtDate, statusBadge, openShipmentDetail } from "../services/ui.js";

export class Dashboard {
  async render() {
    const shipments = await getCollection("shipments");
    const invoices = await getCollection("invoices");
    const expenses = await getCollection("expenses");
    const tasks = await getCollection("tasks");
    const containers = await getCollection("containers");

    const active = shipments.filter(s => !['Closed', 'Cancelled'].includes(s.status)).length;
    const pending = shipments.filter(s => ['Arrival POD', 'DO Released', 'Customs Clearance'].includes(s.status)).length;
    const delayed = shipments.filter(s => s.delayed).length;

    const totalRev = invoices.reduce((a, i) => a + (i.total || 0), 0);
    const totalExp = expenses.reduce((a, e) => a + (e.amount || 0), 0);
    const profit = totalRev - totalExp;

    const contRisk = containers.filter(c => c.detentionRisk).length;

    const byStatus = {};
    shipments.forEach(s => { byStatus[s.status] = (byStatus[s.status] || 0) + 1; });
    const top5status = Object.entries(byStatus).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const recentShips = shipments.slice(0, 5);
    const openTasks = tasks.filter(t => t.status !== 'Done').slice(0, 5);

    const container = document.createElement("div");
    container.innerHTML = `
      <div class="grid4" style="margin-bottom:20px">
        <div class="stat-card"><div class="stat-lbl">Active Shipments</div><div class="stat-val">${active}</div><div class="stat-sub" style="color:var(--text-muted)">${shipments.length} total</div></div>
        <div class="stat-card"><div class="stat-lbl">Pending Delivery</div><div class="stat-val">${pending}</div><div class="stat-sub ${delayed > 0 ? 'dn' : 'up'}">${delayed} delayed</div></div>
        <div class="stat-card"><div class="stat-lbl">Net Profit</div><div class="stat-val">${fmtAmt(profit)}</div><div class="stat-sub ${profit >= 0 ? 'up' : 'dn'}">${totalRev > 0 ? Math.round((profit / totalRev) * 100) : 0}% margin</div></div>
        <div class="stat-card"><div class="stat-lbl">Detention Risk</div><div class="stat-val ${contRisk > 0 ? 'dn' : ''}" style="color:${contRisk > 0 ? 'var(--danger)' : 'inherit'}">${contRisk}</div><div class="stat-sub" style="color:var(--text-muted)">${containers.length} containers tracked</div></div>
      </div>
      <div class="grid2" style="margin-bottom:20px">
        <div class="card" style="margin-bottom:0">
          <div class="sec-title">Shipment activity by type</div>
          ${shipments.length === 0 ? `<div class="empty-state"><i class="ti ti-chart-bar" aria-hidden="true"></i>No shipments yet. Create your first shipment.</div>` : `
          <div id="dash-svg-chart-container" style="height:150px;"></div>`}
        </div>
        <div class="card" style="margin-bottom:0">
          <div class="sec-title">Status distribution</div>
          ${top5status.length === 0 ? `<div class="empty-state"><i class="ti ti-chart-pie" aria-hidden="true"></i>No data yet</div>` :
          `<div>${top5status.map(([s, n]) => `
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
                <span style="color:var(--text-muted)">${s}</span><span style="font-weight:600">${n}</span>
              </div>
              <div class="profit-bar"><div class="profit-fill" style="width:${Math.round((n / shipments.length) * 100)}%"></div></div>
            </div>`).join('')}</div>`}
        </div>
      </div>
      <div class="grid2">
        <div class="tbl-wrap" style="margin-bottom:0">
          <div class="tbl-hdr"><span style="font-size:13px;font-weight:600;color:var(--text-main)">Recent Shipments</span></div>
          ${recentShips.length === 0 ? `<div class="empty-state"><i class="ti ti-box" aria-hidden="true"></i>No shipments yet.</div>` : `
          <table><thead><tr><th>Job #</th><th>Customer</th><th>Route</th><th>Status</th></tr></thead>
          <tbody>${recentShips.map(s => `<tr data-sid="${s.id}" style="cursor:pointer">
            <td style="color:var(--primary);font-weight:600">${s.jobNo}</td>
            <td>${s.customer}</td><td style="font-size:12px">${s.pol || '—'} → ${s.pod || '—'}</td>
            <td>${statusBadge(s.status)}</td></tr>`).join('')}</tbody></table>`}
        </div>
        <div class="tbl-wrap" style="margin-bottom:0">
          <div class="tbl-hdr"><span style="font-size:13px;font-weight:600;color:var(--text-main)">Open Tasks</span></div>
          ${openTasks.length === 0 ? `<div class="empty-state"><i class="ti ti-check" aria-hidden="true"></i>No open tasks</div>` : `
          <table><thead><tr><th>Task</th><th>Assigned</th><th>Priority</th><th>Due</th></tr></thead>
          <tbody>${openTasks.map(t => `<tr>
            <td style="font-size:12px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.name}</td>
            <td style="font-size:12px">${t.assignedTo || '—'}</td>
            <td><span class="badge ${t.priority === 'Urgent' || t.priority === 'High' ? 'b-red' : t.priority === 'Medium' ? 'b-amber' : 'b-gray'}">${t.priority || 'Low'}</span></td>
            <td style="font-size:12px">${fmtDate(t.dueDate)}</td></tr>`).join('')}</tbody></table>`}
        </div>
      </div>
    `;

    setTimeout(() => {
      // Row clicks
      container.querySelectorAll("tr[data-sid]").forEach(row => {
        row.onclick = () => openShipmentDetail(row.dataset.sid);
      });

      if (shipments.length > 0) {
        const typeCount = {};
        shipments.forEach(s => { typeCount[s.type] = (typeCount[s.type] || 0) + 1; });
        const types = ['FCL Export', 'FCL Import', 'LCL Export', 'LCL Import', 'Air Export', 'Air Import'];
        const labels = types.map(t => t.replace(' Export', ' E').replace(' Import', ' I'));
        const data = types.map(t => typeCount[t] || 0);
        const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#3b82f6'];
        this.drawSvgBarChart(container.querySelector('#dash-svg-chart-container'), data, labels, colors);
      }
    }, 50);

    return container;
  }

  drawSvgBarChart(containerEl, data, labels, colors) {
    if (!containerEl) return;
    const width = containerEl.clientWidth || 400;
    const height = 150;
    const paddingLeft = 40;
    const paddingRight = 10;
    const paddingTop = 20;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    const maxVal = Math.max(...data, 1) * 1.1;

    let svg = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="overflow:visible; font-family:var(--font-sans);">`;

    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const val = Math.round((maxVal / steps) * i);
      const y = height - paddingBottom - (chartHeight / steps) * i;
      svg += `<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2 2" />`;
      svg += `<text x="${paddingLeft - 8}" y="${y + 4}" font-size="9" fill="var(--text-muted)" text-anchor="end">${val}</text>`;
    }

    const barCount = data.length;
    const barSpacing = chartWidth / barCount;
    const barWidth = barSpacing * 0.6;

    data.forEach((val, i) => {
      const barHeight = (val / maxVal) * chartHeight;
      const x = paddingLeft + (barSpacing * i) + (barSpacing - barWidth) / 2;
      const y = height - paddingBottom - barHeight;
      const col = colors[i % colors.length] || 'var(--primary)';

      svg += `
        <g style="cursor:pointer;">
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" ry="4" fill="${col}" opacity="0.85">
            <title>${labels[i]}: ${val}</title>
          </rect>
          <text x="${x + barWidth / 2}" y="${y - 6}" font-size="10" font-weight="600" fill="var(--text-main)" text-anchor="middle">${val > 0 ? val : ''}</text>
        </g>
      `;
    });

    labels.forEach((lbl, i) => {
      const x = paddingLeft + (barSpacing * i) + barSpacing / 2;
      svg += `<text x="${x}" y="${height - paddingBottom + 16}" font-size="9" fill="var(--text-muted)" text-anchor="middle">${lbl}</text>`;
    });

    svg += `</svg>`;
    containerEl.innerHTML = svg;
  }
}

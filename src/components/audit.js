import { getCollection, saveDocument, resetDatabase } from "../services/db.js";
import { showToast, showConfirm } from "../services/ui.js";

export class Audit {
  constructor() {
    this.searchQuery = "";
  }

  async render() {
    const list = await getCollection("auditLog");
    let data = list;

    // Sort audit logs chronologically (most recent first)
    data.sort((a, b) => new Date(b.ts || '1970-01-01') - new Date(a.ts || '1970-01-01'));

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter(a => (a.user + a.action + a.module + (a.record || '') + (a.ip || '')).toLowerCase().includes(q));
    }

    const container = document.createElement("div");
    container.innerHTML = `
      <div class="filter-bar">
        <input class="search-input" id="audit-search" placeholder="Search audit trails by user, action, module..." value="${this.searchQuery}"/>
        <button class="btn sm danger" id="audit-clear-btn"><i class="ti ti-trash" aria-hidden="true"></i> Clear Audit Logs</button>
      </div>

      <div class="tbl-wrap">
        <table id="tbl-auditLog">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Operator</th>
              <th>Action</th>
              <th>Module</th>
              <th>Logged Record Description</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><i class="ti ti-list-details" aria-hidden="true"></i>No audit logs recorded yet.</div></td></tr>` :
            data.map(a => {
              let actionBadgeClass = 'b-gray';
              if (a.action === 'CREATE' || a.action === 'UPLOAD') actionBadgeClass = 'b-green';
              else if (a.action === 'EDIT' || a.action === 'UPDATE') actionBadgeClass = 'b-blue';
              else if (a.action === 'DELETE' || a.action === 'RESET') actionBadgeClass = 'b-red';

              return `
                <tr>
                  <td style="font-size:11px; white-space:nowrap; font-weight:500;">${a.ts}</td>
                  <td><strong>${a.user}</strong></td>
                  <td><span class="badge ${actionBadgeClass}">${a.action}</span></td>
                  <td style="font-size:11px; font-weight:500;">${a.module}</td>
                  <td style="font-size:11px; max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${a.record}">${a.record}</td>
                  <td style="font-size:11px; color:var(--text-muted);">${a.ip}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    setTimeout(() => {
      const search = container.querySelector("#audit-search");
      if (search) {
        search.oninput = (e) => {
          this.searchQuery = e.target.value;
          this.refreshPanel(container);
        };
      }

      const clearBtn = container.querySelector("#audit-clear-btn");
      if (clearBtn) {
        clearBtn.onclick = () => {
          showConfirm("Clear all system audit log trails permanently? This cannot be undone.", async () => {
            // Delete documents individually
            const allLogs = await getCollection("auditLog");
            const { deleteDocument } = await import("../services/db.js");
            for (const log of allLogs) {
              await deleteDocument("auditLog", log.id);
            }
            
            // Re-log the clear action
            await saveDocument("auditLog", {
              ts: new Date().toLocaleString(),
              user: "Super Admin",
              action: "RESET",
              module: "Audit Trail",
              record: "Cleared all system audit log files from repository",
              ip: "127.0.0.1"
            });

            showToast("System audit trails cleared successfully.", "success");
            this.refreshPanel(container);
          });
        };
      }
    }, 50);

    return container;
  }

  async refreshPanel(container) {
    const parent = container.parentElement;
    if (parent) {
      const newEl = await this.render();
      parent.replaceChild(newEl, container);
    }
  }
}

import { getCollection } from "../services/db.js";
import { fmtDate, openShipmentDetail } from "../services/ui.js";

export class Timeline {
  constructor() {
    this.searchQuery = "";
  }

  async render() {
    const shipments = await getCollection("shipments");
    
    // Flatten all timelines with job details
    const events = [];
    shipments.forEach(s => {
      if (s.timeline && Array.isArray(s.timeline)) {
        s.timeline.forEach(t => {
          events.push({
            ...t,
            jobId: s.id,
            jobNo: s.jobNo,
            customer: s.customer,
            shipmentType: s.type
          });
        });
      }
    });

    // Sort chronologically (most recent first)
    events.sort((a, b) => new Date(b.date || '1970-01-01') - new Date(a.date || '1970-01-01'));

    let filtered = events;
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(e => (e.jobNo + e.event + (e.remarks || '') + (e.user || '') + e.customer).toLowerCase().includes(q));
    }

    const container = document.createElement("div");
    container.innerHTML = `
      <div class="filter-bar">
        <input class="search-input" id="tl-search" placeholder="Search milestones, job numbers, operators..." value="${this.searchQuery}"/>
      </div>

      <div class="card" style="padding:24px;">
        <div class="sec-title" style="margin-bottom:24px;">Global Operational Milestones Feed</div>
        
        ${filtered.length === 0 ? `<div class="empty-state"><i class="ti ti-timeline" aria-hidden="true"></i>No milestone events logged yet.</div>` : `
        <div class="tl-wrap" style="max-height: 600px; overflow-y: auto; padding-right:10px;">
          ${filtered.map(e => `
            <div class="tl-item" style="cursor:pointer; margin-bottom:16px;" data-sid="${e.jobId}">
              <div class="tl-dot done"></div>
              <div style="display:flex; justify-content:space-between; align-items: flex-start; width:100%; margin-left:16px;">
                <div>
                  <div style="font-size:13px; font-weight:600; color:var(--text-main);">${e.event}</div>
                  <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                    Job No: <strong style="color:var(--primary);">${e.jobNo}</strong> · Client: ${e.customer} (${e.shipmentType})
                  </div>
                  ${e.remarks ? `<div style="font-size:12px; color:var(--text-main); margin-top:4px; padding:6px 10px; background:var(--bg-hover); border-radius:4px; border-left:2px solid var(--border);">${e.remarks}</div>` : ''}
                </div>
                <div style="text-align:right; font-size:11px; color:var(--text-muted); flex-shrink:0;">
                  <div>${fmtDate(e.date)}</div>
                  <div style="margin-top:2px;"><i class="ti ti-user" style="font-size:10px;"></i> ${e.user || 'System'}</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>`}
      </div>
    `;

    setTimeout(() => {
      const search = container.querySelector("#tl-search");
      if (search) {
        search.oninput = (e) => {
          this.searchQuery = e.target.value;
          this.refreshPanel(container);
        };
      }

      container.querySelectorAll(".tl-item[data-sid]").forEach(item => {
        item.onclick = () => {
          openShipmentDetail(item.dataset.sid);
        };
      });
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

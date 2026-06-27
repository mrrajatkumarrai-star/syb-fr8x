import { getCollection, saveDocument, deleteDocument } from "../services/db.js";
import { fmtDate, fmtAmt, statusBadge, showToast, showConfirm } from "../services/ui.js";

export class Containers {
  constructor(onRefreshNav) {
    this.onRefreshNav = onRefreshNav;
    this.searchQuery = "";
  }

  async render() {
    const list = await getCollection("containers");
    let data = list;

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter(c => (c.containerNo + c.jobNo + (c.shippingLine || '')).toLowerCase().includes(q));
    }

    const total = list.length;
    const inUse = list.filter(c => ['In Use', 'Sailed', 'Arrived'].includes(c.status)).length;
    const risk = list.filter(c => c.detentionRisk || this.calcDetentionCharges(c).days > 0).length;
    const totalAccrued = list.reduce((sum, c) => sum + this.calcDetentionCharges(c).amount, 0);

    const container = document.createElement("div");
    container.innerHTML = `
      <div class="grid4" style="margin-bottom:20px">
        <div class="stat-card"><div class="stat-lbl">Tracked Containers</div><div class="stat-val">${total}</div></div>
        <div class="stat-card"><div class="stat-lbl">Active Lease / Transit</div><div class="stat-val">${inUse}</div></div>
        <div class="stat-card"><div class="stat-lbl">Detention Risk / Active</div><div class="stat-val" style="color:${risk > 0 ? 'var(--danger)' : 'inherit'}">${risk}</div></div>
        <div class="stat-card"><div class="stat-lbl">Accrued Detention Liability</div><div class="stat-val" style="color:var(--danger)">${fmtAmt(totalAccrued)}</div></div>
      </div>
      <div class="filter-bar">
        <input class="search-input" id="cont-search" placeholder="Search container #, job #, shipping line..." value="${this.searchQuery}"/>
        <button class="btn pr sm" id="cont-add-btn"><i class="ti ti-plus" aria-hidden="true"></i> Add Container</button>
      </div>
      <div class="tbl-wrap">
        <table id="tbl-containers">
          <thead>
            <tr>
              <th>Container #</th>
              <th>Job #</th>
              <th>Size / Type</th>
              <th>Shipping Line</th>
              <th>Seal #</th>
              <th>Gate In</th>
              <th>POD ETA</th>
              <th>Free Expiry</th>
              <th>Detention Days</th>
              <th>Accrued Cost</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `<tr><td colspan="12"><div class="empty-state"><i class="ti ti-container" aria-hidden="true"></i>No tracked containers match query.</div></td></tr>` :
            data.map(c => {
              const det = this.calcDetentionCharges(c);
              const inDetention = det.days > 0;
              return `
                <tr>
                  <td style="font-weight:600">${c.containerNo}</td>
                  <td style="color:var(--primary); font-weight:600">${c.jobNo || '—'}</td>
                  <td>${c.size || ''} ${c.type || ''}</td>
                  <td style="font-size:12px">${c.shippingLine || '—'}</td>
                  <td>${c.sealNo || '—'}</td>
                  <td style="font-size:11px">${fmtDate(c.gateInDate)}</td>
                  <td style="font-size:11px">${fmtDate(c.arrivalDate)}</td>
                  <td style="font-size:11px;color:${c.detentionRisk ? 'var(--warning)' : inDetention ? 'var(--danger)' : 'inherit'};font-weight:${c.detentionRisk || inDetention ? '600' : '400'}">${fmtDate(c.freeTimeExpiry)} ${c.detentionRisk ? '⚠' : ''}</td>
                  <td style="font-weight:600; color:${inDetention ? 'var(--danger)' : 'inherit'}">${det.days > 0 ? det.days : '0'}</td>
                  <td style="font-weight:600; color:${inDetention ? 'var(--danger)' : 'inherit'}">${det.amount > 0 ? fmtAmt(det.amount) : '₹0'}</td>
                  <td>${statusBadge(inDetention ? 'Detained' : c.status || 'Available')}</td>
                  <td>
                    <div class="row-actions">
                      <button class="btn sm" data-act="edit" data-cid="${c.id}"><i class="ti ti-edit"></i></button>
                      <button class="btn sm danger" data-act="delete" data-cid="${c.id}"><i class="ti ti-trash"></i></button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    setTimeout(() => {
      const search = container.querySelector("#cont-search");
      if (search) {
        search.oninput = (e) => {
          this.searchQuery = e.target.value;
          this.refreshPanel(container);
        };
      }

      container.querySelector("#cont-add-btn").onclick = () => this.openFormModal(null, container);

      // Action clicks
      container.querySelectorAll("[data-act]").forEach(btn => {
        btn.onclick = (e) => {
          const act = btn.dataset.act;
          const cid = btn.dataset.cid;
          const containerObj = list.find(c => c.id === cid);

          if (act === 'delete') {
            showConfirm(`Delete container tracking for ${containerObj.containerNo}?`, async () => {
              await deleteDocument("containers", cid);
              showToast(`Container ${containerObj.containerNo} deleted successfully.`, "success");
              this.onRefreshNav();
              this.refreshPanel(container);
            });
          } else if (act === 'edit') {
            this.openFormModal(containerObj, container);
          }
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

  async openFormModal(editData, container) {
    const shipments = await getCollection("shipments");
    const shippingLines = await getCollection("shippingLines");

    const modalWrap = document.getElementById("modal-container");
    if (!modalWrap) return;

    modalWrap.innerHTML = `
      <div class="modal-bg" id="container-form-modal">
        <div class="modal" style="width: 580px;">
          <div class="modal-title">${editData ? `Edit Container ${editData.containerNo}` : 'Add Tracked Container'}<button class="btn sm" id="modal-close"><i class="ti ti-x"></i></button></div>
          <form id="cont-form" onsubmit="event.preventDefault()">
            <div class="form-row">
              <div class="fg"><label>Container Number *</label><input id="f-containerNo" value="${editData ? editData.containerNo || '' : ''}" placeholder="MSCU1234567"/></div>
              <div class="fg"><label>Job Number</label><select id="f-jobNo"><option value="">Select Shipment Job</option>${shipments.map(s => `<option value="${s.jobNo}" ${editData && editData.jobNo === s.jobNo ? 'selected' : ''}>${s.jobNo} — ${s.customer}</option>`).join('')}</select></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Size</label><select id="f-size"><option ${editData && editData.size === '20GP' ? 'selected' : ''}>20GP</option><option ${editData && editData.size === '40GP' ? 'selected' : ''}>40GP</option><option ${editData && editData.size === '40HC' ? 'selected' : ''}>40HC</option><option ${editData && editData.size === '45HC' ? 'selected' : ''}>45HC</option></select></div>
              <div class="fg"><label>Type</label><select id="f-ctype"><option ${editData && editData.type === 'Dry' ? 'selected' : ''}>Dry</option><option ${editData && editData.type === 'Reefer' ? 'selected' : ''}>Reefer</option><option ${editData && editData.type === 'Open Top' ? 'selected' : ''}>Open Top</option></select></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Seal Number</label><input id="f-sealNo" value="${editData ? editData.sealNo || '' : ''}"/></div>
              <div class="fg"><label>Shipping Line</label><select id="f-shippingLine"><option value="">Select Line</option>${shippingLines.map(s => `<option value="${s.name}" ${editData && editData.shippingLine === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Gate In Date</label><input id="f-gateInDate" type="date" value="${editData ? editData.gateInDate || '' : ''}"/></div>
              <div class="fg"><label>Sailing Date</label><input id="f-sailingDate" type="date" value="${editData ? editData.sailingDate || '' : ''}"/></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Arrival Date (POD)</label><input id="f-arrivalDate" type="date" value="${editData ? editData.arrivalDate || '' : ''}"/></div>
              <div class="fg"><label>Free Time Expiry</label><input id="f-freeTimeExpiry" type="date" value="${editData ? editData.freeTimeExpiry || '' : ''}"/></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Return Date</label><input id="f-returnDate" type="date" value="${editData ? editData.returnDate || '' : ''}"/></div>
              <div class="fg"><label>Status</label><select id="f-status">${['Available', 'In Use', 'Sailed', 'Arrived', 'Delivered', 'Returned', 'Detained'].map(s => `<option ${editData && editData.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
              <button class="btn" type="button" id="form-cancel">Cancel</button>
              <button class="btn pr" type="submit"><i class="ti ti-check"></i> Save Container</button>
            </div>
          </form>
        </div>
      </div>
    `;

    setTimeout(() => {
      document.getElementById("modal-close").onclick = () => { modalWrap.innerHTML = ''; };
      document.getElementById("form-cancel").onclick = () => { modalWrap.innerHTML = ''; };

      document.getElementById("cont-form").onsubmit = async (e) => {
        e.preventDefault();
        const fv = (id) => document.getElementById(id)?.value || '';

        const d = {
          containerNo: fv('f-containerNo'),
          jobNo: fv('f-jobNo'),
          size: fv('f-size'),
          type: fv('f-ctype'),
          sealNo: fv('f-sealNo'),
          shippingLine: fv('f-shippingLine'),
          gateInDate: fv('f-gateInDate'),
          sailingDate: fv('f-sailingDate'),
          arrivalDate: fv('f-arrivalDate'),
          freeTimeExpiry: fv('f-freeTimeExpiry'),
          returnDate: fv('f-returnDate'),
          status: fv('f-status')
        };

        if (!d.containerNo) { showToast("Container number is required.", "warning"); return; }

        if (d.freeTimeExpiry) {
          const exp = new Date(d.freeTimeExpiry);
          const diff = (exp - new Date()) / (1000 * 60 * 60 * 24);
          d.detentionRisk = diff <= 3 && diff >= -1 && d.status !== 'Returned';
        }

        if (editData) {
          await saveDocument("containers", { ...editData, ...d }, editData.id);
          showToast(`Container ${editData.containerNo} updated successfully.`, "success");
        } else {
          await saveDocument("containers", d);
          showToast(`Container ${d.containerNo} added successfully.`, "success");
        }

        modalWrap.innerHTML = '';
        this.onRefreshNav();
        this.refreshPanel(container);
      };
    }, 50);
  }

  calcDetentionCharges(c) {
    if (!c.freeTimeExpiry || c.status === 'Returned' || c.status === 'Available') return { days: 0, amount: 0 };
    const expiry = new Date(c.freeTimeExpiry);
    const end = c.returnDate ? new Date(c.returnDate) : new Date();

    expiry.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (end <= expiry) return { days: 0, amount: 0 };

    const diffTime = Math.abs(end - expiry);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const rate = c.size && c.size.includes('20') ? 4000 : 8000;
    return {
      days: diffDays,
      amount: diffDays * rate
    };
  }
}

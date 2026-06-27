import { getCollection, saveDocument, deleteDocument } from "../services/db.js";
import { fmtDate, fmtAmt, statusBadge, showToast, showConfirm, makeSearchableSelect } from "../services/ui.js";

export class Expenses {
  constructor(onRefreshNav) {
    this.onRefreshNav = onRefreshNav;
    this.searchQuery = "";
  }

  async render() {
    const list = await getCollection("expenses");
    const vendorsList = await getCollection("vendors");
    let data = list;

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter(e => (e.jobNo + e.vendor + e.chargeHead).toLowerCase().includes(q));
    }

    const total = list.reduce((a, e) => a + e.amount, 0);
    const pending = list.filter(e => e.status === 'Pending').reduce((a, e) => a + e.amount, 0);

    const container = document.createElement("div");
    container.innerHTML = `
      <div class="grid3" style="margin-bottom:12px">
        <div class="stat-card"><div class="stat-lbl">Total Expenses</div><div class="stat-val" style="font-size:17px">${fmtAmt(total)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Pending Payment</div><div class="stat-val" style="font-size:17px;color:var(--amber)">${fmtAmt(pending)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Vendors</div><div class="stat-val">${vendorsList.length}</div></div>
      </div>
      <div class="filter-bar">
        <input class="search-input" id="exp-search" placeholder="Search by job #, vendor, charge head..." value="${this.searchQuery}"/>
        <button class="btn pr sm" id="exp-add-btn"><i class="ti ti-plus" aria-hidden="true"></i> Record Expense</button>
      </div>
      <div class="tbl-wrap">
        <table id="tbl-expenses">
          <thead>
            <tr>
              <th>Job #</th>
              <th>Vendor</th>
              <th>Charge Head</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Bill #</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `<tr><td colspan="8"><div class="empty-state"><i class="ti ti-report-money" aria-hidden="true"></i>No expenses recorded yet.</div></td></tr>` :
            data.map(e => `
              <tr>
                <td style="color:var(--blue);font-weight:600">${e.jobNo || '—'}</td>
                <td>${e.vendor || '—'}</td>
                <td>${e.chargeHead || '—'}</td>
                <td style="font-weight:600">${fmtAmt(e.amount, e.currency)}</td>
                <td style="font-size:11px">${fmtDate(e.expenseDate)}</td>
                <td>${e.billNo || '—'}</td>
                <td>${statusBadge(e.status || 'Pending')}</td>
                <td>
                  <div class="row-actions">
                    <button class="btn sm" data-act="edit" data-eid="${e.id}"><i class="ti ti-edit"></i></button>
                    <button class="btn sm danger" data-act="delete" data-eid="${e.id}"><i class="ti ti-trash"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    setTimeout(() => {
      const search = container.querySelector("#exp-search");
      if (search) {
        search.oninput = (e) => {
          this.searchQuery = e.target.value;
          this.refreshPanel(container);
        };
      }

      container.querySelector("#exp-add-btn").onclick = () => this.openFormModal(null, container);

      container.querySelectorAll("[data-act]").forEach(btn => {
        btn.onclick = (e) => {
          const act = btn.dataset.act;
          const eid = btn.dataset.eid;
          const expObj = list.find(x => x.id === eid);

          if (act === 'delete') {
            showConfirm(`Delete expense for ${expObj.chargeHead}?`, async () => {
              await deleteDocument("expenses", eid);
              showToast("Expense record deleted.", "success");
              this.onRefreshNav();
              this.refreshPanel(container);
            });
          } else if (act === 'edit') {
            this.openFormModal(expObj, container);
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
    const vendors = await getCollection("vendors");
    const chargeHeads = await getCollection("chargeHeads");

    const modalWrap = document.getElementById("modal-container");
    if (!modalWrap) return;

    modalWrap.innerHTML = `
      <div class="modal-bg" id="expense-form-modal">
        <div class="modal" style="width: 580px;">
          <div class="modal-title">${editData ? 'Edit Expense Record' : 'Record New Expense'}<button class="btn sm" id="modal-close"><i class="ti ti-x"></i></button></div>
          <form id="exp-form" onsubmit="event.preventDefault()">
            <div class="form-row">
              <div class="fg"><label>Shipment Job</label><select id="f-jobNo"><option value="">Select Job</option>${shipments.map(s => `<option value="${s.jobNo}" ${editData && editData.jobNo === s.jobNo ? 'selected' : ''}>${s.jobNo} — ${s.customer}</option>`).join('')}</select></div>
              <div class="fg"><label>Vendor *</label><select id="f-vendor"><option value="">Select Vendor</option>${vendors.map(v => `<option value="${v.company}" ${editData && editData.vendor === v.company ? 'selected' : ''}>${v.company}</option>`).join('')}</select></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Charge Head</label><select id="f-chargeHead"><option value="">Select Charge</option>${chargeHeads.filter(c => c.type !== 'Revenue').map(c => `<option value="${c.name}" ${editData && editData.chargeHead === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}<option ${editData && editData.chargeHead === 'Other' ? 'selected' : ''}>Other</option></select></div>
              <div class="fg"><label>Amount *</label><input id="f-amount" type="number" value="${editData ? editData.amount || '' : ''}"/></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Currency</label><select id="f-currency"><option value="INR" ${editData && editData.currency === 'INR' ? 'selected' : ''}>INR</option><option value="USD" ${editData && editData.currency === 'USD' ? 'selected' : ''}>USD</option><option value="EUR" ${editData && editData.currency === 'EUR' ? 'selected' : ''}>EUR</option></select></div>
              <div class="fg"><label>Date</label><input id="f-expenseDate" type="date" value="${editData ? editData.expenseDate : new Date().toISOString().split('T')[0]}"/></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Bill / Ref #</label><input id="f-billNo" value="${editData ? editData.billNo || '' : ''}"/></div>
              <div class="fg"><label>Status</label><select id="f-status"><option ${editData && editData.status === 'Pending' ? 'selected' : ''}>Pending</option><option ${editData && editData.status === 'Paid' ? 'selected' : ''}>Paid</option><option ${editData && editData.status === 'Disputed' ? 'selected' : ''}>Disputed</option></select></div>
            </div>
            <div class="fg" style="margin-bottom:14px;"><label>Remarks</label><input id="f-remarks" value="${editData ? editData.remarks || '' : ''}"/></div>
            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button class="btn" type="button" id="form-cancel">Cancel</button>
              <button class="btn pr" type="submit"><i class="ti ti-check"></i> Save Expense</button>
            </div>
          </form>
        </div>
      </div>
    `;

    setTimeout(() => {
      makeSearchableSelect(modalWrap.querySelector("#f-jobNo"));
      makeSearchableSelect(modalWrap.querySelector("#f-vendor"));
      makeSearchableSelect(modalWrap.querySelector("#f-chargeHead"));

      document.getElementById("modal-close").onclick = () => { modalWrap.innerHTML = ''; };
      document.getElementById("form-cancel").onclick = () => { modalWrap.innerHTML = ''; };

      document.getElementById("exp-form").onsubmit = async (e) => {
        e.preventDefault();
        const fv = (id) => document.getElementById(id)?.value || '';

        const d = {
          jobNo: fv('f-jobNo'),
          vendor: fv('f-vendor'),
          chargeHead: fv('f-chargeHead'),
          amount: +fv('f-amount') || 0,
          currency: fv('f-currency'),
          expenseDate: fv('f-expenseDate'),
          billNo: fv('f-billNo'),
          status: fv('f-status'),
          remarks: fv('f-remarks')
        };

        if (!d.vendor || !d.amount) { showToast("Vendor and Amount are required.", "warning"); return; }

        if (editData) {
          await saveDocument("expenses", { ...editData, ...d }, editData.id);
          showToast("Expense record updated.", "success");
        } else {
          await saveDocument("expenses", d);
          showToast("Expense record added.", "success");
        }

        modalWrap.innerHTML = '';
        this.onRefreshNav();
        this.refreshPanel(container);
      };
    }, 50);
  }
}

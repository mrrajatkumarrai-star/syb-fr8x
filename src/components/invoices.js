import { getCollection, saveDocument, deleteDocument } from "../services/db.js";
import { fmtDate, fmtAmt, statusBadge, showToast, showConfirm, makeSearchableSelect } from "../services/ui.js";

export class Invoices {
  constructor(onRefreshNav) {
    this.onRefreshNav = onRefreshNav;
    this.searchQuery = "";
  }

  async render() {
    const list = await getCollection("invoices");
    let data = list;

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter(i => (i.invNo + (i.jobNo || '') + i.customer).toLowerCase().includes(q));
    }

    const totalRev = list.reduce((a, i) => a + i.total, 0);
    const unpaid = list.filter(i => i.status === 'Unpaid').reduce((a, i) => a + i.total, 0);
    const overdue = list.filter(i => i.status === 'Overdue').reduce((a, i) => a + i.total, 0);

    const container = document.createElement("div");
    container.innerHTML = `
      <div class="grid3" style="margin-bottom:12px">
        <div class="stat-card"><div class="stat-lbl">Total Invoiced</div><div class="stat-val" style="font-size:17px">${fmtAmt(totalRev)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Unpaid</div><div class="stat-val" style="font-size:17px;color:var(--warning)">${fmtAmt(unpaid)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Overdue</div><div class="stat-val" style="font-size:17px;color:var(--danger)">${fmtAmt(overdue)}</div></div>
      </div>
      <div class="filter-bar">
        <input class="search-input" id="inv-search" placeholder="Search by Invoice #, job #, customer..." value="${this.searchQuery}"/>
        <button class="btn pr sm" id="inv-add-btn"><i class="ti ti-plus" aria-hidden="true"></i> New Invoice</button>
      </div>
      <div class="tbl-wrap">
        <table id="tbl-invoices">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Job #</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Due Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `<tr><td colspan="8"><div class="empty-state"><i class="ti ti-receipt" aria-hidden="true"></i>No invoices yet.</div></td></tr>` :
            data.map(i => `
              <tr>
                <td style="font-weight:600;color:var(--primary)">${i.invNo}</td>
                <td>${i.jobNo || '—'}</td>
                <td>${i.customer}</td>
                <td style="font-size:11px">${fmtDate(i.invoiceDate)}</td>
                <td style="font-size:11px">${fmtDate(i.dueDate)}</td>
                <td style="font-weight:600">${fmtAmt(i.total, i.currency)}</td>
                <td>${statusBadge(i.status)}</td>
                <td>
                  <div class="row-actions">
                    <button class="btn sm" title="View details" data-act="view" data-iid="${i.id}"><i class="ti ti-eye"></i></button>
                    <button class="btn sm" title="Edit" data-act="edit" data-iid="${i.id}"><i class="ti ti-edit"></i></button>
                    <button class="btn sm" title="Mark Paid" data-act="pay" data-iid="${i.id}"><i class="ti ti-check"></i></button>
                    <button class="btn sm danger" title="Delete" data-act="delete" data-iid="${i.id}"><i class="ti ti-trash"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    setTimeout(() => {
      const search = container.querySelector("#inv-search");
      if (search) {
        search.oninput = (e) => {
          this.searchQuery = e.target.value;
          this.refreshPanel(container);
        };
      }

      container.querySelector("#inv-add-btn").onclick = () => this.openFormModal(null, container);

      // Row Actions click
      container.querySelectorAll("[data-act]").forEach(btn => {
        btn.onclick = (e) => {
          const act = btn.dataset.act;
          const iid = btn.dataset.iid;
          const invObj = list.find(i => i.id === iid);

          if (act === 'delete') {
            showConfirm(`Delete Invoice ${invObj.invNo}?`, async () => {
              await deleteDocument("invoices", iid);
              showToast(`Invoice ${invObj.invNo} deleted.`, "success");
              this.onRefreshNav();
              this.refreshPanel(container);
            });
          } else if (act === 'pay') {
            this.markInvoicePaid(invObj, container);
          } else if (act === 'view') {
            this.viewInvoiceDetails(invObj);
          } else if (act === 'edit') {
            this.openFormModal(invObj, container);
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

  async markInvoicePaid(inv, container) {
    const updated = { ...inv, status: 'Paid', paidDate: new Date().toISOString().split('T')[0] };
    await saveDocument("invoices", updated, inv.id);

    // Audit Log
    await saveDocument("auditLog", {
      ts: new Date().toLocaleString(),
      user: "Super Admin",
      action: "UPDATE",
      module: "Invoice",
      record: `${inv.invNo} marked Paid`,
      ip: "10.0.0." + Math.floor(Math.random() * 200 + 1)
    });

    // Notification
    await saveDocument("notifications", {
      msg: `Invoice ${inv.invNo} marked as Paid — ${fmtAmt(inv.total, inv.currency)}`,
      read: false,
      ts: new Date().toLocaleString(),
      type: "success"
    });

    showToast(`Invoice ${inv.invNo} marked as Paid.`, "success");
    this.onRefreshNav();
    this.refreshPanel(container);
  }

  viewInvoiceDetails(inv) {
    const modalWrap = document.getElementById("modal-container");
    if (!modalWrap) return;

    modalWrap.innerHTML = `
      <div class="modal-bg" onclick="if(event.target===this) { this.remove(); }">
        <div class="modal" style="width: 480px;">
          <div class="modal-title">${inv.invNo}<button class="btn sm" onclick="document.getElementById('modal-container').innerHTML=''"><i class="ti ti-x"></i></button></div>
          <div class="grid2" style="margin-bottom: 10px; gap: 6px;">
            <div>
              <div class="kv-row"><span class="kv-key">Customer</span><span>${inv.customer}</span></div>
              <div class="kv-row"><span class="kv-key">Job #</span><span>${inv.jobNo || '—'}</span></div>
              <div class="kv-row"><span class="kv-key">Invoice Date</span><span>${fmtDate(inv.invoiceDate)}</span></div>
              <div class="kv-row"><span class="kv-key">Due Date</span><span>${fmtDate(inv.dueDate)}</span></div>
            </div>
            <div>
              <div class="kv-row"><span class="kv-key">Status</span><span>${statusBadge(inv.status)}</span></div>
              <div class="kv-row"><span class="kv-key">Currency</span><span>${inv.currency || 'INR'}</span></div>
            </div>
          </div>
          <div style="border-top: 1px solid var(--border); padding-top: 10px; margin-bottom: 10px;">
            <table style="width: 100%; font-size: 12px;">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${(inv.items || []).map(it => `
                  <tr>
                    <td>${it.desc || '—'}</td>
                    <td>${it.qty}</td>
                    <td>${fmtAmt(it.rate, inv.currency)}</td>
                    <td>${fmtAmt(it.amount, inv.currency)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="kv-row"><span class="kv-key">Subtotal</span><span>${fmtAmt(inv.subtotal, inv.currency)}</span></div>
          <div class="kv-row"><span class="kv-key">GST (${inv.gstRate || 0}%)</span><span>${fmtAmt(inv.gstAmount, inv.currency)}</span></div>
          <div style="display: flex; justify-content: space-between; font-weight: 600; padding-top: 8px; font-size: 13px; border-top: 1px solid var(--border)">
            <span>Total</span><span>${fmtAmt(inv.total, inv.currency)}</span>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end;">
            ${inv.status !== 'Paid' ? `<button class="btn sm pr" id="detail-pay-btn"><i class="ti ti-check"></i> Mark Paid</button>` : ''}
            <button class="btn sm" onclick="document.getElementById('modal-container').innerHTML=''">Close</button>
          </div>
        </div>
      </div>
    `;

    const payBtn = document.getElementById("detail-pay-btn");
    if (payBtn) {
      payBtn.onclick = () => {
        modalWrap.innerHTML = '';
        this.markInvoicePaid(inv, document.querySelector("#tbl-invoices").parentElement.parentElement);
      };
    }
  }

  async openFormModal(editData, container) {
    const shipments = await getCollection("shipments");
    const customers = await getCollection("customers");
    const chargeHeads = await getCollection("chargeHeads");

    const modalWrap = document.getElementById("modal-container");
    if (!modalWrap) return;

    modalWrap.innerHTML = `
      <div class="modal-bg" id="invoice-form-modal">
        <div class="modal" style="width: 580px;">
          <div class="modal-title">${editData ? `Edit Invoice ${editData.invNo}` : 'New Invoice'}<button class="btn sm" id="modal-close"><i class="ti ti-x"></i></button></div>
          <form id="inv-form" onsubmit="event.preventDefault()">
            <div class="form-row">
              <div class="fg"><label>Shipment Job</label><select id="f-jobNo"><option value="">Select Job</option>${shipments.map(s => `<option value="${s.jobNo}" ${editData && editData.jobNo === s.jobNo ? 'selected' : ''}>${s.jobNo} — ${s.customer}</option>`).join('')}</select></div>
              <div class="fg"><label>Customer *</label><select id="f-customer"><option value="">Select Customer</option>${customers.map(c => `<option value="${c.company}" ${editData && editData.customer === c.company ? 'selected' : ''}>${c.company}</option>`).join('')}</select></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Invoice Date</label><input id="f-invoiceDate" type="date" value="${editData ? editData.invoiceDate : new Date().toISOString().split('T')[0]}"/></div>
              <div class="fg"><label>Due Date</label><input id="f-dueDate" type="date" value="${editData ? editData.dueDate : ''}"/></div>
            </div>
            
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:6px;margin-top:10px;text-transform:uppercase;">Line Items</div>
            <div id="inv-items-box" style="margin-bottom:10px;"></div>
            <button class="btn sm" type="button" id="add-item-row-btn" style="margin-bottom:14px;"><i class="ti ti-plus"></i> Add Line</button>
            
            <div class="form-row">
              <div class="fg"><label>GST %</label><select id="f-gstRate"><option value="0" ${editData && editData.gstRate === 0 ? 'selected' : ''}>0%</option><option value="5" ${editData && editData.gstRate === 5 ? 'selected' : ''}>5%</option><option value="12" ${editData && editData.gstRate === 12 ? 'selected' : ''}>12%</option><option value="18" ${editData && editData.gstRate === 18 ? 'selected' : ''}>18%</option></select></div>
              <div class="fg"><label>Currency</label><select id="f-currency"><option value="INR" ${editData && editData.currency === 'INR' ? 'selected' : ''}>INR</option><option value="USD" ${editData && editData.currency === 'USD' ? 'selected' : ''}>USD</option><option value="EUR" ${editData && editData.currency === 'EUR' ? 'selected' : ''}>EUR</option></select></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Status</label><select id="f-status">${['Draft', 'Unpaid', 'Paid', 'Overdue'].map(s => `<option ${editData && editData.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
              <div class="fg"><label>Remarks</label><input id="f-remarks" value="${editData ? editData.remarks || '' : ''}"/></div>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
              <button class="btn" type="button" id="form-cancel">Cancel</button>
              <button class="btn pr" type="submit"><i class="ti ti-check"></i> Save Invoice</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const itemsBox = modalWrap.querySelector("#inv-items-box");
    const addRowFn = (item = null) => {
      const chargeOptions = chargeHeads.filter(c => c.type !== 'Expense').map(c => `<option ${item && item.desc === c.name ? 'selected' : ''}>${c.name}</option>`).join('');
      const isOther = item && item.desc && !chargeHeads.some(c => c.name === item.desc && c.type !== 'Expense');
      const div = document.createElement("div");
      div.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:6px;margin-bottom:6px;align-items:center';

      div.innerHTML = `
        <select class="inv-desc" style="border:1px solid var(--border);border-radius:var(--radius-md);padding:5px 8px;font-size:12px;background:var(--bg-card);color:var(--text-main);">
          <option value="">— Select Charge —</option>
          ${chargeOptions}
          <option ${isOther ? 'selected' : ''}>Other</option>
        </select>
        <input class="inv-qty" type="number" value="${item ? item.qty : 1}" min="1" placeholder="Qty" style="border:1px solid var(--border);border-radius:var(--radius-md);padding:5px 8px;font-size:12px;background:var(--bg-card);color:var(--text-main);" />
        <input class="inv-rate" type="number" value="${item ? item.rate : 0}" placeholder="Rate" style="border:1px solid var(--border);border-radius:var(--radius-md);padding:5px 8px;font-size:12px;background:var(--bg-card);color:var(--text-main);" />
        <button class="btn sm danger" type="button" data-role="remove-row"><i class="ti ti-x"></i></button>
      `;

      div.querySelector("[data-role=remove-row]").onclick = () => {
        div.remove();
        this.calcTotalInModal();
      };

      div.querySelectorAll("input").forEach(i => i.oninput = () => this.calcTotalInModal());
      itemsBox.appendChild(div);
      this.calcTotalInModal();
    };

    // Calculate subtotal and display dynamically
    this.calcTotalInModal = () => {
      const qtys = [...modalWrap.querySelectorAll('.inv-qty')].map(e => +e.value || 0);
      const rates = [...modalWrap.querySelectorAll('.inv-rate')].map(e => +e.value || 0);
      const subtotal = qtys.reduce((sum, q, idx) => sum + q * rates[idx], 0);
      const gst = +document.getElementById('f-gstRate').value || 0;
      const total = subtotal * (1 + gst / 100);
      const cur = document.getElementById('f-currency').value || 'INR';

      let display = document.getElementById('modal-total-display');
      if (!display) {
        display = document.createElement("div");
        display.id = "modal-total-display";
        display.style.cssText = "font-size:12px; color:var(--text-muted); margin-bottom:10px; font-weight:600;";
        itemsBox.after(display);
      }
      display.textContent = `Subtotal: ${fmtAmt(subtotal, cur)} + GST ${gst}% = Total: ${fmtAmt(total, cur)}`;
    };

    setTimeout(() => {
      makeSearchableSelect(modalWrap.querySelector("#f-jobNo"));
      makeSearchableSelect(modalWrap.querySelector("#f-customer"));

      document.getElementById("modal-close").onclick = () => { modalWrap.innerHTML = ''; };
      document.getElementById("form-cancel").onclick = () => { modalWrap.innerHTML = ''; };
      document.getElementById("add-item-row-btn").onclick = () => addRowFn();
      document.getElementById("f-gstRate").onchange = () => this.calcTotalInModal();
      document.getElementById("f-currency").onchange = () => this.calcTotalInModal();

      // Load items
      const preLoadedItems = editData && editData.items ? editData.items : [{ desc: '', qty: 1, rate: 0 }];
      preLoadedItems.forEach(it => addRowFn(it));

      document.getElementById("inv-form").onsubmit = async (e) => {
        e.preventDefault();
        const fv = (id) => document.getElementById(id)?.value || '';

        const rows = [...itemsBox.children];
        const itemsList = rows.map(row => {
          const desc = row.querySelector(".inv-desc").value;
          const qty = +row.querySelector(".inv-qty").value || 0;
          const rate = +row.querySelector(".inv-rate").value || 0;
          return { desc, qty, rate, amount: qty * rate };
        }).filter(item => item.desc !== "");

        const subtotal = itemsList.reduce((sum, i) => sum + i.amount, 0);
        const gstRateVal = +fv('f-gstRate') || 0;
        const gstAmount = subtotal * (gstRateVal / 100);
        const total = subtotal + gstAmount;

        const d = {
          jobNo: fv('f-jobNo'),
          customer: fv('f-customer'),
          invoiceDate: fv('f-invoiceDate'),
          dueDate: fv('f-dueDate'),
          items: itemsList,
          subtotal,
          gstRate: gstRateVal,
          gstAmount,
          total,
          currency: fv('f-currency'),
          status: fv('f-status'),
          remarks: fv('f-remarks')
        };

        if (!d.customer) { showToast("Customer company is required.", "warning"); return; }
        if (itemsList.length === 0) { showToast("At least one line item is required.", "warning"); return; }

        if (editData) {
          await saveDocument("invoices", { ...editData, ...d }, editData.id);
          showToast(`Invoice ${editData.invNo} updated successfully.`, "success");
        } else {
          // Generate Invoice #
          const yr = new Date().getFullYear().toString().substr(2);
          const mn = String(new Date().getMonth() + 1).padStart(2, '0');
          const list = await getCollection("invoices");
          const nextSeq = String(list.length + 1).padStart(4, '0');

          d.invNo = `INV-${yr}${mn}-${nextSeq}`;
          d.createdAt = new Date().toLocaleString();

          await saveDocument("invoices", d);

          // Add Notification
          await saveDocument("notifications", {
            msg: `Invoice ${d.invNo} created for ${d.customer} — ${fmtAmt(d.total, d.currency)}`,
            read: false,
            ts: new Date().toLocaleString(),
            type: "info"
          });

          showToast(`Invoice ${d.invNo} generated.`, "success");
        }

        modalWrap.innerHTML = '';
        this.onRefreshNav();
        this.refreshPanel(container);
      };
    }, 50);
  }
}

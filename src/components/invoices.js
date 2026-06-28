/**
 * invoices.js
 * GST-aware invoice component.
 * - Per-line CGST/SGST or IGST based on supplier vs recipient state
 * - Auto-populated from customer master (GSTIN, state, stateCode)
 * - Sequential invoice numbering via invoice-number.js
 * - IRN/e-invoice status display + payload preparation via einvoice-adapter.js
 * - Fully backward-compatible: old invoices without GST fields render gracefully
 */

import { getCollection, saveDocument, deleteDocument } from "../services/db.js";
import { fmtDate, fmtAmt, statusBadge, showToast, showConfirm } from "../services/ui.js";
import {
  calcInvoiceTax, resolveStateCode, gstTypeLabel, validateGSTIN, GST_TYPE
} from "../services/gst-engine.js";
import { generateInvoiceNumber } from "../services/invoice-number.js";
import { buildIRNPayload, storeIRNResponse, IRN_STATUS } from "../services/einvoice-adapter.js";

// ─────────────────────────────────────────────────────────────────────────────
const GST_RATES = [0, 5, 12, 18, 28];

function irnBadge(inv) {
  const s = inv.irnStatus;
  if (!s || s === IRN_STATUS.DRAFT)     return `<span class="badge" style="background:rgba(100,116,139,0.15);color:#64748b">Draft</span>`;
  if (s === IRN_STATUS.SUBMITTED)       return `<span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b">Submitted</span>`;
  if (s === IRN_STATUS.SUCCESS)         return `<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981">✓ IRN</span>`;
  if (s === IRN_STATUS.FAILED)          return `<span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444">IRN Failed</span>`;
  if (s === IRN_STATUS.CANCELLED)       return `<span class="badge" style="background:rgba(239,68,68,0.08);color:#94a3b8">Cancelled</span>`;
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
export class Invoices {
  constructor(onRefreshNav) {
    this.onRefreshNav = onRefreshNav;
    this.searchQuery  = "";
  }

  // ── List View ──────────────────────────────────────────────────────────────
  async render() {
    const list = await getCollection("invoices");
    let data = list;

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter(i =>
        (i.invNo + (i.jobNo || '') + i.customer + (i.irnStatus || '')).toLowerCase().includes(q)
      );
    }

    const totalRev = list.reduce((a, i) => a + (i.total || 0), 0);
    const unpaid   = list.filter(i => i.status === 'Unpaid').reduce((a, i) => a + (i.total || 0), 0);
    const overdue  = list.filter(i => i.status === 'Overdue').reduce((a, i) => a + (i.total || 0), 0);

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
              <th>GST Type</th>
              <th>Status</th>
              <th>e-Invoice</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0
              ? `<tr><td colspan="10"><div class="empty-state"><i class="ti ti-receipt" aria-hidden="true"></i>No invoices yet.</div></td></tr>`
              : data.map(i => `
              <tr>
                <td style="font-weight:600;color:var(--primary)">${i.invNo}</td>
                <td>${i.jobNo || '—'}</td>
                <td>${i.customer}</td>
                <td style="font-size:11px">${fmtDate(i.invoiceDate)}</td>
                <td style="font-size:11px">${fmtDate(i.dueDate)}</td>
                <td style="font-weight:600">${fmtAmt(i.total, i.currency)}</td>
                <td style="font-size:10px;color:var(--text-muted)">${i.gstType ? gstTypeLabel(i.gstType).split('(')[0].trim() : '—'}</td>
                <td>${statusBadge(i.status)}</td>
                <td>${irnBadge(i)}</td>
                <td>
                  <div class="row-actions">
                    <button class="btn sm" title="View details" data-act="view" data-iid="${i.id}"><i class="ti ti-eye"></i></button>
                    <button class="btn sm" title="Edit" data-act="edit" data-iid="${i.id}"><i class="ti ti-edit"></i></button>
                    <button class="btn sm" title="Print / PDF" data-act="print" data-iid="${i.id}"><i class="ti ti-printer"></i></button>
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
          } else if (act === 'print') {
            this.printInvoice(invObj);
          }
        };
      });
    }, 50);

    return container;
  }

  // ── Refresh Panel ──────────────────────────────────────────────────────────
  async refreshPanel(container) {
    const parent = container.parentElement;
    if (parent) {
      const newEl = await this.render();
      parent.replaceChild(newEl, container);
    }
  }

  // ── Mark Paid ──────────────────────────────────────────────────────────────
  async markInvoicePaid(inv, container) {
    const updated = { ...inv, status: 'Paid', paidDate: new Date().toISOString().split('T')[0] };
    await saveDocument("invoices", updated, inv.id);

    await saveDocument("auditLog", {
      ts: new Date().toLocaleString(), user: "Super Admin",
      action: "UPDATE", module: "Invoice",
      record: `${inv.invNo} marked Paid`,
      ip: "10.0.0." + Math.floor(Math.random() * 200 + 1)
    });

    await saveDocument("notifications", {
      msg: `Invoice ${inv.invNo} marked as Paid — ${fmtAmt(inv.total, inv.currency)}`,
      read: false, ts: new Date().toLocaleString(), type: "success"
    });

    showToast(`Invoice ${inv.invNo} marked as Paid.`, "success");
    this.onRefreshNav();
    this.refreshPanel(container);
  }

  // ── Detail View ────────────────────────────────────────────────────────────
  viewInvoiceDetails(inv) {
    const modalWrap = document.getElementById("modal-container");
    if (!modalWrap) return;

    // GST breakup rows
    const gstType    = inv.gstType || '';
    const isCGST     = gstType === GST_TYPE.CGST_SGST;
    const gstBreakup = isCGST
      ? `<div class="kv-row"><span class="kv-key">CGST</span><span>${fmtAmt(inv.cgstTotal || 0, inv.currency)}</span></div>
         <div class="kv-row"><span class="kv-key">SGST</span><span>${fmtAmt(inv.sgstTotal || 0, inv.currency)}</span></div>`
      : `<div class="kv-row"><span class="kv-key">IGST</span><span>${fmtAmt(inv.igstTotal || 0, inv.currency)}</span></div>`;

    // IRN section
    const irnSection = (inv.irnStatus === IRN_STATUS.SUCCESS && inv.irnData)
      ? `<div style="border-top:1px solid var(--border);padding-top:10px;margin-top:10px">
           <div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase">e-Invoice / IRN Details</div>
           <div class="kv-row"><span class="kv-key">IRN</span><span style="font-size:9px;word-break:break-all;color:var(--primary)">${inv.irnData.irn || '—'}</span></div>
           <div class="kv-row"><span class="kv-key">Ack No</span><span>${inv.irnData.ackNo || '—'}</span></div>
           <div class="kv-row"><span class="kv-key">Ack Date</span><span>${inv.irnData.ackDt || '—'}</span></div>
           ${inv.irnData.signedQR
             ? `<div style="text-align:center;margin-top:8px"><img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(inv.irnData.signedQR.substring(0,200))}" style="width:80px;height:80px" alt="QR Code"></div>`
             : ''}
         </div>`
      : '';

    modalWrap.innerHTML = `
      <div class="modal-bg" onclick="if(event.target===this){this.remove()}">
        <div class="modal" style="width:520px">
          <div class="modal-title">${inv.invNo}<button class="btn sm" onclick="document.getElementById('modal-container').innerHTML=''"><i class="ti ti-x"></i></button></div>
          <div class="grid2" style="margin-bottom:10px;gap:6px">
            <div>
              <div class="kv-row"><span class="kv-key">Customer</span><span>${inv.customer}</span></div>
              <div class="kv-row"><span class="kv-key">Job #</span><span>${inv.jobNo || '—'}</span></div>
              <div class="kv-row"><span class="kv-key">Invoice Date</span><span>${fmtDate(inv.invoiceDate)}</span></div>
              <div class="kv-row"><span class="kv-key">Due Date</span><span>${fmtDate(inv.dueDate)}</span></div>
              ${inv.supplierGSTIN ? `<div class="kv-row"><span class="kv-key">Supplier GSTIN</span><span>${inv.supplierGSTIN}</span></div>` : ''}
              ${inv.recipientGSTIN ? `<div class="kv-row"><span class="kv-key">Recipient GSTIN</span><span>${inv.recipientGSTIN}</span></div>` : ''}
            </div>
            <div>
              <div class="kv-row"><span class="kv-key">Status</span><span>${statusBadge(inv.status)}</span></div>
              <div class="kv-row"><span class="kv-key">Currency</span><span>${inv.currency || 'INR'}</span></div>
              ${inv.placeOfSupply ? `<div class="kv-row"><span class="kv-key">Place of Supply</span><span>${inv.placeOfSupply}</span></div>` : ''}
              ${inv.gstType ? `<div class="kv-row"><span class="kv-key">GST Type</span><span style="font-size:10px">${gstTypeLabel(inv.gstType)}</span></div>` : ''}
            </div>
          </div>
          <div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:10px">
            <table style="width:100%;font-size:11px">
              <thead>
                <tr>
                  <th>Description</th><th>Qty</th><th>Rate</th><th>Taxable</th>
                  ${isCGST ? '<th>CGST</th><th>SGST</th>' : '<th>IGST</th>'}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${(inv.items || []).map(it => `
                  <tr>
                    <td>${it.desc || '—'}</td>
                    <td>${it.qty}</td>
                    <td>${fmtAmt(it.rate, inv.currency)}</td>
                    <td>${fmtAmt(it.taxableAmt || it.amount || 0, inv.currency)}</td>
                    ${isCGST
                      ? `<td>${fmtAmt(it.cgst || 0, inv.currency)}</td><td>${fmtAmt(it.sgst || 0, inv.currency)}</td>`
                      : `<td>${fmtAmt(it.igst || 0, inv.currency)}</td>`}
                    <td style="font-weight:600">${fmtAmt(it.lineTotal || it.amount || 0, inv.currency)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="kv-row"><span class="kv-key">Subtotal</span><span>${fmtAmt(inv.subtotal || 0, inv.currency)}</span></div>
          ${gstBreakup}
          <div class="kv-row"><span class="kv-key">Total GST</span><span>${fmtAmt(inv.totalGST || inv.gstAmount || 0, inv.currency)}</span></div>
          <div style="display:flex;justify-content:space-between;font-weight:700;padding-top:8px;font-size:14px;border-top:1px solid var(--border)">
            <span>Grand Total</span><span>${fmtAmt(inv.total || 0, inv.currency)}</span>
          </div>
          ${irnSection}
          <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
            ${inv.status !== 'Paid' ? `<button class="btn sm pr" id="detail-pay-btn"><i class="ti ti-check"></i> Mark Paid</button>` : ''}
            <button class="btn sm" id="detail-print-btn"><i class="ti ti-printer"></i> Print</button>
            <button class="btn sm" onclick="document.getElementById('modal-container').innerHTML=''">Close</button>
          </div>
        </div>
      </div>
    `;

    const payBtn = document.getElementById("detail-pay-btn");
    if (payBtn) {
      payBtn.onclick = () => {
        modalWrap.innerHTML = '';
        this.markInvoicePaid(inv, document.querySelector("#tbl-invoices")?.parentElement?.parentElement || document.body);
      };
    }
    const printBtn = document.getElementById("detail-print-btn");
    if (printBtn) printBtn.onclick = () => this.printInvoice(inv);
  }

  // ── Form Modal ─────────────────────────────────────────────────────────────
  async openFormModal(editData, container) {
    const [shipments, customers, chargeHeads, settings] = await Promise.all([
      getCollection("shipments"),
      getCollection("customers"),
      getCollection("chargeHeads"),
      getCollection("settings")
    ]);

    const s = settings || {};
    const modalWrap = document.getElementById("modal-container");
    if (!modalWrap) return;

    // Supplier state from settings
    const supplierGSTIN     = s.gst || '';
    const supplierStateCode = resolveStateCode(supplierGSTIN, s.companyStateCode || '');
    const invoicePrefix     = s.invoicePrefix || 'INV';

    // Pre-fill from editData
    const ed = editData || {};
    const selectedCustomerId = customers.find(c => c.company === ed.customer)?.id || '';

    const custOptions = customers.map(c =>
      `<option value="${c.id}" data-gstin="${c.gst || ''}" data-state="${c.billingState || ''}" data-code="${c.billingStateCode || ''}" ${selectedCustomerId === c.id ? 'selected' : ''}>${c.company}</option>`
    ).join('');

    const shipOptions = shipments.map(ship =>
      `<option value="${ship.jobNo}" ${ed.jobNo === ship.jobNo ? 'selected' : ''}>${ship.jobNo} — ${ship.customer}</option>`
    ).join('');

    modalWrap.innerHTML = `
      <div class="modal-bg" id="invoice-form-modal">
        <div class="modal" style="width:640px;max-height:90vh;overflow-y:auto">
          <div class="modal-title">
            ${editData ? `Edit Invoice ${ed.invNo}` : 'New Invoice'}
            <button class="btn sm" id="modal-close"><i class="ti ti-x"></i></button>
          </div>
          <form id="inv-form" onsubmit="event.preventDefault()">

            <div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase">Supplier</div>
            <div class="form-row" style="margin-bottom:10px">
              <div class="kv-row" style="flex:1"><span class="kv-key">Company</span><span>${s.company || '—'}</span></div>
              <div class="kv-row" style="flex:1"><span class="kv-key">GSTIN</span><span>${supplierGSTIN || '—'}</span></div>
              <div class="kv-row" style="flex:1"><span class="kv-key">State Code</span><span>${supplierStateCode || '—'}</span></div>
            </div>

            <div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;border-top:1px solid var(--border);padding-top:10px">Invoice Details</div>
            <div class="form-row">
              <div class="fg"><label>Shipment Job</label>
                <select id="f-jobNo"><option value="">— Select Job —</option>${shipOptions}</select>
              </div>
              <div class="fg"><label>Customer / Billed Party *</label>
                <select id="f-customer"><option value="">Select Customer</option>${custOptions}</select>
              </div>
            </div>
            <div id="recipient-info" style="font-size:10px;color:var(--text-muted);margin-bottom:8px;padding:6px 8px;background:var(--bg-hover);border-radius:6px;display:none">
              GSTIN: <span id="ri-gstin">—</span> &nbsp;|&nbsp; State: <span id="ri-state">—</span> &nbsp;|&nbsp; Code: <span id="ri-code">—</span>
            </div>

            <div class="form-row">
              <div class="fg"><label>Invoice Date</label><input id="f-invoiceDate" type="date" value="${ed.invoiceDate || new Date().toISOString().split('T')[0]}"/></div>
              <div class="fg"><label>Due Date</label><input id="f-dueDate" type="date" value="${ed.dueDate || ''}"/></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Place of Supply (State Code)</label>
                <input id="f-placeOfSupply" maxlength="2" placeholder="e.g. 27" value="${ed.placeOfSupply || supplierStateCode || ''}"/>
              </div>
              <div class="fg">
                <label>GST Transaction Type</label>
                <div id="gst-type-badge" style="padding:8px;background:var(--bg-hover);border-radius:6px;font-size:11px;font-weight:600;color:var(--primary)">—</div>
              </div>
            </div>

            <div class="form-row" style="margin-bottom:4px">
              <label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer">
                <input type="checkbox" id="f-isExport" ${ed.isExport ? 'checked' : ''}> Export Supply
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer">
                <input type="checkbox" id="f-isSEZ" ${ed.isSEZ ? 'checked' : ''}> SEZ Unit/Developer
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer">
                <input type="checkbox" id="f-isReverseCharge" ${ed.isReverseCharge ? 'checked' : ''}> Reverse Charge
              </label>
            </div>

            <div style="font-size:10px;font-weight:700;color:var(--text-muted);margin:12px 0 6px;text-transform:uppercase;border-top:1px solid var(--border);padding-top:10px">Line Items</div>
            <div id="inv-items-box" style="margin-bottom:6px"></div>
            <button class="btn sm" type="button" id="add-item-row-btn" style="margin-bottom:14px"><i class="ti ti-plus"></i> Add Line</button>

            <div id="inv-tax-summary" style="background:var(--bg-hover);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;display:none">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--text-muted)">Subtotal</span><span id="ts-subtotal">0.00</span></div>
              <div id="ts-cgst-row" style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--text-muted)">CGST</span><span id="ts-cgst">0.00</span></div>
              <div id="ts-sgst-row" style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--text-muted)">SGST</span><span id="ts-sgst">0.00</span></div>
              <div id="ts-igst-row" style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--text-muted)">IGST</span><span id="ts-igst">0.00</span></div>
              <div style="display:flex;justify-content:space-between;font-weight:700;border-top:1px solid var(--border);padding-top:6px"><span>Grand Total</span><span id="ts-total">0.00</span></div>
            </div>

            <div class="form-row">
              <div class="fg"><label>Currency</label>
                <select id="f-currency">
                  <option value="INR" ${(ed.currency || 'INR') === 'INR' ? 'selected' : ''}>INR (₹)</option>
                  <option value="USD" ${ed.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                  <option value="EUR" ${ed.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                </select>
              </div>
              <div class="fg"><label>Status</label>
                <select id="f-status">
                  ${['Draft','Unpaid','Paid','Overdue'].map(s2 => `<option ${ed.status === s2 ? 'selected' : ''}>${s2}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="fg" style="margin-bottom:14px"><label>Remarks</label><input id="f-remarks" value="${ed.remarks || ''}"/></div>

            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
              <button class="btn" type="button" id="form-cancel">Cancel</button>
              <button class="btn pr" type="submit"><i class="ti ti-check"></i> Save Invoice</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // ── After DOM insert ────────────────────────────────────────────────────
    setTimeout(() => {
      // Close handlers
      document.getElementById("modal-close").onclick  = () => { modalWrap.innerHTML = ''; };
      document.getElementById("form-cancel").onclick  = () => { modalWrap.innerHTML = ''; };

      const itemsBox = modalWrap.querySelector("#inv-items-box");

      // State refs
      let currentRecipientStateCode = ed.recipientStateCode || '';
      let currentRecipientGSTIN     = ed.recipientGSTIN || '';

      // ── Recalculate ─────────────────────────────────────────────────────
      const recalc = () => {
        const pos = (document.getElementById('f-placeOfSupply')?.value || '').trim();
        const flags = {
          isExport:        document.getElementById('f-isExport')?.checked || false,
          isSEZ:           document.getElementById('f-isSEZ')?.checked    || false,
          isReverseCharge: document.getElementById('f-isReverseCharge')?.checked || false
        };

        const effRecipientCode = pos || currentRecipientStateCode;

        // Collect lines
        const rows = [...itemsBox.children];
        const lines = rows.map(row => ({
          qty:      +(row.querySelector('.inv-qty')?.value  || 0),
          rate:     +(row.querySelector('.inv-rate')?.value || 0),
          gstRate:  +(row.querySelector('.inv-gst')?.value  || 0),
          desc:     row.querySelector('.inv-desc')?.value || '',
          sacCode:  row.querySelector('.inv-desc')?.selectedOptions?.[0]?.dataset?.sac || ''
        })).filter(l => l.desc !== '');

        const result = calcInvoiceTax(lines, supplierStateCode, effRecipientCode, flags);

        // Update GST type badge
        const badge = document.getElementById('gst-type-badge');
        if (badge) {
          badge.textContent = gstTypeLabel(result.gstType);
          badge.style.color = result.gstType === GST_TYPE.REVIEW
            ? 'var(--danger)'
            : (result.gstType === GST_TYPE.CGST_SGST ? 'var(--success)' : 'var(--primary)');
        }

        // Update summary
        const isCGST = result.gstType === GST_TYPE.CGST_SGST;
        const cur    = document.getElementById('f-currency')?.value || 'INR';
        const sumDiv = document.getElementById('inv-tax-summary');
        if (sumDiv) {
          sumDiv.style.display = lines.length > 0 ? '' : 'none';
          document.getElementById('ts-subtotal').textContent = fmtAmt(result.subtotal, cur);
          document.getElementById('ts-cgst').textContent     = fmtAmt(result.cgstTotal, cur);
          document.getElementById('ts-sgst').textContent     = fmtAmt(result.sgstTotal, cur);
          document.getElementById('ts-igst').textContent     = fmtAmt(result.igstTotal, cur);
          document.getElementById('ts-total').textContent    = fmtAmt(result.grandTotal, cur);
          document.getElementById('ts-cgst-row').style.display = isCGST ? '' : 'none';
          document.getElementById('ts-sgst-row').style.display = isCGST ? '' : 'none';
          document.getElementById('ts-igst-row').style.display = isCGST ? 'none' : '';
        }

        // Per-line cell updates
        rows.forEach((row, idx) => {
          const lineResult = result.lines[idx];
          if (!lineResult) return;
          const cgstCell = row.querySelector('.line-cgst');
          const sgstCell = row.querySelector('.line-sgst');
          const igstCell = row.querySelector('.line-igst');
          const totCell  = row.querySelector('.line-total');
          if (cgstCell) cgstCell.textContent = fmtAmt(lineResult.cgst,  cur);
          if (sgstCell) sgstCell.textContent = fmtAmt(lineResult.sgst,  cur);
          if (igstCell) igstCell.textContent = fmtAmt(lineResult.igst,  cur);
          if (totCell)  totCell.textContent  = fmtAmt(lineResult.lineTotal, cur);
        });
      };

      // ── Customer change ──────────────────────────────────────────────────
      const customerSel = document.getElementById('f-customer');
      if (customerSel) {
        const onCustChange = () => {
          const opt = customerSel.selectedOptions[0];
          if (!opt || !opt.value) {
            document.getElementById('recipient-info').style.display = 'none';
            currentRecipientStateCode = '';
            currentRecipientGSTIN = '';
            recalc();
            return;
          }
          currentRecipientGSTIN     = opt.dataset.gstin || '';
          currentRecipientStateCode = resolveStateCode(currentRecipientGSTIN, opt.dataset.code || '');
          document.getElementById('ri-gstin').textContent = currentRecipientGSTIN || '—';
          document.getElementById('ri-state').textContent = opt.dataset.state    || '—';
          document.getElementById('ri-code').textContent  = currentRecipientStateCode || '—';
          document.getElementById('recipient-info').style.display = '';

          // Auto-set place of supply to recipient state if not set
          const posInput = document.getElementById('f-placeOfSupply');
          if (posInput && !posInput.value && currentRecipientStateCode) {
            posInput.value = currentRecipientStateCode;
          }
          recalc();
        };
        customerSel.onchange = onCustChange;
        // Trigger immediately if editing
        if (ed.customer) onCustChange();
      }

      // ── Add line row ─────────────────────────────────────────────────────
      const revenueChargeHeads = chargeHeads.filter(c => c.type !== 'Expense');

      const addRowFn = (item = null) => {
        const div = document.createElement("div");
        div.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 60px 60px 60px 60px auto;gap:4px;margin-bottom:5px;align-items:center;font-size:11px';

        const chargeOpts = revenueChargeHeads.map(ch => {
          const sel = item && item.desc === ch.name ? 'selected' : '';
          return `<option value="${ch.name}" data-rate="${ch.gstRate || 0}" data-sac="${ch.sacCode || ''}" ${sel}>${ch.name}</option>`;
        }).join('');

        const isOther = item && item.desc && !revenueChargeHeads.some(c => c.name === item.desc);
        const gstRateOpts = GST_RATES.map(r => `<option value="${r}" ${(item && item.gstRate === r) ? 'selected' : ''}>${r}%</option>`).join('');

        div.innerHTML = `
          <select class="inv-desc" style="border:1px solid var(--border);border-radius:var(--radius-md);padding:4px 6px;background:var(--bg-card);color:var(--text-main)">
            <option value="">— Charge —</option>
            ${chargeOpts}
            <option value="Other" ${isOther ? 'selected' : ''}>Other</option>
          </select>
          <input class="inv-qty"  type="number" value="${item ? item.qty  : 1}"   min="1" placeholder="Qty"  style="border:1px solid var(--border);border-radius:var(--radius-md);padding:4px 6px;background:var(--bg-card);color:var(--text-main)"/>
          <input class="inv-rate" type="number" value="${item ? item.rate : 0}"         placeholder="Rate" style="border:1px solid var(--border);border-radius:var(--radius-md);padding:4px 6px;background:var(--bg-card);color:var(--text-main)"/>
          <select class="inv-gst" style="border:1px solid var(--border);border-radius:var(--radius-md);padding:4px 6px;background:var(--bg-card);color:var(--text-main)">${gstRateOpts}</select>
          <span class="line-cgst" style="color:var(--text-muted);text-align:right">0.00</span>
          <span class="line-sgst" style="color:var(--text-muted);text-align:right">0.00</span>
          <span class="line-igst" style="color:var(--text-muted);text-align:right">0.00</span>
          <button class="btn sm danger" type="button" data-role="remove-row"><i class="ti ti-x"></i></button>
        `;

        // Auto-fill GST rate from charge head
        div.querySelector('.inv-desc').onchange = (e) => {
          const opt = e.target.selectedOptions[0];
          if (opt && opt.dataset.rate !== undefined) {
            div.querySelector('.inv-gst').value = opt.dataset.rate;
          }
          recalc();
        };

        div.querySelector('[data-role=remove-row]').onclick = () => { div.remove(); recalc(); };
        div.querySelectorAll('input, select').forEach(el => el.oninput = recalc);
        div.querySelectorAll('select').forEach(el => el.onchange = recalc);

        itemsBox.appendChild(div);
        recalc();
      };

      document.getElementById("add-item-row-btn").onclick = () => addRowFn();

      // Wire global change recalculation
      ['f-placeOfSupply','f-isExport','f-isSEZ','f-isReverseCharge','f-currency'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.oninput = recalc; el.onchange = recalc; }
      });

      // Load pre-existing items
      const preItems = ed.items && ed.items.length > 0 ? ed.items : [{ desc: '', qty: 1, rate: 0, gstRate: 18 }];
      preItems.forEach(it => addRowFn(it));

      // ── Save handler ─────────────────────────────────────────────────────
      document.getElementById("inv-form").onsubmit = async (e) => {
        e.preventDefault();
        const fv = (id) => document.getElementById(id)?.value || '';

        // Resolve customer
        const custSel = document.getElementById('f-customer');
        const custOpt = custSel?.selectedOptions?.[0];
        const customerName  = custOpt?.text?.split(' — ')[0] || custSel?.value || '';
        const recipientGSTIN     = custOpt?.dataset?.gstin || '';
        const recipientStateCode = resolveStateCode(recipientGSTIN, custOpt?.dataset?.code || '');

        if (!customerName) { showToast("Customer is required.", "warning"); return; }

        // Collect lines
        const rows  = [...itemsBox.children];
        const lines = rows.map(row => ({
          desc:    row.querySelector('.inv-desc')?.value || '',
          qty:     +(row.querySelector('.inv-qty')?.value  || 0),
          rate:    +(row.querySelector('.inv-rate')?.value || 0),
          gstRate: +(row.querySelector('.inv-gst')?.value  || 0),
          sacCode: row.querySelector('.inv-desc')?.selectedOptions?.[0]?.dataset?.sac || ''
        })).filter(l => l.desc !== '');

        if (lines.length === 0) { showToast("At least one line item is required.", "warning"); return; }

        const flags = {
          isExport:        document.getElementById('f-isExport')?.checked        || false,
          isSEZ:           document.getElementById('f-isSEZ')?.checked           || false,
          isReverseCharge: document.getElementById('f-isReverseCharge')?.checked || false
        };

        const placeOfSupply = fv('f-placeOfSupply') || recipientStateCode;
        const taxResult = calcInvoiceTax(lines, supplierStateCode, placeOfSupply || recipientStateCode, flags);

        const d = {
          jobNo:        fv('f-jobNo'),
          customer:     customerName,
          invoiceDate:  fv('f-invoiceDate'),
          dueDate:      fv('f-dueDate'),
          currency:     fv('f-currency'),
          status:       fv('f-status'),
          remarks:      fv('f-remarks'),
          isExport:     flags.isExport,
          isSEZ:        flags.isSEZ,
          isReverseCharge: flags.isReverseCharge,
          // Supplier
          supplierGSTIN:     supplierGSTIN,
          supplierState:     s.companyState || '',
          supplierStateCode: supplierStateCode || '',
          // Recipient
          recipientGSTIN:     recipientGSTIN,
          recipientState:     custOpt?.dataset?.state || '',
          recipientStateCode: recipientStateCode || '',
          placeOfSupply:      placeOfSupply,
          // GST
          gstType:    taxResult.gstType,
          items:      taxResult.lines.map(l => ({ ...l })),
          subtotal:   taxResult.subtotal,
          gstRate:    0, // deprecated — kept for backward compat
          gstAmount:  taxResult.totalGST,
          cgstTotal:  taxResult.cgstTotal,
          sgstTotal:  taxResult.sgstTotal,
          igstTotal:  taxResult.igstTotal,
          totalGST:   taxResult.totalGST,
          total:      taxResult.grandTotal,
          irnStatus:  editData ? (ed.irnStatus || IRN_STATUS.DRAFT) : IRN_STATUS.DRAFT
        };

        // Validation: warn if REVIEW state (missing location)
        if (d.gstType === GST_TYPE.REVIEW) {
          showToast("⚠ GST cannot be determined — supplier or recipient state is missing. Invoice saved in REVIEW state.", "warning");
        }

        if (editData) {
          await saveDocument("invoices", { ...editData, ...d }, editData.id);
          showToast(`Invoice ${editData.invNo} updated successfully.`, "success");
        } else {
          // Generate safe sequential invoice number
          d.invNo = await generateInvoiceNumber(invoicePrefix);
          d.createdAt = new Date().toLocaleString();

          await saveDocument("invoices", d);

          await saveDocument("notifications", {
            msg: `Invoice ${d.invNo} created for ${d.customer} — ${fmtAmt(d.total, d.currency)}`,
            read: false, ts: new Date().toLocaleString(), type: "info"
          });

          await saveDocument("auditLog", {
            ts: new Date().toLocaleString(), user: "System",
            action: "CREATE", module: "Invoice",
            record: `${d.invNo} | ${d.customer} | ${d.total} ${d.currency} | GST: ${gstTypeLabel(d.gstType)}`,
            ip: "127.0.0.1"
          });

          showToast(`Invoice ${d.invNo} generated.`, "success");
        }

        modalWrap.innerHTML = '';
        this.onRefreshNav();
        this.refreshPanel(container);
      };
    }, 50);
  }

  // ── Print ──────────────────────────────────────────────────────────────────
  printInvoice(inv) {
    const isCGST = inv.gstType === GST_TYPE.CGST_SGST;
    const hasIRN = inv.irnStatus === IRN_STATUS.SUCCESS && inv.irnData;

    const irnSection = hasIRN
      ? `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:16px;background:#f8fafc">
           <div style="font-size:10px;font-weight:700;color:#64748b;margin-bottom:8px;text-transform:uppercase">e-Invoice / IRN Details</div>
           <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">
             <div><span style="color:#64748b">IRN:</span><br><span style="word-break:break-all;font-size:9px">${inv.irnData.irn || '—'}</span></div>
             <div><span style="color:#64748b">Ack No:</span><br><strong>${inv.irnData.ackNo || '—'}</strong></div>
             <div><span style="color:#64748b">Ack Date:</span><br>${inv.irnData.ackDt || '—'}</div>
           </div>
           ${inv.irnData.signedQR
             ? `<div style="margin-top:10px"><img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(inv.irnData.signedQR.substring(0,200))}" style="width:100px;height:100px" alt="QR"></div>`
             : ''}
         </div>`
      : '';

    const printContent = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8"><title>Invoice ${inv.invNo}</title>
      <style>
        body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;padding:32px;max-width:800px;margin:0 auto}
        h1{font-size:22px;font-weight:700;color:#1e293b;margin:0}
        .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #2563eb}
        .inv-no{color:#2563eb;font-size:16px;font-weight:700}
        .parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
        .party-box{background:#f8fafc;border-radius:8px;padding:12px}
        .party-lbl{font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px}
        table{width:100%;border-collapse:collapse;margin-bottom:16px}
        th{background:#f1f5f9;padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase}
        td{padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:11px}
        .totals-box{float:right;width:280px}
        .tot-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}
        .grand{border-top:2px solid #1e293b;font-weight:700;font-size:14px;padding-top:8px;margin-top:4px}
        @media print{body{padding:0}}
      </style></head><body>
      <div class="header">
        <div>
          <h1>${inv.customer}</h1>
          <div style="color:#64748b;font-size:11px;margin-top:4px">Tax Invoice</div>
        </div>
        <div style="text-align:right">
          <div class="inv-no">${inv.invNo}</div>
          <div style="font-size:11px;color:#64748b">Date: ${fmtDate(inv.invoiceDate)}</div>
          <div style="font-size:11px;color:#64748b">Due: ${fmtDate(inv.dueDate)}</div>
        </div>
      </div>
      <div class="parties">
        <div class="party-box">
          <div class="party-lbl">Supplier</div>
          <div style="font-weight:600">${inv.supplierState || ''}</div>
          ${inv.supplierGSTIN ? `<div style="font-size:10px;color:#64748b">GSTIN: ${inv.supplierGSTIN}</div>` : ''}
        </div>
        <div class="party-box">
          <div class="party-lbl">Bill To</div>
          <div style="font-weight:600">${inv.customer}</div>
          ${inv.recipientGSTIN ? `<div style="font-size:10px;color:#64748b">GSTIN: ${inv.recipientGSTIN}</div>` : ''}
          ${inv.recipientState ? `<div style="font-size:10px;color:#64748b">State: ${inv.recipientState} (${inv.recipientStateCode})</div>` : ''}
          ${inv.placeOfSupply ? `<div style="font-size:10px;color:#64748b">Place of Supply: ${inv.placeOfSupply}</div>` : ''}
        </div>
      </div>
      ${irnSection}
      <table>
        <thead><tr>
          <th>#</th><th>Description</th><th>SAC</th><th>Qty</th><th>Rate</th><th>Taxable</th>
          ${isCGST ? '<th>CGST%</th><th>CGST</th><th>SGST%</th><th>SGST</th>' : '<th>IGST%</th><th>IGST</th>'}
          <th>Total</th>
        </tr></thead>
        <tbody>
          ${(inv.items || []).map((it, i) => `
            <tr>
              <td>${i+1}</td>
              <td>${it.desc}</td>
              <td style="color:#64748b">${it.sacCode || '—'}</td>
              <td>${it.qty}</td>
              <td>${fmtAmt(it.rate, inv.currency)}</td>
              <td>${fmtAmt(it.taxableAmt || it.amount || 0, inv.currency)}</td>
              ${isCGST
                ? `<td>${it.gstRate/2}%</td><td>${fmtAmt(it.cgst||0,inv.currency)}</td><td>${it.gstRate/2}%</td><td>${fmtAmt(it.sgst||0,inv.currency)}</td>`
                : `<td>${it.gstRate}%</td><td>${fmtAmt(it.igst||0,inv.currency)}</td>`}
              <td style="font-weight:600">${fmtAmt(it.lineTotal||it.amount||0,inv.currency)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="totals-box">
        <div class="tot-row"><span>Subtotal</span><span>${fmtAmt(inv.subtotal||0,inv.currency)}</span></div>
        ${isCGST
          ? `<div class="tot-row"><span>CGST</span><span>${fmtAmt(inv.cgstTotal||0,inv.currency)}</span></div>
             <div class="tot-row"><span>SGST</span><span>${fmtAmt(inv.sgstTotal||0,inv.currency)}</span></div>`
          : `<div class="tot-row"><span>IGST</span><span>${fmtAmt(inv.igstTotal||0,inv.currency)}</span></div>`}
        <div class="tot-row grand"><span>Grand Total</span><span>${fmtAmt(inv.total||0,inv.currency)}</span></div>
      </div>
      <div style="clear:both;padding-top:30px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;margin-top:20px;text-align:center">
        This is a computer-generated invoice. Job: ${inv.jobNo || '—'} | Remarks: ${inv.remarks || '—'}
      </div>
      <script>window.onload=()=>window.print();</script>
    </body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(printContent); win.document.close(); }
  }
}

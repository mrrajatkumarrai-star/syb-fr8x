import { getCollection, saveDocument, deleteDocument } from "../services/db.js";
import { fmtAmt, statusBadge, showToast, showConfirm } from "../services/ui.js";

export class Masters {
  constructor(type, onRefreshNav) {
    this.type = type; // 'customers', 'vendors', 'ports', 'shippingLines', 'commodities', 'chargeHeads'
    this.onRefreshNav = onRefreshNav;
    this.searchQuery = "";
  }

  async render() {
    const list = await getCollection(this.type);
    let data = list;

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      if (this.type === 'customers') {
        data = data.filter(x => (x.company + x.code + (x.contactPerson || '') + (x.phone || '') + (x.email || '')).toLowerCase().includes(q));
      } else if (this.type === 'vendors') {
        data = data.filter(x => (x.company + x.code + (x.vendorType || '') + (x.contactPerson || '')).toLowerCase().includes(q));
      } else if (this.type === 'ports') {
        data = data.filter(x => (x.name + x.code + x.country + (x.unlocode || '')).toLowerCase().includes(q));
      } else if (this.type === 'shippingLines') {
        data = data.filter(x => (x.name + (x.scac || '') + (x.agent || '') + (x.contact || '')).toLowerCase().includes(q));
      } else if (this.type === 'commodities') {
        data = data.filter(x => (x.description + x.hsCode + (x.category || '')).toLowerCase().includes(q));
      } else if (this.type === 'chargeHeads') {
        data = data.filter(x => (x.name + x.code + (x.sacCode || '') + (x.type || '')).toLowerCase().includes(q));
      }
    }

    const container = document.createElement("div");
    container.innerHTML = `
      <div class="filter-bar">
        <input class="search-input" id="master-search" placeholder="${this.getSearchPlaceholder()}" value="${this.searchQuery}"/>
        <button class="btn pr sm" id="master-add-btn"><i class="ti ti-plus" aria-hidden="true"></i> Add ${this.getLabel()}</button>
      </div>
      <div class="tbl-wrap">
        ${this.renderTableHTML(data)}
      </div>
    `;

    // Hook listeners
    setTimeout(() => {
      const search = container.querySelector("#master-search");
      if (search) {
        search.oninput = (e) => {
          this.searchQuery = e.target.value;
          this.refreshPanel(container);
        };
      }

      container.querySelector("#master-add-btn").onclick = () => this.openFormModal(null, container);

      // Actions buttons
      container.querySelectorAll("[data-act]").forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const act = btn.dataset.act;
          const id = btn.dataset.id;
          const itemObj = list.find(x => x.id === id);
          const name = itemObj.company || itemObj.name || itemObj.description || itemObj.containerNo || itemObj.code || 'item';

          if (act === 'delete') {
            showConfirm(`Delete ${this.getLabel()} "${name}"? This cannot be undone.`, async () => {
              await deleteDocument(this.type, id);
              showToast(`Deleted successfully.`, "success");
              this.onRefreshNav();
              this.refreshPanel(container);
            });
          } else if (act === 'edit') {
            this.openFormModal(itemObj, container);
          }
        };
      });

      // Row detail clicks for Customers or Vendors
      if (this.type === 'customers' || this.type === 'vendors') {
        container.querySelectorAll("tbody tr[data-id]").forEach(row => {
          row.style.cursor = "pointer";
          row.onclick = async () => {
            const id = row.dataset.id;
            if (this.type === 'customers') {
              const { openCustomerDetail } = await import("../services/ui.js");
              openCustomerDetail(id);
            } else {
              const { openVendorDetail } = await import("../services/ui.js");
              openVendorDetail(id);
            }
          };
        });
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

  getLabel() {
    const labels = {
      customers: 'Customer',
      vendors: 'Vendor',
      ports: 'Port/Airport',
      shippingLines: 'Shipping Line',
      commodities: 'Commodity',
      chargeHeads: 'Charge Head'
    };
    return labels[this.type] || 'Record';
  }

  getSearchPlaceholder() {
    const placeholders = {
      customers: 'Search customers, code, email, contacts...',
      vendors: 'Search vendors, type, code...',
      ports: 'Search ports, UN/LOCODE, country...',
      shippingLines: 'Search shipping lines, SCAC...',
      commodities: 'Search commodities description, HS Code...',
      chargeHeads: 'Search charge heads, code, SAC...'
    };
    return placeholders[this.type] || 'Search...';
  }

  renderTableHTML(data) {
    if (this.type === 'customers') {
      return `
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Company Name</th>
              <th>Contact Person</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Credit Limit</th>
              <th>Terms</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `<tr><td colspan="9"><div class="empty-state">No customers found.</div></td></tr>` :
            data.map(c => `
              <tr data-id="${c.id}">
                <td style="font-weight:600; color:var(--primary)">${c.code}</td>
                <td style="font-weight:600">${c.company}</td>
                <td>${c.contactPerson || '—'}</td>
                <td>${c.phone || '—'}</td>
                <td style="font-size:12px">${c.email || '—'}</td>
                <td>${fmtAmt(c.creditLimit, c.currency)}</td>
                <td>${c.paymentTerms || '—'}</td>
                <td>${statusBadge(c.status || 'Active')}</td>
                <td>
                  <div class="row-actions" onclick="event.stopPropagation()">
                    <button class="btn sm" data-act="edit" data-id="${c.id}"><i class="ti ti-edit"></i></button>
                    <button class="btn sm danger" data-act="delete" data-id="${c.id}"><i class="ti ti-trash"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (this.type === 'vendors') {
      return `
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Vendor Company</th>
              <th>Vendor Type</th>
              <th>Contact</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Outstanding</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `<tr><td colspan="9"><div class="empty-state">No vendors found.</div></td></tr>` :
            data.map(v => `
              <tr data-id="${v.id}">
                <td style="font-weight:600; color:var(--primary)">${v.code}</td>
                <td style="font-weight:600">${v.company}</td>
                <td><span class="badge b-gray" style="font-size:10px">${v.vendorType}</span></td>
                <td>${v.contactPerson || '—'}</td>
                <td>${v.phone || '—'}</td>
                <td style="font-size:12px">${v.email || '—'}</td>
                <td style="font-weight:600; color:${(v.outstanding || 0) > 0 ? 'var(--danger)' : 'inherit'}">${fmtAmt(v.outstanding || 0)}</td>
                <td>${statusBadge(v.status || 'Active')}</td>
                <td>
                  <div class="row-actions" onclick="event.stopPropagation()">
                    <button class="btn sm" data-act="edit" data-id="${v.id}"><i class="ti ti-edit"></i></button>
                    <button class="btn sm danger" data-act="delete" data-id="${v.id}"><i class="ti ti-trash"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (this.type === 'ports') {
      return `
        <table>
          <thead>
            <tr>
              <th>UN/LOCODE</th>
              <th>Port Name</th>
              <th>Country</th>
              <th>Type</th>
              <th>Timezone</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `<tr><td colspan="6"><div class="empty-state">No ports found.</div></td></tr>` :
            data.map(p => `
              <tr>
                <td style="font-weight:600; color:var(--primary)">${p.code}</td>
                <td style="font-weight:600">${p.name}</td>
                <td>${p.country}</td>
                <td><span class="badge b-blue" style="font-size:10px">${p.type}</span></td>
                <td style="font-size:11px">${p.timezone || '—'}</td>
                <td>
                  <div class="row-actions">
                    <button class="btn sm" data-act="edit" data-id="${p.id}"><i class="ti ti-edit"></i></button>
                    <button class="btn sm danger" data-act="delete" data-id="${p.id}"><i class="ti ti-trash"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (this.type === 'shippingLines') {
      return `
        <table>
          <thead>
            <tr>
              <th>SCAC</th>
              <th>Line Name</th>
              <th>Agent Agency</th>
              <th>Contact Person</th>
              <th>Email</th>
              <th>Free Days</th>
              <th>Demurrage Days</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `<tr><td colspan="9"><div class="empty-state">No shipping lines found.</div></td></tr>` :
            data.map(s => `
              <tr>
                <td style="font-weight:600; color:var(--primary)">${s.scac}</td>
                <td style="font-weight:600">${s.name}</td>
                <td>${s.agent || '—'}</td>
                <td>${s.contact || '—'}</td>
                <td style="font-size:12px">${s.email || '—'}</td>
                <td>${s.freeDays || 0} days</td>
                <td>${s.demurrageDays || 0} days</td>
                <td>${statusBadge(s.status || 'Active')}</td>
                <td>
                  <div class="row-actions">
                    <button class="btn sm" data-act="edit" data-id="${s.id}"><i class="ti ti-edit"></i></button>
                    <button class="btn sm danger" data-act="delete" data-id="${s.id}"><i class="ti ti-trash"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (this.type === 'commodities') {
      return `
        <table>
          <thead>
            <tr>
              <th>HS Code</th>
              <th>Description</th>
              <th>Category</th>
              <th>Hazardous</th>
              <th>IMDG Class</th>
              <th>UN Number</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `<tr><td colspan="7"><div class="empty-state">No commodities found.</div></td></tr>` :
            data.map(c => `
              <tr>
                <td style="font-weight:600; color:var(--primary)">${c.hsCode}</td>
                <td style="font-weight:600">${c.description}</td>
                <td>${c.category || '—'}</td>
                <td><span class="badge ${c.hazardous === 'Yes' ? 'b-red' : 'b-green'}">${c.hazardous}</span></td>
                <td>${c.imdgClass || '—'}</td>
                <td>${c.unNumber || '—'}</td>
                <td>
                  <div class="row-actions">
                    <button class="btn sm" data-act="edit" data-id="${c.id}"><i class="ti ti-edit"></i></button>
                    <button class="btn sm danger" data-act="delete" data-id="${c.id}"><i class="ti ti-trash"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (this.type === 'chargeHeads') {
      return `
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Charge Name</th>
              <th>Type</th>
              <th>GST Rate</th>
              <th>SAC Code</th>
              <th>Description</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `<tr><td colspan="7"><div class="empty-state">No charge heads found.</div></td></tr>` :
            data.map(ch => `
              <tr>
                <td style="font-weight:600; color:var(--primary)">${ch.code}</td>
                <td style="font-weight:600">${ch.name}</td>
                <td><span class="badge ${ch.type === 'Revenue' ? 'b-green' : 'b-amber'}">${ch.type}</span></td>
                <td>${ch.gstRate}%</td>
                <td>${ch.sacCode || '—'}</td>
                <td style="font-size:12px; color:var(--text-muted)">${ch.description || '—'}</td>
                <td>
                  <div class="row-actions">
                    <button class="btn sm" data-act="edit" data-id="${ch.id}"><i class="ti ti-edit"></i></button>
                    <button class="btn sm danger" data-act="delete" data-id="${ch.id}"><i class="ti ti-trash"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  }

  openFormModal(editData, container) {
    const modalWrap = document.getElementById("modal-container");
    if (!modalWrap) return;

    let formHTML = "";
    let width = "500px";

    if (this.type === 'customers') {
      formHTML = `
        <div class="form-row">
          <div class="fg"><label>Code *</label><input id="f-code" value="${editData ? editData.code || '' : ''}" placeholder="CUST-00X" required/></div>
          <div class="fg"><label>Company Name *</label><input id="f-company" value="${editData ? editData.company || '' : ''}" placeholder="Tata Motors Ltd" required/></div>
        </div>
        <div class="form-row">
          <div class="fg"><label>Contact Person</label><input id="f-contactPerson" value="${editData ? editData.contactPerson || '' : ''}"/></div>
          <div class="fg"><label>Phone</label><input id="f-phone" value="${editData ? editData.phone || '' : ''}"/></div>
        </div>
        <div class="form-row">
          <div class="fg"><label>Email</label><input id="f-email" type="email" value="${editData ? editData.email || '' : ''}"/></div>
          <div class="fg"><label>Country</label><input id="f-country" value="${editData ? editData.country || 'India' : 'India'}"/></div>
        </div>
        <div class="form-row">
          <div class="fg"><label>GST / Tax ID</label><input id="f-gst" value="${editData ? editData.gst || '' : ''}"/></div>
          <div class="fg"><label>Payment Terms</label><select id="f-paymentTerms"><option ${editData && editData.paymentTerms === 'Advance' ? 'selected' : ''}>Advance</option><option ${editData && editData.paymentTerms === 'Net 15' ? 'selected' : ''}>Net 15</option><option ${editData && editData.paymentTerms === 'Net 30' ? 'selected' : ''}>Net 30</option><option ${editData && editData.paymentTerms === 'Net 45' ? 'selected' : ''}>Net 45</option></select></div>
        </div>
        <div class="form-row">
          <div class="fg"><label>Credit Limit (INR/USD)</label><input id="f-creditLimit" type="number" value="${editData ? editData.creditLimit || 0 : 0}"/></div>
          <div class="fg"><label>Billing Currency</label><select id="f-currency"><option ${editData && editData.currency === 'INR' ? 'selected' : ''}>INR</option><option ${editData && editData.currency === 'USD' ? 'selected' : ''}>USD</option><option ${editData && editData.currency === 'EUR' ? 'selected' : ''}>EUR</option></select></div>
        </div>
        <div class="fg" style="margin-bottom:12px;"><label>Address</label><input id="f-address" value="${editData ? editData.address || '' : ''}"/></div>
        <div class="fg" style="margin-bottom:16px;">
          <label>Status</label>
          <select id="f-status"><option ${editData && editData.status === 'Active' ? 'selected' : ''}>Active</option><option ${editData && editData.status === 'Inactive' ? 'selected' : ''}>Inactive</option><option ${editData && editData.status === 'On Hold' ? 'selected' : ''}>On Hold</option></select>
        </div>
      `;
    } else if (this.type === 'vendors') {
      formHTML = `
        <div class="form-row">
          <div class="fg"><label>Code *</label><input id="f-code" value="${editData ? editData.code || '' : ''}" placeholder="VEND-00X" required/></div>
          <div class="fg"><label>Company Name *</label><input id="f-company" value="${editData ? editData.company || '' : ''}" placeholder="Ocean Star Shipping" required/></div>
        </div>
        <div class="form-row">
          <div class="fg"><label>Vendor Type *</label><select id="f-vendorType"><option ${editData && editData.vendorType === 'Shipping Line' ? 'selected' : ''}>Shipping Line</option><option ${editData && editData.vendorType === 'Transporter' ? 'selected' : ''}>Transporter</option><option ${editData && editData.vendorType === 'CHA' ? 'selected' : ''}>CHA</option><option ${editData && editData.vendorType === 'Other' ? 'selected' : ''}>Other</option></select></div>
          <div class="fg"><label>Contact Person</label><input id="f-contactPerson" value="${editData ? editData.contactPerson || '' : ''}"/></div>
        </div>
        <div class="form-row">
          <div class="fg"><label>Phone</label><input id="f-phone" value="${editData ? editData.phone || '' : ''}"/></div>
          <div class="fg"><label>Email</label><input id="f-email" type="email" value="${editData ? editData.email || '' : ''}"/></div>
        </div>
        <div class="form-row">
          <div class="fg"><label>GST / Tax ID</label><input id="f-gst" value="${editData ? editData.gst || '' : ''}"/></div>
          <div class="fg"><label>Outstanding Balance</label><input id="f-outstanding" type="number" value="${editData ? editData.outstanding || 0 : 0}"/></div>
        </div>
        <div class="fg" style="margin-bottom:12px;"><label>Address</label><input id="f-address" value="${editData ? editData.address || '' : ''}"/></div>
        <div class="fg" style="margin-bottom:16px;">
          <label>Status</label>
          <select id="f-status"><option ${editData && editData.status === 'Active' ? 'selected' : ''}>Active</option><option ${editData && editData.status === 'Inactive' ? 'selected' : ''}>Inactive</option></select>
        </div>
      `;
    } else if (this.type === 'ports') {
      formHTML = `
        <div class="form-row">
          <div class="fg"><label>UN/LOCODE *</label><input id="f-code" value="${editData ? editData.code || '' : ''}" placeholder="e.g. INNSA" required/></div>
          <div class="fg"><label>Port Name *</label><input id="f-name" value="${editData ? editData.name || '' : ''}" placeholder="Nhava Sheva" required/></div>
        </div>
        <div class="form-row">
          <div class="fg"><label>Country *</label><input id="f-country" value="${editData ? editData.country || '' : ''}" placeholder="India" required/></div>
          <div class="fg"><label>Type *</label><select id="f-ptype"><option ${editData && editData.type === 'Sea Port' ? 'selected' : ''}>Sea Port</option><option ${editData && editData.type === 'Airport' ? 'selected' : ''}>Airport</option></select></div>
        </div>
        <div class="fg" style="margin-bottom:16px;"><label>Timezone</label><input id="f-timezone" value="${editData ? editData.timezone || '' : 'UTC+5:30'}" placeholder="e.g. UTC+5:30"/></div>
      `;
    } else if (this.type === 'shippingLines') {
      formHTML = `
        <div class="form-row">
          <div class="fg"><label>SCAC Code *</label><input id="f-scac" value="${editData ? editData.scac || '' : ''}" placeholder="e.g. MSCU" required/></div>
          <div class="fg"><label>Line Name *</label><input id="f-name" value="${editData ? editData.name || '' : ''}" placeholder="MSC Shipping" required/></div>
        </div>
        <div class="form-row">
          <div class="fg"><label>Local Agent Agency</label><input id="f-agent" value="${editData ? editData.agent || '' : ''}"/></div>
          <div class="fg"><label>Contact Person</label><input id="f-contact" value="${editData ? editData.contact || '' : ''}"/></div>
        </div>
        <div class="fg" style="margin-bottom:12px;"><label>Email</label><input id="f-email" type="email" value="${editData ? editData.email || '' : ''}"/></div>
        <div class="form-row">
          <div class="fg"><label>Standard Import Free Days</label><input id="f-freeDays" type="number" value="${editData ? editData.freeDays || 14 : 14}"/></div>
          <div class="fg"><label>Standard Demurrage Free Days</label><input id="f-demurrageDays" type="number" value="${editData ? editData.demurrageDays || 7 : 7}"/></div>
        </div>
        <div class="fg" style="margin-bottom:16px;">
          <label>Status</label>
          <select id="f-status"><option ${editData && editData.status === 'Active' ? 'selected' : ''}>Active</option><option ${editData && editData.status === 'Inactive' ? 'selected' : ''}>Inactive</option></select>
        </div>
      `;
    } else if (this.type === 'commodities') {
      formHTML = `
        <div class="form-row">
          <div class="fg"><label>HS Code *</label><input id="f-hsCode" value="${editData ? editData.hsCode || '' : ''}" placeholder="e.g. 87082990" required/></div>
          <div class="fg"><label>Description *</label><input id="f-description" value="${editData ? editData.description || '' : ''}" placeholder="Motor Vehicle Parts" required/></div>
        </div>
        <div class="form-row">
          <div class="fg"><label>Category</label><input id="f-category" value="${editData ? editData.category || '' : ''}"/></div>
          <div class="fg"><label>Hazardous *</label><select id="f-hazardous"><option ${editData && editData.hazardous === 'No' ? 'selected' : ''}>No</option><option ${editData && editData.hazardous === 'Yes' ? 'selected' : ''}>Yes</option></select></div>
        </div>
        <div class="form-row">
          <div class="fg"><label>IMDG Class (if Haz)</label><input id="f-imdgClass" value="${editData ? editData.imdgClass || '' : ''}"/></div>
          <div class="fg"><label>UN Number (if Haz)</label><input id="f-unNumber" value="${editData ? editData.unNumber || '' : ''}"/></div>
        </div>
      `;
    } else if (this.type === 'chargeHeads') {
      formHTML = `
        <div class="form-row">
          <div class="fg"><label>Code *</label><input id="f-code" value="${editData ? editData.code || '' : ''}" placeholder="e.g. OCF" required/></div>
          <div class="fg"><label>Charge Name *</label><input id="f-name" value="${editData ? editData.name || '' : ''}" placeholder="Ocean Freight" required/></div>
        </div>
        <div class="form-row">
          <div class="fg"><label>Type *</label><select id="f-ctype"><option ${editData && editData.type === 'Revenue' ? 'selected' : ''}>Revenue</option><option ${editData && editData.type === 'Expense' ? 'selected' : ''}>Expense</option></select></div>
          <div class="fg"><label>GST Rate % *</label><select id="f-gstRate"><option value="0" ${editData && editData.gstRate === 0 ? 'selected' : ''}>0%</option><option value="5" ${editData && editData.gstRate === 5 ? 'selected' : ''}>5%</option><option value="12" ${editData && editData.gstRate === 12 ? 'selected' : ''}>12%</option><option value="18" ${editData && editData.gstRate === 18 ? 'selected' : ''}>18%</option></select></div>
        </div>
        <div class="fg" style="margin-bottom:12px;"><label>SAC Code</label><input id="f-sacCode" value="${editData ? editData.sacCode || '' : ''}" placeholder="e.g. 996521"/></div>
        <div class="fg" style="margin-bottom:16px;"><label>Description</label><input id="f-description" value="${editData ? editData.description || '' : ''}"/></div>
      `;
    }

    modalWrap.innerHTML = `
      <div class="modal-bg" id="master-form-modal">
        <div class="modal" style="width: ${width};">
          <div class="modal-title">${editData ? 'Edit ' : 'New '}${this.getLabel()}<button class="btn sm" id="modal-close"><i class="ti ti-x"></i></button></div>
          <form id="master-form" onsubmit="event.preventDefault()">
            ${formHTML}
            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button class="btn" type="button" id="form-cancel">Cancel</button>
              <button class="btn pr" type="submit"><i class="ti ti-check"></i> Save Record</button>
            </div>
          </form>
        </div>
      </div>
    `;

    setTimeout(() => {
      document.getElementById("modal-close").onclick = () => { modalWrap.innerHTML = ''; };
      document.getElementById("form-cancel").onclick = () => { modalWrap.innerHTML = ''; };

      document.getElementById("master-form").onsubmit = async (e) => {
        e.preventDefault();
        const fv = (id) => document.getElementById(id)?.value || '';

        let d = {};
        if (this.type === 'customers') {
          d = {
            code: fv('f-code'),
            company: fv('f-company'),
            contactPerson: fv('f-contactPerson'),
            phone: fv('f-phone'),
            email: fv('f-email'),
            country: fv('f-country'),
            gst: fv('f-gst'),
            paymentTerms: fv('f-paymentTerms'),
            creditLimit: +fv('f-creditLimit') || 0,
            currency: fv('f-currency'),
            address: fv('f-address'),
            status: fv('f-status')
          };
          if (!d.code || !d.company) return;
        } else if (this.type === 'vendors') {
          d = {
            code: fv('f-code'),
            company: fv('f-company'),
            vendorType: fv('f-vendorType'),
            contactPerson: fv('f-contactPerson'),
            phone: fv('f-phone'),
            email: fv('f-email'),
            gst: fv('f-gst'),
            outstanding: +fv('f-outstanding') || 0,
            address: fv('f-address'),
            status: fv('f-status')
          };
          if (!d.code || !d.company) return;
        } else if (this.type === 'ports') {
          d = {
            code: fv('f-code').toUpperCase(),
            name: fv('f-name'),
            country: fv('f-country'),
            type: fv('f-ptype'),
            timezone: fv('f-timezone'),
            unlocode: fv('f-code').toUpperCase()
          };
          if (!d.code || !d.name || !d.country) return;
        } else if (this.type === 'shippingLines') {
          d = {
            scac: fv('f-scac').toUpperCase(),
            name: fv('f-name'),
            agent: fv('f-agent'),
            contact: fv('f-contact'),
            email: fv('f-email'),
            freeDays: +fv('f-freeDays') || 0,
            demurrageDays: +fv('f-demurrageDays') || 0,
            status: fv('f-status')
          };
          if (!d.scac || !d.name) return;
        } else if (this.type === 'commodities') {
          d = {
            hsCode: fv('f-hsCode'),
            description: fv('f-description'),
            category: fv('f-category'),
            hazardous: fv('f-hazardous'),
            imdgClass: fv('f-imdgClass'),
            unNumber: fv('f-unNumber')
          };
          if (!d.hsCode || !d.description) return;
        } else if (this.type === 'chargeHeads') {
          d = {
            code: fv('f-code').toUpperCase(),
            name: fv('f-name'),
            type: fv('f-ctype'),
            gstRate: +fv('f-gstRate') || 0,
            sacCode: fv('f-sacCode'),
            description: fv('f-description')
          };
          if (!d.code || !d.name) return;
        }

        if (editData) {
          await saveDocument(this.type, { ...editData, ...d }, editData.id);
          showToast(`${this.getLabel()} updated successfully.`, "success");
        } else {
          await saveDocument(this.type, d);
          showToast(`${this.getLabel()} created successfully.`, "success");
        }

        modalWrap.innerHTML = '';
        this.onRefreshNav();
        this.refreshPanel(container);
      };
    }, 50);
  }
}

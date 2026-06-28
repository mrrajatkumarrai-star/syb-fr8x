import { getCollection, saveDocument, deleteDocument } from "../services/db.js";
import { fmtDate, statusBadge, showToast, showConfirm, makeSearchableSelect } from "../services/ui.js";

const DOC_TYPES = [
  'Booking Confirmation', 'CRO', 'Shipping Instruction', 'BL Draft', 
  'Final BL', 'Commercial Invoice', 'Packing List', 'Certificate of Origin', 
  'Arrival Notice', 'Delivery Order', 'Customs Documents', 'Other'
];

export class Documents {
  constructor(onRefreshNav) {
    this.onRefreshNav = onRefreshNav;
    this.searchQuery = "";
  }

  async render() {
    const list = await getCollection("documents");
    let data = list;

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter(d => (d.jobNo + d.docType + (d.fileName || '') + (d.uploadedBy || '')).toLowerCase().includes(q));
    }

    const container = document.createElement("div");
    container.innerHTML = `
      <div class="filter-bar">
        <input class="search-input" id="doc-search" placeholder="Search by job #, doc type, file name..." value="${this.searchQuery}"/>
        <button class="btn pr sm" id="doc-add-btn"><i class="ti ti-upload" aria-hidden="true"></i> Upload Document</button>
      </div>

      <div class="tbl-wrap">
        <table id="tbl-documents">
          <thead>
            <tr>
              <th>Job #</th>
              <th>Document Type</th>
              <th>Version</th>
              <th>File Name</th>
              <th>Uploaded By</th>
              <th>Date</th>
              <th>Customer Visible</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `<tr><td colspan="9"><div class="empty-state"><i class="ti ti-files" aria-hidden="true"></i>No documents uploaded yet.</div></td></tr>` :
            data.map(d => `
              <tr>
                <td style="color:var(--primary); font-weight:600">${d.jobNo || '—'}</td>
                <td><strong>${d.docType || '—'}</strong></td>
                <td><span style="font-size:11px; font-weight:500;">v${d.version || 1}</span></td>
                <td style="font-size:11px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${d.fileName || '—'}">${d.fileName || '—'}</td>
                <td>${d.uploadedBy || '—'}</td>
                <td style="font-size:11px">${fmtDate(d.uploadedAt)}</td>
                <td>${d.customerVisible ? `<span class="badge b-green">Yes</span>` : `<span class="badge b-gray">No</span>`}</td>
                <td>${statusBadge(d.status || 'Uploaded')}</td>
                <td>
                  <div class="row-actions">
                    <button class="btn sm danger" data-act="delete" data-did="${d.id}"><i class="ti ti-trash"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    setTimeout(() => {
      const search = container.querySelector("#doc-search");
      if (search) {
        search.oninput = (e) => {
          this.searchQuery = e.target.value;
          this.refreshPanel(container);
        };
      }

      container.querySelector("#doc-add-btn").onclick = () => this.openFormModal(container);

      // Actions buttons
      container.querySelectorAll("[data-act]").forEach(btn => {
        btn.onclick = (e) => {
          const act = btn.dataset.act;
          const did = btn.dataset.did;
          const docObj = list.find(d => d.id === did);

          if (act === 'delete') {
            showConfirm(`Delete document "${docObj.docType}" (${docObj.fileName})?`, async () => {
              await deleteDocument("documents", did);
              showToast("Document deleted successfully.", "success");
              this.onRefreshNav();
              this.refreshPanel(container);
            });
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

  async openFormModal(container) {
    const shipments = await getCollection("shipments");

    const modalWrap = document.getElementById("modal-container");
    if (!modalWrap) return;

    modalWrap.innerHTML = `
      <div class="modal-bg" id="document-form-modal">
        <div class="modal" style="width: 520px;">
          <div class="modal-title">Upload Document<button class="btn sm" id="modal-close"><i class="ti ti-x"></i></button></div>
          <form id="doc-form" onsubmit="event.preventDefault()">
            <div class="form-row">
              <div class="fg"><label>Shipment *</label><select id="f-jobNo" required><option value="">Select Shipment Job</option>${shipments.map(s => `<option value="${s.jobNo}">${s.jobNo} — ${s.customer}</option>`).join('')}</select></div>
              <div class="fg"><label>Document Type *</label><select id="f-docType" required>${DOC_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}</select></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>File Name *</label><input id="f-fileName" placeholder="e.g. invoice_final.pdf" required/></div>
              <div class="fg"><label>Uploaded By</label><input id="f-uploadedBy" value="Super Admin" required/></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Status</label><select id="f-status"><option value="Uploaded">Uploaded</option><option value="Draft">Draft</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option></select></div>
              <div class="fg"><label>Customer Visible</label><select id="f-customerVisible"><option value="true">Yes</option><option value="false">No</option></select></div>
            </div>
            <div class="fg" style="margin-bottom:16px;"><label>Remarks / Notes</label><input id="f-remarks" placeholder="Optional notes..."/></div>
            
            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button class="btn" type="button" id="form-cancel">Cancel</button>
              <button class="btn pr" type="submit"><i class="ti ti-upload"></i> Upload</button>
            </div>
          </form>
        </div>
      </div>
    `;

    setTimeout(() => {
      makeSearchableSelect(modalWrap.querySelector("#f-jobNo"));
      makeSearchableSelect(modalWrap.querySelector("#f-docType"));

      document.getElementById("modal-close").onclick = () => { modalWrap.innerHTML = ''; };
      document.getElementById("form-cancel").onclick = () => { modalWrap.innerHTML = ''; };

      document.getElementById("doc-form").onsubmit = async (e) => {
        e.preventDefault();
        const fv = (id) => document.getElementById(id)?.value || '';

        const d = {
          jobNo: fv('f-jobNo'),
          docType: fv('f-docType'),
          fileName: fv('f-fileName'),
          uploadedBy: fv('f-uploadedBy'),
          status: fv('f-status'),
          customerVisible: fv('f-customerVisible') === 'true',
          remarks: fv('f-remarks'),
          uploadedAt: new Date().toISOString().split('T')[0],
          version: 1
        };

        if (!d.jobNo) { showToast("Shipment link is required.", "warning"); return; }
        if (!d.fileName) { showToast("File Name is required.", "warning"); return; }

        // Determine Version number automatically
        const allDocs = await getCollection("documents");
        const existingCount = allDocs.filter(doc => doc.jobNo === d.jobNo && doc.docType === d.docType).length;
        d.version = existingCount + 1;

        await saveDocument("documents", d);

        // Audit Log entry
        await saveDocument("auditLog", {
          ts: new Date().toLocaleString(),
          user: d.uploadedBy,
          action: "UPLOAD",
          module: "Documents",
          record: `Uploaded ${d.docType} (v${d.version}) for job ${d.jobNo}`,
          ip: "10.0.0." + Math.floor(Math.random() * 200 + 1)
        });

        showToast(`Document uploaded: ${d.docType} v${d.version}`, "success");
        modalWrap.innerHTML = '';
        this.onRefreshNav();
        this.refreshPanel(container);
      };
    }, 50);
  }
}

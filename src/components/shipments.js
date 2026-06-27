import { getCollection, saveDocument, deleteDocument } from "../services/db.js";
import { fmtDate, statusBadge, showToast, showConfirm, openShipmentDetail, makeSearchableSelect } from "../services/ui.js";

const SHIP_STATUSES = ['Booking Created', 'Booking Confirmed', 'Recd on email', 'CRO Received', 'Empty Released', 'Container Picked', 'Stuffing Done', 'Gate In', 'Vessel Sailed', 'In Transit', 'Transshipment', 'Arrival POD', 'Customs Clearance', 'DO Released', 'Delivered', 'Container Returned', 'Closed'];
const SHIP_TYPES = ['FCL Export', 'FCL Import', 'LCL Export', 'LCL Import', 'Air Export', 'Air Import'];
const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DDP'];

export class Shipments {
  constructor(onRefreshNav) {
    this.onRefreshNav = onRefreshNav;
    this.typeFilter = "All";
    this.statusFilter = "All";
    this.searchQuery = "";
  }

  async render() {
    const list = await getCollection("shipments");
    let data = list;

    if (this.typeFilter !== 'All') data = data.filter(s => s.type === this.typeFilter);
    if (this.statusFilter !== 'All') data = data.filter(s => s.status === this.statusFilter);
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter(s => (s.jobNo + s.customer + (s.blNo || '') + (s.pol || '') + (s.pod || '') + (s.vessel || '')).toLowerCase().includes(q));
    }

    const container = document.createElement("div");
    container.innerHTML = `
      <div class="filter-bar">
        <input class="search-input" id="ship-search" placeholder="Search by Job #, BL, customer, route..." value="${this.searchQuery}"/>
        <select class="search-input" id="ship-type-filter" style="width:130px">
          <option value="All">All Types</option>
          ${SHIP_TYPES.map(t => `<option value="${t}" ${this.typeFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <select class="search-input" id="ship-status-filter" style="width:150px">
          <option value="All">All Statuses</option>
          ${SHIP_STATUSES.map(s => `<option value="${s}" ${this.statusFilter === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <button class="btn pr sm" id="ship-add-btn"><i class="ti ti-plus" aria-hidden="true"></i> New Shipment</button>
      </div>
      <div class="tbl-wrap">
        <table id="tbl-shipments">
          <thead>
            <tr>
              <th>Job #</th>
              <th>Type</th>
              <th>Customer</th>
              <th>BL / AWB</th>
              <th>Route</th>
              <th>Vessel</th>
              <th>ETD</th>
              <th>ETA</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `<tr><td colspan="10"><div class="empty-state"><i class="ti ti-box" aria-hidden="true"></i>No shipments match current filters.</div></td></tr>` :
            data.map(s => `
              <tr data-sid="${s.id}">
                <td style="color:var(--primary);font-weight:600;cursor:pointer;">${s.jobNo}</td>
                <td><span class="badge b-gray" style="font-size:10px">${s.type}</span></td>
                <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.customer}</td>
                <td>${s.blNo || '—'}</td>
                <td style="font-size:11px">${s.pol || '—'} → ${s.pod || '—'}</td>
                <td style="font-size:11px">${s.vessel || '—'}</td>
                <td style="font-size:11px">${fmtDate(s.etd)}</td>
                <td style="font-size:11px">${fmtDate(s.eta)}</td>
                <td>${statusBadge(s.status)}</td>
                <td>
                  <div class="row-actions" onclick="event.stopPropagation()">
                    <button class="btn sm" title="Update status" data-act="status" data-sid="${s.id}"><i class="ti ti-refresh"></i></button>
                    <button class="btn sm" title="Edit" data-act="edit" data-sid="${s.id}"><i class="ti ti-edit"></i></button>
                    <button class="btn sm danger" title="Delete" data-act="delete" data-sid="${s.id}"><i class="ti ti-trash"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Hook listeners
    setTimeout(() => {
      const search = container.querySelector("#ship-search");
      if (search) {
        search.oninput = (e) => {
          this.searchQuery = e.target.value;
          this.refreshPanel(container);
        };
      }

      const typeSel = container.querySelector("#ship-type-filter");
      if (typeSel) {
        typeSel.onchange = (e) => {
          this.typeFilter = e.target.value;
          this.refreshPanel(container);
        };
      }

      const statusSel = container.querySelector("#ship-status-filter");
      if (statusSel) {
        statusSel.onchange = (e) => {
          this.statusFilter = e.target.value;
          this.refreshPanel(container);
        };
      }

      container.querySelector("#ship-add-btn").onclick = () => this.openFormModal(null, container);

      // Row detail action
      container.querySelectorAll("tbody tr[data-sid]").forEach(row => {
        row.onclick = () => openShipmentDetail(row.dataset.sid);
      });

      // Actions buttons
      container.querySelectorAll("[data-act]").forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const act = btn.dataset.act;
          const sid = btn.dataset.sid;
          const shipmentObj = list.find(s => s.id === sid);

          if (act === 'delete') {
            showConfirm(`Delete shipment job ${shipmentObj.jobNo}? This cannot be undone.`, async () => {
              await deleteDocument("shipments", sid);
              showToast(`Shipment ${shipmentObj.jobNo} deleted successfully.`, "success");
              this.onRefreshNav();
              this.refreshPanel(container);
            });
          } else if (act === 'status') {
            this.openStatusModal(shipmentObj, container);
          } else if (act === 'edit') {
            this.openFormModal(shipmentObj, container);
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
    const customers = await getCollection("customers");
    const ports = await getCollection("ports");
    const commodities = await getCollection("commodities");

    const modalWrap = document.getElementById("modal-container");
    if (!modalWrap) return;

    modalWrap.innerHTML = `
      <div class="modal-bg" id="shipment-form-modal">
        <div class="modal" style="width: 620px; max-height: 90vh; overflow-y: auto;">
          <div class="modal-title">${editData ? `Edit Shipment ${editData.jobNo}` : 'New Shipment'}<button class="btn sm" id="modal-close"><i class="ti ti-x"></i></button></div>
          <form id="ship-form" onsubmit="event.preventDefault()">
            <div class="form-row">
              <div class="fg"><label>Shipment Type *</label><select id="f-type">${SHIP_TYPES.map(t => `<option ${editData && editData.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
              <div class="fg"><label>Customer *</label><select id="f-customer"><option value="">Select Customer</option>${customers.map(c => `<option value="${c.company}" ${editData && editData.customer === c.company ? 'selected' : ''}>${c.code} — ${c.company}</option>`).join('')}</select></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Shipper</label><input id="f-shipper" value="${editData ? editData.shipper || '' : ''}"/></div>
              <div class="fg"><label>Consignee</label><input id="f-consignee" value="${editData ? editData.consignee || '' : ''}"/></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Notify Party</label><input id="f-notifyParty" value="${editData ? editData.notifyParty || '' : ''}"/></div>
              <div class="fg"><label>Cargo Ready Date</label><input id="f-readyDate" type="date" value="${editData ? editData.readyDate || '' : ''}"/></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Booking Number</label><input id="f-bookingNo" value="${editData ? editData.bookingNo || '' : ''}"/></div>
              <div class="fg"><label>BL / AWB Number</label><input id="f-blNo" value="${editData ? editData.blNo || '' : ''}"/></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>POL *</label><select id="f-pol"><option value="">Select Port</option>${ports.map(p => `<option value="${p.code}" ${editData && editData.pol === p.code ? 'selected' : ''}>${p.code} — ${p.name}</option>`).join('')}</select></div>
              <div class="fg"><label>POD *</label><select id="f-pod"><option value="">Select Port</option>${ports.map(p => `<option value="${p.code}" ${editData && editData.pod === p.code ? 'selected' : ''}>${p.code} — ${p.name}</option>`).join('')}</select></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Final Destination</label><input id="f-finalDest" value="${editData ? editData.finalDest || '' : ''}"/></div>
              <div class="fg"><label>Incoterm</label><select id="f-incoterm">${INCOTERMS.map(t => `<option ${editData && editData.incoterm === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Vessel Name</label><input id="f-vessel" value="${editData ? editData.vessel || '' : ''}"/></div>
              <div class="fg"><label>Voyage</label><input id="f-voyage" value="${editData ? editData.voyage || '' : ''}"/></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>ETD</label><input id="f-etd" type="date" value="${editData ? editData.etd || '' : ''}"/></div>
              <div class="fg"><label>ETA</label><input id="f-eta" type="date" value="${editData ? editData.eta || '' : ''}"/></div>
            </div>
            <div class="form-row3">
              <div class="fg"><label>Commodity</label><select id="f-commodity"><option value="">Select</option>${commodities.map(c => `<option value="${c.description}" ${editData && editData.commodity === c.description ? 'selected' : ''}>${c.description}</option>`).join('')}</select></div>
              <div class="fg"><label>Gross Weight (kg)</label><input id="f-grossWeight" type="number" value="${editData ? editData.grossWeight || '' : ''}"/></div>
              <div class="fg"><label>Volume (CBM)</label><input id="f-volume" type="number" value="${editData ? editData.volume || '' : ''}"/></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Packages</label><input id="f-packages" type="text" value="${editData ? editData.packages || '' : ''}"/></div>
              <div class="fg"><label>Container Details</label><input id="f-containerDetails" placeholder="e.g. 1x40HC" value="${editData ? editData.containerDetails || '' : ''}"/></div>
            </div>
            <div class="form-row">
              <div class="fg">
                <label>Is Hazardous?</label>
                <select id="f-isHazardous">
                  <option value="No" ${editData && !editData.isHazardous ? 'selected' : ''}>No</option>
                  <option value="Yes" ${editData && editData.isHazardous ? 'selected' : ''}>Yes</option>
                </select>
              </div>
            </div>
            <div class="form-row" id="f-haz-inputs" style="display:${editData && editData.isHazardous ? 'flex' : 'none'};">
              <div class="fg"><label>IMDG Class</label><input id="f-imdgClass" value="${editData ? editData.imdgClass || '' : ''}"/></div>
              <div class="fg"><label>UN Number</label><input id="f-unNumber" value="${editData ? editData.unNumber || '' : ''}"/></div>
            </div>
            <div class="fg" style="margin-bottom:14px;"><label>Remarks</label><input id="f-remarks" value="${editData ? editData.remarks || '' : ''}"/></div>
            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button class="btn" type="button" id="form-cancel">Cancel</button>
              <button class="btn pr" type="submit" id="form-submit"><i class="ti ti-check"></i> Save Shipment</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Initialize Search autocomplete
    setTimeout(() => {
      makeSearchableSelect(modalWrap.querySelector("#f-customer"));
      makeSearchableSelect(modalWrap.querySelector("#f-pol"));
      makeSearchableSelect(modalWrap.querySelector("#f-pod"));
      makeSearchableSelect(modalWrap.querySelector("#f-commodity"));

      document.getElementById("modal-close").onclick = () => { modalWrap.innerHTML = ''; };
      document.getElementById("form-cancel").onclick = () => { modalWrap.innerHTML = ''; };

      const hazSelect = modalWrap.querySelector("#f-isHazardous");
      if (hazSelect) {
        hazSelect.onchange = () => {
          modalWrap.querySelector("#f-haz-inputs").style.display = hazSelect.value === 'Yes' ? 'flex' : 'none';
        };
      }

      document.getElementById("ship-form").onsubmit = async (e) => {
        e.preventDefault();
        const fv = (id) => document.getElementById(id)?.value || '';

        const d = {
          type: fv('f-type'),
          customer: fv('f-customer'),
          shipper: fv('f-shipper'),
          consignee: fv('f-consignee'),
          notifyParty: fv('f-notifyParty'),
          readyDate: fv('f-readyDate'),
          bookingNo: fv('f-bookingNo'),
          blNo: fv('f-blNo'),
          pol: fv('f-pol'),
          pod: fv('f-pod'),
          finalDest: fv('f-finalDest'),
          incoterm: fv('f-incoterm'),
          vessel: fv('f-vessel'),
          voyage: fv('f-voyage'),
          etd: fv('f-etd'),
          eta: fv('f-eta'),
          commodity: fv('f-commodity'),
          grossWeight: +fv('f-grossWeight') || 0,
          volume: +fv('f-volume') || 0,
          packages: isNaN(fv('f-packages')) ? fv('f-packages') : (+fv('f-packages') || 0),
          containerDetails: fv('f-containerDetails'),
          isHazardous: fv('f-isHazardous') === 'Yes',
          imdgClass: fv('f-imdgClass'),
          unNumber: fv('f-unNumber'),
          remarks: fv('f-remarks')
        };

        if (!d.customer) { showToast("Customer company is required.", "warning"); return; }
        if (!d.pol || !d.pod) { showToast("POL and POD ports are required.", "warning"); return; }

        if (editData) {
          const updated = { ...editData, ...d };
          await saveDocument("shipments", updated, editData.id);
          showToast(`Shipment ${editData.jobNo} updated successfully.`, "success");
        } else {
          // Generate Job Number
          const prefix = "JB";
          const yr = new Date().getFullYear().toString().substr(2);
          const mn = String(new Date().getMonth() + 1).padStart(2, '0');
          const list = await getCollection("shipments");
          const nextSeq = String(list.length + 1).padStart(4, '0');

          d.jobNo = `${prefix}-${yr}${mn}-${nextSeq}`;
          d.status = "Booking Created";
          d.createdAt = new Date().toLocaleString();
          d.timeline = [{ event: "Booking Created", date: new Date().toISOString().split('T')[0], user: "Super Admin", remarks: "Booking registered" }];

          const savedShipment = await saveDocument("shipments", d);
          await this.autoGenerateTasks(savedShipment);
          showToast(`Shipment ${d.jobNo} created successfully.`, "success");
        }

        modalWrap.innerHTML = '';
        this.onRefreshNav();
        this.refreshPanel(container);
      };
    }, 50);
  }

  openStatusModal(shipment, container) {
    const modalWrap = document.getElementById("modal-container");
    if (!modalWrap) return;

    const curIdx = SHIP_STATUSES.indexOf(shipment.status);
    if (shipment.status === 'Closed' || curIdx === -1 || curIdx >= SHIP_STATUSES.length - 1) {
      showToast(`Shipment is in the final status (Closed).`, "warning");
      return;
    }

    const availableStatuses = SHIP_STATUSES.slice(curIdx + 1);

    modalWrap.innerHTML = `
      <div class="modal-bg" id="status-update-modal">
        <div class="modal" style="width: 400px;">
          <div class="modal-title">Update Status — ${shipment.jobNo}<button class="btn sm" id="modal-close"><i class="ti ti-x"></i></button></div>
          <form id="status-form" onsubmit="event.preventDefault()">
            <div class="fg" style="margin-bottom:12px;">
              <label>New Status</label>
              <select id="f-new-status">${availableStatuses.map(s => `<option value="${s}">${s}</option>`).join('')}</select>
            </div>
            <div class="fg" style="margin-bottom:12px;">
              <label>Date</label>
              <input id="f-status-date" type="date" value="${new Date().toISOString().split('T')[0]}"/>
            </div>
            <div class="fg" style="margin-bottom:16px;">
              <label>Remarks</label>
              <textarea id="f-status-remarks" style="height:60px;"></textarea>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button class="btn" type="button" id="status-cancel">Cancel</button>
              <button class="btn pr" type="submit"><i class="ti ti-check"></i> Update</button>
            </div>
          </form>
        </div>
      </div>
    `;

    setTimeout(() => {
      document.getElementById("modal-close").onclick = () => { modalWrap.innerHTML = ''; };
      document.getElementById("status-cancel").onclick = () => { modalWrap.innerHTML = ''; };

      document.getElementById("status-form").onsubmit = async (e) => {
        e.preventDefault();
        const nextStatus = document.getElementById("f-new-status").value;
        const date = document.getElementById("f-status-date").value;
        const remarks = document.getElementById("f-status-remarks").value;

        const updatedTimeline = [...(shipment.timeline || [])];
        updatedTimeline.push({
          event: nextStatus,
          date,
          remarks,
          user: "Super Admin"
        });

        const updatedShipment = { ...shipment, status: nextStatus, timeline: updatedTimeline };
        await saveDocument("shipments", updatedShipment, shipment.id);

        // Add Notification
        const notifMsg = `Shipment ${shipment.jobNo} status updated to ${nextStatus}`;
        await saveDocument("notifications", {
          msg: notifMsg,
          read: false,
          ts: new Date().toLocaleString(),
          type: "info"
        });

        // Add Audit Log
        await saveDocument("auditLog", {
          ts: new Date().toLocaleString(),
          user: "Super Admin",
          action: "STATUS UPDATE",
          module: "Shipment",
          record: `${shipment.jobNo}: ${shipment.status} → ${nextStatus}`,
          ip: "10.0.0." + Math.floor(Math.random() * 200 + 1)
        });

        showToast(`Status updated to ${nextStatus}.`, "success");
        modalWrap.innerHTML = '';
        this.onRefreshNav();
        this.refreshPanel(container);
      };
    }, 50);
  }

  async autoGenerateTasks(s) {
    const templates = {
      'FCL Export': [
        { name: 'Request Booking Confirmation', priority: 'High', daysOffset: -10, field: 'etd' },
        { name: 'Submit Shipping Instructions (SI)', priority: 'Medium', daysOffset: -5, field: 'etd' },
        { name: 'Confirm Container Gate-In', priority: 'High', daysOffset: -3, field: 'etd' },
        { name: 'Verify Customs Clearance (CHA)', priority: 'Urgent', daysOffset: -2, field: 'etd' },
        { name: 'Track Vessel Sailing', priority: 'Medium', daysOffset: 0, field: 'etd' },
        { name: 'Obtain Draft OBL Approval', priority: 'Medium', daysOffset: 2, field: 'etd' },
        { name: 'Submit Empty Return Confirmation', priority: 'High', daysOffset: 7, field: 'eta' }
      ],
      'FCL Import': [
        { name: 'Collect Arrival Notice', priority: 'High', daysOffset: -5, field: 'eta' },
        { name: 'Submit Import Customs Entry', priority: 'Urgent', daysOffset: -3, field: 'eta' },
        { name: 'Arrange Duty Payment', priority: 'High', daysOffset: -2, field: 'eta' },
        { name: 'Request Delivery Order (DO)', priority: 'High', daysOffset: -1, field: 'eta' },
        { name: 'Confirm Delivery to Consignee', priority: 'Medium', daysOffset: 1, field: 'eta' },
        { name: 'Confirm Container Empty Return', priority: 'Urgent', daysOffset: 3, field: 'eta' }
      ],
      'Air Export': [
        { name: 'Aviation Security Check (Haz)', priority: 'High', daysOffset: -2, field: 'etd' },
        { name: 'Customs Examination & Gate-in', priority: 'Urgent', daysOffset: -1, field: 'etd' },
        { name: 'Confirm AWB Release', priority: 'Medium', daysOffset: 0, field: 'etd' },
        { name: 'Confirm Flight Departure', priority: 'Medium', daysOffset: 0, field: 'etd' }
      ],
      'Air Import': [
        { name: 'Verify Cargo Arrival at Terminal', priority: 'High', daysOffset: -1, field: 'eta' },
        { name: 'Customs Entry Clearance', priority: 'Urgent', daysOffset: 0, field: 'eta' },
        { name: 'Arrange Airport Cargo Gateout', priority: 'High', daysOffset: 1, field: 'eta' }
      ]
    };

    const defaultMilestones = [
      { name: 'Request Booking Space', priority: 'Medium', daysOffset: -7, field: 'etd' },
      { name: 'Verify Cargo Readiness', priority: 'Medium', daysOffset: -4, field: 'etd' },
      { name: 'Customs Export Clearance', priority: 'High', daysOffset: -2, field: 'etd' },
      { name: 'Release Bill of Lading', priority: 'Medium', daysOffset: 2, field: 'etd' }
    ];

    const key = Object.keys(templates).find(k => s.type.includes(k)) || '';
    const milestones = templates[key] || defaultMilestones;

    for (const m of milestones) {
      let baseDate = s[m.field];
      if (!baseDate) baseDate = s.etd || new Date().toISOString().split('T')[0];

      const base = new Date(baseDate);
      base.setDate(base.getDate() + m.daysOffset);
      const dueDate = base.toISOString().split('T')[0];

      let assigned = 'Ravi Kumar';
      if (m.name.includes('Duty') || m.name.includes('Payment') || m.name.includes('Invoice')) {
        assigned = 'Arjun Finance';
      } else if (m.name.includes('BL') || m.name.includes('OBL') || m.name.includes('AWB') || m.name.includes('Instructions')) {
        assigned = 'Priya Sharma';
      }

      await saveDocument("tasks", {
        name: `${m.name} [${s.jobNo}]`,
        jobNo: s.jobNo,
        description: `Auto-generated operational milestone task for ${s.type} shipment ${s.jobNo}.`,
        assignedTo: assigned,
        dueDate: dueDate,
        priority: m.priority,
        status: 'Open',
        createdAt: new Date().toLocaleString()
      });
    }
  }
}

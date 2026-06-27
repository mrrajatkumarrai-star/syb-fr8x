import { getCollection, saveDocument } from "../services/db.js";
import { fmtDate, statusBadge, showToast, showConfirm, sendPortalEmail, escapeHTML } from "../services/ui.js";

export class Compass {
  constructor() {
    this.activeTab = "kyc"; // kyc, rates, bookings, si, corrections
    this.selectedRequestId = null;
    this.searchQuery = "";
  }

  async render() {
    const currentUserId = sessionStorage.getItem("erp_user_id") || "u1";
    const currentUserRole = sessionStorage.getItem("erp_user_role") || "Super Admin";

    const allCustomers = await getCollection("customerUsers");
    const allRequests = await getCollection("customerRequests");
    const erpUsers = await getCollection("users");

    // Filter customer accounts based on Handler Assignment (if not Super Admin)
    let customers = allCustomers;
    if (currentUserRole !== "Super Admin") {
      customers = allCustomers.filter(c => c.handlerId === currentUserId);
    }

    // Filter requests
    let requests = allRequests;
    if (currentUserRole !== "Super Admin") {
      requests = allRequests.filter(r => {
        const cust = allCustomers.find(c => c.id === r.customerId);
        return cust && cust.handlerId === currentUserId;
      });
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      customers = customers.filter(c => (c.companyName + c.email).toLowerCase().includes(q));
      requests = requests.filter(r => (r.customerName + r.requestType).toLowerCase().includes(q));
    }

    const container = document.createElement("div");
    container.style.animation = "fadeIn 0.2s ease-out";

    const kycCount = allCustomers.filter(c => c.kycStatus === 'Pending').length;
    const pendingRequests = allRequests.filter(r => r.status === 'Pending').length;

    container.innerHTML = `
      <div class="grid4" style="margin-bottom: 16px;">
        <div class="stat-card">
          <div class="stat-lbl">Pending KYC Reviews</div>
          <div class="stat-val" style="color:${kycCount > 0 ? 'var(--warning)' : 'var(--text-main)'}">${kycCount}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Active Portal Inquiries</div>
          <div class="stat-val" style="color:${pendingRequests > 0 ? 'var(--info)' : 'var(--text-main)'}">${pendingRequests}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Active Customer Accounts</div>
          <div class="stat-val">${allCustomers.filter(c => c.kycStatus === 'Approved').length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Account Scope</div>
          <div class="stat-val" style="font-size: 14px; font-weight:600; color:var(--primary);">${currentUserRole === "Super Admin" ? "All Customers (Super User)" : "Assigned Handler Scope"}</div>
        </div>
      </div>

      <!-- Tab header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:8px; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; gap:4px;" id="compass-tabs">
          <button class="btn ${this.activeTab === 'kyc' ? 'pr' : ''}" data-tab="kyc"><i class="ti ti-id-badge"></i> KYC &amp; Handlers ${kycCount > 0 ? `<span class="nb">${kycCount}</span>` : ''}</button>
          <button class="btn ${this.activeTab === 'rates' ? 'pr' : ''}" data-tab="rates"><i class="ti ti-coin"></i> Rate Requests</button>
          <button class="btn ${this.activeTab === 'bookings' ? 'pr' : ''}" data-tab="bookings"><i class="ti ti-ship"></i> Bookings</button>
          <button class="btn ${this.activeTab === 'si' ? 'pr' : ''}" data-tab="si"><i class="ti ti-notes"></i> Shipping Instructions</button>
          <button class="btn ${this.activeTab === 'corrections' ? 'pr' : ''}" data-tab="corrections"><i class="ti ti-edit"></i> HBL Corrections</button>
        </div>
        <div>
          <input class="search-input" id="compass-search" placeholder="Search portal scope..." value="${this.searchQuery}" style="width: 200px;"/>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: ${this.selectedRequestId ? '1.3fr 1fr' : '1fr'}; gap:20px; align-items:start;">
        <div class="tbl-wrap" style="margin-bottom:0;">
          ${this.renderTabTable(customers, requests, erpUsers)}
        </div>

        ${this.selectedRequestId ? this.renderDetailsPanel(requests, erpUsers) : ''}
      </div>
    `;

    setTimeout(() => {
      this.setupHandlers(container, allCustomers, allRequests, erpUsers);
    }, 50);

    return container;
  }

  renderTabTable(customers, requests, erpUsers) {
    if (this.activeTab === "kyc") {
      return `
        <table>
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Contact Details</th>
              <th>KYC GST &amp; PAN</th>
              <th>Handler Assigned</th>
              <th>KYC Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${customers.length === 0 ? `<tr><td colspan="6"><div class="empty-state">No customer accounts under this scope.</div></td></tr>` :
            customers.map(c => `
              <tr>
                <td style="font-weight:600; color:var(--text-main);">${c.companyName}</td>
                <td>
                  <div style="font-size:11px;">${c.contactPerson}</div>
                  <div style="font-size:10px; color:var(--text-muted);">${c.email}</div>
                  <div style="font-size:10px; color:var(--text-muted);">${c.phone || ''}</div>
                </td>
                <td>
                  <div style="font-size:11px;">GST: <strong>${c.kycInfo?.gst || '—'}</strong></div>
                  <div style="font-size:11px;">PAN: <strong>${c.kycInfo?.pan || '—'}</strong></div>
                  <div style="font-size:10px; color:var(--primary); cursor:pointer;" data-role="view-doc" data-doc="${c.kycInfo?.docName}">Doc: ${c.kycInfo?.docName || 'KYC Attachment'}</div>
                </td>
                <td>
                  <select class="handler-assign-select" data-cid="${c.id}" style="font-size:11px; padding:4px 8px; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-main); outline:none;">
                    <option value="">— Unassigned —</option>
                    ${erpUsers.map(u => `<option value="${u.id}" ${c.handlerId === u.id ? 'selected' : ''}>${u.name} [${u.role || 'Staff'}]</option>`).join('')}
                  </select>
                </td>
                <td>${statusBadge(c.kycStatus || 'Pending')}</td>
                <td>
                  <div style="display:flex; gap:4px;">
                    ${c.kycStatus !== 'Approved' ? `<button class="btn sm pr" data-role="approve-kyc" data-cid="${c.id}">Approve</button>` : ''}
                    ${c.kycStatus !== 'Rejected' ? `<button class="btn sm danger" data-role="reject-kyc" data-cid="${c.id}">Reject</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const filteredReqs = requests.filter(r => {
      if (this.activeTab === "rates") return r.requestType === "Rate Request";
      if (this.activeTab === "bookings") return r.requestType === "Booking Request";
      if (this.activeTab === "si") return r.requestType === "Shipping Instruction";
      if (this.activeTab === "corrections") return r.requestType === "BL Correction";
      return false;
    });

    return `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Customer</th>
            <th>Summary Details</th>
            <th>Status</th>
            <th>Linked Ref</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${filteredReqs.length === 0 ? `<tr><td colspan="6"><div class="empty-state">No requests in this category.</div></td></tr>` :
          filteredReqs.map(r => {
            const isSelected = r.id === this.selectedRequestId;
            let summary = "";
            if (r.requestType === "Rate Request" || r.requestType === "Booking Request") {
              summary = `${r.details?.origin || '—'} → ${r.details?.destination || '—'} · ${r.details?.containerType || r.details?.containerDetails || ''} · ${r.details?.commodity || ''}`;
            } else if (r.requestType === "Shipping Instruction") {
              summary = `SI details for Job No: ${r.details?.bookingNo || '—'}`;
            } else if (r.requestType === "BL Correction") {
              summary = `HBL Correction: ${r.details?.bookingNo || '—'} · ${r.details?.correctionField || 'General'}`;
            }

            return `
              <tr style="cursor:pointer; background:${isSelected ? 'var(--primary-light)' : 'none'}" data-role="select-req" data-rid="${r.id}">
                <td style="font-size:11px;">${fmtDate(r.createdAt)}</td>
                <td style="font-weight:600; color:var(--text-main);">${r.customerName}</td>
                <td style="font-size:12px;">${summary}</td>
                <td>${statusBadge(r.status || 'Pending')}</td>
                <td style="font-weight:600; font-size:11px; color:var(--primary);">${r.transferredRef || '—'}</td>
                <td>
                  <div style="display:flex; gap:4px; justify-content:flex-end;">
                    <button class="btn sm" data-role="select-req" data-rid="${r.id}"><i class="ti ti-messages"></i> Chat</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  renderDetailsPanel(requests, erpUsers) {
    const req = requests.find(r => r.id === this.selectedRequestId);
    if (!req) return "";

    let detailsHTML = "";
    if (req.requestType === "Rate Request") {
      detailsHTML = `
        <div class="kv-row"><span class="kv-key">Origin Port</span><span>${req.details?.origin || '—'}</span></div>
        <div class="kv-row"><span class="kv-key">Destination Port</span><span>${req.details?.destination || '—'}</span></div>
        <div class="kv-row"><span class="kv-key">Commodity Description</span><span>${req.details?.commodity || '—'}</span></div>
        <div class="form-row" style="margin-bottom:0; gap:8px; padding:6px 0; border-bottom:1px solid var(--border)">
          <div class="fg"><span class="kv-key">Weight</span><span style="font-size:12px; font-weight:600;">${req.details?.weight || 0} kg</span></div>
          <div class="fg"><span class="kv-key">Volume</span><span style="font-size:12px; font-weight:600;">${req.details?.volume || 0} CBM</span></div>
          <div class="fg"><span class="kv-key">Container Size</span><span style="font-size:12px; font-weight:600;">${req.details?.containerType || '—'}</span></div>
        </div>
        <div class="kv-row"><span class="kv-key">Cargo Ready Date</span><span>${fmtDate(req.details?.readyDate)}</span></div>
        <div class="kv-row"><span class="kv-key">Customer Remarks</span><span>${req.details?.remarks || '—'}</span></div>
      `;
    } else if (req.requestType === "Booking Request") {
      const isHaz = req.details?.isHazardous ? "Yes" : "No";
      const hazBadge = req.details?.isHazardous 
        ? `<span class="badge b-danger" style="margin-left:8px;">HAZARDOUS (Class ${escapeHTML(req.details?.imdgClass)} / UN ${escapeHTML(req.details?.unNumber)})</span>`
        : `<span class="badge b-green" style="margin-left:8px;">NON-HAZARDOUS</span>`;

      detailsHTML = `
        <div class="kv-row"><span class="kv-key">Origin (POL)</span><span>${escapeHTML(req.details?.origin || '—')}</span></div>
        <div class="kv-row"><span class="kv-key">Destination (POD)</span><span>${escapeHTML(req.details?.destination || '—')}</span></div>
        <div class="kv-row"><span class="kv-key">Shipper</span><span>${escapeHTML(req.details?.shipper || '—')}</span></div>
        <div class="kv-row"><span class="kv-key">Consignee</span><span>${escapeHTML(req.details?.consignee || '—')}</span></div>
        <div class="kv-row"><span class="kv-key">Notify Party</span><span>${escapeHTML(req.details?.notifyParty || '—')}</span></div>
        
        <div class="form-row" style="margin-bottom:0; gap:8px; padding:6px 0; border-bottom:1px solid var(--border)">
          <div class="fg"><span class="kv-key">Weight (Gross)</span><span style="font-size:12px; font-weight:600;">${req.details?.weight || 0} kg</span></div>
          <div class="fg"><span class="kv-key">Volume (CBM)</span><span style="font-size:12px; font-weight:600;">${req.details?.volume || 0} CBM</span></div>
          <div class="fg"><span class="kv-key">Packages Details</span><span style="font-size:12px; font-weight:600;">${req.details?.packagesCount || 1} ${escapeHTML(req.details?.packageType || 'PKGS')}</span></div>
        </div>

        <div class="form-row" style="margin-bottom:0; gap:8px; padding:6px 0; border-bottom:1px solid var(--border)">
          <div class="fg"><span class="kv-key">Containers Requested</span><span style="font-size:12px; font-weight:600;">${req.details?.containerQty || 1}x ${escapeHTML(req.details?.containerType || '—')}</span></div>
          <div class="fg"><span class="kv-key">HS Code</span><span style="font-size:12px; font-weight:600;">${escapeHTML(req.details?.hsCode || '—')}</span></div>
          <div class="fg"><span class="kv-key">Incoterm</span><span style="font-size:12px; font-weight:600;">${escapeHTML(req.details?.incoterm || '—')}</span></div>
        </div>

        <div class="kv-row"><span class="kv-key">Hazard Status</span><div>${hazBadge}</div></div>
        <div class="kv-row"><span class="kv-key">Cargo Ready Date</span><span>${fmtDate(req.details?.readyDate)}</span></div>
        <div class="kv-row"><span class="kv-key">ETD Preference Date</span><span>${fmtDate(req.details?.etd)}</span></div>
        <div class="kv-row"><span class="kv-key">Customer Routing Remarks</span><span>${escapeHTML(req.details?.remarks || '—')}</span></div>
      `;
    } else if (req.requestType === "Shipping Instruction") {
      detailsHTML = `
        <div class="kv-row"><span class="kv-key">Linked Job / Ref</span><span>${req.details?.bookingNo || '—'}</span></div>
        <div class="kv-row"><span class="kv-key">Shipper Profile</span><span style="text-align:right;">${req.details?.shipper || '—'}</span></div>
        <div class="kv-row"><span class="kv-key">Consignee Profile</span><span style="text-align:right;">${req.details?.consignee || '—'}</span></div>
        <div class="kv-row"><span class="kv-key">Notify Party</span><span>${req.details?.notifyParty || '—'}</span></div>
        <div class="kv-row"><span class="kv-key">Cargo Details</span><span>${req.details?.cargoDesc || '—'}</span></div>
        <div class="kv-row"><span class="kv-key">Container / Seal #</span><span>${req.details?.containerNo || '—'} / ${req.details?.sealNo || '—'}</span></div>
        <div class="kv-row"><span class="kv-key">Marks &amp; Numbers</span><span>${req.details?.marksNo || '—'}</span></div>
        <div class="kv-row"><span class="kv-key">HS Code</span><span>${req.details?.hsCode || '—'}</span></div>
      `;
    } else if (req.requestType === "BL Correction") {
      detailsHTML = `
        <div class="kv-row"><span class="kv-key">Linked Job / Ref</span><span>${req.details?.bookingNo || '—'}</span></div>
        <div class="kv-row"><span class="kv-key">Correction Field</span><span style="font-weight:600; color:var(--primary);">${req.details?.correctionField || '—'}</span></div>
        <div class="kv-row"><span class="kv-key">Original Text</span><span style="color:var(--danger); text-decoration:line-through;">${req.details?.originalText || '—'}</span></div>
        <div class="kv-row"><span class="kv-key">Requested Correction</span><span style="color:var(--success); font-weight:600;">${req.details?.correctedText || '—'}</span></div>
        <div class="kv-row"><span class="kv-key">Reason / Remarks</span><span>${req.details?.remarks || '—'}</span></div>
      `;
    }

    return `
      <div class="card" style="margin-bottom:0; display:flex; flex-direction:column; gap:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px;">
          <div>
            <h3 style="font-size:14px; font-weight:700; color:var(--text-main);">${req.requestType} Details</h3>
            <span style="font-size:11px; color:var(--text-muted);">${req.customerName} · ${fmtDate(req.createdAt)}</span>
          </div>
          <button class="btn sm" id="close-detail-panel-btn"><i class="ti ti-x"></i></button>
        </div>

        <div style="display:flex; flex-direction:column; gap:2px; max-height:220px; overflow-y:auto; padding-right:4px;">
          ${detailsHTML}
        </div>

        <!-- Conversion Triggers -->
        ${req.status === 'Pending' ? `
          <div style="border-top:1px solid var(--border); padding-top:12px; display:flex; gap:8px;">
            ${req.requestType === 'Rate Request' ? `<button class="btn pr sm" id="convert-to-quote-btn" style="flex:1;"><i class="ti ti-file-invoice"></i> Generate Quotation</button>` : ''}
            ${req.requestType === 'Booking Request' ? `<button class="btn pr sm" id="convert-to-shipment-btn" style="flex:1;"><i class="ti ti-box"></i> Convert to Shipment</button>` : ''}
            ${req.requestType === 'Shipping Instruction' || req.requestType === 'BL Correction' ? `<button class="btn pr sm" id="complete-instruction-btn" style="flex:1;"><i class="ti ti-check"></i> Mark Processed &amp; Approve</button>` : ''}
            <button class="btn sm danger" id="reject-inquiry-btn">Reject</button>
          </div>
        ` : `
          <div style="font-size:11px; color:var(--success); display:flex; align-items:center; gap:6px; font-weight:600; padding:10px; border-radius:var(--radius-md); background:var(--success-light); border:1px solid rgba(16,185,129,0.15);">
            <i class="ti ti-circle-check"></i> Inquiry approved &amp; processed. Linked: ${req.transferredRef || 'ERP Record'}
          </div>
        `}

        <!-- Message/Chat Board -->
        <div style="border-top:1px solid var(--border); padding-top:12px; display:flex; flex-direction:column; gap:8px;">
          <h4 style="font-size:11px; font-weight:600; text-transform:uppercase; color:var(--text-muted);">Inquiry Remarks / Chat</h4>
          
          <div id="chat-messages-box" style="height:150px; overflow-y:auto; border:1px solid var(--border); border-radius:var(--radius-md); padding:8px; display:flex; flex-direction:column; gap:8px; background:var(--bg-hover);">
            ${(req.chat || []).length === 0 ? `<div style="text-align:center; font-size:11px; color:var(--text-muted); margin:auto;">No message logs. Type below to text client.</div>` :
            req.chat.map(m => {
              const isHandler = m.sender === 'handler';
              return `
                <div style="display:flex; flex-direction:column; align-items:${isHandler ? 'flex-end' : 'flex-start'};">
                  <div style="
                    max-width:85%; padding:6px 10px; font-size:11.5px; border-radius:var(--radius-md);
                    background:${isHandler ? 'var(--primary)' : 'var(--bg-card)'};
                    color:${isHandler ? '#fff' : 'var(--text-main)'};
                    border:${isHandler ? 'none' : '1px solid var(--border)'};
                  ">
                    ${escapeHTML(m.text)}
                  </div>
                  <span style="font-size:9px; color:var(--text-muted); margin-top:2px;">${escapeHTML(m.time || '')}</span>
                </div>
              `;
            }).join('')}
          </div>

          <div style="display:flex; gap:6px;">
            <input class="search-input" id="chat-input-text" placeholder="Type message to client..." style="flex:1; font-size:12px; padding:6px 10px;"/>
            <button class="btn pr sm" id="chat-send-btn"><i class="ti ti-send"></i></button>
          </div>
        </div>
      </div>
    `;
  }

  setupHandlers(container, allCustomers, allRequests, erpUsers) {
    // Tabs switcher
    container.querySelectorAll("#compass-tabs button").forEach(btn => {
      btn.onclick = () => {
        this.activeTab = btn.dataset.tab;
        this.selectedRequestId = null;
        this.refreshPanel(container);
      };
    });

    // Search query
    const search = container.querySelector("#compass-search");
    if (search) {
      search.oninput = (e) => {
        this.searchQuery = e.target.value;
        this.refreshPanel(container);
      };
    }

    // Row selection for chat details
    container.querySelectorAll("[data-role=select-req]").forEach(item => {
      item.onclick = (e) => {
        // Prevent trigger if clicking details buttons specifically
        if (e.target.closest("button") && !e.target.closest("[data-role=select-req]")) return;
        this.selectedRequestId = item.dataset.rid;
        this.refreshPanel(container);
      };
    });

    // KYC managers
    if (this.activeTab === "kyc") {
      // Handler assignment change
      container.querySelectorAll(".handler-assign-select").forEach(sel => {
        sel.onchange = async () => {
          const cid = sel.dataset.cid;
          const handlerId = sel.value;
          const cust = allCustomers.find(c => c.id === cid);
          if (cust) {
            cust.handlerId = handlerId;
            await saveDocument("customerUsers", cust, cid);
            showToast(`Assigned customer handler to ${cust.companyName}`, "success");
          }
        };
      });

      // View KYC doc
      container.querySelectorAll("[data-role=view-doc]").forEach(btn => {
        btn.onclick = () => {
          const docName = btn.dataset.doc;
          showToast(`Opening file preview for: ${docName || 'KYC Attachment'}`, "info");
        };
      });

      // KYC Approve
      container.querySelectorAll("[data-role=approve-kyc]").forEach(btn => {
        btn.onclick = () => {
          const cid = btn.dataset.cid;
          const cust = allCustomers.find(c => c.id === cid);
          showConfirm(`Approve KYC document verification for ${cust.companyName}? This automatically registers them as a verified Customer in the ERP database.`, async () => {
            cust.kycStatus = "Approved";
            await saveDocument("customerUsers", cust, cid);

            // Send KYC approval email to client
            const settings = await getCollection("settings") || {};
            const appUrl = settings.appUrl || window.location.origin;
            const loginUrl = `${appUrl}?portal=customer`;
            const emailSubject = "CargoPulse KYC Approved";
            const emailBody = `Dear ${cust.contactPerson},\n\nWe are pleased to inform you that your KYC application for "${cust.companyName}" on ${settings.companyInitials || 'GLS'} CargoPulse has been APPROVED.\n\nYou can now log in to the portal to request rates, manage bookings, and download invoices:\n${loginUrl}\n\nYour Login Email: ${cust.email}\n\nBest regards,\n${settings.company || 'Operations Team'}`;
            sendPortalEmail(cust.email, emailSubject, emailBody);

            // Fetch current customer master to see if they already exist
            const masters = await getCollection("customers");
            const alreadyExists = masters.some(m => m.company.toLowerCase() === cust.companyName.toLowerCase());

            if (!alreadyExists) {
              const yr = new Date().getFullYear();
              const code = `CUST-${String(masters.length + 1).padStart(3, '0')}`;
              const newMaster = {
                code: code,
                company: cust.companyName,
                contactPerson: cust.contactPerson,
                phone: cust.phone || '+91...',
                email: cust.email,
                country: 'India',
                gst: cust.kycInfo?.gst || '',
                address: cust.kycInfo?.address || '',
                creditLimit: 500000,
                paymentTerms: 'Net 30',
                status: 'Active',
                currency: 'INR'
              };
              await saveDocument("customers", newMaster);
            }

            // Notification
            await saveDocument("notifications", {
              msg: `KYC Approved: "${cust.companyName}" customer account is now fully active.`,
              read: false,
              ts: new Date().toLocaleString(),
              type: "success"
            });

            // Audit
            await saveDocument("auditLog", {
              ts: new Date().toLocaleString(),
              user: sessionStorage.getItem("erp_user_name") || "Super Admin",
              action: "KYC APPROVAL",
              module: "Compass Portal",
              record: `Approved KYC documents & created Customer master profile for ${cust.companyName}`,
              ip: "10.0.0." + Math.floor(Math.random() * 200 + 1)
            });

            showToast(`KYC Approved for ${cust.companyName}`, "success");
            this.refreshPanel(container);
          });
        };
      });

      // KYC Reject
      container.querySelectorAll("[data-role=reject-kyc]").forEach(btn => {
        btn.onclick = () => {
          const cid = btn.dataset.cid;
          const cust = allCustomers.find(c => c.id === cid);
          showConfirm(`Reject KYC application for ${cust.companyName}?`, async () => {
            cust.kycStatus = "Rejected";
            await saveDocument("customerUsers", cust, cid);

            // Audit
            await saveDocument("auditLog", {
              ts: new Date().toLocaleString(),
              user: sessionStorage.getItem("erp_user_name") || "Super Admin",
              action: "KYC REJECTION",
              module: "Compass Portal",
              record: `Rejected KYC application for ${cust.companyName} due to documentation discrepancy`,
              ip: "10.0.0." + Math.floor(Math.random() * 200 + 1)
            });

            showToast(`KYC Rejected for ${cust.companyName}`, "warning");
            this.refreshPanel(container);
          });
        };
      });
    }

    // Detail Panel Handlers
    if (this.selectedRequestId) {
      const closeDetail = container.querySelector("#close-detail-panel-btn");
      if (closeDetail) {
        closeDetail.onclick = () => {
          this.selectedRequestId = null;
          this.refreshPanel(container);
        };
      }

      const activeReq = allRequests.find(r => r.id === this.selectedRequestId);

      // Chat handlers
      const chatInput = container.querySelector("#chat-input-text");
      const sendBtn = container.querySelector("#chat-send-btn");
      
      const sendMsgFn = async () => {
        const text = chatInput.value.trim();
        if (!text) return;

        if (!activeReq.chat) activeReq.chat = [];
        activeReq.chat.push({
          sender: 'handler',
          text: text,
          time: new Date().toLocaleString()
        });

        await saveDocument("customerRequests", activeReq, activeReq.id);
        chatInput.value = "";
        this.refreshPanel(container);
        
        // Auto scroll chat box to bottom
        setTimeout(() => {
          const chatBox = document.getElementById("chat-messages-box");
          if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
        }, 80);
      };

      if (sendBtn) sendBtn.onclick = sendMsgFn;
      if (chatInput) {
        chatInput.onkeypress = (e) => {
          if (e.key === "Enter") sendMsgFn();
        };
      }

      // Convert Rate Request to Quotation
      const convertQuote = container.querySelector("#convert-to-quote-btn");
      if (convertQuote) {
        convertQuote.onclick = () => {
          showConfirm(`Generate a Tax Quotation for rate inquiry from ${activeReq.customerName}?`, async () => {
            const yr = new Date().getFullYear();
            const list = await getCollection("quotations") || [];
            const nextSeq = String(list.length + 1).padStart(4, '0');
            const quoteNo = `QT-${yr}-${nextSeq}`;

            const newQuotation = {
              quoteNo: quoteNo,
              customer: activeReq.customerName,
              date: new Date().toISOString().split('T')[0],
              origin: activeReq.details?.origin || '',
              destination: activeReq.details?.destination || '',
              validity: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days
              commodity: activeReq.details?.commodity || '',
              remarks: activeReq.details?.remarks || '',
              total: activeReq.details?.volume ? activeReq.details.volume * 4000 : 80000,
              items: [
                { desc: 'Ocean Freight charges', qty: 1, rate: activeReq.details?.volume ? activeReq.details.volume * 4000 : 80000, amount: activeReq.details?.volume ? activeReq.details.volume * 4000 : 80000 }
              ],
              status: 'Active'
            };

            const savedQuote = await saveDocument("quotations", newQuotation);
            
            // Link back to request
            activeReq.status = "Approved";
            activeReq.transferredRef = savedQuote.quoteNo;
            await saveDocument("customerRequests", activeReq, activeReq.id);

            // Audit Log
            await saveDocument("auditLog", {
              ts: new Date().toLocaleString(),
              user: sessionStorage.getItem("erp_user_name") || "Super Admin",
              action: "QUOTE GENERATION",
              module: "Quotation Manager",
              record: `Auto-generated quotation ${savedQuote.quoteNo} from customer rate request`,
              ip: "10.0.0." + Math.floor(Math.random() * 200 + 1)
            });

            showToast(`Quotation ${savedQuote.quoteNo} generated successfully!`, "success");
            this.refreshPanel(container);
          });
        };
      }

      // Convert Booking Request to Shipment
      const convertShipment = container.querySelector("#convert-to-shipment-btn");
      if (convertShipment) {
        convertShipment.onclick = () => {
          showConfirm(`Convert this Booking Request into an active Freight Shipment job?`, async () => {
            const yr = new Date().getFullYear().toString().substr(2);
            const mn = String(new Date().getMonth() + 1).padStart(2, '0');
            const list = await getCollection("shipments") || [];
            const nextSeq = String(list.length + 1).padStart(4, '0');
            const jobNo = `JB-${yr}${mn}-${nextSeq}`;

            const containerDetails = activeReq.details?.containerQty 
              ? `${activeReq.details.containerQty}x ${activeReq.details.containerType || '40HC'}`
              : (activeReq.details?.containerType || '1x40HC');

            const packagesStr = activeReq.details?.packagesCount
              ? `${activeReq.details.packagesCount} ${activeReq.details.packageType || 'Cartons'}`
              : '1 PKG';

            const newShipment = {
              jobNo: jobNo,
              type: 'FCL Export',
              customer: activeReq.customerName,
              shipper: activeReq.details?.shipper || activeReq.customerName,
              consignee: activeReq.details?.consignee || 'To Order',
              notifyParty: activeReq.details?.notifyParty || 'To Order',
              bookingNo: `BKG-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
              blNo: '',
              pol: activeReq.details?.origin || '',
              pod: activeReq.details?.destination || '',
              finalDest: activeReq.details?.destination || '',
              incoterm: activeReq.details?.incoterm || 'FOB',
              vessel: 'TBD',
              voyage: 'TBD',
              etd: activeReq.details?.etd || new Date().toISOString().split('T')[0],
              eta: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              commodity: activeReq.details?.commodity || `${activeReq.details?.hsCode || ''} HS Cargo`,
              grossWeight: activeReq.details?.weight || 0,
              volume: activeReq.details?.volume || 0,
              packages: packagesStr,
              containerDetails: containerDetails,
              readyDate: activeReq.details?.readyDate || '',
              isHazardous: !!activeReq.details?.isHazardous,
              imdgClass: activeReq.details?.imdgClass || '',
              unNumber: activeReq.details?.unNumber || '',
              status: 'Booking Created',
              createdAt: new Date().toLocaleString(),
              timeline: [
                { event: 'Booking Created', date: new Date().toISOString().split('T')[0], user: sessionStorage.getItem("erp_user_name") || "Super Admin", remarks: 'Imported from Customer Booking Request' }
              ]
            };

            const savedShip = await saveDocument("shipments", newShipment);

            // Link back to request
            activeReq.status = "Approved";
            activeReq.transferredRef = savedShip.jobNo;
            await saveDocument("customerRequests", activeReq, activeReq.id);

            // Audit
            await saveDocument("auditLog", {
              ts: new Date().toLocaleString(),
              user: sessionStorage.getItem("erp_user_name") || "Super Admin",
              action: "CONVERT BOOKING",
              module: "Shipment Manager",
              record: `Converted customer booking into shipment job ${savedShip.jobNo}`,
              ip: "10.0.0." + Math.floor(Math.random() * 200 + 1)
            });

            // Notification
            await saveDocument("notifications", {
              msg: `Converted booking request into active Shipment job: ${savedShip.jobNo}`,
              read: false,
              ts: new Date().toLocaleString(),
              type: "success"
            });

            showToast(`Shipment ${savedShip.jobNo} created successfully!`, "success");
            this.refreshPanel(container);
          });
        };
      }

      // Complete SI / BL Correction
      const completeInst = container.querySelector("#complete-instruction-btn");
      if (completeInst) {
        completeInst.onclick = () => {
          showConfirm(`Mark this customer instruction as processed and updated inside ERP files?`, async () => {
            activeReq.status = "Approved";
            activeReq.transferredRef = activeReq.details?.bookingNo || "Processed";
            await saveDocument("customerRequests", activeReq, activeReq.id);

            showToast(`Instruction marked as completed.`, "success");
            this.refreshPanel(container);
          });
        };
      }

      // Reject Inquiry
      const rejectBtn = container.querySelector("#reject-inquiry-btn");
      if (rejectBtn) {
        rejectBtn.onclick = () => {
          showConfirm(`Reject this customer request?`, async () => {
            activeReq.status = "Rejected";
            await saveDocument("customerRequests", activeReq, activeReq.id);

            showToast(`Customer request rejected.`, "warning");
            this.refreshPanel(container);
          });
        };
      }
    }
  }

  async refreshPanel(container) {
    const parent = container.parentElement;
    if (parent) {
      const newEl = await this.render();
      parent.replaceChild(newEl, container);
      
      // Keep scroll state of chat
      const chatBox = document.getElementById("chat-messages-box");
      if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
    }
  }
}

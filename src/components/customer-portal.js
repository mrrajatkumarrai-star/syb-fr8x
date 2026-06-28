import { getCollection, saveDocument } from "../services/db.js";
import { fmtDate, fmtAmt, statusBadge, showToast, showConfirm, escapeHTML } from "../services/ui.js";

export class CustomerPortal {
  constructor(onLogout) {
    this.onLogout = onLogout;
    this.activeTab = "dashboard"; // dashboard, tasks, rates, bookings, si, corrections, invoices, quotations, receipts, chat
    this.selectedRequestId = null;
    this.customerUserId = sessionStorage.getItem("customer_user_id");
    this.companyName = sessionStorage.getItem("customer_company_name");
  }

  async render() {
    const settings = await getCollection("settings") || {};
    const initials = settings.companyInitials || "GLS";
    const logoUrl = settings.companyLogo || "";
    const coreCompanyName = settings.company || "Global Logistics Solutions Ltd";

    const allRequests = await getCollection("customerRequests") || [];
    const allInvoices = await getCollection("invoices") || [];
    const allQuotations = await getCollection("quotations") || [];
    const allReceipts = await getCollection("receipts") || [];
    const allCustomers = await getCollection("customerUsers") || [];
    const erpUsers = await getCollection("users") || [];
    const allShipments = await getCollection("shipments") || [];
    const allTasks = await getCollection("tasks") || [];
    const allContainers = await getCollection("containers") || [];

    const myRequests = allRequests.filter(r => r.customerId === this.customerUserId);
    const myInvoices = allInvoices.filter(i => i.customer.toLowerCase() === this.companyName.toLowerCase());
    const myQuotations = allQuotations.filter(q => q.customer.toLowerCase() === this.companyName.toLowerCase());
    const myReceipts = allReceipts.filter(r => r.customer.toLowerCase() === this.companyName.toLowerCase());
    
    // Secure task visibility scope based on client job numbers
    this.myShipments = allShipments.filter(s => s.customer && s.customer.toLowerCase() === this.companyName.toLowerCase());
    const myJobNumbers = this.myShipments.map(s => s.jobNo).filter(Boolean);
    this.myTasks = allTasks.filter(t => t.jobNo && myJobNumbers.includes(t.jobNo));
    this.myContainers = allContainers.filter(c => c.jobNo && myJobNumbers.includes(c.jobNo));

    const customerObj = allCustomers.find(c => c.id === this.customerUserId) || {};
    const handler = erpUsers.find(u => u.id === customerObj.handlerId) || { name: "Operations Desk", role: "Support Desk" };

    const element = document.createElement("div");
    element.style.cssText = `
      display: flex;
      height: 100vh;
      width: 100vw;
      background: var(--bg-app);
      overflow: hidden;
    `;

    element.innerHTML = `
      <!-- Customer Portal Sidebar -->
      <div style="width: 250px; background: var(--bg-card); border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0;">
        <!-- Brand Header -->
        <div style="padding: 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; height: 60px;">
          ${logoUrl ? `<img src="${escapeHTML(logoUrl)}" style="height: 32px; max-width: 100px; object-fit: contain;"/>` : 
                      `<div style="width: 32px; height: 32px; background: var(--primary); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 16px;"><i class="ti ti-compass"></i></div>`}
          <div>
            <div style="font-size: 12px; font-weight: 700; color: var(--text-main); line-height: 1.1;">${escapeHTML(initials)} CargoPulse</div>
            <div style="font-size: 9px; color: var(--text-muted);">Customer Portal</div>
          </div>
        </div>

        <!-- Sidebar Nav -->
        <div style="flex: 1; overflow-y: auto; padding: 12px 0; display: flex; flex-direction: column; gap: 2px;">
          <div style="padding: 10px 16px 4px; font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Overview</div>
          <div class="ni ${this.activeTab === 'dashboard' ? 'on' : ''}" data-nav="dashboard"><i class="ti ti-layout-dashboard"></i><span>Dashboard</span></div>
          <div class="ni ${this.activeTab === 'shipments' ? 'on' : ''}" data-nav="shipments"><i class="ti ti-box"></i><span>My Shipments</span></div>
          <div class="ni ${this.activeTab === 'containers' ? 'on' : ''}" data-nav="containers"><i class="ti ti-container"></i><span>Container Tracking</span></div>
          <div class="ni ${this.activeTab === 'tasks' ? 'on' : ''}" data-nav="tasks"><i class="ti ti-check"></i><span>Operations Tasks</span></div>
          
          <div style="padding: 10px 16px 4px; font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Inquiries</div>
          <div class="ni ${this.activeTab === 'rates' ? 'on' : ''}" data-nav="rates"><i class="ti ti-coin"></i><span>Rate Requests</span></div>
          <div class="ni ${this.activeTab === 'bookings' ? 'on' : ''}" data-nav="bookings"><i class="ti ti-ship"></i><span>Booking Requests</span></div>
          <div class="ni ${this.activeTab === 'si' ? 'on' : ''}" data-nav="si"><i class="ti ti-notes"></i><span>Shipping Instructions</span></div>
          <div class="ni ${this.activeTab === 'corrections' ? 'on' : ''}" data-nav="corrections"><i class="ti ti-edit"></i><span>BL Corrections</span></div>
          
          <div style="padding: 10px 16px 4px; font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Billing &amp; Files</div>
          <div class="ni ${this.activeTab === 'quotations' ? 'on' : ''}" data-nav="quotations"><i class="ti ti-file-invoice"></i><span>Quotations</span></div>
          <div class="ni ${this.activeTab === 'invoices' ? 'on' : ''}" data-nav="invoices"><i class="ti ti-receipt"></i><span>Invoices</span></div>
          <div class="ni ${this.activeTab === 'receipts' ? 'on' : ''}" data-nav="receipts"><i class="ti ti-wallet"></i><span>Receipts</span></div>
          
          <div style="padding: 10px 16px 4px; font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Support</div>
          <div class="ni ${this.activeTab === 'chat' ? 'on' : ''}" data-nav="chat"><i class="ti ti-messages"></i><span>Remarks &amp; Chat</span></div>
        </div>

        <!-- Logout Section -->
        <div style="padding: 16px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px;">
          <div style="font-size: 10px; color: var(--text-muted); line-height: 1.3;">
            Logged in as:<br/>
            <strong style="color: var(--text-main);">${escapeHTML(this.companyName)}</strong>
          </div>
          <button class="btn sm danger" id="cust-logout-btn" style="width: 100%; justify-content: center;"><i class="ti ti-logout"></i> Logout Portal</button>
        </div>
      </div>

      <!-- Main Customer Views Panel -->
      <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-app);">
        <!-- Top bar -->
        <div class="topbar" style="height: 60px; padding: 0 24px; background: var(--bg-card); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
          <div style="font-size: 15px; font-weight: 700; color: var(--text-main);" id="cust-portal-title">Dashboard Overview</div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 11px; color: var(--text-muted);">Your handler: <strong style="color: var(--text-main);">${handler.name}</strong></div>
            <span class="badge b-green">KYC Approved</span>
          </div>
        </div>

        <!-- Content Mount -->
        <div style="flex: 1; overflow-y: auto; padding: 24px;" id="cust-content-mount">
          ${this.renderActiveTab(myRequests, myInvoices, myQuotations, myReceipts, handler)}
        </div>
      </div>
    `;

    setTimeout(() => {
      this.setupSidebarEvents(element, myRequests, myInvoices, myQuotations, myReceipts, handler);
    }, 50);

    return element;
  }

  renderActiveTab(requests, invoices, quotations, receipts, handler) {
    if (this.activeTab === "dashboard") {
      const pendingRates = requests.filter(r => r.requestType === "Rate Request" && r.status === "Pending").length;
      const pendingBookings = requests.filter(r => r.requestType === "Booking Request" && r.status === "Pending").length;
      const totalInvoices = invoices.length;
      const unpaidInvoices = invoices.filter(i => i.status !== "Paid").length;

      return `
        <div style="animation: fadeIn 0.2s ease-out; display:flex; flex-direction:column; gap:20px;">
          <!-- Welcome banner -->
          <div class="card" style="margin-bottom:0; background: linear-gradient(135deg, var(--primary-light), rgba(139, 92, 246, 0.08)); border-color: rgba(37, 99, 235, 0.15); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 4px; color:var(--text-main);">Welcome back, ${this.companyName}!</h2>
              <p style="font-size: 12px; color: var(--text-muted);">Manage your bookings, shipping instructions, and download billing files instantly.</p>
            </div>
            <div style="font-size: 36px; color: var(--primary); opacity: 0.35;"><i class="ti ti-compass"></i></div>
          </div>

          <div class="grid4">
            <div class="stat-card">
              <div class="stat-lbl">Pending Rate Requests</div>
              <div class="stat-val" style="color:var(--info);">${pendingRates}</div>
            </div>
            <div class="stat-card">
              <div class="stat-lbl">Pending Bookings</div>
              <div class="stat-val" style="color:var(--warning);">${pendingBookings}</div>
            </div>
            <div class="stat-card">
              <div class="stat-lbl">Unpaid Invoices</div>
              <div class="stat-val" style="color:${unpaidInvoices > 0 ? 'var(--danger)' : 'var(--text-main)'};">${unpaidInvoices}</div>
            </div>
            <div class="stat-card">
              <div class="stat-lbl">Your Assigned Handler</div>
              <div class="stat-val" style="font-size:13px; font-weight:600; line-height:1.3; color:var(--primary); margin-top:8px;">
                ${handler.name}<br/>
                <span style="font-size:9px; color:var(--text-muted); font-weight:500;">${handler.role || 'Staff'}</span>
              </div>
            </div>
          </div>

          <div class="grid2">
            <div class="card" style="margin-bottom:0;">
              <div class="sec-title">Recent Inquiries</div>
              <div class="tbl-wrap" style="margin-bottom:0; box-shadow:none; border-radius:var(--radius-md);">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Summary</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${requests.slice(0, 5).length === 0 ? `<tr><td colspan="3"><div class="empty-state">No inquiries found.</div></td></tr>` :
                    requests.slice(0, 5).map(r => `
                      <tr>
                        <td style="font-weight:600;">${r.requestType}</td>
                        <td style="font-size:11.5px;">${r.details?.origin || ''} → ${r.details?.destination || ''}</td>
                        <td>${statusBadge(r.status)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="card" style="margin-bottom:0;">
              <div class="sec-title">Unpaid Bills &amp; Invoices</div>
              <div class="tbl-wrap" style="margin-bottom:0; box-shadow:none; border-radius:var(--radius-md);">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${invoices.filter(i => i.status !== "Paid").slice(0, 5).length === 0 ? `<tr><td colspan="4"><div class="empty-state">No pending bills found.</div></td></tr>` :
                    invoices.filter(i => i.status !== "Paid").slice(0, 5).map(i => `
                      <tr>
                        <td style="font-weight:600; color:var(--primary);">${i.invNo}</td>
                        <td style="font-size:11px;">${fmtDate(i.invoiceDate)}</td>
                        <td style="font-weight:600;">${fmtAmt(i.total, i.currency)}</td>
                        <td>${statusBadge(i.status)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeTab === "tasks") {
      const tasks = this.myTasks || [];
      return `
        <div style="animation: fadeIn 0.2s ease-out; display:flex; flex-direction:column; gap:16px;">
          <div class="filter-bar" style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="font-size:14px; font-weight:700; color:var(--text-main); flex:1;">Shipment Operations Tasks &amp; Milestones</h3>
          </div>
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Job Number</th>
                  <th>Task Name / Milestone</th>
                  <th>Description</th>
                  <th>Assigned Staff</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${tasks.length === 0 ? `<tr><td colspan="6"><div class="empty-state">No active operational milestones found for your shipments.</div></td></tr>` :
                tasks.map(t => `
                  <tr>
                    <td style="font-weight:600; color:var(--primary);">${escapeHTML(t.jobNo)}</td>
                    <td style="font-weight:600; color:var(--text-main);">${escapeHTML(t.name)}</td>
                    <td style="font-size:11.5px; color:var(--text-muted);">${escapeHTML(t.description || '—')}</td>
                    <td style="font-size:11px;">${escapeHTML(t.assignedTo || 'Operations Desk')}</td>
                    <td style="font-size:11px;">${fmtDate(t.dueDate)}</td>
                    <td>${statusBadge(t.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (this.activeTab === "shipments") {
      const shipments = this.myShipments || [];
      return `
        <div style="animation: fadeIn 0.2s ease-out; display:flex; flex-direction:column; gap:16px;">
          <div class="filter-bar">
            <h3 style="font-size:14px; font-weight:700; color:var(--text-main); flex:1;">My Freight Shipments</h3>
          </div>
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Job Number</th>
                  <th>Type</th>
                  <th>POL &rarr; POD</th>
                  <th>Booking No / HBL</th>
                  <th>Vessel / Voyage</th>
                  <th>ETD &rarr; ETA</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${shipments.length === 0 ? `<tr><td colspan="8"><div class="empty-state">No active shipments found for your company.</div></td></tr>` :
                shipments.map(s => `
                  <tr>
                    <td style="font-weight:600; color:var(--primary);">${escapeHTML(s.jobNo)}</td>
                    <td style="font-weight:600;">${escapeHTML(s.type)}</td>
                    <td style="font-size:11.5px;">${escapeHTML(s.pol)} &rarr; ${escapeHTML(s.pod)}</td>
                    <td>
                      <div style="font-size:11px;">BKG: <strong>${escapeHTML(s.bookingNo || '—')}</strong></div>
                      <div style="font-size:10px; color:var(--text-muted);">HBL: ${escapeHTML(s.blNo || '—')}</div>
                    </td>
                    <td style="font-size:11px;">
                      <div>${escapeHTML(s.vessel || '—')}</div>
                      <div style="font-size:9.5px; color:var(--text-muted);">VOY: ${escapeHTML(s.voyage || '—')}</div>
                    </td>
                    <td style="font-size:11px;">
                      <div>ETD: <strong>${fmtDate(s.etd)}</strong></div>
                      <div>ETA: <strong>${fmtDate(s.eta)}</strong></div>
                    </td>
                    <td>${statusBadge(s.status)}</td>
                    <td>
                      <button class="btn sm" data-role="view-shipment-detail" data-sid="${s.id}"><i class="ti ti-eye"></i> View Details</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (this.activeTab === "containers") {
      const containers = this.myContainers || [];
      return `
        <div style="animation: fadeIn 0.2s ease-out; display:flex; flex-direction:column; gap:16px;">
          <div class="filter-bar">
            <h3 style="font-size:14px; font-weight:700; color:var(--text-main); flex:1;">Container Tracking &amp; Detention Monitor</h3>
          </div>
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Container #</th>
                  <th>Job Number</th>
                  <th>Size / Type</th>
                  <th>Carrier</th>
                  <th>Seal Number</th>
                  <th>Gate In / Sail Date</th>
                  <th>Free Time Expiry</th>
                  <th>Detention Status</th>
                </tr>
              </thead>
              <tbody>
                ${containers.length === 0 ? `<tr><td colspan="8"><div class="empty-state">No containers currently tracked under your active shipments.</div></td></tr>` :
                containers.map(c => {
                  let alertText = "";
                  let alertColor = "var(--text-muted)";
                  if (c.status === 'Returned') {
                    alertText = "Returned Safe";
                    alertColor = "var(--success)";
                  } else {
                    const expiry = new Date(c.freeTimeExpiry);
                    const now = new Date();
                    const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
                    if (daysLeft < 0) {
                      alertText = `OVERDUE DETENTION (${Math.abs(daysLeft)} days)`;
                      alertColor = "var(--danger)";
                    } else if (daysLeft <= 4) {
                      alertText = `${daysLeft} Days Free Left`;
                      alertColor = "var(--warning)";
                    } else {
                      alertText = `${daysLeft} Days Free Left`;
                      alertColor = "var(--success)";
                    }
                  }

                  return `
                    <tr>
                      <td style="font-weight:700; color:var(--text-main);">${escapeHTML(c.containerNo)}</td>
                      <td style="font-weight:600; color:var(--primary);">${escapeHTML(c.jobNo)}</td>
                      <td>${escapeHTML(c.size)} ${escapeHTML(c.type || 'Dry')}</td>
                      <td>${escapeHTML(c.shippingLine)}</td>
                      <td><strong>${escapeHTML(c.sealNo || '—')}</strong></td>
                      <td style="font-size:11px;">
                        <div>Gate In: ${fmtDate(c.gateInDate)}</div>
                        <div>Sailed: ${fmtDate(c.sailingDate)}</div>
                      </td>
                      <td style="font-size:11px; font-weight:600;">${fmtDate(c.freeTimeExpiry)}</td>
                      <td style="font-weight:600; color:${alertColor}; font-size:11px;">${alertText}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (this.activeTab === "rates") {
      const rates = requests.filter(r => r.requestType === "Rate Request");
      return `
        <div style="animation: fadeIn 0.2s ease-out; display:flex; flex-direction:column; gap:16px;">
          <div class="filter-bar">
            <h3 style="font-size:14px; font-weight:700; color:var(--text-main); flex:1;">Rate Quotation Requests</h3>
            <button class="btn pr sm" id="new-rate-req-btn"><i class="ti ti-plus"></i> Request Rates</button>
          </div>
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Origin</th>
                  <th>Destination</th>
                  <th>Cargo Weight &amp; Vol</th>
                  <th>HS Commodity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rates.length === 0 ? `<tr><td colspan="7"><div class="empty-state">No rate requests submitted yet.</div></td></tr>` :
                rates.map(r => `
                  <tr>
                    <td>${fmtDate(r.createdAt)}</td>
                    <td style="font-weight:600;">${escapeHTML(r.details?.origin || '—')}</td>
                    <td style="font-weight:600;">${escapeHTML(r.details?.destination || '—')}</td>
                    <td>${r.details?.weight || 0} kg / ${r.details?.volume || 0} CBM</td>
                    <td>${escapeHTML(r.details?.commodity || '—')} (${escapeHTML(r.details?.containerType || '')})</td>
                    <td>${statusBadge(r.status)}</td>
                    <td>
                      <div style="display:flex; gap:4px;">
                        ${r.transferredRef ? `<button class="btn sm" data-role="view-quote-by-no" data-qno="${escapeHTML(r.transferredRef)}"><i class="ti ti-file-invoice"></i> Quote: ${escapeHTML(r.transferredRef)}</button>` : ''}
                        <button class="btn sm" data-role="go-to-chat" data-rid="${r.id}"><i class="ti ti-messages"></i> Chat</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (this.activeTab === "bookings") {
      const bookings = requests.filter(r => r.requestType === "Booking Request");
      return `
        <div style="animation: fadeIn 0.2s ease-out; display:flex; flex-direction:column; gap:16px;">
          <div class="filter-bar">
            <h3 style="font-size:14px; font-weight:700; color:var(--text-main); flex:1;">Booking Requests Log</h3>
            <button class="btn pr sm" id="new-booking-req-btn"><i class="ti ti-plus"></i> New Booking Request</button>
          </div>
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Origin &rarr; Destination</th>
                  <th>Load Specs</th>
                  <th>Vessel ETD Pref</th>
                  <th>Consignee</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${bookings.length === 0 ? `<tr><td colspan="7"><div class="empty-state">No booking requests made yet.</div></td></tr>` :
                bookings.map(r => `
                  <tr>
                    <td>${fmtDate(r.createdAt)}</td>
                    <td style="font-weight:600;">${escapeHTML(r.details?.origin || '—')} &rarr; ${escapeHTML(r.details?.destination || '—')}</td>
                    <td>${escapeHTML(r.details?.containerType || '')} (${r.details?.weight || 0} kg)</td>
                    <td>${fmtDate(r.details?.etd)}</td>
                    <td>${escapeHTML(r.details?.consignee || '—')}</td>
                    <td>${statusBadge(r.status)}</td>
                    <td>
                      <div style="display:flex; gap:4px;">
                        ${r.transferredRef ? `<button class="btn sm" data-role="view-shipment-by-job" data-job="${escapeHTML(r.transferredRef)}"><i class="ti ti-box"></i> Job: ${escapeHTML(r.transferredRef)}</button>` : ''}
                        <button class="btn sm" data-role="go-to-chat" data-rid="${r.id}"><i class="ti ti-messages"></i> Chat</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (this.activeTab === "si") {
      const sis = requests.filter(r => r.requestType === "Shipping Instruction");
      return `
        <div style="animation: fadeIn 0.2s ease-out; display:flex; flex-direction:column; gap:16px;">
          <div class="filter-bar">
            <h3 style="font-size:14px; font-weight:700; color:var(--text-main); flex:1;">Submitted Shipping Instructions (SI)</h3>
            <button class="btn pr sm" id="new-si-btn"><i class="ti ti-plus"></i> Submit Shipping Instruction</button>
          </div>
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Linked Job #</th>
                  <th>Shipper</th>
                  <th>Consignee</th>
                  <th>Container / Seal</th>
                  <th>HS Code</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${sis.length === 0 ? `<tr><td colspan="7"><div class="empty-state">No Shipping Instructions submitted yet.</div></td></tr>` :
                sis.map(r => `
                  <tr>
                    <td>${fmtDate(r.createdAt)}</td>
                    <td style="font-weight:600; color:var(--primary);">${r.details?.bookingNo || '—'}</td>
                    <td>${r.details?.shipper || '—'}</td>
                    <td>${r.details?.consignee || '—'}</td>
                    <td>${r.details?.containerNo || '—'} / ${r.details?.sealNo || '—'}</td>
                    <td>${r.details?.hsCode || '—'}</td>
                    <td>${statusBadge(r.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (this.activeTab === "corrections") {
      const corrections = requests.filter(r => r.requestType === "BL Correction");
      return `
        <div style="animation: fadeIn 0.2s ease-out; display:flex; flex-direction:column; gap:16px;">
          <div class="filter-bar">
            <h3 style="font-size:14px; font-weight:700; color:var(--text-main); flex:1;">B/L Draft Correction Requests (HBL Only)</h3>
            <button class="btn pr sm" id="new-correction-btn"><i class="ti ti-plus"></i> Request B/L Correction</button>
          </div>
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Job Reference</th>
                  <th>Correction Field</th>
                  <th>Original Text</th>
                  <th>Corrected Text</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${corrections.length === 0 ? `<tr><td colspan="6"><div class="empty-state">No draft correction requests submitted yet.</div></td></tr>` :
                corrections.map(r => `
                  <tr>
                    <td>${fmtDate(r.createdAt)}</td>
                    <td style="font-weight:600; color:var(--primary);">${r.details?.bookingNo || '—'}</td>
                    <td style="font-weight:600;">${r.details?.correctionField || '—'}</td>
                    <td style="color:var(--danger); text-decoration:line-through; font-size:11.5px;">${r.details?.originalText || '—'}</td>
                    <td style="color:var(--success); font-weight:600; font-size:11.5px;">${r.details?.correctedText || '—'}</td>
                    <td>${statusBadge(r.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (this.activeTab === "invoices") {
      return `
        <div style="animation: fadeIn 0.2s ease-out; display:flex; flex-direction:column; gap:16px;">
          <h3 style="font-size:14px; font-weight:700; color:var(--text-main);">Your Invoices &amp; Bills</h3>
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Job #</th>
                  <th>Invoice Date</th>
                  <th>Due Date</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.length === 0 ? `<tr><td colspan="7"><div class="empty-state">No invoices recorded for your account.</div></td></tr>` :
                invoices.map(i => `
                  <tr>
                    <td style="font-weight:600; color:var(--primary);">${i.invNo}</td>
                    <td>${i.jobNo || '—'}</td>
                    <td>${fmtDate(i.invoiceDate)}</td>
                    <td>${fmtDate(i.dueDate)}</td>
                    <td style="font-weight:600;">${fmtAmt(i.total, i.currency)}</td>
                    <td>${statusBadge(i.status)}</td>
                    <td>
                      <button class="btn sm" data-role="view-inv" data-iid="${i.id}"><i class="ti ti-printer"></i> View &amp; Print</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (this.activeTab === "quotations") {
      return `
        <div style="animation: fadeIn 0.2s ease-out; display:flex; flex-direction:column; gap:16px;">
          <h3 style="font-size:14px; font-weight:700; color:var(--text-main);">Quotations &rarr; Rates Offered</h3>
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Quotation #</th>
                  <th>Date</th>
                  <th>Origin &rarr; Destination</th>
                  <th>HS Commodity</th>
                  <th>Validity</th>
                  <th>Status</th>
                  <th>Offered Cost</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${quotations.length === 0 ? `<tr><td colspan="8"><div class="empty-state">No quotations issued for your company yet.</div></td></tr>` :
                quotations.map(q => {
                  let statusText = q.status;
                  if (q.status === 'Draft' || q.status === 'Sent') statusText = 'Recd.';
                  else if (q.status === 'Accepted') statusText = 'Finalise';
                  
                  return `
                    <tr>
                      <td style="font-weight:600; color:var(--primary);">${q.quoteNo}</td>
                      <td>${fmtDate(q.date)}</td>
                      <td style="font-weight:600;">${q.origin} &rarr; ${q.destination}</td>
                      <td>${q.commodity || '—'}</td>
                      <td>${fmtDate(q.validity)}</td>
                      <td>${statusBadge(statusText)}</td>
                      <td style="font-weight:600;">${fmtAmt(q.total)}</td>
                      <td>
                        <div style="display:flex; gap:6px; justify-content:flex-end;">
                          <button class="btn sm" data-role="view-quote" data-qid="${q.id}"><i class="ti ti-printer"></i> Print</button>
                          ${statusText === 'Updated' ? `<button class="btn sm success" data-role="finalize-quote" data-qid="${q.id}"><i class="ti ti-circle-check"></i> Approve &amp; Finalize</button>` : ''}
                          ${statusText === 'Finalise' ? `<button class="btn sm pr" data-role="book-from-quote" data-qid="${q.id}"><i class="ti ti-ship"></i> Book Now</button>` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (this.activeTab === "receipts") {
      return `
        <div style="animation: fadeIn 0.2s ease-out; display:flex; flex-direction:column; gap:16px;">
          <h3 style="font-size:14px; font-weight:700; color:var(--text-main);">Payment Receipts</h3>
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Date</th>
                  <th>Linked Invoice</th>
                  <th>Payment Mode</th>
                  <th>Ref Number</th>
                  <th>Amount Settled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${receipts.length === 0 ? `<tr><td colspan="7"><div class="empty-state">No payment receipts issued yet.</div></td></tr>` :
                receipts.map(r => `
                  <tr>
                    <td style="font-weight:600; color:var(--primary);">${r.receiptNo}</td>
                    <td>${fmtDate(r.receiptDate)}</td>
                    <td style="font-weight:600;">${r.invNo}</td>
                    <td>${r.paymentMode || 'NEFT'}</td>
                    <td>${r.refNo || '—'}</td>
                    <td style="font-weight:600; color:var(--success);">${fmtAmt(r.amount)}</td>
                    <td>
                      <button class="btn sm" data-role="view-receipt" data-rid="${r.id}"><i class="ti ti-printer"></i> View &amp; Print</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (this.activeTab === "chat") {
      const selectedReq = requests.find(r => r.id === this.selectedRequestId);
      return `
        <div style="animation: fadeIn 0.2s ease-out; display:grid; grid-template-columns: 1fr 1.5fr; gap:20px; height: calc(100vh - 128px); align-items: stretch;">
          
          <!-- Requests list for selector -->
          <div class="card" style="margin-bottom:0; display:flex; flex-direction:column; gap:10px; overflow-y:auto;">
            <div style="font-size:11px; font-weight:600; text-transform:uppercase; color:var(--text-muted); padding-bottom:6px; border-bottom:1px solid var(--border);">Select Inquiry Reference</div>
            
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${requests.length === 0 ? `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:20px 0;">No inquiries submitted yet.</div>` :
              requests.map(r => {
                const isSel = r.id === this.selectedRequestId;
                return `
                  <div class="chat-list-item" data-rid="${r.id}" style="
                    padding:10px; border:1px solid ${isSel ? 'var(--primary)' : 'var(--border)'};
                    background:${isSel ? 'var(--primary-light)' : 'var(--bg-card)'};
                    border-radius:var(--radius-md); cursor:pointer; transition:var(--transition);
                  ">
                    <div style="font-weight:600; font-size:12px; color:var(--text-main);">${r.requestType}</div>
                    <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">Submitted: ${fmtDate(r.createdAt)}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
                      ${statusBadge(r.status)}
                      <span style="font-size:10px; font-weight:600; color:var(--primary);">${r.transferredRef || ''}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Chat messages area -->
          <div class="card" style="margin-bottom:0; display:flex; flex-direction:column; gap:16px;">
            ${selectedReq ? `
              <div style="border-bottom:1px solid var(--border); padding-bottom:8px;">
                <h4 style="font-size:13px; font-weight:700; color:var(--text-main);">${selectedReq.requestType} Chat Feed</h4>
                <span style="font-size:10px; color:var(--text-muted);">Assigned Handler: <strong>${handler.name}</strong></span>
              </div>

              <!-- Message Stream -->
              <div id="cust-chat-stream" style="flex:1; overflow-y:auto; border:1px solid var(--border); border-radius:var(--radius-md); padding:12px; display:flex; flex-direction:column; gap:8px; background:var(--bg-hover);">
                ${(selectedReq.chat || []).length === 0 ? `<div style="margin:auto; font-size:12px; color:var(--text-muted);">No messages yet. Send a note below to start chatting.</div>` :
                selectedReq.chat.map(m => {
                  const isCust = m.sender === 'customer';
                  return `
                    <div style="display:flex; flex-direction:column; align-items:${isCust ? 'flex-end' : 'flex-start'};">
                      <div style="
                        max-width:80%; padding:6px 12px; font-size:12px; border-radius:var(--radius-md);
                        background:${isCust ? 'var(--primary)' : 'var(--bg-card)'};
                        color:${isCust ? '#fff' : 'var(--text-main)'};
                        border:${isCust ? 'none' : '1px solid var(--border)'};
                      ">${escapeHTML(m.text)}</div>
                      <span style="font-size:9px; color:var(--text-muted); margin-top:2px;">${escapeHTML(m.time || '')}</span>
                    </div>
                  `;
                }).join('')}
              </div>

              <!-- Reply Box -->
              <div style="display:flex; gap:8px;">
                <input class="search-input" id="cust-chat-input" placeholder="Type message to handler..." style="flex:1; font-size:12.5px;"/>
                <button class="btn pr" id="cust-chat-send-btn"><i class="ti ti-send"></i> Send</button>
              </div>
            ` : `
              <div style="margin:auto; text-align:center; color:var(--text-muted);">
                <i class="ti ti-messages" style="font-size:32px; opacity:0.4; display:block; margin-bottom:8px;"></i>
                Select an inquiry from the left panel to begin remarks / chat
              </div>
            `}
          </div>

        </div>
      `;
    }
  }

  setupSidebarEvents(element, requests, invoices, quotations, receipts, handler) {
    // Navigation change clicks
    element.querySelectorAll("[data-nav]").forEach(item => {
      item.onclick = () => {
        this.activeTab = item.dataset.nav;
        if (this.activeTab !== "chat") this.selectedRequestId = null;
        
        // Render top title
        const titles = {
          dashboard: "Dashboard Overview",
          shipments: "My Shipments Tracking",
          containers: "Container Details &amp; Tracking",
          tasks: "Operations Milestones &amp; Tasks",
          rates: "Rate Quotation Requests",
          bookings: "Booking Requests Log",
          si: "Submitted Shipping Instructions (SI)",
          corrections: "B/L Draft Correction Requests (HBL)",
          invoices: "Your Invoices &amp; Bills",
          quotations: "Quotations &rarr; Rates Offered",
          receipts: "Payment Receipts",
          chat: "Remarks &amp; Live Support"
        };
        const titleEl = element.querySelector("#cust-portal-title");
        if (titleEl) titleEl.innerHTML = titles[this.activeTab];

        // Active link toggle
        element.querySelectorAll("[data-nav]").forEach(i => i.classList.remove("on"));
        item.classList.add("on");

        // Reload views
        this.reloadContent(element, requests, invoices, quotations, receipts, handler);
      };
    });

    // Logout button click
    const logoutBtn = element.querySelector("#cust-logout-btn");
    if (logoutBtn) logoutBtn.onclick = () => this.onLogout();

    this.setupTabSpecificHandlers(element, requests, invoices, quotations, receipts, handler);
  }

  reloadContent(element, requests, invoices, quotations, receipts, handler) {
    const mount = element.querySelector("#cust-content-mount");
    if (mount) {
      mount.innerHTML = this.renderActiveTab(requests, invoices, quotations, receipts, handler);
      
      // Auto-scroll chat box
      if (this.activeTab === "chat" && this.selectedRequestId) {
        const stream = document.getElementById("cust-chat-stream");
        if (stream) stream.scrollTop = stream.scrollHeight;
      }
      
      this.setupTabSpecificHandlers(element, requests, invoices, quotations, receipts, handler);
    }
  }

  setupTabSpecificHandlers(element, requests, invoices, quotations, receipts, handler) {
    // 1. Submit Rate Request Form
    const newRateBtn = element.querySelector("#new-rate-req-btn");
    if (newRateBtn) {
      newRateBtn.onclick = () => this.openRateRequestModal(element, requests, invoices, quotations, receipts, handler);
    }

    // 2. Submit Booking Request Form
    const newBookingBtn = element.querySelector("#new-booking-req-btn");
    if (newBookingBtn) {
      newBookingBtn.onclick = () => this.openBookingRequestModal(element, requests, invoices, quotations, receipts, handler);
    }

    // 3. Submit Shipping Instruction Form
    const newSIBtn = element.querySelector("#new-si-btn");
    if (newSIBtn) {
      newSIBtn.onclick = () => this.openSIModal(element, requests, invoices, quotations, receipts, handler);
    }

    // 4. Submit BL Corrections Form
    const newCorrBtn = element.querySelector("#new-correction-btn");
    if (newCorrBtn) {
      newCorrBtn.onclick = () => this.openBLCorrectionModal(element, requests, invoices, quotations, receipts, handler);
    }

    // 5. Invoices Detailed view & print
    element.querySelectorAll("[data-role=view-inv]").forEach(btn => {
      btn.onclick = () => {
        const iid = btn.dataset.iid;
        const inv = invoices.find(x => x.id === iid);
        if (inv) this.openDetailedInvoicePreview(inv);
      };
    });

    // 6. Quotations Detailed view & print
    element.querySelectorAll("[data-role=view-quote]").forEach(btn => {
      btn.onclick = () => {
        const qid = btn.dataset.qid;
        const quote = quotations.find(x => x.id === qid);
        if (quote) this.openDetailedQuotationPreview(quote);
      };
    });

    // Finalize Quote
    element.querySelectorAll("[data-role=finalize-quote]").forEach(btn => {
      btn.onclick = () => {
        const qid = btn.dataset.qid;
        this.finalizeQuote(qid, element, requests, invoices, quotations, receipts, handler);
      };
    });

    // Book from Quote
    element.querySelectorAll("[data-role=book-from-quote]").forEach(btn => {
      btn.onclick = () => {
        const qid = btn.dataset.qid;
        const quote = quotations.find(x => x.id === qid);
        if (quote) this.openBookingRequestModal(element, requests, invoices, quotations, receipts, handler, quote);
      };
    });

    // 7. Receipts Detailed view & print
    element.querySelectorAll("[data-role=view-receipt]").forEach(btn => {
      btn.onclick = () => {
        const rid = btn.dataset.rid;
        const receipt = receipts.find(x => x.id === rid);
        if (receipt) this.openDetailedReceiptPreview(receipt);
      };
    });

    // 9. View Shipment Details Modal
    element.querySelectorAll("[data-role=view-shipment-detail]").forEach(btn => {
      btn.onclick = () => {
        const sid = btn.dataset.sid;
        const s = this.myShipments.find(x => x.id === sid);
        if (s) this.openDetailedShipmentModal(s);
      };
    });

    // 10. Direct link to chat tab
    element.querySelectorAll("[data-role=go-to-chat]").forEach(btn => {
      btn.onclick = () => {
        this.selectedRequestId = btn.dataset.rid;
        this.activeTab = "chat";
        element.querySelectorAll("[data-nav]").forEach(i => {
          if (i.dataset.nav === "chat") i.classList.add("on");
          else i.classList.remove("on");
        });
        const titleEl = element.querySelector("#cust-portal-title");
        if (titleEl) titleEl.innerHTML = "Remarks &amp; Live Support";
        this.reloadContent(element, requests, invoices, quotations, receipts, handler);
      };
    });

    // 11. Direct link to quotation modal by quoteNo
    element.querySelectorAll("[data-role=view-quote-by-no]").forEach(btn => {
      btn.onclick = () => {
        const qno = btn.dataset.qno;
        if (!qno || qno === '—') return;
        const quote = quotations.find(x => x.quoteNo === qno);
        if (quote) this.openDetailedQuotationPreview(quote);
        else showToast(`Quotation details for ${qno} not found.`, "warning");
      };
    });

    // 12. Direct link to shipment details by jobNo
    element.querySelectorAll("[data-role=view-shipment-by-job]").forEach(btn => {
      btn.onclick = () => {
        const job = btn.dataset.job;
        if (!job || job === '—') return;
        const s = this.myShipments.find(x => x.jobNo === job);
        if (s) this.openDetailedShipmentModal(s);
        else showToast(`Shipment details for ${job} not found.`, "warning");
      };
    });

    // 8. Chat selection and sending
    if (this.activeTab === "chat") {
      element.querySelectorAll(".chat-list-item").forEach(item => {
        item.onclick = () => {
          this.selectedRequestId = item.dataset.rid;
          this.reloadContent(element, requests, invoices, quotations, receipts, handler);
        };
      });

      const chatInput = element.querySelector("#cust-chat-input");
      const chatSend = element.querySelector("#cust-chat-send-btn");

      const sendCustMsg = async () => {
        const text = chatInput.value.trim();
        if (!text) return;

        const activeReq = requests.find(r => r.id === this.selectedRequestId);
        if (activeReq) {
          if (!activeReq.chat) activeReq.chat = [];
          activeReq.chat.push({
            sender: 'customer',
            text: text,
            time: new Date().toLocaleString()
          });

          await saveDocument("customerRequests", activeReq, activeReq.id);
          chatInput.value = "";
          this.reloadContent(element, requests, invoices, quotations, receipts, handler);
        }
      };

      if (chatSend) chatSend.onclick = sendCustMsg;
      if (chatInput) {
        chatInput.onkeypress = (e) => {
          if (e.key === "Enter") sendCustMsg();
        };
      }
    }
  }

  openRateRequestModal(element, requests, invoices, quotations, receipts, handler) {
    const mc = document.getElementById("modal-container");
    if (!mc) return;

    mc.innerHTML = `
      <div class="modal-bg" id="cust-modal">
        <div class="modal" style="width: 480px;">
          <div class="modal-title">New Rate Inquiry <button class="btn sm" id="modal-close"><i class="ti ti-x"></i></button></div>
          <form id="rate-req-form" onsubmit="event.preventDefault()">
            <div class="form-row">
              <div class="fg"><label>Origin Port *</label><input id="r-origin" required placeholder="e.g. Nhava Sheva (INNSA)"/></div>
              <div class="fg"><label>Destination Port *</label><input id="r-dest" required placeholder="e.g. Rotterdam (NLRTM)"/></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Cargo Weight (kg) *</label><input id="r-weight" type="number" required placeholder="14000"/></div>
              <div class="fg"><label>Cargo Volume (CBM) *</label><input id="r-volume" type="number" required placeholder="45"/></div>
            </div>
            <div class="form-row">
              <div class="fg">
                <label>Container Size / Type *</label>
                <select id="r-containertype">
                  <option>20GP</option>
                  <option selected>40HC</option>
                  <option>LCL / Loose Cargo</option>
                  <option>Air Freight Pallet</option>
                </select>
              </div>
              <div class="fg"><label>Cargo Ready Date *</label><input id="r-readydate" type="date" required value="${new Date().toISOString().split('T')[0]}"/></div>
            </div>
            <div class="fg" style="margin-bottom:12px;">
              <label>HS Commodity Description *</label>
              <input id="r-commodity" required placeholder="e.g. Auto Spare Parts"/>
            </div>
            <div class="fg" style="margin-bottom:16px;">
              <label>Specific Instructions / Target Rate</label>
              <textarea id="r-remarks" placeholder="Any specific requirements..."></textarea>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button class="btn" type="button" id="modal-cancel">Cancel</button>
              <button class="btn pr" type="submit"><i class="ti ti-send"></i> Submit Inquiry</button>
            </div>
          </form>
        </div>
      </div>
    `;

    setTimeout(() => {
      document.getElementById("modal-close").onclick = () => { mc.innerHTML = ''; };
      document.getElementById("modal-cancel").onclick = () => { mc.innerHTML = ''; };
      
      const form = document.getElementById("rate-req-form");
      form.onsubmit = async (e) => {
        e.preventDefault();
        const fv = (id) => document.getElementById(id)?.value || '';

        const newReq = {
          customerId: this.customerUserId,
          customerName: this.companyName,
          requestType: "Rate Request",
          status: "Pending",
          createdAt: new Date().toISOString().split('T')[0],
          details: {
            origin: fv('r-origin'),
            destination: fv('r-dest'),
            weight: +fv('r-weight'),
            volume: +fv('r-volume'),
            containerType: fv('r-containertype'),
            readyDate: fv('r-readydate'),
            commodity: fv('r-commodity'),
            remarks: fv('r-remarks')
          },
          chat: []
        };

        const saved = await saveDocument("customerRequests", newReq);
        requests.unshift(saved);
        
        // Notify ERP
        await saveDocument("notifications", {
          msg: `New Rate Inquiry submitted by "${this.companyName}"`,
          read: false,
          ts: new Date().toLocaleString(),
          type: "info"
        });

        showToast("Rate inquiry submitted successfully!", "success");
        mc.innerHTML = '';
        this.reloadContent(element, requests, invoices, quotations, receipts, handler);
      };
    }, 50);
  }

  openBookingRequestModal(element, requests, invoices, quotations, receipts, handler, quoteObj = null) {
    const mc = document.getElementById("modal-container");
    if (!mc) return;

    mc.innerHTML = `
      <div class="modal-bg" id="cust-modal">
        <div class="modal" style="width: 540px; max-height:90vh; overflow-y:auto;">
          <div class="modal-title">New Cargo Booking Request <button class="btn sm" id="modal-close"><i class="ti ti-x"></i></button></div>
          <form id="book-req-form" onsubmit="event.preventDefault()">
            <div class="form-row">
              <div class="fg"><label>POL (Origin) *</label><input id="b-origin" required value="${quoteObj ? escapeHTML(quoteObj.origin || '') : ''}" placeholder="e.g. Nhava Sheva (INNSA)"/></div>
              <div class="fg"><label>POD (Destination) *</label><input id="b-dest" required value="${quoteObj ? escapeHTML(quoteObj.destination || '') : ''}" placeholder="e.g. Rotterdam (NLRTM)"/></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Shipper Details *</label><input id="b-shipper" required value="${escapeHTML(this.companyName)}"/></div>
              <div class="fg"><label>Consignee Details *</label><input id="b-consignee" required placeholder="Consignee Name &amp; Address"/></div>
            </div>
            <div class="fg" style="margin-bottom:12px;">
              <label>Notify Party details *</label>
              <textarea id="b-notify" required placeholder="Notify Party Name, Address, and Contact Details..." style="height:48px;"></textarea>
            </div>
            <div class="form-row">
              <div class="fg"><label>Gross Weight (kg) *</label><input id="b-weight" type="number" required value="${quoteObj ? quoteObj.grossWeight || '' : ''}" placeholder="14000"/></div>
              <div class="fg"><label>Volume (CBM) *</label><input id="b-volume" type="number" required value="${quoteObj ? quoteObj.volume || '' : ''}" placeholder="50"/></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Packages Count *</label><input id="b-packages" type="number" required value="${quoteObj ? quoteObj.packages || '' : ''}" placeholder="400"/></div>
              <div class="fg"><label>Package Type *</label>
                <select id="b-packagetype">
                  <option selected>Cartons</option>
                  <option>Pallets</option>
                  <option>Boxes</option>
                  <option>Drums</option>
                  <option>Wooden Crates</option>
                  <option>Loose Cargo (Bulk)</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="fg">
                <label>Container Size / Type *</label>
                <select id="b-containertype">
                  <option>20GP</option>
                  <option selected>40HC</option>
                  <option>LCL Loose</option>
                  <option>Air Freight Pallet</option>
                </select>
              </div>
              <div class="fg"><label>Container Quantity *</label><input id="b-containerqty" type="number" required value="1" min="1"/></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Cargo Ready Date *</label><input id="b-readydate" type="date" required value="${new Date(Date.now() + 2*24*60*60*1000).toISOString().split('T')[0]}"/></div>
              <div class="fg"><label>Preferred ETD *</label><input id="b-etd" type="date" required value="${new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0]}"/></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>HS Code *</label><input id="b-hscode" required value="${quoteObj ? escapeHTML(quoteObj.hsCode || '') : ''}" placeholder="e.g. 87082990" maxlength="8"/></div>
              <div class="fg">
                <label>Incoterm *</label>
                <select id="b-incoterm">
                  <option selected>FOB</option>
                  <option>CIF</option>
                  <option>EXW</option>
                  <option>DDP</option>
                  <option>CFR</option>
                </select>
              </div>
            </div>
            <div class="form-row" style="margin-bottom:12px;">
              <div class="fg">
                <label>Is Hazardous Cargo? *</label>
                <select id="b-hazardous">
                  <option selected value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
            </div>
            <div class="form-row" id="haz-cargo-inputs" style="display:none; margin-bottom:12px;">
              <div class="fg"><label>IMDG Class</label><input id="b-imdg" placeholder="e.g. 3"/></div>
              <div class="fg"><label>UN Number</label><input id="b-unnumber" placeholder="e.g. 1230"/></div>
            </div>
            <div class="fg" style="margin-bottom:16px;">
              <label>Carrier / Routing Preference &amp; Remarks</label>
              <textarea id="b-remarks" placeholder="e.g. Prefer MSC direct vessel...">${quoteObj ? 'Booked from Quote Ref: ' + escapeHTML(quoteObj.quoteNo) : ''}</textarea>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button class="btn" type="button" id="modal-cancel">Cancel</button>
              <button class="btn pr" type="submit"><i class="ti ti-ship"></i> Submit Booking</button>
            </div>
          </form>
        </div>
      </div>
    `;

    setTimeout(() => {
      document.getElementById("modal-close").onclick = () => { mc.innerHTML = ''; };
      document.getElementById("modal-cancel").onclick = () => { mc.innerHTML = ''; };

      const hazSelect = document.getElementById("b-hazardous");
      if (hazSelect) {
        hazSelect.onchange = () => {
          document.getElementById("haz-cargo-inputs").style.display = hazSelect.value === 'Yes' ? 'flex' : 'none';
        };
      }
      
      const form = document.getElementById("book-req-form");
      form.onsubmit = async (e) => {
        e.preventDefault();
        const fv = (id) => document.getElementById(id)?.value || '';

        const newReq = {
          customerId: this.customerUserId,
          customerName: this.companyName,
          requestType: "Booking Request",
          status: "Pending",
          transferredRef: quoteObj ? quoteObj.quoteNo : "",
          createdAt: new Date().toISOString().split('T')[0],
          details: {
            origin: fv('b-origin'),
            destination: fv('b-dest'),
            shipper: fv('b-shipper'),
            consignee: fv('b-consignee'),
            notifyParty: fv('b-notify'),
            weight: +fv('b-weight'),
            volume: +fv('b-volume'),
            packagesCount: +fv('b-packages'),
            packageType: fv('b-packagetype'),
            containerType: fv('b-containertype'),
            containerQty: +fv('b-containerqty'),
            readyDate: fv('b-readydate'),
            etd: fv('b-etd'),
            hsCode: fv('b-hscode'),
            incoterm: fv('b-incoterm'),
            isHazardous: fv('b-hazardous') === 'Yes',
            imdgClass: fv('b-imdg'),
            unNumber: fv('b-unnumber'),
            remarks: fv('b-remarks')
          },
          chat: []
        };

        const saved = await saveDocument("customerRequests", newReq);
        requests.unshift(saved);

        // Notify ERP
        await saveDocument("notifications", {
          msg: `New Booking Request submitted by "${this.companyName}"`,
          read: false,
          ts: new Date().toLocaleString(),
          type: "warning"
        });

        showToast("Booking request submitted successfully!", "success");
        mc.innerHTML = '';
        this.reloadContent(element, requests, invoices, quotations, receipts, handler);
      };
    }, 50);
  }

  async openSIModal(element, requests, invoices, quotations, receipts, handler) {
    const mc = document.getElementById("modal-container");
    if (!mc) return;

    // Fetch active shipments for the dropdown list
    const shipments = await getCollection("shipments") || [];
    const myShips = shipments.filter(s => s.customer.toLowerCase() === this.companyName.toLowerCase() && s.status !== 'Closed');

    mc.innerHTML = `
      <div class="modal-bg" id="cust-modal">
        <div class="modal" style="width: 540px;">
          <div class="modal-title">Submit Shipping Instructions (SI) <button class="btn sm" id="modal-close"><i class="ti ti-x"></i></button></div>
          <form id="si-req-form" onsubmit="event.preventDefault()">
            <div class="fg" style="margin-bottom:12px;">
              <label>Link Booking / Job Number *</label>
              <select id="s-bookingNo" required>
                <option value="">— Select Active Job —</option>
                ${myShips.map(s => `<option value="${s.jobNo}">${s.jobNo} (${s.pol} &rarr; ${s.pod})</option>`).join('')}
              </select>
            </div>
            <div class="form-row">
              <div class="fg"><label>Shipper Name &amp; Full Address *</label><textarea id="s-shipper" required>${this.companyName}</textarea></div>
              <div class="fg"><label>Consignee Name &amp; Full Address *</label><textarea id="s-consignee" required></textarea></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Notify Party details</label><textarea id="s-notify"></textarea></div>
              <div class="fg"><label>Cargo / Goods Description *</label><textarea id="s-desc" required placeholder="Specify cargo packing details..."></textarea></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Container Number *</label><input id="s-container" required placeholder="MSCU1234567"/></div>
              <div class="fg"><label>Seal Number *</label><input id="s-seal" required placeholder="SL887722"/></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Marks &amp; Numbers</label><input id="s-marks" placeholder="As per invoice..."/></div>
              <div class="fg"><label>HS Code *</label><input id="s-hscode" required placeholder="e.g. 52081190"/></div>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
              <button class="btn" type="button" id="modal-cancel">Cancel</button>
              <button class="btn pr" type="submit"><i class="ti ti-check"></i> Submit Instructions</button>
            </div>
          </form>
        </div>
      </div>
    `;

    setTimeout(() => {
      document.getElementById("modal-close").onclick = () => { mc.innerHTML = ''; };
      document.getElementById("modal-cancel").onclick = () => { mc.innerHTML = ''; };
      
      const form = document.getElementById("si-req-form");
      form.onsubmit = async (e) => {
        e.preventDefault();
        const fv = (id) => document.getElementById(id)?.value || '';

        const newReq = {
          customerId: this.customerUserId,
          customerName: this.companyName,
          requestType: "Shipping Instruction",
          status: "Pending",
          createdAt: new Date().toISOString().split('T')[0],
          details: {
            bookingNo: fv('s-bookingNo'),
            shipper: fv('s-shipper'),
            consignee: fv('s-consignee'),
            notifyParty: fv('s-notify'),
            cargoDesc: fv('s-desc'),
            containerNo: fv('s-container'),
            sealNo: fv('s-seal'),
            marksNo: fv('s-marks'),
            hsCode: fv('s-hscode')
          },
          chat: []
        };

        if (!newReq.details.bookingNo) {
          showToast("Please link an active Job / Booking Number", "warning");
          return;
        }

        const saved = await saveDocument("customerRequests", newReq);
        requests.unshift(saved);

        // Notify ERP
        await saveDocument("notifications", {
          msg: `Shipping Instruction submitted by "${this.companyName}" for Job ${newReq.details.bookingNo}`,
          read: false,
          ts: new Date().toLocaleString(),
          type: "info"
        });

        showToast("Shipping Instructions submitted successfully!", "success");
        mc.innerHTML = '';
        this.reloadContent(element, requests, invoices, quotations, receipts, handler);
      };
    }, 50);
  }

  async openBLCorrectionModal(element, requests, invoices, quotations, receipts, handler) {
    const mc = document.getElementById("modal-container");
    if (!mc) return;

    // Fetch active shipments
    const shipments = await getCollection("shipments") || [];
    const myShips = shipments.filter(s => s.customer.toLowerCase() === this.companyName.toLowerCase() && s.status !== 'Closed');

    mc.innerHTML = `
      <div class="modal-bg" id="cust-modal">
        <div class="modal" style="width: 480px;">
          <div class="modal-title">Request B/L Draft Correction <button class="btn sm" id="modal-close"><i class="ti ti-x"></i></button></div>
          <form id="corr-req-form" onsubmit="event.preventDefault()">
            <div class="fg" style="margin-bottom:12px;">
              <label>Select House Bill of Lading (Job #) *</label>
              <select id="c-bookingNo" required>
                <option value="">— Select HBL Job —</option>
                ${myShips.map(s => `<option value="${s.jobNo}">${s.jobNo} (HBL Ref: ${s.blNo || 'Draft'})</option>`).join('')}
              </select>
            </div>
            <div class="fg" style="margin-bottom:12px;">
              <label>Correction Field / Section *</label>
              <select id="c-field" required>
                <option>Shipper Details</option>
                <option>Consignee Details</option>
                <option>Notify Party Details</option>
                <option>Cargo Description / Pkgs</option>
                <option>Container / Seal Numbers</option>
                <option>Other / General</option>
              </select>
            </div>
            <div class="fg" style="margin-bottom:12px;">
              <label>Original Text on Draft *</label>
              <textarea id="c-orig" required placeholder="Enter incorrect text currently shown on the draft HBL..."></textarea>
            </div>
            <div class="fg" style="margin-bottom:12px;">
              <label>Corrected Text Requested *</label>
              <textarea id="c-corr" required placeholder="Enter exact corrected text to print..."></textarea>
            </div>
            <div class="fg" style="margin-bottom:16px;">
              <label>Reason / Additional Remarks</label>
              <textarea id="c-remarks" placeholder="Specify reasons or guidelines..."></textarea>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button class="btn" type="button" id="modal-cancel">Cancel</button>
              <button class="btn pr" type="submit"><i class="ti ti-edit"></i> Submit Correction</button>
            </div>
          </form>
        </div>
      </div>
    `;

    setTimeout(() => {
      document.getElementById("modal-close").onclick = () => { mc.innerHTML = ''; };
      document.getElementById("modal-cancel").onclick = () => { mc.innerHTML = ''; };
      
      const form = document.getElementById("corr-req-form");
      form.onsubmit = async (e) => {
        e.preventDefault();
        const fv = (id) => document.getElementById(id)?.value || '';

        const newReq = {
          customerId: this.customerUserId,
          customerName: this.companyName,
          requestType: "BL Correction",
          status: "Pending",
          createdAt: new Date().toISOString().split('T')[0],
          details: {
            bookingNo: fv('c-bookingNo'),
            correctionField: fv('c-field'),
            originalText: fv('c-orig'),
            correctedText: fv('c-corr'),
            remarks: fv('c-remarks')
          },
          chat: []
        };

        if (!newReq.details.bookingNo) {
          showToast("Please link a valid Job / HBL", "warning");
          return;
        }

        const saved = await saveDocument("customerRequests", newReq);
        requests.unshift(saved);

        // Notify ERP
        await saveDocument("notifications", {
          msg: `BL Correction Request by "${this.companyName}" for Job ${newReq.details.bookingNo}`,
          read: false,
          ts: new Date().toLocaleString(),
          type: "warning"
        });

        showToast("Correction request submitted successfully!", "success");
        mc.innerHTML = '';
        this.reloadContent(element, requests, invoices, quotations, receipts, handler);
      };
    }, 50);
  }

  openDetailedInvoicePreview(inv) {
    const mc = document.getElementById("modal-container");
    if (!mc) return;

    mc.innerHTML = `
      <div class="modal-bg" onclick="if(event.target===this) this.remove();">
        <div class="modal" style="width: 540px;">
          <div class="modal-title">Tax Invoice Preview <button class="btn sm" onclick="document.getElementById('modal-container').innerHTML=''"><i class="ti ti-x"></i></button></div>
          <div style="border: 1px solid var(--border); padding: 18px; border-radius: var(--radius-md); background:#fff; color:#0f172a; font-family:var(--font-sans); margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #2563eb; padding-bottom:10px; margin-bottom:10px;">
              <div>
                <h2 style="font-size:16px; font-weight:800; color:#2563eb; margin:0;">TAX INVOICE</h2>
                <span style="font-size:10px; color:#64748b;">Invoice No: <strong>${inv.invNo}</strong></span>
              </div>
              <div style="text-align:right;">
                <h3 style="font-size:12px; font-weight:700; margin:0;">FreightOS Logistics</h3>
                <span style="font-size:9px; color:#64748b;">info@freightos.com</span>
              </div>
            </div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:11px; margin-bottom:12px;">
              <div>
                <span style="color:#64748b; font-weight:600; text-transform:uppercase; font-size:9px;">Billed To:</span>
                <div style="font-weight:700; margin-top:2px;">${inv.customer}</div>
                <div style="color:#475569; margin-top:2px;">Job Reference: ${inv.jobNo || '—'}</div>
              </div>
              <div style="text-align:right;">
                <span style="color:#64748b; font-weight:600; text-transform:uppercase; font-size:9px;">Dates:</span>
                <div>Invoice Date: <strong>${fmtDate(inv.invoiceDate)}</strong></div>
                <div>Payment Due: <strong style="color:#ef4444;">${fmtDate(inv.dueDate)}</strong></div>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom:12px;">
              <thead>
                <tr style="background:#f1f5f9; border-bottom:1px solid #cbd5e1;">
                  <th style="color:#475569; padding:6px; font-size:9.5px;">Line Item Particulars</th>
                  <th style="color:#475569; padding:6px; text-align:center; font-size:9.5px;">Qty</th>
                  <th style="color:#475569; padding:6px; text-align:right; font-size:9.5px;">Rate</th>
                  <th style="color:#475569; padding:6px; text-align:right; font-size:9.5px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${(inv.items || []).map(it => `
                  <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:6px; color:#0f172a; font-weight:500;">${it.desc || 'Services'}</td>
                    <td style="padding:6px; text-align:center; color:#475569;">${it.qty}</td>
                    <td style="padding:6px; text-align:right; color:#475569;">${fmtAmt(it.rate, inv.currency)}</td>
                    <td style="padding:6px; text-align:right; color:#0f172a; font-weight:600;">${fmtAmt(it.amount, inv.currency)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; font-size:11px;">
              <div>Subtotal: <strong>${fmtAmt(inv.subtotal, inv.currency)}</strong></div>
              <div>GST (${inv.gstRate || 0}%): <strong>${fmtAmt(inv.gstAmount, inv.currency)}</strong></div>
              <div style="font-size:13px; font-weight:800; color:#0f172a; border-top:1px solid #cbd5e1; padding-top:4px; margin-top:2px; width:100%; text-align:right;">
                Grand Total: <span style="color:#2563eb;">${fmtAmt(inv.total, inv.currency)}</span>
              </div>
            </div>
            
            <div style="font-size:9px; color:#94a3b8; margin-top:20px; font-style:italic; border-top:1px solid #e2e8f0; padding-top:6px; text-align:center;">
              Payment Status: <strong>${inv.status}</strong> · Thank you for your business!
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button class="btn" onclick="document.getElementById('modal-container').innerHTML=''">Close</button>
            <button class="btn pr" onclick="window.print()"><i class="ti ti-printer"></i> Print / Download</button>
          </div>
        </div>
      </div>
    `;
  }

  finalizeQuote(qid, element, requests, invoices, quotations, receipts, handler) {
    showConfirm('Approve and finalize this rate quotation?', async () => {
      const q = quotations.find(x => x.id === qid);
      if (q) {
        q.status = 'Accepted';
        await saveDocument("quotations", q, q.id);
        
        // Seed Audit Log
        await saveDocument("auditLog", {
          ts: new Date().toLocaleString(),
          user: this.companyName,
          action: "EDIT",
          module: "Quotations",
          record: `Quotation ${q.quoteNo} accepted by customer`,
          ip: "127.0.0.1"
        });
        
        // Seed Alert
        await saveDocument("notifications", {
          msg: `Quotation ${q.quoteNo} accepted by ${this.companyName}`,
          read: false,
          ts: new Date().toLocaleString(),
          type: "success"
        });
        
        showToast('Quotation finalized successfully', 'success');
        this.reloadContent(element, requests, invoices, quotations, receipts, handler);
      }
    });
  }

  openDetailedQuotationPreview(quote) {
    const mc = document.getElementById("modal-container");
    if (!mc) return;

    mc.innerHTML = `
      <div class="modal-bg" onclick="if(event.target===this) this.remove();">
        <div class="modal" style="width: 540px;">
          <div class="modal-title">Freight Quotation Preview <button class="btn sm" onclick="document.getElementById('modal-container').innerHTML=''"><i class="ti ti-x"></i></button></div>
          <div style="border: 1px solid var(--border); padding: 18px; border-radius: var(--radius-md); background:#fff; color:#0f172a; font-family:var(--font-sans); margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #8b5cf6; padding-bottom:10px; margin-bottom:10px;">
              <div>
                <h2 style="font-size:16px; font-weight:800; color:#8b5cf6; margin:0;">FREIGHT QUOTATION</h2>
                <span style="font-size:10px; color:#64748b;">Quote Reference: <strong>${quote.quoteNo}</strong></span>
              </div>
              <div style="text-align:right;">
                <h3 style="font-size:12px; font-weight:700; margin:0;">FreightOS Logistics</h3>
                <span style="font-size:9px; color:#64748b;">pricing@freightos.com</span>
              </div>
            </div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:11px; margin-bottom:12px;">
              <div>
                <span style="color:#64748b; font-weight:600; text-transform:uppercase; font-size:9px;">Offered To:</span>
                <div style="font-weight:700; margin-top:2px;">${quote.customer}</div>
                <div style="color:#475569; margin-top:2px;">Route: ${quote.origin} &rarr; ${quote.destination}</div>
              </div>
              <div style="text-align:right;">
                <span style="color:#64748b; font-weight:600; text-transform:uppercase; font-size:9px;">Details:</span>
                <div>Issue Date: <strong>${fmtDate(quote.date)}</strong></div>
                <div>Offered Cost: <strong>${fmtAmt(quote.total)}</strong></div>
                <div>Valid Until: <strong style="color:#eab308;">${fmtDate(quote.validity)}</strong></div>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom:12px;">
              <thead>
                <tr style="background:#f1f5f9; border-bottom:1px solid #cbd5e1;">
                  <th style="color:#475569; padding:6px; font-size:9.5px;">Charge Particulars</th>
                  <th style="color:#475569; padding:6px; text-align:center; font-size:9.5px;">Qty</th>
                  <th style="color:#475569; padding:6px; text-align:right; font-size:9.5px;">Rate</th>
                  <th style="color:#475569; padding:6px; text-align:right; font-size:9.5px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${(quote.items || []).map(it => `
                  <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:6px; color:#0f172a; font-weight:500;">${it.desc || 'Freight Carriage'}</td>
                    <td style="padding:6px; text-align:center; color:#475569;">${it.qty}</td>
                    <td style="padding:6px; text-align:right; color:#475569;">${fmtAmt(it.rate)}</td>
                    <td style="padding:6px; text-align:right; color:#0f172a; font-weight:600;">${fmtAmt(it.amount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; font-size:11px;">
              <div style="font-size:13px; font-weight:800; color:#0f172a; border-top:1px solid #cbd5e1; padding-top:4px; margin-top:2px; width:100%; text-align:right;">
                Net Cost: <span style="color:#8b5cf6;">${fmtAmt(quote.total)}</span>
              </div>
            </div>
            
            <div style="font-size:9px; color:#94a3b8; margin-top:20px; font-style:italic; border-top:1px solid #e2e8f0; padding-top:6px; text-align:center;">
              Subject to space availability at time of booking. Valid till expiry date.
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button class="btn" onclick="document.getElementById('modal-container').innerHTML=''">Close</button>
            <button class="btn pr" onclick="window.print()"><i class="ti ti-printer"></i> Print / Download</button>
          </div>
        </div>
      </div>
    `;
  }

  openDetailedReceiptPreview(receipt) {
    const mc = document.getElementById("modal-container");
    if (!mc) return;

    mc.innerHTML = `
      <div class="modal-bg" onclick="if(event.target===this) this.remove();">
        <div class="modal" style="width: 540px;">
          <div class="modal-title">Payment Receipt Preview <button class="btn sm" onclick="document.getElementById('modal-container').innerHTML=''"><i class="ti ti-x"></i></button></div>
          <div style="border: 1px solid var(--border); padding: 18px; border-radius: var(--radius-md); background:#fff; color:#0f172a; font-family:var(--font-sans); margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #10b981; padding-bottom:10px; margin-bottom:10px;">
              <div>
                <h2 style="font-size:16px; font-weight:800; color:#10b981; margin:0;">PAYMENT RECEIPT</h2>
                <span style="font-size:10px; color:#64748b;">Receipt Ref: <strong>${receipt.receiptNo}</strong></span>
              </div>
              <div style="text-align:right;">
                <h3 style="font-size:12px; font-weight:700; margin:0;">FreightOS Logistics</h3>
                <span style="font-size:9px; color:#64748b;">accounts@freightos.com</span>
              </div>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:10px; font-size:11px; margin-bottom:12px;">
              <div class="kv-row" style="border-bottom-color:#f1f5f9;"><span class="kv-key" style="color:#64748b;">Received From:</span><strong style="color:#0f172a;">${receipt.customer}</strong></div>
              <div class="kv-row" style="border-bottom-color:#f1f5f9;"><span class="kv-key" style="color:#64748b;">Payment Date:</span><strong style="color:#0f172a;">${fmtDate(receipt.receiptDate)}</strong></div>
              <div class="kv-row" style="border-bottom-color:#f1f5f9;"><span class="kv-key" style="color:#64748b;">Linked Bill / Invoice:</span><strong style="color:#2563eb;">${receipt.invNo}</strong></div>
              <div class="kv-row" style="border-bottom-color:#f1f5f9;"><span class="kv-key" style="color:#64748b;">Payment Method / Ref:</span><strong style="color:#0f172a;">${receipt.paymentMode || 'NEFT'} (${receipt.refNo || '—'})</strong></div>
              <div class="kv-row" style="border-bottom-color:#cbd5e1; padding-top:12px; border-top:1px solid #cbd5e1;"><span style="font-size:13px; font-weight:700; color:#0f172a;">Total Amount Settled:</span><strong style="font-size:14px; color:#10b981;">${fmtAmt(receipt.amount)}</strong></div>
            </div>
            
            <div style="font-size:9px; color:#94a3b8; margin-top:20px; font-style:italic; border-top:1px solid #e2e8f0; padding-top:6px; text-align:center;">
              Payment received &amp; logged. Thank you!
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button class="btn" onclick="document.getElementById('modal-container').innerHTML=''">Close</button>
            <button class="btn pr" onclick="window.print()"><i class="ti ti-printer"></i> Print / Download</button>
          </div>
        </div>
      </div>
    `;
  }

  openDetailedShipmentModal(s) {
    const mc = document.getElementById("modal-container");
    if (!mc) return;

    // Filter containers for this specific shipment
    const sContainers = (this.myContainers || []).filter(c => c.jobNo === s.jobNo);

    mc.innerHTML = `
      <div class="modal-bg" onclick="if(event.target===this) this.remove();">
        <div class="modal" style="width: 680px; max-height:85vh; display:flex; flex-direction:column; overflow:hidden;">
          <div class="modal-title" style="flex-shrink:0;">
            Shipment Job: ${escapeHTML(s.jobNo)}
            <button class="btn sm" onclick="document.getElementById('modal-container').innerHTML=''"><i class="ti ti-x"></i></button>
          </div>
          
          <div style="flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:20px;">
            <!-- Header Grid info -->
            <div class="grid3" style="gap:10px;">
              <div class="stat-card" style="padding:10px;">
                <div class="stat-lbl" style="font-size:9px;">Vessel / Voyage</div>
                <div class="stat-val" style="font-size:12px;">${escapeHTML(s.vessel || '—')} / ${escapeHTML(s.voyage || '—')}</div>
              </div>
              <div class="stat-card" style="padding:stat-card;">
                <div class="stat-lbl" style="font-size:9px;">ETD &rarr; ETA</div>
                <div class="stat-val" style="font-size:11px; margin-top:2px;">${fmtDate(s.etd)} &rarr; ${fmtDate(s.eta)}</div>
              </div>
              <div class="stat-card" style="padding:10px;">
                <div class="stat-lbl" style="font-size:9px;">Shipment Status</div>
                <div class="stat-val" style="font-size:11.5px; margin-top:2px;">${escapeHTML(s.status)}</div>
              </div>
            </div>

            <!-- Route & Specs card -->
            <div class="card" style="margin-bottom:0; padding:12px;">
              <h4 style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">Routing &amp; Cargo Specifications</h4>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:11.5px;">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <div class="kv-row"><span class="kv-key">Origin (POL):</span><strong>${escapeHTML(s.pol)}</strong></div>
                  <div class="kv-row"><span class="kv-key">Destination (POD):</span><strong>${escapeHTML(s.pod)}</strong></div>
                  <div class="kv-row"><span class="kv-key">Final Destination:</span><span>${escapeHTML(s.finalDest || s.pod)}</span></div>
                  <div class="kv-row"><span class="kv-key">Incoterm:</span><span>${escapeHTML(s.incoterm || 'FOB')}</span></div>
                  <div class="kv-row"><span class="kv-key">Cargo Ready Date:</span><span>${fmtDate(s.readyDate)}</span></div>
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <div class="kv-row"><span class="kv-key">Load Size / Type:</span><strong>${escapeHTML(s.containerDetails || '—')}</strong></div>
                  <div class="kv-row"><span class="kv-key">Gross Weight / Vol:</span><span>${(s.grossWeight || 0).toLocaleString()} kg / ${(s.volume || 0).toLocaleString()} CBM</span></div>
                  <div class="kv-row"><span class="kv-key">Cargo Packages:</span><span>${escapeHTML(s.packages || '—')}</span></div>
                  <div class="kv-row"><span class="kv-key">HS Code / Category:</span><span>${escapeHTML(s.commodity || '—')}</span></div>
                  <div class="kv-row"><span class="kv-key">Hazardous Cargo:</span><span>${s.isHazardous ? `<span class="badge b-red" style="font-size:10px;">HAZ (Class ${escapeHTML(s.imdgClass || '—')} / UN ${escapeHTML(s.unNumber || '—')})</span>` : `<span class="badge b-green" style="font-size:10px;">NON-HAZ</span>`}</span></div>
                </div>
              </div>
            </div>

            <!-- Parties Card -->
            <div class="card" style="margin-bottom:0; padding:12px;">
              <h4 style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">Shipment Parties</h4>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:11px; line-height:1.4;">
                <div>
                  <span style="font-size:9.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase;">Shipper Details:</span>
                  <div style="font-weight:600; margin-top:2px;">${escapeHTML(s.shipper || '—')}</div>
                </div>
                <div>
                  <span style="font-size:9.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase;">Consignee Details:</span>
                  <div style="font-weight:600; margin-top:2px;">${escapeHTML(s.consignee || '—')}</div>
                  <div style="font-size:9.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; margin-top:10px;">Notify Party:</div>
                  <div style="font-weight:600; margin-top:2px;">${escapeHTML(s.notifyParty || 'SAME AS CONSIGNEE')}</div>
                </div>
              </div>
            </div>

            <!-- Containers Sub-section -->
            ${sContainers.length > 0 ? `
              <div class="card" style="margin-bottom:0; padding:12px;">
                <h4 style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">Linked Containers (${sContainers.length})</h4>
                <div class="tbl-wrap" style="box-shadow:none; border-radius:0; border:none; margin:0;">
                  <table style="width:100%;">
                    <thead>
                      <tr>
                        <th>Container No</th>
                        <th>Size/Type</th>
                        <th>Seal No</th>
                        <th>Status</th>
                        <th>Free Time Expiry</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${sContainers.map(c => `
                        <tr>
                          <td style="font-weight:700;">${escapeHTML(c.containerNo)}</td>
                          <td>${escapeHTML(c.size)} ${escapeHTML(c.type || 'Dry')}</td>
                          <td>${escapeHTML(c.sealNo || '—')}</td>
                          <td>${escapeHTML(c.status)}</td>
                          <td>${fmtDate(c.freeTimeExpiry)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            ` : ''}

            <!-- Milestone Timeline Feed -->
            <div class="card" style="margin-bottom:0; padding:12px;">
              <h4 style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:12px;">Operational Milestones Feed</h4>
              <div style="display:flex; flex-direction:column; gap:12px; position:relative; padding-left:20px; border-left:2px solid var(--border); margin-left:6px;">
                ${(s.timeline || []).length === 0 ? `<div style="font-size:11.5px; color:var(--text-muted); font-style:italic;">No milestones logged yet.</div>` :
                s.timeline.map(t => `
                  <div style="position:relative;">
                    <div style="position:absolute; left:-26px; top:2px; width:10px; height:10px; border-radius:50%; background:var(--primary); border:2px solid var(--bg-card);"></div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <strong style="font-size:12px; color:var(--text-main);">${escapeHTML(t.event)}</strong>
                      <span style="font-size:10px; color:var(--text-muted);">${fmtDate(t.date)}</span>
                    </div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${escapeHTML(t.remarks || 'Status logged successfully')}</div>
                  </div>
                `).join('')}
              </div>
            </div>

          </div>
          <div class="modal-footer" style="flex-shrink:0;">
            <button class="btn" onclick="document.getElementById('modal-container').innerHTML=''">Close Details</button>
          </div>
        </div>
      </div>
    `;
  }
}

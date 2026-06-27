export class Sidebar {
  constructor(currentPanel, onNavChange) {
    this.currentPanel = currentPanel;
    this.onNavChange = onNavChange;
    this.collapsed = localStorage.getItem('sb-collapsed') === 'true';
  }

  render() {
    const sb = document.createElement("div");
    sb.className = `sb ${this.collapsed ? 'collapsed' : ''}`;
    sb.id = "app-sidebar";

    sb.innerHTML = `
      <div class="sb-logo" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <div style="display:flex; align-items:center; gap:12px; cursor:pointer;" id="sb-logo-click">
          <div class="sb-icon"><i class="ti ti-ship" aria-hidden="true"></i></div>
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text-main)">FreightOS</div>
            <div style="font-size:10px;color:var(--text-muted)">ERP Platform</div>
          </div>
        </div>
        <button class="btn sm" style="background:none; border:none; padding:4px; color:var(--text-muted); cursor:pointer;" id="sb-collapse-btn">
          <i class="ti ${this.collapsed ? 'ti-chevron-right' : 'ti-chevron-left'}" style="font-size:14px;"></i>
        </button>
      </div>
      <div class="sb-nav" id="sb-nav-items">
        <div class="sb-sec">Overview</div>
        <div class="ni ${this.currentPanel === 'dashboard' ? 'on' : ''}" data-p="dashboard"><i class="ti ti-layout-dashboard" aria-hidden="true"></i><span>Dashboard</span></div>
        
        <div class="sb-sec">Client Portal</div>
        <div class="ni ${this.currentPanel === 'compass' ? 'on' : ''}" data-p="compass"><i class="ti ti-compass" aria-hidden="true"></i><span>Compass Inquiries</span></div>
        
        <div class="sb-sec">Masters</div>
        <div class="ni ${this.currentPanel === 'customers' ? 'on' : ''}" data-p="customers"><i class="ti ti-building" aria-hidden="true"></i><span>Customers</span></div>
        <div class="ni ${this.currentPanel === 'vendors' ? 'on' : ''}" data-p="vendors"><i class="ti ti-truck" aria-hidden="true"></i><span>Vendors</span></div>
        <div class="ni ${this.currentPanel === 'ports' ? 'on' : ''}" data-p="ports"><i class="ti ti-anchor" aria-hidden="true"></i><span>Ports &amp; Airports</span></div>
        <div class="ni ${this.currentPanel === 'shippingLines' ? 'on' : ''}" data-p="shippingLines"><i class="ti ti-ship" aria-hidden="true"></i><span>Shipping Lines</span></div>
        <div class="ni ${this.currentPanel === 'commodities' ? 'on' : ''}" data-p="commodities"><i class="ti ti-package" aria-hidden="true"></i><span>Commodities</span></div>
        <div class="ni ${this.currentPanel === 'chargeHeads' ? 'on' : ''}" data-p="chargeHeads"><i class="ti ti-coin" aria-hidden="true"></i><span>Charge Heads</span></div>
        <div class="ni ${this.currentPanel === 'fr8x-cp' ? 'on' : ''}" data-p="fr8x-cp"><i class="ti ti-brand-openai" style="color: #a855f7;" aria-hidden="true"></i><span>FR8X-CP AI Portal</span></div>
        
        <div class="sb-sec">Operations</div>
        <div class="ni ${this.currentPanel === 'shipments' ? 'on' : ''}" data-p="shipments"><i class="ti ti-box" aria-hidden="true"></i><span>Shipments</span> <span class="nb" id="sb-ship-badge">0</span></div>
        <div class="ni ${this.currentPanel === 'containers' ? 'on' : ''}" data-p="containers"><i class="ti ti-container" aria-hidden="true"></i><span>Containers</span></div>
        <div class="ni ${this.currentPanel === 'timeline' ? 'on' : ''}" data-p="timeline"><i class="ti ti-timeline" aria-hidden="true"></i><span>Timeline</span></div>
        <div class="ni ${this.currentPanel === 'documents' ? 'on' : ''}" data-p="documents"><i class="ti ti-files" aria-hidden="true"></i><span>Documents</span></div>
        
        <div class="sb-sec">Finance</div>
        <div class="ni ${this.currentPanel === 'invoices' ? 'on' : ''}" data-p="invoices"><i class="ti ti-receipt" aria-hidden="true"></i><span>Invoices</span></div>
        <div class="ni ${this.currentPanel === 'expenses' ? 'on' : ''}" data-p="expenses"><i class="ti ti-report-money" aria-hidden="true"></i><span>Expenses</span></div>
        <div class="ni ${this.currentPanel === 'finance' ? 'on' : ''}" data-p="finance"><i class="ti ti-chart-pie" aria-hidden="true"></i><span>Profit &amp; Loss</span></div>
        
        <div class="sb-sec">Workspace</div>
        <div class="ni ${this.currentPanel === 'tasks' ? 'on' : ''}" data-p="tasks"><i class="ti ti-check" aria-hidden="true"></i><span>Tasks</span> <span class="nb" id="sb-task-badge">0</span></div>
        <div class="ni ${this.currentPanel === 'notifications' ? 'on' : ''}" data-p="notifications"><i class="ti ti-bell" aria-hidden="true"></i><span>Alerts</span> <span class="nb" id="sb-notif-badge">0</span></div>
        <div class="ni ${this.currentPanel === 'reports' ? 'on' : ''}" data-p="reports"><i class="ti ti-chart-bar" aria-hidden="true"></i><span>Reports</span></div>
        <div class="ni ${this.currentPanel === 'users' ? 'on' : ''}" data-p="users"><i class="ti ti-users" aria-hidden="true"></i><span>Users &amp; Roles</span></div>
        <div class="ni ${this.currentPanel === 'audit' ? 'on' : ''}" data-p="audit"><i class="ti ti-list-details" aria-hidden="true"></i><span>Audit Log</span></div>
        <div class="ni ${this.currentPanel === 'settings' ? 'on' : ''}" data-p="settings"><i class="ti ti-settings" aria-hidden="true"></i><span>Settings</span></div>
      </div>
    `;

    setTimeout(() => {
      // Sidebar Collapse event
      const collapseBtn = sb.querySelector("#sb-collapse-btn");
      if (collapseBtn) {
        collapseBtn.onclick = () => this.toggleCollapse(sb);
      }

      const logoClick = sb.querySelector("#sb-logo-click");
      if (logoClick) {
        logoClick.onclick = () => this.toggleCollapse(sb);
      }

      // Nav click events
      sb.querySelectorAll(".ni").forEach(item => {
        item.onclick = () => {
          const panel = item.dataset.p;
          this.currentPanel = panel;
          sb.querySelectorAll(".ni").forEach(i => i.classList.remove("on"));
          item.classList.add("on");
          this.onNavChange(panel);
        };
      });

      this.updateBadges();
    }, 50);

    return sb;
  }

  toggleCollapse(sbElement) {
    this.collapsed = !this.collapsed;
    localStorage.setItem('sb-collapsed', this.collapsed ? 'true' : 'false');
    sbElement.classList.toggle('collapsed', this.collapsed);

    const icon = sbElement.querySelector('#sb-collapse-btn i');
    if (icon) {
      icon.className = this.collapsed ? 'ti ti-chevron-right' : 'ti ti-chevron-left';
    }

    // Trigger window resize to adjust responsive charts
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300);
  }

  updateBadges() {
    import("../services/db.js").then(async (dbModule) => {
      try {
        const notifs = await dbModule.getCollection("notifications");
        const tasks = await dbModule.getCollection("tasks");
        const shipments = await dbModule.getCollection("shipments");

        const unreadNotifs = notifs.filter(n => !n.read).length;
        const openTasks = tasks.filter(t => t.status !== 'Done' && t.status !== 'Cancelled').length;
        const activeShipments = shipments.filter(s => s.status !== 'Closed' && s.status !== 'Cancelled').length;

        const notifBadge = document.getElementById("sb-notif-badge");
        const taskBadge = document.getElementById("sb-task-badge");
        const shipBadge = document.getElementById("sb-ship-badge");
        const topbarNotifBtn = document.getElementById("notif-count-btn");

        if (notifBadge) notifBadge.textContent = unreadNotifs;
        if (taskBadge) taskBadge.textContent = openTasks;
        if (shipBadge) shipBadge.textContent = activeShipments;
        if (topbarNotifBtn) topbarNotifBtn.textContent = unreadNotifs;
      } catch (e) {
        console.error("Failed to load badges inside Sidebar component:", e);
      }
    });
  }
}

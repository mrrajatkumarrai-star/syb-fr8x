import { getCollection, saveDocument } from "../services/db.js";
import { showToast } from "../services/ui.js";

export class Notifications {
  constructor(onRefreshNav) {
    this.onRefreshNav = onRefreshNav;
  }

  async render() {
    const list = await getCollection("notifications");
    
    // Sort notifications chronologically (most recent first)
    list.sort((a, b) => new Date(b.ts || '1970-01-01') - new Date(a.ts || '1970-01-01'));

    const unreadCount = list.filter(n => !n.read).length;

    const container = document.createElement("div");
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <span style="font-size:13px; font-weight:600; color:var(--text-muted);">${unreadCount} Unread Alerts</span>
        ${unreadCount > 0 ? `<button class="btn sm pr" id="notif-read-all-btn"><i class="ti ti-checks"></i> Mark All as Read</button>` : ''}
      </div>

      <div class="card" style="padding:0; overflow:hidden; border-radius:var(--radius-lg);">
        ${list.length === 0 ? `
          <div class="empty-state">
            <i class="ti ti-bell-off" aria-hidden="true"></i>
            No notifications logged yet.
          </div>
        ` : `
          <div style="display:flex; flex-direction:column;">
            ${list.map(n => `
              <div class="notif-item" data-nid="${n.id}" style="display:flex; align-items:start; gap:16px; padding:16px 20px; border-bottom:1px solid var(--border); transition:var(--transition); cursor:pointer;">
                <div class="ndot ${n.read ? 'r' : ''}" style="margin-top:6px;"></div>
                <div style="flex:1;">
                  <div style="font-size:13px; font-weight:500; color:${n.read ? 'var(--text-muted)' : 'var(--text-main)'}; line-height:1.4;">
                    ${n.msg}
                  </div>
                  <div style="font-size:11px; color:var(--text-muted); margin-top:4px; display:flex; align-items:center; gap:8px;">
                    <i class="ti ti-clock"></i> ${n.ts}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    setTimeout(() => {
      // Mark all read button
      const readAllBtn = container.querySelector("#notif-read-all-btn");
      if (readAllBtn) {
        readAllBtn.onclick = async () => {
          const allNotifications = await getCollection("notifications");
          for (const n of allNotifications) {
            if (!n.read) {
              await saveDocument("notifications", { ...n, read: true }, n.id);
            }
          }
          showToast("All notifications marked as read.", "success");
          this.onRefreshNav();
          this.refreshPanel(container);
        };
      }

      // Individual item click mark read
      container.querySelectorAll(".notif-item").forEach(item => {
        item.onclick = async () => {
          const nid = item.dataset.nid;
          const notif = list.find(n => n.id === nid);
          if (notif && !notif.read) {
            await saveDocument("notifications", { ...notif, read: true }, nid);
            this.onRefreshNav();
            this.refreshPanel(container);
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
}

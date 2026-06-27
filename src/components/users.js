import { getCollection, saveDocument, deleteDocument, hashPassword } from "../services/db.js";
import { statusBadge, showToast } from "../services/ui.js";

const ROLES = ['Super Admin', 'Operations', 'Documentation', 'Finance', 'Guest', 'fr8xflow'];

export class Users {
  constructor(onRefreshNav) {
    this.onRefreshNav = onRefreshNav;
    this.searchQuery = "";
  }

  async render() {
    const list = await getCollection("users");
    const currentUserRole = sessionStorage.getItem("erp_user_role") || "Guest";
    let data = list;

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter(u => (u.name + u.email + (u.role || '')).toLowerCase().includes(q));
    }

    const container = document.createElement("div");
    container.innerHTML = `
      <div class="filter-bar">
        <input class="search-input" id="user-search" placeholder="Search team members..." value="${this.searchQuery}"/>
        <button class="btn pr sm" id="user-add-btn"><i class="ti ti-plus" aria-hidden="true"></i> Add User</button>
      </div>

      <div class="tbl-wrap">
        <table id="tbl-users">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email Address</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `<tr><td colspan="5"><div class="empty-state">No users found.</div></td></tr>` :
            data.map(u => {
              const initials = u.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
              return `
                <tr>
                  <td>
                    <div style="display:flex; align-items:center; gap:12px;">
                      <div class="avatar" style="width:32px; height:32px; font-weight:600; display:flex; align-items:center; justify-content:center; border-radius:50%; background:var(--primary-light); color:var(--primary); font-size:12px;">
                        ${initials}
                      </div>
                      <span style="font-weight:600; color:var(--text-main);">${u.name}</span>
                    </div>
                  </td>
                  <td style="font-size:12px;">${u.email}</td>
                  <td>
                    <span class="badge ${u.role === 'Super Admin' ? 'b-purple' : u.role === 'Finance' ? 'b-green' : u.role === 'Operations' ? 'b-blue' : 'b-gray'}">
                      ${u.role || 'Guest'}
                    </span>
                  </td>
                  <td>
                    ${statusBadge(u.status || 'Active')}
                  </td>
                  <td>
                    <div class="row-actions">
                      ${u.status === 'Locked' && currentUserRole === 'Super Admin' ? `
                        <button class="btn sm success" data-act="unlock" data-uid="${u.id}" title="Unlock User"><i class="ti ti-lock-open"></i></button>
                      ` : ''}
                      <button class="btn sm" data-act="edit" data-uid="${u.id}"><i class="ti ti-edit"></i></button>
                      ${u.role !== 'Super Admin' ? `<button class="btn sm danger" data-act="delete" data-uid="${u.id}"><i class="ti ti-trash"></i></button>` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    setTimeout(() => {
      const search = container.querySelector("#user-search");
      if (search) {
        search.oninput = (e) => {
          this.searchQuery = e.target.value;
          this.refreshPanel(container);
        };
      }

      container.querySelector("#user-add-btn").onclick = () => this.openFormModal(null, container);

      // Actions buttons
      container.querySelectorAll("[data-act]").forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const act = btn.dataset.act;
          const uid = btn.dataset.uid;
          const userObj = list.find(u => u.id === uid);
          if (act === 'edit') {
            this.openFormModal(userObj, container);
          } else if (act === 'unlock') {
            if (currentUserRole !== 'Super Admin') {
              showToast("Only Super Admins can unlock accounts.", "error");
              return;
            }
            const { showConfirm, showToast } = await import("../services/ui.js");
            showConfirm(`Unlock user <strong>${userObj.name}</strong>?`, async () => {
              userObj.status = 'Active';
              userObj.loginAttempts = 0;
              await saveDocument("users", userObj, userObj.id);
              
              // Seed Audit Log
              await saveDocument("auditLog", {
                ts: new Date().toLocaleString(),
                user: sessionStorage.getItem("erp_user_name") || "Super Admin",
                action: "UNLOCK",
                module: "User Access",
                record: `Unlocked user profile of ${userObj.name}`,
                ip: "10.0.0." + Math.floor(Math.random() * 200 + 1)
              });
              
              showToast(`User "${userObj.name}" unlocked.`, "success");
              this.onRefreshNav();
              this.refreshPanel(container);
            });
          } else if (act === 'delete') {
            const { showConfirm, showToast } = await import("../services/ui.js");
            showConfirm(`Delete user <strong>${userObj.name}</strong>? This cannot be undone.`, async () => {
              await deleteDocument("users", uid);
              
              // Seed Audit Log
              await saveDocument("auditLog", {
                ts: new Date().toLocaleString(),
                user: "Super Admin",
                action: "DELETE",
                module: "User Access",
                record: `Deleted user profile of ${userObj.name} (${userObj.role || 'Guest'})`,
                ip: "10.0.0." + Math.floor(Math.random() * 200 + 1)
              });
              
              showToast(`User "${userObj.name}" deleted.`, "success");
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

  openFormModal(editData, container) {
    const modalWrap = document.getElementById("modal-container");
    if (!modalWrap) return;

    modalWrap.innerHTML = `
      <div class="modal-bg" id="user-form-modal">
        <div class="modal" style="width: 460px;">
          <div class="modal-title">${editData ? 'Edit User Details' : 'Add New Team Member'}<button class="btn sm" id="modal-close"><i class="ti ti-x"></i></button></div>
          <form id="user-form" onsubmit="event.preventDefault()">
            <div class="fg" style="margin-bottom:12px;">
              <label>Full Name *</label>
              <input id="f-name" value="${editData ? editData.name || '' : ''}" required placeholder="John Doe"/>
            </div>
            
            <div class="fg" style="margin-bottom:12px;">
              <label>Email Address *</label>
              <input id="f-email" type="email" value="${editData ? editData.email || '' : ''}" required placeholder="john@company.com"/>
            </div>

            <div class="form-row">
              <div class="fg">
                <label>System Role</label>
                <select id="f-role">
                  ${ROLES.map(r => `<option value="${r}" ${editData && editData.role === r ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
              </div>
              <div class="fg">
                <label>User Status</label>
                <select id="f-status">
                  <option value="Active" ${editData && editData.status === 'Active' ? 'selected' : ''}>Active</option>
                  <option value="Inactive" ${editData && editData.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
                  <option value="Locked" ${editData && editData.status === 'Locked' ? 'selected' : ''}>Locked</option>
                </select>
              </div>
            </div>

            <div class="fg" style="margin-bottom:16px;">
              <label>Login Password</label>
              <input id="f-password" type="password" placeholder="${editData ? 'Leave blank to preserve' : 'Enter login password'}" ${editData ? '' : 'required'}/>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button class="btn" type="button" id="form-cancel">Cancel</button>
              <button class="btn pr" type="submit"><i class="ti ti-check"></i> Save User</button>
            </div>
          </form>
        </div>
      </div>
    `;

    setTimeout(() => {
      document.getElementById("modal-close").onclick = () => { modalWrap.innerHTML = ''; };
      document.getElementById("form-cancel").onclick = () => { modalWrap.innerHTML = ''; };

      document.getElementById("user-form").onsubmit = async (e) => {
        e.preventDefault();
        const fv = (id) => document.getElementById(id)?.value || '';

        const d = {
          name: fv('f-name'),
          email: fv('f-email'),
          role: fv('f-role'),
          status: fv('f-status')
        };

        if (!d.name || !d.email) { showToast("Name and Email are required fields.", "warning"); return; }

        const passwordVal = fv('f-password');
        if (passwordVal) {
          d.password = await hashPassword(passwordVal);
        }

        if (d.status === 'Active') {
          d.loginAttempts = 0; // Reset attempts when set to Active
        }

        if (editData) {
          await saveDocument("users", { ...editData, ...d }, editData.id);
          showToast(`User "${d.name}" updated successfully.`, "success");
        } else {
          d.createdAt = new Date().toLocaleString();
          d.loginAttempts = 0;
          await saveDocument("users", d);
          showToast(`User "${d.name}" registered successfully.`, "success");
        }

        // Add audit log entry
        await saveDocument("auditLog", {
          ts: new Date().toLocaleString(),
          user: "Super Admin",
          action: editData ? "EDIT" : "CREATE",
          module: "User Access",
          record: `${editData ? 'Updated' : 'Registered'} profile of user ${d.name} (${d.role})`,
          ip: "10.0.0." + Math.floor(Math.random() * 200 + 1)
        });

        modalWrap.innerHTML = '';
        this.onRefreshNav();
        this.refreshPanel(container);
      };
    }, 50);
  }
}

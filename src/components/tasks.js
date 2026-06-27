import { getCollection, saveDocument, deleteDocument } from "../services/db.js";
import { fmtDate, statusBadge, showToast, showConfirm, makeSearchableSelect } from "../services/ui.js";

export class Tasks {
  constructor(onRefreshNav) {
    this.onRefreshNav = onRefreshNav;
    this.statusFilter = "All";
    this.priorityFilter = "All";
    this.assigneeFilter = "All";
    this.searchQuery = "";
  }

  async render() {
    const list = await getCollection("tasks");
    const shipments = await getCollection("shipments");
    
    // Get list of unique assignees
    const assignees = [...new Set(list.map(t => t.assignedTo).filter(Boolean))].sort();

    let data = list;

    // Filters
    if (this.statusFilter !== 'All') {
      data = data.filter(t => t.status === this.statusFilter);
    }
    if (this.priorityFilter !== 'All') {
      data = data.filter(t => t.priority === this.priorityFilter);
    }
    if (this.assigneeFilter !== 'All') {
      data = data.filter(t => t.assignedTo === this.assigneeFilter);
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter(t => (t.name + (t.description || '') + (t.jobNo || '') + (t.assignedTo || '')).toLowerCase().includes(q));
    }

    // Sort by priority (Urgent -> High -> Medium -> Low) and due date
    const priorityOrder = { 'Urgent': 1, 'High': 2, 'Medium': 3, 'Low': 4 };
    data.sort((a, b) => {
      const pA = priorityOrder[a.priority] || 99;
      const pB = priorityOrder[b.priority] || 99;
      if (pA !== pB) return pA - pB;
      return new Date(a.dueDate || '9999-12-31') - new Date(b.dueDate || '9999-12-31');
    });

    const total = list.length;
    const openCount = list.filter(t => t.status === 'Open').length;
    const inProgressCount = list.filter(t => t.status === 'In Progress').length;
    const urgentCount = list.filter(t => (t.priority === 'Urgent' || t.priority === 'High') && t.status !== 'Done' && t.status !== 'Cancelled').length;

    const container = document.createElement("div");
    container.innerHTML = `
      <div class="grid4" style="margin-bottom:20px">
        <div class="stat-card"><div class="stat-lbl">Total Tasks</div><div class="stat-val">${total}</div></div>
        <div class="stat-card"><div class="stat-lbl">Open Tasks</div><div class="stat-val" style="color:var(--primary)">${openCount}</div></div>
        <div class="stat-card"><div class="stat-lbl">In Progress</div><div class="stat-val" style="color:var(--warning)">${inProgressCount}</div></div>
        <div class="stat-card"><div class="stat-lbl">Urgent / High Priority</div><div class="stat-val" style="color:var(--danger)">${urgentCount}</div></div>
      </div>

      <div class="filter-bar">
        <input class="search-input" id="task-search" placeholder="Search tasks, descriptions, jobs..." value="${this.searchQuery}"/>
        
        <select class="search-input" id="task-status-filter" style="width:130px">
          <option value="All">All Statuses</option>
          <option value="Open" ${this.statusFilter === 'Open' ? 'selected' : ''}>Open</option>
          <option value="In Progress" ${this.statusFilter === 'In Progress' ? 'selected' : ''}>In Progress</option>
          <option value="Done" ${this.statusFilter === 'Done' ? 'selected' : ''}>Done</option>
          <option value="Cancelled" ${this.statusFilter === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>

        <select class="search-input" id="task-priority-filter" style="width:130px">
          <option value="All">All Priorities</option>
          <option value="Urgent" ${this.priorityFilter === 'Urgent' ? 'selected' : ''}>Urgent</option>
          <option value="High" ${this.priorityFilter === 'High' ? 'selected' : ''}>High</option>
          <option value="Medium" ${this.priorityFilter === 'Medium' ? 'selected' : ''}>Medium</option>
          <option value="Low" ${this.priorityFilter === 'Low' ? 'selected' : ''}>Low</option>
        </select>

        <select class="search-input" id="task-assignee-filter" style="width:150px">
          <option value="All">All Assignees</option>
          ${assignees.map(a => `<option value="${a}" ${this.assigneeFilter === a ? 'selected' : ''}>${a}</option>`).join('')}
        </select>

        <button class="btn pr sm" id="task-add-btn"><i class="ti ti-plus" aria-hidden="true"></i> Add Task</button>
      </div>

      <div class="tbl-wrap">
        <table id="tbl-tasks">
          <thead>
            <tr>
              <th style="width: 40px;"></th>
              <th>Task Details</th>
              <th>Job No</th>
              <th>Assigned To</th>
              <th>Due Date</th>
              <th>Priority</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `<tr><td colspan="8"><div class="empty-state"><i class="ti ti-check" aria-hidden="true"></i>No tasks match the filter criteria.</div></td></tr>` :
            data.map(t => {
              const isCompleted = t.status === 'Done';
              const isUrgent = t.priority === 'Urgent' || t.priority === 'High';
              return `
                <tr>
                  <td>
                    <input type="checkbox" class="task-checkbox" data-tid="${t.id}" ${isCompleted ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px;"/>
                  </td>
                  <td>
                    <div style="font-weight:600; text-decoration: ${isCompleted ? 'line-through' : 'none'}; color: ${isCompleted ? 'var(--text-muted)' : 'var(--text-main)'};">
                      ${t.name}
                    </div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                      ${t.description || 'No description provided.'}
                    </div>
                  </td>
                  <td>
                    ${t.jobNo ? `<span style="color:var(--primary); font-weight:600">${t.jobNo}</span>` : '—'}
                  </td>
                  <td>
                    <span style="font-size:12px; font-weight:500;">${t.assignedTo || 'Unassigned'}</span>
                  </td>
                  <td style="font-size:11px; color: ${!isCompleted && new Date(t.dueDate) < new Date() ? 'var(--danger)' : 'inherit'}; font-weight: ${!isCompleted && new Date(t.dueDate) < new Date() ? '600' : '400'}">
                    ${fmtDate(t.dueDate)} ${!isCompleted && new Date(t.dueDate) < new Date() ? ' (Overdue)' : ''}
                  </td>
                  <td>
                    <span class="badge ${t.priority === 'Urgent' || t.priority === 'High' ? 'b-red' : t.priority === 'Medium' ? 'b-amber' : 'b-gray'}">
                      ${t.priority || 'Low'}
                    </span>
                  </td>
                  <td>
                    ${statusBadge(t.status)}
                  </td>
                  <td>
                    <div class="row-actions">
                      <button class="btn sm" data-act="edit" data-tid="${t.id}"><i class="ti ti-edit"></i></button>
                      <button class="btn sm danger" data-act="delete" data-tid="${t.id}"><i class="ti ti-trash"></i></button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Hook listeners
    setTimeout(() => {
      const search = container.querySelector("#task-search");
      if (search) {
        search.oninput = (e) => {
          this.searchQuery = e.target.value;
          this.refreshPanel(container);
        };
      }

      const statusSel = container.querySelector("#task-status-filter");
      if (statusSel) {
        statusSel.onchange = (e) => {
          this.statusFilter = e.target.value;
          this.refreshPanel(container);
        };
      }

      const prioritySel = container.querySelector("#task-priority-filter");
      if (prioritySel) {
        prioritySel.onchange = (e) => {
          this.priorityFilter = e.target.value;
          this.refreshPanel(container);
        };
      }

      const assigneeSel = container.querySelector("#task-assignee-filter");
      if (assigneeSel) {
        assigneeSel.onchange = (e) => {
          this.assigneeFilter = e.target.value;
          this.refreshPanel(container);
        };
      }

      container.querySelector("#task-add-btn").onclick = () => this.openFormModal(null, container);

      // Checkbox click toggle status
      container.querySelectorAll(".task-checkbox").forEach(chk => {
        chk.onchange = async (e) => {
          const tid = chk.dataset.tid;
          const taskObj = list.find(t => t.id === tid);
          if (!taskObj) return;

          const newStatus = chk.checked ? 'Done' : 'Open';
          const updated = { ...taskObj, status: newStatus };
          await saveDocument("tasks", updated, tid);
          
          showToast(`Task marked as ${newStatus}`, "success");
          this.onRefreshNav();
          this.refreshPanel(container);
        };
      });

      // Actions buttons
      container.querySelectorAll("[data-act]").forEach(btn => {
        btn.onclick = (e) => {
          const act = btn.dataset.act;
          const tid = btn.dataset.tid;
          const taskObj = list.find(t => t.id === tid);

          if (act === 'delete') {
            showConfirm(`Delete task "${taskObj.name}"?`, async () => {
              await deleteDocument("tasks", tid);
              showToast("Task deleted successfully.", "success");
              this.onRefreshNav();
              this.refreshPanel(container);
            });
          } else if (act === 'edit') {
            this.openFormModal(taskObj, container);
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
    const shipments = await getCollection("shipments");
    const users = await getCollection("users");

    const modalWrap = document.getElementById("modal-container");
    if (!modalWrap) return;

    modalWrap.innerHTML = `
      <div class="modal-bg" id="task-form-modal">
        <div class="modal" style="width: 500px;">
          <div class="modal-title">${editData ? 'Edit Task' : 'New Task'}<button class="btn sm" id="modal-close"><i class="ti ti-x"></i></button></div>
          <form id="task-form" onsubmit="event.preventDefault()">
            <div class="fg" style="margin-bottom:12px;">
              <label>Task Title *</label>
              <input id="f-name" value="${editData ? editData.name || '' : ''}" placeholder="e.g. Submit SI for JNPT export" required/>
            </div>
            <div class="fg" style="margin-bottom:12px;">
              <label>Description</label>
              <textarea id="f-description" style="height:60px;" placeholder="Details of task details">${editData ? editData.description || '' : ''}</textarea>
            </div>
            <div class="form-row">
              <div class="fg"><label>Linked Job</label><select id="f-jobNo"><option value="">— Unlinked —</option>${shipments.map(s => `<option value="${s.jobNo}" ${editData && editData.jobNo === s.jobNo ? 'selected' : ''}>${s.jobNo} — ${s.customer}</option>`).join('')}</select></div>
              <div class="fg"><label>Assigned Agent</label><select id="f-assignedTo"><option value="">— Unassigned —</option>${users.map(u => `<option value="${u.name}" ${editData && editData.assignedTo === u.name ? 'selected' : ''}>${u.name} (${u.role})</option>`).join('')}</select></div>
            </div>
            <div class="form-row">
              <div class="fg"><label>Due Date *</label><input id="f-dueDate" type="date" value="${editData ? editData.dueDate : new Date().toISOString().split('T')[0]}" required/></div>
              <div class="fg"><label>Priority</label><select id="f-priority"><option ${editData && editData.priority === 'Low' ? 'selected' : ''}>Low</option><option ${editData && editData.priority === 'Medium' ? 'selected' : ''}>Medium</option><option ${editData && editData.priority === 'High' ? 'selected' : ''}>High</option><option ${editData && editData.priority === 'Urgent' ? 'selected' : ''}>Urgent</option></select></div>
            </div>
            <div class="fg" style="margin-bottom:16px;">
              <label>Status</label>
              <select id="f-status">
                <option value="Open" ${editData && editData.status === 'Open' ? 'selected' : ''}>Open</option>
                <option value="In Progress" ${editData && editData.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Done" ${editData && editData.status === 'Done' ? 'selected' : ''}>Done</option>
                <option value="Cancelled" ${editData && editData.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button class="btn" type="button" id="form-cancel">Cancel</button>
              <button class="btn pr" type="submit"><i class="ti ti-check"></i> Save Task</button>
            </div>
          </form>
        </div>
      </div>
    `;

    setTimeout(() => {
      makeSearchableSelect(modalWrap.querySelector("#f-jobNo"));
      makeSearchableSelect(modalWrap.querySelector("#f-assignedTo"));

      document.getElementById("modal-close").onclick = () => { modalWrap.innerHTML = ''; };
      document.getElementById("form-cancel").onclick = () => { modalWrap.innerHTML = ''; };

      document.getElementById("task-form").onsubmit = async (e) => {
        e.preventDefault();
        const fv = (id) => document.getElementById(id)?.value || '';

        const d = {
          name: fv('f-name'),
          description: fv('f-description'),
          jobNo: fv('f-jobNo'),
          assignedTo: fv('f-assignedTo'),
          dueDate: fv('f-dueDate'),
          priority: fv('f-priority'),
          status: fv('f-status')
        };

        if (!d.name) { showToast("Task title is required.", "warning"); return; }
        if (!d.dueDate) { showToast("Due date is required.", "warning"); return; }

        if (editData) {
          await saveDocument("tasks", { ...editData, ...d }, editData.id);
          showToast(`Task "${d.name}" updated successfully.`, "success");
        } else {
          d.createdAt = new Date().toLocaleString();
          await saveDocument("tasks", d);
          showToast(`Task "${d.name}" created successfully.`, "success");
        }

        modalWrap.innerHTML = '';
        this.onRefreshNav();
        this.refreshPanel(container);
      };
    }, 50);
  }
}

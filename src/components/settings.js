import { getCollection, saveDocument, resetDatabase } from "../services/db.js";
import { showToast, showConfirm } from "../services/ui.js";

export class Settings {
  constructor(onRefreshNav) {
    this.onRefreshNav = onRefreshNav;
  }

  async render() {
    const s = await getCollection("settings") || {};
    
    // Fetch count of items in each collection for the system stats view
    const collections = [
      "customers", "vendors", "ports", "shippingLines", "commodities", 
      "chargeHeads", "shipments", "containers", "invoices", "expenses", 
      "tasks", "auditLog"
    ];

    const stats = {};
    for (const col of collections) {
      const list = await getCollection(col);
      stats[col] = list.length;
    }

    const container = document.createElement("div");
    container.innerHTML = `
      <div class="grid2" style="gap:20px; align-items: start;">
        <div class="card" style="margin-bottom:0">
          <div class="sec-title">Company Profile</div>
          <form id="settings-form" onsubmit="event.preventDefault()">
            <div class="fg" style="margin-bottom:12px">
              <label>Company Name</label>
              <input id="s-company" value="${s.company || ''}" required placeholder="Company Name"/>
            </div>
            
            <div class="form-row">
              <div class="fg"><label>GST Number</label><input id="s-gst" value="${s.gst || ''}" placeholder="Tax Registration Number"/></div>
              <div class="fg"><label>Country</label><input id="s-country" value="${s.country || 'India'}" required placeholder="India"/></div>
            </div>

            <div class="fg" style="margin-bottom:12px">
              <label>Office Address</label>
              <textarea id="s-address" style="height:60px" placeholder="Company physical address">${s.address || ''}</textarea>
            </div>

            <div class="form-row">
              <div class="fg"><label>Support Phone</label><input id="s-phone" value="${s.phone || ''}" placeholder="+91..."/></div>
              <div class="fg"><label>Support Email</label><input id="s-email" type="email" value="${s.email || ''}" placeholder="info@company.com"/></div>
            </div>

            <div class="form-row">
              <div class="fg">
                <label>Default Currency</label>
                <select id="s-currency">
                  <option value="INR" ${s.currency === 'INR' ? 'selected' : ''}>INR (₹)</option>
                  <option value="USD" ${s.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                  <option value="EUR" ${s.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                </select>
              </div>
              <div class="fg">
                <label>Job Prefix</label>
                <input id="s-prefix" value="${s.jobPrefix || 'JB'}" required placeholder="JB"/>
              </div>
            </div>

            <div class="form-row">
              <div class="fg">
                <label>Company Initials (3 Letters) *</label>
                <input id="s-initials" value="${s.companyInitials || 'GLS'}" maxlength="3" required placeholder="GLS"/>
              </div>
              <div class="fg">
                <label>Company Logo URL</label>
                <input id="s-logo" value="${s.companyLogo || ''}" placeholder="https://example.com/logo.png"/>
              </div>
            </div>

            <!-- Email & Link Configs -->
            <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:12px; margin-bottom:12px;">
              <h4 style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; margin-bottom:10px;">Email &amp; Vercel Link Settings</h4>
              <div class="form-row">
                <div class="fg">
                  <label>Email Provider</label>
                  <select id="s-emailProvider">
                    <option value="mailto" ${s.emailProvider !== 'emailjs' ? 'selected' : ''}>Default (Browser Mailto)</option>
                    <option value="emailjs" ${s.emailProvider === 'emailjs' ? 'selected' : ''}>EmailJS (Auto-send)</option>
                  </select>
                </div>
                <div class="fg">
                  <label>Vercel App URL</label>
                  <input id="s-appUrl" value="${s.appUrl || window.location.origin}" placeholder="https://your-app.vercel.app"/>
                </div>
              </div>
              
              <div id="emailjs-config-box" style="display: ${s.emailProvider === 'emailjs' ? 'block' : 'none'}; border-top:1px solid var(--border); padding-top:12px; margin-top:12px;">
                <div class="form-row">
                  <div class="fg"><label>EmailJS Service ID</label><input id="s-emailjsServiceId" value="${s.emailjsServiceId || ''}" placeholder="service_xxxx"/></div>
                  <div class="fg"><label>EmailJS Template ID</label><input id="s-emailjsTemplateId" value="${s.emailjsTemplateId || ''}" placeholder="template_xxxx"/></div>
                </div>
                <div class="form-row">
                  <div class="fg"><label>EmailJS Public Key</label><input id="s-emailjsPublicKey" value="${s.emailjsPublicKey || ''}" placeholder="public_key"/></div>
                  <div class="fg"><label>Sender Display Name</label><input id="s-senderName" value="${s.senderName || ''}" placeholder="GLS CargoPulse Support"/></div>
                </div>
                <div class="fg">
                  <label>Sender Email Address</label>
                  <input id="s-senderEmail" type="email" value="${s.senderEmail || ''}" placeholder="support@company.com"/>
                </div>
              </div>
            </div>

            <button class="btn pr" style="margin-top:12px" type="submit"><i class="ti ti-check" aria-hidden="true"></i> Save Settings</button>
          </form>
        </div>

        <div class="card" style="margin-bottom:0">
          <div class="sec-title">Database &amp; System Health</div>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div class="kv-row"><span class="kv-key">Customers Registered</span><span>${stats.customers}</span></div>
            <div class="kv-row"><span class="kv-key">Vendors &amp; Operators</span><span>${stats.vendors}</span></div>
            <div class="kv-row"><span class="kv-key">Ports &amp; Airports</span><span>${stats.ports}</span></div>
            <div class="kv-row"><span class="kv-key">Carrier Agreements</span><span>${stats.shippingLines}</span></div>
            <div class="kv-row"><span class="kv-key">HS Commodity Index</span><span>${stats.commodities}</span></div>
            <div class="kv-row"><span class="kv-key">Billing Charge Heads</span><span>${stats.chargeHeads}</span></div>
            <div class="kv-row"><span class="kv-key">Active Shipments Logged</span><span>${stats.shipments}</span></div>
            <div class="kv-row"><span class="kv-key">Tracked Containers</span><span>${stats.containers}</span></div>
            <div class="kv-row"><span class="kv-key">Customer Invoices</span><span>${stats.invoices}</span></div>
            <div class="kv-row"><span class="kv-key">Supplier Expenses</span><span>${stats.expenses}</span></div>
            <div class="kv-row"><span class="kv-key">Checklist Tasks</span><span>${stats.tasks}</span></div>
            <div class="kv-row"><span class="kv-key">Audit Logs Registered</span><span>${stats.auditLog}</span></div>
          </div>
          
          <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--border);">
            <h4 style="color:var(--danger); font-size:13px; font-weight:600; margin-bottom:8px;">Danger Zone</h4>
            <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px; line-height:1.4;">
              Resetting will wipe all Firestore collections and localStorage records. The system will then reload default setup seeds.
            </p>
            <button class="btn sm danger" id="reset-system-btn"><i class="ti ti-refresh" aria-hidden="true"></i> Wipe &amp; Reset Database</button>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      // Form submit handler
      const form = container.querySelector("#settings-form");
      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const fv = (id) => container.querySelector(`#${id}`)?.value || '';

          const updatedSettings = {
            id: 'settings',
            company: fv('s-company'),
            gst: fv('s-gst'),
            country: fv('s-country'),
            address: fv('s-address'),
            phone: fv('s-phone'),
            email: fv('s-email'),
            currency: fv('s-currency'),
            jobPrefix: fv('s-prefix'),
            companyInitials: fv('s-initials'),
            companyLogo: fv('s-logo'),
            emailProvider: fv('s-emailProvider'),
            emailjsServiceId: fv('s-emailjsServiceId'),
            emailjsTemplateId: fv('s-emailjsTemplateId'),
            emailjsPublicKey: fv('s-emailjsPublicKey'),
            senderName: fv('s-senderName'),
            senderEmail: fv('s-senderEmail'),
            appUrl: fv('s-appUrl')
          };

          await saveDocument("settings", updatedSettings, 'settings');

          // Log audit event
          await saveDocument("auditLog", {
            ts: new Date().toLocaleString(),
            user: "Super Admin",
            action: "UPDATE",
            module: "Settings",
            record: `Saved company profile settings for ${updatedSettings.company}`,
            ip: "10.0.0." + Math.floor(Math.random() * 200 + 1)
          });

          showToast("Company profile saved successfully.", "success");
          this.onRefreshNav();
          this.refreshPanel(container);
        };
      }

      // Reset DB handler
      const resetBtn = container.querySelector("#reset-system-btn");
      if (resetBtn) {
        resetBtn.onclick = () => {
          showConfirm("Reset ALL databases and settings? This will clear all transactions and reload base seed metadata.", async () => {
            await resetDatabase();
            
            // Log audit event after reset
            await saveDocument("auditLog", {
              ts: new Date().toLocaleString(),
              user: "Super Admin",
              action: "RESET",
              module: "System",
              record: "Performed full database restoration & cleared transaction files",
              ip: "127.0.0.1"
            });

            showToast("System database reset successfully.", "success");
            this.onRefreshNav();
            this.refreshPanel(container);
          });
        };
      }

      // EmailJS toggle handler
      const providerSelect = container.querySelector("#s-emailProvider");
      if (providerSelect) {
        providerSelect.onchange = () => {
          const configBox = container.querySelector("#emailjs-config-box");
          if (configBox) {
            configBox.style.display = providerSelect.value === "emailjs" ? "block" : "none";
          }
        };
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
}

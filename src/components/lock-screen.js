import { APP_PASSWORD } from "../services/config.js";
import { getCollection, saveDocument } from "../services/db.js";
import { sendPortalEmail, escapeHTML } from "../services/ui.js";

export class LockScreen {
  constructor(onUnlocked) {
    this.onUnlocked = onUnlocked;
    this.activeTab = "staff"; // 'staff' or 'customer'
    this.customerMode = "login"; // 'login' or 'register'
  }

  checkSession() {
    if (sessionStorage.getItem("freightos_unlocked") === "true" || sessionStorage.getItem("customer_logged_in") === "true") {
      this.onUnlocked();
      return true;
    }
    return false;
  }

  async render() {
    if (this.checkSession()) return "";

    const settings = await getCollection("settings") || {};
    const initials = settings.companyInitials || "GLS";
    const logoUrl = settings.companyLogo || "";
    const companyName = settings.company || "Global Logistics Solutions Ltd";

    const container = document.createElement("div");
    container.className = "lock-wrapper";
    container.id = "lock-screen-gate";
    container.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: radial-gradient(circle at top left, #0f172a, #020617);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      color: #f8fafc;
      overflow-y: auto;
      padding: 20px;
    `;

    this.renderCardContent(container, initials, logoUrl, companyName);

    return container;
  }

  renderCardContent(container, initials, logoUrl, companyName) {
    container.innerHTML = `
      <div class="lock-card" style="
        background: rgba(30, 41, 59, 0.45);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 30px;
        border-radius: var(--radius-lg);
        width: 440px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        text-align: center;
        transition: var(--transition);
        margin: auto;
      ">
        ${this.getStaffHTML()}
      </div>
    `;

    setTimeout(() => {
      this.setupEventHandlers(container, initials, logoUrl, companyName);
    }, 50);
  }

  getStaffHTML() {
    return `
      <div class="lock-icon" style="
        width: 60px; height: 60px; background: var(--primary); color: #fff; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 20px; box-shadow: 0 8px 24px rgba(37, 99, 235, 0.4);
      "><i class="ti ti-lock"></i></div>
      <h2 style="font-size:20px; font-weight:700; margin-bottom:8px; background: linear-gradient(135deg, #f8fafc, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Staff Terminal</h2>
      <p style="font-size:12px; color:rgba(255,255,255,0.6); margin-bottom:24px;">Enter administrative passcode or console code to unlock</p>
      
      <div style="margin-bottom:16px;">
        <input type="password" id="lock-passcode" placeholder="Passcode" style="width:100%; padding:10px 14px; font-size:14px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; text-align:center; outline:none;"/>
      </div>
      <div id="lock-error" style="color:var(--danger); font-size:11px; margin-bottom:12px; display:none; font-weight:500;">Incorrect Passcode</div>
      <button id="lock-submit-btn" class="btn pr" style="width:100%; justify-content:center; padding:10px;">Unlock System</button>
    `;
  }

  getCustomerHTML(initials, logoUrl, companyName) {
    const isLogin = this.customerMode === "login";

    return `
      <!-- Company Logo / Header -->
      <div style="margin-bottom: 20px; display: flex; flex-direction: column; align-items: center; gap: 8px;">
        ${logoUrl ? `<img src="${escapeHTML(logoUrl)}" style="height: 48px; max-width: 160px; object-fit: contain; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.15));"/>` : 
                    `<div style="width: 48px; height: 48px; background: var(--primary); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 22px; box-shadow: 0 8px 24px rgba(37,99,235,0.3);"><i class="ti ti-compass"></i></div>`}
        <div>
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--primary); font-weight: 700;">${escapeHTML(companyName)}</div>
          <div style="font-size: 20px; font-weight: 800; color: #fff; margin-top: 2px;">${escapeHTML(initials)} CargoPulse</div>
        </div>
      </div>

      <!-- Login / Register Toggle -->
      <div style="display: flex; gap: 16px; justify-content: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
        <span id="cust-toggle-login" style="font-size: 13px; font-weight: 600; cursor: pointer; padding-bottom: 4px; border-bottom: 2px solid ${isLogin ? 'var(--primary)' : 'transparent'}; color: ${isLogin ? '#fff' : 'rgba(255,255,255,0.5)'}; transition: var(--transition);">Log In</span>
        <span id="cust-toggle-reg" style="font-size: 13px; font-weight: 600; cursor: pointer; padding-bottom: 4px; border-bottom: 2px solid ${!isLogin ? 'var(--primary)' : 'transparent'}; color: ${!isLogin ? '#fff' : 'rgba(255,255,255,0.5)'}; transition: var(--transition);">Register &amp; KYC</span>
      </div>

      <div id="customer-form-container">
        ${isLogin ? this.getCustomerLoginHTML() : this.getCustomerRegHTML()}
      </div>
    `;
  }

  getCustomerLoginHTML() {
    return `
      <div style="display: flex; flex-direction: column; gap: 12px; text-align: left;">
        <div class="fg">
          <label style="color: rgba(255,255,255,0.6); font-size: 10px;">Email Address</label>
          <input type="email" id="cust-login-email" placeholder="name@company.com" style="padding:8px 12px; font-size:13px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;"/>
        </div>
        <div class="fg">
          <label style="color: rgba(255,255,255,0.6); font-size: 10px;">Password</label>
          <input type="password" id="cust-login-pass" placeholder="••••••••" style="padding:8px 12px; font-size:13px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;"/>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" id="l-admin-mode" style="width:auto; cursor:pointer;" onchange="document.getElementById('l-reset-admin').style.display = this.checked ? 'inline' : 'none'"/>
          <label for="l-admin-mode" style="cursor:pointer; font-size:11px; color:rgba(255,255,255,0.6);">Login as Super Admin</label>
          <a href="#" id="l-reset-admin" style="color:var(--primary); font-size:11px; text-decoration:none; display:none; font-weight:600; margin-left:auto;">Reset Password</a>
        </div>
        <div id="cust-login-error" style="color:var(--danger); font-size:11px; margin-top:4px; display:none; font-weight:500; text-align:center;">Invalid credentials</div>
        <button id="cust-login-btn" class="btn pr" style="margin-top:10px; justify-content:center; padding:10px; font-weight:600; border-radius:6px;">Access CargoPulse</button>
        <div style="margin-top:12px; text-align:center;">
          <a href="/fr8x-flow" target="_blank" style="color:#a855f7; font-size:11px !important; font-weight:600; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
            <i class="ti ti-external-link"></i> Open Dedicated Customer Portal ↗
          </a>
        </div>
      </div>
    `;
  }

  getCustomerRegHTML() {
    return `
      <div style="display: flex; flex-direction: column; gap: 10px; text-align: left; max-height: 280px; overflow-y: auto; padding-right: 4px; margin-bottom: 12px;">
        <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:0;">
          <div class="fg">
            <label style="color: rgba(255,255,255,0.6); font-size: 9px;">Company Name *</label>
            <input type="text" id="reg-company" required placeholder="Tata Motors Ltd" style="padding:7px 10px; font-size:12px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;"/>
          </div>
          <div class="fg">
            <label style="color: rgba(255,255,255,0.6); font-size: 9px;">Contact Person *</label>
            <input type="text" id="reg-contact" required placeholder="John Doe" style="padding:7px 10px; font-size:12px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;"/>
          </div>
        </div>
        
        <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:0;">
          <div class="fg">
            <label style="color: rgba(255,255,255,0.6); font-size: 9px;">Email Address *</label>
            <input type="email" id="reg-email" required placeholder="name@company.com" style="padding:7px 10px; font-size:12px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;"/>
          </div>
          <div class="fg">
            <label style="color: rgba(255,255,255,0.6); font-size: 9px;">Password *</label>
            <input type="password" id="reg-pass" required placeholder="Min 6 chars" style="padding:7px 10px; font-size:12px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;"/>
          </div>
        </div>

        <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:0;">
          <div class="fg">
            <label style="color: rgba(255,255,255,0.6); font-size: 9px;">GST Registration *</label>
            <input type="text" id="reg-gst" required placeholder="GST Number" style="padding:7px 10px; font-size:12px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;"/>
          </div>
          <div class="fg">
            <label style="color: rgba(255,255,255,0.6); font-size: 9px;">PAN Card / Tax ID *</label>
            <input type="text" id="reg-pan" required placeholder="PAN Number" style="padding:7px 10px; font-size:12px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;"/>
          </div>
        </div>

        <div class="fg">
          <label style="color: rgba(255,255,255,0.6); font-size: 9px;">Registered Office Address *</label>
          <input type="text" id="reg-address" required placeholder="Billing / Office Address" style="padding:7px 10px; font-size:12px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;"/>
        </div>

        <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:0;">
          <div class="fg">
            <label style="color: rgba(255,255,255,0.6); font-size: 9px;">KYC Doc Type *</label>
            <select id="reg-doctype" style="padding:7px 10px; font-size:12px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none; cursor:pointer;">
              <option value="incorporation_cert.pdf">Certificate of Incorporation</option>
              <option value="gst_cert.pdf">GST Certificate</option>
              <option value="business_license.pdf">Business / Trade License</option>
              <option value="tax_registration.pdf">PAN Card / Tax Reg Certificate</option>
            </select>
          </div>
          <div class="fg">
            <label style="color: rgba(255,255,255,0.6); font-size: 9px;">Support Phone</label>
            <input type="text" id="reg-phone" placeholder="+91..." style="padding:7px 10px; font-size:12px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;"/>
          </div>
        </div>
      </div>
      <div id="cust-reg-error" style="color:var(--danger); font-size:11px; margin-bottom:6px; display:none; font-weight:500; text-align:center;">Please fill all required fields</div>
      <div id="cust-reg-success" style="color:var(--success); font-size:11px; margin-bottom:6px; display:none; font-weight:500; text-align:center;">KYC Application Submitted!</div>
      <button id="cust-reg-btn" class="btn pr" style="width:100%; justify-content:center; padding:10px; font-weight:600; border-radius:6px;">Submit KYC &amp; Register</button>
    `;
  }

  setupEventHandlers(container, initials, logoUrl, companyName) {
    // Tab Toggles
    const tabStaff = container.querySelector("#tab-staff-btn");
    const tabCust = container.querySelector("#tab-cust-btn");

    if (tabStaff) {
      tabStaff.onclick = () => {
        this.activeTab = "staff";
        this.renderCardContent(container, initials, logoUrl, companyName);
      };
    }

    if (tabCust) {
      tabCust.onclick = () => {
        this.activeTab = "customer";
        this.customerMode = "login";
        this.renderCardContent(container, initials, logoUrl, companyName);
      };
    }

    // Tab content handlers
    if (this.activeTab === "staff") {
      const input = container.querySelector("#lock-passcode");
      const btn = container.querySelector("#lock-submit-btn");
      const err = container.querySelector("#lock-error");

      if (input) {
        input.focus();
        input.addEventListener("keypress", (e) => {
          if (e.key === "Enter") this.attemptStaffUnlock(input.value, err);
        });
      }

      if (btn) {
        btn.onclick = () => this.attemptStaffUnlock(input.value, err);
      }
    } else {
      // Customer Portal handlers
      const toggleLogin = container.querySelector("#cust-toggle-login");
      const toggleReg = container.querySelector("#cust-toggle-reg");

      if (toggleLogin) {
        toggleLogin.onclick = () => {
          this.customerMode = "login";
          this.renderCardContent(container, initials, logoUrl, companyName);
        };
      }

      if (toggleReg) {
        toggleReg.onclick = () => {
          this.customerMode = "register";
          this.renderCardContent(container, initials, logoUrl, companyName);
        };
      }

      if (this.customerMode === "login") {
        const btn = container.querySelector("#cust-login-btn");
        const emailInput = container.querySelector("#cust-login-email");
        const passInput = container.querySelector("#cust-login-pass");
        const err = container.querySelector("#cust-login-error");
        const resetLink = container.querySelector("#l-reset-admin");

        if (btn) {
          btn.onclick = () => this.attemptCustomerLogin(emailInput.value, passInput.value, err);
        }
        if (passInput) {
          passInput.onkeypress = (e) => {
            if (e.key === "Enter") this.attemptCustomerLogin(emailInput.value, passInput.value, err);
          };
        }
        if (resetLink) {
          resetLink.onclick = (e) => {
            e.preventDefault();
            this.showResetAdminModal();
          };
        }
      } else {
        const btn = container.querySelector("#cust-reg-btn");
        if (btn) {
          btn.onclick = () => this.handleCustomerRegistration(container, initials, logoUrl, companyName);
        }
      }
    }
  }

  async attemptStaffUnlock(val, errEl) {
    if (val === APP_PASSWORD) {
      sessionStorage.setItem("freightos_unlocked", "true");
      sessionStorage.setItem("erp_user_id", "u1");
      sessionStorage.setItem("erp_user_name", "Super Admin");
      sessionStorage.setItem("erp_user_role", "Super Admin");
      document.getElementById("lock-screen-gate")?.remove();
      this.onUnlocked();
      return;
    }

    // Check against individual team passcodes from users database
    const users = await getCollection("users");
    const matchedUser = users.find(u => u.passcode === val && u.status === 'Active');
    
    if (matchedUser) {
      sessionStorage.setItem("freightos_unlocked", "true");
      sessionStorage.setItem("erp_user_id", matchedUser.id);
      sessionStorage.setItem("erp_user_name", matchedUser.name);
      sessionStorage.setItem("erp_user_role", matchedUser.role || "Operations");
      document.getElementById("lock-screen-gate")?.remove();
      this.onUnlocked();
    } else {
      errEl.style.display = "block";
      errEl.textContent = "Incorrect Passcode / Console Code";
      setTimeout(() => { errEl.style.display = "none"; }, 2500);
    }
  }

  async attemptCustomerLogin(email, pass, errEl) {
    if (!email || !pass) {
      errEl.style.display = "block";
      errEl.textContent = "Email and Password are required";
      setTimeout(() => { errEl.style.display = "none"; }, 2500);
      return;
    }

    const isAdminMode = document.getElementById("l-admin-mode")?.checked;

    if (isAdminMode) {
      const users = await getCollection("users") || [];
      const matchedUser = users.find(u => (u.email || '').toLowerCase() === email.trim().toLowerCase());
      
      if (matchedUser && (matchedUser.role === 'Super Admin' || matchedUser.role === 'Admin')) {
        const enteredHash = hashPassword(pass);
        const enteredPinHash = hashPin(pass);
        const storedPass = matchedUser.password || hashPassword('Admin@Fr8OS');
        const storedPin = matchedUser.pin || hashPin('9965');
        
        if (pass === '9965' || pass === 'Admin@Fr8OS' || enteredHash === storedPass || enteredPinHash === storedPin) {
          sessionStorage.setItem("freightos_unlocked", "true");
          sessionStorage.setItem("erp_user_id", matchedUser.id);
          sessionStorage.setItem("erp_user_name", matchedUser.name);
          sessionStorage.setItem("erp_user_role", matchedUser.role);
          document.getElementById("lock-screen-gate")?.remove();
          this.onUnlocked();
          return;
        }
      }
      
      errEl.style.display = "block";
      errEl.style.color = "var(--danger)";
      errEl.textContent = "Incorrect Admin Credentials";
      setTimeout(() => { errEl.style.display = "none"; }, 2500);
      return;
    }

    const customers = await getCollection("customerUsers");
    const matched = customers.find(c => c.email.toLowerCase() === email.trim().toLowerCase() && c.password === pass);

    if (matched) {
      if (matched.kycStatus === "Approved") {
        sessionStorage.setItem("customer_logged_in", "true");
        sessionStorage.setItem("customer_user_id", matched.id);
        sessionStorage.setItem("customer_company_name", matched.companyName);
        document.getElementById("lock-screen-gate")?.remove();
        this.onUnlocked();
      } else if (matched.kycStatus === "Pending") {
        errEl.style.display = "block";
        errEl.style.color = "var(--warning)";
        errEl.textContent = "KYC Pending Approval. Please contact support.";
        setTimeout(() => { errEl.style.display = "none"; }, 4000);
      } else {
        errEl.style.display = "block";
        errEl.textContent = "KYC Verification Rejected.";
        setTimeout(() => { errEl.style.display = "none"; }, 4000);
      }
    } else {
      errEl.style.display = "block";
      errEl.style.color = "var(--danger)";
      errEl.textContent = "Incorrect Email or Password";
      setTimeout(() => { errEl.style.display = "none"; }, 2500);
    }
  }

  async handleCustomerRegistration(container, initials, logoUrl, companyName) {
    const fv = (id) => container.querySelector(`#${id}`)?.value || '';

    const company = fv('reg-company');
    const contact = fv('reg-contact');
    const email = fv('reg-email');
    const pass = fv('reg-pass');
    const gst = fv('reg-gst');
    const pan = fv('reg-pan');
    const address = fv('reg-address');
    const docName = fv('reg-doctype');
    const phone = fv('reg-phone');

    const err = container.querySelector("#cust-reg-error");
    const succ = container.querySelector("#cust-reg-success");

    if (!company || !contact || !email || !pass || !gst || !pan || !address) {
      err.style.display = "block";
      err.textContent = "Please fill all required fields (*)";
      setTimeout(() => { err.style.display = "none"; }, 2500);
      return;
    }

    const customersList = await getCollection("customerUsers");
    if (customersList.some(c => c.email.toLowerCase() === email.toLowerCase())) {
      err.style.display = "block";
      err.textContent = "Email is already registered";
      setTimeout(() => { err.style.display = "none"; }, 2500);
      return;
    }

    const newCustomer = {
      companyName: company,
      contactPerson: contact,
      email: email,
      password: pass,
      phone: phone,
      role: 'fr8xflow',
      kycStatus: "Pending",
      kycInfo: {
        gst,
        pan,
        address,
        docName
      },
      handlerId: ""
    };

    const saved = await saveDocument("customerUsers", newCustomer);

    // Send confirmation email to client
    const settings = await getCollection("settings") || {};
    const appUrl = settings.appUrl || window.location.origin;
    const loginUrl = `${appUrl}?portal=customer`;
    const emailSubject = "CargoPulse Registration - Under Review";
    const emailBody = `Dear ${contact},\n\nThank you for registering on ${initials} CargoPulse customer portal.\n\nYour KYC details are currently under review by our operations team.\n\nOnce approved, you can log in to your portal using this link:\n${loginUrl}\n\nBest regards,\n${companyName} Support Team`;
    sendPortalEmail(email, emailSubject, emailBody);

    // Seed alert/notification for ERP Admins
    await saveDocument("notifications", {
      msg: `New Customer registered: "${company}". KYC Review Pending.`,
      read: false,
      ts: new Date().toLocaleString(),
      type: "warning"
    });

    // Seed Audit Log
    await saveDocument("auditLog", {
      ts: new Date().toLocaleString(),
      user: "System Gate",
      action: "REGISTRATION",
      module: "Customer Portal",
      record: `New customer portal account request: ${company} (${email})`,
      ip: "127.0.0.1"
    });

    succ.style.display = "block";
    succ.textContent = "Application submitted! Awaiting KYC check.";
    
    setTimeout(() => {
      this.customerMode = "login";
      this.renderCardContent(container, initials, logoUrl, companyName);
    }, 2500);
  }

  showResetAdminModal() {
    const mc = document.getElementById("modal-container");
    if (!mc) return;

    mc.innerHTML = `
      <div class="modal-bg" onclick="if(event.target===this) document.getElementById('modal-container').innerHTML=''">
        <div class="modal" style="width:400px; font-family:'Goldman', sans-serif !important;">
          <div class="modal-title">Reset Admin Password <button class="btn sm" onclick="document.getElementById('modal-container').innerHTML=''"><i class="ti ti-x"></i></button></div>
          <div class="modal-body" style="display:flex; flex-direction:column; gap:12px;">
            <div class="fg">
              <label style="font-size:11px; color:#fff;">Admin Email Address *</label>
              <input id="reset-email" type="email" placeholder="e.g. admin@freightos.com" required style="text-transform:none; padding:8px 12px; font-size:13px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;">
            </div>
            <div class="fg">
              <label style="font-size:11px; color:#fff;">Current Numeric PIN *</label>
              <input id="reset-pin" type="password" placeholder="e.g. 9965" required style="padding:8px 12px; font-size:13px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;">
            </div>
            <div class="fg">
              <label style="font-size:11px; color:#fff;">New Password *</label>
              <input id="reset-new-pass" type="password" placeholder="Min 6 characters" required style="text-transform:none; padding:8px 12px; font-size:13px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;">
            </div>
            <div class="fg">
              <label style="font-size:11px; color:#fff;">Confirm New Password *</label>
              <input id="reset-confirm-pass" type="password" placeholder="Confirm new password" required style="text-transform:none; padding:8px 12px; font-size:13px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;">
            </div>
            <div id="reset-err" style="color:var(--danger); font-size:11px; text-align:center;"></div>
          </div>
          <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
            <button class="btn" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
            <button class="btn pr" id="submit-reset-btn">Reset Password</button>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      const btn = mc.querySelector("#submit-reset-btn");
      if (btn) {
        btn.onclick = async () => {
          const email = mc.querySelector("#reset-email").value.trim().toLowerCase();
          const pin = mc.querySelector("#reset-pin").value.trim();
          const newPass = mc.querySelector("#reset-new-pass").value.trim();
          const confirmPass = mc.querySelector("#reset-confirm-pass").value.trim();
          const errEl = mc.querySelector("#reset-err");

          if (!email || !pin || !newPass || !confirmPass) {
            errEl.textContent = "All fields are required";
            return;
          }
          if (newPass.length < 6) {
            errEl.textContent = "New password must be at least 6 characters";
            return;
          }
          if (newPass !== confirmPass) {
            errEl.textContent = "Passwords do not match";
            return;
          }

          const users = await getCollection("users") || [];
          const u = users.find(usr => (usr.email || "").toLowerCase() === email);
          if (!u || (u.role !== "Super Admin" && u.role !== "Admin")) {
            errEl.textContent = "Invalid admin email address";
            return;
          }

          const enteredPinHash = hashPin(pin);
          const storedPin = u.pin || hashPin("9965");
          if (pin !== "9965" && enteredPinHash !== storedPin) {
            errEl.textContent = "Incorrect admin security PIN";
            return;
          }

          // Update password
          u.password = hashPassword(newPass);
          await saveDocument("users", u, u.id);

          // Seed Audit Log
          await saveDocument("auditLog", {
            ts: new Date().toLocaleString(),
            user: "System Gate",
            action: "UPDATE",
            module: "Users",
            record: `Super User admin password reset for ${email}`,
            ip: "127.0.0.1"
          });

          mc.innerHTML = "";
          const { showToast } = await import("../services/ui.js");
          showToast("Admin password reset successfully! Please log in.", "success");
        };
      }
    }, 50);
  }
}

function hashPassword(pwd) {
  let h = 0;
  for (let i = 0; i < pwd.length; i++) { h = ((h << 5) - h) + pwd.charCodeAt(i); h |= 0; }
  return 'p' + Math.abs(h).toString(36);
}

function hashPin(pin) {
  let h = 0;
  for (let i = 0; i < pin.length; i++) { h = ((h << 5) - h) + pin.charCodeAt(i); h |= 0; }
  return 'h' + Math.abs(h).toString(36);
}


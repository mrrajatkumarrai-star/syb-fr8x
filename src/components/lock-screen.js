import { getCollection, saveDocument, hashPassword } from "../services/db.js";
import { sendPortalEmail, escapeHTML, showToast } from "../services/ui.js";

export class LockScreen {
  constructor(onUnlocked) {
    this.onUnlocked = onUnlocked;

    // Detect if this is a dedicated customer login portal via URL parameter or route
    const params = new URLSearchParams(window.location.search);
    const isCustomerPortal = params.get("portal") === "customer" || params.has("customer") || window.location.pathname.includes("/portal");
    
    this.activeTab = isCustomerPortal ? "customer" : "staff";
    this.isDedicatedCustomer = isCustomerPortal;
    
    this.customerMode = "login"; // 'login' or 'register'
    this.mode = "login"; // 'login', 'forgot', 'reset'
    this.forgotEmail = "";
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
        ${this.getCardBodyHTML(initials, logoUrl, companyName)}
      </div>
    `;

    setTimeout(() => {
      this.setupEventHandlers(container, initials, logoUrl, companyName);
    }, 50);
  }

  getCardBodyHTML(initials, logoUrl, companyName) {
    if (this.mode === "forgot") {
      return this.getForgotHTML();
    }
    if (this.mode === "reset") {
      return this.getResetHTML();
    }
    return this.activeTab === "staff" ? this.getStaffHTML() : this.getCustomerHTML(initials, logoUrl, companyName);
  }

  getStaffHTML() {
    return `
      <div class="lock-icon" style="
        width: 60px; height: 60px; background: var(--primary); color: #fff; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 20px; box-shadow: 0 8px 24px rgba(37, 99, 235, 0.4);
      "><i class="ti ti-lock"></i></div>
      <h2 style="font-size:20px; font-weight:700; margin-bottom:8px; background: linear-gradient(135deg, #f8fafc, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Staff Terminal</h2>
      <p style="font-size:12px; color:rgba(255,255,255,0.6); margin-bottom:24px;">Log in to access administrative workspace</p>
      
      <div style="display: flex; flex-direction: column; gap: 12px; text-align: left; margin-bottom: 16px;">
        <div class="fg">
          <label style="color: rgba(255,255,255,0.6); font-size: 11px; margin-bottom: 4px; display: block;">Official Email Address</label>
          <input type="email" id="staff-login-email" placeholder="name@company.com" style="width:100%; padding:10px 14px; font-size:13.5px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;"/>
        </div>
        <div class="fg">
          <label style="color: rgba(255,255,255,0.6); font-size: 11px; margin-bottom: 4px; display: block;">Password</label>
          <input type="password" id="staff-login-pass" placeholder="••••••••" style="width:100%; padding:10px 14px; font-size:13.5px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;"/>
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; margin-bottom: 16px;">
        <a href="#" id="staff-forgot-link" style="color:var(--primary); font-size:11px; text-decoration:none; font-weight:600;">Forgot Password?</a>
      </div>
      <div id="staff-login-error" style="color:var(--danger); font-size:11px; margin-bottom:12px; display:none; font-weight:500; text-align:center; line-height: 1.4;"></div>
      <button id="staff-login-btn" class="btn pr" style="width:100%; justify-content:center; padding:10px; font-weight: 600;">Unlock System</button>

      <div style="margin-top:24px; border-top:1px solid rgba(255,255,255,0.15); padding-top:16px; text-align:center;">
        <a href="?portal=customer" style="color:rgba(255,255,255,0.55); font-size:11px !important; font-weight:600; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
          <i class="ti ti-compass"></i> Access Client CargoPulse Portal ↗
        </a>
      </div>
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
          <label style="color: rgba(255,255,255,0.6); font-size: 11px; margin-bottom: 4px; display: block;">Email Address</label>
          <input type="email" id="cust-login-email" placeholder="name@company.com" style="width:100%; padding:10px 14px; font-size:13px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;"/>
        </div>
        <div class="fg">
          <label style="color: rgba(255,255,255,0.6); font-size: 11px; margin-bottom: 4px; display: block;">Password</label>
          <input type="password" id="cust-login-pass" placeholder="••••••••" style="width:100%; padding:10px 14px; font-size:13px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;"/>
        </div>
        <div style="display:flex; justify-content:flex-end;">
          <a href="#" id="cust-forgot-link" style="color:var(--primary); font-size:11px; text-decoration:none; font-weight:600;">Forgot Password?</a>
        </div>
        <div id="cust-login-error" style="color:var(--danger); font-size:11px; margin-top:4px; display:none; font-weight:500; text-align:center; line-height: 1.4;"></div>
        <button id="cust-login-btn" class="btn pr" style="margin-top:10px; justify-content:center; padding:10px; font-weight:600; border-radius:6px;">Access CargoPulse</button>
        
        <div style="margin-top:24px; border-top:1px solid rgba(255,255,255,0.15); padding-top:16px; text-align:center; display:flex; flex-direction:column; gap:8px;">
          <a href="/portal" target="_blank" style="color:#a855f7; font-size:11px !important; font-weight:600; text-decoration:none; display:inline-flex; align-items:center; gap:4px; justify-content:center;">
            <i class="ti ti-external-link"></i> Open Dedicated Customer Portal ↗
          </a>
          <a href="?" style="color:rgba(255,255,255,0.5); font-size:11px !important; font-weight:600; text-decoration:none; display:inline-flex; align-items:center; gap:4px; justify-content:center;">
            <i class="ti ti-lock"></i> Staff Terminal Login ↗
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

  getForgotHTML() {
    return `
      <div class="lock-icon" style="
        width: 60px; height: 60px; background: var(--warning); color: #fff; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 20px; box-shadow: 0 8px 24px rgba(245, 158, 11, 0.4);
      "><i class="ti ti-mail-forward"></i></div>
      <h2 style="font-size:20px; font-weight:700; margin-bottom:8px; color:#fff;">Forgot Password</h2>
      <p style="font-size:12px; color:rgba(255,255,255,0.6); margin-bottom:24px; line-height:1.4;">
        Enter your registered email address below. We will send a One-Time Passcode (OTP) to reset your password.
      </p>
      <div style="text-align: left; margin-bottom: 20px;">
        <div class="fg">
          <label style="color: rgba(255,255,255,0.6); font-size: 11px; margin-bottom: 4px; display: block;">Registered Email Address</label>
          <input type="email" id="forgot-email-input" placeholder="name@company.com" style="width:100%; padding:10px 14px; font-size:13.5px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;"/>
        </div>
      </div>
      <div id="forgot-error" style="color:var(--danger); font-size:11px; margin-bottom:12px; display:none; font-weight:500; text-align:center;">Email address not found</div>
      <button id="forgot-send-btn" class="btn pr" style="width:100%; justify-content:center; padding:10px; font-weight:600; margin-bottom:12px;">Send Reset OTP</button>
      <a href="#" id="forgot-back-btn" style="color:rgba(255,255,255,0.6); font-size:12px; text-decoration:none; font-weight:500; display:block; margin-top:8px;">Back to Login</a>
    `;
  }

  getResetHTML() {
    return `
      <div class="lock-icon" style="
        width: 60px; height: 60px; background: var(--success); color: #fff; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 20px; box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
      "><i class="ti ti-key"></i></div>
      <h2 style="font-size:20px; font-weight:700; margin-bottom:8px; color:#fff;">Reset Password</h2>
      <p style="font-size:12px; color:rgba(255,255,255,0.6); margin-bottom:20px; line-height:1.4;">
        Enter the OTP sent to <strong>${escapeHTML(this.forgotEmail)}</strong> and choose a new secure password.
      </p>
      <div style="text-align: left; display:flex; flex-direction:column; gap:12px; margin-bottom: 20px;">
        <div class="fg">
          <label style="color: rgba(255,255,255,0.6); font-size: 11px; margin-bottom: 4px; display: block;">One-Time Passcode (OTP)</label>
          <input type="text" id="reset-otp-input" placeholder="6-Digit OTP" maxlength="6" style="width:100%; padding:10px 14px; font-size:13.5px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; text-align:center; letter-spacing:4px; outline:none;"/>
        </div>
        <div class="fg">
          <label style="color: rgba(255,255,255,0.6); font-size: 11px; margin-bottom: 4px; display: block;">New Password</label>
          <input type="password" id="reset-pass-input" placeholder="Min 6 characters" style="width:100%; padding:10px 14px; font-size:13.5px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;"/>
        </div>
        <div class="fg">
          <label style="color: rgba(255,255,255,0.6); font-size: 11px; margin-bottom: 4px; display: block;">Confirm New Password</label>
          <input type="password" id="reset-confirm-input" placeholder="Re-enter password" style="width:100%; padding:10px 14px; font-size:13.5px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:rgba(15,23,42,0.6); color:#fff; outline:none;"/>
        </div>
      </div>
      <div id="reset-error" style="color:var(--danger); font-size:11px; margin-bottom:12px; display:none; font-weight:500; text-align:center; line-height:1.4;"></div>
      <button id="reset-submit-btn" class="btn pr" style="width:100%; justify-content:center; padding:10px; font-weight:600; margin-bottom:12px;">Reset Password</button>
      <a href="#" id="reset-back-btn" style="color:rgba(255,255,255,0.6); font-size:12px; text-decoration:none; font-weight:500; display:block; margin-top:8px;">Back to Login</a>
    `;
  }

  setupEventHandlers(container, initials, logoUrl, companyName) {
    // Forgot & Reset UI back buttons
    const forgotBack = container.querySelector("#forgot-back-btn");
    if (forgotBack) {
      forgotBack.onclick = (e) => {
        e.preventDefault();
        this.mode = "login";
        this.renderCardContent(container, initials, logoUrl, companyName);
      };
    }

    const resetBack = container.querySelector("#reset-back-btn");
    if (resetBack) {
      resetBack.onclick = (e) => {
        e.preventDefault();
        this.mode = "login";
        this.renderCardContent(container, initials, logoUrl, companyName);
      };
    }

    // Login / Register tab content handlers
    if (this.mode === "forgot") {
      const btn = container.querySelector("#forgot-send-btn");
      const emailInput = container.querySelector("#forgot-email-input");
      const err = container.querySelector("#forgot-error");

      if (btn && emailInput) {
        btn.onclick = () => this.handleSendOTP(emailInput.value, err, container, initials, logoUrl, companyName);
        emailInput.onkeypress = (e) => {
          if (e.key === "Enter") this.handleSendOTP(emailInput.value, err, container, initials, logoUrl, companyName);
        };
        emailInput.focus();
      }
    } else if (this.mode === "reset") {
      const btn = container.querySelector("#reset-submit-btn");
      const otpInput = container.querySelector("#reset-otp-input");
      const passInput = container.querySelector("#reset-pass-input");
      const confirmInput = container.querySelector("#reset-confirm-input");
      const err = container.querySelector("#reset-error");

      if (btn) {
        btn.onclick = () => this.handleResetSubmit(otpInput.value, passInput.value, confirmInput.value, err, container, initials, logoUrl, companyName);
      }
    } else if (this.activeTab === "staff") {
      const emailInput = container.querySelector("#staff-login-email");
      const passInput = container.querySelector("#staff-login-pass");
      const btn = container.querySelector("#staff-login-btn");
      const err = container.querySelector("#staff-login-error");
      const forgotLink = container.querySelector("#staff-forgot-link");

      if (btn && emailInput && passInput) {
        btn.onclick = () => this.attemptStaffLogin(emailInput.value, passInput.value, err);
        passInput.onkeypress = (e) => {
          if (e.key === "Enter") this.attemptStaffLogin(emailInput.value, passInput.value, err);
        };
        emailInput.focus();
      }

      if (forgotLink) {
        forgotLink.onclick = (e) => {
          e.preventDefault();
          this.mode = "forgot";
          this.renderCardContent(container, initials, logoUrl, companyName);
        };
      }
    } else {
      // Customer Mode
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
        const forgotLink = container.querySelector("#cust-forgot-link");

        if (btn && emailInput && passInput) {
          btn.onclick = () => this.attemptCustomerLogin(emailInput.value, passInput.value, err);
          passInput.onkeypress = (e) => {
            if (e.key === "Enter") this.attemptCustomerLogin(emailInput.value, passInput.value, err);
          };
          emailInput.focus();
        }

        if (forgotLink) {
          forgotLink.onclick = (e) => {
            e.preventDefault();
            this.mode = "forgot";
            this.renderCardContent(container, initials, logoUrl, companyName);
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

  async attemptStaffLogin(email, pass, errEl) {
    if (!email || !pass) {
      errEl.style.display = "block";
      errEl.textContent = "Email and Password are required.";
      setTimeout(() => { errEl.style.display = "none"; }, 3000);
      return;
    }

    const users = await getCollection("users") || [];
    const u = users.find(usr => (usr.email || "").toLowerCase() === email.trim().toLowerCase());

    if (!u) {
      errEl.style.display = "block";
      errEl.textContent = "Invalid Email or Password.";
      setTimeout(() => { errEl.style.display = "none"; }, 3000);
      return;
    }

    // Check if account is locked
    if (u.status === "Locked") {
      errEl.style.display = "block";
      errEl.textContent = "Account is locked due to multiple failed login attempts. Contact a Super User.";
      return;
    }

    const enteredHash = await hashPassword(pass);
    const storedHash = u.password || "";

    if (enteredHash === storedHash) {
      // Success! Reset attempts
      u.loginAttempts = 0;
      await saveDocument("users", u, u.id);

      sessionStorage.setItem("freightos_unlocked", "true");
      sessionStorage.setItem("erp_user_id", u.id);
      sessionStorage.setItem("erp_user_name", u.name);
      sessionStorage.setItem("erp_user_role", u.role || "Operations");

      // Audit Log
      await saveDocument("auditLog", {
        ts: new Date().toLocaleString(),
        user: u.name,
        action: "LOGIN",
        module: "Auth Gate",
        record: `Staff user logged in successfully: ${u.email}`,
        ip: "127.0.0.1"
      });

      document.getElementById("lock-screen-gate")?.remove();
      this.onUnlocked();
    } else {
      // Failed login attempt
      u.loginAttempts = (u.loginAttempts || 0) + 1;
      let msg = `Invalid Email or Password. Attempt ${u.loginAttempts} of 4.`;

      if (u.loginAttempts >= 4) {
        u.status = "Locked";
        msg = "Incorrect credentials. Account has been locked due to 4 failed attempts. Contact a Super User.";

        // Trigger Alerts and Audits
        await saveDocument("notifications", {
          msg: `Staff Account Locked: "${u.email}" after 4 failed login attempts.`,
          read: false,
          ts: new Date().toLocaleString(),
          type: "danger"
        });
        await saveDocument("auditLog", {
          ts: new Date().toLocaleString(),
          user: "System Gate",
          action: "SECURITY LOCK",
          module: "Auth Gate",
          record: `Locked staff account ${u.email} after 4 failed attempts`,
          ip: "127.0.0.1"
        });
      }

      await saveDocument("users", u, u.id);
      errEl.style.display = "block";
      errEl.textContent = msg;
      setTimeout(() => { if (u.status !== "Locked") errEl.style.display = "none"; }, 3000);
    }
  }

  async attemptCustomerLogin(email, pass, errEl) {
    if (!email || !pass) {
      errEl.style.display = "block";
      errEl.textContent = "Email and Password are required";
      setTimeout(() => { errEl.style.display = "none"; }, 2500);
      return;
    }

    const customers = await getCollection("customerUsers") || [];
    const matched = customers.find(c => c.email.toLowerCase() === email.trim().toLowerCase());

    if (!matched) {
      errEl.style.display = "block";
      errEl.textContent = "Invalid Email or Password";
      setTimeout(() => { errEl.style.display = "none"; }, 2500);
      return;
    }

    // Check if account is locked
    if (matched.isLocked || matched.kycStatus === "Locked") {
      errEl.style.display = "block";
      errEl.textContent = "Account is locked. Please contact a Super User to unlock it.";
      return;
    }

    const enteredHash = await hashPassword(pass);
    const storedHash = matched.password || "";

    if (enteredHash === storedHash) {
      // Success! Check KYC
      if (matched.kycStatus === "Approved") {
        matched.loginAttempts = 0;
        await saveDocument("customerUsers", matched, matched.id);

        sessionStorage.setItem("customer_logged_in", "true");
        sessionStorage.setItem("customer_user_id", matched.id);
        sessionStorage.setItem("customer_company_name", matched.companyName);

        // Audit Log
        await saveDocument("auditLog", {
          ts: new Date().toLocaleString(),
          user: matched.companyName,
          action: "LOGIN",
          module: "Auth Gate",
          record: `Customer portal user logged in successfully: ${matched.email}`,
          ip: "127.0.0.1"
        });

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
      // Mismatch
      matched.loginAttempts = (matched.loginAttempts || 0) + 1;
      let msg = `Invalid Email or Password. Attempt ${matched.loginAttempts} of 4.`;

      if (matched.loginAttempts >= 4) {
        matched.isLocked = true;
        matched.kycStatus = "Locked"; // Mirror status
        msg = "Incorrect credentials. Account has been locked due to 4 failed attempts. Contact a Super User.";

        // Trigger Alerts and Audits
        await saveDocument("notifications", {
          msg: `Customer Account Locked: "${matched.email}" (${matched.companyName}) after 4 failed login attempts.`,
          read: false,
          ts: new Date().toLocaleString(),
          type: "danger"
        });
        await saveDocument("auditLog", {
          ts: new Date().toLocaleString(),
          user: "System Gate",
          action: "SECURITY LOCK",
          module: "Auth Gate",
          record: `Locked customer account ${matched.email} (${matched.companyName}) after 4 failed attempts`,
          ip: "127.0.0.1"
        });
      }

      await saveDocument("customerUsers", matched, matched.id);
      errEl.style.display = "block";
      errEl.textContent = msg;
      setTimeout(() => { if (!matched.isLocked) errEl.style.display = "none"; }, 3000);
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

    const customersList = await getCollection("customerUsers") || [];
    if (customersList.some(c => c.email.toLowerCase() === email.toLowerCase())) {
      err.style.display = "block";
      err.textContent = "Email is already registered";
      setTimeout(() => { err.style.display = "none"; }, 2500);
      return;
    }

    // Hash the password securely!
    const hashedPasswordStr = await hashPassword(pass);

    const newCustomer = {
      companyName: company,
      contactPerson: contact,
      email: email,
      password: hashedPasswordStr, // HASH SECURED
      phone: phone,
      role: 'fr8xflow',
      kycStatus: "Pending",
      kycInfo: {
        gst,
        pan,
        address,
        docName
      },
      handlerId: "",
      loginAttempts: 0,
      isLocked: false
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

  async handleSendOTP(email, errEl, container, initials, logoUrl, companyName) {
    if (!email) {
      errEl.style.display = "block";
      errEl.textContent = "Please enter your email address.";
      setTimeout(() => { errEl.style.display = "none"; }, 3000);
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check staff first, then customer users
    const users = await getCollection("users") || [];
    const customers = await getCollection("customerUsers") || [];

    const matchedStaff = users.find(u => (u.email || "").toLowerCase() === trimmedEmail);
    const matchedCust = customers.find(c => (c.email || "").toLowerCase() === trimmedEmail);

    if (!matchedStaff && !matchedCust) {
      errEl.style.display = "block";
      errEl.textContent = "Email address not registered.";
      setTimeout(() => { errEl.style.display = "none"; }, 3000);
      return;
    }

    // Generate 6 digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    if (matchedStaff) {
      matchedStaff.otpCode = otp;
      matchedStaff.otpExpiry = expiry;
      await saveDocument("users", matchedStaff, matchedStaff.id);
    } else {
      matchedCust.otpCode = otp;
      matchedCust.otpExpiry = expiry;
      await saveDocument("customerUsers", matchedCust, matchedCust.id);
    }

    this.forgotEmail = trimmedEmail;

    // Send the OTP email
    const subject = "CargoPulse Password Reset OTP";
    const body = `Hello,\n\nWe received a request to reset your password on the CargoPulse portal.\n\nYour One-Time Passcode (OTP) is: ${otp}\n\nThis OTP is valid for 5 minutes.\n\nIf you did not request this, you can safely ignore this email.\n\nBest regards,\nSupport Team`;
    
    sendPortalEmail(trimmedEmail, subject, body);

    showToast("Reset OTP has been sent to your email address.", "success");

    // Transition to verification phase
    this.mode = "reset";
    this.renderCardContent(container, initials, logoUrl, companyName);
  }

  async handleResetSubmit(otp, newPass, confirmPass, errEl, container, initials, logoUrl, companyName) {
    if (!otp || !newPass || !confirmPass) {
      errEl.style.display = "block";
      errEl.textContent = "All fields are required.";
      setTimeout(() => { errEl.style.display = "none"; }, 3000);
      return;
    }

    if (newPass.length < 6) {
      errEl.style.display = "block";
      errEl.textContent = "New password must be at least 6 characters.";
      setTimeout(() => { errEl.style.display = "none"; }, 3000);
      return;
    }

    if (newPass !== confirmPass) {
      errEl.style.display = "block";
      errEl.textContent = "Passwords do not match.";
      setTimeout(() => { errEl.style.display = "none"; }, 3000);
      return;
    }

    // Look up user
    const users = await getCollection("users") || [];
    const customers = await getCollection("customerUsers") || [];

    const matchedStaff = users.find(u => (u.email || "").toLowerCase() === this.forgotEmail);
    const matchedCust = customers.find(c => (c.email || "").toLowerCase() === this.forgotEmail);

    const record = matchedStaff || matchedCust;
    const collectionName = matchedStaff ? "users" : "customerUsers";

    if (!record || record.otpCode !== otp) {
      errEl.style.display = "block";
      errEl.textContent = "Incorrect OTP code.";
      setTimeout(() => { errEl.style.display = "none"; }, 3000);
      return;
    }

    if (Date.now() > record.otpExpiry) {
      errEl.style.display = "block";
      errEl.textContent = "OTP has expired. Please request a new one.";
      setTimeout(() => { errEl.style.display = "none"; }, 3000);
      return;
    }

    // Successful reset! Hash the new password
    const hashed = await hashPassword(newPass);
    record.password = hashed;
    record.loginAttempts = 0; // Reset attempts

    // Unlock
    if (matchedStaff) {
      if (record.status === "Locked") {
        record.status = "Active";
      }
    } else {
      record.isLocked = false;
      if (record.kycStatus === "Locked") {
        record.kycStatus = "Approved"; // Restore to approved status
      }
    }

    // Clear OTP fields
    delete record.otpCode;
    delete record.otpExpiry;

    await saveDocument(collectionName, record, record.id);

    // Audit Log
    await saveDocument("auditLog", {
      ts: new Date().toLocaleString(),
      user: "System Gate",
      action: "PASSWORD RESET",
      module: "Auth Gate",
      record: `Successfully reset password for account: ${this.forgotEmail}`,
      ip: "127.0.0.1"
    });

    showToast("Password reset successfully! Please log in.", "success");

    // Transition back to login view
    this.mode = "login";
    this.renderCardContent(container, initials, logoUrl, companyName);
  }
}

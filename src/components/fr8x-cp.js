import { getCollection, saveDocument } from "../services/db.js";
import { showToast, showConfirm } from "../services/ui.js";

export class Fr8xCP {
  constructor() {
    this.chatHistory = [
      {
        sender: "ai",
        text: "Hello! Welcome to the **FR8X-CP Customer Portal**. I am your **FR8X-AI Logistics Assistant**.",
        ts: new Date()
      },
      {
        sender: "ai",
        text: "I have real-time access to our operations database. You can ask me to track cargo, list billing invoices, check container detention risks, or lookup standard specs. \n\nTry clicking one of the **Quick Query Chips** below or ask me directly!",
        ts: new Date()
      }
    ];
    this.rates = { INR: 83.50, EUR: 0.92, USD: 1.00 }; // Fallback values
    this.activeCurrency = "USD";
  }

  async render() {
    // Attempt to fetch live rates
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      if (res.ok) {
        const data = await res.json();
        if (data && data.rates) {
          this.rates = data.rates;
        }
      }
    } catch (e) {
      console.warn("Live exchange rate fetch failed in FR8X-CP. Using cached fallbacks.", e);
    }

    const ports = await getCollection("ports") || [];
    const shipments = await getCollection("shipments") || [];

    const container = document.createElement("div");
    container.className = "fr8x-cp-panel";
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 24px;
      animation: fadeIn 0.3s ease-in-out;
    `;

    container.innerHTML = `
      <style>
        .grid-layout {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 24px;
        }
        @media (max-width: 1024px) {
          .grid-layout {
            grid-template-columns: 1fr;
          }
        }
        .cp-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 24px;
          box-shadow: var(--shadow);
          transition: var(--transition);
        }
        .cp-card:hover {
          box-shadow: var(--shadow-md);
        }
        .chat-feed {
          height: 380px;
          overflow-y: auto;
          padding: 16px;
          background: rgba(0, 0, 0, 0.03);
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        body.dark-mode .chat-feed {
          background: rgba(255, 255, 255, 0.02);
        }
        .msg-bubble {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13.5px;
          line-height: 1.5;
          word-break: break-word;
        }
        .msg-ai {
          background: var(--bg-hover);
          color: var(--text-main);
          align-self: flex-start;
          border-bottom-left-radius: 2px;
          border: 1px solid var(--border);
        }
        .msg-user {
          background: var(--primary);
          color: #fff;
          align-self: flex-end;
          border-bottom-right-radius: 2px;
        }
        .msg-ai table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          font-size: 11px;
        }
        .msg-ai th, .msg-ai td {
          border: 1px solid var(--border);
          padding: 6px;
          text-align: left;
        }
        .msg-ai th {
          background: var(--bg-app);
          font-weight: 600;
        }
        .chip {
          background: var(--primary-light);
          color: var(--primary);
          padding: 6px 12px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: var(--transition);
          display: inline-block;
        }
        .chip:hover {
          background: var(--primary);
          color: #fff;
        }
        .chat-input-container {
          display: flex;
          gap: 8px;
        }
        .chat-input {
          flex: 1;
          padding: 12px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-main);
          outline: none;
          font-size: 13px;
        }
        .chat-input:focus {
          border-color: var(--primary);
        }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        .btn-action {
          width: 100%;
          padding: 12px;
          font-size: 13.5px;
          font-weight: 600;
          border-radius: var(--radius-md);
          justify-content: center;
        }
        .est-result {
          background: var(--success-light);
          border: 1px dashed var(--success);
          border-radius: var(--radius-md);
          padding: 16px;
          margin-top: 16px;
          animation: slideDown 0.2s ease-out;
        }
        .est-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-main);
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .est-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 6px;
          color: var(--text-muted);
        }
        .est-row.total {
          border-top: 1px solid var(--border);
          padding-top: 8px;
          font-weight: 700;
          color: var(--text-main);
          font-size: 14px;
        }
      </style>

      <!-- Panel Title -->
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2 style="font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">FR8X-CP Customer Operations Portal</h2>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">AI-assisted container rates, real-time shipment monitoring, and global calculations.</p>
        </div>
        <div class="badge b-purple" style="font-size: 12px; padding: 6px 12px; font-weight:700;"><i class="ti ti-cpu" style="margin-right:4px;"></i> Powered by FR8X-AI</div>
      </div>

      <div class="grid-layout">
        <!-- LEFT: Chatbot Interface -->
        <div class="cp-card" style="display:flex; flex-direction:column; justify-content:space-between; min-height: 520px;">
          <div>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
              <div style="width:36px; height:36px; background:var(--info); border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:18px;">
                <i class="ti ti-cpu"></i>
              </div>
              <div>
                <h3 style="font-size:15px; font-weight:700;">FR8X-AI Assistant</h3>
                <p style="font-size:11px; color:var(--text-muted);">In-app intelligence. Ask about jobs, containers, bills, or specs.</p>
              </div>
            </div>

            <!-- Scrollable feed -->
            <div class="chat-feed" id="fr8x-chat-feed">
              ${this.chatHistory.map(m => `
                <div class="msg-bubble ${m.sender === 'ai' ? 'msg-ai' : 'msg-user'}">
                  ${this.formatMessage(m.text)}
                </div>
              `).join('')}
            </div>
          </div>

          <div>
            <!-- Quick Chips -->
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;" id="chat-quick-chips">
              <span class="chip" data-query="track job JB-2606-0001">Track Job JB-2606-0001</span>
              <span class="chip" data-query="where is container MSCU4892110?">Container MSCU4892110</span>
              <span class="chip" data-query="show invoices">Show Invoices</span>
              <span class="chip" data-query="what are 40HC dimensions?">40HC Dimensions</span>
              <span class="chip" data-query="detention risk alert">Detention Risks</span>
            </div>

            <!-- Input bar -->
            <div class="chat-input-container">
              <input type="text" class="chat-input" id="fr8x-chat-input" placeholder="Type logistics tracking queries (e.g. 'track container TEMU8899123' or 'customs clearance')..." />
              <button class="btn pr" id="fr8x-chat-send" style="padding:12px 18px; border-radius:var(--radius-md);"><i class="ti ti-send"></i></button>
            </div>
          </div>
        </div>

        <!-- RIGHT: Rates Calculator & Graph stats -->
        <div style="display:flex; flex-direction:column; gap:24px;">
          <!-- Rates Estimator Card -->
          <div class="cp-card">
            <h3 style="font-size:15px; font-weight:700; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
              <i class="ti ti-calculator" style="color:var(--primary)"></i> Ocean Freight Rate Estimator
            </h3>
            
            <div class="form-grid">
              <div class="fg">
                <label style="font-size:11px; font-weight:600;">Port of Loading (POL)</label>
                <select id="est-pol" style="padding:8px; border-radius:6px; font-size:12.5px;">
                  ${ports.map(p => `<option value="${p.code}">${p.name} [${p.code}]</option>`).join('')}
                </select>
              </div>
              <div class="fg">
                <label style="font-size:11px; font-weight:600;">Port of Discharge (POD)</label>
                <select id="est-pod" style="padding:8px; border-radius:6px; font-size:12.5px;">
                  ${ports.map(p => `<option value="${p.code}" ${p.code === 'NLRTM' ? 'selected' : ''}>${p.name} [${p.code}]</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-grid">
              <div class="fg">
                <label style="font-size:11px; font-weight:600;">Container Size</label>
                <select id="est-size" style="padding:8px; border-radius:6px; font-size:12.5px;">
                  <option value="20GP">20GP Standard Container</option>
                  <option value="40GP">40GP Standard Container</option>
                  <option value="40HC" selected>40HC High Cube Container</option>
                </select>
              </div>
              <div class="fg">
                <label style="font-size:11px; font-weight:600;">Cargo Type</label>
                <select id="est-cargo" style="padding:8px; border-radius:6px; font-size:12.5px;">
                  <option value="general">General Dry Cargo</option>
                  <option value="hazardous">Hazardous / IMDG Class Cargo</option>
                  <option value="pharma">Temperature Controlled (Pharma)</option>
                </select>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <span style="font-size:12px; color:var(--text-muted); font-weight:500;">Display Currency</span>
              <div style="display:flex; gap:6px;">
                <button class="btn sm ${this.activeCurrency === 'USD' ? 'pr' : ''}" id="cur-usd" style="padding:4px 8px; font-size:10px;">USD</button>
                <button class="btn sm ${this.activeCurrency === 'INR' ? 'pr' : ''}" id="cur-inr" style="padding:4px 8px; font-size:10px;">INR</button>
                <button class="btn sm ${this.activeCurrency === 'EUR' ? 'pr' : ''}" id="cur-eur" style="padding:4px 8px; font-size:10px;">EUR</button>
              </div>
            </div>

            <button class="btn pr btn-action" id="btn-calculate-rates"><i class="ti ti-play-card" style="margin-right:4px;"></i> Calculate Freight Estimate</button>

            <!-- Results container -->
            <div id="estimator-results-wrap" style="display:none;"></div>
          </div>

          <!-- Volume Graphics Card -->
          <div class="cp-card">
            <h3 style="font-size:15px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
              <i class="ti ti-chart-bar" style="color:var(--info)"></i> Shipment Volume Analysis
            </h3>
            <p style="font-size:11px; color:var(--text-muted); margin-bottom:16px;">Monthly distribution count of all booking states registered in the system.</p>
            <div style="height: 180px; position: relative;">
              <canvas id="cp-volume-chart"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      this.initEvents(container);
      this.renderVolumeChart(container, shipments);
    }, 50);

    return container;
  }

  initEvents(container) {
    const input = container.querySelector("#fr8x-chat-input");
    const sendBtn = container.querySelector("#fr8x-chat-send");
    
    // Chat Enter key
    if (input) {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.handleUserMessage(input, container);
      });
    }

    // Chat Send click
    if (sendBtn) {
      sendBtn.onclick = () => this.handleUserMessage(input, container);
    }

    // Chip triggers
    container.querySelectorAll("#chat-quick-chips .chip").forEach(chip => {
      chip.onclick = () => {
        const query = chip.dataset.query;
        if (input) {
          input.value = query;
          this.handleUserMessage(input, container);
        }
      };
    });

    // Rate Currency buttons
    const curUsd = container.querySelector("#cur-usd");
    const curInr = container.querySelector("#cur-inr");
    const curEur = container.querySelector("#cur-eur");

    const selectCurrency = (cur) => {
      this.activeCurrency = cur;
      [curUsd, curInr, curEur].forEach(btn => btn?.classList.remove("pr"));
      if (cur === "USD") curUsd?.classList.add("pr");
      if (cur === "INR") curInr?.classList.add("pr");
      if (cur === "EUR") curEur?.classList.add("pr");

      // Re-trigger estimate calculation if active
      if (container.querySelector("#estimator-results-wrap").style.display !== "none") {
        this.calculateEstimate(container);
      }
    };

    if (curUsd) curUsd.onclick = () => selectCurrency("USD");
    if (curInr) curInr.onclick = () => selectCurrency("INR");
    if (curEur) curEur.onclick = () => selectCurrency("EUR");

    // Calculate Rate trigger
    const calcBtn = container.querySelector("#btn-calculate-rates");
    if (calcBtn) {
      calcBtn.onclick = () => this.calculateEstimate(container);
    }
  }

  formatMessage(text) {
    if (window.marked && window.marked.parse) {
      return window.marked.parse(text);
    }
    // Simple robust markdown parser if marked isn't available
    return text
      .replace(/\n/g, "<br/>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code>$1</code>");
  }

  async handleUserMessage(inputEl, container) {
    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = "";

    // Append User message
    this.chatHistory.push({ sender: "user", text, ts: new Date() });
    this.refreshChatFeed(container);

    // AI typing/loader indicator
    const feed = container.querySelector("#fr8x-chat-feed");
    const loaderBubble = document.createElement("div");
    loaderBubble.className = "msg-bubble msg-ai";
    loaderBubble.innerHTML = `<i class="ti ti-loader animate-spin" style="font-size:16px;"></i> Thinking...`;
    feed?.appendChild(loaderBubble);
    if (feed) feed.scrollTop = feed.scrollHeight;

    // Process AI response with delay to simulate thinking
    setTimeout(async () => {
      loaderBubble.remove();
      const aiReply = await this.getAIResponse(text);
      this.chatHistory.push({ sender: "ai", text: aiReply, ts: new Date() });
      this.refreshChatFeed(container);
    }, 600);
  }

  refreshChatFeed(container) {
    const feed = container.querySelector("#fr8x-chat-feed");
    if (feed) {
      feed.innerHTML = this.chatHistory.map(m => `
        <div class="msg-bubble ${m.sender === 'ai' ? 'msg-ai' : 'msg-user'}">
          ${this.formatMessage(m.text)}
        </div>
      `).join('');
      feed.scrollTop = feed.scrollHeight;
    }
  }

  async getAIResponse(query) {
    const qLower = query.toLowerCase();

    // 1. Match Job tracking: e.g. JB-2606-0001
    const jobRegex = /JB-\d{4}-\d{4}/i;
    const matchedJob = query.match(jobRegex);

    if (matchedJob) {
      const jobNo = matchedJob[0].toUpperCase();
      const shipments = await getCollection("shipments") || [];
      const s = shipments.find(x => x.jobNo.toUpperCase() === jobNo);

      if (s) {
        let timelineRows = "";
        if (s.timeline && s.timeline.length > 0) {
          timelineRows = s.timeline.map(t => `| ${t.date} | ${t.event} | ${t.user || 'Ops'} | ${t.remarks || '—'} |`).join('\n');
        }

        return `### 🔍 Live Tracking Record: **${s.jobNo}**
Here is the real-time operational status for job **${s.jobNo}** retrieved from the server database:

* **Customer**: ${s.customer}
* **Booking Ref**: \`${s.bookingNo || '—'}\`
* **Carrier BL**: \`${s.blNo || 'Draft / Awaiting Final'}\`
* **Vessel / Voyage**: \`${s.vessel || 'TBA'} v.${s.voyage || '—'}\`
* **Route**: **${s.pol}** (Port of Loading) ➔ **${s.pod}** (Port of Discharge)
* **ETA Destination**: \`${s.eta || 'Awaiting Schedule'}\` (ETD: ${s.etd || '—'})
* **Status**: **${s.status}**
* **Container Loading**: \`${s.containerDetails || 'LCL Cargo'}\`

#### Shipment Operational Timeline
| Date | Milestone Event | Logged By | Status / Remarks |
| :--- | :--- | :--- | :--- |
${timelineRows || '| No logs | — | — | — |'}

_Status updated. Operational sync verified._`;
      } else {
        return `⚠️ **Shipment Job not found.** 
I queried the database for Job Number **${jobNo}**, but no records were found. Please confirm the number is typed correctly (format: \`JB-XXXX-XXXX\`).`;
      }
    }

    // 2. Match Container tracking: e.g. MSCU4892110
    const contRegex = /[A-Z]{4}\d{7}/i;
    const matchedCont = query.match(contRegex);

    if (matchedCont) {
      const containerNo = matchedCont[0].toUpperCase();
      const containers = await getCollection("containers") || [];
      const c = containers.find(x => x.containerNo.toUpperCase() === containerNo);

      if (c) {
        return `### 📦 Container Tracking: **${c.containerNo}**
I checked the active container database. Here is the operational state:

* **Container No**: **${c.containerNo}** (\`${c.size} ${c.type}\`)
* **Associated Job**: **${c.jobNo}**
* **Carrier Line**: ${c.shippingLine}
* **Sailing/Gate-in**: Gate In: \`${c.gateInDate || '—'}\` | Departed: \`${c.sailingDate || '—'}\`
* **Port Arrival (ETA)**: \`${c.arrivalDate || '—'}\`
* **Free Time Expiry**: \`${c.freeTimeExpiry || '—'}\`
* **Current Status**: **${c.status}**
* **Detention Risk Alert**: ${c.detentionRisk ? `🔴 **HIGH RISK** (Container is near or past free time limits!)` : `🟢 **NORMAL** (Within free time limits)`}

${c.status !== 'Returned' && c.detentionRisk ? `> ⚠️ **Urgent Action Required**: Please coordinate immediate container pickup and empty de-hire to prevent demurrage charges.` : ''}`;
      } else {
        return `⚠️ **Container not found.**
No container with number **${containerNo}** was found in our lease or detention monitor records. Please confirm the SCAC + 7 digit serial code.`;
      }
    }

    // 3. Match Invoices/Billing: e.g. show invoices
    if (qLower.includes("invoice") || qLower.includes("billing") || qLower.includes("unpaid") || qLower.includes("payment")) {
      const invoices = await getCollection("invoices") || [];
      if (invoices.length === 0) {
        return `💳 **Billing Summary**: 
There are currently no generated invoice records in the system database.`;
      }

      let totalOutstanding = 0;
      let totalCollected = 0;
      let rows = invoices.map(i => {
        const amt = i.total.toLocaleString('en-IN', { style: 'currency', currency: i.currency || 'INR' });
        if (i.status === 'Paid') {
          totalCollected += i.total;
        } else {
          totalOutstanding += i.total;
        }
        return `| ${i.invNo} | ${i.jobNo} | ${i.customer} | **${amt}** | ${i.status === 'Paid' ? '🟢 Paid' : '🔴 Unpaid'} | ${i.dueDate} |`;
      }).join('\n');

      return `### 💳 Billing & Invoice ledger Summary
I scanned our customer ledger for you. Here is the current standing:

* 🟢 **Total Collected**: INR ${totalCollected.toLocaleString('en-IN')}
* 🔴 **Total Outstanding (Unpaid)**: INR ${totalOutstanding.toLocaleString('en-IN')}

#### Client Invoices List
| Inv No | Job # | Customer Rep | Total Amount | Status | Due Date |
| :--- | :--- | :--- | :--- | :--- | :--- |
${rows}

Let me know if you want to drill down into a specific invoice number or get shipment breakdowns.`;
    }

    // 4. Match Container Specs
    if (qLower.includes("dimensions") || qLower.includes("specs") || qLower.includes("container size") || qLower.includes("40hc") || qLower.includes("20gp") || qLower.includes("40gp")) {
      return `### 📐 Ocean Freight Container Dimensions & Payload Specifications
Here are the global ISO standard dimensions for GP and HC containers:

| Container Size | Inner Dimensions (L x W x H) | Tare Weight | Max Cargo Payload | Volume Capacity |
| :--- | :--- | :--- | :--- | :--- |
| **20GP (Standard)** | 5.90m x 2.35m x 2.39m | 2,300 kg | **28,200 kg** | 33.2 cbm |
| **40GP (Standard)** | 12.03m x 2.35m x 2.39m | 3,750 kg | **28,800 kg** | 67.7 cbm |
| **40HC (High Cube)** | 12.03m x 2.35m x 2.69m | 3,900 kg | **28,600 kg** | 76.4 cbm |

*Note: High Cube containers give you an extra **30 cm (1 foot)** of height, which is ideal for voluminous but light cargo.*`;
    }

    // 5. Match Detention Risks
    if (qLower.includes("detention") || qLower.includes("risk") || qLower.includes("demurrage")) {
      const containers = await getCollection("containers") || [];
      const riskContainers = containers.filter(c => c.detentionRisk && c.status !== 'Returned');

      if (riskContainers.length === 0) {
        return `🟢 **Detention Risk Monitor**:
All active containers in the system are currently within their designated shipping line free days limit. No risk alerts found.`;
      }

      const list = riskContainers.map(c => `* 📦 Container **${c.containerNo}** (Job: **${c.jobNo}**) | Line: **${c.shippingLine}** | Free Expiry: \`${c.freeTimeExpiry}\` (Status: \`${c.status}\`)`).join('\n');

      return `### 🔴 HIGH DETENTION RISK ALERTS
I scanned the active container registry. The following container(s) are near or past their free-time expiry:

${list}

**Logistics Recommendation:**
Ensure the drayage operator picks up these containers from terminal gates, delivers to warehouse, and returns empty shells to depots prior to the free expiry dates to avoid high daily demurrage fees.`;
    }

    // 6. Generic Logistics Help / Welcome FAQ
    return `### 💬 How can I assist you?
I am the logistics helper. I couldn't find a direct database match for your prompt. 

**Quick Guide to commands:**
* To track a booking: type **"track job JB-2606-0001"**
* To look up a box: type **"track container MSCU4892110"**
* To see finances: type **"show invoices"**
* To check demurrage warning: type **"detention risks"**
* To see standard container dimensions: type **"40HC dimensions"**

You can also ask about HS codes, IMDG cargo classes, ocean terminal definitions, or custom requirements!`;
  }

  calculateEstimate(container) {
    const pol = container.querySelector("#est-pol").value;
    const pod = container.querySelector("#est-pod").value;
    const size = container.querySelector("#est-size").value;
    const cargo = container.querySelector("#est-cargo").value;
    const resultsWrap = container.querySelector("#estimator-results-wrap");

    if (!pol || !pod) {
      showToast("Please select POL and POD", "warning");
      return;
    }

    // Rate calculations
    let baseRate = 1200; // default base USD
    
    // Check specific route matches
    if (pol === "INNSA" && pod === "NLRTM") {
      baseRate = size === "20GP" ? 1500 : size === "40HC" ? 2400 : 2200;
    } else if (pol === "INNSA" && pod === "USNYC") {
      baseRate = size === "20GP" ? 2200 : size === "40HC" ? 3600 : 3400;
    } else if (pol === "INNSA" && pod === "AEDXB") {
      baseRate = size === "20GP" ? 600 : size === "40HC" ? 1000 : 900;
    } else {
      // General routes
      baseRate = size === "20GP" ? 1100 : size === "40HC" ? 1900 : 1700;
    }

    // Cargo Type adjustments
    let surcharge = 0;
    let surchargeLabel = "None";
    if (cargo === "hazardous") {
      surcharge = baseRate * 0.30;
      surchargeLabel = "Hazardous Surcharge (30%)";
    } else if (cargo === "pharma") {
      surcharge = baseRate * 0.50;
      surchargeLabel = "Temperature Control Reef Surcharge (50%)";
    }

    const docFee = 50;
    const othc = size === "20GP" ? 150 : 250;
    const dthc = size === "20GP" ? 180 : 280;

    const totalUsd = baseRate + surcharge + docFee + othc + dthc;

    // Convert currency using live API rates
    const rateFactor = this.rates[this.activeCurrency] || 1;
    const symbol = this.activeCurrency === "INR" ? "₹" : this.activeCurrency === "EUR" ? "€" : "$";

    const formatVal = (usdVal) => {
      const val = usdVal * rateFactor;
      return symbol + " " + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    resultsWrap.style.display = "block";
    resultsWrap.innerHTML = `
      <div class="est-result">
        <div class="est-title">
          <span>Ocean Freight Estimate Breakdown</span>
          <span class="badge b-green" style="font-size:11px;">Estimate Ready</span>
        </div>
        <div class="est-row">
          <span>Route Base Freight (${size})</span>
          <span style="font-weight:600; color:var(--text-main);">${formatVal(baseRate)}</span>
        </div>
        ${surcharge > 0 ? `
        <div class="est-row">
          <span>${surchargeLabel}</span>
          <span style="font-weight:600; color:var(--danger);">+ ${formatVal(surcharge)}</span>
        </div>
        ` : ''}
        <div class="est-row">
          <span>Origin Terminal Handling (OTHC)</span>
          <span style="font-weight:600; color:var(--text-main);">${formatVal(othc)}</span>
        </div>
        <div class="est-row">
          <span>Destination Terminal Handling (DTHC)</span>
          <span style="font-weight:600; color:var(--text-main);">${formatVal(dthc)}</span>
        </div>
        <div class="est-row">
          <span>Documentation / BL Processing</span>
          <span style="font-weight:600; color:var(--text-main);">${formatVal(docFee)}</span>
        </div>
        <div class="est-row total">
          <span>Total Estimated Cost (${this.activeCurrency})</span>
          <span style="color:var(--primary);">${formatVal(totalUsd)}</span>
        </div>
        <div style="font-size:10px; color:var(--text-muted); margin-top:8px; font-style:italic; text-align:center;">
          Exchange rates applied: 1 USD = ${this.rates.INR.toFixed(2)} INR | 1 EUR = ${(this.rates.INR / this.rates.EUR).toFixed(2)} INR. Base pricing is subject to spot rate cargo margins.
        </div>
      </div>
    `;

    showToast("Freight rates compiled successfully.", "success");
  }

  renderVolumeChart(container, shipments) {
    const canvas = container.querySelector("#cp-volume-chart");
    if (!canvas) return;

    // Compile shipment volumes by month
    const statuses = {};
    shipments.forEach(s => {
      const state = s.status || "Booking Created";
      statuses[state] = (statuses[state] || 0) + 1;
    });

    const labels = Object.keys(statuses);
    const data = Object.values(statuses);

    if (window.Chart) {
      const isDark = document.body.classList.contains("dark-mode");
      const textColor = isDark ? "#9ca3af" : "#64748b";
      const borderColor = isDark ? "#374151" : "#e2e8f0";

      new window.Chart(canvas, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Shipment Status Volume',
            data: data,
            backgroundColor: [
              'rgba(37, 99, 235, 0.75)',  // Blue
              'rgba(139, 92, 246, 0.75)', // Violet
              'rgba(16, 185, 129, 0.75)', // Green
              'rgba(245, 158, 11, 0.75)',  // Amber
              'rgba(100, 116, 139, 0.75)'  // Gray
            ],
            borderColor: [
              '#2563eb',
              '#8b5cf6',
              '#10b981',
              '#f59e0b',
              '#64748b'
            ],
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: textColor,
                font: { size: 10 }
              }
            },
            y: {
              grid: {
                color: borderColor
              },
              ticks: {
                color: textColor,
                font: { size: 10 },
                stepSize: 1
              }
            }
          }
        }
      });
    } else {
      console.warn("Chart.js library not loaded yet.");
    }
  }
}

/**
 * gst-engine.js
 * Centralized, stateless GST tax engine.
 * Determines CGST/SGST vs IGST split for each invoice line.
 * No UI imports. Fully deterministic.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Indian State Code Map (GST State Code → State Name)
// ─────────────────────────────────────────────────────────────────────────────
export const GSTIN_STATE_MAP = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman & Diu",
  "26": "Dadra & Nagar Haveli",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction"
};

// ─────────────────────────────────────────────────────────────────────────────
// GST Transaction Type constants
// ─────────────────────────────────────────────────────────────────────────────
export const GST_TYPE = {
  CGST_SGST: "CGST_SGST",    // Intra-state: CGST + SGST each at rate/2
  IGST:      "IGST",          // Inter-state: full IGST
  ZERO_IGST: "ZERO_IGST",     // Export / SEZ supply: 0% IGST
  EXEMPT:    "EXEMPT",         // Exempt supply (no GST, no ITC)
  NIL:       "NIL",            // Nil-rated (listed in schedule)
  NON_GST:   "NON_GST",        // Outside GST scope
  REVERSE:   "REVERSE",        // Reverse charge mechanism
  REVIEW:    "REVIEW"          // Missing location data — needs manual review
};

// ─────────────────────────────────────────────────────────────────────────────
// Extract 2-digit state code from a 15-char GSTIN
// ─────────────────────────────────────────────────────────────────────────────
export function stateCodeFromGSTIN(gstin) {
  if (!gstin || typeof gstin !== "string") return null;
  const clean = gstin.trim().toUpperCase();
  if (clean.length >= 2 && /^\d{2}/.test(clean)) {
    return clean.substring(0, 2);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolve effective state code for a party
// Priority: GSTIN prefix > explicit stateCode field > null
// ─────────────────────────────────────────────────────────────────────────────
export function resolveStateCode(gstin, explicitStateCode) {
  return stateCodeFromGSTIN(gstin) || explicitStateCode || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveGSTType
// Determines the GST transaction type from supplier & recipient context.
//
// @param {string|null} supplierStateCode  - 2-digit state code of supplier
// @param {string|null} recipientStateCode - 2-digit state code of recipient
// @param {object}      flags              - Optional overrides
//   flags.isExport         {boolean} - true = export of goods/services
//   flags.isSEZ            {boolean} - true = SEZ unit/developer
//   flags.isExempt         {boolean} - true = exempt supply
//   flags.isNilRated       {boolean} - true = nil-rated supply
//   flags.isNonGST         {boolean} - true = outside GST scope
//   flags.isReverseCharge  {boolean} - true = reverse charge applicable
// @returns {string} - one of GST_TYPE constants
// ─────────────────────────────────────────────────────────────────────────────
export function resolveGSTType(supplierStateCode, recipientStateCode, flags = {}) {
  const {
    isExport = false,
    isSEZ = false,
    isExempt = false,
    isNilRated = false,
    isNonGST = false,
    isReverseCharge = false
  } = flags;

  if (isNonGST)    return GST_TYPE.NON_GST;
  if (isExempt)    return GST_TYPE.EXEMPT;
  if (isNilRated)  return GST_TYPE.NIL;
  if (isExport || isSEZ) return GST_TYPE.ZERO_IGST;
  if (isReverseCharge) {
    if (!supplierStateCode || !recipientStateCode) return GST_TYPE.REVERSE;
    return supplierStateCode === recipientStateCode
      ? GST_TYPE.CGST_SGST
      : GST_TYPE.IGST;
  }

  if (!supplierStateCode || !recipientStateCode) return GST_TYPE.REVIEW;

  return supplierStateCode === recipientStateCode
    ? GST_TYPE.CGST_SGST
    : GST_TYPE.IGST;
}

// ─────────────────────────────────────────────────────────────────────────────
// calcLineTax
// Calculates tax amounts for a single invoice line.
//
// @param {number} taxableAmt - Taxable amount for the line (qty × rate)
// @param {number} gstRate    - GST rate percentage (e.g. 18 for 18%)
// @param {string} gstType    - One of GST_TYPE constants
// @returns {{ cgst, sgst, igst, gstAmt, lineTotal, gstType, gstRate, taxableAmt }}
// ─────────────────────────────────────────────────────────────────────────────
export function calcLineTax(taxableAmt, gstRate, gstType) {
  const amt  = parseFloat(taxableAmt) || 0;
  const rate = parseFloat(gstRate) || 0;

  let cgst = 0, sgst = 0, igst = 0;

  switch (gstType) {
    case GST_TYPE.CGST_SGST:
      cgst = round2(amt * (rate / 2) / 100);
      sgst = round2(amt * (rate / 2) / 100);
      break;
    case GST_TYPE.IGST:
    case GST_TYPE.REVERSE:
      igst = round2(amt * rate / 100);
      break;
    case GST_TYPE.ZERO_IGST:
      igst = 0;
      break;
    case GST_TYPE.NIL:
    case GST_TYPE.EXEMPT:
    case GST_TYPE.NON_GST:
    case GST_TYPE.REVIEW:
    default:
      break;
  }

  const gstAmt   = cgst + sgst + igst;
  const lineTotal = round2(amt + gstAmt);

  return { cgst, sgst, igst, gstAmt, lineTotal, gstType, gstRate: rate, taxableAmt: amt };
}

// ─────────────────────────────────────────────────────────────────────────────
// calcInvoiceTax
// Processes all invoice lines and returns full invoice-level tax summary.
//
// @param {Array}  lines              - Array of { qty, rate, gstRate, [taxableAmt] }
// @param {string} supplierStateCode  - 2-digit supplier state
// @param {string} recipientStateCode - 2-digit recipient state
// @param {object} flags              - Same flags as resolveGSTType
// @returns {{ lines[], subtotal, cgstTotal, sgstTotal, igstTotal, totalGST, grandTotal, gstType }}
// ─────────────────────────────────────────────────────────────────────────────
export function calcInvoiceTax(lines, supplierStateCode, recipientStateCode, flags = {}) {
  const gstType = resolveGSTType(supplierStateCode, recipientStateCode, flags);

  let subtotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;

  const computedLines = (lines || []).map(line => {
    const taxAmt  = parseFloat(line.taxableAmt) || ((parseFloat(line.qty) || 1) * (parseFloat(line.rate) || 0));
    const lineTax = calcLineTax(taxAmt, line.gstRate || 0, gstType);
    subtotal  += lineTax.taxableAmt;
    cgstTotal += lineTax.cgst;
    sgstTotal += lineTax.sgst;
    igstTotal += lineTax.igst;
    return { ...line, ...lineTax };
  });

  subtotal  = round2(subtotal);
  cgstTotal = round2(cgstTotal);
  sgstTotal = round2(sgstTotal);
  igstTotal = round2(igstTotal);
  const totalGST   = round2(cgstTotal + sgstTotal + igstTotal);
  const grandTotal = round2(subtotal + totalGST);

  return { lines: computedLines, subtotal, cgstTotal, sgstTotal, igstTotal, totalGST, grandTotal, gstType };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Validate a 15-char GSTIN format */
export function validateGSTIN(gstin) {
  if (!gstin) return { valid: false, error: "GSTIN is missing" };
  const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!pattern.test(gstin.trim().toUpperCase())) {
    return { valid: false, error: "Invalid GSTIN format (expected 15-char GSTIN)" };
  }
  return { valid: true, error: null };
}

/** Get human-readable label for a GST type */
export function gstTypeLabel(gstType) {
  const labels = {
    [GST_TYPE.CGST_SGST]: "CGST + SGST (Intra-State)",
    [GST_TYPE.IGST]:       "IGST (Inter-State)",
    [GST_TYPE.ZERO_IGST]:  "Zero-Rated IGST (Export/SEZ)",
    [GST_TYPE.EXEMPT]:     "GST Exempt",
    [GST_TYPE.NIL]:        "Nil-Rated",
    [GST_TYPE.NON_GST]:    "Non-GST Supply",
    [GST_TYPE.REVERSE]:    "Reverse Charge",
    [GST_TYPE.REVIEW]:     "⚠ Missing Location — Review Required"
  };
  return labels[gstType] || gstType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal utility
// ─────────────────────────────────────────────────────────────────────────────
function round2(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

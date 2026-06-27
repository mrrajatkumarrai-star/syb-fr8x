/**
 * einvoice-adapter.js
 * e-Invoice adapter layer — separate from UI and invoice entry.
 *
 * Responsibilities:
 *  1. Build the GSTN IRP/GSP-compliant JSON payload from a saved invoice.
 *  2. Store the IRN response (irn, ackNo, ackDt, signedQR, signedInvoice) in the DB.
 *  3. Manage IRN status lifecycle: draft → submitted → success | failed | cancelled
 *
 * NOTE: This module does NOT call any external API. It prepares the payload
 * that a certified GSP/IRP integration would submit. The actual HTTP call
 * is a future integration hook. Wire it at storeIRNResponse().
 */

import { saveDocument, getCollection } from "./db.js";

// ─────────────────────────────────────────────────────────────────────────────
// IRN Status constants
// ─────────────────────────────────────────────────────────────────────────────
export const IRN_STATUS = {
  DRAFT:     "draft",
  SUBMITTED: "submitted",
  SUCCESS:   "success",
  FAILED:    "failed",
  CANCELLED: "cancelled"
};

// ─────────────────────────────────────────────────────────────────────────────
// buildIRNPayload
// Constructs the GSTN e-Invoice JSON payload (schema version 1.1) from
// a saved invoice object and the company settings.
//
// @param {object} invoice  - Saved invoice document from the DB
// @param {object} settings - Company profile from settings collection
// @returns {object}        - Structured payload ready for IRP/GSP submission
// ─────────────────────────────────────────────────────────────────────────────
export function buildIRNPayload(invoice, settings) {
  const now = new Date();
  const docDate = formatIRNDate(invoice.invoiceDate || now.toISOString().split("T")[0]);

  // Supplier (from company settings)
  const supGSTIN   = (settings.gst || "").trim().toUpperCase();
  const supLegal   = (settings.company || "").toUpperCase();
  const supAddr1   = (settings.address || "").split(",")[0] || "";
  const supState   = settings.companyStateCode || stateCodeFromGSTIN(supGSTIN) || "27";
  const supPincode = "400001"; // fallback; ideally from settings

  // Recipient (from invoice's stored recipient data)
  const recGSTIN  = (invoice.recipientGSTIN || "").trim().toUpperCase();
  const recLegal  = (invoice.customer || "").toUpperCase();
  const recAddr1  = (invoice.recipientAddress || "").split(",")[0] || "";
  const recState  = invoice.recipientStateCode || stateCodeFromGSTIN(recGSTIN) || "99";
  const recPincode = "999999"; // fallback

  const isExport = invoice.isExport || false;
  const isSEZ    = invoice.isSEZ    || false;
  const supType  = isExport ? "EXP" : isSEZ ? "SEZWP" : "B2B";

  // Line items (GSTN ItemList)
  const itemList = (invoice.items || []).map((item, idx) => {
    const taxableAmt = parseFloat(item.taxableAmt) || ((parseFloat(item.qty) || 1) * (parseFloat(item.rate) || 0));
    const gstRate    = parseFloat(item.gstRate) || 0;
    const cgstRate   = invoice.gstType === "CGST_SGST" ? gstRate / 2 : 0;
    const sgstRate   = invoice.gstType === "CGST_SGST" ? gstRate / 2 : 0;
    const igstRate   = invoice.gstType === "IGST"      ? gstRate : 0;

    return {
      SlNo:       String(idx + 1),
      PrdDesc:    (item.desc || "Service").toUpperCase().substring(0, 300),
      IsServc:    "Y",           // freight services are always services
      HsnCd:      item.sacCode || item.hsn || "996521", // SAC for freight services
      Qty:        parseFloat(item.qty) || 1,
      Unit:       "OTH",
      UnitPrice:  parseFloat(item.rate) || 0,
      TotAmt:     round2(taxableAmt),
      Discount:   0,
      AssAmt:     round2(taxableAmt),
      GstRt:      gstRate,
      CgstAmt:    round2(parseFloat(item.cgst) || 0),
      SgstAmt:    round2(parseFloat(item.sgst) || 0),
      IgstAmt:    round2(parseFloat(item.igst) || 0),
      CesRt:      0,
      CesAmt:     0,
      CesNonAdvlAmt: 0,
      StateCesRt:   0,
      StateCesAmt:  0,
      StateCesNonAdvlAmt: 0,
      OthChrg:    0,
      TotItemVal: round2(parseFloat(item.lineTotal) || taxableAmt)
    };
  });

  // Value details
  const subtotal  = round2(parseFloat(invoice.subtotal) || 0);
  const cgstTotal = round2(parseFloat(invoice.cgstTotal) || 0);
  const sgstTotal = round2(parseFloat(invoice.sgstTotal) || 0);
  const igstTotal = round2(parseFloat(invoice.igstTotal) || 0);
  const totalGST  = round2(parseFloat(invoice.totalGST) || (invoice.gstAmount || 0));
  const grandTotal = round2(parseFloat(invoice.total) || (subtotal + totalGST));

  const payload = {
    Version: "1.1",
    TranDtls: {
      TaxSch:    "GST",
      SupTyp:    supType,
      RegRev:    invoice.isReverseCharge ? "Y" : "N",
      EcmGstin:  null,
      IgstOnIntra: "N"
    },
    DocDtls: {
      Typ:   "INV",
      No:    invoice.invNo,
      Dt:    docDate
    },
    SellerDtls: {
      Gstin:   supGSTIN,
      LglNm:   supLegal,
      TrdNm:   supLegal,
      Addr1:   supAddr1 || ".",
      Addr2:   "",
      Loc:     settings.companyState || "Mumbai",
      Pin:     supPincode,
      Stcd:    supState,
      Ph:      settings.phone || "",
      Em:      settings.email || ""
    },
    BuyerDtls: {
      Gstin:   recGSTIN || "URP",
      LglNm:   recLegal,
      TrdNm:   recLegal,
      Pos:     invoice.placeOfSupply || recState,
      Addr1:   recAddr1 || ".",
      Addr2:   "",
      Loc:     invoice.recipientState || "",
      Pin:     recPincode,
      Stcd:    recState,
      Ph:      invoice.recipientPhone || "",
      Em:      invoice.recipientEmail || ""
    },
    ItemList: itemList,
    ValDtls: {
      AssVal:  subtotal,
      CgstVal: cgstTotal,
      SgstVal: sgstTotal,
      IgstVal: igstTotal,
      CesVal:  0,
      StCesVal: 0,
      Discount: 0,
      OthChrg: 0,
      RndOffAmt: 0,
      TotInvVal: grandTotal,
      TotInvValFc: 0
    }
  };

  return payload;
}

// ─────────────────────────────────────────────────────────────────────────────
// storeIRNResponse
// Persists the IRN response from an IRP/GSP call into the invoice document.
//
// @param {string} invoiceId   - The invoice document ID in the DB
// @param {object} irnResponse - Response from IRP/GSP:
//   { irn, ackNo, ackDt, signedQR, signedInvoice, status }
// ─────────────────────────────────────────────────────────────────────────────
export async function storeIRNResponse(invoiceId, irnResponse) {
  if (!invoiceId || !irnResponse) return;

  const invoices = await getCollection("invoices");
  const inv = invoices.find(i => i.id === invoiceId);
  if (!inv) throw new Error(`Invoice ${invoiceId} not found`);

  const irnData = {
    irn:           irnResponse.irn           || null,
    ackNo:         irnResponse.ackNo         || null,
    ackDt:         irnResponse.ackDt         || null,
    signedQR:      irnResponse.signedQR      || null,
    signedInvoice: irnResponse.signedInvoice || null,
    submittedAt:   new Date().toLocaleString(),
    status:        irnResponse.status        || IRN_STATUS.FAILED
  };

  const updatedInv = {
    ...inv,
    irnStatus: irnData.status,
    irnData
  };

  await saveDocument("invoices", updatedInv, invoiceId);

  // Audit
  await saveDocument("auditLog", {
    ts:     new Date().toLocaleString(),
    user:   "e-Invoice System",
    action: "IRN_" + irnData.status.toUpperCase(),
    module: "Invoice",
    record: `${inv.invNo} — IRN: ${irnData.irn || "N/A"} | AckNo: ${irnData.ackNo || "N/A"}`,
    ip:     "127.0.0.1"
  });

  return updatedInv;
}

// ─────────────────────────────────────────────────────────────────────────────
// markInvoiceSubmitted
// Transitions an invoice from draft to submitted status before IRN response.
// ─────────────────────────────────────────────────────────────────────────────
export async function markInvoiceSubmitted(invoiceId) {
  const invoices = await getCollection("invoices");
  const inv = invoices.find(i => i.id === invoiceId);
  if (!inv) return;
  await saveDocument("invoices", { ...inv, irnStatus: IRN_STATUS.SUBMITTED }, invoiceId);
}

// ─────────────────────────────────────────────────────────────────────────────
// cancelIRN
// Marks a successfully generated IRN as cancelled.
// NOTE: In production, IRP cancellation API must be called first.
// ─────────────────────────────────────────────────────────────────────────────
export async function cancelIRN(invoiceId) {
  const invoices = await getCollection("invoices");
  const inv = invoices.find(i => i.id === invoiceId);
  if (!inv) return;
  const irnData = { ...(inv.irnData || {}), status: IRN_STATUS.CANCELLED };
  await saveDocument("invoices", { ...inv, irnStatus: IRN_STATUS.CANCELLED, irnData }, invoiceId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function formatIRNDate(dateStr) {
  // GSTN requires DD/MM/YYYY
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function stateCodeFromGSTIN(gstin) {
  if (!gstin || gstin.length < 2) return null;
  return gstin.substring(0, 2);
}

function round2(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

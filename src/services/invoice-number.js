/**
 * invoice-number.js
 * Concurrency-safe invoice number generator.
 *
 * Format: {prefix}/{FY}/{NNNN}
 * Example: INV/2526/0042
 *
 * FY = Indian financial year (Apr-Mar). e.g. Apr 2025 – Mar 2026 = "2526"
 * Sequence stored in `invoiceSequence` collection, keyed by "{prefix}-{FY}".
 * Cancelled invoice numbers are never reused.
 */

import { getCollection, saveDocument } from "./db.js";

// ─────────────────────────────────────────────────────────────────────────────
// Derive current Indian Financial Year string (e.g. "2526")
// ─────────────────────────────────────────────────────────────────────────────
export function currentFY() {
  const now   = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year  = now.getFullYear();
  // Indian FY starts in April (month 4)
  const startYear = month >= 4 ? year : year - 1;
  const endYear   = startYear + 1;
  return String(startYear).slice(-2) + String(endYear).slice(-2); // e.g. "2526"
}

// ─────────────────────────────────────────────────────────────────────────────
// generateInvoiceNumber
// Returns the next unique invoice number as a string.
//
// @param {string} prefix      - Invoice prefix, e.g. "INV" or "INVMUM"
// @param {string} [branchCode] - Optional branch suffix to namespace sequences
// @param {number} [padLen=4]  - Sequence zero-padding length
// @returns {Promise<string>}  - e.g. "INV/2526/0043"
// ─────────────────────────────────────────────────────────────────────────────
export async function generateInvoiceNumber(prefix = "INV", branchCode = "", padLen = 4) {
  const fy       = currentFY();
  const seqKey   = `${prefix}${branchCode ? "-" + branchCode : ""}-${fy}`;
  const colName  = "invoiceSequence";

  // Load all sequences (small collection)
  const sequences = await getCollection(colName);
  let seqDoc = sequences.find(s => s.id === seqKey);

  if (!seqDoc) {
    seqDoc = { id: seqKey, prefix, branchCode, fy, lastSeq: 0, cancelled: [] };
  }

  let nextSeq = (seqDoc.lastSeq || 0) + 1;

  // Skip numbers that were cancelled (never reuse)
  const cancelled = seqDoc.cancelled || [];
  while (cancelled.includes(nextSeq)) {
    nextSeq++;
  }

  // Persist updated sequence
  const updated = { ...seqDoc, lastSeq: nextSeq };
  await saveDocument(colName, updated, seqKey);

  // Build the formatted invoice number
  const seq = String(nextSeq).padStart(padLen, "0");
  const branchPart = branchCode ? `${branchCode}/` : "";
  return `${prefix}/${branchPart}${fy}/${seq}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// cancelInvoiceNumber
// Marks an invoice number's sequence slot as cancelled so it is never reused.
//
// @param {string} invNo   - Full invoice number string e.g. "INV/2526/0043"
// @param {string} prefix  - The prefix used (e.g. "INV")
// @param {string} [branchCode]
// ─────────────────────────────────────────────────────────────────────────────
export async function cancelInvoiceNumber(invNo, prefix = "INV", branchCode = "") {
  if (!invNo) return;

  // Extract sequence number from last segment
  const parts = invNo.split("/");
  const seqNum = parseInt(parts[parts.length - 1], 10);
  if (isNaN(seqNum)) return;

  // Extract FY from second-to-last or detect
  let fy = currentFY();
  if (parts.length >= 3) {
    // Format: PREFIX/FY/NNNN or PREFIX/BRANCH/FY/NNNN
    fy = parts[parts.length - 2];
    if (!/^\d{4}$/.test(fy)) fy = currentFY();
  }

  const seqKey  = `${prefix}${branchCode ? "-" + branchCode : ""}-${fy}`;
  const colName = "invoiceSequence";

  const sequences = await getCollection(colName);
  const seqDoc    = sequences.find(s => s.id === seqKey);
  if (!seqDoc) return;

  const cancelled = seqDoc.cancelled || [];
  if (!cancelled.includes(seqNum)) {
    cancelled.push(seqNum);
    await saveDocument(colName, { ...seqDoc, cancelled }, seqKey);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// peekNextNumber
// Returns what the next invoice number WOULD be, without incrementing.
// Useful for previewing the number in the form before saving.
// ─────────────────────────────────────────────────────────────────────────────
export async function peekNextNumber(prefix = "INV", branchCode = "", padLen = 4) {
  const fy       = currentFY();
  const seqKey   = `${prefix}${branchCode ? "-" + branchCode : ""}-${fy}`;
  const colName  = "invoiceSequence";

  const sequences = await getCollection(colName);
  const seqDoc    = sequences.find(s => s.id === seqKey);

  let nextSeq    = ((seqDoc && seqDoc.lastSeq) || 0) + 1;
  const cancelled = (seqDoc && seqDoc.cancelled) || [];
  while (cancelled.includes(nextSeq)) nextSeq++;

  const seq = String(nextSeq).padStart(padLen, "0");
  const branchPart = branchCode ? `${branchCode}/` : "";
  return `${prefix}/${branchPart}${fy}/${seq}`;
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, addDoc, collection, getDocs, updateDoc, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

// Initialize Firebase App & Firestore
let firebaseApp = null;
let firestoreDb = null;
let useFirestore = false;

try {
  if (firebaseConfig && firebaseConfig.apiKey) {
    firebaseApp = initializeApp(firebaseConfig);
    firestoreDb = getFirestore(firebaseApp);
    useFirestore = true;
  } else {
    console.log("Firebase config apiKey is empty, using LocalStorage.");
  }
} catch (e) {
  console.warn("Firebase initialization failed, falling back to LocalStorage:", e);
}

// Default Seed Data
const SEED_DATA = {
  settings: {
    company: 'Global Logistics Solutions Ltd',
    gst: '27AABCG1234Z1Z9',
    currency: 'INR',
    country: 'India',
    email: 'info@globallogistics.com',
    phone: '+91 22 6789 1234',
    address: '102, Logistics Tower, MIDC, Andheri East, Mumbai, MH 400069',
    jobPrefix: 'JB',
    companyInitials: 'GLS',
    companyLogo: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&q=80&w=200'
  },
  customers: [
    { id: 'c1', code: 'CUST-001', company: 'Tata Motors Ltd', contactPerson: 'Rohan Joshi', phone: '+91 98200 12345', email: 'rohan.joshi@tatamotors.com', country: 'India', gst: '27AAAAT1234C1Z1', address: 'Pimpri, Pune, MH', creditLimit: 1500000, paymentTerms: 'Net 30', status: 'Active', currency: 'INR' },
    { id: 'c2', code: 'CUST-002', company: 'Reliance Industries', contactPerson: 'Anjali Mehta', phone: '+91 98111 22233', email: 'anjali.mehta@ril.com', country: 'India', gst: '24AAACR4321B1Z2', address: 'Jamnagar, Gujarat', creditLimit: 2000000, paymentTerms: 'Net 45', status: 'Active', currency: 'INR' },
    { id: 'c3', code: 'CUST-003', company: 'Apex Pharma Corp', contactPerson: 'Dr. S. K. Sen', phone: '+91 98400 98765', email: 'sk.sen@apexpharma.com', country: 'India', gst: '33AAAAP9999M1Z3', address: 'Guindy, Chennai, TN', creditLimit: 800000, paymentTerms: 'Advance', status: 'Active', currency: 'INR' },
    { id: 'c4', code: 'CUST-004', company: 'Zenith Exports LLC', contactPerson: 'John Smith', phone: '+1 212 555 0199', email: 'jsmith@zenithexports.com', country: 'USA', gst: '', address: '5th Ave, New York, NY', creditLimit: 1000000, paymentTerms: 'Net 15', status: 'Active', currency: 'USD' }
  ],
  vendors: [
    { id: 'v1', code: 'VEND-001', company: 'Ocean Star Shipping Line', vendorType: 'Shipping Line', contactPerson: 'Capt. Vikram', phone: '+91 22 2456 7890', email: 'bookings@oceanstar.com', address: 'Nariman Point, Mumbai', gst: '27AAAFO1234D1Z2', status: 'Active', outstanding: 350000 },
    { id: 'v2', code: 'VEND-002', company: 'Swift Overland Trucking', vendorType: 'Transporter', contactPerson: 'Gurpreet Singh', phone: '+91 98222 33344', email: 'swift@overland.com', address: 'Kalamboli, Navi Mumbai', gst: '27AAAFS2222E1Z3', status: 'Active', outstanding: 120000 },
    { id: 'v3', code: 'VEND-003', company: 'Indo Customs Agency (CHA)', vendorType: 'CHA', contactPerson: 'Mahesh Patil', phone: '+91 98201 11222', email: 'mahesh@indochaservices.com', address: 'JNPT, Nhava Sheva', gst: '27AAACI5555F1Z4', status: 'Active', outstanding: 45000 },
    { id: 'v4', code: 'VEND-004', company: 'Vessel Ops Marine Agency', vendorType: 'Shipping Line', contactPerson: 'Sanjay Nair', phone: '+91 22 4000 5000', email: 'ops@vesselops.com', address: 'Ballard Estate, Mumbai', gst: '27AAACV7777G1Z5', status: 'Active', outstanding: 0 }
  ],
  ports: [
    { id: 'p1', code: 'INNSA', name: 'Nhava Sheva (JNPT)', country: 'India', type: 'Sea Port', unlocode: 'INNSA', timezone: 'UTC+5:30' },
    { id: 'p2', code: 'INBOM', name: 'Mumbai Port', country: 'India', type: 'Sea Port', unlocode: 'INBOM', timezone: 'UTC+5:30' },
    { id: 'p3', code: 'USNYC', name: 'New York Port', country: 'USA', type: 'Sea Port', unlocode: 'USNYC', timezone: 'UTC-5:00' },
    { id: 'p4', code: 'NLRTM', name: 'Rotterdam Port', country: 'Netherlands', type: 'Sea Port', unlocode: 'NLRTM', timezone: 'UTC+1:00' },
    { id: 'p5', code: 'AEDXB', name: 'Dubai Port (Jebel Ali)', country: 'UAE', type: 'Sea Port', unlocode: 'AEDXB', timezone: 'UTC+4:00' },
    { id: 'p6', code: 'INDEL', name: 'Delhi IGI Airport', country: 'India', type: 'Airport', unlocode: 'INDEL', timezone: 'UTC+5:30' }
  ],
  shippingLines: [
    { id: 'sl1', scac: 'MSCU', name: 'MSC Shipping Line', agent: 'MSC Agency India', contact: 'Deepak Shah', email: 'in-bookings@msc.com', freeDays: 14, demurrageDays: 7, status: 'Active' },
    { id: 'sl2', scac: 'MAEU', name: 'Maersk Line', agent: 'Maersk India Pvt Ltd', contact: 'Rahul Sen', email: 'bookings@maersk.com', freeDays: 14, demurrageDays: 7, status: 'Active' },
    { id: 'sl3', scac: 'COSU', name: 'COSCO Shipping', agent: 'COSCO India Agency', contact: 'K. C. Feng', email: 'booking@coscoindia.com', freeDays: 14, demurrageDays: 7, status: 'Active' },
    { id: 'sl4', scac: 'CMAU', name: 'CMA CGM', agent: 'CMA CGM Agencies India', contact: 'Amit Kumar', email: 'mumbai.bookings@cma-cgm.com', freeDays: 14, demurrageDays: 7, status: 'Active' }
  ],
  commodities: [
    { id: 'com1', hsCode: '87082990', description: 'Motor Vehicle Parts', category: 'Automobile Parts', hazardous: 'No', imdgClass: '', unNumber: '' },
    { id: 'com2', hsCode: '30049099', description: 'Pharmaceutical Formulations', category: 'Medicines', hazardous: 'No', imdgClass: '', unNumber: '' },
    { id: 'com3', hsCode: '29051100', description: 'Methanol (Methyl Alcohol)', category: 'Organic Chemicals', hazardous: 'Yes', imdgClass: '3', unNumber: '1230' },
    { id: 'com4', hsCode: '52081190', description: 'Woven Cotton Fabric', category: 'Textiles', hazardous: 'No', imdgClass: '', unNumber: '' }
  ],
  chargeHeads: [
    { id: 'ch1', code: 'OCF', name: 'Ocean Freight', type: 'Revenue', gstRate: 0, sacCode: '996521', description: 'Ocean Carriage Charges' },
    { id: 'ch2', code: 'OTHC', name: 'Origin Terminal Handling Charge', type: 'Revenue', gstRate: 18, sacCode: '996711', description: 'OTHC at Loading Port' },
    { id: 'ch3', code: 'DTHC', name: 'Destination Terminal Handling Charge', type: 'Revenue', gstRate: 18, sacCode: '996711', description: 'DTHC at Discharge Port' },
    { id: 'ch4', code: 'CMC', name: 'Container Monitoring Charge', type: 'Expense', gstRate: 18, sacCode: '996719', description: 'Container Monitoring' },
    { id: 'ch5', code: 'BLF', name: 'Bill of Lading Fee', type: 'Revenue', gstRate: 18, sacCode: '996719', description: 'BL documentation charge' },
    { id: 'ch6', code: 'CUS', name: 'Customs Clearance Fee', type: 'Revenue', gstRate: 18, sacCode: '996712', description: 'CHA clearance services' }
  ],
  shipments: [
    {
      id: 's_m1', jobNo: 'JB-2606-0001', type: 'FCL Export', customer: 'Tata Motors Ltd', shipper: 'Tata Motors Ltd', consignee: 'Rotterdam Auto Distributors BV', bookingNo: 'BKG9920192', blNo: 'MSCU98172651', pol: 'INNSA', pod: 'NLRTM', finalDest: 'Rotterdam', incoterm: 'FOB', vessel: 'MSC BRUXELLES', voyage: '2604W', etd: '2026-06-05', eta: '2026-06-28', commodity: 'Motor Vehicle Parts', grossWeight: 14500, volume: 52, packages: 400, containerDetails: '1x40HC', notifyParty: 'Rotterdam Logistics Agent', remarks: 'Priority automobile shipment', status: 'Vessel Sailed', createdAt: '04 Jun 2026, 10:15 AM',
      timeline: [
        { event: 'Booking Created', date: '2026-06-04', user: 'Super Admin', remarks: 'Booking requested' },
        { event: 'Booking Confirmed', date: '2026-06-04', user: 'Ravi Kumar', remarks: 'Booking confirmed by MSC' },
        { event: 'CRO Received', date: '2026-06-04', user: 'Ravi Kumar', remarks: 'CRO reference MSC-221A' },
        { event: 'Empty Released', date: '2026-06-05', user: 'Ravi Kumar', remarks: 'Depot Nhava Sheva' },
        { event: 'Gate In', date: '2026-06-07', user: 'Ravi Kumar', remarks: 'Gated In at JNPT Terminal' },
        { event: 'Vessel Sailed', date: '2026-06-09', user: 'Ravi Kumar', remarks: 'Vessel departed at 14:00' }
      ]
    },
    {
      id: 's_m2', jobNo: 'JB-2606-0002', type: 'FCL Export', customer: 'Reliance Industries', shipper: 'Reliance Industries', consignee: 'New York Polymers Inc', bookingNo: 'BKG998811A', blNo: '', pol: 'INNSA', pod: 'USNYC', finalDest: 'New York', incoterm: 'CIF', vessel: 'MAERSK KENSINGTON', voyage: '0602E', etd: '2026-06-15', eta: '2026-07-08', commodity: 'Methanol (Methyl Alcohol)', grossWeight: 22000, volume: 30, packages: 1, containerDetails: '1x20GP', notifyParty: 'East Coast Logistics LLC', remarks: 'Chemical shipment, hazardous', status: 'Gate In', createdAt: '08 Jun 2026, 02:30 PM',
      timeline: [
        { event: 'Booking Created', date: '2026-06-08', user: 'Super Admin', remarks: 'Haz declaration approved' },
        { event: 'Booking Confirmed', date: '2026-06-09', user: 'Ravi Kumar', remarks: 'Booking confirmed by Maersk' },
        { event: 'CRO Received', date: '2026-06-10', user: 'Ravi Kumar', remarks: '' },
        { event: 'Container Picked', date: '2026-06-11', user: 'Ravi Kumar', remarks: 'Picked from yard' },
        { event: 'Gate In', date: '2026-06-12', user: 'Ravi Kumar', remarks: 'Gated in at GTI Terminal' }
      ]
    },
    {
      id: 's_m3', jobNo: 'JB-2606-0003', type: 'Air Export', customer: 'Apex Pharma Corp', shipper: 'Apex Pharma Corp', consignee: 'Gulf Health Distribution Dubai', bookingNo: 'AWB99118276', blNo: 'AWB99118276', pol: 'INDEL', pod: 'AEDXB', finalDest: 'Dubai International', incoterm: 'CIP', vessel: 'Air India AI-901', voyage: 'AI-901', etd: '2026-06-14', eta: '2026-06-14', commodity: 'Pharmaceutical Formulations', grossWeight: 450, volume: 2.4, packages: 30, containerDetails: 'Loose Air Cargo', notifyParty: 'Gulf Health Distribution Dubai', remarks: 'Temp controlled pharma cargo (2-8 deg C)', status: 'Customs Clearance', createdAt: '10 Jun 2026, 11:00 AM',
      timeline: [
        { event: 'Booking Created', date: '2026-06-10', user: 'Priya Sharma', remarks: 'Pharma packing checked' },
        { event: 'Booking Confirmed', date: '2026-06-10', user: 'Priya Sharma', remarks: 'Space confirmed on AI-901' },
        { event: 'Customs Clearance', date: '2026-06-12', user: 'Mahesh CHA', remarks: 'Customs examination done' }
      ]
    },
    {
      id: 's_m4', jobNo: 'JB-2606-0004', type: 'FCL Import', customer: 'Zenith Exports LLC', shipper: 'Rotterdam Petrochem BV', consignee: 'Zenith Exports LLC', bookingNo: 'BKG881022', blNo: 'COSU887265112', pol: 'NLRTM', pod: 'INNSA', finalDest: 'JNPT', incoterm: 'EXW', vessel: 'COSCO NETHERLANDS', voyage: '052E', etd: '2026-05-10', eta: '2026-06-05', commodity: 'Woven Cotton Fabric', grossWeight: 18900, volume: 65, packages: 120, containerDetails: '1x40HC', notifyParty: 'Zenith Exports LLC', remarks: 'Cleared and delivered', status: 'Closed', createdAt: '08 May 2026, 09:00 AM',
      timeline: [
        { event: 'Booking Created', date: '2026-05-08', user: 'Priya Sharma', remarks: '' },
        { event: 'Gate In', date: '2026-05-09', user: 'System', remarks: '' },
        { event: 'Vessel Sailed', date: '2026-05-12', user: 'System', remarks: '' },
        { event: 'Arrival POD', date: '2026-06-04', user: 'Ravi Kumar', remarks: 'Arrived at JNPT' },
        { event: 'Customs Clearance', date: '2026-06-06', user: 'Mahesh CHA', remarks: 'Duty paid' },
        { event: 'Delivered', date: '2026-06-08', user: 'Ravi Kumar', remarks: 'Delivered to client warehouse' },
        { event: 'Closed', date: '2026-06-10', user: 'Super Admin', remarks: 'Return complete' }
      ]
    }
  ],
  containers: [
    { id: 'cont_m1', containerNo: 'MSCU4892110', jobNo: 'JB-2606-0001', size: '40HC', type: 'Dry', sealNo: 'SL998822', shippingLine: 'MSC Shipping Line', gateInDate: '2026-06-07', sailingDate: '2026-06-09', arrivalDate: '2026-06-28', freeTimeExpiry: '2026-07-12', returnDate: '', status: 'Sailed', detentionRisk: false },
    { id: 'cont_m2', containerNo: 'MSKU1122334', jobNo: 'JB-2606-0002', size: '20GP', type: 'Dry', sealNo: 'SL778811', shippingLine: 'Maersk Line', gateInDate: '2026-06-12', sailingDate: '', arrivalDate: '2026-07-08', freeTimeExpiry: '2026-07-22', returnDate: '', status: 'In Use', detentionRisk: false },
    { id: 'cont_m3', containerNo: 'TEMU8899123', jobNo: 'JB-2606-0004', size: '40HC', type: 'Dry', sealNo: 'SL332211', shippingLine: 'COSCO Shipping', gateInDate: '2026-05-09', sailingDate: '2026-05-12', arrivalDate: '2026-06-05', freeTimeExpiry: '2026-06-19', returnDate: '2026-06-08', status: 'Returned', detentionRisk: false },
    { id: 'cont_m4', containerNo: 'DFSU6611229', jobNo: 'JB-2606-0004', size: '40HC', type: 'Dry', sealNo: 'SL332212', shippingLine: 'COSCO Shipping', gateInDate: '2026-05-09', sailingDate: '2026-05-12', arrivalDate: '2026-06-05', freeTimeExpiry: '2026-06-14', returnDate: '', status: 'Arrived', detentionRisk: true }
  ],
  documents: [
    { id: 'd1', jobNo: 'JB-2606-0001', docType: 'Booking Confirmation', version: 1, fileName: 'msc_bkg_JB26060001.pdf', uploadedBy: 'Ravi Kumar', uploadedAt: '2026-06-04', customerVisible: true, status: 'Approved', remarks: 'Confirmed by MSC' },
    { id: 'd2', jobNo: 'JB-2606-0001', docType: 'CRO', version: 1, fileName: 'msc_cro_JB26060001.pdf', uploadedBy: 'Ravi Kumar', uploadedAt: '2026-06-04', customerVisible: false, status: 'Approved', remarks: '' },
    { id: 'd3', jobNo: 'JB-2606-0002', docType: 'Booking Confirmation', version: 1, fileName: 'maersk_bkg_JB26060002.pdf', uploadedBy: 'Ravi Kumar', uploadedAt: '2026-06-09', customerVisible: true, status: 'Approved', remarks: '' }
  ],
  invoices: [
    {
      id: 'inv_m1', invNo: 'INV-2606-0001', jobNo: 'JB-2606-0001', customer: 'Tata Motors Ltd', invoiceDate: '2026-06-05', dueDate: '2026-07-05',
      items: [
        { desc: 'Ocean Freight (40HC)', qty: 1, rate: 120000, amount: 120000 },
        { desc: 'Origin Terminal Handling Charge (OTHC)', qty: 1, rate: 18000, amount: 18000 },
        { desc: 'Bill of Lading Documentation Fee', qty: 1, rate: 3500, amount: 3500 }
      ],
      subtotal: 141500, gstRate: 18, gstAmount: 25470, total: 166970, currency: 'INR', status: 'Unpaid', remarks: 'Ocean freight invoice', createdAt: '05 Jun 2026, 11:30 AM'
    },
    {
      id: 'inv_m2', invNo: 'INV-2606-0002', jobNo: 'JB-2606-0004', customer: 'Zenith Exports LLC', invoiceDate: '2026-06-06', dueDate: '2026-06-21',
      items: [
        { desc: 'Ocean Freight (40HC)', qty: 1, rate: 98000, amount: 98000 },
        { desc: 'Customs Clearance Charge', qty: 1, rate: 8500, amount: 8500 },
        { desc: 'Port Handling Fee', qty: 1, rate: 6000, amount: 6000 }
      ],
      subtotal: 112500, gstRate: 18, gstAmount: 20250, total: 132750, currency: 'INR', status: 'Paid', remarks: '', createdAt: '06 Jun 2026, 04:00 PM', paidDate: '2026-06-08'
    }
  ],
  expenses: [
    { id: 'exp_m1', jobNo: 'JB-2606-0001', vendor: 'Ocean Star Shipping Line', chargeHead: 'Ocean Freight', amount: 95000, currency: 'INR', expenseDate: '2026-06-05', billNo: 'OS-99281', status: 'Paid', remarks: 'Paid via bank transfer' },
    { id: 'exp_m2', jobNo: 'JB-2606-0001', vendor: 'Swift Overland Trucking', chargeHead: 'Other', amount: 12500, currency: 'INR', expenseDate: '2026-06-06', billNo: 'SO-10292', status: 'Pending', remarks: 'Transportation from Pune factory' },
    { id: 'exp_m3', jobNo: 'JB-2606-0004', vendor: 'Indo Customs Agency (CHA)', chargeHead: 'Customs Clearance Fee', amount: 4500, currency: 'INR', expenseDate: '2026-06-06', billNo: 'CHA-99201', status: 'Paid', remarks: 'CHA charges' }
  ],
  tasks: [
    { id: 't_m1', name: 'Upload CRO for JB-2606-0002', jobNo: 'JB-2606-0002', description: 'Awaiting container release order from Maersk', assignedTo: 'Ravi Kumar', dueDate: '2026-06-14', priority: 'High', status: 'In Progress' },
    { id: 't_m2', name: 'Verify Custom Duty Receipt', jobNo: 'JB-2606-0003', description: 'Verify customs clearance duty payment receipt from client', assignedTo: 'Arjun Finance', dueDate: '2026-06-13', priority: 'Urgent', status: 'Open' },
    { id: 't_m3', name: 'BL Draft Approval from Client', jobNo: 'JB-2606-0001', description: 'Draft BL sent, waiting client confirmation', assignedTo: 'Priya Sharma', dueDate: '2026-06-15', priority: 'Medium', status: 'In Progress' }
  ],
  notifications: [
    { id: 'n_m1', msg: 'Shipment JB-2606-0002 gated-in at Nhava Sheva', type: 'info', ts: '12 Jun 2026, 05:45 PM', read: false },
    { id: 'n_m2', msg: 'Customs cleared for air export JB-2606-0003', type: 'info', ts: '12 Jun 2026, 03:20 PM', read: false }
  ],
  auditLog: [
    { id: 'a_m1', ts: '12 Jun 2026, 05:45 PM', user: 'Ravi Kumar', action: 'STATUS UPDATE', module: 'Shipment', record: 'JB-2606-0002: Container Picked → Gate In', ip: '10.0.0.12' },
    { id: 'a_m2', ts: '12 Jun 2026, 03:20 PM', user: 'Mahesh CHA', action: 'STATUS UPDATE', module: 'Shipment', record: 'JB-2606-0003: Booking Confirmed → Customs Clearance', ip: '10.0.0.87' }
  ],
  users: [
    { id: 'u1', name: 'Super Admin', email: 'admin@freightos.com', role: 'Super Admin', status: 'Active', password: '448d451316ef018c2937c83f4c1e2a9b68388dc1dbe62b10c5ff212ca40f3582' },
    { id: 'u2', name: 'Ravi Kumar', email: 'ravi@freightos.com', role: 'Operations', status: 'Active', password: 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f' },
    { id: 'u3', name: 'Priya Sharma', email: 'priya@freightos.com', role: 'Documentation', status: 'Active', password: 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f' },
    { id: 'u4', name: 'Arjun Finance', email: 'arjun@freightos.com', role: 'Finance', status: 'Active', password: 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f' }
  ],
  quotations: [
    { id: 'q1', quoteNo: 'QT-2606-0001', customer: 'Tata Motors Ltd', date: '2026-06-04', origin: 'INNSA', destination: 'NLRTM', total: 141500, status: 'Active', validity: '2026-07-04', commodity: 'Motor Vehicle Parts', remarks: 'Standard FCL 40HC rate', items: [{ desc: 'Ocean Freight', qty: 1, rate: 120000, amount: 120000 }, { desc: 'OTHC', qty: 1, rate: 18000, amount: 18000 }, { desc: 'BL Fee', qty: 1, rate: 3500, amount: 3500 }] },
    { id: 'q2', quoteNo: 'QT-2606-0002', customer: 'Reliance Industries', date: '2026-06-10', origin: 'INNSA', destination: 'USNYC', total: 90000, status: 'Active', validity: '2026-07-10', commodity: 'Methanol', remarks: 'Haz cargo surcharge included', items: [{ desc: 'Ocean Freight', qty: 1, rate: 90000, amount: 90000 }] }
  ],
  receipts: [
    { id: 'r1', receiptNo: 'REC-2606-0001', invNo: 'INV-2606-0002', customer: 'Zenith Exports LLC', receiptDate: '2026-06-08', amount: 132750, paymentMode: 'NEFT', refNo: 'NEFT192837192', remarks: 'Full payment received' }
  ],
  customerUsers: [
    { id: 'cu1', companyName: 'Tata Motors Ltd', email: 'tata@cargopulse.com', password: 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', kycStatus: 'Approved', kycInfo: { gst: '27AAAAT1234C1Z1', pan: 'AAAAT1234C', address: 'Pimpri, Pune, MH', docName: 'business_license.pdf' }, handlerId: 'u2' },
    { id: 'cu2', companyName: 'Reliance Industries', email: 'reliance@cargopulse.com', password: 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', kycStatus: 'Approved', kycInfo: { gst: '24AAACR4321B1Z2', pan: 'AAACR4321B', address: 'Jamnagar, Gujarat', docName: 'gst_certificate.pdf' }, handlerId: 'u3' },
    { id: 'cu3', companyName: 'New Client Corp', email: 'new@cargopulse.com', password: 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', kycStatus: 'Pending', kycInfo: { gst: '27AAACN5555X1Z9', pan: 'AAACN5555X', address: 'Bandra, Mumbai', docName: 'incorporation_cert.pdf' }, handlerId: '' }
  ],
  customerRequests: [
    { id: 'cr1', customerId: 'cu1', customerName: 'Tata Motors Ltd', requestType: 'Rate Request', status: 'Approved', createdAt: '2026-06-10', handlerId: 'u2', details: { origin: 'INNSA', destination: 'NLRTM', weight: 15000, volume: 60, commodity: 'Motor Vehicle Parts', containerType: '40HC', readyDate: '2026-06-25', remarks: 'Need competitive rate' }, chat: [{ sender: 'customer', text: 'Please offer best rates.', time: '2026-06-10 10:00 AM' }, { sender: 'handler', text: 'Sure, checking with MSC.', time: '2026-06-10 11:30 AM' }], transferredRef: 'QT-2606-0001' },
    { id: 'cr2', customerId: 'cu1', customerName: 'Tata Motors Ltd', requestType: 'Booking Request', status: 'Pending', createdAt: '2026-06-14', handlerId: 'u2', details: { origin: 'INNSA', destination: 'NLRTM', weight: 14000, volume: 55, commodity: 'Motor Vehicle Parts', containerType: '40HC', etd: '2026-06-30', shipper: 'Tata Motors Ltd', consignee: 'Rotterdam Auto Distributors BV', remarks: 'Awaiting container release' }, chat: [] },
    { id: 'cr3', customerId: 'cu2', customerName: 'Reliance Industries', requestType: 'Rate Request', status: 'Pending', createdAt: '2026-06-15', handlerId: 'u3', details: { origin: 'INNSA', destination: 'USNYC', weight: 22000, volume: 30, commodity: 'Methanol', containerType: '20GP', readyDate: '2026-06-28', remarks: 'Haz cargo' }, chat: [] }
  ]
};

// Initial local DB state
let localDB = {};

// Helper to load localStorage DB
function loadLocalDB() {
  try {
    const data = localStorage.getItem("freightos_erp_db");
    if (data) {
      localDB = JSON.parse(data);
    } else {
      localDB = JSON.parse(JSON.stringify(SEED_DATA));
      saveLocalDB();
    }
  } catch (e) {
    localDB = JSON.parse(JSON.stringify(SEED_DATA));
  }
}

function saveLocalDB() {
  try {
    localStorage.setItem("freightos_erp_db", JSON.stringify(localDB));
  } catch (e) {
    console.error("Failed to save to LocalStorage:", e);
  }
}

// Populate Firestore Database if empty
export async function seedFirestore() {
  if (!useFirestore || !firestoreDb) return;
  try {
    for (const key of Object.keys(SEED_DATA)) {
      const colRef = collection(firestoreDb, key);
      const snapshot = await getDocs(colRef);
      if (snapshot.empty) {
        console.log(`Seeding collection '${key}' to Firestore...`);
        const items = Array.isArray(SEED_DATA[key]) ? SEED_DATA[key] : [SEED_DATA[key]];
        for (const item of items) {
          const docId = item.id || 'settings'; // settings is a single doc
          await setDoc(doc(firestoreDb, key, docId), item);
        }
      }
    }
  } catch (e) {
    console.error("Firestore seeding failed:", e);
    useFirestore = false; // fallback
  }
}

// Database Connection check
export async function getDBStatus() {
  if (!useFirestore || !firestoreDb) return { online: false, provider: "localStorage" };
  try {
    // Attempt reading metadata/settings doc to prove connection
    await getDoc(doc(firestoreDb, "settings", "settings"));
    return { online: true, provider: "firestore" };
  } catch (e) {
    console.warn("Firestore connection check failed, using local storage mode:", e);
  }
  return { online: false, provider: "localStorage" };
}

// Core DB operations
export async function getCollection(colName) {
  loadLocalDB();
  const status = await getDBStatus();
  if (status.online) {
    try {
      const colRef = collection(firestoreDb, colName);
      const snapshot = await getDocs(colRef);
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ ...docSnap.data(), id: docSnap.id });
      });
      // Sync local copy
      localDB[colName] = list;
      saveLocalDB();
      // Settings is a single object in our local DB model
      if (colName === "settings") return list[0] || localDB.settings;
      return list;
    } catch (e) {
      console.error(`Failed to fetch from Firestore ${colName}, falling back to local:`, e);
    }
  }
  // Local storage fallback
  if (colName === "settings") return localDB.settings;
  return localDB[colName] || [];
}

export async function saveDocument(colName, docData, existingId = null) {
  loadLocalDB();
  const status = await getDBStatus();
  const id = existingId || docData.id || (colName === "settings" ? "settings" : Math.random().toString(36).substr(2, 9));
  const record = { ...docData, id };

  // Update Firestore
  if (status.online) {
    try {
      await setDoc(doc(firestoreDb, colName, id), record);
    } catch (e) {
      console.error(`Firestore save failed for ${colName}/${id}:`, e);
    }
  }

  // Update Local Storage
  if (colName === "settings") {
    localDB.settings = record;
  } else {
    if (!localDB[colName]) localDB[colName] = [];
    const idx = localDB[colName].findIndex(item => item.id === id);
    if (idx >= 0) {
      localDB[colName][idx] = record;
    } else {
      localDB[colName].unshift(record);
    }
  }
  saveLocalDB();
  return record;
}

export async function deleteDocument(colName, id) {
  loadLocalDB();
  const status = await getDBStatus();

  // Delete from Firestore
  if (status.online) {
    try {
      await deleteDoc(doc(firestoreDb, colName, id));
    } catch (e) {
      console.error(`Firestore delete failed for ${colName}/${id}:`, e);
    }
  }

  // Delete from Local Storage
  if (localDB[colName]) {
    localDB[colName] = localDB[colName].filter(item => item.id !== id);
    saveLocalDB();
  }
  return true;
}

export async function resetDatabase() {
  const status = await getDBStatus();
  if (status.online) {
    try {
      // Clear settings and collections in Firestore
      for (const key of Object.keys(SEED_DATA)) {
        const colRef = collection(firestoreDb, key);
        const snapshot = await getDocs(colRef);
        for (const docSnap of snapshot.docs) {
          await deleteDoc(doc(firestoreDb, key, docSnap.id));
        }
      }
    } catch (e) {
      console.error("Firestore database reset failed:", e);
    }
  }

  // Reset local storage
  localStorage.removeItem("freightos_erp_db");
  localDB = JSON.parse(JSON.stringify(SEED_DATA));
  saveLocalDB();

  // Re-seed Firestore
  if (status.online) {
    await seedFirestore();
  }
  return true;
}

// Initial Sync
loadLocalDB();
seedFirestore().then(() => {
  console.log("Firestore seed check complete.");
});

// SHA-256 Password Hashing helper
export async function hashPassword(pwd) {
  if (!pwd) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(pwd);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

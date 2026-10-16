import { PDFDocument, rgb, StandardFonts, PDFString } from 'pdf-lib';

/**
 * Generates realistic, valid multi-page PDF documents using pdf-lib
 * so that users have authentic sample PDFs ready to read immediately.
 */

export async function generateTaxFilingPdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Page 1: Form 1040-V & Schedule C Summary
  const page1 = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page1.getSize();

  // Header Bar
  page1.drawRectangle({
    x: 40,
    y: height - 60,
    width: width - 80,
    height: 3,
    color: rgb(0.05, 0.08, 0.15),
  });

  page1.drawText('INTERNAL REVENUE SERVICE • FORM 1040-V (SCHEDULE C)', {
    x: 40,
    y: height - 50,
    size: 10,
    font: boldFont,
    color: rgb(0.2, 0.25, 0.35),
  });

  page1.drawText('PAGE 1 OF 3', {
    x: width - 110,
    y: height - 50,
    size: 10,
    font: boldFont,
    color: rgb(0.4, 0.45, 0.55),
  });

  // Main Title
  page1.drawText('Itemized Statutory Deduction Ledger', {
    x: 40,
    y: height - 100,
    size: 22,
    font: boldFont,
    color: rgb(0.08, 0.1, 0.18),
  });

  page1.drawText('Consolidated Audited Statements — Fiscal Tax Year 2025/2026', {
    x: 40,
    y: height - 125,
    size: 12,
    font: italicFont,
    color: rgb(0.35, 0.4, 0.5),
  });

  // Callout Box
  page1.drawRectangle({
    x: 40,
    y: height - 195,
    width: width - 80,
    height: 55,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.02, 0.59, 0.41),
    borderWidth: 2,
  });

  page1.drawText('Section 179 Depreciation Election Notice', {
    x: 55,
    y: height - 160,
    size: 12,
    font: boldFont,
    color: rgb(0.02, 0.45, 0.32),
  });

  page1.drawText('The taxpayer has formally elected to expense qualifying tangible property under Section 179.', {
    x: 55,
    y: height - 180,
    size: 9.5,
    font: font,
    color: rgb(0.2, 0.25, 0.35),
  });

  // Body Paragraphs
  const paragraph1 = 
    'Pursuant to Treasury Regulation § 1.179-4, tangible capital asset purchases executed between ' +
    'January 1, 2025 and December 31, 2025 have been verified and classified under Schedule C. ' +
    'All supporting receipts, asset delivery confirmations, and certified valuation schedules are attached.';
  
  page1.drawText(paragraph1, {
    x: 40,
    y: height - 230,
    size: 10,
    font: font,
    color: rgb(0.15, 0.18, 0.25),
    maxWidth: width - 80,
    lineHeight: 15,
  });

  // Ledger Table
  const tableTop = height - 300;
  // Header background
  page1.drawRectangle({
    x: 40,
    y: tableTop - 25,
    width: width - 80,
    height: 25,
    color: rgb(0.92, 0.94, 0.98),
  });

  page1.drawText('Asset Category', { x: 50, y: tableTop - 18, size: 10, font: boldFont, color: rgb(0.1, 0.15, 0.25) });
  page1.drawText('Acquisition Basis', { x: 260, y: tableTop - 18, size: 10, font: boldFont, color: rgb(0.1, 0.15, 0.25) });
  page1.drawText('Section 179 Allowance', { x: 410, y: tableTop - 18, size: 10, font: boldFont, color: rgb(0.1, 0.15, 0.25) });

  const tableRows = [
    { cat: 'High-Performance Data Server Cluster', basis: '$248,500.00', allowance: '$248,500.00' },
    { cat: 'Enterprise Software License Rights', basis: '$94,120.00', allowance: '$94,120.00' },
    { cat: 'Cryptographic Hardware Security Modules', basis: '$62,400.00', allowance: '$62,400.00' },
    { cat: 'Dedicated Fiber Telecommunications', basis: '$37,600.00', allowance: '$37,600.00' },
  ];

  let currentY = tableTop - 45;
  for (const row of tableRows) {
    page1.drawText(row.cat, { x: 50, y: currentY, size: 9.5, font: font, color: rgb(0.15, 0.18, 0.25) });
    page1.drawText(row.basis, { x: 260, y: currentY, size: 9.5, font: font, color: rgb(0.3, 0.35, 0.45) });
    page1.drawText(row.allowance, { x: 430, y: currentY, size: 9.5, font: boldFont, color: rgb(0.02, 0.5, 0.35) });
    
    // Light divider line
    page1.drawLine({
      start: { x: 40, y: currentY - 8 },
      end: { x: width - 40, y: currentY - 8 },
      thickness: 0.5,
      color: rgb(0.85, 0.88, 0.92),
    });
    currentY -= 28;
  }

  // Total Row
  currentY -= 5;
  page1.drawText('Total Qualified Deduction Claimed:', { x: 50, y: currentY, size: 11, font: boldFont, color: rgb(0.05, 0.1, 0.2) });
  page1.drawText('$442,620.00', { x: 430, y: currentY, size: 12, font: boldFont, color: rgb(0.02, 0.55, 0.38) });

  // Signatory Box
  const sigBoxY = currentY - 120;
  page1.drawRectangle({
    x: 40,
    y: sigBoxY,
    width: width - 80,
    height: 90,
    borderColor: rgb(0.8, 0.84, 0.9),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1.0),
  });

  page1.drawText('AUTHORIZED SIGNATURE & ATTESTATION OF TAX PREPARER:', {
    x: 55,
    y: sigBoxY + 70,
    size: 8.5,
    font: boldFont,
    color: rgb(0.4, 0.45, 0.55),
  });

  page1.drawText('Elena Vance, CPA — Senior Tax Director', {
    x: 55,
    y: sigBoxY + 45,
    size: 14,
    font: italicFont,
    color: rgb(0.08, 0.15, 0.4),
  });

  page1.drawText('Electronic Signature SHA-256: 7f8b92c4...e13d90a (Verified & Tamper-Evident)', {
    x: 55,
    y: sigBoxY + 20,
    size: 8,
    font: font,
    color: rgb(0.02, 0.5, 0.35),
  });

  // Footer
  page1.drawLine({
    start: { x: 40, y: 50 },
    end: { x: width - 40, y: 50 },
    thickness: 1,
    color: rgb(0.85, 0.88, 0.92),
  });
  page1.drawText('DocuFlow Cryptographic Document Engine • Form 1040-V Audit Verification', {
    x: 40,
    y: 35,
    size: 8.5,
    font: font,
    color: rgb(0.5, 0.55, 0.65),
  });

  // Page 2: Supporting Schedule & Depreciation
  const page2 = pdfDoc.addPage([595, 842]);
  page2.drawText('SCHEDULE C • APPENDIX F: ASSET INVENTORY BREAKDOWN', {
    x: 40,
    y: height - 50,
    size: 10,
    font: boldFont,
    color: rgb(0.2, 0.25, 0.35),
  });
  page2.drawText('PAGE 2 OF 3', {
    x: width - 110,
    y: height - 50,
    size: 10,
    font: boldFont,
    color: rgb(0.4, 0.45, 0.55),
  });

  page2.drawText('Asset Classification & Depreciation Methodologies', {
    x: 40,
    y: height - 100,
    size: 18,
    font: boldFont,
    color: rgb(0.08, 0.1, 0.18),
  });

  const page2Body = 
    '1. Data Server Infrastructure:\n' +
    '   - Recovery period: 5-year MACRS 200% declining balance method.\n' +
    '   - Placed in service: March 14, 2025 at primary North America datacenter.\n' +
    '   - Verified operational efficiency: 99.999% uptime with independent audit log.\n\n' +
    '2. Software Systems & Intellectual Property:\n' +
    '   - Section 197 intangible amortization schedule applicable where Section 179 limit was exceeded.\n' +
    '   - All proprietary algorithms evaluated by third-party appraisal firm.\n\n' +
    '3. Audit Defense & Regulatory Compliance:\n' +
    '   - Full documentation retains permanent timestamp on internal immutable blockchain ledger.\n' +
    '   - Taxpayer certifies under penalty of perjury that no dual-use residential claims exist.';

  page2.drawText(page2Body, {
    x: 40,
    y: height - 140,
    size: 11,
    font: font,
    color: rgb(0.15, 0.18, 0.25),
    maxWidth: width - 80,
    lineHeight: 18,
  });

  // Page 3: Regulatory Certificate & Compliance Seals
  const page3 = pdfDoc.addPage([595, 842]);
  page3.drawText('CERTIFICATE OF FILING AUTHENTICITY', {
    x: 40,
    y: height - 50,
    size: 10,
    font: boldFont,
    color: rgb(0.2, 0.25, 0.35),
  });
  page3.drawText('PAGE 3 OF 3', {
    x: width - 110,
    y: height - 50,
    size: 10,
    font: boldFont,
    color: rgb(0.4, 0.45, 0.55),
  });

  page3.drawText('Official Certification & Filing Receipt', {
    x: 40,
    y: height - 100,
    size: 18,
    font: boldFont,
    color: rgb(0.08, 0.1, 0.18),
  });

  page3.drawText('Document ID: DFLOW-2026-TAX-0982-SIGNED', {
    x: 40,
    y: height - 130,
    size: 12,
    font: boldFont,
    color: rgb(0.1, 0.35, 0.65),
  });

  page3.drawText(
    'This tax document was compiled, verified, and signed through DocuFlow Mobile Reader.\n' +
    'All pages, cryptographic checksums, and signature vectors are sealed according to ISO 32000-2.\n\n' +
    'Status: VALIDATED & ARCHIVED\n' +
    'Filing Channel: Electronic Federal Tax Payment System (EFTPS)\n' +
    'Confirmation Code: 84920-XCV-202604',
    {
      x: 40,
      y: height - 170,
      size: 11,
      font: font,
      color: rgb(0.2, 0.22, 0.28),
      lineHeight: 18,
    }
  );

  return await pdfDoc.save();
}

export async function generateContractPdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Page 1
  const page1 = pdfDoc.addPage([595, 842]);
  const { width, height } = page1.getSize();

  page1.drawText('MASTER VENDOR SERVICES AGREEMENT', {
    x: 40,
    y: height - 70,
    size: 18,
    font: boldFont,
    color: rgb(0.08, 0.12, 0.22),
  });

  page1.drawText('Agreement Reference No: MVSA-2026-0492 • Page 1 of 2', {
    x: 40,
    y: height - 95,
    size: 10,
    font: italicFont,
    color: rgb(0.4, 0.45, 0.55),
  });

  const agreementText = 
    'This Master Vendor Services Agreement ("Agreement") is entered into as of October 18, 2025,\n' +
    'by and between DocuFlow Enterprise Solutions Inc. ("Client") and Apex Global Logistics LLC ("Vendor").\n\n' +
    '1. SCOPE OF ENGAGEMENT\n' +
    'Vendor agrees to provide high-availability edge storage distribution and document delivery\n' +
    'services in accordance with Schedule A Service Level Objectives (99.99% availability guarantee).\n\n' +
    '2. TERM AND TERMINATION\n' +
    'This Agreement shall commence on the Effective Date and remain in effect for a period of twenty-four\n' +
    '(24) calendar months unless terminated earlier by either party with sixty (60) days prior written notice.\n\n' +
    '3. CONFIDENTIALITY AND SECURITY OBLIGATIONS\n' +
    'Each party acknowledges that during the Term, it may receive confidential technical and business\n' +
    'information. All customer data processed by Vendor shall be encrypted at rest with AES-256\n' +
    'and in transit with TLS 1.3.';

  page1.drawText(agreementText, {
    x: 40,
    y: height - 140,
    size: 10.5,
    font: font,
    color: rgb(0.15, 0.18, 0.25),
    lineHeight: 18,
  });

  // Page 2
  const page2 = pdfDoc.addPage([595, 842]);
  page2.drawText('MASTER VENDOR SERVICES AGREEMENT • SIGNATURES', {
    x: 40,
    y: height - 70,
    size: 14,
    font: boldFont,
    color: rgb(0.08, 0.12, 0.22),
  });

  page2.drawText('Page 2 of 2', {
    x: width - 100,
    y: height - 70,
    size: 10,
    font: boldFont,
    color: rgb(0.4, 0.45, 0.55),
  });

  page2.drawText(
    '4. COMPENSATION AND INVOICING\n' +
    'Client shall pay Vendor net thirty (30) days from receipt of a valid, itemized tax invoice.\n' +
    'Annual contract value: $185,000.00 USD payable quarterly.\n\n' +
    'IN WITNESS WHEREOF, the parties have executed this Agreement by their authorized representatives.',
    {
      x: 40,
      y: height - 120,
      size: 10.5,
      font: font,
      color: rgb(0.15, 0.18, 0.25),
      lineHeight: 18,
    }
  );

  // Signatures
  page2.drawRectangle({
    x: 40,
    y: height - 320,
    width: 240,
    height: 100,
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
  });
  page2.drawText('FOR CLIENT: DocuFlow Inc.', { x: 50, y: height - 240, size: 10, font: boldFont, color: rgb(0.1, 0.15, 0.25) });
  page2.drawText('Signature: Marcus Sterling', { x: 50, y: height - 270, size: 12, font: italicFont, color: rgb(0.05, 0.3, 0.6) });
  page2.drawText('Title: Chief Executive Officer', { x: 50, y: height - 295, size: 9, font: font, color: rgb(0.4, 0.45, 0.55) });

  page2.drawRectangle({
    x: 310,
    y: height - 320,
    width: 240,
    height: 100,
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
  });
  page2.drawText('FOR VENDOR: Apex Global LLC', { x: 320, y: height - 240, size: 10, font: boldFont, color: rgb(0.1, 0.15, 0.25) });
  page2.drawText('Signature: Sarah Jenkins', { x: 320, y: height - 270, size: 12, font: italicFont, color: rgb(0.05, 0.5, 0.3) });
  page2.drawText('Title: Managing Partner', { x: 320, y: height - 295, size: 9, font: font, color: rgb(0.4, 0.45, 0.55) });

  return await pdfDoc.save();
}

export async function generateExecutiveAuditPdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Pre-create all 5 pages
  const pages: any[] = [];
  for (let i = 1; i <= 5; i++) {
    pages.push(pdfDoc.addPage([595, 842]));
  }

  // --- PAGE 1: Interactive Table of Contents (TOC) ---
  const page1 = pages[0];
  const { width, height } = page1.getSize();

  // Header Bar
  page1.drawRectangle({
    x: 40,
    y: height - 60,
    width: width - 80,
    height: 3,
    color: rgb(0.08, 0.15, 0.35),
  });

  page1.drawText('EXECUTIVE AUDIT & COMPLIANCE REPORT 2026', {
    x: 40,
    y: height - 50,
    size: 10,
    font: boldFont,
    color: rgb(0.1, 0.15, 0.3),
  });

  page1.drawText('PAGE 1 OF 5 • TOC', {
    x: width - 130,
    y: height - 50,
    size: 9.5,
    font: boldFont,
    color: rgb(0.45, 0.5, 0.6),
  });

  page1.drawText('Table of Contents & Section Index', {
    x: 40,
    y: height - 100,
    size: 22,
    font: boldFont,
    color: rgb(0.06, 0.1, 0.2),
  });

  page1.drawText('Tap or click any section below to jump directly to its audited report findings:', {
    x: 40,
    y: height - 125,
    size: 11,
    font: italicFont,
    color: rgb(0.3, 0.38, 0.5),
  });

  // TOC Entries List
  const tocEntries = [
    {
      title: 'Section 1: Executive Summary & Overall Risk Posture',
      desc: 'Corporate governance, SOC 2 Type II controls, and Grade A certification',
      targetPageIndex: 1, // Page 2 (0-indexed 1)
      displayPage: 'Page 2',
    },
    {
      title: 'Section 2: Financial Integrity & Revenue Controls',
      desc: 'Balance sheet hygiene, ICFR effectiveness, 34.2% operating margin',
      targetPageIndex: 2, // Page 3 (0-indexed 2)
      displayPage: 'Page 3',
    },
    {
      title: 'Section 3: Cybersecurity, Privacy & Data Governance',
      desc: 'GDPR, CCPA, and HIPAA compliance audit with cryptographic logs',
      targetPageIndex: 3, // Page 4 (0-indexed 3)
      displayPage: 'Page 4',
    },
    {
      title: 'Section 4: Formal Auditor Opinion & Certification Panel',
      desc: 'Unqualified clean opinion signed by Hall, Morgan & Sterling LLP',
      targetPageIndex: 4, // Page 5 (0-indexed 4)
      displayPage: 'Page 5',
    },
  ];

  let currentY = height - 180;
  for (let i = 0; i < tocEntries.length; i++) {
    const entry = tocEntries[i];
    const targetPage = pages[entry.targetPageIndex];

    // Card background for TOC entry
    page1.drawRectangle({
      x: 40,
      y: currentY - 18,
      width: width - 80,
      height: 52,
      color: rgb(0.96, 0.98, 1.0),
      borderColor: rgb(0.82, 0.88, 0.96),
      borderWidth: 1,
    });

    // Left accent bar
    page1.drawRectangle({
      x: 40,
      y: currentY - 18,
      width: 4,
      height: 52,
      color: rgb(0.15, 0.45, 0.85),
    });

    // Section title
    page1.drawText(entry.title, {
      x: 55,
      y: currentY + 16,
      size: 11.5,
      font: boldFont,
      color: rgb(0.08, 0.22, 0.55),
    });

    // Description text
    page1.drawText(entry.desc, {
      x: 55,
      y: currentY - 2,
      size: 9,
      font: font,
      color: rgb(0.35, 0.42, 0.52),
    });

    // Page badge
    page1.drawRectangle({
      x: width - 110,
      y: currentY + 4,
      width: 55,
      height: 22,
      color: rgb(0.88, 0.93, 1.0),
      borderColor: rgb(0.6, 0.75, 0.95),
      borderWidth: 1,
    });

    page1.drawText(entry.displayPage, {
      x: width - 102,
      y: currentY + 11,
      size: 9,
      font: boldFont,
      color: rgb(0.1, 0.35, 0.75),
    });

    // Attach PDF Link Annotation for this TOC row (pointing to target section page)
    try {
      const linkAnnot = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [40, currentY - 18, width - 40, currentY + 34],
        Border: [0, 0, 0],
        C: [0.15, 0.45, 0.85],
        Dest: [targetPage.ref, 'Fit'],
      });
      const linkRef = pdfDoc.context.register(linkAnnot);
      page1.node.addAnnot(linkRef);
    } catch (annotErr) {
      console.warn('Could not register TOC link annotation:', annotErr);
    }

    currentY -= 68;
  }

  // External Reference Link Box
  const extBoxY = currentY - 20;
  page1.drawRectangle({
    x: 40,
    y: extBoxY - 15,
    width: width - 80,
    height: 48,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: rgb(0.75, 0.8, 0.88),
    borderWidth: 1,
  });

  page1.drawText('REGULATORY FILING ARCHIVE • SEC EDGAR DATABASE', {
    x: 55,
    y: extBoxY + 16,
    size: 10,
    font: boldFont,
    color: rgb(0.1, 0.55, 0.4),
  });

  page1.drawText('https://www.sec.gov (Tap to view public institutional filings)', {
    x: 55,
    y: extBoxY - 2,
    size: 9,
    font: italicFont,
    color: rgb(0.2, 0.4, 0.65),
  });

  try {
    const extAnnot = pdfDoc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [40, extBoxY - 15, width - 40, extBoxY + 33],
      Border: [0, 0, 0],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of('https://www.sec.gov'),
      },
    });
    const extRef = pdfDoc.context.register(extAnnot);
    page1.node.addAnnot(extRef);
  } catch (extErr) {
    console.warn('Could not register external link annotation:', extErr);
  }

  // Page 1 Footer
  page1.drawLine({
    start: { x: 40, y: 50 },
    end: { x: width - 40, y: 50 },
    thickness: 1,
    color: rgb(0.85, 0.88, 0.92),
  });
  page1.drawText('DocuFlow Compliance Verification • Standard ISO 32000 PDF Navigation Enabled', {
    x: 40,
    y: 35,
    size: 8.5,
    font: font,
    color: rgb(0.5, 0.55, 0.65),
  });

  // --- PAGES 2 to 5: Content Sections ---
  const sectionsContent = [
    {
      title: 'Executive Summary & Overall Risk Posture',
      body:
        'During the Q1-Q4 2025 assessment cycle, our independent audit teams evaluated corporate\n' +
        'governance, financial reporting controls, data segregation policies, and SOC 2 Type II controls.\n\n' +
        'KEY AUDIT FINDINGS:\n' +
        '• Financial Reconciliation Accuracy: 99.98% across 4,200,000 ledger transactions.\n' +
        '• Capital Reserve Ratio: 22.4% (Tier 1 capital benchmark comfortably exceeded).\n' +
        '• Cloud Security Architecture: Zero critical vulnerabilities detected during red-team exercises.\n\n' +
        'The overall compliance rating has been certified as GRADE A (UNQUALIFIED CLEAN OPINION).',
    },
    {
      title: 'Financial Integrity & Revenue Controls',
      body:
        'This section analyzes balance sheet hygiene, deferred revenue schedules, and accounts receivable.\n' +
        'Internal controls over financial reporting (ICFR) were observed to be operating effectively.\n\n' +
        '• Consolidated Operating Margin: 34.2%\n' +
        '• Free Cash Flow Generation: $84.2M\n' +
        '• Bad Debt Provisions: <0.2% of gross revenues',
    },
    {
      title: 'Cybersecurity, Privacy & Data Governance',
      body:
        'Auditors confirmed strict compliance with GDPR, CCPA, and HIPAA privacy rules.\n' +
        'Customer document access logs are signed cryptographically with non-repudiation seals.\n' +
        'Disaster recovery exercises achieved RTO < 15 minutes and RPO = 0.',
    },
    {
      title: 'Formal Auditor Opinion & Signature Panel',
      body:
        'In our opinion, the consolidated financial statements present fairly, in all material respects,\n' +
        'the financial position of the Enterprise as of December 31, 2025, in conformity with U.S. GAAP.\n\n' +
        'Audit Partner: Katherine Hall, CPA\n' +
        'Firm: Hall, Morgan & Sterling LLP\n' +
        'Date: September 20, 2026',
    },
  ];

  for (let s = 0; s < sectionsContent.length; s++) {
    const pIdx = s + 1; // 1 to 4
    const page = pages[pIdx];
    const sec = sectionsContent[s];

    page.drawText('EXECUTIVE AUDIT & COMPLIANCE REPORT 2026', {
      x: 40,
      y: height - 60,
      size: 11,
      font: boldFont,
      color: rgb(0.1, 0.15, 0.3),
    });

    page.drawText(`SECTION ${s + 1} • PAGE ${pIdx + 1} OF 5`, {
      x: width - 140,
      y: height - 60,
      size: 9.5,
      font: boldFont,
      color: rgb(0.45, 0.5, 0.6),
    });

    page.drawLine({
      start: { x: 40, y: height - 70 },
      end: { x: width - 40, y: height - 70 },
      thickness: 1.5,
      color: rgb(0.1, 0.2, 0.45),
    });

    page.drawText(sec.title, {
      x: 40,
      y: height - 110,
      size: 18,
      font: boldFont,
      color: rgb(0.08, 0.12, 0.2),
    });

    page.drawText(sec.body, {
      x: 40,
      y: height - 150,
      size: 11,
      font: font,
      color: rgb(0.15, 0.18, 0.25),
      lineHeight: 20,
    });
  }

  return await pdfDoc.save();
}

/**
 * Generates an authentic multi-page PDF document customized for any on-device document
 */
export async function generateDynamicDevicePdf(
  title: string,
  category = 'Documents',
  requestedPages = 4
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const cleanTitle = title.replace(/\.pdf$/i, '').replace(/_/g, ' ');
  const numPages = Math.min(12, Math.max(3, requestedPages));

  for (let i = 1; i <= numPages; i++) {
    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();

    // Top Brand / Folder Header
    page.drawRectangle({
      x: 40,
      y: height - 55,
      width: width - 80,
      height: 2.5,
      color: rgb(0.08, 0.12, 0.22),
    });

    page.drawText(`LOCAL STORAGE • /STORAGE/EMULATED/0/${category.toUpperCase()}`, {
      x: 40,
      y: height - 45,
      size: 9,
      font: boldFont,
      color: rgb(0.3, 0.35, 0.45),
    });

    page.drawText(`PAGE ${i} OF ${numPages}`, {
      x: width - 110,
      y: height - 45,
      size: 9,
      font: boldFont,
      color: rgb(0.4, 0.45, 0.55),
    });

    if (i === 1) {
      // Document Title
      page.drawText(cleanTitle, {
        x: 40,
        y: height - 95,
        size: 20,
        font: boldFont,
        color: rgb(0.06, 0.09, 0.16),
        maxWidth: width - 80,
      });

      page.drawText(`Device Document Archive • Verified Local File • Status: Active`, {
        x: 40,
        y: height - 120,
        size: 11,
        font: italicFont,
        color: rgb(0.35, 0.4, 0.5),
      });

      // Information Callout Card
      page.drawRectangle({
        x: 40,
        y: height - 190,
        width: width - 80,
        height: 52,
        color: rgb(0.96, 0.98, 1.0),
        borderColor: rgb(0.12, 0.5, 0.9),
        borderWidth: 1.5,
      });

      page.drawText('Device Storage Verification & Cryptographic Integrity', {
        x: 55,
        y: height - 160,
        size: 11,
        font: boldFont,
        color: rgb(0.08, 0.35, 0.7),
      });

      page.drawText('This file is indexed directly from local device storage without requiring network transmission.', {
        x: 55,
        y: height - 178,
        size: 9.5,
        font: font,
        color: rgb(0.2, 0.25, 0.35),
      });

      // Chapter / Section 1
      page.drawText('1. Executive Overview & Scope of Document', {
        x: 40,
        y: height - 225,
        size: 13,
        font: boldFont,
        color: rgb(0.08, 0.12, 0.22),
      });

      const bodyPara =
        `The document "${cleanTitle}" contains certified administrative records, operational frameworks, and ` +
        `contractual terms established for institutional accountability. All content has been compiled and serialized ` +
        `directly on the host device filesystem with high-precision typographic rendering and standards compliance.`;

      page.drawText(bodyPara, {
        x: 40,
        y: height - 245,
        size: 10,
        font: font,
        color: rgb(0.15, 0.18, 0.25),
        maxWidth: width - 80,
        lineHeight: 16,
      });

      page.drawText('2. Terms, Specifications & Structured Provisions', {
        x: 40,
        y: height - 315,
        size: 13,
        font: boldFont,
        color: rgb(0.08, 0.12, 0.22),
      });

      const bodyPara2 =
        `Parties referenced herein acknowledge compliance with all governing protocols, confidentiality ` +
        `standards, and procedural guidelines. All metrics, deliverables, milestones, and audit trails shall ` +
        `remain binding in accordance with statutory requirements and digital signature authorizations.`;

      page.drawText(bodyPara2, {
        x: 40,
        y: height - 335,
        size: 10,
        font: font,
        color: rgb(0.15, 0.18, 0.25),
        maxWidth: width - 80,
        lineHeight: 16,
      });

      // Signature Card
      page.drawRectangle({
        x: 40,
        y: height - 480,
        width: width - 80,
        height: 80,
        color: rgb(0.98, 0.98, 0.99),
        borderColor: rgb(0.85, 0.88, 0.92),
        borderWidth: 1,
      });

      page.drawText('CERTIFIED NOTARIZED SEAL & SIGNATURE', {
        x: 55,
        y: height - 425,
        size: 10,
        font: boldFont,
        color: rgb(0.1, 0.15, 0.25),
      });

      page.drawText('Signatory: Marcus Vance, Managing Director\nDate: 2026-09-24  •  Verification Code: #DOC-883921-VERIFIED', {
        x: 55,
        y: height - 450,
        size: 9.5,
        font: font,
        color: rgb(0.25, 0.3, 0.4),
        lineHeight: 14,
      });
    } else {
      // Subsequent Pages
      page.drawText(`Section ${i}: Detailed Provisions & Analysis (Continued)`, {
        x: 40,
        y: height - 95,
        size: 15,
        font: boldFont,
        color: rgb(0.08, 0.12, 0.22),
      });

      const pageText =
        `This section establishes continued parameters and operational details for ${cleanTitle}. ` +
        `Regular cross-referencing and validation against standardized rubrics ensures operational ` +
        `continuity and regulatory alignment across all recorded obligations.\n\n` +
        `Key Takeaways & Observations:\n` +
        `• Compliance validation achieved 100% concordance across all benchmarks.\n` +
        `• Document status is verified on internal mobile memory with complete offline accessibility.\n` +
        `• Full text indexing is supported for search, highlighting, freehand annotation, and text reflow.\n\n` +
        `DocuFlow Mobile PDF Engine guarantees lossless presentation and high-DPI rasterization.`;

      page.drawText(pageText, {
        x: 40,
        y: height - 130,
        size: 10.5,
        font: font,
        color: rgb(0.15, 0.18, 0.25),
        maxWidth: width - 80,
        lineHeight: 17,
      });
    }

    // Page Footer
    page.drawText(`DocuFlow Mobile PDF Reader • ${cleanTitle} • Page ${i} of ${numPages}`, {
      x: 40,
      y: 40,
      size: 9,
      font: italicFont,
      color: rgb(0.4, 0.45, 0.55),
    });
  }

  return await pdfDoc.save();
}

import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

interface InvoiceForPdf {
  invoiceNumber: number;
  issueDate: Date;
  dueDate: Date | null;
  periodStart: Date;
  periodEnd: Date;
  subtotal: any;
  taxRate: any;
  taxAmount: any;
  total: any;
  company: {
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    phone: string | null;
    email: string | null;
  };
  customer: {
    name: string;
    contact: string | null;
    address: string | null;
    phone: string | null;
  };
  tickets: {
    ticketNumber: number;
    completedAt: Date | null;
    material: string | null;
    quantity: number;
    quantityType: string;
    ratePerUnit: any;
  }[];
}

export async function generateInvoicePdf(invoice: InvoiceForPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fillColor('#1b1e22').fontSize(22).font('Helvetica-Bold').text(invoice.company.name, 50, 50);
    doc.fontSize(9).font('Helvetica').fillColor('#434a52');
    if (invoice.company.address) doc.text(invoice.company.address);
    const cityLine = [invoice.company.city, invoice.company.state].filter(Boolean).join(', ')
      + (invoice.company.zip ? ` ${invoice.company.zip}` : '');
    if (cityLine.trim()) doc.text(cityLine);
    if (invoice.company.phone) doc.text(invoice.company.phone);
    if (invoice.company.email) doc.text(invoice.company.email);

    doc.fontSize(28).font('Helvetica-Bold').fillColor('#FFB500')
      .text('INVOICE', 400, 50, { align: 'right', width: 145 });
    doc.fontSize(10).fillColor('#1b1e22').font('Helvetica')
      .text(`#${String(invoice.invoiceNumber).padStart(4, '0')}`, 400, 82, { align: 'right', width: 145 });
    doc.fontSize(9).fillColor('#434a52')
      .text(`Issued: ${format(invoice.issueDate, 'MMM d, yyyy')}`, 400, 98, { align: 'right', width: 145 });
    if (invoice.dueDate) {
      doc.text(`Due: ${format(invoice.dueDate, 'MMM d, yyyy')}`, 400, 112, { align: 'right', width: 145 });
    }

    doc.moveTo(50, 150).lineTo(545, 150).strokeColor('#cfd4da').stroke();

    doc.fontSize(8).fillColor('#586069').font('Helvetica-Bold').text('BILL TO', 50, 170);
    doc.fontSize(11).fillColor('#1b1e22').font('Helvetica-Bold').text(invoice.customer.name, 50, 185);
    doc.fontSize(9).font('Helvetica').fillColor('#434a52');
    if (invoice.customer.contact) doc.text(invoice.customer.contact);
    if (invoice.customer.address) doc.text(invoice.customer.address);
    if (invoice.customer.phone) doc.text(invoice.customer.phone);

    doc.fontSize(8).fillColor('#586069').font('Helvetica-Bold').text('SERVICE PERIOD', 350, 170);
    doc.fontSize(10).fillColor('#1b1e22').font('Helvetica')
      .text(`${format(invoice.periodStart, 'MMM d, yyyy')}`, 350, 185);
    doc.text(`to ${format(invoice.periodEnd, 'MMM d, yyyy')}`, 350, 200);

    let y = 260;
    doc.rect(50, y, 495, 20).fill('#1b1e22');
    doc.fillColor('#FFB500').fontSize(8).font('Helvetica-Bold');
    doc.text('TICKET', 55, y + 6);
    doc.text('DATE', 110, y + 6);
    doc.text('MATERIAL', 170, y + 6);
    doc.text('QTY', 340, y + 6, { width: 40, align: 'right' });
    doc.text('RATE/UNIT', 400, y + 6, { width: 60, align: 'right' });
    doc.text('AMOUNT', 470, y + 6, { width: 70, align: 'right' });
    y += 25;

    doc.fillColor('#1b1e22').font('Helvetica').fontSize(9);
    for (const t of invoice.tickets) {
      if (y > 680) { doc.addPage(); y = 60; }
      const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
      const qty = Number(t.quantity);
      const amount = rate * qty;
      doc.text(`#${String(t.ticketNumber).padStart(4, '0')}`, 55, y);
      doc.text(t.completedAt ? format(t.completedAt, 'MMM d') : '—', 110, y);
      doc.text(t.material ?? '—', 170, y, { width: 165, ellipsis: true });
      doc.text(t.quantityType === 'TONS' ? String(qty) : String(Math.round(qty)), 340, y, { width: 40, align: 'right' });
      doc.text(`$${rate.toFixed(2)}`, 400, y, { width: 60, align: 'right' });
      doc.text(`$${amount.toFixed(2)}`, 470, y, { width: 70, align: 'right' });
      y += 18;
      doc.moveTo(50, y - 3).lineTo(545, y - 3).strokeColor('#e9ecef').lineWidth(0.5).stroke();
    }

    y += 10;
    const labelX = 380;
    const valueX = 470;
    const valW = 70;
    doc.fontSize(9).fillColor('#586069');
    doc.text('Subtotal', labelX, y, { width: 80, align: 'right' });
    doc.fillColor('#1b1e22').text(`$${Number(invoice.subtotal).toFixed(2)}`, valueX, y, { width: valW, align: 'right' });
    y += 16;
    if (Number(invoice.taxRate) > 0) {
      doc.fillColor('#586069').text(`Tax (${(Number(invoice.taxRate) * 100).toFixed(2)}%)`, labelX, y, { width: 80, align: 'right' });
      doc.fillColor('#1b1e22').text(`$${Number(invoice.taxAmount).toFixed(2)}`, valueX, y, { width: valW, align: 'right' });
      y += 16;
    }
    doc.moveTo(labelX, y).lineTo(545, y).strokeColor('#1b1e22').lineWidth(1.5).stroke();
    y += 6;
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1b1e22');
    doc.text('TOTAL', labelX, y, { width: 80, align: 'right' });
    doc.text(`$${Number(invoice.total).toFixed(2)}`, valueX, y, { width: valW, align: 'right' });

    doc.fontSize(8).font('Helvetica').fillColor('#7c8691')
      .text('Thank you for your business.', 50, 740, { align: 'center', width: 495 });

    doc.end();
  });
}

// ---------------------------------------------------------------------------
// Broker trip-sheet / weekly invoice PDF
// ---------------------------------------------------------------------------

interface BrokerInvoiceForPdf {
  company: {
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    phone: string | null;
    email: string | null;
  };
  broker: {
    name: string;
    contacts: { name: string; phone: string; email: string; jobTitle: string }[];
    email: string | null;
    mailingAddress: string | null;
    commissionPct: number;
    tripSheetForm: string | null;
    logoFile: string | null;
  };
  periodEnd: Date;
  tickets: {
    ticketNumber: number;
    ticketRef: string | null;
    date: Date | null;
    completedAt: Date | null;
    customer: string | null;
    driver: string | null;
    truckNumber: string | null;
    material: string | null;
    quantityType: string;
    quantity: number;
    hauledFrom: string;
    hauledTo: string;
    ratePerUnit: number;
    status: string;
    payToName?: string | null;
    dispatcherName?: string | null;
  }[];
}

export async function generateBrokerInvoicePdf(data: BrokerInvoiceForPdf): Promise<Buffer> {
  // If broker has an uploaded logo image, load it for embedding in the PDF
  let logoImageBuf: Buffer | null = null;
  if (data.broker.logoFile) {
    try {
      if (data.broker.logoFile.startsWith('https://')) {
        // Fetch from Vercel Blob
        const res = await fetch(data.broker.logoFile);
        if (res.ok) {
          logoImageBuf = Buffer.from(await res.arrayBuffer());
          console.log('[TripSheet PDF] logo fetched from blob, size:', logoImageBuf.length);
        }
      } else {
        // Legacy: read from local filesystem
        const logoDir = path.join(process.cwd(), 'uploads-private', 'broker-logos');
        const logoPath = path.join(logoDir, data.broker.logoFile);
        if (existsSync(logoPath)) {
          logoImageBuf = readFileSync(logoPath);
          console.log('[TripSheet PDF] logo loaded from disk, size:', logoImageBuf.length);
        }
      }
    } catch (err) {
      console.error('[TripSheet PDF] Failed to read broker logo:', err);
    }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Landscape LETTER: 792 x 612
    const PAGE_W = 792;
    const PAGE_H = 612;
    const M = 40; // margin
    const W = PAGE_W - M * 2; // usable width (712)
    const weekEndStr = format(data.periodEnd, 'MM/dd/yyyy');

    // Group tickets by driver (one trip sheet page per driver)
    const byDriver = new Map<string, { name: string; truckNumber: string; tickets: typeof data.tickets }>();
    for (const t of data.tickets) {
      const key = t.driver ?? '(Unassigned)';
      if (!byDriver.has(key)) {
        byDriver.set(key, { name: key, truckNumber: t.truckNumber ?? '', tickets: [] });
      }
      byDriver.get(key)!.tickets.push(t);
    }
    // If no tickets at all, still produce one blank page
    if (byDriver.size === 0) {
      byDriver.set('(Unassigned)', { name: '(Unassigned)', truckNumber: '', tickets: [] });
    }

    // Find the dispatcher contact from broker contacts (by job title)
    const dispatcherContact = data.broker.contacts.find(
      (c) => c.jobTitle && /dispatch/i.test(c.jobTitle),
    ) ?? data.broker.contacts[0] ?? null;
    const dispatcherFullName = dispatcherContact?.name ?? data.company.name;
    const dispatcherName = dispatcherFullName.split(/\s+/)[0];

    let isFirstPage = true;
    for (const [, driverGroup] of byDriver) {
      if (!isFirstPage) doc.addPage();
      isFirstPage = false;

      // Per-truck overrides: use first ticket's payToName/dispatcherName if set
      const firstTicket = driverGroup.tickets[0];
      const payToValue = firstTicket?.payToName?.trim() || data.company.name;
      const dispatcherOverride = firstTicket?.dispatcherName?.trim() || null;
      const driverDispatcherName = dispatcherOverride || dispatcherName;

      // =====================================================================
      // HEADER — left side: Pay To / Truck / Week Ending
      //          right side: Mail To (large) + Logo
      // =====================================================================
      let y = M;

      // --- LEFT COLUMN ---

      // "Pay To:" line
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000');
      doc.text('Pay To:', M, y);
      const payToLabelW = doc.widthOfString('Pay To:  ');
      doc.font('Helvetica').fontSize(12);
      doc.text(payToValue, M + payToLabelW, y);
      doc.moveTo(M + payToLabelW, y + 16).lineTo(M + 260, y + 16)
        .strokeColor('#000000').lineWidth(0.5).stroke();

      // "Truck Number:"
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000');
      doc.text('Truck Number:', M, y + 30);
      const truckLabelW = doc.widthOfString('Truck Number:  ');
      doc.font('Helvetica').fontSize(12);
      doc.text(driverGroup.truckNumber || '—', M + truckLabelW, y + 30);
      doc.moveTo(M + truckLabelW, y + 46).lineTo(M + 260, y + 46)
        .strokeColor('#000000').lineWidth(0.5).stroke();

      // "Week Ending:"
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000');
      doc.text('Week Ending:', M, y + 60);
      const weekLabelW = doc.widthOfString('Week Ending:  ');
      doc.font('Helvetica').fontSize(12);
      doc.text(weekEndStr, M + weekLabelW, y + 60);
      doc.moveTo(M + weekLabelW, y + 76).lineTo(M + 260, y + 76)
        .strokeColor('#000000').lineWidth(0.5).stroke();

      // --- RIGHT COLUMN: Mail To (spans full header height) + Logo ---

      const mailX = 340;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000');
      doc.text('Mail To:', mailX, y);
      doc.font('Helvetica-Bold').fontSize(13);
      doc.text(data.broker.name, mailX, y + 16);
      if (data.broker.mailingAddress) {
        doc.font('Helvetica').fontSize(11);
        const addrLines = data.broker.mailingAddress.split('\n');
        let addrY = y + 34;
        for (const line of addrLines) {
          doc.text(line.trim(), mailX, addrY);
          addrY += 15;
        }
      }

      // Broker logo — top right (large, spanning full header height)
      if (logoImageBuf) {
        const logoW = 280;
        const logoH = 90;
        doc.image(logoImageBuf, PAGE_W - M - logoW - 30, y - 10, { fit: [logoW, logoH], align: 'right', valign: 'center' });
      }

      y += 90;

      // =====================================================================
      // TABLE — matching columns: Date | Customer Name | Hauled From |
      //         Hauled To | Ticket Number | Quantity | Rate | Dispatcher
      // =====================================================================
      const ROW_H = 20;
      const cols = [
        { label: 'Date',            x: M,       w: 62 },
        { label: 'Customer Name',   x: M + 62,  w: 120 },
        { label: 'Hauled From',     x: M + 182, w: 120 },
        { label: 'Hauled To',       x: M + 302, w: 120 },
        { label: 'Ticket Number',   x: M + 422, w: 80 },
        { label: 'Quantity',        x: M + 502, w: 56, align: 'right' as const },
        { label: 'Rate',            x: M + 558, w: 62, align: 'right' as const },
        { label: 'Dispatcher',      x: M + 620, w: 92 },
      ];
      const tableW = cols[cols.length - 1].x + cols[cols.length - 1].w - M;

      // Header row
      doc.rect(M, y, tableW, ROW_H).fillAndStroke('#e8e8e8', '#000000');
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8);
      for (const col of cols) {
        doc.text(col.label, col.x + 3, y + 5, { width: col.w - 6, align: col.align || 'left' });
      }
      y += ROW_H;

      // Data rows — draw enough empty rows to fill the page (min 20)
      const MAX_ROWS = 16;
      const tix = driverGroup.tickets;
      for (let r = 0; r < Math.max(MAX_ROWS, tix.length); r++) {
        if (y + ROW_H > PAGE_H - 60) { doc.addPage(); y = M; }

        // Draw row border
        doc.rect(M, y, tableW, ROW_H).stroke('#000000');
        // Draw vertical cell borders
        for (const col of cols) {
          doc.moveTo(col.x, y).lineTo(col.x, y + ROW_H).stroke('#000000');
        }
        // Right edge
        doc.moveTo(M + tableW, y).lineTo(M + tableW, y + ROW_H).stroke('#000000');

        if (r < tix.length) {
          const t = tix[r];
          const rate = t.ratePerUnit;
          const dateStr = t.date ? format(t.date, 'MM/dd') : t.completedAt ? format(t.completedAt, 'MM/dd') : '';
          doc.font('Helvetica').fontSize(8).fillColor('#000000');
          doc.text(dateStr,                        cols[0].x + 3, y + 5, { width: cols[0].w - 6 });
          doc.text(t.customer ?? '',               cols[1].x + 3, y + 5, { width: cols[1].w - 6, ellipsis: true });
          doc.text(t.hauledFrom,                   cols[2].x + 3, y + 5, { width: cols[2].w - 6, ellipsis: true });
          doc.text(t.hauledTo,                     cols[3].x + 3, y + 5, { width: cols[3].w - 6, ellipsis: true });
          doc.text(t.ticketRef ?? String(t.ticketNumber), cols[4].x + 3, y + 5, { width: cols[4].w - 6 });
          doc.text(t.quantityType === 'TONS' ? String(Number(t.quantity)) : String(Math.round(Number(t.quantity))), cols[5].x + 3, y + 5, { width: cols[5].w - 6, align: 'right' });
          doc.text(rate > 0 ? `$${rate.toFixed(2)}` : '', cols[6].x + 3, y + 5, { width: cols[6].w - 6, align: 'right' });
          doc.text(driverDispatcherName,                  cols[7].x + 3, y + 5, { width: cols[7].w - 6, ellipsis: true });
        }
        y += ROW_H;
      }

      // =====================================================================
      // FOOTER
      // =====================================================================
      y += 6;
      doc.font('Helvetica').fontSize(8).fillColor('#000000');
      doc.text(
        'All Trip Sheets and Tickets must be received by Monday (11am) to be paid Friday. Thank you!',
        M, y, { width: tableW - 120 },
      );

      // Total Due box
      const totalDue = tix.reduce((sum, t) => {
        const rate = t.ratePerUnit;
        return sum + rate * Number(t.quantity);
      }, 0);
      doc.font('Helvetica-Bold').fontSize(10);
      const tdLabelX = M + tableW - 120;
      doc.text('Total Due:', tdLabelX, y);
      // Box for total
      const tdBoxX = tdLabelX + 62;
      doc.rect(tdBoxX, y - 2, 58, 16).stroke('#000000');
      doc.font('Helvetica').fontSize(10);
      doc.text(`$${totalDue.toFixed(2)}`, tdBoxX + 3, y, { width: 52, align: 'right' });
    }

    doc.end();
  });
}

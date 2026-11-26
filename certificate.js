// Automatic certificate generation: company name, logo, QR code and Halal seal -> PDF
const { PDFDocument, StandardFonts, rgb, degrees } = require("pdf-lib");
const QRCode = require("qrcode");
const fs = require("fs/promises");
const path = require("path");

const BASE_URL = () => (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const verifyUrl = (certNo) => `${BASE_URL()}/verify/${certNo}`;
const qrPng = (certNo, width = 300) => QRCode.toBuffer(verifyUrl(certNo), { margin: 1, width });

// Standard PDF fonts only support Latin characters
const clean = (t) => String(t || "").replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "");
const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

function wrap(text, font, size, maxW) {
  const lines = []; let line = "";
  for (const w of clean(text).split(/\s+/)) {
    const t = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(t, size) > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

async function buildCertificatePdf(c) {
  const pdf = await PDFDocument.create();
  const W = 842, H = 595;
  const page = pdf.addPage([W, H]);
  const serifB = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.016, 0.318, 0.165), gold = rgb(0.72, 0.54, 0.17);
  const ink = rgb(0.1, 0.12, 0.1), grey = rgb(0.4, 0.43, 0.4);

  const center = (t, y, size, font, color = ink, cx = W / 2) => {
    t = clean(t);
    page.drawText(t, { x: cx - font.widthOfTextAtSize(t, size) / 2, y, size, font, color });
  };

  page.drawRectangle({ x: 18, y: 18, width: W - 36, height: H - 36, borderColor: green, borderWidth: 4 });
  page.drawRectangle({ x: 28, y: 28, width: W - 56, height: H - 56, borderColor: gold, borderWidth: 1.5 });

  const logo = await pdf.embedJpg(await fs.readFile(path.join(__dirname, "public/images/logo.jpeg")));
  const lh = 66, lw = (logo.width / logo.height) * lh;
  page.drawImage(logo, { x: (W - lw) / 2, y: H - 40 - lh, width: lw, height: lh });

  center("HALAL RIZQ KHIDMAAT LLP", 448, 21, serifB, green);
  center("Halal Certification Services", 432, 10.5, sans, grey);
  center("CERTIFICATE OF HALAL COMPLIANCE", 396, 23, serifB, gold);
  page.drawLine({ start: { x: 300, y: 384 }, end: { x: 542, y: 384 }, thickness: 1, color: gold });
  center("This is to certify that", 362, 13, serif, grey);

  let size = 28;
  while (serifB.widthOfTextAtSize(clean(c.business_name), size) > 680 && size > 14) size--;
  center(c.business_name, 330, size, serifB, ink);
  wrap(`${c.address}, ${c.city}, ${c.state} - ${c.pincode}`, sans, 10.5, 600).slice(0, 2)
    .forEach((l, i) => center(l, 311 - i * 13, 10.5, sans, grey));
  center("has been assessed and found to comply with the Halal standards of the authority for the scope below.", 284, 11, serif, ink);

  const field = (label, value, x, y, maxW = 280) => {
    page.drawText(label.toUpperCase(), { x, y, size: 8, font: sansB, color: grey });
    wrap(value, sansB, 11.5, maxW).slice(0, 2).forEach((l, i) =>
      page.drawText(l, { x, y: y - 15 - i * 14, size: 11.5, font: sansB, color: ink }));
  };
  field("Certificate No.", c.cert_no, 120, 254);
  field("Sr. No.", String(c.sr_no), 470, 254);
  field("Scheme", c.scheme, 120, 214);
  field("Products / Scope", c.products, 470, 214, 250);
  field("Date of issue", fmt(c.issue_date), 120, 168);
  field("Valid until", fmt(c.expiry_date), 470, 168);

  const qr = await pdf.embedPng(await qrPng(c.cert_no, 360));
  page.drawImage(qr, { x: 70, y: 56, width: 78, height: 78 });
  center("Scan to verify", 44, 8, sans, grey, 109);

  const stamp = await pdf.embedJpg(await fs.readFile(path.join(__dirname, "public/images/stamp.jpeg")));
  page.drawImage(stamp, { x: W - 70 - 88, y: 56, width: 88, height: 88 });
  center("Authorised Seal", 44, 8, sans, grey, W - 70 - 44);

  center("Verify this certificate online:", 86, 8.5, sans, grey);
  center(verifyUrl(c.cert_no), 73, 9, sansB, green);
  center("Valid only while shown as Valid on the verification page.", 58, 8, sans, grey);

  if (c.status === "revoked")
    page.drawText("REVOKED", { x: 190, y: 160, size: 100, font: sansB, color: rgb(0.8, 0.1, 0.1), opacity: 0.25, rotate: degrees(25) });
  return pdf.save();
}

module.exports = { buildCertificatePdf, qrPng, verifyUrl };

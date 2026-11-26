require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { buildCertificatePdf, qrPng } = require("./certificate");

if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET must be set in production.");
}

const PORT = process.env.PORT || 3000;
const SECRET = process.env.AUTH_SECRET || "dev-secret-change-me";
const SCHEMES = ["Product Manufacturer", "Food Premises (Restaurant / Caterer)", "Outlet / Hotel", "Abattoir / Slaughterhouse"];

// ---------- Database ----------
const db = new Database(process.env.DB_FILE || path.join(__dirname, "database", "halal.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync(path.join(__dirname, "database", "schema.sql"), "utf8"));

// Create the first admin account if none exists
if (!db.prepare("SELECT 1 FROM users WHERE role='admin'").get()) {
  if (process.env.NODE_ENV === "production" && (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD before starting in production.");
  }
  const email = (process.env.ADMIN_EMAIL || "admin@halalrizq.in").toLowerCase();
  const pass = process.env.ADMIN_PASSWORD || "ChangeThisPassword123";
  db.prepare("INSERT OR IGNORE INTO users (name,email,password_hash,role) VALUES (?,?,?, 'admin')")
    .run("Administrator", email, bcrypt.hashSync(pass, 10));
  console.log("Admin account ready:", email);
}

// ---------- App ----------
const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// Identify the logged-in user on every request
app.use((req, _res, next) => {
  try {
    const { uid } = jwt.verify(req.cookies.session, SECRET);
    req.user = db.prepare("SELECT id,name,email,phone,role FROM users WHERE id=?").get(uid);
  } catch { /* not logged in */ }
  next();
});
const needLogin = (req, res, next) => (req.user ? next() : res.status(401).json({ error: "Please log in first." }));
// Admin routes answer "not found" to everyone else, so clients cannot tell they exist
const needAdmin = (req, res, next) => (req.user?.role === "admin" ? next() : res.status(404).json({ error: "Not found" }));
const wrap = (fn) => (req, res) => { try { fn(req, res); } catch (e) { res.status(400).json({ error: e.message || "Request failed" }); } };

const str = (v, max = 300) => String(v ?? "").trim().slice(0, max);
function setSession(res, uid) {
  res.cookie("session", jwt.sign({ uid }, SECRET, { expiresIn: "7d" }), {
    httpOnly: true, sameSite: "lax", maxAge: 7 * 864e5, secure: process.env.NODE_ENV === "production",
  });
}

// ---------- Auth ----------
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: "Too many attempts. Try again in 15 minutes." } });

app.post("/api/auth/register", loginLimit, wrap((req, res) => {
  const name = str(req.body.name, 120), email = str(req.body.email, 190).toLowerCase(), phone = str(req.body.phone, 30), pw = String(req.body.password || "");
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter your name and a valid email.");
  if (pw.length < 8) throw new Error("Password must be at least 8 characters.");
  if (db.prepare("SELECT 1 FROM users WHERE email=?").get(email)) throw new Error("This email is already registered. Log in instead.");
  const id = db.prepare("INSERT INTO users (name,email,phone,password_hash) VALUES (?,?,?,?)").run(name, email, phone, bcrypt.hashSync(pw, 10)).lastInsertRowid;
  setSession(res, id);
  res.json({ ok: true });
}));

app.post("/api/auth/login", loginLimit, wrap((req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE email=?").get(str(req.body.email, 190).toLowerCase());
  if (!u || !bcrypt.compareSync(String(req.body.password || ""), u.password_hash)) throw new Error("Email or password is incorrect.");
  setSession(res, u.id);
  res.json({ ok: true, role: u.role });
}));

app.post("/api/auth/logout", (_req, res) => { res.clearCookie("session"); res.json({ ok: true }); });
app.get("/api/auth/me", (req, res) => res.json({ user: req.user || null }));

// ---------- Fees (public) ----------
app.get("/api/fees", (_req, res) => {
  const out = {};
  for (const f of db.prepare("SELECT key,label,amount FROM fees").all()) out[f.key] = { label: f.label, amount: f.amount };
  res.json(out);
});

// ---------- Applications (logged-in users) ----------
app.post("/api/applications", needLogin, wrap((req, res) => {
  const b = req.body, d = {
    business_name: str(b.business_name, 200), owner_name: str(b.owner_name, 120), phone: str(b.phone, 30), email: str(b.email, 190),
    address: str(b.address, 500), city: str(b.city, 100), state: str(b.state, 100), pincode: str(b.pincode, 12),
    reg_number: str(b.reg_number, 60), scheme: str(b.scheme, 100), products: str(b.products, 1000),
  };
  for (const [k, v] of Object.entries(d)) if (!v && k !== "reg_number") throw new Error("Please fill every required field.");
  if (!SCHEMES.includes(d.scheme)) throw new Error("Choose a valid certification scheme.");
  const id = db.prepare(`INSERT INTO applications (user_id,business_name,owner_name,phone,email,address,city,state,pincode,reg_number,scheme,products)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.user.id, d.business_name, d.owner_name, d.phone, d.email, d.address, d.city, d.state, d.pincode, d.reg_number, d.scheme, d.products).lastInsertRowid;
  res.json({ ok: true, id });
}));

app.get("/api/applications/mine", needLogin, (req, res) => {
  res.json(db.prepare(`SELECT a.id,a.business_name,a.scheme,a.status,a.remarks,a.created_at,c.cert_no,c.status AS cert_status,c.expiry_date
    FROM applications a LEFT JOIN certificates c ON c.application_id=a.id WHERE a.user_id=? ORDER BY a.id DESC`).all(req.user.id));
});

// ---------- Public: track and verify ----------
const certStatus = (c) => (c.status === "revoked" ? "revoked" : new Date(c.expiry_date) < new Date() ? "expired" : "valid");
const CERT_SQL = `SELECT c.sr_no,c.cert_no,c.issue_date,c.expiry_date,c.status,a.business_name,a.address,a.city,a.state,a.pincode,a.scheme,a.products
  FROM certificates c JOIN applications a ON a.id=c.application_id`;

app.get("/api/track", (req, res) => {
  const q = str(req.query.q, 40).toUpperCase();
  const row = /^\d+$/.test(q)
    ? db.prepare("SELECT cert_no FROM certificates WHERE sr_no=?").get(Number(q))
    : db.prepare("SELECT cert_no FROM certificates WHERE cert_no=?").get(q);
  row ? res.json(row) : res.status(404).json({ error: `No certificate found for "${q}". Check the number and try again.` });
});

app.get("/api/certificates/:certNo", (req, res) => {
  const c = db.prepare(CERT_SQL + " WHERE c.cert_no=?").get(req.params.certNo.toUpperCase());
  if (!c) return res.status(404).json({ error: "Certificate not found" });
  res.json({ ...c, validity: certStatus(c) });
});

app.get("/api/certificates/:certNo/qr", async (req, res) => {
  res.type("png").send(await qrPng(req.params.certNo.toUpperCase()));
});

app.get("/api/certificates/:certNo/pdf", async (req, res) => {
  const c = db.prepare(CERT_SQL + " WHERE c.cert_no=?").get(req.params.certNo.toUpperCase());
  if (!c) return res.status(404).send("Certificate not found");
  const bytes = await buildCertificatePdf(c);
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${c.cert_no}.pdf"` });
  res.send(Buffer.from(bytes));
});

// ---------- Admin (company only) ----------
app.get("/api/admin/applications", needAdmin, (_req, res) => {
  res.json(db.prepare(`SELECT a.*,u.email AS account_email,c.cert_no,c.sr_no,c.status AS cert_status,c.expiry_date
    FROM applications a JOIN users u ON u.id=a.user_id LEFT JOIN certificates c ON c.application_id=a.id ORDER BY a.id DESC`).all());
});

const approve = db.transaction((id, years, remarks) => {
  const a = db.prepare("SELECT * FROM applications WHERE id=?").get(id);
  if (!a) throw new Error("Application not found.");
  if (db.prepare("SELECT 1 FROM certificates WHERE application_id=?").get(id)) throw new Error("A certificate was already issued.");
  const sr = (db.prepare("SELECT MAX(sr_no) m FROM certificates").get().m || 0) + 1;
  const issue = new Date(), exp = new Date(issue);
  exp.setFullYear(exp.getFullYear() + years); exp.setDate(exp.getDate() - 1);
  const certNo = `HRK-${issue.getFullYear()}-${String(sr).padStart(5, "0")}`;
  db.prepare("INSERT INTO certificates (sr_no,cert_no,application_id,issue_date,expiry_date) VALUES (?,?,?,?,?)")
    .run(sr, certNo, id, issue.toISOString(), exp.toISOString());
  db.prepare("UPDATE applications SET status='approved',remarks=?,updated_at=datetime('now') WHERE id=?").run(remarks, id);
  return certNo;
});

app.post("/api/admin/applications/:id/approve", needAdmin, wrap((req, res) => {
  const years = Math.min(5, Math.max(1, parseInt(req.body.years, 10) || 1));
  res.json({ ok: true, cert_no: approve(Number(req.params.id), years, str(req.body.remarks, 500)) });
}));

app.post("/api/admin/applications/:id/:action(reject|review)", needAdmin, wrap((req, res) => {
  const status = req.params.action === "reject" ? "rejected" : "under_review";
  const r = db.prepare("UPDATE applications SET status=?,remarks=?,updated_at=datetime('now') WHERE id=? AND status!='approved'")
    .run(status, str(req.body.remarks, 500), Number(req.params.id));
  if (!r.changes) throw new Error("Could not update this application.");
  res.json({ ok: true });
}));

app.post("/api/admin/certificates/:certNo/:action(revoke|reinstate)", needAdmin, wrap((req, res) => {
  const r = db.prepare("UPDATE certificates SET status=? WHERE cert_no=?")
    .run(req.params.action === "revoke" ? "revoked" : "active", req.params.certNo.toUpperCase());
  if (!r.changes) throw new Error("Certificate not found.");
  res.json({ ok: true });
}));

app.put("/api/admin/fees", needAdmin, wrap((req, res) => {
  const upd = db.prepare("UPDATE fees SET amount=? WHERE key=?");
  db.transaction(() => {
    for (const [k, v] of Object.entries(req.body)) {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) throw new Error("Fees must be positive numbers.");
      upd.run(n, k);
    }
  })();
  res.json({ ok: true });
}));

// ---------- Pages ----------
// Admin page files live outside /public and are served to admins only
app.get("/admin", (req, res) => req.user?.role === "admin" ? res.sendFile(path.join(__dirname, "private/admin.html")) : res.status(404).sendFile(path.join(__dirname, "public/404.html")));
app.get("/admin/admin.js", needAdmin, (_req, res) => res.sendFile(path.join(__dirname, "private/admin.js")));
app.get("/verify/:certNo", (_req, res) => res.sendFile(path.join(__dirname, "public/verify.html")));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.use((_req, res) => res.status(404).sendFile(path.join(__dirname, "public/404.html")));

app.listen(PORT, () => console.log(`Halal Rizq Khidmaat portal running at http://localhost:${PORT}`));

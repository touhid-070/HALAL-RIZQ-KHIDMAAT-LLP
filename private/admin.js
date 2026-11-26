/* Admin panel (company only). Every call below is also checked on the server. */
const msg = document.getElementById("admin-msg");
const appsBox = document.getElementById("apps");

(async () => {
  const user = await ready;
  if (!user || user.role !== "admin") { location.href = "/"; return; }
  loadApplications();
  loadFees();
})();

async function loadApplications() {
  const apps = await api("/api/admin/applications");
  document.querySelector("h1").textContent = `Applications (${apps.length})`;
  if (!apps.length) { appsBox.innerHTML = "<p>No applications yet.</p>"; return; }
  appsBox.innerHTML = `<table><thead><tr><th>Business</th><th>Contact</th><th>Scheme and products</th><th>Status</th><th>Action</th></tr></thead><tbody>
  ${apps.map((a) => `<tr data-id="${a.id}">
    <td><strong>${esc(a.business_name)}</strong><br>${esc(a.address)}, ${esc(a.city)}, ${esc(a.state)} - ${esc(a.pincode)}<br>${a.reg_number ? "Reg: " + esc(a.reg_number) + "<br>" : ""}Applied ${formatDate(a.created_at.replace(" ", "T") + "Z")}</td>
    <td>${esc(a.owner_name)}<br>${esc(a.phone)}<br>${esc(a.email)}</td>
    <td>${esc(a.scheme)}<br>${esc(a.products)}</td>
    <td><span class="badge ${a.status}">${STATUS_LABEL[a.status]}</span>
      ${a.cert_no ? `<div><a href="/verify/${esc(a.cert_no)}">${esc(a.cert_no)}</a><br><span class="badge ${a.cert_status}">${STATUS_LABEL[a.cert_status]}</span></div>` : ""}</td>
    <td><div class="admin-actions">${actions(a)}</div></td></tr>`).join("")}
  </tbody></table>`;
}

function actions(a) {
  if (a.cert_no) {
    return a.cert_status === "active"
      ? `<button class="btn danger small" data-do="revoke" data-cert="${esc(a.cert_no)}">Revoke certificate</button>
         <a class="btn outline small" href="/api/certificates/${esc(a.cert_no)}/pdf" target="_blank">PDF</a>`
      : `<button class="btn small" data-do="reinstate" data-cert="${esc(a.cert_no)}">Reinstate</button>`;
  }
  return `<input class="remarks" placeholder="Remarks (shown to client)" value="${esc(a.remarks)}">
    <select class="years" aria-label="Validity"><option value="1">1 year</option><option value="2">2 years</option><option value="3">3 years</option></select>
    <button class="btn small" data-do="approve">Approve and issue</button>
    <button class="btn outline small" data-do="review">Under review</button>
    <button class="btn danger small" data-do="reject">Reject</button>`;
}

appsBox.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-do]");
  if (!btn) return;
  const row = btn.closest("tr"), id = row.dataset.id, what = btn.dataset.do;
  const body = { remarks: row.querySelector(".remarks")?.value || "", years: row.querySelector(".years")?.value };
  try {
    if (what === "revoke" || what === "reinstate") {
      if (what === "revoke" && !confirm("Revoke this certificate? It will show as Revoked to everyone.")) return;
      await api(`/api/admin/certificates/${btn.dataset.cert}/${what}`, { method: "POST" });
    } else {
      const res = await api(`/api/admin/applications/${id}/${what}`, { method: "POST", body });
      if (res.cert_no) showMessage(msg, `Certificate ${res.cert_no} issued.`, "success");
    }
    loadApplications();
  } catch (err) { showMessage(msg, err.message); }
});

async function loadFees() {
  const fees = await api("/api/fees");
  const form = document.getElementById("fee-form");
  form.innerHTML = Object.entries(fees).map(([k, f]) =>
    `<label for="f-${k}">${esc(f.label)}</label><input id="f-${k}" name="${k}" type="number" min="0" step="0.01" value="${f.amount}">`).join("") +
    '<p><button class="btn" type="submit">Save fees</button></p>';
  form.onsubmit = async (e) => {
    e.preventDefault();
    try { await api("/api/admin/fees", { method: "PUT", body: Object.fromEntries(new FormData(form)) }); showMessage(msg, "Fees saved. The Pricing page is updated.", "success"); }
    catch (err) { showMessage(msg, err.message); }
  };
}

/* Client dashboard: own applications, status and certificate download */
(async () => {
  if (!(await requireLogin())) return;
  if (new URLSearchParams(location.search).has("applied"))
    showMessage(document.getElementById("dash-msg"), "Application submitted. We will review it and update the status here.", "success");

  const apps = await api("/api/applications/mine");
  const box = document.getElementById("apps");
  if (!apps.length) { box.innerHTML = '<p>You have not applied yet.</p><a class="btn" href="/apply">Apply for certification</a>'; return; }
  box.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Business</th><th>Scheme</th><th>Applied</th><th>Status</th><th>Certificate</th></tr></thead><tbody>
    ${apps.map((a) => `<tr><td>${esc(a.business_name)}</td><td>${esc(a.scheme)}</td><td>${formatDate(a.created_at.replace(" ", "T") + "Z")}</td>
      <td><span class="badge ${a.status}">${STATUS_LABEL[a.status]}</span>${a.remarks ? `<div>${esc(a.remarks)}</div>` : ""}</td>
      <td>${a.cert_no ? `<a href="/verify/${esc(a.cert_no)}">${esc(a.cert_no)}</a><br><a class="btn small" href="/api/certificates/${esc(a.cert_no)}/pdf" target="_blank">Download PDF</a>` : "Not issued yet"}</td></tr>`).join("")}
    </tbody></table></div>`;
})();

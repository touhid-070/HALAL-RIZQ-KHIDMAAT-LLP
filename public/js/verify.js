/* Verification page: opened by the QR code on a certificate (/verify/HRK-2026-00001) */
(async () => {
  const certNo = decodeURIComponent(location.pathname.split("/").pop()).toUpperCase();
  const box = document.getElementById("result");
  try {
    const c = await api("/api/certificates/" + encodeURIComponent(certNo));
    document.title = c.cert_no + " | Halal Rizq Khidmaat LLP";
    box.innerHTML = `
      <h1>${esc(c.cert_no)} <span class="badge ${c.validity}">${STATUS_LABEL[c.validity]}</span></h1>
      <div class="verify-grid">
        <dl class="details">
          <dt>Business</dt><dd>${esc(c.business_name)}</dd>
          <dt>Address</dt><dd>${esc(c.address)}, ${esc(c.city)}, ${esc(c.state)} - ${esc(c.pincode)}</dd>
          <dt>Sr. No.</dt><dd>${c.sr_no}</dd>
          <dt>Scheme</dt><dd>${esc(c.scheme)}</dd>
          <dt>Products / scope</dt><dd>${esc(c.products)}</dd>
          <dt>Date of issue</dt><dd>${formatDate(c.issue_date)}</dd>
          <dt>Valid until</dt><dd>${formatDate(c.expiry_date)}</dd>
          <dt>Issued by</dt><dd>Halal Rizq Khidmaat LLP</dd>
        </dl>
        <div class="qr-box">
          <img src="/api/certificates/${encodeURIComponent(c.cert_no)}/qr" alt="QR code for ${esc(c.cert_no)}">
          <p><a class="btn small" href="/api/certificates/${encodeURIComponent(c.cert_no)}/pdf" target="_blank">View certificate PDF</a></p>
        </div>
      </div>`;
  } catch (err) {
    box.innerHTML = `<h1>Certificate not found</h1><div class="alert error">No certificate matches ${esc(certNo)}. Treat this certificate as unverified.</div><a href="/track">Search again</a>`;
  }
})();

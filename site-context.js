// Hostname boundaries come from the bundled Public Suffix List, including its
// private section: two github.io tenants must never share an approval.
globalThis.VolitionSites = (() => {
  function site(domain) {
    const parsed = tldts.parse(domain, { allowPrivateDomains: true });
    return (parsed.isIcann || parsed.isPrivate) && parsed.domain
      ? parsed.domain : domain;
  }

  function summarize(entry, requestedDomain, now) {
    let domain = entry.domain;
    if (!domain && entry.url) {
      try { domain = new URL(entry.url).hostname; } catch {}
    }
    const approvedUntil = entry.approvedUntil ?? (
      Number.isFinite(entry.approvedMs) && Number.isFinite(Date.parse(entry.timestamp))
        ? Date.parse(entry.timestamp) + entry.approvedMs : null
    );
    const unlimited = entry.approvedMs === null && entry.approvedUntil === null;
    return {
      domain: domain || null,
      site: domain ? site(domain) : null,
      sameSiteAsRequest: !!domain && site(domain) === site(requestedDomain),
      approvedMs: entry.approvedMs ?? null,
      approvedUntil,
      unlimited,
      active: unlimited || Number.isFinite(approvedUntil) && approvedUntil > now,
      remainingMs: unlimited ? null : Math.max(0, (approvedUntil || now) - now),
      asOf: new Date(now).toISOString(),
      desc: entry.desc,
      timestamp: entry.timestamp
    };
  }

  return { site, summarize };
})();

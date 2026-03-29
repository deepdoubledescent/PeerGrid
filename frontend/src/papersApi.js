const BASE = "https://api.openalex.org";
function buildMailto(user) {
  if (!user?.email) return "";
  return `&mailto=${encodeURIComponent(user.email)}`;
}

export async function getWorkById(workId) {
  if (!workId) return null;

  const s = String(workId).trim();

  if (s.startsWith("https://api.openalex.org/works/")) {
    const res = await fetch(s);
    if (!res.ok) return null;
    return await res.json();
  }

  const match = s.match(/W\d+/);
  const wid = match ? match[0] : null;
  if (!wid) return null;

  const url = `https://api.openalex.org/works/${wid}`;

  const res = await fetch(url);
  if (!res.ok) return null;
  return await res.json();
}


export async function searchInstitutions(query, user) {
  if (!query) return [];

  const res = await fetch(
    `${BASE}/institutions?search=${encodeURIComponent(query)}&per_page=5${buildMailto(user)}`
  );

  const data = await res.json();
  return data.results ?? [];
}

export async function searchWorks(
  { q, sinceYear, institutionId, cursor = "*" },
  user
) {
  const filters = [];

  if (sinceYear) {
    filters.push(`from_publication_date:${sinceYear}-01-01`);
  }
  if (institutionId) {
    filters.push(`institutions.id:${institutionId}`);
  }

  const filterParam = filters.length ? `&filter=${filters.join(",")}` : "";
  const searchParam = q ? `&search=${encodeURIComponent(q)}` : "";

  const url = `${BASE}/works?per_page=10&cursor=${cursor}${searchParam}${filterParam}${buildMailto(user)}`;

  const res = await fetch(url);
  const data = await res.json();

  return {
    papers: data.results ?? [],
    nextCursor: data.meta?.next_cursor ?? null,
  };
}

export async function getPaperById(paperId) {
  const url = `${BASE}/works/${paperId}}`;

  const res = await fetch(url);
  const data = await res.json();

  return data
}
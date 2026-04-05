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

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function getRecommendedWorksByTopics({
  topicIds = [],
  excludeIds = [],
  perPage = 20,
  user,
}) {
  const cleanedTopicIds = [...new Set(
    (topicIds || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
      .map((id) => `T${id}`)
  )];

  if (!cleanedTopicIds.length) {
    return [];
  }

  const searchParams = new URLSearchParams();
  searchParams.set("per_page", "100"); // bigger pool
  searchParams.set("filter", `topics.id:${cleanedTopicIds.join("|")}`);

  if (user?.email) {
    searchParams.set("mailto", user.email);
  }

  const url = `${BASE}/works?${searchParams.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    console.error("OpenAlex error:", text);
    throw new Error("Failed to fetch recommended papers");
  }

  const data = await res.json();
  const results = data.results ?? [];

  const excluded = new Set((excludeIds || []).map((id) => String(id)));

  const filtered = results.filter((paper) => {
    const workId = paper.id.split("/").filter(Boolean).pop();
    return !excluded.has(workId);
  });

  return shuffleArray(filtered).slice(0, perPage);
}
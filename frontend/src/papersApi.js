const BASE = "https://api.openalex.org";

function buildMailto(user) {
  if (!user?.email) return "";
  return `&mailto=${encodeURIComponent(user.email)}`;
}

async function fetchJson(url, errorPrefix = "Request failed") {
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${errorPrefix}: ${res.status} ${text}`);
  }

  return await res.json();
}

function normalizeInstitutionResult(inst) {
  const rawId = inst.id || inst.entity_id || inst.openalex_id || "";
  const displayName = inst.display_name || inst.name || "";

  if (!rawId || !displayName) return null;

  let normalizedId = rawId;
  if (typeof rawId === "string" && rawId.includes("openalex.org/")) {
    normalizedId = rawId;
  }

  return {
    id: normalizedId,
    display_name: displayName,
  };
}

function normalizeWorkTypeId(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const match = raw.match(/types\/([^/?#]+)$/i);
  if (match) return match[1];

  return raw.toLowerCase();
}

function normalizeTopicId(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const match = raw.match(/(T\d+)$/i);
  if (match) return match[1].toUpperCase();

  return raw;
}

function normalizeSubtopicId(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const urlMatch = raw.match(/subfields\/(\d+)$/i);
  if (urlMatch) return urlMatch[1];

  const numberMatch = raw.match(/(\d+)$/);
  if (numberMatch) return numberMatch[1];

  return raw;
}

export async function getWorkById(workId, user) {
  if (!workId) return null;

  const s = String(workId).trim();

  if (s.startsWith("https://api.openalex.org/works/")) {
    return await fetchJson(
      `${s}${user?.email ? `?mailto=${encodeURIComponent(user.email)}` : ""}`,
      "Failed to fetch work"
    );
  }

  const match = s.match(/W\d+/);
  const wid = match ? match[0] : null;
  if (!wid) return null;

  const url = `${BASE}/works/${wid}?${buildMailto(user).replace(/^&/, "")}`;
  return await fetchJson(url, "Failed to fetch work");
}

export async function searchInstitutions(query, user) {
  const value = String(query || "").trim();
  if (!value) return [];

  const url = `${BASE}/autocomplete/institutions?q=${encodeURIComponent(value)}${buildMailto(user)}`;
  const data = await fetchJson(url, "Institution search failed");

  return (data.results || [])
    .map(normalizeInstitutionResult)
    .filter(Boolean);
}

export async function searchWorks(
  {
    q,
    sinceYear,
    institutionId,
    workType,
    topicId,
    topicIds,
    subtopicIds,
    cursor = "*",
    perPage = 10,
  } = {},
  user
) {
  const filters = [];

  const trimmedQuery = String(q || "").trim();
  const trimmedYear = String(sinceYear || "").trim();

  if (trimmedYear) {
    filters.push(`from_publication_date:${trimmedYear}-01-01`);
  }

  if (institutionId) {
    filters.push(`authorships.institutions.id:${institutionId}`);
  }

  const normalizedWorkType = normalizeWorkTypeId(workType);
  if (normalizedWorkType) {
    filters.push(`type:${normalizedWorkType}`);
  }

  const normalizedTopicIds = [
    ...new Set((topicIds || []).map(normalizeTopicId).filter(Boolean)),
  ];

  const normalizedSingleTopicId =
    normalizedTopicIds.length === 0 ? normalizeTopicId(topicId) : null;

  if (normalizedTopicIds.length > 0) {
    filters.push(`primary_topic.id:${normalizedTopicIds.join("|")}`);
  } else if (normalizedSingleTopicId) {
    filters.push(`primary_topic.id:${normalizedSingleTopicId}`);
  }

  const normalizedSubtopicIds = [
    ...new Set((subtopicIds || []).map(normalizeSubtopicId).filter(Boolean)),
  ];

  if (normalizedSubtopicIds.length > 0) {
    filters.push(`primary_topic.subfield.id:${normalizedSubtopicIds.join("|")}`);
  }

  const filterParam = filters.length ? `&filter=${filters.join(",")}` : "";
  const searchParam = trimmedQuery ? `&search=${encodeURIComponent(trimmedQuery)}` : "";
  const url = `${BASE}/works?per_page=${perPage}&cursor=${encodeURIComponent(cursor)}${searchParam}${filterParam}${buildMailto(user)}`;

  const data = await fetchJson(url, "Works search failed");

  return {
    papers: data.results ?? [],
    nextCursor: data.meta?.next_cursor ?? null,
  };
}

export async function getPaperById(paperId, user) {
  if (!paperId) return null;

  const cleanedId = String(paperId).trim().replace(/}/g, "");
  const url = `${BASE}/works/${cleanedId}${buildMailto(user).replace(/^&/, "?")}`;

  return await fetchJson(url, "Failed to fetch paper");
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
  const cleanedTopicIds = [
    ...new Set(
      (topicIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
        .map((id) => `T${id}`)
    ),
  ];

  if (!cleanedTopicIds.length) {
    return [];
  }

  const searchParams = new URLSearchParams();
  searchParams.set("per_page", "100");
  searchParams.set("filter", `topics.id:${cleanedTopicIds.join("|")}`);

  if (user?.email) {
    searchParams.set("mailto", user.email);
  }

  const url = `${BASE}/works?${searchParams.toString()}`;
  const data = await fetchJson(url, "Failed to fetch recommended papers");
  const results = data.results ?? [];

  const excluded = new Set((excludeIds || []).map((id) => String(id)));

  const filtered = results.filter((paper) => {
    const workId = paper.id.split("/").filter(Boolean).pop();
    return !excluded.has(workId);
  });

  return shuffleArray(filtered).slice(0, perPage);
}
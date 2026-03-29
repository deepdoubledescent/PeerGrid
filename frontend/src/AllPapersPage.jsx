import { useEffect, useState } from "react";
import { Search, X, Minus, Landmark, Calendar as CalendarIcon, MessageSquareText } from "lucide-react";
import { searchInstitutions, searchWorks } from "./papersApi";
import { toggleLikePaper, getPaperMetaBatch } from "./Controller";
import { Link } from 'react-router-dom';

/**
 * ListEntry is now a pure "Presentational" component.
 * It just displays what it's told via props.
 */
const ListEntry = ({ paper, liked, likeCount, commentCount, onTogglePaperLike }) => {
  const paper_id = paper.id.split("/").filter(Boolean).pop();

  return (
    <div key={paper_id} className="card p-4 relative">
      <a
        href={`/papers/${paper_id}`}
        className="font-medium text-lg hover:underline"
      >
        {paper.title}
      </a>

      <div className="text-sm opacity-70 mt-1">
        {paper.publication_year} ·{" "}
        {(paper.authorships || [])
          .slice(0, 4)
          .map((a) => a.author.display_name)
          .join(", ")}
      </div>

      {paper.open_access?.oa_url && (
        <a
          href={paper.open_access.oa_url}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-blue-600 mt-2 inline-block"
        >
          Open access PDF
        </a>
      )}

      <section className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          className={`btn-outline px-5 py-2 ${liked ? "text-red-600" : ""}`}
          aria-label="Like paper"
          onClick={() => onTogglePaperLike(paper_id)}
        >
          {liked ? "♥" : "♡"} Like {likeCount ?? 0}
        </button>

        <div className="flex justify-end">
          <Link
            to={`/papers/${paper_id}`}
            state={{ paper_object: paper }}
            className="flex items-center gap-1 hover:bg-stone-200/50 p-3 pointer-cursor"
          >
            <MessageSquareText size={18} />
            <span>{commentCount ?? "-"}</span>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default function AllPapersPage({ user }) {
  const [query, setQuery] = useState("");
  const [sinceYear, setSinceYear] = useState("");
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [institutions, setInstitutions] = useState([]);
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [showInstituteSuggestions, setShowInstituteSuggestions] = useState(false);
  const [hasInstitutionSearchAttempt, setHasInstitutionSearchAttempt] = useState(false);

  const [papers, setPapers] = useState([]);
  const [cursor, setCursor] = useState("*");
  const [loading, setLoading] = useState(false);

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const toggleAdvanced = () => setIsAdvancedOpen((p) => !p);

  // Consolidated metadata state: { [id]: { liked: bool, likeCount: int, commentCount: int } }
  const [metaById, setMetaById] = useState({});
  const [status, setStatus] = useState({ type: "", message: "" });

  // --- Institution search (typeahead) ---
  useEffect(() => {
    let cancelled = false;

    const loadInstitutions = async () => {
      const value = String(institutionQuery || "").trim();

      if (!showInstituteSuggestions) return;

      if (value.length < 2) {
        setInstitutions([]);
        setHasInstitutionSearchAttempt(false);
        return;
      }

      try {
        const res = await searchInstitutions(value, user);
        if (!cancelled) {
          setInstitutions(res || []);
          setHasInstitutionSearchAttempt(true);
        }
      } catch (error) {
        console.error("Failed to fetch institution suggestions", error);
        if (!cancelled) {
          setInstitutions([]);
          setHasInstitutionSearchAttempt(true);
        }
      }
    };

    const t = setTimeout(loadInstitutions, 300);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [institutionQuery, showInstituteSuggestions, user]);

  // --- Fetch papers ---
  const fetchPapers = async ({ reset = false } = {}) => {
    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const res = await searchWorks({
        q: query,
        sinceYear,
        institutionId: selectedInstitution?.id,
        cursor: reset ? "*" : cursor,
        user,
      });

      const incomingPapers = res?.papers ?? res?.results ?? [];
      const next = res?.nextCursor ?? res?.meta?.next_cursor ?? null;

      if (reset) {
        setPapers(incomingPapers);
        setMetaById({});
      } else {
        setPapers((prev) => [...prev, ...incomingPapers]);
      }
      setCursor(next);
    } catch (e) {
      console.error("searchWorks failed:", e);
      setStatus({
        type: "error",
        message: "Search failed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const onSearch = () => {
    if (loading) return;
    fetchPapers({ reset: true });
  };

  const resetFilters = () => {
    setQuery("");
    setSinceYear("");
    setInstitutionQuery("");
    setInstitutions([]);
    setSelectedInstitution(null);
    setShowInstituteSuggestions(false);
    setHasInstitutionSearchAttempt(false);
    setPapers([]);
    setCursor("*");
    setMetaById({});
    setStatus({ type: "", message: "" });
  };

  const clearSearch = () => {
    setQuery("");
    setPapers([]);
    setCursor("*");
    setMetaById({});
  };

  // --- BATCH FETCH EFFECT ---
  // This watches the papers list. If new papers appear without meta, it fetches them.
  useEffect(() => {
    const syncMetadata = async () => {
      if (papers.length === 0) return;

      const idsToFetch = papers
        .map((p) => p.id.split("/").filter(Boolean).pop())
        .filter((id) => !metaById[id]);

      if (idsToFetch.length === 0) return;

      try {
        const { likeCounts, hasLiked, commentCounts } = await getPaperMetaBatch(idsToFetch);

        const newMetaBatch = {};
        idsToFetch.forEach((id, index) => {
          newMetaBatch[id] = {
            liked: hasLiked[index],
            likeCount: likeCounts[index],
            commentCount: commentCounts[index],
          };
        });

        setMetaById((prev) => ({ ...prev, ...newMetaBatch }));
      } catch (err) {
        console.error("Failed to fetch batch metadata", err);
      }
    };

    syncMetadata();
  }, [papers, user]);

  const onTogglePaperLike = async (workId) => {
    setStatus({ type: "", message: "" });

    if (!user) {
      setStatus({ type: "error", message: "Please log in to like papers." });
      return;
    }

    await toggleLikePaper(workId);

    const { likeCounts, hasLiked, commentCounts } = await getPaperMetaBatch([workId]);

    setMetaById((prev) => ({
      ...prev,
      [workId]: {
        liked: hasLiked[0],
        likeCount: likeCounts[0],
        commentCount: commentCounts[0],
      },
    }));
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6">All Papers</h1>

      {/* Search Bar */}
      <div className="search-bar flex flex-row">
        <div className="group w-full flex items-center border-b-1 border-black transition-all duration-300 focus-within:border-stone-600">
          <div className="w-full flex relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder="Search"
              className="h-fit w-full bg-transparent py-2 pr-12 focus:outline-none placeholder-stone-400/50 text-stone-900 font-normal"
            />
            <div className="absolute right-0 py-2 text-stone-400">
              {query && (
                <button onClick={clearSearch} className="hover:text-stone-900 transition-colors opacity-50 mr-2">
                  <X size={24} strokeWidth={1.5} />
                </button>
              )}
              <button onClick={onSearch} className="hover:text-stone-900 transition-colors" disabled={loading}>
                <Search size={24} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Toggle Area */}
        <div className="flex justify-center mt-2 relative z-10">
          <button
            onClick={toggleAdvanced}
            className="flex flex-col items-center group focus:outline-none"
            aria-expanded={isAdvancedOpen}
          >
            <div className={`p-2 rounded-full duration-500 ${isAdvancedOpen ? 'bg-stone-200' : 'hover:bg-stone-200/50'}`}>
              <Minus
                size={20}
                className={`text-stone-600 transition-all ${isAdvancedOpen ? 'rotate-180' : ''}`}
                strokeWidth={1.5}
              />
              <Minus
                size={20}
                className={`text-stone-600 transition-all -mt-[100%] ${isAdvancedOpen ? 'rotate-180' : 'rotate-90'}`}
                strokeWidth={1.5}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Advanced filters panel */}
      <div
        className={`relative z-30 mx-auto w-full max-w-4xl transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isAdvancedOpen ? "max-h-[650px] opacity-100 mt-6" : "max-h-0 opacity-0 mt-0"
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 px-2">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-stone-500">
              <CalendarIcon size={14} /> Since year
            </label>
            <input
              type="number"
              placeholder="YYYY"
              value={sinceYear}
              onChange={(e) => setSinceYear(e.target.value)}
              className="bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2 relative">
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-stone-500">
              <Landmark size={14} /> Institute
            </label>

            <div className="relative">
              <input
                type="text"
                placeholder="Institute"
                value={selectedInstitution?.display_name || institutionQuery}
                onChange={(e) => {
                  setSelectedInstitution(null);
                  setInstitutionQuery(e.target.value);
                  setShowInstituteSuggestions(true);
                }}
                onFocus={() => setShowInstituteSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowInstituteSuggestions(false), 150);
                }}
                className="w-full bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors placeholder-stone-300"
              />

              {showInstituteSuggestions && !selectedInstitution && (
                <ul className="absolute left-0 top-full w-full z-[60] bg-stone-50 border border-stone-200 mt-1 max-h-48 overflow-y-auto shadow-lg shadow-stone-200/50 rounded-sm custom-scrollbar">
                  {institutions.length > 0 ? (
                    institutions.map((inst) => (
                      <li
                        key={inst.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedInstitution(inst);
                          setInstitutionQuery(inst.display_name);
                          setInstitutions([]);
                          setShowInstituteSuggestions(false);
                          setHasInstitutionSearchAttempt(false);
                        }}
                        className="px-3 py-2 hover:bg-stone-200 cursor-pointer text-stone-700 text-lg transition-colors border-b border-stone-100 last:border-0"
                      >
                        {inst.display_name}
                      </li>
                    ))
                  ) : hasInstitutionSearchAttempt ? (
                    <li className="px-3 py-2 text-stone-400 italic text-sm">
                      No matches found
                    </li>
                  ) : null}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end items-center gap-4 pt-6 pb-4 border-b border-stone-200">
          <button
            type="button"
            className="text-xs font-sans uppercase tracking-[0.15em] hover:text-stone-600 transition-colors text-stone-400"
            onClick={resetFilters}
          >
            Reset Filters
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onSearch}
            disabled={loading}
          >
            Search
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4 mt-10 divide-y divide-gray-200">
        {papers.map((p) => {
          const id = p.id.split("/").filter(Boolean).pop();
          const meta = metaById[id] || {};
          return (
            <ListEntry
              key={id}
              paper={p}
              liked={meta.liked}
              likeCount={meta.likeCount}
              commentCount={meta.commentCount}
              onTogglePaperLike={onTogglePaperLike}
            />
          );
        })}
      </div>

      {/* Load more */}
      {papers.length > 0 && cursor && (
        <div className="mt-8 text-center">
          <button
            className="btn-outline"
            onClick={() => fetchPapers()}
            disabled={loading}
            type="button"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      {status.message && (
        <div className={`mt-4 text-center ${status.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
          {status.message}
        </div>
      )}
    </div>
  );
}

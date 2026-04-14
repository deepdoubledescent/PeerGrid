import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  X,
  Minus,
  Landmark,
  Calendar as CalendarIcon,
  MessageSquareText,
  BookOpen,
  Tags,
  Network,
} from "lucide-react";
import { searchInstitutions, searchWorks } from "./papersApi";
import {
  toggleLikePaper,
  getPaperMetaBatch,
  getPaperWorkTypes,
  getPaperSubtopics,
  getPaperTopics,
  getPaperTopicSiblings,
} from "./Controller";
import { Link, useNavigate } from "react-router-dom";

const extractPaperTopics = (paper) => {
  return (paper?.topics || [])
    .map((topic) => ({
      topic_id: Number(String(topic.id || "").match(/\d+/)?.[0]),
      score: Number(topic.score) || 0,
    }))
    .filter((topic) => Number.isFinite(topic.topic_id) && topic.score > 0);
};

const getPaperId = (paper) => paper?.id?.split("/").filter(Boolean).pop();

const ListEntry = ({
  paper,
  liked,
  likeCount,
  commentCount,
  onTogglePaperLike,
  metaLoading,
}) => {
  const paperId = getPaperId(paper);

  return (
    <div key={paperId} className="card p-4 relative">
      <a href={`/papers/${paperId}`} className="font-medium text-lg hover:underline">
        {paper.title}
      </a>

      <div className="text-sm opacity-70 mt-1">
        {paper.publication_year} ·{" "}
        {(paper.authorships || [])
          .slice(0, 4)
          .map((a) => a.author.display_name)
          .join(", ")}
      </div>

      {paper.primary_topic?.display_name && (
        <div className="text-sm text-stone-600 mt-2">
          Primary topic: {paper.primary_topic.display_name}
        </div>
      )}

      {paper.type && (
        <div className="text-sm text-stone-500 mt-1">
          Type: {paper.type}
        </div>
      )}

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
          onClick={() => onTogglePaperLike(paperId, paper)}
        >
          {liked ? "♥" : "♡"} Like {metaLoading ? "..." : (likeCount ?? 0)}
        </button>

        <div className="flex justify-end">
          <Link
            to={`/papers/${paperId}`}
            state={{ paper_object: paper }}
            className="flex items-center gap-1 hover:bg-stone-200/50 p-3 pointer-cursor"
          >
            <MessageSquareText size={18} />
            <span>{metaLoading ? "..." : (commentCount ?? "-")}</span>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default function AllPapersPage({ user }) {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [sinceYear, setSinceYear] = useState("");

  const [institutionQuery, setInstitutionQuery] = useState("");
  const [institutions, setInstitutions] = useState([]);
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [showInstituteSuggestions, setShowInstituteSuggestions] = useState(false);
  const [hasInstitutionSearchAttempt, setHasInstitutionSearchAttempt] = useState(false);
  const [institutionLoading, setInstitutionLoading] = useState(false);

  const [workTypes, setWorkTypes] = useState([]);
  const [workTypesLoading, setWorkTypesLoading] = useState(false);
  const [selectedWorkType, setSelectedWorkType] = useState("");

  const [subtopicQuery, setSubtopicQuery] = useState("");
  const [subtopicOptions, setSubtopicOptions] = useState([]);
  const [selectedSubtopics, setSelectedSubtopics] = useState([]);
  const [showSubtopicSuggestions, setShowSubtopicSuggestions] = useState(false);
  const [subtopicLoading, setSubtopicLoading] = useState(false);

  const [topicQuery, setTopicQuery] = useState("");
  const [topicOptions, setTopicOptions] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [showTopicSuggestions, setShowTopicSuggestions] = useState(false);
  const [topicLoading, setTopicLoading] = useState(false);

  const [includeSiblingTopics, setIncludeSiblingTopics] = useState(false);

  const [papers, setPapers] = useState([]);
  const [cursor, setCursor] = useState("*");
  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const toggleAdvanced = () => setIsAdvancedOpen((p) => !p);

  const [metaById, setMetaById] = useState({});
  const [status, setStatus] = useState({ type: "", message: "" });

  const metaFetchInFlightRef = useRef(new Set());

  const normalizedInstitutionInput = useMemo(
    () => String(institutionQuery || "").trim(),
    [institutionQuery]
  );

  const normalizedSubtopicInput = useMemo(
    () => String(subtopicQuery || "").trim(),
    [subtopicQuery]
  );

  const normalizedTopicInput = useMemo(
    () => String(topicQuery || "").trim(),
    [topicQuery]
  );

  const topicLookupSubtopicId = useMemo(() => {
    return selectedSubtopics.length === 1 ? selectedSubtopics[0].id : null;
  }, [selectedSubtopics]);

  const isSubtopicSelected = (id) => {
    return selectedSubtopics.some((item) => item.id === id);
  };

  const toggleSubtopic = (item) => {
    setSelectedSubtopics((prev) => {
      const exists = prev.some((s) => s.id === item.id);
      if (exists) {
        return prev.filter((s) => s.id !== item.id);
      }
      return [...prev, item];
    });
  };

  const removeSubtopic = (id) => {
    setSelectedSubtopics((prev) => prev.filter((item) => item.id !== id));
  };

  useEffect(() => {
    let cancelled = false;

    const loadWorkTypes = async () => {
      setWorkTypesLoading(true);
      try {
        const rows = await getPaperWorkTypes();
        if (!cancelled) {
          setWorkTypes(rows || []);
        }
      } catch (error) {
        console.error("Failed to load work types", error);
        if (!cancelled) {
          setWorkTypes([]);
        }
      } finally {
        if (!cancelled) {
          setWorkTypesLoading(false);
        }
      }
    };

    loadWorkTypes();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInstitutions = async () => {
      if (!showInstituteSuggestions) return;

      if (normalizedInstitutionInput.length < 2) {
        setInstitutions([]);
        setHasInstitutionSearchAttempt(false);
        setInstitutionLoading(false);
        return;
      }

      setInstitutionLoading(true);

      try {
        const res = await searchInstitutions(normalizedInstitutionInput, user);

        if (!cancelled) {
          setInstitutions(res || []);
          setHasInstitutionSearchAttempt(true);
        }
      } catch (error) {
        console.error("Failed to fetch institution suggestions", error);

        if (!cancelled) {
          setInstitutions([]);
          setHasInstitutionSearchAttempt(true);
          setStatus({
            type: "error",
            message: "Institution search failed. Please try again.",
          });
        }
      } finally {
        if (!cancelled) {
          setInstitutionLoading(false);
        }
      }
    };

    const t = setTimeout(loadInstitutions, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [normalizedInstitutionInput, showInstituteSuggestions, user]);

  useEffect(() => {
    let cancelled = false;

    const loadSubtopics = async () => {
      if (!showSubtopicSuggestions) return;

      setSubtopicLoading(true);

      try {
        const rows = await getPaperSubtopics(
          normalizedSubtopicInput,
          selectedTopic?.id || null
        );
        if (!cancelled) {
          setSubtopicOptions(rows || []);
        }
      } catch (error) {
        console.error("Failed to fetch subtopics", error);
        if (!cancelled) {
          setSubtopicOptions([]);
        }
      } finally {
        if (!cancelled) {
          setSubtopicLoading(false);
        }
      }
    };

    const t = setTimeout(loadSubtopics, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [normalizedSubtopicInput, showSubtopicSuggestions, selectedTopic]);

    useEffect(() => {
    let cancelled = false;

    const enforceSubtopicsForSelectedTopic = async () => {
      if (!selectedTopic?.id) return;

      try {
        const allowedRows = await getPaperSubtopics("", selectedTopic.id);
        if (cancelled) return;

        const allowedIds = new Set((allowedRows || []).map((row) => row.id));

        setSelectedSubtopics((prev) =>
          prev.filter((item) => allowedIds.has(item.id))
        );
      } catch (error) {
        console.error("Failed to enforce topic/subtopic consistency", error);
      }
    };

    enforceSubtopicsForSelectedTopic();

    return () => {
      cancelled = true;
    };
  }, [selectedTopic]);

  useEffect(() => {
    let cancelled = false;

    const loadTopics = async () => {
      if (!showTopicSuggestions) return;

      setTopicLoading(true);

      try {
        const rows = await getPaperTopics(
          topicLookupSubtopicId,
          normalizedTopicInput
        );
        if (!cancelled) {
          setTopicOptions(rows || []);
        }
      } catch (error) {
        console.error("Failed to fetch topics", error);
        if (!cancelled) {
          setTopicOptions([]);
        }
      } finally {
        if (!cancelled) {
          setTopicLoading(false);
        }
      }
    };

    const t = setTimeout(loadTopics, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [normalizedTopicInput, topicLookupSubtopicId, showTopicSuggestions]);

  const fetchPapers = async ({ reset = false } = {}) => {
    if (loading) return;

    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      let expandedTopicIds = null;

      if (selectedTopic?.id) {
        if (includeSiblingTopics) {
          const siblingRows = await getPaperTopicSiblings(selectedTopic.id);
          expandedTopicIds = Array.from(
            new Set([
              selectedTopic.id,
              ...(siblingRows || []).map((row) => row.id).filter(Boolean),
            ])
          );
        } else {
          expandedTopicIds = [selectedTopic.id];
        }
      }

      const res = await searchWorks(
        {
          q: query.trim(),
          sinceYear: String(sinceYear || "").trim(),
          institutionId: selectedInstitution?.id || null,
          workType: selectedWorkType || null,
          topicId: !expandedTopicIds?.length ? selectedTopic?.id || null : null,
          topicIds: expandedTopicIds,
          subtopicIds: selectedSubtopics.map((item) => item.id),
          cursor: reset ? "*" : cursor,
        },
        user
      );

      const incomingPapers = res?.papers ?? [];
      const next = res?.nextCursor ?? null;

      if (reset) {
        setPapers(incomingPapers);
      } else {
        setPapers((prev) => {
          const seen = new Set(prev.map((p) => getPaperId(p)));
          const dedupedIncoming = incomingPapers.filter((p) => !seen.has(getPaperId(p)));
          return [...prev, ...dedupedIncoming];
        });
      }

      setCursor(next);

      if (reset && incomingPapers.length === 0) {
        setStatus({
          type: "info",
          message: "No papers found for your current search.",
        });
      }
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
    setInstitutionLoading(false);

    setSelectedWorkType("");

    setSubtopicQuery("");
    setSubtopicOptions([]);
    setSelectedSubtopics([]);
    setShowSubtopicSuggestions(false);
    setSubtopicLoading(false);

    setTopicQuery("");
    setTopicOptions([]);
    setSelectedTopic(null);
    setShowTopicSuggestions(false);
    setTopicLoading(false);

    setIncludeSiblingTopics(false);

    setPapers([]);
    setCursor("*");
    setMetaById({});
    metaFetchInFlightRef.current.clear();
    setStatus({ type: "", message: "" });
  };

  const clearSearch = () => {
    setQuery("");
    setPapers([]);
    setCursor("*");
    setMetaById({});
    metaFetchInFlightRef.current.clear();
    setStatus({ type: "", message: "" });
  };

  useEffect(() => {
    let cancelled = false;

    const syncMetadata = async () => {
      if (papers.length === 0) return;

      const idsToFetch = papers
        .map((p) => getPaperId(p))
        .filter(Boolean)
        .filter(
          (id) => !metaById[id] && !metaFetchInFlightRef.current.has(id)
        );

      if (idsToFetch.length === 0) return;

      idsToFetch.forEach((id) => metaFetchInFlightRef.current.add(id));
      setMetadataLoading(true);

      try {
        const { likeCounts = [], hasLiked = [], commentCounts = [] } =
          await getPaperMetaBatch(idsToFetch);

        if (cancelled) return;

        const newMetaBatch = {};
        idsToFetch.forEach((id, index) => {
          newMetaBatch[id] = {
            liked: hasLiked[index] ?? false,
            likeCount: likeCounts[index] ?? 0,
            commentCount: commentCounts[index] ?? 0,
          };
        });

        setMetaById((prev) => ({ ...prev, ...newMetaBatch }));
      } catch (err) {
        console.error("Failed to fetch batch metadata", err);
      } finally {
        idsToFetch.forEach((id) => metaFetchInFlightRef.current.delete(id));
        if (!cancelled) {
          setMetadataLoading(false);
        }
      }
    };

    syncMetadata();

    return () => {
      cancelled = true;
    };
  }, [papers, metaById]);

  const onTogglePaperLike = async (workId, paper) => {
    setStatus({ type: "", message: "" });

    if (!user) {
      setStatus({ type: "error", message: "Please log in to like papers." });
      return;
    }

    try {
      await toggleLikePaper(workId, extractPaperTopics(paper));

      const { likeCounts = [], hasLiked = [], commentCounts = [] } =
        await getPaperMetaBatch([workId]);

      setMetaById((prev) => ({
        ...prev,
        [workId]: {
          liked: hasLiked[0] ?? false,
          likeCount: likeCounts[0] ?? 0,
          commentCount: commentCounts[0] ?? 0,
        },
      }));
    } catch (error) {
      console.error("Failed to toggle paper like", error);
      setStatus({
        type: "error",
        message: "Could not update like status. Please try again.",
      });
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6">Search Papers</h1>
      <p className="text-stone-500 mt-2">
        Browse papers and filter them by year, institution, type, and topic.
      </p>

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
                <button
                  onClick={clearSearch}
                  className="hover:text-stone-900 transition-colors opacity-50 mr-2"
                  type="button"
                >
                  <X size={24} strokeWidth={1.5} />
                </button>
              )}
              <button
                onClick={onSearch}
                className="hover:text-stone-900 transition-colors"
                disabled={loading}
                type="button"
              >
                <Search size={24} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-2 relative z-10">
          <button
            onClick={toggleAdvanced}
            className="flex flex-col items-center group focus:outline-none"
            aria-expanded={isAdvancedOpen}
            type="button"
          >
            <div
              className={`p-2 rounded-full duration-500 ${
                isAdvancedOpen ? "bg-stone-200" : "hover:bg-stone-200/50"
              }`}
            >
              <Minus
                size={20}
                className={`text-stone-600 transition-all ${
                  isAdvancedOpen ? "rotate-180" : ""
                }`}
                strokeWidth={1.5}
              />
              <Minus
                size={20}
                className={`text-stone-600 transition-all -mt-[100%] ${
                  isAdvancedOpen ? "rotate-180" : "rotate-90"
                }`}
                strokeWidth={1.5}
              />
            </div>
          </button>
        </div>
      </div>

      <div
        className={`relative z-30 mx-auto w-full max-w-5xl transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isAdvancedOpen ? "max-h-[1100px] opacity-100 mt-6" : "max-h-0 opacity-0 mt-0"
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-6 px-2">
          <div className="flex flex-col gap-2 relative">
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-stone-500">
              <BookOpen size={14} /> Topic
            </label>

            <div className="relative">
              <input
                type="text"
                placeholder={topicLookupSubtopicId ? "Topic in selected subtopic" : "Topic"}
                value={selectedTopic?.label || topicQuery}
                onChange={(e) => {
                  setSelectedTopic(null);
                  setTopicQuery(e.target.value);
                  setShowTopicSuggestions(true);
                }}
                onFocus={() => setShowTopicSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowTopicSuggestions(false), 150);
                }}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                className="w-full bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors"
              />

              {showTopicSuggestions && !selectedTopic && (
                <ul className="absolute left-0 top-full w-full z-[60] bg-stone-50 border border-stone-200 mt-1 max-h-48 overflow-y-auto shadow-lg shadow-stone-200/50 rounded-sm custom-scrollbar">
                  {topicLoading ? (
                    <li className="px-3 py-2 text-stone-400 italic text-sm">
                      Searching...
                    </li>
                  ) : topicOptions.length > 0 ? (
                    topicOptions.map((item) => (
                      <li
                        key={item.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedTopic(item);
                          setTopicQuery(item.label);
                          setTopicOptions([]);
                          setShowTopicSuggestions(false);
                        }}
                        className="px-3 py-2 hover:bg-stone-200 cursor-pointer text-stone-700 text-lg transition-colors border-b border-stone-100 last:border-0"
                      >
                        {item.label}
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2 text-stone-400 italic text-sm">
                      No matches found
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 relative">
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-stone-500">
              <Tags size={14} /> Subtopics
            </label>

            {!!selectedSubtopics.length && (
              <div className="flex flex-wrap gap-2">
                {selectedSubtopics.map((item) => (
                  <div
                    key={item.id}
                    className="tag-ghost !border-1 !border-[var(--yellow)] flex items-center gap-2"
                  >
                    <span>{item.label}</span>
                    <button
                      type="button"
                      onClick={() => removeSubtopic(item.id)}
                      className="text-stone-500 hover:text-stone-900"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative">
              <input
                type="text"
                placeholder={
                  selectedTopic
                    ? "Add subtopics from selected topic"
                    : "Add subtopics"
                }
                value={subtopicQuery}
                onChange={(e) => {
                  setSubtopicQuery(e.target.value);
                  setShowSubtopicSuggestions(true);
                }}
                onFocus={() => setShowSubtopicSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowSubtopicSuggestions(false), 150);
                }}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                className="w-full bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors"
              />

              {showSubtopicSuggestions && (
                <ul className="absolute left-0 top-full w-full z-[60] bg-stone-50 border border-stone-200 mt-1 max-h-48 overflow-y-auto shadow-lg shadow-stone-200/50 rounded-sm custom-scrollbar">
                  {subtopicLoading ? (
                    <li className="px-3 py-2 text-stone-400 italic text-sm">
                      Searching...
                    </li>
                  ) : subtopicOptions.length > 0 ? (
                    subtopicOptions.map((item) => (
                      <li
                        key={item.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          toggleSubtopic(item);
                          setSubtopicQuery("");
                          setShowSubtopicSuggestions(false);
                        }}
                        className={`px-3 py-2 cursor-pointer text-stone-700 text-lg transition-colors border-b border-stone-100 last:border-0 ${
                          isSubtopicSelected(item.id)
                            ? "bg-stone-200"
                            : "hover:bg-stone-200"
                        }`}
                      >
                        {item.label}
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2 text-stone-400 italic text-sm">
                      {selectedTopic
                        ? "No subtopics available for the selected topic"
                        : "No matches found"}
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 justify-end">
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-stone-500">
              <Network size={14} /> Topic expansion
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input
                type="checkbox"
                checked={includeSiblingTopics}
                onChange={(e) => setIncludeSiblingTopics(e.target.checked)}
                disabled={!selectedTopic}
              />
              Include related topics
            </label>
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
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                className="w-full bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors placeholder-stone-300"
              />

              {showInstituteSuggestions && !selectedInstitution && (
                <ul className="absolute left-0 top-full w-full z-[60] bg-stone-50 border border-stone-200 mt-1 max-h-48 overflow-y-auto shadow-lg shadow-stone-200/50 rounded-sm custom-scrollbar">
                  {institutionLoading ? (
                    <li className="px-3 py-2 text-stone-400 italic text-sm">
                      Searching...
                    </li>
                  ) : institutions.length > 0 ? (
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

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-stone-500">
              <CalendarIcon size={14} /> Since year
            </label>
            <input
              type="number"
              placeholder="YYYY"
              value={sinceYear}
              onChange={(e) => setSinceYear(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              className="bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-stone-500">
              <BookOpen size={14} /> Work type
            </label>
            <select
              value={selectedWorkType}
              onChange={(e) => setSelectedWorkType(e.target.value)}
              className="bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors"
            >
              <option value="">
                {workTypesLoading ? "Loading..." : "Any type"}
              </option>
              {workTypes.map((wt) => (
                <option key={wt.id} value={wt.id}>
                  {wt.label}
                </option>
              ))}
            </select>
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
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      <div className="space-y-4 mt-10 divide-y divide-gray-200">
        {papers.map((p) => {
          const id = getPaperId(p);
          const meta = metaById[id] || {};
          const metaLoading = !metaById[id] && metadataLoading;

          return (
            <ListEntry
              key={id}
              paper={p}
              liked={meta.liked}
              likeCount={meta.likeCount}
              commentCount={meta.commentCount}
              metaLoading={metaLoading}
              onTogglePaperLike={onTogglePaperLike}
            />
          );
        })}
      </div>

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
        <div
          className={`mt-4 text-center ${
            status.type === "error"
              ? "text-red-500"
              : status.type === "info"
              ? "text-stone-500"
              : "text-green-600"
          }`}
        >
          {status.message}
        </div>
      )}

      <div style={{ height: "100px" }}></div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          borderTop: "1px solid #e5e5e5",
          backdropFilter: "blur(5px)",
          padding: "1.5rem 0",
          display: "flex",
          justifyContent: "center",
          zIndex: 100,
          boxShadow: "0 -4px 20px rgba(0,0,0,0.03)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <button
            className="btn-primary"
            onClick={() => navigate("/papers/recommended")}
            type="button"
          >
            Recommended Papers
          </button>
        </div>
      </div>
    </div>
  );
}
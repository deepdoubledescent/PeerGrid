import { useEffect, useMemo, useState } from "react";
import { Search, X, Minus, Landmark, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import {
  getPeople,
  toggleLikePerson,
  getLocations,
  getInstitutes,
} from "./Controller";

const PersonCard = ({ person, onToggleLike }) => {
  const personId = person.user_sub || person.id || person.sub;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4 min-w-0">
          {person.avatar ? (
            <img
              src={person.avatar}
              alt={person.name || "User avatar"}
              className="w-14 h-14 rounded-full object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-stone-200 flex items-center justify-center text-stone-600 font-semibold">
              {(person.name || "?").charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0">
            <Link
              to={`/profile/${personId}`}
              className="text-lg font-medium hover:underline"
            >
              {person.name || "Unnamed user"}
            </Link>

            {person.positionTitle && (
              <div className="text-sm opacity-70 mt-1">
                {person.positionField
                  ? `${person.positionTitle} in ${person.positionField}`
                  : person.positionTitle}
              </div>
            )}

            {person.bio && (
              <p className="text-sm mt-2 text-stone-700 line-clamp-3">
                {person.bio}
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-sm opacity-70 mt-3">
              {person.institute && (
                <div className="flex items-center gap-1">
                  <Landmark size={14} />
                  <span>{person.institute}</span>
                </div>
              )}

              {person.location && (
                <div className="flex items-center gap-1">
                  <MapPin size={14} />
                  <span>{person.location}</span>
                </div>
              )}
            </div>

            {!!person.interests?.length && (
              <div className="flex flex-wrap gap-2 mt-3">
                {person.interests.slice(0, 6).map((interest) => (
                  <span
                    key={interest}
                    className="px-2 py-1 text-xs rounded-full bg-stone-100 text-stone-700"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            )}

            {!!person.skills?.length && (
              <div className="flex flex-wrap gap-2 mt-2">
                {person.skills.slice(0, 6).map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-1 text-xs rounded-full bg-stone-200 text-stone-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className={`btn-outline shrink-0 ${person.hasLiked ? "text-red-600" : ""}`}
          onClick={() => onToggleLike(personId)}
        >
          {person.hasLiked ? "♥" : "♡"} {person.likeCount ?? 0}
        </button>
      </div>
    </div>
  );
};

export default function AllPeoplePage({ user }) {
  const authUserId = user?.sub || user?.id || null;

  const [query, setQuery] = useState("");
  const [institution, setInstitution] = useState("");
  const [location, setLocation] = useState("");

  const [people, setPeople] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [page, setPage] = useState(1);
  const resultsPerPage = 20;

  const [loading, setLoading] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showInstituteSuggestions, setShowInstituteSuggestions] = useState(false);
  const [instituteSuggestions, setInstituteSuggestions] = useState([]);

  const totalPages = useMemo(
    () => Math.ceil(totalResults / resultsPerPage),
    [totalResults]
  );

  const toggleAdvanced = () => setIsAdvancedOpen((prev) => !prev);

  const fetchPeople = async ({ targetPage = 1 } = {}) => {
    if (!authUserId) {
      setPeople([]);
      setTotalResults(0);
      setPage(1);
      return;
    }

    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const filters = {
        q: query,
        institution,
        location,
        page: targetPage,
        results_per_page: resultsPerPage,
      };

      const result = await getPeople(filters);

      setPeople(result?.people ?? []);
      setTotalResults(result?.total_results ?? 0);
      setPage(result?.page ?? targetPage);
    } catch (err) {
      console.error("getPeople failed:", err);
      setStatus({
        type: "error",
        message: "Failed to fetch people. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const onSearch = () => {
    if (loading || !authUserId) return;
    fetchPeople({ targetPage: 1 });
  };

  const clearQueryOnly = () => {
    setQuery("");
  };

  const resetFilters = () => {
    setQuery("");
    setInstitution("");
    setLocation("");
    setPeople([]);
    setTotalResults(0);
    setPage(1);
    setStatus({ type: "", message: "" });
    setShowInstituteSuggestions(false);
    setInstituteSuggestions([]);
  };

  const onToggleLike = async (likedUserSub) => {
    if (!authUserId) {
      setStatus({ type: "error", message: "Please log in to like people." });
      return;
    }

    try {
      await toggleLikePerson(likedUserSub);

      setPeople((prev) =>
        prev.map((person) => {
          const id = person.user_sub || person.id || person.sub;
          if (id !== likedUserSub) return person;

          const alreadyLiked = !!person.hasLiked;
          const currentLikes = person.likeCount ?? 0;

          return {
            ...person,
            hasLiked: !alreadyLiked,
            likeCount: alreadyLiked
              ? Math.max(0, currentLikes - 1)
              : currentLikes + 1,
          };
        })
      );
    } catch (err) {
      console.error("toggleLikePerson failed:", err);
      setStatus({
        type: "error",
        message: "Could not update like status.",
      });
    }
  };

  const handleLocationSelect = (value) => {
    setLocation(value);
    setShowLocationSuggestions(false);
  };

  const handleInstituteSelect = (value) => {
    setInstitution(value);
    setShowInstituteSuggestions(false);
  };

  useEffect(() => {
    if (!authUserId) return;
    fetchPeople({ targetPage: 1 });
  }, [authUserId]);

  useEffect(() => {
    let cancelled = false;

    const loadLocations = async () => {
      const value = String(location || "").trim();

      if (!showLocationSuggestions || !authUserId) return;

      try {
        const rows = await getLocations(value);
        if (!cancelled) {
          setLocationSuggestions(rows || []);
        }
      } catch (error) {
        console.error("Failed to fetch location suggestions", error);
        if (!cancelled) {
          setLocationSuggestions([]);
        }
      }
    };

    loadLocations();

    return () => {
      cancelled = true;
    };
  }, [location, showLocationSuggestions, authUserId]);

  useEffect(() => {
    let cancelled = false;

    const loadInstitutes = async () => {
      const value = String(institution || "").trim();

      if (!showInstituteSuggestions || !authUserId) return;

      try {
        const rows = await getInstitutes(value);
        if (!cancelled) {
          setInstituteSuggestions(rows || []);
        }
      } catch (error) {
        console.error("Failed to fetch institute suggestions", error);
        if (!cancelled) {
          setInstituteSuggestions([]);
        }
      }
    };

    loadInstitutes();

    return () => {
      cancelled = true;
    };
  }, [institution, showInstituteSuggestions, authUserId]);

  if (!authUserId) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-semibold mb-6">All People</h1>
        <p className="text-stone-500">Please log in to browse people.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6">All People</h1>

      <div className="search-bar flex flex-row">
        <div className="group w-full flex items-center border-b-1 border-black transition-all duration-300 focus-within:border-stone-600">
          <div className="w-full flex relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder="Search people"
              className="h-fit w-full bg-transparent py-2 pr-12 focus:outline-none placeholder-stone-400/50 text-stone-900 font-normal"
            />
            <div className="absolute right-0 py-2 text-stone-400">
              {query && (
                <button
                  onClick={clearQueryOnly}
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

        <div className="flex justify-center mt-2 z-20 relative">
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
        className={`mx-auto w-full max-w-5xl transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isAdvancedOpen ? "max-h-[800px] opacity-100 mt-6 overflow-visible" : "max-h-0 opacity-0 mt-0 overflow-hidden"
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 px-2">
          <div className="flex flex-col gap-2 relative">
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-stone-500">
              <Landmark size={14} /> Institution
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Institution"
                value={institution}
                onChange={(e) => {
                  setInstitution(e.target.value);
                  setShowInstituteSuggestions(true);
                }}
                onFocus={() => setShowInstituteSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowInstituteSuggestions(false), 150);
                }}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                className="w-full bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors"
              />

              {showInstituteSuggestions && (
                <ul className="absolute w-full z-30 bg-stone-50 border border-stone-200 mt-1 max-h-48 overflow-y-auto shadow-lg shadow-stone-200/50 rounded-sm custom-scrollbar">
                  {instituteSuggestions.length > 0 ? (
                    instituteSuggestions.map((item) => (
                      <li
                        key={item.id ?? item.label}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleInstituteSelect(item.label)}
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
              <MapPin size={14} /> Location
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="City, Country or Country"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setShowLocationSuggestions(true);
                }}
                onFocus={() => setShowLocationSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowLocationSuggestions(false), 150);
                }}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                className="w-full bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors"
              />

              {showLocationSuggestions && (
                <ul className="absolute w-full z-20 bg-stone-50 border border-stone-200 mt-1 max-h-48 overflow-y-auto shadow-lg shadow-stone-200/50 rounded-sm custom-scrollbar">
                  {locationSuggestions.length > 0 ? (
                    locationSuggestions.map((item) => (
                      <li
                        key={`${item.type}-${item.label}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleLocationSelect(item.label)}
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
        </div>

        <div className="flex flex-wrap gap-3 mt-6 px-2">
          <button
            className="btn-primary"
            onClick={onSearch}
            disabled={loading}
            type="button"
          >
            {loading ? "Searching..." : "Apply filters"}
          </button>

          <button
            className="btn-outline"
            onClick={resetFilters}
            type="button"
          >
            Reset filters
          </button>
        </div>
      </div>

      <div className="space-y-4 mt-10 divide-y divide-gray-200">
        {people.map((person) => {
          const id = person.user_sub || person.id || person.sub;
          return (
            <PersonCard
              key={id}
              person={person}
              onToggleLike={onToggleLike}
            />
          );
        })}
      </div>

      {!loading && people.length === 0 && (
        <div className="text-center text-stone-500 mt-10">
          No people found.
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex gap-7 justify-center mt-8 text-gray-500 text-s">
          <button
            disabled={page <= 1}
            onClick={() => fetchPeople({ targetPage: page - 1 })}
            className="cursor-pointer disabled:text-gray-300 disabled:cursor-default"
            type="button"
          >
            <u>Previous</u>
          </button>

          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              disabled={page === i + 1}
              onClick={() => fetchPeople({ targetPage: i + 1 })}
              className={`cursor-pointer disabled:cursor-default ${
                page === i + 1 ? "font-bold text-gray-700" : "font-normal"
              }`}
              type="button"
            >
              {i + 1}
            </button>
          ))}

          <button
            disabled={page >= totalPages}
            onClick={() => fetchPeople({ targetPage: page + 1 })}
            className="cursor-pointer disabled:text-gray-300 disabled:cursor-default"
            type="button"
          >
            <u>Next</u>
          </button>
        </div>
      )}

      {status.message && (
        <div
          className={`mt-4 text-center ${
            status.type === "error" ? "text-red-500" : "text-green-600"
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Landmark,
  MapPin,
  Search,
  X,
  Minus,
} from "lucide-react";
import { getConnections, toggleLikePerson, getLocations, getInstitutes } from "./Controller";

const PersonCard = ({ person, onToggleLike }) => {
  const navigate = useNavigate();
  const personId = person.user_sub || person.id || person.sub;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-4">
        <div
          className="flex gap-4 min-w-0 flex-1 cursor-pointer hover:bg-stone-50 rounded-lg p-2 -m-2 transition"
          onClick={() => navigate(`/profile/${personId}`)}
        >
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
            <div className="text-lg font-medium hover:underline">
              {person.name || "Unnamed user"}
            </div>

            {person.bio && (
              <p className="text-sm mt-2 text-stone-700 line-clamp-3">
                {person.bio}
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-sm opacity-70 mt-3">
              {(person.institution || person.institute) && (
                <div className="flex items-center gap-1">
                  <Landmark size={14} />
                  <span>{person.institution || person.institute}</span>
                </div>
              )}

              {(person.city || person.country || person.location) && (
                <div className="flex items-center gap-1">
                  <MapPin size={14} />
                  <span>
                    {person.location ||
                      (person.city && person.country
                        ? `${person.city}, ${person.country}`
                        : person.city || person.country)}
                  </span>
                </div>
              )}
            </div>

            {!!(person.researchInterests || person.interests)?.length && (
              <div className="flex flex-wrap gap-2 mt-3">
                {(person.researchInterests || person.interests)
                  .slice(0, 6)
                  .map((interest) => (
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
          className="btn-outline shrink-0 text-red-600"
          onClick={() => onToggleLike(personId)}
        >
          ♥ Connected
        </button>
      </div>
    </div>
  );
};

export default function ConnectionsPage({ user }) {
  const authUserId = user?.sub || user?.id || null;

  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const [query, setQuery] = useState("");
  const [institution, setInstitution] = useState("");
  const [location, setLocation] = useState("");
  const [skill, setSkill] = useState("");
  const [researchInterest, setResearchInterest] = useState("");

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showInstituteSuggestions, setShowInstituteSuggestions] = useState(false);
  const [instituteSuggestions, setInstituteSuggestions] = useState([]);

  const fetchConnections = async () => {
    if (!authUserId) {
      setPeople([]);
      return;
    }

    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const result = await getConnections();
      setPeople(result || []);
    } catch (err) {
      console.error(err);
      setStatus({
        type: "error",
        message: "Failed to load connections.",
      });
    } finally {
      setLoading(false);
    }
  };

  const onToggleLike = async (likedUserSub) => {
    if (!authUserId) {
      setStatus({
        type: "error",
        message: "Please log in to manage connections.",
      });
      return;
    }

    try {
      await toggleLikePerson(likedUserSub);

      setPeople((prev) =>
        prev.filter((person) => {
          const id = person.user_sub || person.id || person.sub;
          return id !== likedUserSub;
        })
      );
    } catch (err) {
      console.error(err);
      setStatus({
        type: "error",
        message: "Could not update connection.",
      });
    }
  };

  useEffect(() => {
    if (!authUserId) return;
    fetchConnections();
  }, [authUserId]);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (!showLocationSuggestions || !authUserId) return;

      try {
        const rows = await getLocations(location);
        if (!cancelled) {
          setLocationSuggestions(rows || []);
        }
      } catch (error) {
        console.error("Failed to fetch location suggestions", error);
        if (!cancelled) {
          setLocationSuggestions([]);
        }
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [location, showLocationSuggestions, authUserId]);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (!showInstituteSuggestions || !authUserId) return;

      try {
        const rows = await getInstitutes(institution);
        if (!cancelled) {
          setInstituteSuggestions(rows || []);
        }
      } catch (error) {
        console.error("Failed to fetch institute suggestions", error);
        if (!cancelled) {
          setInstituteSuggestions([]);
        }
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [institution, showInstituteSuggestions, authUserId]);

  const filteredPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    const institutionQ = institution.trim().toLowerCase();
    const locationQ = location.trim().toLowerCase();
    const skillQ = skill.trim().toLowerCase();
    const researchQ = researchInterest.trim().toLowerCase();

    return people.filter((person) => {
      const personInstitution = String(
        person.institution || person.institute || ""
      ).toLowerCase();

      const personLocation = String(
        person.location ||
          (person.city && person.country
            ? `${person.city}, ${person.country}`
            : person.city || person.country || "")
      ).toLowerCase();

      const personSkills = (person.skills || []).map((s) =>
        String(s).toLowerCase()
      );
      const personResearch = (person.researchInterests || person.interests || []).map((r) =>
        String(r).toLowerCase()
      );

      const searchable = [
        person.name,
        person.bio,
        person.institution,
        person.institute,
        person.country,
        person.city,
        person.location,
        ...(person.skills || []),
        ...(person.researchInterests || person.interests || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (q && !searchable.includes(q)) return false;
      if (institutionQ && !personInstitution.includes(institutionQ)) return false;
      if (locationQ && !personLocation.includes(locationQ)) return false;
      if (skillQ && !personSkills.some((s) => s.includes(skillQ))) return false;
      if (researchQ && !personResearch.some((r) => r.includes(researchQ))) return false;

      return true;
    });
  }, [people, query, institution, location, skill, researchInterest]);

  const resetFilters = () => {
    setQuery("");
    setInstitution("");
    setLocation("");
    setSkill("");
    setResearchInterest("");
    setShowLocationSuggestions(false);
    setLocationSuggestions([]);
    setShowInstituteSuggestions(false);
    setInstituteSuggestions([]);
  };

  const clearQueryOnly = () => setQuery("");

  const toggleAdvanced = () => setIsAdvancedOpen((prev) => !prev);

  const handleLocationSelect = (selectedLocation) => {
    setLocation(selectedLocation);
    setShowLocationSuggestions(false);
  };

  const handleInstituteSelect = (selectedInstitute) => {
    setInstitution(selectedInstitute);
    setShowInstituteSuggestions(false);
  };

  if (!authUserId) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-semibold mb-2">Connections</h1>
        <p className="text-sm opacity-70 mb-8">
          People who liked you and you liked back.
        </p>
        <div className="text-center text-stone-500 mt-10">
          Please log in to view connections.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-semibold mb-2">Connections</h1>
      <p className="text-sm opacity-70 mb-8">
        People who liked you and you liked back.
      </p>

      <div className={`search-field flex-col ${!isAdvancedOpen && "overflow-hidden"}`}>
        <div className="search-bar flex flex-row">
          <div className="group w-full flex items-center border-b-1 border-black transition-all duration-300 focus-within:border-stone-600">
            <div className="w-full flex relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search connections"
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
                  className="hover:text-stone-900 transition-colors"
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
          className={`transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isAdvancedOpen ? "opacity-100 mt-8" : "max-h-0 opacity-0 mt-0"
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
                  className="w-full bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors"
                />

                {showInstituteSuggestions && (
                  <ul className="absolute w-full z-20 bg-stone-50 border border-stone-200 mt-1 max-h-48 overflow-y-auto shadow-lg shadow-stone-200/50 rounded-sm custom-scrollbar">
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

            <div className="flex flex-col gap-2 relative md:col-span-2">
              <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-stone-500">
                <MapPin size={14} /> Location
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    setShowLocationSuggestions(true);
                  }}
                  onFocus={() => setShowLocationSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => setShowLocationSuggestions(false), 150);
                  }}
                  className="w-full bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors placeholder-stone-300"
                  placeholder="City, Country or Country"
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

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-stone-500">
                Skill
              </label>
              <input
                type="text"
                placeholder="Skill"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                className="bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-stone-500">
                Research interest
              </label>
              <input
                type="text"
                placeholder="Research interest"
                value={researchInterest}
                onChange={(e) => setResearchInterest(e.target.value)}
                className="bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end pb-4 border-b border-stone-200 mt-6 gap-3">
            <button
              className="text-xs font-sans uppercase tracking-[0.15em] hover:text-stone-600 transition-colors text-stone-400"
              onClick={resetFilters}
              type="button"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-stone-500 mt-10">Loading...</div>
      ) : filteredPeople.length === 0 ? (
        <div className="text-center text-stone-500 mt-10">
          {people.length === 0 ? "No connections yet." : "No people found."}
        </div>
      ) : (
        <div className="space-y-4 divide-y divide-gray-200 mt-10">
          {filteredPeople.map((person) => {
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
      )}

      {status.message && (
        <div className="mt-4 text-center text-red-500">{status.message}</div>
      )}
    </div>
  );
}
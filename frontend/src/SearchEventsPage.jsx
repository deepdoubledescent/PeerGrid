import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  X,
  ChevronDown,
  Minus,
  Calendar,
  MapPin,
  User,
  Tag,
  Globe,
  Eye,
  Users
} from "lucide-react";
import { getEventTopics, getLocations, searchEvents } from "./Controller";
import "./App.css";

const TagSelectModal = ({
  tagState,
  tagList,
  onTagToggle,
  setModalState,
  color = "var(--border)",
  title = "Select Topics"
}) => {
  const [filterText, setFilterText] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-stone-900/10 backdrop-blur-sm"
        onClick={() => setModalState(false)}
      />

      <div className="relative bg-stone-50 w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between p-6 pb-2 border-b border-stone-100">
          <h3 className="font-sans uppercase tracking-widest text-xs font-bold text-stone-500">
            {title}
          </h3>
          <button
            onClick={() => setModalState(false)}
            className="text-stone-400 hover:text-stone-900 transition-colors"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <div className="w-full flex relative">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter"
            className="h-fit w-full border-b-1 border-black bg-transparent mb-5 py-1 mx-12 focus:outline-none placeholder-stone-400/50 text-stone-900 font-normal"
          />

          <div className="absolute right-12 py-1 text-stone-400">
            {filterText ? (
              <button
                onClick={() => setFilterText("")}
                className="hover:text-stone-900 transition-colors opacity-50"
              >
                <X size={24} strokeWidth={1.5} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap overflow-y-auto px-6 gap-y-2 custom-scrollbar">
          {tagList
            .filter((k) =>
              k.toLowerCase().trim().includes(filterText.toLowerCase().trim())
            )
            .map((k) => {
              const isSelected = tagState.has(k);

              return (
                <button
                  key={k}
                  className={`tag-ghost pointer-events-auto cursor-pointer ${
                    isSelected
                      ? "!border-1 !border-[" + color + "] hover:!tag-ghost"
                      : "hover:border-1 hover:border-[" + color + "]"
                  }`}
                  onClick={() => onTagToggle(k)}
                >
                  {k}
                </button>
              );
            })}
        </div>

        <div className="p-6 border-t border-stone-100 bg-stone-50 flex justify-end">
          <button
            onClick={() => setModalState(false)}
            className="px-6 py-2 bg-stone-900 text-stone-50 font-sans text-xs uppercase tracking-widest hover:bg-stone-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

const EventListEntry = ({ event, isOpen, onToggle, isTopicSelected, onTopicToggle }) => {
  const eventDate = event?.event_date ? new Date(event.event_date) : null;
  const isCompleted = eventDate ? eventDate < new Date() : false;

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div className="py-4">
      <div
        className="project-header flex items-center justify-between min-w-full py-4 -my-4 cursor-pointer relative z-10 gap-4"
        onClick={onToggle}
        aria-expanded={isOpen}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center min-w-0 flex-1">
          <Link to={`/events/${event.id}`} className="min-w-0">
            <h1 className="project-title text-xl text-left hover:!text-[#6E7A8D]">
              {event.title}
            </h1>
          </Link>

          <div className="project-tags-small pl-2 z-11 pointer-events-none">
            {(event.topics || []).map((topic) => (
              <button
                key={topic}
                className={`tag-ghost pointer-events-auto cursor-pointer ${
                  isTopicSelected(topic)
                    ? "!border-1 !border-[var(--yellow)]"
                    : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTopicToggle(topic);
                }}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        <div className="shrink-0">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
              isCompleted
                ? "bg-green-100 text-green-700 border border-green-200"
                : "bg-blue-100 text-blue-700 border border-blue-200"
            }`}
          >
            {isCompleted ? "Completed" : "Upcoming"}
          </span>
        </div>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.87,0,0.13,1)] ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="z-9 overflow-hidden pt-3 text-left mx-7">
          <div className="flex w-full gap-4 flex-wrap">
            <div className="font-[500] text-[var(--text-secondary)]">
              <div className="icon-small"><User size={14} /></div>
              <Link to={`/profile/${event.author}`} className="cursor-pointer">
                {event.author_display_name}
              </Link>
            </div>

            <div className="text-zinc-400 cursor-default">
              <div className="icon-small"><Calendar size={14} /></div>
              <span>
                {eventDate ? eventDate.toLocaleString() : "No date"}
              </span>
            </div>

            <div className="text-zinc-400 cursor-default">
              <div className="icon-small"><MapPin size={14} /></div>
              <span>{event.is_online ? "Online" : (event.location || "No location")}</span>
            </div>

            {(event.allow_application_count_visible || event.is_creator) && (
              <div className="text-zinc-400 cursor-default">
                <div className="icon-small"><Users size={14} /></div>
                <span>{event.registration_count || 0} registrations</span>
              </div>
            )}
          </div>

          {!event.is_online && event.place ? (
            <div className="mt-2 text-sm text-zinc-400">
              {event.place}
            </div>
          ) : null}

          <p className="project-short-description">
            {event.details}
          </p>

          <div className="mt-4">
            <Link to={`/events/${event.id}`} className="underline text-stone-500 hover:text-stone-700">
              Open event
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function SearchEventsPage({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [events, setEvents] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState(new Set());
  const [isTopicsModalOpen, setIsTopicsModalOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("upcoming");
  const [eventFormat, setEventFormat] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("date_asc");

  const [openIds, setOpenIds] = useState([]);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);

  const updateParams = (updates) => {
    const newParams = new URLSearchParams(searchParams);

    updates.forEach(([key, value]) => {
      if (key === "topic") {
        newParams.delete(key);
        value.forEach((v) => newParams.append(key, v));
      } else {
        if (value) newParams.set(key, value);
        else newParams.delete(key);
      }
    });

    setSearchParams(newParams);
  };

  const filter = {
    sortBy: searchParams.get("sortBy") || "date_asc",
    page: parseInt(searchParams.get("page") || "1", 10),
    query: searchParams.get("query") || "",
    location: searchParams.get("location") || "",
    start_date: searchParams.get("start_date") || "",
    end_date: searchParams.get("end_date") || "",
    status: searchParams.get("status") || "upcoming",
    event_format: searchParams.get("event_format") || "all",
    is_online:
      searchParams.get("event_format") === "online"
        ? true
        : searchParams.get("event_format") === "in_person"
          ? false
          : undefined,
    topics: searchParams.getAll("topic") || [],
    results_per_page: parseInt(searchParams.get("results_per_page") || "10", 10)
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        console.log("searching with filter:", filter);
        const result = await searchEvents({ filter });
        setEvents(result?.events || []);
        setTotalResults(result?.total_results || 0);
      } catch (err) {
        console.error("Failed to search events", err);
        setEvents([]);
        setTotalResults(0);
      } finally {
        setIsLoading(false);
      }
    };

    load();

    setQuery(filter.query);
    setLocation(filter.location);
    setStatus(filter.status);
    setEventFormat(filter.event_format);
    setStartDate(filter.start_date);
    setEndDate(filter.end_date);
    setSortBy(filter.sortBy);
    setSelectedTopics(new Set(filter.topics));
  }, [searchParams, user]);

  useEffect(() => {
    const loadTopics = async () => {
      try {
        const rows = await getEventTopics();
        setTopics((rows || []).map((t) => t.topic_name));
      } catch (err) {
        console.error("Failed to fetch topics", err);
        setTopics([]);
      }
    };

    loadTopics();
  }, []);

  useEffect(() => {
    if (isTopicsModalOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isTopicsModalOpen]);



  useEffect(() => {
    if (eventFormat === "online") {
      setLocation("");
      setShowLocationSuggestions(false);
      setLocationSuggestions([]);
    }
  }, [eventFormat]);

  useEffect(() => {
    let cancelled = false;

    const loadLocations = async () => {
      if (!showLocationSuggestions) return;

      try {
        const rows = await getLocations(location);
        if (!cancelled) {
          setLocationSuggestions(rows || []);
        }
      } catch (err) {
        console.error("Failed to fetch location suggestions", err);
        if (!cancelled) {
          setLocationSuggestions([]);
        }
      }
    };

    const timeoutId = window.setTimeout(loadLocations, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [location, showLocationSuggestions]);

  const totalPages = Math.ceil(totalResults / filter.results_per_page);
  const page = filter.page;

  const toggleItem = (id) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleTopic = (topic) => {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };


  const handleLocationSelect = (value) => {
    setLocation(value);
    setShowLocationSuggestions(false);
  };

  const clearSearch = () => setQuery("");

  const resetFilters = () => {
    setQuery("");
    setLocation("");
    setStatus("upcoming");
    setEventFormat("all");
    setStartDate("");
    setEndDate("");
    setSelectedTopics(new Set());
    setShowLocationSuggestions(false);
    setLocationSuggestions([]);

    updateParams(
      Object.entries({
        page: 1,
        query: "",
        location: "",
        status: "upcoming",
        event_format: "all",
        start_date: "",
        end_date: "",
        sortBy: "date_asc",
        topic: []
      })
    );
  };

  const handleSearch = () => {
    updateParams(
      Object.entries({
        page: 1,
        query,
        location,
        status,
        event_format: eventFormat,
        start_date: startDate,
        end_date: endDate,
        sortBy,
        topic: Array.from(selectedTopics)
      })
    );
  };

  const handleKeyDownInSearchBar = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div>
      <div className="project-container">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-stone-900">Search Events</h1>
          <p className="text-stone-500 mt-2">
            Browse upcoming and completed events.
          </p>
        </div>

        <div className={`search-field flex-col ${!isAdvancedOpen && "overflow-hidden"}`}>
          <div className="search-bar flex flex-row">
            <div className="group w-full flex items-center border-b-1 border-black transition-all duration-300 focus-within:border-stone-600">
              <div className="w-full flex relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDownInSearchBar}
                  placeholder="Search events"
                  className="h-fit w-full bg-transparent py-2 pr-12 focus:outline-none placeholder-stone-400/50 text-stone-900 font-normal"
                />

                <div className="absolute right-0 py-2 text-stone-400">
                  {query ? (
                    <button onClick={clearSearch} className="hover:text-stone-900 transition-colors opacity-50">
                      <X size={24} strokeWidth={1.5} />
                    </button>
                  ) : null}
                  <button onClick={handleSearch} className="hover:text-stone-900 transition-colors">
                    <Search size={24} strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <div className="h-8 w-px bg-stone-300 mx-6 hidden sm:block" />

                <div className="flex flex-shrink-0 items-center gap-3 pr-2 relative">
                  <span className="whitespace-pre text-[10px] font-sans uppercase text-stone-400 hidden sm:block">
                    Sort By
                  </span>
                  <div className="relative">
                    <ChevronDown size={12} className="absolute left-0 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="appearance-none bg-transparent font-sans text-xs uppercase font-bold text-stone-700 cursor-pointer focus:outline-none pl-4 py-2 text-right hover:text-stone-900 transition-colors"
                    >
                      <option value="date_asc">Soonest</option>
                      <option value="date_desc">Latest</option>
                      <option value="title_asc">Title A-Z</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center mt-2 z-20 relative">
              <button
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="flex flex-col items-center group focus:outline-none"
                aria-expanded={isAdvancedOpen}
              >
                <div className={`p-2 rounded-full duration-500 ${isAdvancedOpen ? "bg-stone-200" : "hover:bg-stone-200/50"}`}>
                  <Minus
                    size={20}
                    className={`text-stone-600 transition-all ${isAdvancedOpen ? "rotate-180" : ""}`}
                    strokeWidth={1.5}
                  />
                  <Minus
                    size={20}
                    className={`text-stone-600 transition-all -mt-[100%] ${isAdvancedOpen ? "rotate-180" : "rotate-90"}`}
                    strokeWidth={1.5}
                  />
                </div>
              </button>
            </div>
          </div>

          <div className={`transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isAdvancedOpen ? "opacity-100 mt-8" : "max-h-0 opacity-0 mt-0"
          }`}>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-6">
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-500">Location</label>
                <div className="relative mt-2 flex items-center gap-2 border border-stone-200 px-3 py-2 bg-white">
                  <MapPin size={16} className="text-stone-400" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      setShowLocationSuggestions(true);
                    }}
                    onFocus={() => setShowLocationSuggestions(true)}
                    onBlur={() => {
                      window.setTimeout(() => setShowLocationSuggestions(false), 150);
                    }}
                    placeholder={eventFormat === "online" ? "Not used for online-only search" : "City, Country or Country"}
                    className="w-full bg-transparent outline-none text-sm text-stone-700"
                    disabled={eventFormat === "online"}
                  />

                  {showLocationSuggestions && eventFormat !== "online" && (
                    <ul className="absolute left-0 top-full w-full z-20 bg-white border border-stone-200 mt-1 max-h-48 overflow-y-auto shadow-lg rounded-sm">
                      {locationSuggestions.length > 0 ? (
                        locationSuggestions.map((item) => (
                          <li
                            key={`${item.type}-${item.label}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleLocationSelect(item.label)}
                            className="px-3 py-2 hover:bg-stone-100 cursor-pointer text-stone-700 text-sm border-b border-stone-100 last:border-0"
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

              <div>
                <label className="text-xs uppercase tracking-widest text-stone-500">Format</label>
                <div className="mt-2 flex items-center gap-2 border border-stone-200 px-3 py-2 bg-white">
                  <Globe size={16} className="text-stone-400" />
                  <select
                    value={eventFormat}
                    onChange={(e) => setEventFormat(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm text-stone-700"
                  >
                    <option value="all">All</option>
                    <option value="online">Online only</option>
                    <option value="in_person">In-person only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-stone-500">Topics</label>
                <div className="mt-2 flex items-center gap-2 border border-stone-200 px-3 py-2 bg-white">
                  <Tag size={16} className="text-stone-400" />
                  <button
                    type="button"
                    className="w-full text-left text-sm text-stone-700"
                    onClick={() => setIsTopicsModalOpen(true)}
                  >
                    {selectedTopics.size
                      ? `${selectedTopics.size} selected`
                      : "Select topics"}
                  </button>
                </div>
              </div>


              <div>
                <label className="text-xs uppercase tracking-widest text-stone-500">Start date</label>
                <div className="mt-2 flex items-center gap-2 border border-stone-200 px-3 py-2 bg-white">
                  <Calendar size={16} className="text-stone-400" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm text-stone-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-stone-500">End date</label>
                <div className="mt-2 flex items-center gap-2 border border-stone-200 px-3 py-2 bg-white">
                  <Calendar size={16} className="text-stone-400" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm text-stone-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-stone-500">Status</label>
                <div className="mt-2 flex items-center gap-2 border border-stone-200 px-3 py-2 bg-white">
                  <Eye size={16} className="text-stone-400" />
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm text-stone-700"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="completed">Completed</option>
                    <option value="all">All</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pb-4 border-b border-stone-200 gap-3">
              <button
                className="text-xs font-sans uppercase tracking-[0.15em] hover:text-stone-600 transition-colors text-stone-400"
                onClick={resetFilters}
              >
                Reset Filters
              </button>
              <button className="btn-primary" onClick={handleSearch}>
                Search
              </button>
            </div>
          </div>
        </div>

        {isTopicsModalOpen && (
          <TagSelectModal
            tagState={selectedTopics}
            tagList={topics}
            onTagToggle={toggleTopic}
            setModalState={setIsTopicsModalOpen}
            color="var(--border)"
            title="Select Topics"
          />
        )}

        <div className="project-list divide-y divide-gray-200">
          {isLoading ? (
            <div className="width-full center my-40 text-center text-gray-500">
              Loading events...
            </div>
          ) : events.length ? (
            events.map((event) => (
              <EventListEntry
                key={event.id}
                event={event}
                isOpen={openIds.includes(event.id)}
                onToggle={() => toggleItem(event.id)}
                isTopicSelected={(topic) => selectedTopics.has(topic)}
                onTopicToggle={toggleTopic}
              />
            ))
          ) : (
            <div className="width-full center my-40 text-center text-gray-500">
              No events found.<br />
              {user && (
                <button
                  className="underline cursor-pointer"
                  onClick={() => navigate("/events/new")}
                >
                  Create your own
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-7 justify-center mt-4 text-gray-500 text-s">
        <button
          disabled={page <= 1}
          onClick={() => updateParams([["page", String(page - 1)]])}
          className="cursor-pointer disabled:text-gray-300 disabled:cursor-default"
        >
          <u>Previous</u>
        </button>

        {[...Array(totalPages || 0)].map((_, i) => (
          <button
            key={i}
            disabled={page === i + 1}
            onClick={() => updateParams([["page", String(i + 1)]])}
            className={`cursor-pointer disabled:cursor-default ${
              page === i + 1 ? "font-bold text-gray-700" : "font-normal"
            }`}
          >
            {i + 1}
          </button>
        ))}

        <button
          disabled={page >= totalPages}
          onClick={() => updateParams([["page", String(page + 1)]])}
          className="cursor-pointer disabled:text-gray-300 disabled:cursor-default"
        >
          <u>Next</u>
        </button>
      </div>
      {user && (
        <div className="flex flex-wrap justify-center gap-4 mt-10">
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate("/events/my")}
          >
            My Events
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate("/events/registered")}
          >
            Registered Events
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate("/events/new")}
          >
            + Create New Event
          </button>
        </div>
      )}
    </div>
  );
}
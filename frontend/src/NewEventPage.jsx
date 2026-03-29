import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createEvent, getEventTopics, getLocations } from "./Controller";

const normalizeTopicLabel = (value) =>
  String(value || "").trim().replace(/\s+/g, " ");

export default function NewEventPage({ user }) {
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [location, setLocation] = useState("");
  const [place, setPlace] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [eventDate, setEventDate] = useState("");

  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [topicsInput, setTopicsInput] = useState("");
  const [showTopicSuggestions, setShowTopicSuggestions] = useState(false);
  const topicsInputRef = useRef(null);

  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);

  const filteredTopicSuggestions = useMemo(() => {
    const query = topicsInput.trim().toLowerCase();

    return topics.filter((topic) => {
      const normalizedTopic = normalizeTopicLabel(topic);
      const alreadySelected = selectedTopics.some(
        (selected) => selected.toLowerCase() === normalizedTopic.toLowerCase()
      );

      if (alreadySelected) return false;
      if (!query) return true;
      return normalizedTopic.toLowerCase().includes(query);
    });
  }, [topics, selectedTopics, topicsInput]);

  const [allowApplicationCountVisible, setAllowApplicationCountVisible] = useState(true);
  const [allowApplicantsVisible, setAllowApplicantsVisible] = useState(false);

  useEffect(() => {
    const loadTopics = async () => {
      try {
        const rows = await getEventTopics();
        const normalized = (rows || [])
          .map((t) => normalizeTopicLabel(typeof t === "string" ? t : t?.topic_name))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        setTopics(normalized);
      } catch (err) {
        console.error("Failed to fetch topics", err);
        setTopics([]);
      }
    };

    loadTopics();
  }, []);

  useEffect(() => {
    if (isOnline) {
      setLocation("");
      setPlace("");
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
    }
  }, [isOnline]);

  useEffect(() => {
    const loadLocations = async () => {
      if (isOnline || !showLocationSuggestions) return;

      try {
        const rows = await getLocations(location);
        setLocationSuggestions(rows || []);
      } catch (err) {
        console.error("Failed to fetch locations", err);
        setLocationSuggestions([]);
      }
    };

    const timeoutId = window.setTimeout(loadLocations, 150);
    return () => window.clearTimeout(timeoutId);
  }, [location, isOnline, showLocationSuggestions]);

  const addTopic = (value) => {
    const trimmed = normalizeTopicLabel(value);
    if (!trimmed) return;

    const existingTopic =
      topics.find((topic) => topic.toLowerCase() === trimmed.toLowerCase()) || trimmed;

    setSelectedTopics((prev) => {
      if (prev.some((topic) => topic.toLowerCase() === existingTopic.toLowerCase())) {
        return prev;
      }
      return [...prev, existingTopic];
    });

    if (!topics.some((topic) => topic.toLowerCase() === trimmed.toLowerCase())) {
      setTopics((prev) => [...prev, trimmed].sort((a, b) => a.localeCompare(b)));
    }

    setTopicsInput("");
    setShowTopicSuggestions(false);
  };

  const removeTopic = (topicToRemove) => {
    setSelectedTopics((prev) =>
      prev.filter((topic) => topic.toLowerCase() !== topicToRemove.toLowerCase())
    );
  };


  const handleLocationSelect = (value) => {
    setLocation(value);
    setShowLocationSuggestions(false);
  };

  const validate = () => {
    if (!title.trim()) return "Title is required.";
    if (!details.trim()) return "Details are required.";
    if (!eventDate) return "Event date is required.";
    if (!isOnline && !location.trim()) {
      return "Location is required unless the event is online.";
    }
    return null;
  };

  const handleCreate = async () => {
    const validationError = validate();
    if (validationError) {
      setStatus({ type: "error", message: validationError });
      return;
    }

    setSaving(true);
    setStatus({ type: "", message: "" });

    try {
      const event = {
        title: title.trim(),
        details: details.trim(),
        location: isOnline ? "" : location.trim(),
        place: isOnline ? "" : place.trim(),
        is_online: !!isOnline,
        topics: selectedTopics,
        event_date: eventDate,
        allow_application_count_visible: !!allowApplicationCountVisible,
        allow_applicants_visible: !!allowApplicantsVisible
      };

      const created = await createEvent(event);
      navigate(`/events/${created.id}`);
    } catch (err) {
      console.error(err);
      setStatus({
        type: "error",
        message: err?.message || "Failed to create event."
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold mb-2">Create New Event</h1>

      {status.message && (
        <div
          className={`mt-6 p-4 border rounded text-sm ${
            status.type === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-green-50 border-green-200 text-green-700"
          }`}
        >
          {status.message}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6">
        <div>
          <label className="text-xs uppercase tracking-widest text-stone-500">Title</label>
          <input
            className="txt-input w-full border border-stone-300"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-stone-500">Details</label>
          <textarea
            className="txt-input w-full border border-stone-300 min-h-[180px]"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs uppercase tracking-widest text-stone-500">Date & Time</label>
            <input
              type="datetime-local"
              className="txt-input w-full border border-stone-300"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="relative">
            <label className="text-xs uppercase tracking-widest text-stone-500">Location</label>
            <input
              className="txt-input w-full border border-stone-300"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setShowLocationSuggestions(true);
              }}
              onFocus={() => setShowLocationSuggestions(true)}
              onBlur={() => {
                window.setTimeout(() => setShowLocationSuggestions(false), 150);
              }}
              disabled={saving || isOnline}
              placeholder={isOnline ? "Online" : "City, Country or Country"}
            />

            {showLocationSuggestions && !isOnline && (
              <ul className="absolute w-full z-20 bg-white border border-stone-200 mt-1 max-h-48 overflow-y-auto shadow-lg rounded-sm">
                {locationSuggestions.length > 0 ? (
                  locationSuggestions.map((item) => (
                    <li
                      key={`${item.type}-${item.label}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleLocationSelect(item.label)}
                      className="px-3 py-2 hover:bg-stone-100 cursor-pointer text-stone-700 border-b border-stone-100 last:border-0"
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
          <label className="text-xs uppercase tracking-widest text-stone-500">Place details</label>
          <input
            className="txt-input w-full border border-stone-300"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            disabled={saving || isOnline}
            placeholder={isOnline ? "Online" : "Building, room, floor, meeting point"}
          />
        </div>

        <div className="p-4 border border-stone-200 rounded">
          <div className="text-sm font-semibold mb-3">Format</div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isOnline}
              onChange={(e) => setIsOnline(e.target.checked)}
              disabled={saving}
            />
            This is an online event
          </label>
        </div>

        <div className="relative">
          <label className="text-xs uppercase tracking-widest text-stone-500">Topics</label>

          <div className="mt-2 min-h-[52px] w-full border border-stone-300 rounded px-3 py-2 flex flex-wrap gap-2 items-center bg-white">
            {selectedTopics.map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-stone-100 px-3 py-1 text-sm text-stone-700"
              >
                {topic}
                <button
                  type="button"
                  onClick={() => removeTopic(topic)}
                  className="text-stone-500 hover:text-stone-900"
                  disabled={saving}
                >
                  ✕
                </button>
              </span>
            ))}

            <input
              ref={topicsInputRef}
              className="flex-1 min-w-[180px] outline-none bg-transparent py-1"
              value={topicsInput}
              onChange={(e) => {
                setTopicsInput(e.target.value);
                setShowTopicSuggestions(true);
              }}
              onFocus={() => setShowTopicSuggestions(true)}
              onBlur={() => {
                window.setTimeout(() => setShowTopicSuggestions(false), 150);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTopic(topicsInput);
                }

                if (
                  e.key === "Backspace" &&
                  !topicsInput.trim() &&
                  selectedTopics.length > 0
                ) {
                  removeTopic(selectedTopics[selectedTopics.length - 1]);
                }
              }}
              disabled={saving}
              placeholder="Select or type a topic and press Enter"
            />
          </div>

          {showTopicSuggestions && filteredTopicSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded border border-stone-200 bg-white shadow-lg max-h-48 overflow-auto">
              {filteredTopicSuggestions.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-stone-100"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTopic(topic)}
                  disabled={saving}
                >
                  {topic}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border border-stone-200 rounded">
          <div className="text-sm font-semibold mb-3">Visibility</div>

          <div className="grid grid-cols-1 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowApplicationCountVisible}
                onChange={(e) => setAllowApplicationCountVisible(e.target.checked)}
                disabled={saving}
              />
              Allow other users to see the number of registrations
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowApplicantsVisible}
                onChange={(e) => setAllowApplicantsVisible(e.target.checked)}
                disabled={saving}
              />
              Allow other users to see who registered
            </label>

            <div className="text-xs text-stone-500">
              As creator, you will always be able to see registration count and registrants.
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            className="btn-primary"
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? "Creating..." : "+ Create New Event"}
          </button>

          <button
            type="button"
            className="btn-outline"
            onClick={() => navigate("/events")}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
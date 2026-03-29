import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { listRegisteredEvents } from "./Controller";

export default function RegisteredEventsPage({ user }) {
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("upcoming");

  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      try {
        const rows = await listRegisteredEvents();
        setEvents(rows || []);
      } catch (error) {
        console.error("Failed to load registered events:", error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    if (user) loadEvents();
  }, [user]);

  const upcomingEvents = useMemo(
    () => (events || []).filter((e) => !e.completed),
    [events]
  );

  const completedEvents = useMemo(
    () => (events || []).filter((e) => !!e.completed),
    [events]
  );

  const visibleEvents =
    activeTab === "upcoming" ? upcomingEvents : completedEvents;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Registered Events</h1>
        <p className="text-stone-500 mt-2">
          Browse events you registered for.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <button
          type="button"
          className={`btn-outline ${activeTab === "upcoming" ? "!bg-stone-900 !text-white" : ""}`}
          onClick={() => setActiveTab("upcoming")}
        >
          <span className="inline-flex items-center gap-2">
            <CalendarDays size={16} />
            Upcoming Events ({upcomingEvents.length})
          </span>
        </button>

        <button
          type="button"
          className={`btn-outline ${activeTab === "completed" ? "!bg-stone-900 !text-white" : ""}`}
          onClick={() => setActiveTab("completed")}
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={16} />
            Completed Events ({completedEvents.length})
          </span>
        </button>
      </div>

      {loading ? (
        <div className="text-stone-500">Loading events...</div>
      ) : visibleEvents.length === 0 ? (
        <div className="text-stone-500">
          {activeTab === "upcoming"
            ? "No upcoming registered events."
            : "No completed registered events."}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => navigate(`/events/${event.id}`)}
              className="project-card-mini w-full text-left"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{event.title}</h2>
                  <p className="text-stone-600 mt-2">{event.details}</p>
                  {event.event_date && (
                    <div className="text-sm text-stone-400 mt-3">
                      Date: {new Date(event.event_date).toLocaleString()}
                    </div>
                  )}
                </div>

                {event.completed && (
                  <span className="tag-ghost whitespace-nowrap">
                    Completed
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
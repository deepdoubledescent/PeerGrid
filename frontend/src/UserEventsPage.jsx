import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { getProfile, listUserEvents } from "./Controller";

export default function UserEventsPage() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [viewedUser, setViewedUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [activeTab, setActiveTab] = useState("upcoming");

  useEffect(() => {
    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const profile = await getProfile(userId);
        setViewedUser(profile || null);
      } catch (error) {
        console.error("Failed to load user profile:", error);
        setViewedUser(null);
      } finally {
        setLoadingProfile(false);
      }
    };

    if (userId) loadProfile();
  }, [userId]);

  useEffect(() => {
    const loadEvents = async () => {
      setLoadingEvents(true);
      try {
        const rows = await listUserEvents(userId);
        setEvents(rows || []);
      } catch (error) {
        console.error("Failed to load user events:", error);
        setEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    };

    if (userId) loadEvents();
  }, [userId]);

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

  if (loadingProfile) {
    return <div className="p-8 max-w-5xl mx-auto">Loading...</div>;
  }

  if (!viewedUser) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="text-stone-500">User not found.</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">{viewedUser.name}&apos;s Events</h1>
        <p className="text-stone-500 mt-2">
          Browse events created by this user.
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

      {loadingEvents ? (
        <div className="text-stone-500">Loading events...</div>
      ) : visibleEvents.length === 0 ? (
        <div className="text-stone-500">
          {activeTab === "upcoming"
            ? "No upcoming events."
            : "No completed events."}
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

                  <div className="text-sm text-stone-400 mt-3 space-y-1">
                    {event.event_date && (
                      <div>
                        Date: {new Date(event.event_date).toLocaleString()}
                      </div>
                    )}
                    <div>Place: {event.place || "Online"}</div>
                  </div>

                  {!!event.topics?.length && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {event.topics.map((topic) => (
                        <span key={topic} className="tag-ghost">
                          {topic}
                        </span>
                      ))}
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
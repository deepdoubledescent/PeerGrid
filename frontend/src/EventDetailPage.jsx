import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  getEvent,
  deleteEvent,
  registerForEvent,
  unregisterFromEvent,
  hasUserRegisteredToEvent
} from "./Controller";

export default function EventDetailPage({ user }) {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  const [registerState, setRegisterState] = useState("idle");
  const [registerError, setRegisterError] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    const loadEvent = async () => {
      setLoading(true);
      try {
        const row = await getEvent(eventId);
        setEvent(row || null);
      } catch (err) {
        console.error("Failed to load event", err);
        setEvent(null);
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

  useEffect(() => {
    const checkRegistration = async () => {
      if (!user || !event || event.can_edit) return;

      try {
        const result = await hasUserRegisteredToEvent(event.id);
        setIsRegistered(!!result);
      } catch (err) {
        console.error("Failed to check registration", err);
      }
    };

    checkRegistration();
  }, [user, event]);

  if (loading) {
    return <div className="p-6 max-w-3xl mx-auto">Loading...</div>;
  }

  if (!event) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mt-6">Not found.</div>
      </div>
    );
  }

  const isOwner = !!event.can_edit;
  const isCompleted =
    !!event.completed ||
    (event.event_date && new Date(event.event_date) < new Date());

  const canSeeRegistrationCount =
    isOwner || !!event.allow_application_count_visible;

  const canSeeApplicants =
    isOwner || !!event.allow_applicants_visible;

  const onDelete = async () => {
    const status = await deleteEvent(eventId);
    if (status?.success) {
      navigate("/events");
    } else {
      alert("Error deleting event.");
    }
  };

  const onRegister = async () => {
    if (!user) {
      setRegisterState("error");
      setRegisterError("Please login before registering.");
      return;
    }

    try {
      setRegisterError("");
      setRegisterState("loading");
      await registerForEvent(event.id);
      setRegisterState("success");
      setIsRegistered(true);

      const fresh = await getEvent(event.id);
      setEvent(fresh);
    } catch (err) {
      setRegisterState("error");
      setRegisterError(err?.message || "Failed to register.");
    }
  };

  const onUnregister = async () => {
    try {
      setRegisterError("");
      setRegisterState("loading");
      await unregisterFromEvent(event.id);
      setRegisterState("idle");
      setIsRegistered(false);

      const fresh = await getEvent(event.id);
      setEvent(fresh);
    } catch (err) {
      setRegisterState("error");
      setRegisterError(err?.message || "Failed to unregister.");
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="mt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold leading-tight">{event.title}</h1>

            <div className="mt-2 flex flex-col gap-1 text-sm">
              <div className="text-gray-600 italic">
                {event.is_online ? "Online" : (event.location || "No location")}
              </div>

              {!event.is_online && !!event.place && (
                <div className="text-gray-500">
                  {event.place}
                </div>
              )}

              <div className="text-gray-500">
                {event.event_date ? new Date(event.event_date).toLocaleString() : "No date"}
              </div>
              <div>
                <Link
                  to={`/profile/${event.author}`}
                  className="text-gray-500 hover:text-[#6E7A8D] underline-offset-2 hover:underline"
                >
                  {event.author_display_name}
                </Link>
              </div>
            </div>

            {isCompleted && (
              <div className="mt-3 inline-block rounded-full border border-green-300 bg-green-50 px-3 py-1 text-sm text-green-700">
                Completed
              </div>
            )}
          </div>

          {isOwner && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="btn-outline px-4 py-2"
                onClick={() => navigate(`/events/${event.id}/edit`)}
              >
                Edit
              </button>

              <button
                type="button"
                className="btn-outline px-4 py-2 text-red-600 border-red-200 hover:bg-red-50"
                onClick={onDelete}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </header>

      <section className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <h2 className="text-lg font-medium mb-2">Topics</h2>
          {event.topics?.length ? (
            <div className="flex flex-wrap gap-2">
              {event.topics.map((topic) => (
                <span key={topic} className="tag-ghost">
                  {topic}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm opacity-60">None listed</div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-medium mb-2">Registration Count</h2>
          {canSeeRegistrationCount ? (
            <div className="flex flex-wrap gap-2">
              <span className="tag-ghost">
                {event.registration_count || 0} registered
              </span>
            </div>
          ) : (
            <div className="text-sm opacity-60">Hidden by event creator</div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-medium mb-2">Format</h2>
          <div className="flex flex-wrap gap-2">
            <span className="tag-ghost">
              {event.is_online ? "Online" : "In-person"}
            </span>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-medium mb-3">Details</h2>
        <div className="leading-relaxed whitespace-pre-line">
          {event.details}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-medium mb-3">Registrants</h2>

        {canSeeApplicants ? (
          event.registrants?.length ? (
            <div className="space-y-3">
              {event.registrants.map((person) => (
                <div
                  key={person.user_id}
                  className="p-3 rounded-xl border flex items-center justify-between"
                >
                  <Link
                    to={`/profile/${person.user_id}`}
                    className="hover:underline text-stone-700"
                  >
                    {person.display_name}
                  </Link>
                  {person.registered_at && (
                    <span className="text-xs text-stone-400">
                      {new Date(person.registered_at).toLocaleString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm opacity-60">No one has registered yet.</div>
          )
        ) : (
          <div className="text-sm opacity-60">Hidden by event creator</div>
        )}
      </section>

      {!isOwner && !isCompleted && (
        <section className="mt-10">
          {!isRegistered ? (
            <button
              type="button"
              className="btn-primary px-5 py-2"
              onClick={onRegister}
              disabled={registerState === "loading"}
            >
              {registerState === "loading" ? "Registering..." : "Register"}
            </button>
          ) : (
            <button
              type="button"
              className="btn-outline px-5 py-2"
              onClick={onUnregister}
              disabled={registerState === "loading"}
            >
              {registerState === "loading" ? "Updating..." : "Unregister"}
            </button>
          )}

          {registerError && (
            <div className="mt-3 text-sm text-red-600">{registerError}</div>
          )}
        </section>
      )}
    </div>
  );
}
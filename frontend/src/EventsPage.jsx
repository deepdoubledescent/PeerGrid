import { useNavigate } from "react-router-dom";

export default function EventsPage({ user }) {
  const navigate = useNavigate();

  const cards = [
    {
      title: "Search Events",
      description: "Search and filter upcoming and completed events.",
      label: "Browse Events",
      action: () => navigate("/events/search"),
    },
    {
      title: "My Events",
      description: "View, edit, and manage the events you created.",
      label: "My Events",
      action: () => navigate("/events/my"),
    },
    {
      title: "Registered Events",
      description: "Track events you have registered for.",
      label: "Registered Events",
      action: () => navigate("/events/registered"),
    },
    ...(user
      ? [
          {
            title: "Create New Event",
            description: "Publish a new event for other users.",
            label: "+ Create New Event",
            action: () => navigate("/events/new"),
          },
        ]
      : []),
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-semibold mb-8">Events</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-fr">
        {cards.map((card, index) => {
          const isOddLastCard = !user && cards.length % 2 === 1 && index === cards.length - 1;

          return (
            <div
              key={card.title}
              className={`card p-6 h-full flex flex-col ${
                isOddLastCard ? "md:col-span-2 md:max-w-[calc(50%-0.75rem)] md:w-full md:mx-auto" : ""
              }`}
            >
              <h2 className="text-xl font-medium mb-2">{card.title}</h2>
              <p className="text-sm opacity-70 mb-4 flex-1">{card.description}</p>
              <button className="btn-primary mt-auto" onClick={card.action}>
                {card.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

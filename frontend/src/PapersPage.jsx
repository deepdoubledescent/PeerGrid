import { useNavigate } from "react-router-dom";

export default function PapersPage({ user }) {
  const navigate = useNavigate();

  const cards = [
    ...(user
      ? [
          {
            title: "Recommended Papers",
            description: "Personalized recommendations tailored to your interests.",
            label: "View Recommendations",
            action: () => navigate("/papers/recommended"),
          },
        ]
      : []),
    {
      title: "Search Papers",
      description: "Search and filter research papers across topics and fields.",
      label: "Browse Papers",
      action: () => navigate("/papers/all"),
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-semibold mb-8">Research Papers</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-fr">
        {cards.map((card, index) => {
          const isSingleCard = !user && cards.length === 1;

          return (
            <div
              key={card.title}
              className={`card p-6 h-full flex flex-col ${
                isSingleCard
                  ? "md:col-span-2 md:max-w-[calc(50%-0.75rem)] md:mx-auto"
                  : ""
              }`}
            >
              <h2 className="text-xl font-medium mb-2">{card.title}</h2>
              <p className="text-sm opacity-70 mb-4 flex-1">{card.description}</p>
              <button
                className="btn-primary mt-auto"
                onClick={card.action}
              >
                {card.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

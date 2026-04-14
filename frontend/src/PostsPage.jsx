import { useNavigate } from "react-router-dom";

export default function PostsPage({ user }) {
  const navigate = useNavigate();

  const cards = user
    ? [
        {
          title: "Search by Topic",
          description: "Find posts by selecting one or more topics.",
          label: "Search Posts",
          action: () => navigate("/posts/all"),
        },
        {
          title: "Recommended Posts",
          description: "Discover posts with topics from posts you liked.",
          label: "Open Recommendations",
          action: () => navigate("/posts/recommended"),
        },
        {
          title: "Your Feed",
          description: "View posts from people you follow.",
          label: "Open Feed",
          action: () => navigate("/posts/feed"),
        },
        {
          title: "My Posts",
          description: "View and manage posts you have created.",
          label: "Open My Posts",
          action: () => navigate(`/profile/${user?.id || user?.sub}/posts`),
        },
        {
          title: "New Post",
          description: "Write and publish a new post.",
          label: "+ Create New Post",
          action: () => navigate("/posts/new"),
        },
      ]
    : [
        {
          title: "Search by Topic",
          description: "Find posts by selecting one or more topics.",
          label: "Search Posts",
          action: () => navigate("/posts/all"),
        },
      ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-semibold mb-8">Posts</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-fr">
        {cards.map((card, index) => {
          const isOddLastCard =
            cards.length % 2 === 1 && index === cards.length - 1;

          return (
            <div
              key={card.title}
              className={`card p-6 h-full flex flex-col ${
                isOddLastCard
                  ? "md:col-span-2 md:max-w-[calc(50%-0.75rem)] md:w-full md:mx-auto"
                  : ""
              }`}
            >
              <h2 className="text-xl font-medium mb-2">{card.title}</h2>
              <p className="text-sm opacity-70 mb-4 flex-1">
                {card.description}
              </p>
              <button
                className="btn-primary mt-auto w-full"
                onClick={card.action}
                type="button"
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
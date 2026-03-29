import { useNavigate } from "react-router-dom";

export default function PostsPage({ user }) {
  const navigate = useNavigate();

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-semibold mb-8">Posts</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-fr">
        <div className="card p-6 h-full flex flex-col">
          <h2 className="text-xl font-medium mb-2">Search by Topic</h2>
          <p className="text-sm opacity-70 mb-4 flex-1">
            Find posts by selecting one or more topics
          </p>
          <button
            className="btn-primary mt-auto"
            onClick={() => navigate("/posts/all")}
          >
            Search Posts
          </button>
        </div>

        <div className="card p-6 h-full flex flex-col">
          <h2 className="text-xl font-medium mb-2">Your Feed</h2>
          <p className="text-sm opacity-70 mb-4 flex-1">
            View posts from people you follow
          </p>
          <button
            className="btn-primary mt-auto"
            onClick={() => navigate("/posts/feed")}
          >
            Open Feed
          </button>
        </div>

        <div className="card p-6 h-full flex flex-col">
          <h2 className="text-xl font-medium mb-2">My Posts</h2>
          <p className="text-sm opacity-70 mb-4 flex-1">
            View and manage posts you have created
          </p>
          <button
            className="btn-primary mt-auto"
            onClick={() =>
              navigate(`/profile/${user?.id || user?.sub}/posts`)
            }
            disabled={!user}
          >
            Open My Posts
          </button>
        </div>

        <div className="card p-6 h-full flex flex-col">
          <h2 className="text-xl font-medium mb-2">New Post</h2>
          <p className="text-sm opacity-70 mb-4 flex-1">
            Write and publish a new post
          </p>
          <button
            className="btn-primary mt-auto"
            onClick={() => navigate("/posts/new")}
            disabled={!user}
          >
            + Create New Post
          </button>
        </div>
      </div>
    </div>
  );
}

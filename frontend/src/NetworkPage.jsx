import { useNavigate } from "react-router-dom";

export default function NetworkPage({ user }) {
  const navigate = useNavigate();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold mb-8">My Network</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Mutual Connections */}
        <div className="card p-6">
          <h2 className="text-xl font-medium mb-2">Connections</h2>
          <p className="text-sm opacity-70 mb-4">
            People Who Liked You & You Liked Back.
          </p>

          <button
            className="btn-primary"
            onClick={() => navigate("/people/network/connections")}
          >
            View Connections
          </button>
        </div>

        {/* Following */}
        <div className="card p-6">
          <h2 className="text-xl font-medium mb-2">Following</h2>
          <p className="text-sm opacity-70 mb-4">
            People You Liked.
          </p>

          <button
            className="btn-primary"
            onClick={() => navigate("/people/network/following")}
          >
            View Following
          </button>
        </div>

      </div>
    </div>
  );
}
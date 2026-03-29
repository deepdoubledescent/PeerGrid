import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getLikedProjectsForUser } from "./Controller";
import { Heart } from "lucide-react";

export default function UserLikedProjectsPage() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [likedProjects, setLikedProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLikedProjects = async () => {
      setLoading(true);
      try {
        const rows = await getLikedProjectsForUser(userId);
        setLikedProjects(rows || []);
      } catch (error) {
        console.error("Failed to load liked projects:", error);
        setLikedProjects([]);
      } finally {
        setLoading(false);
      }
    };

    loadLikedProjects();
  }, [userId]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold inline-flex items-center gap-3">
          <Heart size={28} />
          Liked Projects
        </h1>
        <p className="text-stone-500 mt-2">
          Projects this user has saved.
        </p>
      </div>

      {loading ? (
        <div className="text-stone-500">Loading liked projects...</div>
      ) : likedProjects.length === 0 ? (
        <div className="text-stone-500">No liked projects yet.</div>
      ) : (
        <div className="space-y-4">
          {likedProjects.map((project) => {
            const projectId = project.id || project.project_id;
            const title = project.title || project.project_title || "Untitled project";
            const shortDescription =
              project.short_description ||
              project.description ||
              project.shortDescription ||
              "";

            return (
              <button
                key={projectId}
                type="button"
                onClick={() => navigate(`/projects/${projectId}`)}
                className="project-card-mini w-full text-left"
              >
                <h2 className="text-xl font-semibold">{title}</h2>
                {shortDescription && (
                  <p className="text-stone-600 mt-2">
                    {shortDescription}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
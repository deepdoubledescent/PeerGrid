import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getLikedPapersForUser } from "./Controller";
import { getWorkById } from "./papersApi";
import { BookOpen } from "lucide-react";

export default function UserLikedPapersPage({ user }) {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [likedPapers, setLikedPapers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLikedPapers = async () => {
      setLoading(true);
      try {
        const ids = await getLikedPapersForUser(userId);
        const papers = await Promise.all(
          (ids || []).map((id) => getWorkById(id, user))
        );
        setLikedPapers((papers || []).filter(Boolean));
      } catch (error) {
        console.error("Failed to load liked papers:", error);
        setLikedPapers([]);
      } finally {
        setLoading(false);
      }
    };

    loadLikedPapers();
  }, [userId, user]);

  const getPaperRouteId = (paper) => {
    if (!paper) return null;

    if (typeof paper.id === "string" && paper.id.includes("/")) {
      return paper.id.split("/").filter(Boolean).pop();
    }

    return paper.id || paper.paper_id || paper.openalex_id || null;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold inline-flex items-center gap-3">
          <BookOpen size={28} />
          Liked Papers
        </h1>
        <p className="text-stone-500 mt-2">
          Academic papers this user liked.
        </p>
      </div>

      {loading ? (
        <div className="text-stone-500">Loading liked papers...</div>
      ) : likedPapers.length === 0 ? (
        <div className="text-stone-500">No liked papers yet.</div>
      ) : (
        <div className="space-y-4">
          {likedPapers.map((paper) => {
            const paperId = getPaperRouteId(paper);

            return (
              <button
                key={paperId || paper.id || paper.doi || paper.title}
                type="button"
                onClick={() => {
                  if (!paperId) return;
                  navigate(`/papers/${paperId}`, {
                    state: { paper_object: paper },
                  });
                }}
                className="project-card-mini block w-full text-left"
              >
                <h2 className="text-xl font-semibold">{paper.title}</h2>

                {paper.authorships?.length > 0 && (
                  <p className="text-stone-600 mt-2">
                    {paper.authorships
                      .slice(0, 5)
                      .map((a) => a.author?.display_name)
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}

                <div className="text-sm text-stone-400 mt-3">
                  {paper.publication_year
                    ? `Publication year: ${paper.publication_year}`
                    : "Publication year unknown"}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
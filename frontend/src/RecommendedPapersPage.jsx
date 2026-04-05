import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { MessageSquareText } from "lucide-react";
import {
  getTopTopicScores,
  getLikedPapersForUser,
  getPaperMetaBatch,
  toggleLikePaper,
} from "./Controller";
import { getRecommendedWorksByTopics } from "./papersApi";

const extractPaperTopics = (paper) => {
  return (paper?.topics || [])
    .map((topic) => ({
      topic_id: Number(String(topic.id || "").match(/\d+/)?.[0]),
      score: Number(topic.score ?? 0),
    }))
    .filter((topic) => Number.isFinite(topic.topic_id) && topic.score > 0);
};

const PaperListEntry = ({
  paper,
  liked,
  likeCount,
  commentCount,
  onTogglePaperLike,
}) => {
  const paperId = paper.id.split("/").filter(Boolean).pop();

  return (
    <div className="card p-4">
      <Link
        to={`/papers/${paperId}`}
        state={{ paper_object: paper }}
        className="font-medium text-lg hover:underline"
      >
        {paper.title}
      </Link>

      <div className="text-sm opacity-70 mt-1">
        {paper.publication_year} ·{" "}
        {(paper.authorships || [])
          .slice(0, 4)
          .map((a) => a.author.display_name)
          .join(", ")}
      </div>

      {paper.open_access?.oa_url && (
        <a
          href={paper.open_access.oa_url}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-blue-600 mt-2 inline-block"
        >
          Open access PDF
        </a>
      )}

      <section className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          className={`btn-outline px-5 py-2 ${liked ? "text-red-600" : ""}`}
          onClick={() => onTogglePaperLike(paperId, paper)}
        >
          {liked ? "♥" : "♡"} Like {likeCount ?? 0}
        </button>

        <Link
          to={`/papers/${paperId}`}
          state={{ paper_object: paper }}
          className="flex items-center gap-1 hover:bg-stone-200/50 p-3"
        >
          <MessageSquareText size={18} />
          <span>{commentCount ?? 0}</span>
        </Link>
      </section>
    </div>
  );
};

export default function RecommendedPapersPage({ user }) {
  const navigate = useNavigate();
  const userKey = useMemo(() => user?.id || user?.sub, [user]);

  const [papers, setPapers] = useState([]);
  const [metaById, setMetaById] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [message, setMessage] = useState("");
  const [hasMore, setHasMore] = useState(false);

  const hasLoadedRef = useRef(false);
  const topicIdsRef = useRef([]);
  const likedPaperIdsRef = useRef([]);

  const fetchRecommendations = useCallback(
    async ({ append = false } = {}) => {
      if (!userKey) {
        setMessage("Please log in to see recommended papers.");
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setMessage("");
      }

      try {
        let topicIds = topicIdsRef.current;
        let likedPaperIds = likedPaperIdsRef.current;

        if (!topicIds.length && !append) {
          const [topicRows, likedPaperIdsResp] = await Promise.all([
            getTopTopicScores(10),
            getLikedPapersForUser(userKey),
          ]);

          topicIds = (topicRows || []).map((row) => row.topic_id);
          likedPaperIds = (likedPaperIdsResp || []).map((id) =>
            typeof id === "string" ? id : id.paper_id
          );

          topicIdsRef.current = topicIds;
          likedPaperIdsRef.current = likedPaperIds;
        }

        if (!topicIds.length) {
          setPapers([]);
          setHasMore(false);
          setMessage("Like some papers first to get recommendations.");
          return;
        }

        const alreadyShownIds = papers.map((paper) =>
          paper.id.split("/").filter(Boolean).pop()
        );

        const excludeIds = [
          ...new Set([...likedPaperIds, ...alreadyShownIds]),
        ];

        const results = await getRecommendedWorksByTopics({
          topicIds,
          excludeIds,
          perPage: 20,
          user,
        });

        const dedupedNew = (results || []).filter((paper) => {
          const workId = paper.id.split("/").filter(Boolean).pop();
          return !excludeIds.includes(workId);
        });

        if (append) {
          setPapers((prev) => [...prev, ...dedupedNew]);
        } else {
          setPapers(dedupedNew);
        }

        setHasMore(dedupedNew.length > 0);

        if (!append && dedupedNew.length === 0) {
          setMessage("No recommendations found.");
        }
      } catch (err) {
        console.error("Failed to load recommended papers", err);
        if (!append) {
          setPapers([]);
          setMessage("Failed to load recommendations.");
        }
        setHasMore(false);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [papers, user, userKey]
  );

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    fetchRecommendations({ append: false });
  }, [fetchRecommendations]);

  useEffect(() => {
    const syncMetadata = async () => {
      if (!papers.length) return;

      const idsToFetch = papers
        .map((p) => p.id.split("/").filter(Boolean).pop())
        .filter((id) => !metaById[id]);

      if (!idsToFetch.length) return;

      try {
        const { likeCounts, hasLiked, commentCounts } =
          await getPaperMetaBatch(idsToFetch);

        const newMeta = {};
        idsToFetch.forEach((id, index) => {
          newMeta[id] = {
            liked: hasLiked[index],
            likeCount: likeCounts[index],
            commentCount: commentCounts[index],
          };
        });

        setMetaById((prev) => ({ ...prev, ...newMeta }));
      } catch (err) {
        console.error("Failed to fetch paper metadata", err);
      }
    };

    syncMetadata();
  }, [papers, metaById]);

  const onTogglePaperLike = async (paperId, paper) => {
    if (!user) {
      alert("Please log in to like papers.");
      return;
    }

    await toggleLikePaper(paperId, extractPaperTopics(paper));

    const { likeCounts, hasLiked, commentCounts } = await getPaperMetaBatch([
      paperId,
    ]);

    setMetaById((prev) => ({
      ...prev,
      [paperId]: {
        liked: hasLiked[0],
        likeCount: likeCounts[0],
        commentCount: commentCounts[0],
      },
    }));
  };

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    await fetchRecommendations({ append: true });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Recommended Papers</h1>
        <p className="text-sm opacity-70 mt-2">
          Based on topic scores from papers you liked
        </p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="my-40 text-center text-gray-500">
            Loading recommendations...
          </div>
        ) : papers.length > 0 ? (
          papers.map((paper) => {
            const id = paper.id.split("/").filter(Boolean).pop();
            const meta = metaById[id] || {};

            return (
              <PaperListEntry
                key={paper.id}
                paper={paper}
                liked={meta.liked}
                likeCount={meta.likeCount}
                commentCount={meta.commentCount}
                onTogglePaperLike={onTogglePaperLike}
              />
            );
          })
        ) : (
          <div className="my-40 text-center text-gray-500">{message}</div>
        )}
      </div>

      {!isLoading && papers.length > 0 && (
        <div className="mt-8 text-center">
          <button
            className="btn-outline"
            onClick={handleLoadMore}
            disabled={isLoadingMore || !hasMore}
            type="button"
          >
            {isLoadingMore
              ? "Loading..."
              : hasMore
              ? "Load More Papers"
              : "No More Papers"}
          </button>
        </div>
      )}

      {/* Spacer so the fixed bottom bar does not cover content */}
      <div style={{ height: '100px' }}></div>

      {/* Fixed bottom bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '100%',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderTop: '1px solid #e5e5e5',
          backdropFilter: 'blur(5px)',
          padding: '1.5rem 0',
          display: 'flex',
          justifyContent: 'center',
          zIndex: 100,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.03)',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <button
            className="btn-primary"
            onClick={() => navigate("/papers/all")}
            type="button"
          >
            Browse Papers
          </button>

          <button
            className="btn-primary"
            onClick={handleLoadMore}
            disabled={isLoadingMore || !hasMore}
            type="button"
          >
            {isLoadingMore
              ? "Loading..."
              : hasMore
              ? "Load More Papers"
              : "No More Papers"}
          </button>
        </div>
      </div>
    </div>
  );
}
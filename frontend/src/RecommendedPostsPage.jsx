import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { MessageSquareText } from "lucide-react";
import {
  getLikedPostsForUser,
  searchPosts,
  toggleLikePost,
  getPostMetaBatch,
  deletePost,
} from "./Controller";

const getPostPreview = (post, maxLength = 180) => {
  if (post.short_text?.trim()) return post.short_text.trim();

  const fullText = post.text?.trim() || "";
  if (fullText.length <= maxLength) return fullText;
  return fullText.slice(0, maxLength).trim() + "...";
};

const PostListEntry = ({
  post,
  user,
  liked,
  likeCount,
  commentCount,
  onDelete,
  onTogglePostLike,
}) => {
  const navigate = useNavigate();
  const preview = getPostPreview(post);

  const isOwner =
    user && String(user.id || user.sub) === String(post.author);

  const handleDelete = async (e) => {
    e.stopPropagation();

    const confirmed = window.confirm(
      "Are you sure you want to delete this post?"
    );
    if (!confirmed) return;

    try {
      const resp = await deletePost(post.id);
      const result = resp?.result || resp;

      if (result?.success === false) {
        alert(result.message || "Failed to delete post.");
        return;
      }

      onDelete(post.id);
    } catch (err) {
      console.error("Failed to delete post", err);
      alert("Failed to delete post.");
    }
  };

  return (
    <div className="card p-5">
      <h2
        className="text-xl font-medium mb-3 cursor-pointer hover:underline"
        onClick={() => navigate(`/posts/${post.id}`)}
      >
        {post.title}
      </h2>

      {(post.post_topics || []).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {post.post_topics.map((topic) => (
            <span key={topic} className="tag-ghost">
              {topic}
            </span>
          ))}
        </div>
      )}

      <div className="text-sm opacity-70 mb-3">
        {post.author_display_name || "Unknown user"}
      </div>

      <p className="text-sm leading-6 opacity-90 whitespace-pre-wrap">
        {preview}
      </p>

      <section className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          className={`btn-outline px-5 py-2 ${liked ? "text-red-600" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePostLike(post.id);
          }}
        >
          {liked ? "♥" : "♡"} Like {likeCount ?? 0}
        </button>

        <Link
          to={`/posts/${post.id}`}
          className="flex items-center gap-1 hover:bg-stone-200/50 p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <MessageSquareText size={18} />
          <span>{commentCount ?? 0}</span>
        </Link>
      </section>

      {isOwner && (
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            className="btn-outline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/posts/${post.id}/edit`);
            }}
          >
            Edit
          </button>

          <button
            type="button"
            className="btn-outline"
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default function RecommendedPostsPage({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [recommendedPosts, setRecommendedPosts] = useState([]);
  const [metaById, setMetaById] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [totalResults, setTotalResults] = useState(0);

  const userKey = useMemo(() => user?.id || user?.sub, [user]);

  const filter = {
    page: parseInt(searchParams.get("page") || "1", 10),
    results_per_page: parseInt(
      searchParams.get("results_per_page") || "10",
      10
    ),
  };

  const updateParams = (updates) => {
    const newParams = new URLSearchParams(searchParams);

    updates.forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });

    setSearchParams(newParams);
  };

  useEffect(() => {
    const loadRecommendations = async () => {
      if (!userKey) {
        setMessage("Please log in to see recommended posts.");
        setRecommendedPosts([]);
        setTotalResults(0);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setMessage("");

      try {
        const likedResp = await getLikedPostsForUser(userKey);
        const likedPosts = likedResp?.result || likedResp || [];
        console.log( "Liked posts:", likedPosts);

        if (!likedPosts.length) {
          setRecommendedPosts([]);
          setTotalResults(0);
          setMessage("There aren't any compatible posts.");
          return;
        }

        const likedTopicSet = new Set(
          likedPosts.flatMap((post) => post.post_topics || [])
        );

        if (!likedTopicSet.size) {
          setRecommendedPosts([]);
          setTotalResults(0);
          setMessage("There aren't any compatible posts.");
          return;
        }

        
        const filter = {
          sortBy: searchParams.get("sortBy") || "date_newest",
          page: parseInt(searchParams.get("page") || "1", 10),
          query: searchParams.get("query") || "",
          topics: searchParams.getAll("topic") || [],
          results_per_page: parseInt(
            searchParams.get("results_per_page") || "10",
            10
          ),
        };
        const allPostsResp = await searchPosts({ filter });
        const allPosts = allPostsResp?.posts || [];
        const likedPostIds = new Set(likedPosts.map((post) => String(post.id)));
        console.log(allPosts, "total posts found, filtering...");

        const matches = allPosts.filter((post) => {
          const postTopics = post.post_topics || [];
          const hasSharedTopic = postTopics.some((topic) =>
            likedTopicSet.has(topic)
          );

          return hasSharedTopic && !likedPostIds.has(String(post.id));
        });

        if (!matches.length) {
          setRecommendedPosts([]);
          setTotalResults(0);
          setMessage("There aren't any compatible posts.");
          return;
        }

        setTotalResults(matches.length);

        const start = (filter.page - 1) * filter.results_per_page;
        const end = start + filter.results_per_page;
        setRecommendedPosts(matches.slice(start, end));
      } catch (error) {
        console.error("Failed to load recommended posts", error);
        setRecommendedPosts([]);
        setTotalResults(0);
        setMessage("Failed to load recommendations.");
      } finally {
        setIsLoading(false);
      }
    };

    loadRecommendations();
  }, [userKey, searchParams]);

  useEffect(() => {
    const syncMetadata = async () => {
      if (!recommendedPosts.length) return;

      const idsToFetch = recommendedPosts
        .map((p) => p.id)
        .filter((id) => !metaById[id]);

      if (!idsToFetch.length) return;

      try {
        const resp = await getPostMetaBatch(idsToFetch);
        const result = resp?.result || resp || {};
        const { likeCounts = [], hasLiked = [], commentCounts = [] } = result;

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
        console.error("Failed to fetch post metadata", err);
      }
    };

    syncMetadata();
  }, [recommendedPosts, user]);

  const handleDeleteLocally = (deletedId) => {
    setRecommendedPosts((prev) => prev.filter((p) => p.id !== deletedId));
    setTotalResults((prev) => Math.max(0, prev - 1));
  };

  const onTogglePostLike = async (postId) => {
    if (!user) {
      alert("Please log in to like posts.");
      return;
    }

    await toggleLikePost(postId);

    const resp = await getPostMetaBatch([postId]);
    const result = resp?.result || resp || {};
    const { likeCounts = [], hasLiked = [], commentCounts = [] } = result;

    setMetaById((prev) => ({
      ...prev,
      [postId]: {
        liked: hasLiked[0],
        likeCount: likeCounts[0],
        commentCount: commentCounts[0],
      },
    }));
  };

  const totalPages = Math.ceil(totalResults / filter.results_per_page);
  const page = filter.page;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Recommended Posts</h1>
        <p className="text-sm opacity-70 mt-2">
          Posts that match topics from posts you liked before
        </p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="width-full center my-40 text-center text-gray-500">
            Loading recommendations...
          </div>
        ) : recommendedPosts.length > 0 ? (
          recommendedPosts.map((post) => {
            const meta = metaById[post.id] || {};
            return (
              <PostListEntry
                key={post.id}
                post={post}
                user={user}
                liked={meta.liked}
                likeCount={meta.likeCount}
                commentCount={meta.commentCount}
                onDelete={handleDeleteLocally}
                onTogglePostLike={onTogglePostLike}
              />
            );
          })
        ) : (
          <div className="width-full center my-40 text-center text-gray-500">
            {message || "There aren't any compatible posts."}
          </div>
        )}
      </div>

      <div className="mt-8">
        <div className="flex gap-7 justify-center text-gray-500 text-s">
          <button
            disabled={page <= 1}
            onClick={() => updateParams([["page", String(page - 1)]])}
            className="cursor-pointer disabled:text-gray-300 disabled:cursor-default"
            type="button"
          >
            <u>Previous</u>
          </button>

          {[...Array(totalPages || 0)].map((_, i) => (
            <button
              key={i}
              disabled={page === i + 1}
              onClick={() => updateParams([["page", String(i + 1)]])}
              className={`cursor-pointer disabled:cursor-default ${
                page === i + 1 ? "font-bold text-gray-700" : "font-normal"
              }`}
              type="button"
            >
              {i + 1}
            </button>
          ))}

          <button
            disabled={page >= totalPages}
            onClick={() => updateParams([["page", String(page + 1)]])}
            className="cursor-pointer disabled:text-gray-300 disabled:cursor-default"
            type="button"
          >
            <u>Next</u>
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mt-10">
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate("/posts/feed")}
            disabled={!user}
          >
            Feed
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate("/posts/all")}
          >
            Browse
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate(`/profile/${user?.id || user?.sub}/posts`)}
            disabled={!user}
          >
            My Posts
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate("/posts/new")}
            disabled={!user}
          >
            + New Post
          </button>
        </div>
      </div>
    </div>
  );
}
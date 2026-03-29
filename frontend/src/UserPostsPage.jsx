import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { MessageSquareText } from "lucide-react";
import {
  listUserPosts,
  deletePost,
  toggleLikePost,
  getPostMetaBatch,
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
  isOwnerView,
  onDelete,
  liked,
  likeCount,
  commentCount,
  onTogglePostLike,
}) => {
  const navigate = useNavigate();
  const preview = getPostPreview(post);

  const isOwner =
    isOwnerView ||
    (user && String(user.id || user.sub) === String(post.author));

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
          {(post.post_topics || []).map((topic) => (
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

export default function UserPostsPage({ user }) {
  const navigate = useNavigate();
  const { userId } = useParams();

  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metaById, setMetaById] = useState({});

  const effectiveUserId = userId || user?.id || user?.sub;

  const isOwnerView =
    user && String(user.id || user.sub) === String(effectiveUserId);

  useEffect(() => {
    const loadPosts = async () => {
      if (!effectiveUserId) {
        setPosts([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const resp = await listUserPosts(effectiveUserId);
        const result = resp?.result || resp || [];
        setPosts(Array.isArray(result) ? result : []);
      } catch (err) {
        console.error("Failed to load user posts", err);
        setPosts([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadPosts();
  }, [effectiveUserId]);

  useEffect(() => {
    const syncMetadata = async () => {
      if (!posts.length) return;

      const idsToFetch = posts
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
  }, [posts, user]);

  const handleDeleteLocally = (deletedId) => {
    setPosts((prev) => prev.filter((p) => p.id !== deletedId));
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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">
          {isOwnerView ? "My Posts" : "User Posts"}
        </h1>

        <p className="text-sm opacity-70 mt-2">
          {posts.length} {posts.length === 1 ? "post" : "posts"}
        </p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="width-full center my-40 text-center text-gray-500">
            Loading posts...
          </div>
        ) : posts.length > 0 ? (
          posts.map((post) => {
            const meta = metaById[post.id] || {};
            return (
              <PostListEntry
                key={post.id}
                post={post}
                user={user}
                isOwnerView={isOwnerView}
                onDelete={handleDeleteLocally}
                liked={meta.liked}
                likeCount={meta.likeCount}
                commentCount={meta.commentCount}
                onTogglePostLike={onTogglePostLike}
              />
            );
          })
        ) : (
          <div className="width-full center my-40 text-center text-gray-500">
            {isOwnerView
              ? "You have not posted anything yet."
              : "This user has no posts yet."}
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-4 mt-10">
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate("/posts/feed")}
          disabled={!user}
        >
          Open Feed
        </button>

        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate(`/profile/${user?.id || user?.sub}/posts`)}
          disabled={!user}
        >
          My Posts
        </button>

        {isOwnerView && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate("/posts/new")}
          >
            + Create New Post
          </button>
        )}
      </div>
    </div>
  );
}
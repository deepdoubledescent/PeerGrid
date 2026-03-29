import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getLikedPostsForUser } from "./Controller";
import { Heart } from "lucide-react";

const getPostPreview = (post, maxLength = 180) => {
  if (post.short_text?.trim()) return post.short_text.trim();

  const fullText = post.text?.trim() || "";
  if (fullText.length <= maxLength) return fullText;
  return fullText.slice(0, maxLength).trim() + "...";
};

export default function UserLikedPostsPage() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [likedPosts, setLikedPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLikedPosts = async () => {
      setLoading(true);
      try {
        const rows = await getLikedPostsForUser(userId);
        const result = rows?.result || rows || [];
        setLikedPosts(Array.isArray(result) ? result : []);
      } catch (error) {
        console.error("Failed to load liked posts:", error);
        setLikedPosts([]);
      } finally {
        setLoading(false);
      }
    };

    loadLikedPosts();
  }, [userId]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold inline-flex items-center gap-3">
          <Heart size={28} />
          Liked Posts
        </h1>
        <p className="text-stone-500 mt-2">
          Posts this user has liked.
        </p>
      </div>

      {loading ? (
        <div className="text-stone-500">Loading liked posts...</div>
      ) : likedPosts.length === 0 ? (
        <div className="text-stone-500">No liked posts yet.</div>
      ) : (
        <div className="space-y-4">
          {likedPosts.map((post) => {
            const postId = post.id || post.post_id;
            const title = post.title || "Untitled post";
            const authorName = post.author_display_name || "Unknown user";
            const preview =
              post.preview_text || getPostPreview(post);

            return (
              <button
                key={postId}
                type="button"
                onClick={() => navigate(`/posts/${postId}`)}
                className="project-card-mini w-full text-left"
              >
                <h2 className="text-xl font-semibold">{title}</h2>

                <div className="text-sm text-stone-400 mt-2">
                  {authorName}
                </div>

                {preview && (
                  <p className="text-stone-600 mt-2 whitespace-pre-wrap">
                    {preview}
                  </p>
                )}

                {(post.post_topics || []).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {post.post_topics.map((topic) => (
                      <span key={topic} className="tag-ghost">
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
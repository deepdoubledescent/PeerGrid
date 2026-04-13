import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Search, X, MessageSquareText } from "lucide-react";
import {
  searchPosts,
  getPostTopics,
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

const TagSelectModal = ({
  tagState,
  tagList,
  onTagToggle,
  setModalState,
  title = "Select Topics",
}) => {
  const [filterText, setFilterText] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-stone-900/10 backdrop-blur-sm"
        onClick={() => setModalState(false)}
      ></div>

      <div className="relative bg-stone-50 w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between p-6 pb-2 border-b border-stone-100">
          <h3 className="font-sans uppercase tracking-widest text-xs font-bold text-stone-500">
            {title}
          </h3>
          <button
            onClick={() => setModalState(false)}
            className="text-stone-400 hover:text-stone-900 transition-colors"
            type="button"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <div className="w-full flex relative">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter topics"
            className="h-fit w-full border-b-1 border-black bg-transparent mb-5 py-1 mx-12 focus:outline-none placeholder-stone-400/50 text-stone-900 font-normal"
          />
          <div className="absolute right-12 py-1 text-stone-400">
            {filterText && (
              <button
                onClick={() => setFilterText("")}
                className="hover:text-stone-900 transition-colors opacity-50"
                type="button"
              >
                <X size={24} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap overflow-y-auto px-6 gap-y-2 custom-scrollbar">
          {tagList
            .filter((k) => k.toLowerCase().includes(filterText.toLowerCase()))
            .map((k) => {
              const isSelected = tagState.has(k);
              return (
                <button
                  key={k}
                  className={`tag-ghost pointer-events-auto cursor-pointer ${
                    isSelected
                      ? "!border-1 !border-[var(--yellow)] hover:!tag-ghost"
                      : "hover:border-1 hover:border-[var(--yellow)]"
                  }`}
                  onClick={() => onTagToggle(k)}
                  type="button"
                >
                  {k}
                </button>
              );
            })}
        </div>

        <div className="p-6 border-t border-stone-100 bg-stone-50 flex justify-end">
          <button
            onClick={() => setModalState(false)}
            className="px-6 py-2 bg-stone-900 text-stone-50 font-sans text-xs uppercase tracking-widest hover:bg-stone-700 transition-colors"
            type="button"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

const PostListEntry = ({
  post,
  selectedTopics,
  onTopicToggle,
  user,
  onDelete,
  liked,
  likeCount,
  commentCount,
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
          {(post.post_topics || []).map((topic) => (
            <button
              key={topic}
              type="button"
              className={`tag-ghost cursor-pointer ${
                selectedTopics.has(topic)
                  ? "!border-1 !border-[var(--yellow)] hover:!tag-ghost"
                  : "hover:border-1 hover:border-[var(--yellow)]"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onTopicToggle(topic);
              }}
            >
              {topic}
            </button>
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

export default function AllPostsPage({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [posts, setPosts] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState(new Set());
  const [query, setQuery] = useState("");
  const [isTopicsModalOpen, setIsTopicsModalOpen] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [metaById, setMetaById] = useState({});

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

  const updateParams = (updates) => {
    const newParams = new URLSearchParams(searchParams);

    updates.forEach(([key, value]) => {
      if (key === "topic") {
        newParams.delete(key);
        value.forEach((k) => newParams.append(key, k));
      } else {
        if (value !== "" && value !== null && value !== undefined) {
          newParams.set(key, value);
        } else {
          newParams.delete(key);
        }
      }
    });

    setSearchParams(newParams);
  };

  useEffect(() => {
    const loadTopics = async () => {
      try {
        const rows = await getPostTopics();
        const data = rows?.result || rows || [];
        setTopics(data);
      } catch (error) {
        console.error("Failed to fetch post topics", error);
        setTopics([]);
      }
    };

    loadTopics();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await searchPosts({ filter });
        const result = response?.result || response || {};

        setPosts(result.posts || []);
        setTotalResults(result.total_results || 0);
      } catch (error) {
        console.error("Failed to fetch posts", error);
        setPosts([]);
        setTotalResults(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    setQuery(filter.query);
    setSelectedTopics(new Set(filter.topics));
  }, [searchParams]);

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

  useEffect(() => {
    if (isTopicsModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isTopicsModalOpen]);

  const toggleTopic = (topic) => {
    setSelectedTopics((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(topic)) newSet.delete(topic);
      else newSet.add(topic);
      return newSet;
    });
  };

  const handleSearch = () => {
    updateParams([
      ["page", "1"],
      ["query", query],
      ["sortBy", filter.sortBy],
      ["topic", Array.from(selectedTopics)],
    ]);
  };

  const resetFilters = () => {
    setQuery("");
    setSelectedTopics(new Set());

    updateParams([
      ["page", "1"],
      ["query", ""],
      ["sortBy", "date_newest"],
      ["topic", []],
    ]);
  };

  const clearSearch = () => {
    setQuery("");
  };

  const handleDeleteLocally = (deletedId) => {
    setPosts((prev) => prev.filter((p) => p.id !== deletedId));
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
      <h1 className="text-3xl font-semibold mb-6">Search Posts</h1>

      <div className="search-field flex-col">
        <div className="search-bar flex flex-row">
          <div className="group w-full flex items-center border-b-1 border-black transition-all duration-300 focus-within:border-stone-600">
            <div className="w-full flex relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search posts"
                className="h-fit w-full bg-transparent py-2 pr-12 focus:outline-none placeholder-stone-400/50 text-stone-900 font-normal"
              />

              <div className="absolute right-0 py-2 text-stone-400">
                {query && (
                  <button
                    onClick={clearSearch}
                    className="hover:text-stone-900 transition-colors opacity-50"
                    type="button"
                  >
                    <X size={24} strokeWidth={1.5} />
                  </button>
                )}
                <button
                  onClick={handleSearch}
                  className="hover:text-stone-900 transition-colors"
                  type="button"
                >
                  <Search size={24} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 mb-6 flex flex-wrap gap-3 items-center">
          <button
            className="btn-outline"
            onClick={() => setIsTopicsModalOpen(true)}
            type="button"
          >
            + Add topic
          </button>

          {Array.from(selectedTopics).map((topic) => (
            <button
              key={topic}
              className="tag-ghost !border-1 !border-[var(--yellow)]"
              onClick={() => toggleTopic(topic)}
              type="button"
            >
              {topic}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-4">
            <button
              className="text-xs font-sans uppercase tracking-[0.15em] hover:text-stone-600 transition-colors text-stone-400"
              onClick={resetFilters}
              type="button"
            >
              Reset Filters
            </button>
            <button className="btn-primary" onClick={handleSearch} type="button">
              Search
            </button>
          </div>
        </div>
      </div>

      {isTopicsModalOpen && (
        <TagSelectModal
          tagState={selectedTopics}
          tagList={topics.map((t) => t.topic_name || t.name || t)}
          onTagToggle={toggleTopic}
          setModalState={setIsTopicsModalOpen}
          title="Select Topics"
        />
      )}

      <div className="space-y-4">
        {isLoading ? (
          <div className="width-full center my-40 text-center text-gray-500">
            Loading posts...
          </div>
        ) : posts.length !== 0 ? (
          posts.map((post) => {
            const meta = metaById[post.id] || {};
            return (
              <PostListEntry
                key={post.id}
                post={post}
                selectedTopics={selectedTopics}
                onTopicToggle={toggleTopic}
                user={user}
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
            No posts found.
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
            onClick={() => navigate("/posts/recommended")}
            disabled={!user}
          >
            Recommended
          </button>

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
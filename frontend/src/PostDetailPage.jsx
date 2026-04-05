import ReactMarkdown from "react-markdown";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  getPost,
  deletePost,
  toggleLikePost,
  getPostMetaBatch,
  getCommentsForPost,
  addCommentToPost,
  editCommentOnPost,
  deleteCommentFromPost,
  createReport,
} from "./Controller";
import ReportDialog from "./ReportDialog";
import {
  MessageSquare,
  Send,
  Eye,
  Edit3,
  Bold,
  Italic,
  Code,
  Link as LinkIcon,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  X,
  Trash2,
  Flag,
} from "lucide-react";

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const CommentEditor = ({
  onSubmit,
  replyingTo,
  onCancelReply,
  initialContent = "",
  submitLabel = "Post Comment",
  compact = false
}) => {
  const [activeTab, setActiveTab] = useState("write");
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const insertText = (syntax) => {
    setContent((prev) => prev + syntax);
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    onSubmit(content, replyingTo ? replyingTo.id : null);
    if (!compact) {
      setContent("");
      setActiveTab("write");
      if (onCancelReply) onCancelReply();
    }
  };

  return (
    <div className={`border border-gray-300 bg-white transition-all focus-within:ring-1 focus-within:ring-black-100 focus-within:border-black-600 ${compact ? "mt-3" : "mt-8"}`}>
      <div className="flex bg-gray-50 border-b border-gray-200 px-2 items-center h-10">
        <button
          className={`flex items-center gap-2 px-3 h-full text-xs uppercase tracking-wide font-semibold transition-colors focus:outline-none ${
            activeTab === "write"
              ? "text-black"
              : "text-gray-500 hover:text-gray-800"
          }`}
          onClick={() => setActiveTab("write")}
        >
          <Edit3 size={12} /> Write
        </button>
        <button
          className={`flex items-center gap-2 px-3 h-full text-xs uppercase tracking-wide font-semibold transition-colors focus:outline-none ${
            activeTab === "preview"
              ? "text-black"
              : "text-gray-500 hover:text-gray-800"
          }`}
          onClick={() => setActiveTab("preview")}
        >
          <Eye size={12} /> Preview
        </button>

        <div className="ml-auto flex gap-0.5">
          <button
            className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-200 rounded"
            onClick={() => insertText("[text](url) ")}
            title="Link"
          >
            <LinkIcon size={12} />
          </button>
          <button
            className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-200 rounded"
            onClick={() => insertText("**bold** ")}
            title="Bold"
          >
            <Bold size={12} />
          </button>
          <button
            className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-200 rounded"
            onClick={() => insertText("*italic* ")}
            title="Italic"
          >
            <Italic size={12} />
          </button>
          <button
            className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-200 rounded"
            onClick={() => insertText("`code` ")}
            title="Code"
          >
            <Code size={12} />
          </button>
        </div>
      </div>

      {replyingTo && (
        <div className="px-3 pt-3 pb-1 flex">
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-100">
            <CornerDownRight size={12} />
            <span className="font-medium">
              Replying to @{replyingTo.userName || "user"}
            </span>
            <button
              onClick={onCancelReply}
              className="hover:text-blue-900"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      <div className="min-h-[120px]">
        {activeTab === "write" ? (
          <textarea
            className="w-full h-32 p-3 font-mono text-sm resize-y outline-none text-gray-800 placeholder:text-gray-300 bg-white"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your comment here..."
          />
        ) : (
          <div className="p-3 min-h-[120px] bg-white text-sm text-gray-800 font-serif leading-relaxed">
            {content ? (
              <ReactMarkdown>{content}</ReactMarkdown>
            ) : (
              <span className="text-gray-300 italic">Nothing to preview</span>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-t border-gray-200">
        <span className="text-[10px] uppercase text-gray-400 font-medium tracking-wider">
          Markdown supported
        </span>
        <button
          className="btn-primary disabled:opacity-50 hover:bg-gray-800 transition-colors"
          onClick={handleSubmit}
          disabled={!content.trim()}
        >
          {submitLabel} <Send size={12} />
        </button>
      </div>
    </div>
  );
};

const unfold_count = (level) => {
  return level.reduce(
    (part_sum, m) => part_sum + unfold_count(m.replies),
    level.length
  );
};

const CommentNode = ({
  comment,
  depth = 0,
  onReply,
  user,
  onEditComment,
  onDeleteComment,
  onReportComment,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const hasReplies = comment.replies && comment.replies.length > 0;
  const indentationClass = depth > 0 ? "ml-4 border-l-2 border-gray-100 pl-4" : "";
  const isOwnComment = user && String(user.id || user.sub) === String(comment.userId);

  const handleSaveEdit = async (text) => {
    await onEditComment(comment.id, text);
    setIsEditing(false);
  };

  return (
    <div className={`group mb-4 ${indentationClass}`}>
      <div className="flex items-baseline gap-2 mb-1 text-xs">
        <Link to={`/profile/${comment.userId}`} className="font-[500] text-[var(--text-secondary)] cursor-pointer">
          {comment.userName}
        </Link>
        <span className="text-gray-400">•</span>
        <span className="text-gray-400 font-mono">{formatDate(comment.date)}</span>
      </div>

      {!isEditing ? (
        <div className="text-sm text-gray-800 font-serif leading-relaxed mb-2">
          <ReactMarkdown>{comment.text}</ReactMarkdown>
        </div>
      ) : (
        <CommentEditor
          onSubmit={handleSaveEdit}
          initialContent={comment.text}
          submitLabel="Save"
          compact
        />
      )}

      <div className="flex items-center gap-4 flex-wrap">
        {!isEditing && (
          <button
            onClick={() => onReply(comment)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
          >
            <MessageSquare size={12} /> Reply
          </button>
        )}

        {isOwnComment && !isEditing && (
          <>
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
            >
              <Edit3 size={12} /> Edit
            </button>

            <button
              onClick={() => onDeleteComment(comment.id)}
              className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-700 transition-colors"
            >
              <Trash2 size={12} /> Delete
            </button>
          </>
        )}

        {!isOwnComment && !isEditing && (
          <button
            onClick={() => onReportComment(comment)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
          >
            <Flag size={12} /> Report
          </button>
        )}

        {isOwnComment && isEditing && (
          <button
            onClick={() => setIsEditing(false)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X size={12} /> Cancel
          </button>
        )}

        {hasReplies && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-black transition-colors bg-gray-100 px-2 py-0.5 rounded-sm"
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {isExpanded ? "Hide" : `Show ${comment.replies.length}`} Replies
          </button>
        )}
      </div>

      {hasReplies && isExpanded && (
        <div className="mt-3">
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              onReply={onReply}
              user={user}
              onEditComment={onEditComment}
              onDeleteComment={onDeleteComment}
              onReportComment={onReportComment}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CommentSection = ({
  comments,
  user,
  onPostComment,
  onEditComment,
  onDeleteComment,
  onReportComment,
}) => {
  const [replyingTo, setReplyingTo] = useState(null);

  const handleEditorSubmit = (text, replyToId) => {
    onPostComment(text, replyToId);
    setReplyingTo(null);
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-4 border-b border-gray-800 pb-2 flex items-baseline justify-between">
        <h3 className="text-lg font-bold text-gray-900 uppercase tracking-tight">
          Discussion
        </h3>
        <span className="text-sm font-mono text-gray-500">
          {comments ? unfold_count(comments) : 0} Contributions
        </span>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="min-w-[300px]">
          {!comments || comments.length === 0 ? (
            <div className="py-8 text-center bg-gray-50 border border-dashed border-gray-300 text-gray-400 font-serif italic">
              No comments yet. Be the first to discuss this post.
            </div>
          ) : (
            comments.map((comment) => (
              <CommentNode
                key={comment.id}
                comment={comment}
                onReply={(target) => setReplyingTo(target)}
                user={user}
                onEditComment={onEditComment}
                onDeleteComment={onDeleteComment}
                onReportComment={onReportComment}
              />
            ))
          )}
        </div>
      </div>

      {user ? (
        <div className="mt-6">
          <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">
            Add your contribution
          </h4>
          <CommentEditor
            onSubmit={handleEditorSubmit}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
          />
        </div>
      ) : (
        <p className="mt-6 text-sm text-gray-500 italic">
          Please log in to participate in the discussion.
        </p>
      )}
    </div>
  );
};

export default function PostDetailPage({ user }) {
  const { postId } = useParams();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [meta, setMeta] = useState({
    liked: false,
    likeCount: 0,
    commentCount: 0,
  });
  const [reportState, setReportState] = useState({
    open: false,
    type: null,
    itemId: null,
    label: "",
  });
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const isOwner =
    post && user && String(user.id || user.sub) === String(post.author);

  useEffect(() => {
    const loadPost = async () => {
      setIsLoading(true);
      try {
        const resp = await getPost(postId);
        const result = resp?.result || resp || null;
        setPost(result);
      } catch (err) {
        console.error("Failed to load post", err);
        setPost(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadPost();
  }, [postId]);

  const refreshCommentsAndMeta = useCallback(async () => {
    const commentsResp = await getCommentsForPost(postId);
    const commentsResult = commentsResp?.result || commentsResp || [];
    setComments(commentsResult);

    const metaResp = await getPostMetaBatch([postId]);
    const metaResult = metaResp?.result || metaResp || {};
    const { likeCounts = [], hasLiked = [], commentCounts = [] } = metaResult;

    setMeta({
      liked: hasLiked[0],
      likeCount: likeCounts[0],
      commentCount: commentCounts[0],
    });
  }, [postId]);

  useEffect(() => {
    refreshCommentsAndMeta();
  }, [refreshCommentsAndMeta]);

  const handleDelete = async () => {
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

      navigate("/posts/all");
    } catch (err) {
      console.error("Failed to delete post", err);
      alert("Failed to delete post.");
    }
  };

  const onTogglePostLike = async () => {
    if (!user) {
      alert("Please log in to like posts.");
      return;
    }

    await toggleLikePost(postId);
    await refreshCommentsAndMeta();
  };

  const handlePostComment = async (text, replyToId) => {
    try {
      await addCommentToPost(postId, text, replyToId);
      await refreshCommentsAndMeta();
    } catch (err) {
      alert("Failed to post comment.");
      console.error(err);
    }
  };

  const handleEditComment = async (commentId, text) => {
    try {
      await editCommentOnPost({ commentId, text });
      await refreshCommentsAndMeta();
    } catch (err) {
      alert("Failed to edit comment.");
      console.error(err);
    }
  };

  const handleDeleteComment = async (commentId) => {
    const confirmed = window.confirm("Delete this comment?");
    if (!confirmed) return;

    try {
      await deleteCommentFromPost({ commentId });
      await refreshCommentsAndMeta();
    } catch (err) {
      alert("Failed to delete comment.");
      console.error(err);
    }
  };

  const openReportDialog = ({ type, itemId, label }) => {
    if (!user) {
      alert("Please log in to submit a report.");
      return;
    }

    setReportState({
      open: true,
      type,
      itemId,
      label,
    });
  };

  const closeReportDialog = () => {
    if (isSubmittingReport) return;

    setReportState({
      open: false,
      type: null,
      itemId: null,
      label: "",
    });
  };

  const handleSubmitReport = async (note) => {
    try {
      setIsSubmittingReport(true);

      await createReport({
        reportedItemType: reportState.type,
        reportedItemId: reportState.itemId,
        reportNote: note,
      });

      alert("Report submitted. Thank you.");
      closeReportDialog();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to submit report.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="text-center text-gray-500 py-20">Loading post...</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="text-center text-gray-500 py-20">Post not found.</div>

        <div className="flex justify-center gap-4 mt-8">
          <button
            type="button"
            className="btn-outline"
            onClick={() => navigate("/posts/all")}
          >
            Browse Posts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          type="button"
          className="btn-outline"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
      </div>

      <div className="card p-6">
        <h1 className="text-3xl font-semibold mb-4">{post.title}</h1>

        {(post.post_topics || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.post_topics.map((topic) => (
              <span key={topic} className="tag-ghost">
                {topic}
              </span>
            ))}
          </div>
        )}

        <div className="text-sm opacity-70 mb-6">
          {post.author_display_name || "Unknown user"}
        </div>

        <div className="flex gap-2 mt-2 mb-6 flex-wrap">
          <button
            type="button"
            className={`btn-outline px-5 py-2 ${meta.liked ? "text-red-600" : ""}`}
            onClick={onTogglePostLike}
          >
            {meta.liked ? "♥" : "♡"} Like {meta.likeCount ?? 0}
          </button>

          <div className="btn-outline px-5 py-2">
            Comments {meta.commentCount ?? 0}
          </div>

          {!isOwner && (
            <button
              type="button"
              className="btn-outline px-5 py-2 flex items-center"
              onClick={() =>
                openReportDialog({
                  type: "post",
                  itemId: post.id,
                  label: "post",
                })
              }
            >
              <Flag size={14} />
              <span className="ml-2">Report</span>
            </button>
          )}
        </div>

        {post.short_text?.trim() && (
          <div className="mb-6">
            <div className="text-sm font-medium opacity-70 mb-2">Summary</div>
            <p className="text-base leading-7 whitespace-pre-wrap opacity-90">
              {post.short_text}
            </p>
          </div>
        )}

        <div>
          <div className="text-sm font-medium opacity-70 mb-2">Post</div>
          <p className="text-base leading-7 whitespace-pre-wrap">
            {post.text}
          </p>
        </div>

        {isOwner && (
          <div className="flex gap-3 mt-8">
            <button
              type="button"
              className="btn-outline"
              onClick={() => navigate(`/posts/${post.id}/edit`)}
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

      <CommentSection
        comments={comments}
        user={user}
        onPostComment={handlePostComment}
        onEditComment={handleEditComment}
        onDeleteComment={handleDeleteComment}
        onReportComment={(comment) =>
          openReportDialog({
            type: "post_comment",
            itemId: comment.id,
            label: "comment",
          })
        }
      />

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
          onClick={() => navigate("/posts/all")}
        >
          Browse Posts
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
          + Create New Post
        </button>
      </div>

      <ReportDialog
        isOpen={reportState.open}
        onClose={closeReportDialog}
        onSubmit={handleSubmitReport}
        title="Report post"
        subjectLabel={reportState.label || "item"}
        loading={isSubmittingReport}
      />
    </div>
  );
}
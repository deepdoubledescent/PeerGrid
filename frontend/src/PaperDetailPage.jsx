import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import {
  addCommentToPaper,
  getCommentsForPaper,
  toggleLikePaper,
  getPaperMetaBatch,
  editComment,
  deleteComment
} from "./Controller";
import { getPaperById } from "./papersApi";
import {
  MessageSquare,
  ExternalLink,
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
  Trash2
} from 'lucide-react';

const reconstructAbstract = (invertedIndex) => {
  if (!invertedIndex) return "No abstract available.";
  const maxIndex = Math.max(...Object.values(invertedIndex).flat());
  const words = new Array(maxIndex + 1);
  Object.entries(invertedIndex).forEach(([word, positions]) => {
    positions.forEach(pos => words[pos] = word);
  });
  return words.join(" ");
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const extractPaperTopics = (paper) => {
  return (paper?.topics || [])
    .map((topic) => ({
      topic_id: Number(String(topic.id || "").match(/\d+/)?.[0]),
      score: Number(topic.score) || 0,
    }))
    .filter((topic) => Number.isFinite(topic.topic_id) && topic.score > 0);
};

const CommentEditor = ({
  onSubmit,
  replyingTo,
  onCancelReply,
  initialContent = "",
  submitLabel = "Post Comment",
  compact = false
}) => {
  const [activeTab, setActiveTab] = useState('write');
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const insertText = (syntax) => {
    setContent(prev => prev + syntax);
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    onSubmit(content, replyingTo ? replyingTo.id : null);
    if (!compact) {
      setContent('');
      setActiveTab('write');
      if (onCancelReply) onCancelReply();
    }
  };

  return (
    <div className={`border border-gray-300 bg-white transition-all focus-within:ring-1 focus-within:ring-black-100 focus-within:border-black-600 ${compact ? "mt-3" : "mt-8"}`}>
      <div className="flex bg-gray-50 border-b border-gray-200 px-2 items-center h-10">
        <button
          className={`flex items-center gap-2 px-3 h-full text-xs uppercase tracking-wide font-semibold transition-colors focus:outline-none ${
            activeTab === 'write' ? 'text-black' : 'text-gray-500 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('write')}
        >
          <Edit3 size={12} /> Write
        </button>
        <button
          className={`flex items-center gap-2 px-3 h-full text-xs uppercase tracking-wide font-semibold transition-colors focus:outline-none ${
            activeTab === 'preview' ? 'text-black' : 'text-gray-500 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('preview')}
        >
          <Eye size={12} /> Preview
        </button>

        <div className="ml-auto flex gap-0.5">
          <button className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-200 rounded" onClick={() => insertText('[text](url) ')} title="Link"><LinkIcon size={12} /></button>
          <button className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-200 rounded" onClick={() => insertText('**bold** ')} title="Bold"><Bold size={12} /></button>
          <button className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-200 rounded" onClick={() => insertText('*italic* ')} title="Italic"><Italic size={12} /></button>
          <button className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-200 rounded" onClick={() => insertText('`code` ')} title="Code"><Code size={12} /></button>
          <button className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-200 rounded font-serif font-bold w-6" onClick={() => insertText('$E=mc^2$ ')} title="Equation">Σ</button>
        </div>
      </div>

      {replyingTo && (
        <div className="px-3 pt-3 pb-1 flex">
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-100">
            <CornerDownRight size={12} />
            <span className="font-medium">Replying to @{replyingTo.userName || 'user'}</span>
            <button onClick={onCancelReply} className="hover:text-blue-900"><X size={12} /></button>
          </div>
        </div>
      )}

      <div className="min-h-[120px]">
        {activeTab === 'write' ? (
          <textarea
            className="w-full h-32 p-3 font-mono text-sm resize-y outline-none text-gray-800 placeholder:text-gray-300 bg-white"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your comment here..."
          />
        ) : (
          <div className="p-3 min-h-[120px] bg-white text-sm text-gray-800 font-serif leading-relaxed">
            {content ? <ReactMarkdown children={content} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} /> : <span className="text-gray-300 italic">Nothing to preview</span>}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-t border-gray-200">
        <span className="text-[10px] uppercase text-gray-400 font-medium tracking-wider">
          Markdown + LaTeX supported
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
  return level.reduce((part_sum, m) => part_sum + unfold_count(m.replies), level.length);
};

const CommentNode = ({ comment, depth = 0, onReply, user, onEditComment, onDeleteComment }) => {
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
          <ReactMarkdown
            children={comment.text}
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              p: ({ node, ...props }) => <p className="mb-2" {...props} />
            }}
          />
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
            {isExpanded ? 'Hide' : `Show ${comment.replies.length}`} Replies
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
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CommentSection = ({ comments, user, onPostComment, onEditComment, onDeleteComment }) => {
  const [replyingTo, setReplyingTo] = useState(null);

  const handleEditorSubmit = (text, replyToId) => {
    onPostComment(text, replyToId);
    setReplyingTo(null);
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-4 border-b border-gray-800 pb-2 flex items-baseline justify-between">
        <h3 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Discussion</h3>
        <span className="text-sm font-mono text-gray-500">{comments ? unfold_count(comments) : 0} Contributions</span>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="min-w-[300px]">
          {!comments || comments.length === 0 ? (
            <div className="py-8 text-center bg-gray-50 border border-dashed border-gray-300 text-gray-400 font-serif italic">
              No comments yet. Be the first to discuss this paper.
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
              />
            ))
          )}
        </div>
      </div>

      {user ? (
        <div className="mt-6">
          <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">Add your contribution</h4>
          <CommentEditor
            onSubmit={handleEditorSubmit}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
          />
        </div>
      ) : (
        <p className="mt-6 text-sm text-gray-500 italic">Please log in to participate in the discussion.</p>
      )}
    </div>
  );
};

export default function PaperDetailPage({ user }) {
  const { paperId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(!paper);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState(null);
  const [isPosting, setIsPosting] = useState(false);

  const [meta, setMeta] = useState({
    liked: false,
    likeCount: 0,
    commentCount: 0,
  });
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    const hasLocationData = location.state?.paper_object;

    if (hasLocationData?.id.split("/").filter(Boolean).pop() == paperId) {
      setPaper(hasLocationData);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const fetchedPaper = await getPaperById(paperId);
        setPaper(fetchedPaper);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [paperId, location.state]);

  const fetchComments = useCallback(async () => {
    try {
      const data = await getCommentsForPaper(paperId);
      return data;
    } catch (err) {
      console.error(err);
      setError(err.message);
      return null;
    }
  }, [paperId]);

  const refreshCommentsAndMeta = useCallback(async () => {
    const newComments = await fetchComments();
    if (newComments) setComments(newComments);

    const { likeCounts, hasLiked, commentCounts } = await getPaperMetaBatch([paperId]);
    setMeta({
      liked: hasLiked[0],
      likeCount: likeCounts[0],
      commentCount: commentCounts[0],
    });
  }, [fetchComments, paperId]);

  useEffect(() => {
    let ignore = false;

    const init = async () => {
      const data = await fetchComments();
      if (!ignore && data) {
        setComments(data);
      }
    };

    init();

    return () => { ignore = true; };
  }, [fetchComments]);

  useEffect(() => {
    const syncMetadata = async () => {
      if (!paperId) return;

      try {
        const { likeCounts, hasLiked, commentCounts } = await getPaperMetaBatch([paperId]);

        setMeta({
          liked: hasLiked[0],
          likeCount: likeCounts[0],
          commentCount: commentCounts[0],
        });
      } catch (err) {
        console.error("Failed to fetch paper metadata", err);
      }
    };

    syncMetadata();
  }, [paperId, user]);

  const handlePostComment = async (text, replyToId) => {
    setIsPosting(true);
    try {
      await addCommentToPaper(paperId, text, user, replyToId);
      await refreshCommentsAndMeta();
    } catch (err) {
      alert("Failed to post " + err.message);
    } finally {
      setIsPosting(false);
    }
  };

  const handleEditComment = async (commentId, text) => {
    try {
      await editComment({ comment_id: commentId, text });
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
      await deleteComment({ comment_id: commentId });
      await refreshCommentsAndMeta();
    } catch (err) {
      alert("Failed to delete comment.");
      console.error(err);
    }
  };

  const onTogglePaperLike = async (workId) => {
    setStatus({ type: "", message: "" });

    if (!user) {
      setStatus({ type: "error", message: "Please log in to like papers." });
      return;
    }

    await toggleLikePaper(workId, extractPaperTopics(paper));

    const { likeCounts, hasLiked, commentCounts } = await getPaperMetaBatch([workId]);

    setMeta({
      liked: hasLiked[0],
      likeCount: likeCounts[0],
      commentCount: commentCounts[0],
    });
  };

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mt-6">Loading...</div>
      </div>
    );
  } else if (!paper) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mt-6">Not found.</div>
      </div>
    );
  } else {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <header className="mt-4">
          <h1 className="text-3xl font-semibold leading-tight">
            {paper.title}
          </h1>

          <div className="mt-2 flex flex-col gap-1 text-sm">
            <div className="text-gray-600 italic">
              {paper.publication_year} • {paper.primary_location?.source?.display_name || "Preprint / Unknown"}
            </div>
            <div className="text-gray-500">
              {(paper.authorships || [])
                .slice(0, 2)
                .map((a) => a.author.display_name)
                .join(", ")} {paper.authorships?.length > 2 && " et al."}
            </div>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              className="btn-outline"
              onClick={() => window.open(
                paper.doi ? `https://doi.org/${paper.doi}` : paper.id,
                '_blank'
              )}
            >
              Read Paper <ExternalLink size={14} />
            </button>

            <button
              type="button"
              className={`btn-outline px-5 py-2 ${meta.liked ? "text-red-600" : ""}`}
              aria-label="Like paper"
              onClick={() => onTogglePaperLike(paperId)}
            >
              {meta.liked ? "♥" : "♡"} Like {meta.likeCount ?? 0}
            </button>
          </div>
        </header>

        <section className="mt-6">
          <h3 className="text-lg font-bold border-b border-gray-800 pb-2 text-gray-900 uppercase tracking-tight">Abstract</h3>
          <p className="mt-2 text-lg leading-relaxed text-gray-800">
            {reconstructAbstract(paper.abstract_inverted_index)}
          </p>
        </section>

        <CommentSection
          comments={comments}
          user={user}
          onPostComment={handlePostComment}
          onEditComment={handleEditComment}
          onDeleteComment={handleDeleteComment}
        />

        {status.message && (
          <div className={`mt-4 ${status.type === "error" ? "text-red-500" : "text-green-600"}`}>
            {status.message}
          </div>
        )}
      </div>
    );
  }
}
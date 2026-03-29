import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getPost, updatePost, getPostTopics } from "./Controller";

const normalizeTopicLabel = (value) =>
  String(value || "").trim().replace(/\s+/g, " ");

function CreatableTagInput({
  label,
  placeholder,
  selectedItems,
  suggestions,
  inputValue,
  onInputChange,
  onAddItem,
  onRemoveItem,
  disabled,
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const normalizedSelected = selectedItems.map((item) => item.toLowerCase());
  const filteredSuggestions = suggestions
    .filter(Boolean)
    .filter((item) =>
      item.toLowerCase().includes(inputValue.trim().toLowerCase())
    )
    .filter((item) => !normalizedSelected.includes(item.toLowerCase()))
    .slice(0, 8);

  const commitValue = (value) => {
    const cleaned = normalizeTopicLabel(value);
    if (!cleaned) return;
    onAddItem(cleaned);
    onInputChange("");
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitValue(inputValue);
    } else if (
      e.key === "Backspace" &&
      !inputValue &&
      selectedItems.length > 0
    ) {
      onRemoveItem(selectedItems[selectedItems.length - 1]);
    }
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-2">{label}</label>

      <div className="min-h-[46px] w-full border border-stone-300 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {selectedItems.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-2 tag-ghost !border-1 !border-[var(--yellow)]"
            >
              {item}
              <button
                type="button"
                className="text-stone-500 hover:text-stone-800"
                onClick={() => onRemoveItem(item)}
                disabled={disabled}
              >
                ✕
              </button>
            </span>
          ))}

          <input
            className="min-w-[180px] flex-1 border-0 p-0 outline-none focus:outline-none"
            value={inputValue}
            onChange={(e) => {
              onInputChange(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 150);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedItems.length === 0
                ? placeholder
                : "Add another and press Enter"
            }
            disabled={disabled}
          />
        </div>
      </div>

      <div className="mt-1 text-xs text-stone-400">
        Pick an existing value from the list or type a new one and press Enter.
      </div>

      {showSuggestions &&
        (filteredSuggestions.length > 0 || inputValue.trim()) && (
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto border border-stone-200 bg-white shadow-lg">
            {filteredSuggestions.map((item) => (
              <li
                key={item}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commitValue(item)}
                className="cursor-pointer border-b border-stone-100 px-3 py-2 text-stone-700 hover:bg-stone-100 last:border-0"
              >
                {item}
              </li>
            ))}

            {inputValue.trim() &&
              !filteredSuggestions.some(
                (item) => item.toLowerCase() === inputValue.trim().toLowerCase()
              ) &&
              !normalizedSelected.includes(inputValue.trim().toLowerCase()) && (
                <li
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commitValue(inputValue)}
                  className="cursor-pointer px-3 py-2 text-stone-700 hover:bg-stone-100"
                >
                  Add “{inputValue.trim()}”
                </li>
              )}
          </ul>
        )}
    </div>
  );
}

export default function EditPostPage({ user }) {
  const navigate = useNavigate();
  const { postId } = useParams();

  const [title, setTitle] = useState("");
  const [shortText, setShortText] = useState("");
  const [text, setText] = useState("");
  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [topicInput, setTopicInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);

      try {
        const [topicsResp, postResp] = await Promise.all([
          getPostTopics(),
          getPost(postId),
        ]);

        const topicsData = topicsResp?.result || topicsResp || [];
        const normalizedTopics = topicsData
          .map((t) => normalizeTopicLabel(t.topic_name || t.name || t))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));

        const postData = postResp?.result || postResp;

        if (!postData) {
          alert("Post not found.");
          navigate("/posts");
          return;
        }

        const currentUserId = user?.id || user?.sub;
        if (String(currentUserId) !== String(postData.author)) {
          alert("You do not have permission to edit this post.");
          navigate("/posts");
          return;
        }

        const initialSelectedTopics = (postData.post_topics || [])
          .map((topic) => normalizeTopicLabel(topic))
          .filter(Boolean);

        setTitle(postData.title || "");
        setShortText(postData.short_text || "");
        setText(postData.text || "");
        setSelectedTopics(initialSelectedTopics);

        const mergedTopics = Array.from(
          new Set([...normalizedTopics, ...initialSelectedTopics])
        ).sort((a, b) => a.localeCompare(b));
        setTopics(mergedTopics);
      } catch (err) {
        console.error("Failed to load post for editing", err);
        alert("Failed to load post.");
        navigate("/posts");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [postId, user, navigate]);

  const addTopic = (value) => {
    const cleaned = normalizeTopicLabel(value);
    if (!cleaned) return;

    const existing =
      topics.find((topic) => topic.toLowerCase() === cleaned.toLowerCase()) ||
      cleaned;

    if (!topics.some((topic) => topic.toLowerCase() === cleaned.toLowerCase())) {
      setTopics((prev) => [...prev, cleaned].sort((a, b) => a.localeCompare(b)));
    }

    setSelectedTopics((prev) =>
      prev.some((topic) => topic.toLowerCase() === existing.toLowerCase())
        ? prev
        : [...prev, existing]
    );
  };

  const removeTopic = (value) => {
    setSelectedTopics((prev) =>
      prev.filter((topic) => topic.toLowerCase() !== value.toLowerCase())
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      alert("Title is required.");
      return;
    }

    if (!text.trim()) {
      alert("Text is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      await updatePost(postId, {
        title: title.trim(),
        short_text: shortText.trim(),
        text: text.trim(),
        post_topics: selectedTopics,
      });

      navigate("/posts/all");
    } catch (err) {
      console.error("Failed to update post", err);
      alert("Failed to update post.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="text-center text-gray-500 py-20">Loading post...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold mb-8">Edit Post</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-stone-300 px-4 py-3 focus:outline-none"
            placeholder="Enter post title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Short text (optional)
          </label>
          <textarea
            value={shortText}
            onChange={(e) => setShortText(e.target.value)}
            className="w-full border border-stone-300 px-4 py-3 min-h-[100px] focus:outline-none"
            placeholder="Optional short summary shown in lists"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full border border-stone-300 px-4 py-3 min-h-[220px] focus:outline-none"
            placeholder="Write your full post here"
          />
        </div>

        <CreatableTagInput
          label="Topics"
          placeholder="Select or add topics"
          selectedItems={selectedTopics}
          suggestions={topics}
          inputValue={topicInput}
          onInputChange={setTopicInput}
          onAddItem={addTopic}
          onRemoveItem={removeTopic}
          disabled={isSubmitting}
        />

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            className="btn-outline"
            onClick={() => navigate("/posts/all")}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

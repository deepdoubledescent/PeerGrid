import { useEffect, useState } from "react";

export default function ReportDialog({
  isOpen,
  onClose,
  onSubmit,
  title = "Report content",
  subjectLabel = "item",
  loading = false,
}) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!isOpen) setNote("");
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const trimmed = note.trim();
    if (!trimmed) {
      alert("Please describe the issue.");
      return;
    }

    await onSubmit(trimmed);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#fff",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
        }}
      >
        <h3 className="text-xl font-semibold mb-2">{title}</h3>

        <p className="text-sm text-gray-600 mb-4">
          Describe the issue with this {subjectLabel}.
        </p>

        <textarea
          className="w-full border rounded-xl p-3 min-h-[140px] outline-none"
          placeholder={`Describe the issue with this ${subjectLabel}...`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          disabled={loading}
        />

        <div className="mt-2 text-xs text-gray-500">{note.length}/2000</div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            className="btn-outline px-4 py-2"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn-primary px-4 py-2"
            onClick={handleSubmit}
            disabled={loading || !note.trim()}
          >
            {loading ? "Submitting..." : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}
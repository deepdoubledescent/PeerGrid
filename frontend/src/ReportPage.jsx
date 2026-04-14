import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Flag, Info, Send } from "lucide-react";
import { createReport } from "./Controller";

const REPORT_TYPE_OPTIONS = [
  {
    value: "project",
    label: "Project",
    helper: "Use this for project listings, applications, project details, or project-related misconduct.",
  },
  {
    value: "post",
    label: "Post",
    helper: "Use this for feed posts, comments, spam, misleading posts, or abusive discussions.",
  },
  {
    value: "paper",
    label: "Paper",
    helper: "Use this for paper pages, paper discussions, metadata issues, or paper-related abuse.",
  },
  {
    value: "event",
    label: "Event",
    helper: "Use this for event listings, registrations, inappropriate event details, or organizer issues.",
  },
  {
    value: "user",
    label: "User",
    helper: "Use this for user profiles, impersonation, harassment, or suspicious accounts.",
  },
  {
    value: "other",
    label: "Other / General",
    helper: "Use this when there is no report button or when the issue does not fit a single item page.",
  },
];

const REASON_OPTIONS = [
  "Spam or scam",
  "Harassment or abusive behavior",
  "Inappropriate or unsafe content",
  "False or misleading information",
  "Impersonation or suspicious account",
  "Bug or technical issue",
  "Copyright or ownership concern",
  "Other",
];

function extractIdFromUrl(url, selectedType) {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);

    const routeToType = {
      projects: "project",
      posts: "post",
      papers: "paper",
      events: "event",
      profile: "user",
      people: "user",
    };

    const knownIndex = pathParts.findIndex((part) => routeToType[part]);
    if (knownIndex === -1) return "";

    const detectedType = routeToType[pathParts[knownIndex]];
    if (selectedType !== "other" && detectedType !== selectedType) {
      return "";
    }

    const idCandidate = pathParts[knownIndex + 1];
    if (!idCandidate) return "";

    const blockedSegments = new Set([
      "new",
      "all",
      "recommended",
      "edit",
      "feed",
      "search",
      "network",
      "connections",
      "following",
      "my",
      "registered",
      "applicants",
    ]);

    if (blockedSegments.has(idCandidate)) return "";

    return idCandidate;
  } catch {
    return "";
  }
}

export default function ReportPage({ user }) {
  const navigate = useNavigate();

  const [reportType, setReportType] = useState("other");
  const [reason, setReason] = useState("");
  const [reportedItemId, setReportedItemId] = useState("");
  const [itemLink, setItemLink] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [contactEmail, setContactEmail] = useState(user?.email || "");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTypeMeta = useMemo(() => {
    return REPORT_TYPE_OPTIONS.find((item) => item.value === reportType) || REPORT_TYPE_OPTIONS[0];
  }, [reportType]);

  const inferredId = useMemo(() => {
    return extractIdFromUrl(itemLink.trim(), reportType);
  }, [itemLink, reportType]);

  const effectiveReportedItemId = String(reportedItemId || inferredId || "").trim();

  const previewPayload = useMemo(() => {
    const detailLines = [];

    if (reason) detailLines.push(`Reason: ${reason}`);
    if (itemLink.trim()) detailLines.push(`Link: ${itemLink.trim()}`);
    if (contactEmail.trim()) detailLines.push(`Contact email: ${contactEmail.trim()}`);

    if (reportNote.trim()) {
      detailLines.push("", reportNote.trim());
    }

    return detailLines.join("\n").trim();
  }, [reason, itemLink, contactEmail, reportNote]);

  const validate = () => {
    if (!user) {
      return "Please login before submitting a report.";
    }

    if (!reportType) {
      return "Please choose what you want to report.";
    }

    if (!reportNote.trim()) {
      return "Please describe the issue.";
    }

    if (reportNote.trim().length < 12) {
      return "Please add a bit more detail so the report can be reviewed properly.";
    }

    if (reportType !== "other" && !effectiveReportedItemId && !itemLink.trim()) {
      return "Please provide an item ID or paste a link to the item you want to report.";
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationMessage = validate();
    if (validationMessage) {
      setStatus({ type: "error", message: validationMessage });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus({ type: "", message: "" });

      await createReport({
        reportedItemType: reportType,
        reportedItemId: effectiveReportedItemId || null,
        reportNote: previewPayload,
      });

      setStatus({
        type: "success",
        message: "Your report has been submitted. Thank you for helping keep the platform safe.",
      });

      setReason("");
      setReportedItemId("");
      setItemLink("");
      setReportNote("");
    } catch (err) {
      console.error(err);
      setStatus({
        type: "error",
        message: err?.message || "Failed to submit report. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mt-4">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-stone-700">
            <Flag size={22} />
          </div>
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Report An Issue</h1>
            <p className="mt-3 text-stone-600 max-w-2xl leading-relaxed">
              If you find something that should be reviewed and it does not have a report button,
              you can use this page to send it to the moderation team.
            </p>
          </div>
        </div>
      </header>

      {!user && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 flex items-start gap-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">You need to be signed in to submit a report.</div>
            <div className="mt-1 text-sm">
              Please <Link to="/" className="underline">sign in</Link> and come back to this page.
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_320px] gap-6">
        <form onSubmit={handleSubmit} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs uppercase tracking-widest text-stone-500 mb-2">
                What are you reporting?
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:outline-none focus:border-stone-800"
              >
                {REPORT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-stone-500 leading-relaxed">{selectedTypeMeta.helper}</p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-stone-500 mb-2">
                Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:outline-none focus:border-stone-800"
              >
                <option value="">Select a reason</option>
                {REASON_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs uppercase tracking-widest text-stone-500 mb-2">
                Item ID
              </label>
              <input
                type="text"
                value={reportedItemId}
                onChange={(e) => setReportedItemId(e.target.value)}
                placeholder={reportType === "other" ? "Optional" : "Paste the item ID if you know it"}
                className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-800"
              />
              <p className="mt-2 text-sm text-stone-500">
                {reportType === "other"
                  ? "You can leave this empty for general reports."
                  : "If you paste a direct link below, the page can often infer the ID automatically."}
              </p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-stone-500 mb-2">
                Item link
              </label>
              <input
                type="url"
                value={itemLink}
                onChange={(e) => setItemLink(e.target.value)}
                placeholder="Paste a link to the item, if available"
                className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-800"
              />
              <div className="mt-2 min-h-[1.25rem] text-sm">
                {inferredId ? (
                  <span className="text-stone-600">Detected item ID from link: <span className="font-medium">{inferredId}</span></span>
                ) : (
                  <span className="text-stone-400">Optional, but helpful for moderators.</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-2">
              Your description
            </label>
            <textarea
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
              placeholder="Describe what happened, why it should be reviewed, and anything else that would help moderators understand the issue."
              rows={8}
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-800 resize-y"
            />
            <div className="mt-2 flex items-center justify-between gap-4 text-sm">
              <span className="text-stone-500">Be specific: what happened, where it happened, and why it matters.</span>
              <span className={`${reportNote.trim().length < 12 ? "text-amber-600" : "text-stone-400"}`}>
                {reportNote.trim().length} characters
              </span>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-2">
              Contact email
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-800"
            />
            <p className="mt-2 text-sm text-stone-500">
              Optional. Include this if you want moderators to be able to follow up.
            </p>
          </div>

          {status.message && (
            <div
              className={`mt-6 rounded-2xl border px-4 py-3 flex items-start gap-3 ${
                status.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {status.type === "success" ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              ) : (
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
              )}
              <div>{status.message}</div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className="btn-outline px-5 py-2"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>

            <button
              type="submit"
              className={`btn-primary px-6 py-2 flex items-center gap-2 ${
                isSubmitting ? "opacity-60 cursor-not-allowed" : ""
              }`}
              disabled={isSubmitting || !user}
            >
              <Send size={16} />
              <span>{isSubmitting ? "Submitting..." : "Submit report"}</span>
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
            <div className="flex items-center gap-2 text-stone-900 font-medium">
              <Info size={16} />
              <span>When to use this page</span>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-stone-600 leading-relaxed list-disc pl-5">
              <li>There is no report button on the page you are looking at.</li>
              <li>You want to report a broader issue that affects more than one item.</li>
              <li>You only have a link or an ID and still want moderators to review it.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-5">
            <div className="font-medium text-stone-900">What gets sent</div>
            <div className="mt-3 space-y-2 text-sm text-stone-600">
              <div><span className="font-medium text-stone-800">Type:</span> {reportType}</div>
              <div><span className="font-medium text-stone-800">Item ID:</span> {effectiveReportedItemId || "—"}</div>
              <div><span className="font-medium text-stone-800">Reason:</span> {reason || "—"}</div>
            </div>

            <div className="mt-4 rounded-2xl bg-stone-50 border border-stone-200 p-3 text-sm text-stone-700 whitespace-pre-wrap break-words min-h-[120px]">
              {previewPayload || "Your report details will be previewed here."}
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-5">
            <div className="font-medium text-stone-900">Helpful examples</div>
            <div className="mt-4 space-y-3 text-sm text-stone-600 leading-relaxed">
              <div>
                <div className="font-medium text-stone-800">Example 1</div>
                <div>
                  “This post appears to be spam. It links to unrelated commercial content and was posted repeatedly.”
                </div>
              </div>
              <div>
                <div className="font-medium text-stone-800">Example 2</div>
                <div>
                  “This user profile seems to impersonate another researcher. The name and institute do not match the linked material.”
                </div>
              </div>
              <div>
                <div className="font-medium text-stone-800">Example 3</div>
                <div>
                  “The event page contains abusive language in the description and should be reviewed.”
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

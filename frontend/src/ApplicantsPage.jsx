import { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { 
  getApplicantsForProject, 
  getDocumentDownloadURL, 
  updateApplicationStatus 
} from "./Controller";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

export default function ApplicantsPage({ user }) {
  const { projectId } = useParams();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  
  const [confirming, setConfirming] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        setLoading(true);
        if (!user) {
          setError("Please login.");
          return;
        }
        const res = await getApplicantsForProject(projectId);
        setRows(Array.isArray(res) ? res : []);
      } catch (e) {
        setError(e?.message || "Failed to load applicants.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, projectId]);

  /** * Sorts applicants so the newest 'createdAt' is first.
   */
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA; // Reverse chronological order
    });
  }, [rows]);

  const handleConfirmAction = async () => {
    if (!confirming) return;
    setIsUpdating(true);
    try {
      await updateApplicationStatus(confirming.id, confirming.status);
      // Update local state to reflect the new persistent status
      setRows(prev => prev.map(r => 
        r.applicationId === confirming.id ? { ...r, status: confirming.status } : r
      ));
      setConfirming(null);
    } catch (err) {
      alert("Failed to update status.");
    } finally {
      setIsUpdating(false);
    }
  };

  const triggerDownload = async (docId) => {
    try {
      const res = await getDocumentDownloadURL(docId);
      window.location.assign(res.url);
    } catch (err) {
      alert("Download failed.");
    }
  };

  if (loading && !error) return <div className="p-6 max-w-3xl mx-auto opacity-50">Loading...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">Applicants</h1>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      {!error && sortedRows.length === 0 && (
        <div className="mt-4 text-sm opacity-70">No applicants yet.</div>
      )}

      <ul className="mt-6 space-y-4">
        {sortedRows.map((row) => {
          const a = row.applicant;
          const docs = Array.isArray(row.documents) ? row.documents : [];

          return (
            <li key={row.applicationId} className="p-4 rounded-xl border bg-white shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link className="text-blue-600 font-medium hover:underline" to={`/profile/${a.id}`}>
                      {a.name}
                    </Link>
                    {row.status && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight ${
                        row.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {row.status}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    {a.institute} — {a.country}
                  </div>
                  <div className="mt-1 text-xs opacity-60">
                    Applied: {formatDateTime(row.createdAt)}
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button 
                    disabled={row.status === 'rejected'}
                    onClick={() => setConfirming({ id: row.applicationId, status: 'rejected', name: a.name })}
                    className={`text-xs font-semibold px-2 py-1 border rounded transition-colors ${
                      row.status === 'rejected' 
                      ? 'bg-red-50 text-red-400 border-red-100 cursor-default' 
                      : 'text-gray-400 hover:text-red-600 hover:border-red-100'
                    }`}
                  >
                    Reject
                  </button>
                  <button 
                    disabled={row.status === 'accepted'}
                    onClick={() => setConfirming({ id: row.applicationId, status: 'accepted', name: a.name })}
                    className={`text-xs font-semibold px-2 py-1 border rounded transition-colors ${
                      row.status === 'accepted' 
                      ? 'bg-green-50 text-green-700 border-green-100 cursor-default' 
                      : 'bg-gray-50 text-gray-600 hover:bg-blue-600 hover:text-white hover:border-blue-600'
                    }`}
                  >
                    Accept
                  </button>
                </div>
              </div>

              {docs.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Documents ({docs.length})</div>
                  <ul className="space-y-2">
                    {docs.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/30 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm">
                            <span className="font-medium text-gray-700">{d.label}</span>
                            {d.required && (
                              <span className="ml-2 text-[9px] text-red-500 font-bold uppercase">Required</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 truncate">
                            {d.name} • {formatBytes(d.size)}
                          </div>
                        </div>

                        <button 
                          onClick={() => triggerDownload(d.project_application_document_id)}
                          className="text-blue-500 hover:text-blue-700 p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Confirmation Modal */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-[1px]">
          <div className="bg-white rounded-xl shadow-2xl max-w-xs w-full p-6 border animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold capitalize">{confirming.status} applicant?</h3>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Change status for <strong>{confirming.name}</strong> to <span className="font-semibold">{confirming.status}</span>?
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                disabled={isUpdating}
                onClick={handleConfirmAction}
                className={`w-full py-2.5 rounded-lg font-bold text-white shadow-sm transition-all ${
                  confirming.status === 'accepted' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                } ${isUpdating ? 'opacity-50' : ''}`}
              >
                {isUpdating ? 'Saving...' : `Yes, ${confirming.status}`}
              </button>
              <button 
                onClick={() => setConfirming(null)} 
                className="text-sm text-gray-400 py-2 hover:text-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
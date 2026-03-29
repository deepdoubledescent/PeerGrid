import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  deleteProject, 
  getProject, 
  applyToProject, 
  hasUserAppliedToProject, 
  toggleLikeProject, 
  hasUserLikedProject, 
  getLikeCountForProject,
  getUploadURL,
  getDocumentDownloadURL,
  updateProject
} from "./Controller";

export default function ProjectDetailPage({ user }) {
  const { projectId } = useParams();
  const navigate = useNavigate();

  // apply button state
  const [applyState, setApplyState] = useState("idle");
  const [applyError, setApplyError] = useState("");
  const [isUploading, setIsUploading] = useState(false); // <-- NEW: Block apply while uploading

  // file states now store metadata objects containing the application_document_id
  const [docFilesById, setDocFilesById] = useState({}); 
  const [additionalFiles, setAdditionalFiles] = useState([]);
  const [additionalInputKey, setAdditionalInputKey] = useState(0);

  // like button states
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeError, setLikeError] = useState("");
  const [project, setProject] = useState(null);

  useEffect(() => {
    const initial_project_load = async () => {
      const rec_proj = await getProject(projectId);

      if (!rec_proj) {
        return (
          <div className="p-6 max-w-3xl mx-auto">
            <div className="mt-6">Not found.</div>
          </div>
        );
      } else {
        setProject(rec_proj);
      }
    };
    console.log("triggering initial load");
    initial_project_load();
  }, [projectId]);

  useEffect(() => {
    const checkApplied = async () => {
      if (!user || !project) {
        return;
      }

      const alreadyApplied = await hasUserAppliedToProject(project.id);

      if (alreadyApplied) {
        setApplyState("success");
      }
    };

    checkApplied();
  }, [user, project]);
  

  const requiredDocs = project?.requiredDocuments ?? [];

  const missingRequiredDocs = requiredDocs
    .filter((d) => d?.required)
    .filter((d) => !docFilesById?.[d.id]);

  const canApply = missingRequiredDocs.length === 0 && !isUploading;

  const onDelete = async() => {
    const status = await deleteProject(projectId);
    if (status.success) {
      navigate("/projects");
    } else {
      alert("Error Deleting project: ", status);
    }
  }

  // --- NEW: Helper to handle immediate uploads to S3 ---
  const handleImmediateUpload = async (file, documentId) => {
    try {
      const { url, application_document_id } = await getUploadURL(file.name, file.type, file.size, documentId);

      console.log(url, application_document_id)
      
      const uploadRes = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      console.log(uploadRes);

      if (!uploadRes.ok) throw new Error("S3 Upload Failed");

      return application_document_id;
    } catch (err) {
      console.error("Error during upload", err);
      throw err;
    }
  };

  // --- NEW: Helper to handle downloading an uploaded file ---
  const handleDownload = async (application_document_id) => {
    try {
      // Assuming getDocumentDownloadURL returns { downloadUrl: "https://..." }
      const res = await getDocumentDownloadURL(application_document_id);
      window.open(res.url || res, "_blank"); 
    } catch (err) {
      alert("Failed to get download link");
    }
  };

  const onApply = async () => {
    if (!user) {
      setApplyState("error");
      setApplyError("Please login before applying.");
      return;
    }

    if (!canApply) {
      setApplyState("error");
      const missingNames = missingRequiredDocs
        .map((d) => d?.label || d?.id)
        .filter(Boolean);
      setApplyError(
        missingNames.length
          ? `Please upload: ${missingNames.join(", ")}.`
          : "Please upload the required documents before applying."
      );
      return;
    }

    try {
      setApplyState("loading");
      setApplyError("");

      const documents = [];

      for (const d of requiredDocs) {
        const fileData = docFilesById?.[d.id];
        if (!fileData) continue;

        documents.push(fileData.application_document_id);
      }

      additionalFiles.forEach((fileData, index) => {
        documents.push(fileData.application_document_id);
      });

      await applyToProject(project.id, documents);

      setApplyState("success");
    } catch (e) {
      setApplyState("error");
      setApplyError(e?.message || "Apply failed.");
    }
  };

  const topics = project?.topics ?? [];
  const skills = project?.skills ?? [];
  const types = project?.types ?? [];

  useEffect(() => {
    const loadLikeState = async () => {
      if (!project) return;

      const count = await getLikeCountForProject(project.id);
      setLikeCount(count);

      if (!user) {
        setLiked(false);
        return;
      }

      const alreadyLiked = await hasUserLikedProject(project.id);
      setLiked(alreadyLiked);
    };

    loadLikeState();
  }, [user, project]);

  useEffect(() => {
    if (user) {
      setApplyError("");
      setLikeError("");
      if (applyState === "error") setApplyState("idle");
    }
  }, [user]);

  useEffect(() => {
    setDocFilesById({});
    setAdditionalFiles([]);
    setAdditionalInputKey((k) => k + 1);
  }, [user?.id, project?.id]);

  const onToggleLike = async () => {
    if (!user) {
      setLikeError("Please login to like projects.");
      return;
    }

    try {
      const prevLiked = liked;
      setLiked(!prevLiked);
      setLikeCount((c) => c + (prevLiked ? -1 : 1));

      const res = await toggleLikeProject(project.id);

      setLiked(res.liked);
      const freshCount = await getLikeCountForProject(project.id);
      setLikeCount(freshCount);
    } catch (e) {
      setLiked((prev) => !prev);
      setLikeCount((c) => c + (liked ? -1 : 1));
      setLikeError(e?.message || "Failed to like.");
    }
  };

  var isOwner = user.id == project?.author;
  const projectLocation = [project?.city, project?.country || project?.location].filter(Boolean).join(', ');

  const onToggleCompleted = async () => {
  try {
    const updated = await updateProject(project.id, {
      ...project,
      completed: !project.completed
    });

    setProject(updated);
  } catch (err) {
    alert("Failed to update project status");
  }
};

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <header className="mt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold leading-tight">{project?.title}</h1>

            <div className="mt-2 flex flex-col gap-1 text-sm">
              <div className="text-gray-600 italic">
                {project?.institute}
                {projectLocation ? ` in ${projectLocation}` : ""}
              </div>
              <div>
                <Link
                  to={`/profile/${project?.author}`}
                  className="text-gray-500 hover:text-[#6E7A8D] underline-offset-2 hover:underline"
                >
                  {project?.author_display_name}
                </Link>
              </div>
            </div>
            {isOwner && project?.completed && (
              <div className="mt-3 inline-block rounded-full border border-green-300 bg-green-50 px-3 py-1 text-sm text-green-700">
                Completed
              </div>
            )}
          </div>

          {isOwner && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="btn-outline px-4 py-2"
                onClick={() => navigate(`/projects/${project.id}/edit`)}
              >
                Edit
              </button>

              <button
                type="button"
                className="btn-outline px-4 py-2"
                onClick={onToggleCompleted}
              >
                {project?.completed ? "Reopen" : "Mark Completed"}
              </button>

              <button
                type="button"
                className="btn-outline px-4 py-2 text-red-600 border-red-200 hover:bg-red-50"
                onClick={onDelete}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Short description */}
      <section className="mt-6">
        <h2 className="text-lg font-medium mb-2">Short Description</h2>
        <div className="text-lg leading-relaxed text-gray-800">
          <ReactMarkdown
            children={project?.short_description}
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          />
        </div>
      </section>

      {/* Topics, Skills, Workload */}
      <section className="mt-8 grid grid-cols-1 sm:grid-cols-4 gap-6">
        <div>
          <h2 className="text-lg font-medium mb-2">Project Types</h2>
          {types.length ? (
            <div className="flex flex-wrap gap-2">
              {types.map((type) => (
                <span key={type} className="tag-ghost">
                  {type}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm opacity-60">None listed</div>
          )}
        </div>
        <div>
          <h2 className="text-lg font-medium mb-2">Topics</h2>
          {topics.length ? (
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <span key={topic} className="tag-ghost">
                  {topic}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm opacity-60">None listed</div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-medium mb-2">Skills</h2>
          {skills.length ? (
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span key={skill} className="tag-ghost">
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm opacity-60">None listed</div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-medium mb-2">Workload</h2>
          <div className="flex flex-wrap gap-2">
            <span className="tag-ghost">{project?.workload}</span>
          </div>
        </div>
      </section>

      {/* Long description */}
      <section className="mt-10">
        <h2 className="text-xl font-medium mb-3">Detailed description</h2>
        <div className="leading-relaxed whitespace-pre-line">
          <ReactMarkdown
            children={project?.long_description}
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          />
        </div>
      </section>

      {/* Application documents */}
      {!isOwner && applyState !== "success" && (
        <section className="mt-10">
          <h2 className="text-xl font-medium mb-3">Application documents</h2>

          {requiredDocs.length === 0 && (
            <div className="text-sm opacity-70">No required documents.</div>
          )}

          {requiredDocs.length > 0 && (
            <div className="space-y-4">
              {requiredDocs.map((d) => {
                const fileData = docFilesById?.[d.id] || null;
                return (
                  <div key={d.id} className="p-3 rounded-xl border">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">
                          {d.label || d.id}
                          {d.required ? (
                            <span className="ml-2 text-xs text-red-600">required</span>
                          ) : (
                            <span className="ml-2 text-xs opacity-60">optional</span>
                          )}
                        </div>
                        <div className="text-xs opacity-60">
                          Accepted: {d.type || "any"}
                        </div>
                        
                        {/* NEW: Clickable file name to trigger download */}
                        {fileData && (
                          <div className="mt-1 text-sm">
                            Selected:{" "} 
                            <button 
                              className="font-mono text-blue-600 hover:underline cursor-pointer"
                              onClick={() => handleDownload(fileData.application_document_id)}
                            >
                              {fileData.name}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {/* NEW: OnChange handler added upload logic */}
                        <input
                          id={`file-${d.id}`}
                          type="file"
                          className="hidden"
                          accept={d.type ? `.${d.type}` : undefined}
                          onChange={async (e) => {
                            const f = e.target.files?.[0] || null;
                            if (!f) return;
                            
                            setIsUploading(true);
                            try {
                              const appDocId = await handleImmediateUpload(f, d.id);
                              setDocFilesById((prev) => ({ 
                                ...prev, 
                                [d.id]: { 
                                  name: f.name, 
                                  size: f.size, 
                                  type: f.type, 
                                  application_document_id: appDocId 
                                } 
                              }));
                            } catch (err) {
                              alert(`Failed to upload ${f.name}`);
                            } finally {
                              setIsUploading(false);
                            }
                          }}
                        />

                        <label htmlFor={`file-${d.id}`} className="btn-outline cursor-pointer px-4 py-2"> 
                          {fileData ? "Change file" : "Choose file"} 
                        </label>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Additional files (multiple) */}
          <div className="mt-4 p-3 rounded-xl border">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">
                  Additional files{" "}
                  <span className="ml-2 text-xs opacity-60">optional</span>
                </div>

                {additionalFiles.length === 0 ? (
                  <div className="mt-1 text-sm opacity-60">No additional files selected.</div>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {/* NEW: Clickable filenames for downloads */}
                    {additionalFiles.map((f, idx) => (
                      <li key={`${f.application_document_id}-${idx}`} className="flex items-center gap-2">
                        <button 
                          className="text-sm text-blue-600 hover:underline truncate max-w-[320px]"
                          onClick={() => handleDownload(f.application_document_id)}
                        >
                          {f.name}
                        </button>

                        <button
                          type="button"
                          className="btn-outline px-2 py-1 text-sm shrink-0"
                          onClick={() =>
                            setAdditionalFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                          aria-label={`Remove ${f.name}`}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {additionalFiles.length > 0 && (
                  <button
                    type="button"
                    className="btn-outline px-3 py-2"
                    onClick={() => setAdditionalFiles([])}
                  >
                    Clear
                  </button>
                )}

                {/* NEW: OnChange handler handles multiple immediate uploads */}
                <input
                  key={additionalInputKey}
                  id="additional-files"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const picked = Array.from(e.target.files || []);
                    if (picked.length === 0) return;

                    setIsUploading(true);
                    
                    for (const f of picked) {
                      try {
                        const appDocId = await handleImmediateUpload(f, null);
                        setAdditionalFiles((prev) => [
                          ...prev, 
                          { 
                            name: f.name, 
                            size: f.size, 
                            type: f.type, 
                            application_document_id: appDocId 
                          }
                        ]);
                      } catch (err) {
                        alert(`Failed to upload ${f.name}`);
                      }
                    }

                    setIsUploading(false);
                    setAdditionalInputKey((k) => k + 1);
                  }}
                />

                <label
                  htmlFor="additional-files"
                  className="btn-outline cursor-pointer px-4 py-2"
                >
                  Choose files
                </label>
              </div>
            </div>
          </div>

          {missingRequiredDocs.length > 0 && (
            <div className="mt-3 text-sm text-red-600">
              Missing required:{" "}
              {missingRequiredDocs
                .map((d) => d?.label || d?.id)
                .filter(Boolean)
                .join(", ")}
            </div>
          )}
        </section>
      )}

      {/* Apply error */}
      {applyState === "error" && (
        <div className="mt-6 text-sm text-red-600">{applyError}</div>
      )}

      {/* Like error */}
      {likeError && <div className="mt-6 text-sm text-red-600">{likeError}</div>}

      {/* Buttons */}
      <section className="mt-12 flex justify-end gap-3">
        <button
          type="button"
          className={`btn-outline px-5 py-2 ${liked ? "text-red-600" : ""}`}
          aria-label="Like project"
          onClick={onToggleLike}
        >
          {liked ? "♥" : "♡"} Like {likeCount}
        </button>

        {isOwner ? (
          <button
            type="button"
            className="btn-outline px-5 py-2"
            onClick={() => navigate(`/projects/${project.id}/applicants`)}
          >
            View applications
          </button>
        ) : (
          <button
            type="button"
            className={`btn-primary px-6 py-2 ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={onApply}
            disabled={applyState === "loading" || applyState === "success" || !canApply || isUploading}
          >
             {isUploading
              ? "Uploading Files..."
              : applyState === "loading"
              ? "Applying..."
              : applyState === "success"
              ? "Applied"
              : "Apply"}
          </button>
        )}
      </section>
    </div>
  );
}
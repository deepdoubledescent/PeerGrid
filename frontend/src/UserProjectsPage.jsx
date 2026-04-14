import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listUserProjects } from "./Controller";
import { BookOpen, CheckCircle2 } from "lucide-react";

export default function UserProjectsPage({ user }) {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("published");

  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      try {
        const rows = await listUserProjects(userId);
        setProjects(rows || []);
      } catch (error) {
        console.error("Failed to load user projects:", error);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [user?.id, userId]);

  const publishedProjects = useMemo(
    () => (projects || []).filter((p) => !p.completed),
    [projects]
  );

  const completedProjects = useMemo(
    () => (projects || []).filter((p) => !!p.completed),
    [projects]
  );

  const visibleProjects =
    activeTab === "published" ? publishedProjects : completedProjects;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Projects</h1>
        <p className="text-stone-500 mt-2">
          Browse published and completed projects.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <button
          type="button"
          className={`btn-outline ${activeTab === "published" ? "!bg-stone-900 !text-white" : ""}`}
          onClick={() => setActiveTab("published")}
        >
          <span className="inline-flex items-center gap-2">
            <BookOpen size={16} />
            Published Projects ({publishedProjects.length})
          </span>
        </button>

        <button
          type="button"
          className={`btn-outline ${activeTab === "completed" ? "!bg-stone-900 !text-white" : ""}`}
          onClick={() => setActiveTab("completed")}
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={16} />
            Completed Projects ({completedProjects.length})
          </span>
        </button>
      </div>

      {loading ? (
        <div className="text-stone-500">Loading projects...</div>
      ) : visibleProjects.length === 0 ? (
        <div className="text-stone-500">
          {activeTab === "published"
            ? "No published projects yet."
            : "No completed projects yet."}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => navigate(`/projects/${project.id}`)}
              className="project-card-mini w-full text-left"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{project.title}</h2>
                  <p className="text-stone-600 mt-2">
                    {project.short_description}
                  </p>
                  {project.published && (
                    <div className="text-sm text-stone-400 mt-3">
                      Published: {project.published}
                    </div>
                  )}
                </div>

                {project.completed && (
                  <span className="tag-ghost whitespace-nowrap">
                    Completed
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      
    <div className="flex justify-center gap-6 mt-8">
      <button
        className="btn-primary flex-shrink-0"
        onClick={() => navigate("/projects/recommended")}
      >
        Recommended Projects
      </button>

      <button
        className="btn-primary flex-shrink-0"
        onClick={() => navigate("/projects/my-applications")}
      >
        My Applications
      </button>

      <button
        className="btn-primary flex-shrink-0"
        onClick={() => navigate("/projects")}
      >
        Browse Projects
      </button>

      <button
        className="btn-primary flex-shrink-0"
        onClick={() => navigate("/projects/new")}
      >
        + Register New Project
      </button>
    </div>
    </div>
  );
}
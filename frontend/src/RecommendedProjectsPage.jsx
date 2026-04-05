import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import { User, Calendar } from 'lucide-react';
import { getRecommendedProjects } from './Controller';

const ListEntry = ({ project, isOpen, onToggle }) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div className="py-4">
      <div
        className="project-header flex items-center min-w-full py-4 -my-4 cursor-pointer relative z-10"
        onClick={onToggle}
        aria-expanded={isOpen}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <Link to={`/projects/${project.id}`}>
          <h1 className="project-title text-xl text-left hover:!text-[#6E7A8D]">
            {project.title}
          </h1>
        </Link>

        <div className="project-tags-small pl-2 z-11 pointer-events-none">
          {(project.types || []).map((type) => (
            <span key={`type-${type}`} className="tag-ghost pointer-events-none">
              {type}
            </span>
          ))}

          {(project.topics || []).map((topic) => (
            <span key={topic} className="tag-ghost pointer-events-none">
              {topic}
            </span>
          ))}
        </div>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.87,0,0.13,1)] ${
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="z-9 overflow-hidden pt-3 text-left mx-7">
          <div className="flex w-full gap-4">
            <div className="font-[500] text-[var(--text-secondary)]">
              <div className="icon-small">
                <User size={14} />
              </div>
              <Link to={`/profile/${project.author}`} className="cursor-pointer">
                {project.author_display_name}
              </Link>
            </div>

            <div className="text-zinc-400 cursor-default">
              <div className="icon-small">
                <Calendar size={14} />
              </div>
              <span>{project.published}</span>
            </div>

            {typeof project.recommendation_score === 'number' && (
              <div className="text-zinc-500 cursor-default">
                Match score: {project.recommendation_score}
              </div>
            )}
          </div>

          <p className="project-short-description">{project.short_description}</p>

          {project.location || project.institute ? (
            <div className="mt-3 text-sm text-stone-500">
              {[project.institute, project.location].filter(Boolean).join(' · ')}
            </div>
          ) : null}

          <div className="mt-4">
            <ReactMarkdown
              children={project.long_description || ''}
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default function RecommendedProjectsPage({ user }) {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [openIds, setOpenIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [message, setMessage] = useState('');

  const RESULTS_PER_PAGE = 10;
  const totalPages = Math.ceil(totalResults / RESULTS_PER_PAGE);

  const toggleItem = (id) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const loadRecommendations = async ({ nextPage = 1, append = false } = {}) => {
    if (!user) {
      setProjects([]);
      setMessage('Please log in to see recommended projects.');
      setIsLoading(false);
      setIsLoadingMore(false);
      return;
    }

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setMessage('');
    }

    try {
      const response = await getRecommendedProjects(nextPage, RESULTS_PER_PAGE);

      const incomingProjects = response?.projects || [];
      const incomingTotal = response?.total_results || 0;

      setTotalResults(incomingTotal);
      setPage(nextPage);

      if (append) {
        setProjects((prev) => [...prev, ...incomingProjects]);
      } else {
        setProjects(incomingProjects);
        setOpenIds([]);
      }

      if (!incomingProjects.length && !append) {
        setMessage(
          'No recommended projects found yet. Add research interests and location to improve recommendations.'
        );
      }
    } catch (error) {
      console.error('Failed to fetch recommended projects', error);
      if (!append) {
        setProjects([]);
        setMessage('Failed to load recommended projects.');
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    loadRecommendations({ nextPage: 1, append: false });
  }, [user]);

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    if (page >= totalPages) return;
    await loadRecommendations({ nextPage: page + 1, append: true });
  };

  return (
    <div>
      <div className="project-container">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-stone-900">Recommended Projects</h1>
          <p className="text-stone-500 mt-2">
            Projects matched to your research interests and location.
          </p>
        </div>

        <div className="project-list divide-y divide-gray-200">
          {isLoading ? (
            <div className="w-full center my-40 text-center text-gray-500">
              Loading...
            </div>
          ) : projects.length !== 0 ? (
            projects.map((project, index) => (
              <ListEntry
                key={`${project.id}-${index}`}
                project={project}
                isOpen={openIds.includes(index)}
                onToggle={() => toggleItem(index)}
              />
            ))
          ) : (
            <div className="w-full center my-40 text-center text-gray-500">
              {message || 'Nothing here yet...'}
            </div>
          )}
        </div>
      </div>

      {!isLoading && projects.length > 0 && (
        <div className="flex gap-7 justify-center mt-4 text-gray-500 text-s">
          <button
            disabled={page <= 1}
            onClick={() => loadRecommendations({ nextPage: page - 1, append: false })}
            className="cursor-pointer disabled:text-gray-300 disabled:cursor-default"
          >
            <u>Previous</u>
          </button>

          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              disabled={page === i + 1}
              onClick={() => loadRecommendations({ nextPage: i + 1, append: false })}
              className={`cursor-pointer disabled:cursor-default ${
                page === i + 1 ? 'font-bold text-gray-700' : 'font-normal'
              }`}
            >
              {i + 1}
            </button>
          ))}

          <button
            disabled={page >= totalPages}
            onClick={() => loadRecommendations({ nextPage: page + 1, append: false })}
            className="cursor-pointer disabled:text-gray-300 disabled:cursor-default"
          >
            <u>Next</u>
          </button>
        </div>
      )}

      {user && (
        <div>
          <div style={{ height: '100px' }}></div>

          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderTop: '1px solid #e5e5e5',
            backdropFilter: 'blur(5px)',
            padding: '1.5rem 0',
            display: 'flex',
            justifyContent: 'center',
            zIndex: 100,
            boxShadow: '0 -4px 20px rgba(0,0,0,0.03)'
          }}>
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>

              <button
                className="btn-primary"
                onClick={() => navigate("/projects/all")}
              >
                Browse All Projects
              </button>

              <button
                className="btn-primary"
                onClick={() => navigate("/projects/my-applications")}
              >
                My Applications
              </button>

              <button
                className="btn-primary"
                onClick={() => navigate("/projects/new")}
              >
                + Register New Project
              </button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
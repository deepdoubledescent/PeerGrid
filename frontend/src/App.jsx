// App.jsx - Main Application with Authentication and OpenAlex Setup

import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { User, LogOut } from 'lucide-react';
import './App.css'
import ProjectsPage, { ProjectsList } from './ProjectsPage'
import ProjectDetailPage from "./ProjectDetailPage";
import ApplicantsPage from "./ApplicantsPage";
import PeoplePage from "./PeoplePage";
import RecommendedPeoplePage from "./RecommendedPeoplePage";
import AllPapersPage from "./AllPapersPage";
import PapersPage from "./PapersPage";
import NewProjectPage from "./NewProjectPage";
import UserPage from "./UserPage";
import PaperDetailPage from "./PaperDetailPage";
import NotificationBell from "./NotificationBell";
import { NotificationProvider } from './notificationContext';
import AuthPage from "./AuthPage";
import OpenAlexSetupPage from "./OpenAlexSetupPage"; // NEW: Import OpenAlex setup page
import { getStoredTokens, getUserFromIdToken, clearTokens, getLogoutUrl } from "./auth";
import EditProjectPage from "./EditProjectPage";
import AllPeoplePage from "./AllPeoplePage";
import NetworkPage from "./NetworkPage";
import ConnectionsPage from "./ConnectionsPage";
import FollowingPage from "./FollowingPage";
import UserProjectsPage from "./UserProjectsPage";
import UserLikedProjectsPage from "./UserLikedProjectsPage";
import UserLikedPapersPage from "./UserLikedPapersPage";
import MyProjectApplications from "./MyProjectApplications";
import PostsPage from "./PostsPage";
import AllPostsPage from "./AllPostsPage";
import NewPostPage from "./NewPostPage";
import EditPostPage from "./EditPostPage";
import UserPostsPage from "./UserPostsPage";
import FeedPage from "./FeedPage";
import PostDetailPage from "./PostDetailPage";
import UserLikedPostsPage from "./UserLikedPostsPage";
import EventsPage from "./EventsPage";
import SearchEventsPage from "./SearchEventsPage";
import NewEventPage from "./NewEventPage";
import MyEventsPage from "./MyEventsPage";
import RegisteredEventsPage from "./RegisteredEventsPage";
import EventDetailPage from "./EventDetailPage";
import EditEventPage from "./EditEventPage";
import UserEventsPage from "./UserEventsPage";
import { validateSignOn } from './Controller';
import TermsOfUse from './TermsOfUse';
import PrivacyPolicy from './PrivacyPolicy';

function useScrollThreshold(threshold = 50) {
  const [isPastThreshold, setIsPastThreshold] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsPastThreshold(window.scrollY > threshold);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return isPastThreshold;
}

// Protected Route Component - redirects to auth if not logged in
const ProtectedRoute = ({ user, children }) => {
  if (!user) {
    return <Navigate to="/" replace />;
  }
  return children;
};

// NEW: Route that requires OpenAlex setup to be completed
const RequireOpenAlexRoute = ({ user, children }) => {
  if (!user) {
    return <Navigate to="/" replace />;
  }
  // If user hasn't completed OpenAlex setup, redirect to setup page
  if (!user.openAlexId && !user.skippedOpenAlex) {
    return <Navigate to="/setup/openalex" replace />;
  }
  return children;
};

const Layout = ({ children, user, setUser }) => {
  const navigate = useNavigate();
  const isShrunk = useScrollThreshold(10);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = () => {
    // Clear local tokens
    clearTokens();
    // Clear user state
    setUser(null);
    // Close dropdown
    setShowDropdown(false);
    // Redirect to Cognito logout (clears Cognito session)
    // Uncomment below if you want to also log out from Cognito hosted UI
    // window.location.href = getLogoutUrl();
  };
  const headerAvatar = user?.avatar;

  return (
    <div className="app-container">
      <div className="navbar-wrapper h-30 sticky top-0 z-50 pointer-events-none">
        <header className={`
        navbar bg-white transition-all duration-300 pointer-events-auto
        ${isShrunk ? 'h-5' : 'h-30'}
      `}>
          <div className="nav-left">
            <Link to="/projects" className="nav-logo"><img src='logo.png'></img></Link>
            <nav>
              <Link to="/projects" className="nav-link">Projects</Link>
              {user && <span className='m-7'>|</span>}
              {user && <Link to="/people" className="nav-link">People</Link>}
              <span className='m-7'>|</span>
              <Link to="/papers" className="nav-link">Papers</Link>
              <span className='m-7'>|</span>
              <Link to="/posts" className="nav-link">Posts</Link>
              <span className='m-7'>|</span>
              <Link to="/events" className="nav-link">Events</Link>
            </nav>
          </div>
          <div className="nav-right">
            {user ? (
              <>
                <NotificationBell user={user} />
                <div className="profile-menu">
                  <div
                    className="profile-badge"
                    onClick={() => setShowDropdown(!showDropdown)}
                  >
                    {headerAvatar ? (
                      <img src={headerAvatar} alt={user.name} className="profile-avatar" />
                    ) : (
                      <User size={18} />
                    )}
                  </div>

                  {showDropdown && (
                    <>
                      <div
                        className="dropdown-overlay"
                        onClick={() => setShowDropdown(false)}
                      />
                      <div className="dropdown-menu">
                        <div className="dropdown-header">
                          <div className="dropdown-name">{user.name}</div>
                          {user.email && (
                            <div className="dropdown-email">{user.email}</div>
                          )}
                        </div>
                        <div className="dropdown-divider" />
                        <button
                          className="dropdown-item"
                          onClick={() => {
                            navigate('/profile');
                            setShowDropdown(false);
                          }}
                        >
                          <User size={16} />
                          View Profile
                        </button>
                        <button
                          className="dropdown-item dropdown-item-danger"
                          onClick={handleLogout}
                        >
                          <LogOut size={16} />
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <button
                className="login-btn"
                onClick={() => navigate('/')}
              >
                Sign in
              </button>
            )}
          </div>
        </header>
      </div>
      <main className="content">{children}</main>

      {/* Additional styles for dropdown */}
      <style>{`
        .profile-menu {
          position: relative;
        }

        .profile-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          object-fit: cover;
        }

        .profile-badge {
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dropdown-overlay {
          position: fixed;
          inset: 0;
          z-index: 40;
        }

        .dropdown-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 240px;
          background: white;
          border-radius: 8px;
          border: 1px solid var(--border);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
          z-index: 50;
          overflow: hidden;
        }

        .dropdown-header {
          padding: 1rem;
        }

        .dropdown-name {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 0.95rem;
        }

        .dropdown-email {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-top: 0.25rem;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dropdown-divider {
          height: 1px;
          background: var(--border);
        }

        .dropdown-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: none;
          border: none;
          font-size: 0.9rem;
          color: var(--text-secondary);
          cursor: pointer;
          transition: background 0.15s ease;
          text-align: left;
          font-family: inherit;
        }

        .dropdown-item:hover {
          background: #f3f4f6;
          color: var(--text-primary);
        }

        .dropdown-item-danger {
          color: #dc2626;
        }

        .dropdown-item-danger:hover {
          background: #fef2f2;
          color: #dc2626;
        }
      `}</style>
    </div>
  );
};

function App() {
  // Have a nice Christmas!

  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const tokens = getStoredTokens();
        if (tokens) {
          const userData = await getUserFromIdToken(tokens.idToken);
          if (userData) {
            setUser(userData);
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        clearTokens();
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAuth();
  }, []);

  // NEW: Handler for when OpenAlex setup is completed (or skipped)
  const handleOpenAlexComplete = async (updatedUser) => {
    // Mark that user has completed/skipped the OpenAlex flow
    await validateSignOn();
  };

  // Show loading while checking authentication
  if (isInitializing) {
    return (
      <div className="init-loading">
        <div className="init-spinner"></div>
        <style>{`
          .init-loading {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #ffffff;
          }
          .init-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid var(--border, #e5e5e5);
            border-top-color: var(--accent, #003d82);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <NotificationProvider>
      <Router>
        <Routes>
          {/* Default landing page - Auth page (shows if not logged in, redirects to projects if logged in) */}
          <Route
            path="/"
            element={
              user ? (
                // If user is logged in, check if they need OpenAlex setup
                !user.firstSignOn ? (
                  <Navigate to="/projects" replace />
                ) : (
                  <Navigate to="/setup/openalex" replace />
                )
              ) : (
                <AuthPage user={user} setUser={setUser} />
              )
            }
          />

          {/* NEW: OpenAlex setup page - standalone without main layout */}
          <Route
            path="/setup/openalex"
            element={
              user ? (
                  <OpenAlexSetupPage
                    user={user}
                    setUser={setUser}
                    allowSkip={true} // Set to false to make OpenAlex required
                    onComplete={handleOpenAlexComplete}
                  />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          {/* All protected routes with layout */}
          <Route
            path="/*"
            element={
              //<RequireOpenAlexRoute user={user}>
                <Layout user={user} setUser={setUser}>
                  <Routes>
                    <Route path="/projects" element={<ProjectsPage user={user} />} />
                    <Route path="/projects/all" element={<ProjectsList user={user} />} />
                    <Route path="/projects/:projectId" element={<ProjectDetailPage user={user} />} />
                    <Route path="/profile" element={<UserPage user={user} setUser={setUser} />} />
                    <Route path="/profile/:userId" element={<UserPage user={user} setUser={setUser} />} />
                    <Route path="/people" element={<PeoplePage user={user} />} />
                    <Route path="/people/recommended" element={<RecommendedPeoplePage user={user} />} />
                    <Route path="/people/all" element={<AllPeoplePage user={user} />} />
                    <Route path="/people/network" element={<NetworkPage user={user} />} />
                    <Route path="/people/network/connections" element={<ConnectionsPage user={user} />} />
                    <Route path="/people/network/following" element={<FollowingPage user={user} />} />
                    <Route path="/papers" element={<PapersPage user={user} />} />
                    <Route path="/papers/all" element={<AllPapersPage user={user} />} />
                    <Route path="/projects/:projectId/applicants" element={<ApplicantsPage user={user} />} />
                    <Route path="/projects/new" element={<NewProjectPage user={user} />} />
                    <Route path="/projects/my-applications" element={<MyProjectApplications user={user} />} />
                    <Route path="/papers/:paperId" element={<PaperDetailPage user={user} />} />
                    <Route path="/projects/:projectId/edit" element={<EditProjectPage user={user} />} />
                    <Route path="/profile/:userId/projects" element={<UserProjectsPage user={user} />} />
                    <Route path="/profile/:userId/liked-projects" element={<UserLikedProjectsPage user={user} />} />
                    <Route path="/profile/:userId/liked-papers" element={<UserLikedPapersPage user={user} />} />
                    <Route path="/posts" element={<PostsPage user={user} />} />
                    <Route path="/posts/all" element={<AllPostsPage user={user} />} />
                    <Route path="/posts/new" element={<NewPostPage user={user} />} />
                    <Route path="/posts/:postId/edit" element={<EditPostPage user={user} />} />
                    <Route path="/profile/:userId/posts" element={<UserPostsPage user={user} />} />
                    <Route path="/posts/feed" element={<FeedPage user={user} />} />
                    <Route path="/posts/:postId" element={<PostDetailPage user={user} />} />
                    <Route path="/profile/:userId/liked-posts" element={<UserLikedPostsPage user={user} />} />
                    <Route path="/events" element={<EventsPage user={user} />} />
                    <Route path="/events/search" element={<SearchEventsPage user={user} />} />
                    <Route path="/events/new" element={<NewEventPage user={user} />} />
                    <Route path="/events/my" element={<MyEventsPage user={user} />} />
                    <Route path="/events/registered" element={<RegisteredEventsPage user={user} />} />
                    <Route path="/events/:eventId" element={<EventDetailPage user={user} />} />
                    <Route path="/events/:eventId/edit" element={<EditEventPage user={user} />} />
                    <Route path="/profile/:userId/events" element={<UserEventsPage user={user} />} />
                    <Route path="/posts/recommended" element={<RecommendedPostsPage user={user} />} />
                    <Route path="/papers/recommended" element={<RecommendedPapersPage user={user} />} />
                    <Route path="/projects/recommended" element={<RecommendedProjectsPage user={user} />}/>
                    <Route path="/terms" element={<TermsOfUse />} />
                    <Route path="/privacy" element={<PrivacyPolicy />} />
                  </Routes>
                </Layout>
              //</RequireOpenAlexRoute>
            }
          />
        </Routes>
      </Router>
    </NotificationProvider>
  );
}

export default App

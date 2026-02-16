/**
 * Main Admin Dashboard layout
 * Terminal CRT theme matching the site preloader
 */

import React, { Suspense, lazy } from 'react'
import { AuthProvider, useAdminAuth } from './useAdminAuth.jsx'
import AdminLogin from './AdminLogin'
import {
  FolderIcon,
  UserIcon,
  MusicalNoteIcon,
  DocumentTextIcon,
  ArrowLeftOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/solid'

// Lazy load views
const AdminDashboard = lazy(() => import('./AdminDashboard'))
const ProjectEditor = lazy(() => import('./ProjectEditor'))
const AboutEditor = lazy(() => import('./AboutEditor'))
const MusicEditor = lazy(() => import('./MusicEditor'))
const BlogEditor = lazy(() => import('./BlogEditor'))
const BlogList = lazy(() => import('./BlogList'))

// Internal admin routes
const ROUTES = {
  DASHBOARD: 'dashboard',
  PROJECT_NEW: 'project-new',
  PROJECT_EDIT: 'project-edit',
  ABOUT: 'about',
  MUSIC: 'music',
  BLOG_LIST: 'blog-list',
  BLOG_NEW: 'blog-new',
  BLOG_EDIT: 'blog-edit',
}

// Terminal CRT styles shared across all admin components
const TERMINAL_STYLES = `
  /* === CRT TERMINAL ADMIN THEME === */
  @keyframes adminCrtFlicker {
    0%, 100% { opacity: 0.015; }
    50% { opacity: 0.03; }
  }
  @keyframes adminBlink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
  @keyframes adminFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes adminGlowPulse {
    0%, 100% { box-shadow: 0 0 15px rgba(59, 130, 246, 0.4), 0 0 30px rgba(59, 130, 246, 0.2); }
    50% { box-shadow: 0 0 25px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.3); }
  }
  @keyframes adminScrollGlow {
    0%, 100% { box-shadow: 0 0 4px rgba(59, 130, 246, 0.4); }
    50% { box-shadow: 0 0 8px rgba(59, 130, 246, 0.6); }
  }
  @keyframes adminScanline {
    0% { transform: translateY(0); }
    100% { transform: translateY(100%); }
  }

  /* Admin cursor blink */
  .admin-cursor-blink {
    animation: adminBlink 1s step-end infinite;
  }

  /* Admin fade-in for elements */
  .admin-fade-in {
    animation: adminFadeIn 0.3s ease-out forwards;
  }

  /* Admin terminal font */
  .admin-terminal-font {
    font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace !important;
  }

  /* Terminal scrollbar for admin */
  .admin-scroll::-webkit-scrollbar {
    width: 8px;
  }
  .admin-scroll::-webkit-scrollbar-track {
    background: rgba(0, 10, 30, 0.6);
    border-left: 1px solid rgba(59, 130, 246, 0.15);
  }
  .admin-scroll::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(59, 130, 246, 0.4) 0%, rgba(59, 130, 246, 0.2) 100%);
    border-radius: 4px;
    border: 1px solid rgba(59, 130, 246, 0.3);
    animation: adminScrollGlow 2s ease-in-out infinite;
  }
  .admin-scroll::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, rgba(59, 130, 246, 0.6) 0%, rgba(59, 130, 246, 0.4) 100%);
  }

  /* Terminal input styles */
  .admin-input {
    font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace;
    background: rgba(0, 10, 30, 0.5) !important;
    border: 1px solid rgba(59, 130, 246, 0.2) !important;
    color: #93c5fd !important;
    caret-color: #60a5fa;
  }
  .admin-input::placeholder {
    color: rgba(59, 130, 246, 0.3) !important;
  }
  .admin-input:focus {
    border-color: rgba(59, 130, 246, 0.5) !important;
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.15), inset 0 0 10px rgba(59, 130, 246, 0.05) !important;
    outline: none !important;
  }

  /* Terminal select/toggle */
  .admin-toggle-active {
    background: #3b82f6 !important;
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
  }
  .admin-toggle-inactive {
    background: rgba(59, 130, 246, 0.2) !important;
  }

  /* Terminal button primary */
  .admin-btn-primary {
    background: #3b82f6 !important;
    color: #000 !important;
    font-family: "Cascadia Code", "Fira Code", monospace;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 1px solid #60a5fa;
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
    transition: all 0.2s;
  }
  .admin-btn-primary:hover {
    background: #60a5fa !important;
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
  }
  .admin-btn-primary:active {
    transform: scale(0.98);
  }
  .admin-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Terminal button secondary */
  .admin-btn-secondary {
    background: transparent !important;
    color: #60a5fa !important;
    font-family: "Cascadia Code", "Fira Code", monospace;
    border: 1px solid rgba(59, 130, 246, 0.3);
    transition: all 0.2s;
  }
  .admin-btn-secondary:hover {
    border-color: rgba(59, 130, 246, 0.6);
    background: rgba(59, 130, 246, 0.1) !important;
  }

  /* Terminal card */
  .admin-card {
    background: rgba(0, 10, 30, 0.4);
    border: 1px solid rgba(59, 130, 246, 0.15);
    box-shadow: inset 0 0 30px rgba(59, 130, 246, 0.03);
  }
  .admin-card:hover {
    border-color: rgba(59, 130, 246, 0.3);
    box-shadow: inset 0 0 30px rgba(59, 130, 246, 0.05), 0 0 15px rgba(59, 130, 246, 0.1);
  }

  /* Terminal section header */
  .admin-section-title {
    font-family: "Cascadia Code", "Fira Code", monospace;
    color: #22d3ee;
    text-shadow: 0 0 8px rgba(34, 211, 238, 0.3);
  }
  .admin-section-title::before {
    content: "> ";
    opacity: 0.6;
  }

  /* Terminal comment text */
  .admin-comment {
    color: #6b7280;
    font-family: "Cascadia Code", "Fira Code", monospace;
    font-size: 0.75rem;
  }
  .admin-comment::before {
    content: "// ";
    opacity: 0.7;
  }

  /* Glow button for important actions */
  .admin-glow-btn {
    animation: adminGlowPulse 2s ease-in-out infinite;
  }

  /* Terminal error */
  .admin-error {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    font-family: "Cascadia Code", "Fira Code", monospace;
  }

  /* Terminal success */
  .admin-success {
    background: rgba(59, 130, 246, 0.08);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #60a5fa;
    font-family: "Cascadia Code", "Fira Code", monospace;
  }
`

function AdminLayout() {
  const { user, loading, logout, isAuthenticated } = useAdminAuth()
  const [currentRoute, setCurrentRoute] = React.useState(ROUTES.DASHBOARD)
  const [editProjectId, setEditProjectId] = React.useState(null)
  const [editBlogId, setEditBlogId] = React.useState(null)

  // Loading state
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#0a0f0a', fontFamily: '"Cascadia Code", monospace' }}
      >
        <style>{TERMINAL_STYLES}</style>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-blue-500/60 text-sm admin-terminal-font">&gt; loading_admin_panel...</p>
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <style>{TERMINAL_STYLES}</style>
        <AdminLogin />
      </>
    )
  }

  const navigate = (route, params = {}) => {
    if (route === ROUTES.PROJECT_EDIT && params.id) {
      setEditProjectId(params.id)
    } else {
      setEditProjectId(null)
    }
    if (route === ROUTES.BLOG_EDIT && params.id) {
      setEditBlogId(params.id)
    } else {
      setEditBlogId(null)
    }
    setCurrentRoute(route)
  }

  const renderContent = () => {
    switch (currentRoute) {
      case ROUTES.PROJECT_NEW:
        return (
          <Suspense fallback={<LoadingView />}>
            <ProjectEditor
              onBack={() => navigate(ROUTES.DASHBOARD)}
              onSaved={() => navigate(ROUTES.DASHBOARD)}
            />
          </Suspense>
        )
      case ROUTES.PROJECT_EDIT:
        return (
          <Suspense fallback={<LoadingView />}>
            <ProjectEditor
              projectId={editProjectId}
              onBack={() => navigate(ROUTES.DASHBOARD)}
              onSaved={() => navigate(ROUTES.DASHBOARD)}
            />
          </Suspense>
        )
      case ROUTES.ABOUT:
        return (
          <Suspense fallback={<LoadingView />}>
            <AboutEditor onBack={() => navigate(ROUTES.DASHBOARD)} />
          </Suspense>
        )
      case ROUTES.MUSIC:
        return (
          <Suspense fallback={<LoadingView />}>
            <MusicEditor onBack={() => navigate(ROUTES.DASHBOARD)} />
          </Suspense>
        )
      case ROUTES.BLOG_LIST:
        return (
          <Suspense fallback={<LoadingView />}>
            <BlogList
              onNewBlog={() => navigate(ROUTES.BLOG_NEW)}
              onEditBlog={(id) => navigate(ROUTES.BLOG_EDIT, { id })}
            />
          </Suspense>
        )
      case ROUTES.BLOG_NEW:
        return (
          <Suspense fallback={<LoadingView />}>
            <BlogEditor
              onBack={() => navigate(ROUTES.BLOG_LIST)}
              onSaved={() => navigate(ROUTES.BLOG_LIST)}
            />
          </Suspense>
        )
      case ROUTES.BLOG_EDIT:
        return (
          <Suspense fallback={<LoadingView />}>
            <BlogEditor
              postId={editBlogId}
              onBack={() => navigate(ROUTES.BLOG_LIST)}
              onSaved={() => navigate(ROUTES.BLOG_LIST)}
            />
          </Suspense>
        )
      default:
        return (
          <Suspense fallback={<LoadingView />}>
            <AdminDashboard
              onNewProject={() => navigate(ROUTES.PROJECT_NEW)}
              onEditProject={(id) => navigate(ROUTES.PROJECT_EDIT, { id })}
              onEditAbout={() => navigate(ROUTES.ABOUT)}
            />
          </Suspense>
        )
    }
  }

  // Current route path for terminal header
  const getRoutePath = () => {
    switch (currentRoute) {
      case ROUTES.DASHBOARD: return '~/projects'
      case ROUTES.PROJECT_NEW: return '~/projects/new'
      case ROUTES.PROJECT_EDIT: return '~/projects/edit'
      case ROUTES.ABOUT: return '~/about'
      case ROUTES.MUSIC: return '~/music'
      case ROUTES.BLOG_LIST: return '~/blog'
      case ROUTES.BLOG_NEW: return '~/blog/new'
      case ROUTES.BLOG_EDIT: return '~/blog/edit'
      default: return '~/admin'
    }
  }

  return (
    <div
      className="min-h-screen text-white admin-scroll"
      style={{
        backgroundColor: '#0a0f0a',
        fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace',
      }}
    >
      <style>{TERMINAL_STYLES}</style>

      {/* CRT Scanlines overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[9999]"
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)',
        }}
      />
      {/* CRT Glow */}
      <div
        className="fixed inset-0 pointer-events-none z-[9998]"
        style={{
          boxShadow: 'inset 0 0 120px rgba(59, 130, 246, 0.06), inset 0 0 60px rgba(59, 130, 246, 0.03)',
        }}
      />
      {/* Subtle vignette */}
      <div
        className="fixed inset-0 pointer-events-none z-[9997]"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)',
        }}
      />
      {/* CRT Flicker */}
      <div
        className="fixed inset-0 pointer-events-none z-[9996]"
        style={{
          animation: 'adminCrtFlicker 0.1s infinite',
          backgroundColor: '#3b82f6',
          opacity: 0.015,
        }}
      />

      {/* Terminal Header */}
      <header
        className="fixed top-0 left-0 right-0 z-[10000] h-10 flex items-center px-4 border-b"
        style={{
          backgroundColor: 'rgba(0, 10, 30, 0.85)',
          borderColor: 'rgba(59, 130, 246, 0.2)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="h-full w-full max-w-7xl mx-auto flex items-center justify-between">
          {/* Left: macOS dots + path */}
          <div className="flex items-center">
            <button
              onClick={() => navigate(ROUTES.DASHBOARD)}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="flex gap-1.5 mr-3">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-blue-500/80" />
              </div>
              <span className="text-blue-500/80 text-sm">
                admin@skulley-rad:{getRoutePath()}
              </span>
              <span className="admin-cursor-blink text-blue-400 text-sm">_</span>
            </button>
          </div>

          {/* Center: Nav */}
          <nav className="hidden sm:flex items-center gap-1">
            <NavButton
              icon={FolderIcon}
              label="projects"
              active={currentRoute === ROUTES.DASHBOARD || currentRoute.startsWith('project')}
              onClick={() => navigate(ROUTES.DASHBOARD)}
            />
            <NavButton
              icon={UserIcon}
              label="about"
              active={currentRoute === ROUTES.ABOUT}
              onClick={() => navigate(ROUTES.ABOUT)}
            />
            <NavButton
              icon={MusicalNoteIcon}
              label="music"
              active={currentRoute === ROUTES.MUSIC}
              onClick={() => navigate(ROUTES.MUSIC)}
            />
            <NavButton
              icon={DocumentTextIcon}
              label="blog"
              active={currentRoute === ROUTES.BLOG_LIST || currentRoute.startsWith('blog')}
              onClick={() => navigate(ROUTES.BLOG_LIST)}
            />
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs text-blue-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
            >
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              <span>view_site</span>
            </a>
          </nav>

          {/* Right: User */}
          <div className="flex items-center gap-3">
            {user?.avatar_url && (
              <img
                src={user.avatar_url}
                alt={user.name || 'Avatar'}
                className="w-7 h-7 rounded border border-blue-500/30"
              />
            )}
            <span className="hidden sm:block text-xs text-blue-500/60 max-w-[120px] truncate">
              {user?.name || user?.email}
            </span>
            <button
              onClick={logout}
              className="p-1.5 rounded hover:bg-blue-500/10 transition-colors text-blue-600 hover:text-blue-400"
              title="Cerrar sesión"
            >
              <ArrowLeftOnRectangleIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-10 min-h-screen">
        {renderContent()}
      </main>
    </div>
  )
}

function NavButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all
        ${active
          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
          : 'text-blue-600 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent'
        }
      `}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  )
}

function LoadingView() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-blue-500/50 text-xs admin-terminal-font">&gt; loading...</p>
      </div>
    </div>
  )
}

// Wrapper with provider
export default function AdminApp() {
  return (
    <AuthProvider>
      <AdminLayout />
    </AuthProvider>
  )
}

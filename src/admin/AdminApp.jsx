/**
 * Main Admin Dashboard layout
 * Terminal CRT theme matching the site preloader
 */

import React, { Suspense, lazy, useState, useEffect, useCallback } from 'react'
import { AuthProvider, useAdminAuth } from './useAdminAuth.jsx'
import AdminLogin from './AdminLogin'
import {
  FolderIcon,
  UserIcon,
  UserGroupIcon,
  MusicalNoteIcon,
  DocumentTextIcon,
  ChartBarIcon,
  EnvelopeIcon,
  ArrowLeftOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
  XMarkIcon,
  CommandLineIcon,
} from '@heroicons/react/24/solid'

// Lazy load views
const AdminDashboard = lazy(() => import('./AdminDashboard'))
const ProjectEditor = lazy(() => import('./ProjectEditor'))
const AboutEditor = lazy(() => import('./AboutEditor'))
const MusicEditor = lazy(() => import('./MusicEditor'))
const BlogEditor = lazy(() => import('./BlogEditor'))
const BlogList = lazy(() => import('./BlogList'))
const AnalyticsDashboard = lazy(() => import('./AnalyticsDashboard'))
const ContactInbox = lazy(() => import('./ContactInbox'))
const CodesEditor = lazy(() => import('./CodesEditor'))
const UsersPanel = lazy(() => import('./UsersPanel'))

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
  ANALYTICS: 'analytics',
  INBOX: 'inbox',
  CODES: 'codes',
  USERS: 'users',
}

// ── URL path <-> route mapping ──
const ROUTE_TO_PATH = {
  [ROUTES.DASHBOARD]: '/admin',
  [ROUTES.PROJECT_NEW]: '/admin/projects/new',
  [ROUTES.PROJECT_EDIT]: '/admin/projects/edit', // + /:id
  [ROUTES.ABOUT]: '/admin/about',
  [ROUTES.MUSIC]: '/admin/music',
  [ROUTES.BLOG_LIST]: '/admin/blog',
  [ROUTES.BLOG_NEW]: '/admin/blog/new',
  [ROUTES.BLOG_EDIT]: '/admin/blog/edit', // + /:id
  [ROUTES.ANALYTICS]: '/admin/analytics',
  [ROUTES.INBOX]: '/admin/inbox',
  [ROUTES.CODES]: '/admin/codes',
  [ROUTES.USERS]: '/admin/users',
}

/** Convert URL pathname to { route, params } */
function pathToRoute(pathname) {
  const p = pathname.replace(/\/+$/, '') || '/admin'

  // Routes with dynamic IDs
  const projectEditMatch = p.match(/^\/admin\/projects\/edit\/(.+)$/)
  if (projectEditMatch) return { route: ROUTES.PROJECT_EDIT, params: { id: projectEditMatch[1] } }

  const blogEditMatch = p.match(/^\/admin\/blog\/edit\/(.+)$/)
  if (blogEditMatch) return { route: ROUTES.BLOG_EDIT, params: { id: blogEditMatch[1] } }

  // Static routes (check longest paths first to avoid prefix conflicts)
  if (p === '/admin/projects/new') return { route: ROUTES.PROJECT_NEW }
  if (p === '/admin/blog/new') return { route: ROUTES.BLOG_NEW }
  if (p === '/admin/blog') return { route: ROUTES.BLOG_LIST }
  if (p === '/admin/about') return { route: ROUTES.ABOUT }
  if (p === '/admin/music') return { route: ROUTES.MUSIC }
  if (p === '/admin/analytics') return { route: ROUTES.ANALYTICS }
  if (p === '/admin/inbox') return { route: ROUTES.INBOX }
  if (p === '/admin/codes') return { route: ROUTES.CODES }
  if (p === '/admin/users') return { route: ROUTES.USERS }

  return { route: ROUTES.DASHBOARD }
}

/** Convert route + params to URL path */
function routeToPath(route, params = {}) {
  const base = ROUTE_TO_PATH[route] || '/admin'
  if ((route === ROUTES.PROJECT_EDIT || route === ROUTES.BLOG_EDIT) && params.id) {
    return `${base}/${params.id}`
  }
  return base
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
    color: #94a3b8;
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // ── Initialize route from URL (hooks MUST be before any early return) ──
  const initFromUrl = useCallback(() => {
    const { route, params } = pathToRoute(window.location.pathname)
    if (params?.id) {
      if (route === ROUTES.PROJECT_EDIT) setEditProjectId(params.id)
      if (route === ROUTES.BLOG_EDIT) setEditBlogId(params.id)
    }
    setCurrentRoute(route)
  }, [])

  // On mount: read route from URL
  useEffect(() => {
    initFromUrl()
  }, [initFromUrl])

  // Listen for browser back/forward
  useEffect(() => {
    const onPopState = () => initFromUrl()
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [initFromUrl])

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
    setMobileMenuOpen(false)

    // Update URL without reload
    const newPath = routeToPath(route, params)
    if (window.location.pathname !== newPath) {
      window.history.pushState({ route, ...params }, '', newPath)
    }
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
      case ROUTES.ANALYTICS:
        return (
          <Suspense fallback={<LoadingView />}>
            <AnalyticsDashboard />
          </Suspense>
        )
      case ROUTES.INBOX:
        return (
          <Suspense fallback={<LoadingView />}>
            <ContactInbox />
          </Suspense>
        )
      case ROUTES.CODES:
        return (
          <Suspense fallback={<LoadingView />}>
            <CodesEditor onBack={() => navigate(ROUTES.DASHBOARD)} />
          </Suspense>
        )
      case ROUTES.USERS:
        return (
          <Suspense fallback={<LoadingView />}>
            <UsersPanel />
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
      case ROUTES.ANALYTICS: return '~/analytics'
      case ROUTES.INBOX: return '~/inbox'
      case ROUTES.CODES: return '~/codes'
      case ROUTES.USERS: return '~/users'
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

      {/* Mobile Top Header */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-[10000] h-12 flex items-center justify-between px-4 border-b"
        style={{
          backgroundColor: 'rgba(0, 10, 30, 0.85)',
          borderColor: 'rgba(59, 130, 246, 0.2)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-2">
            <span className="text-blue-500/80 text-sm">admin@skulley-rad:</span>
            <span className="admin-cursor-blink text-blue-400 text-sm">_</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="p-1.5 rounded hover:bg-blue-500/10 transition-colors text-blue-400"
        >
          {mobileMenuOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
        </button>
      </header>

      {/* Desktop Sidebar (Lateral Nav) */}
      <aside
        className="hidden md:flex flex-col w-52 fixed top-0 bottom-0 left-0 z-[10000] border-r"
        style={{
          backgroundColor: 'rgba(0, 10, 30, 0.85)',
          borderColor: 'rgba(59, 130, 246, 0.2)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Sidebar Header (Fake Window Controls) */}
        <div className="p-4 border-b border-blue-500/20 flex flex-col gap-2">
            <div className="flex gap-1.5 mb-1 text-black">
                <button onClick={() => navigate(ROUTES.DASHBOARD)} className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 transition-colors" />
                <button onClick={() => navigate(ROUTES.DASHBOARD)} className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-400 transition-colors" />
                <button onClick={() => navigate(ROUTES.DASHBOARD)} className="w-3 h-3 rounded-full bg-blue-500/80 hover:bg-blue-400 transition-colors" />
            </div>
            <div className="text-blue-500/80 text-xs mt-1 break-all flex flex-col font-mono leading-relaxed">
                <span>admin@skulley:</span>
                <span>{getRoutePath()}<span className="admin-cursor-blink text-blue-400">_</span></span>
            </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto admin-scroll">
            <div className="px-2 py-1 text-[9px] admin-terminal-font text-blue-500/45 uppercase tracking-widest mt-1">content</div>
            <NavButton icon={FolderIcon} label="projects" active={currentRoute === ROUTES.DASHBOARD || currentRoute.startsWith('project')} onClick={() => navigate(ROUTES.DASHBOARD)} />
            <NavButton icon={UserIcon} label="about" active={currentRoute === ROUTES.ABOUT} onClick={() => navigate(ROUTES.ABOUT)} />
            <NavButton icon={MusicalNoteIcon} label="music" active={currentRoute === ROUTES.MUSIC} onClick={() => navigate(ROUTES.MUSIC)} />
            <NavButton icon={DocumentTextIcon} label="blog" active={currentRoute === ROUTES.BLOG_LIST || currentRoute.startsWith('blog')} onClick={() => navigate(ROUTES.BLOG_LIST)} />

            <div className="px-2 py-1 text-[9px] admin-terminal-font text-blue-500/45 uppercase tracking-widest mt-4">monitor</div>
            <NavButton icon={ChartBarIcon} label="analytics" active={currentRoute === ROUTES.ANALYTICS} onClick={() => navigate(ROUTES.ANALYTICS)} />
            <NavButton icon={EnvelopeIcon} label="inbox" active={currentRoute === ROUTES.INBOX} onClick={() => navigate(ROUTES.INBOX)} />
            <NavButton icon={CommandLineIcon} label="codes" active={currentRoute === ROUTES.CODES} onClick={() => navigate(ROUTES.CODES)} />
            <NavButton icon={UserGroupIcon} label="users" active={currentRoute === ROUTES.USERS} onClick={() => navigate(ROUTES.USERS)} />

            <div className="mt-4 pt-4 border-t border-blue-500/10">
                <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-3 py-2 rounded text-sm text-blue-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all font-mono">
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" /> view_site
                </a>
            </div>
        </nav>

        {/* User / Logout */}
        <div className="p-3 border-t border-blue-500/20 flex flex-col gap-3">
             <div className="flex items-center gap-2 px-1">
                 {user?.avatar_url && <img src={user.avatar_url} alt="Avatar" className="w-6 h-6 rounded border border-blue-500/30" />}
                 <span className="text-xs text-blue-400/80 truncate font-mono">{user?.name || user?.email}</span>
             </div>
             <button onClick={logout} className="flex items-center gap-2.5 px-2 py-1.5 text-sm font-mono text-red-500/70 hover:text-red-400 hover:bg-red-500/10 rounded transition-all">
                 <ArrowLeftOnRectangleIcon className="w-4 h-4" /> logout
             </button>
        </div>
      </aside>

      {/* Mobile dropdown nav */}
      {mobileMenuOpen && (
        <div
          className="fixed top-12 left-0 right-0 bottom-0 z-[9999] md:hidden admin-fade-in overflow-y-auto"
          style={{
            backgroundColor: 'rgba(0, 10, 30, 0.98)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex flex-col p-4 gap-1">
            <div className="px-3 py-1 text-[9px] admin-terminal-font text-blue-500/45 uppercase tracking-widest mt-2">content</div>
            <NavButton icon={FolderIcon} label="projects" active={currentRoute === ROUTES.DASHBOARD || currentRoute.startsWith('project')} onClick={() => navigate(ROUTES.DASHBOARD)} />
            <NavButton icon={UserIcon} label="about" active={currentRoute === ROUTES.ABOUT} onClick={() => navigate(ROUTES.ABOUT)} />
            <NavButton icon={MusicalNoteIcon} label="music" active={currentRoute === ROUTES.MUSIC} onClick={() => navigate(ROUTES.MUSIC)} />
            <NavButton icon={DocumentTextIcon} label="blog" active={currentRoute === ROUTES.BLOG_LIST || currentRoute.startsWith('blog')} onClick={() => navigate(ROUTES.BLOG_LIST)} />

            <div className="px-3 py-1 text-[9px] admin-terminal-font text-blue-500/45 uppercase tracking-widest mt-4">monitor</div>
            <NavButton icon={ChartBarIcon} label="analytics" active={currentRoute === ROUTES.ANALYTICS} onClick={() => navigate(ROUTES.ANALYTICS)} />
            <NavButton icon={EnvelopeIcon} label="inbox" active={currentRoute === ROUTES.INBOX} onClick={() => navigate(ROUTES.INBOX)} />
            <NavButton icon={CommandLineIcon} label="codes" active={currentRoute === ROUTES.CODES} onClick={() => navigate(ROUTES.CODES)} />
            <NavButton icon={UserGroupIcon} label="users" active={currentRoute === ROUTES.USERS} onClick={() => navigate(ROUTES.USERS)} />

            <div className="mt-6 pt-4 border-t border-blue-500/20">
                <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-3 rounded text-sm text-blue-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all font-mono">
                    <ArrowTopRightOnSquareIcon className="w-5 h-5" /> view_site
                </a>
                <button onClick={logout} className="flex items-center gap-3 px-3 py-3 rounded text-sm font-mono text-red-500/80 hover:text-red-400 hover:bg-red-500/10 transition-all w-full text-left mt-2">
                    <ArrowLeftOnRectangleIcon className="w-5 h-5" /> logout
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="pt-12 md:pt-0 md:pl-52 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto h-full">
            {renderContent()}
        </div>
      </main>
    </div>
  )
}

function NavButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-3 px-3 py-2.5 w-full rounded text-sm transition-all text-left font-mono
        ${active
          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
          : 'text-blue-500/80 hover:text-blue-300 hover:bg-blue-500/10 border border-transparent'
        }
      `}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}

function LoadingView() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-blue-400/70 text-xs admin-terminal-font">&gt; loading...</p>
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

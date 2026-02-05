/**
 * Layout principal del Admin Dashboard
 * Diseño futurista con glassmorphism
 */

import React, { Suspense, lazy } from 'react'
import { AuthProvider, useAdminAuth } from './useAdminAuth.jsx'
import AdminLogin from './AdminLogin'
import {
  FolderIcon,
  UserIcon,
  ArrowLeftOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/solid'

// Lazy load de vistas
const AdminDashboard = lazy(() => import('./AdminDashboard'))
const ProjectEditor = lazy(() => import('./ProjectEditor'))
const AboutEditor = lazy(() => import('./AboutEditor'))

// Rutas internas del admin
const ROUTES = {
  DASHBOARD: 'dashboard',
  PROJECT_NEW: 'project-new',
  PROJECT_EDIT: 'project-edit',
  ABOUT: 'about',
}

function AdminLayout() {
  const { user, loading, logout, isAuthenticated } = useAdminAuth()
  const [currentRoute, setCurrentRoute] = React.useState(ROUTES.DASHBOARD)
  const [editProjectId, setEditProjectId] = React.useState(null)

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <AdminLogin />
  }

  const navigate = (route, params = {}) => {
    if (route === ROUTES.PROJECT_EDIT && params.id) {
      setEditProjectId(params.id)
    } else {
      setEditProjectId(null)
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

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 backdrop-blur-xl border-b border-white/10" style={{ backgroundColor: 'rgba(10, 10, 10, 0.8)' }}>
        <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between">
          {/* Logo / Title - Estilo del sitio */}
          <button
            onClick={() => navigate(ROUTES.DASHBOARD)}
            className="hover:opacity-80 transition-opacity"
          >
            <span
              className="text-xl tracking-wide"
              style={{ fontFamily: "'Luckiest Guy', cursive" }}
            >
              <span className="text-white">WELCOME, </span>
              <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                SKULLEY RAD
              </span>
            </span>
          </button>

          {/* Nav - Solo Proyectos y About */}
          <nav className="hidden sm:flex items-center gap-1">
            <NavButton
              icon={FolderIcon}
              label="Proyectos"
              active={currentRoute === ROUTES.DASHBOARD || currentRoute.startsWith('project')}
              onClick={() => navigate(ROUTES.DASHBOARD)}
            />
            <NavButton
              icon={UserIcon}
              label="About"
              active={currentRoute === ROUTES.ABOUT}
              onClick={() => navigate(ROUTES.ABOUT)}
            />
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              <span>Ver sitio</span>
            </a>
          </nav>

          {/* User */}
          <div className="flex items-center gap-3">
            {user?.avatar_url && (
              <img
                src={user.avatar_url}
                alt={user.name || 'Avatar'}
                className="w-8 h-8 rounded-full border-2 border-white/20"
              />
            )}
            <span className="hidden sm:block text-sm text-white/70 max-w-[120px] truncate">
              {user?.name || user?.email}
            </span>
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
              title="Cerrar sesión"
            >
              <ArrowLeftOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-16 min-h-screen">
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
        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
        ${active
          ? 'bg-white/10 text-white'
          : 'text-white/60 hover:text-white hover:bg-white/5'
        }
      `}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  )
}

function LoadingView() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// Wrapper con provider
export default function AdminApp() {
  return (
    <AuthProvider>
      <AdminLayout />
    </AuthProvider>
  )
}

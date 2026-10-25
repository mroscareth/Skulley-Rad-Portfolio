/**
 * Layout del CMS: navegación lateral + vista activa.
 * Sistema visual en admin.css (DESIGN.md §15) — mismo lenguaje que la Store.
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
  TicketIcon,
  ShoppingBagIcon,
  CubeIcon,
  TruckIcon,
  Cog6ToothIcon,
  KeyIcon,
} from '@heroicons/react/24/solid'
import './admin.css'

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
const ShopEditor = lazy(() => import('./ShopEditor'))
const ProductsPanel = lazy(() => import('./shop/ProductsPanel'))
const OrdersPanel = lazy(() => import('./shop/OrdersPanel'))
const StoreSettingsPanel = lazy(() => import('./shop/StoreSettingsPanel'))
const McpTokensPanel = lazy(() => import('./McpTokensPanel'))

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
  SHOP: 'shop',
  SHOP_ORDERS: 'shop-orders',
  SHOP_PRODUCTS: 'shop-products',
  SHOP_SETTINGS: 'shop-settings',
  MCP_TOKENS: 'mcp-tokens',
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
  [ROUTES.SHOP]: '/admin/shop',
  [ROUTES.SHOP_ORDERS]: '/admin/shop/orders',
  [ROUTES.SHOP_PRODUCTS]: '/admin/shop/products',
  [ROUTES.SHOP_SETTINGS]: '/admin/shop/settings',
  [ROUTES.MCP_TOKENS]: '/admin/mcp',
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
  if (p === '/admin/shop') return { route: ROUTES.SHOP }
  if (p === '/admin/shop/orders') return { route: ROUTES.SHOP_ORDERS }
  if (p === '/admin/shop/products') return { route: ROUTES.SHOP_PRODUCTS }
  if (p === '/admin/shop/settings') return { route: ROUTES.SHOP_SETTINGS }
  if (p === '/admin/mcp') return { route: ROUTES.MCP_TOKENS }

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
    // `_` es el anti-caché que auth.php agrega al volver del login de Google;
    // no tiene por qué quedarse en la barra de direcciones.
    const url = new URL(window.location.href)
    if (url.searchParams.has('_')) {
      url.searchParams.delete('_')
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    }
  }, [initFromUrl])

  // Listen for browser back/forward
  useEffect(() => {
    const onPopState = () => initFromUrl()
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [initFromUrl])

  if (loading) {
    return (
      <div className="admin-root grid place-items-center">
        <div className="a-spinner" role="status" aria-label="Cargando…" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-root">
        <AdminLogin />
      </div>
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
      case ROUTES.SHOP:
        return (
          <Suspense fallback={<LoadingView />}>
            <ShopEditor onBack={() => navigate(ROUTES.DASHBOARD)} />
          </Suspense>
        )
      case ROUTES.SHOP_ORDERS:
        return (
          <Suspense fallback={<LoadingView />}>
            {/* ?id=X llega desde el correo de "nuevo pedido". */}
            <OrdersPanel
              onBack={() => navigate(ROUTES.DASHBOARD)}
              initialOrderId={new URLSearchParams(window.location.search).get('id')}
            />
          </Suspense>
        )
      case ROUTES.SHOP_PRODUCTS:
        return (
          <Suspense fallback={<LoadingView />}>
            <ProductsPanel onBack={() => navigate(ROUTES.DASHBOARD)} />
          </Suspense>
        )
      case ROUTES.SHOP_SETTINGS:
        return (
          <Suspense fallback={<LoadingView />}>
            <StoreSettingsPanel onBack={() => navigate(ROUTES.DASHBOARD)} />
          </Suspense>
        )
      case ROUTES.MCP_TOKENS:
        return (
          <Suspense fallback={<LoadingView />}>
            <McpTokensPanel />
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

  const isActive = (item) => item.routes.includes(currentRoute)

  const navList = (
    <nav className="flex flex-col gap-6" aria-label="CMS">
      {NAV.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <div className="a-nav-group mb-1.5">{group.label}</div>
          {group.items.map((item) => (
            <button
              key={item.route}
              type="button"
              className="a-nav-item"
              aria-current={isActive(item) ? 'page' : undefined}
              onClick={() => navigate(item.route)}
            >
              <item.icon className="w-[1.125rem] h-[1.125rem] flex-shrink-0" aria-hidden />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  )

  const userBlock = (
    <div className="flex flex-col gap-3">
      <a href="/" target="_blank" rel="noopener noreferrer" className="a-nav-item">
        <ArrowTopRightOnSquareIcon className="w-[1.125rem] h-[1.125rem] flex-shrink-0" aria-hidden />
        <span>Ver sitio</span>
      </a>
      <div className="flex items-center gap-3 px-2">
        {user?.avatar_url
          ? <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full border-2 border-white/10 flex-shrink-0" />
          : <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />}
        <span className="text-sm text-white/70 truncate flex-1 min-w-0">{user?.name || user?.email}</span>
        <button type="button" onClick={logout} className="a-icon-btn a-icon-btn--sm a-icon-btn--danger" aria-label="Cerrar sesión" title="Cerrar sesión">
          <ArrowLeftOnRectangleIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="admin-root">
      {/* Barra superior (mobile) */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 bg-[var(--a-surface)] border-b-2 border-white/10">
        <Brand />
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="a-icon-btn"
          aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
        </button>
      </header>

      {/* Navegación lateral (desktop) */}
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 z-40 bg-[var(--a-surface)] border-r-2 border-white/10">
        <div className="px-6 pt-7 pb-6">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto a-scroll px-3 pb-6">{navList}</div>
        <div className="px-3 py-4 border-t-2 border-white/10">{userBlock}</div>
      </aside>

      {/* Menú (mobile) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 bottom-0 z-40 bg-[var(--a-surface)] overflow-y-auto a-scroll a-fade-in">
          <div className="flex flex-col gap-8 p-4">
            {navList}
            <div className="pt-4 border-t-2 border-white/10">{userBlock}</div>
          </div>
        </div>
      )}

      <main className="pt-14 md:pt-0 md:pl-64 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  )
}

const NAV = [
  {
    label: 'Contenido',
    items: [
      { route: ROUTES.DASHBOARD, label: 'Proyectos', icon: FolderIcon, routes: [ROUTES.DASHBOARD, ROUTES.PROJECT_NEW, ROUTES.PROJECT_EDIT] },
      { route: ROUTES.ABOUT, label: 'Acerca de', icon: UserIcon, routes: [ROUTES.ABOUT] },
      { route: ROUTES.MUSIC, label: 'Música', icon: MusicalNoteIcon, routes: [ROUTES.MUSIC] },
      // La sección se llama Memories/Memorias en el sitio; las rutas y la
      // tabla siguen siendo blog_* porque la URL pública es /blog/{slug} y
      // ya está indexada.
      { route: ROUTES.BLOG_LIST, label: 'Memorias', icon: DocumentTextIcon, routes: [ROUTES.BLOG_LIST, ROUTES.BLOG_NEW, ROUTES.BLOG_EDIT] },
    ],
  },
  {
    label: 'Tienda',
    items: [
      { route: ROUTES.SHOP_ORDERS, label: 'Pedidos', icon: TruckIcon, routes: [ROUTES.SHOP_ORDERS] },
      { route: ROUTES.SHOP_PRODUCTS, label: 'Productos', icon: CubeIcon, routes: [ROUTES.SHOP_PRODUCTS] },
      { route: ROUTES.SHOP, label: 'Portada de la tienda', icon: ShoppingBagIcon, routes: [ROUTES.SHOP] },
      { route: ROUTES.CODES, label: 'Códigos de descuento', icon: TicketIcon, routes: [ROUTES.CODES] },
      { route: ROUTES.SHOP_SETTINGS, label: 'Ajustes de la tienda', icon: Cog6ToothIcon, routes: [ROUTES.SHOP_SETTINGS] },
    ],
  },
  {
    label: 'Monitoreo',
    items: [
      { route: ROUTES.ANALYTICS, label: 'Estadísticas', icon: ChartBarIcon, routes: [ROUTES.ANALYTICS] },
      { route: ROUTES.INBOX, label: 'Mensajes', icon: EnvelopeIcon, routes: [ROUTES.INBOX] },
      { route: ROUTES.USERS, label: 'Usuarios', icon: UserGroupIcon, routes: [ROUTES.USERS] },
    ],
  },
  {
    label: 'Acceso',
    items: [
      { route: ROUTES.MCP_TOKENS, label: 'Llaves de acceso', icon: KeyIcon, routes: [ROUTES.MCP_TOKENS] },
    ],
  },
]

function Brand() {
  return (
    <div className="flex items-baseline gap-2">
      <span className="a-title text-[1.5rem]">Skulley Rad</span>
      <span className="a-meta">CMS</span>
    </div>
  )
}

function LoadingView() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="a-spinner" role="status" aria-label="Cargando…" />
    </div>
  )
}

// Wrapper with provider
export default function AdminApp() {
  // El sitio público vive en inglés (lang="en" en index.html); el CMS es en
  // español, y así lo leen los lectores de pantalla y el traductor del navegador.
  useEffect(() => {
    const prev = document.documentElement.lang
    document.documentElement.lang = 'es-MX'
    return () => { document.documentElement.lang = prev }
  }, [])

  return (
    <AuthProvider>
      <AdminLayout />
    </AuthProvider>
  )
}

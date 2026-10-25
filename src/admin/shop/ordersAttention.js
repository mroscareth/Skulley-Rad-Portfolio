import { useCallback, useEffect, useRef, useState } from 'react'
import { getOrdersAttention } from './shopAdminApi.js'

// Esferita de "Pedidos" en el menú del CMS: cuántos pedidos te piden algo
// (por enviar, disputa abierta, o pagados desde tu última visita a Pedidos).
// La última visita se guarda en este navegador, con la hora del servidor.
const SEEN_KEY = 'skulley_cms_orders_seen_at'
const CHANGED = 'cms-orders-changed'
// Cada minuto aunque la pestaña esté en segundo plano: el número en el título
// de la pestaña es justo para cuando estás en otra.
const POLL_MS = 60_000

export function getOrdersSeenAt() {
  try { return localStorage.getItem(SEEN_KEY) || '' } catch { return '' }
}

/** Al abrir Pedidos: lo pagado hasta ahora deja de ser "nuevo". */
export async function markOrdersSeen() {
  try {
    const { now } = await getOrdersAttention()
    if (now) localStorage.setItem(SEEN_KEY, now)
  } catch { /* sin red o sin storage: se reintenta en la próxima visita */ }
  notifyOrdersChanged()
}

/** Algo cambió en un pedido (enviado, disputa atendida…): recalcular la esferita. */
export function notifyOrdersChanged() {
  window.dispatchEvent(new Event(CHANGED))
}

/** "2 por enviar · 1 disputa abierta · 1 pedido nuevo" */
export function attentionSummary(a) {
  if (!a) return ''
  const parts = []
  if (a.to_ship > 0) parts.push(`${a.to_ship} por enviar`)
  if (a.disputes > 0) parts.push(`${a.disputes} ${a.disputes === 1 ? 'disputa abierta' : 'disputas abiertas'}`)
  if (a.new > 0) parts.push(`${a.new} ${a.new === 1 ? 'pedido nuevo' : 'pedidos nuevos'}`)
  return parts.join(' · ')
}

export function useOrdersAttention(enabled = true) {
  const [data, setData] = useState(null)
  const seqRef = useRef(0)

  const refresh = useCallback(async () => {
    // Una respuesta lenta no debe pisar una más nueva.
    const seq = ++seqRef.current
    try {
      const res = await getOrdersAttention(getOrdersSeenAt())
      if (seq === seqRef.current) setData(res)
    } catch { /* se queda el último número; el siguiente ciclo reintenta */ }
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    refresh()
    const id = setInterval(refresh, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(CHANGED, refresh)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(CHANGED, refresh)
    }
  }, [enabled, refresh])

  return data
}

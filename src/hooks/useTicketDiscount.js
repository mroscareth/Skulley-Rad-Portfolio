import { useEffect } from 'react'
import { useActiveDiscount, GOLDEN_TICKET_DISCOUNT, isGoldenTicketSaved } from '../lib/useActiveDiscount.js'

// El ticket del minigame en el carrito. Lo usan App.jsx y el sitio de teléfono
// (MobileApp), para que en los dos el descuento salga del mismo lugar.
//
// Active cart discount (en memoria). Single slot: hoy solo lo puebla el
// golden ticket que el user gana en el minigame. Los códigos promocionales se
// escriben directo en el checkout de Stripe.
//
// Auto-aplicar el ticket del minigame (Silver 10 % o Golden 35 %): si el
// profile lo tiene sin quemar, aparece en el carrito con su % y su nombre.
// No se re-aplica si el user lo guardó para otra compra
// (isGoldenTicketSaved). Sin sesión, o con el ticket ya quemado, se retira.
// `golden_ticket` = tiene un ticket de cualquier nivel (game-tickets.php).
export default function useTicketDiscount(userProfile) {
  const { apply: applyDiscount, clear: clearDiscount, active: activeDiscount } = useActiveDiscount()

  const goldenTicketAvailable = !!userProfile?.profile?.golden_ticket && !userProfile?.profile?.ticket_burned
  const ticketTier = goldenTicketAvailable ? (userProfile?.profile?.ticket_tier || 'gold') : null
  const ticketPct = goldenTicketAvailable ? Number(userProfile?.profile?.ticket_pct || 0) : 0
  const ticketLabel = ticketTier === 'silver' ? 'Silver Ticket' : 'Golden Ticket'
  useEffect(() => {
    if (!goldenTicketAvailable || !ticketPct) {
      if (activeDiscount?.code === GOLDEN_TICKET_DISCOUNT.code) clearDiscount()
      return
    }
    if (isGoldenTicketSaved()) return
    if (activeDiscount?.code === GOLDEN_TICKET_DISCOUNT.code && activeDiscount?.pct === ticketPct && activeDiscount?.label === ticketLabel) return
    applyDiscount({
      ...GOLDEN_TICKET_DISCOUNT,
      pct: ticketPct,
      label: ticketLabel,
      rarity: ticketTier === 'silver' ? 'rare' : 'legendary',
    })
  }, [
    userProfile?.profile,
    goldenTicketAvailable,
    ticketPct,
    ticketTier,
    ticketLabel,
    activeDiscount?.code,
    activeDiscount?.pct,
    activeDiscount?.label,
    applyDiscount,
    clearDiscount,
  ])

  return { goldenTicketAvailable, ticketTier, ticketPct }
}

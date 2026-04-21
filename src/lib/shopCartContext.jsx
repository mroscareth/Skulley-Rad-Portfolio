// ShopCart shared context — para que el botón global en App.jsx y la tienda
// lean/escriban el MISMO estado de carrito. useShopCart leído directo en
// componentes separados daría states desincronizados porque storage event
// no dispara en la misma tab que escribió.

import React, { createContext, useContext } from 'react'
import { useShopCart } from './useShopCart.js'

const ShopCartContext = createContext(null)

export function ShopCartProvider({ children }) {
  const cart = useShopCart()
  return (
    <ShopCartContext.Provider value={cart}>
      {children}
    </ShopCartContext.Provider>
  )
}

export function useShopCartCtx() {
  const ctx = useContext(ShopCartContext)
  if (!ctx) throw new Error('useShopCartCtx must be used within ShopCartProvider')
  return ctx
}

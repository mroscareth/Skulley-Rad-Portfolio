import React from 'react'
import Shop from './shop/Shop.jsx'

// Section3 = STORE. Delegamos al shell del shop.
export default function Section3({ initialSlug = null, onSlugChange }) {
  return <Shop initialSlug={initialSlug} onSlugChange={onSlugChange} />
}

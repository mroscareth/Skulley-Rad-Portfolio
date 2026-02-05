import React from 'react'

const ITEMS = [
  {
    id: 'item-heritage',
    title: 'Heritage Design Studio',
    image: `${import.meta.env.BASE_URL}heritage.jpg`,
    url: 'https://www.theheritage.mx/',
    slug: 'heritage',
  },
  {
    id: 'item-ethereans',
    title: 'The Ethereans',
    image: `${import.meta.env.BASE_URL}Etherean.jpg`,
    url: 'https://ethereans.xyz/',
    slug: 'ethereans',
  },
  {
    id: 'item-arttoys',
    title: 'Art Toys',
    image: `${import.meta.env.BASE_URL}ArtToys/HouseBird.jpg`,
    url: null,
    slug: 'arttoys',
  },
  {
    id: 'item-heads',
    title: '3D Heads',
    image: `${import.meta.env.BASE_URL}3dheads.webp`,
    url: null,
    slug: 'heads',
  },
  {
    id: 'item-2dheads',
    title: '2D Heads',
    image: `${import.meta.env.BASE_URL}2DHeads/cover.webp`,
    url: null,
    slug: '2dheads',
  },
]

// Static version: shows only Heritage, no navigation or animations
export default function WorkCarousel() {
  const heritage = ITEMS[0]

  return (
    <div
      className="relative w-full min-h-[70vh] select-none outline-none"
      role="listbox"
      aria-activedescendant={`work-item-${heritage?.id}`}
      tabIndex={-1}
      style={{ overflow: 'hidden' }}
    >
      {/* Single static card: Heritage */}
      <div className="absolute inset-0 grid place-items-center">
        <div
          id={`work-item-${heritage.id}`}
          role="option"
          aria-selected="true"
          className="w-[min(880px,92vw)]"
          style={{ transform: 'translateZ(0)' }}
        >
          <WorkCard item={heritage} />
        </div>
      </div>
    </div>
  )
}

function WorkCard({ item }) {
  return (
    <article className="rounded-2xl overflow-hidden bg-white/95 text-black shadow-xl">
      <div className="aspect-[16/10] w-full overflow-hidden bg-black">
        <img
          src={item.image}
          alt={item.title}
          className="w-full h-full object-cover"
          decoding="async"
          loading="eager"
        />
      </div>
      <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
        <h3 className="text-lg sm:text-xl font-extrabold">{item.title}</h3>
        {item.url ? (
          <a
            className="h-10 px-4 rounded-full bg-black text-white grid place-items-center text-sm font-bold hover:bg-black/90"
            href={item.url}
            target="_blank"
            rel="noreferrer"
          >
            Visit
          </a>
        ) : null}
      </div>
    </article>
  )
}

import React from 'react'

// Nota de bienvenida — texto corto y divertido entre el hero y el featured.
// Mantiene la sátira corporativa de M.A.D.R.E. (propósito absurdo tipo
// "data center en la luna"). EN + ES.
export default function WelcomeNote({ lang = 'en' }) {
  const isEn = lang === 'en'
  // La frase de arriba va en display grande; el resto en body. Partirla así
  // evita que un párrafo entero en Luckiest Guy se vuelva ilegible.
  const hook = isEn ? 'We are selling everything he owned.' : 'Estamos vendiendo todo lo que tuvo.'
  const body = isEn
    ? 'Welcome to Skulley Rad’s lost-and-found shop. We’ve decided to sell all of his earthly possessions to fund a new data center on the moon. Thanks for your support — your kind contribution would make Skulley Rad very happy if he were still among us.'
    : 'Bienvenido a la tienda de objetos perdidos de Skulley Rad. Hemos decidido vender todas sus pertenencias terrenales para financiar un nuevo data center en la luna. Gracias por el apoyo — tu gentil aportación lo haría muy feliz si siguiera entre nosotros.'
  const signOff = isEn
    ? 'With all the processing of my chips,'
    : 'Con todo el procesamiento de mis chips,'

  return (
    <section className="relative w-full px-4 sm:px-8 lg:px-10 py-12 sm:py-24">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-8 lg:gap-16 items-start">
          <div>
            <p className="shop-display shop-display--lg">{hook}</p>
          </div>

          <div className="lg:pt-4">
            <p className="text-white/75 text-base sm:text-xl leading-relaxed">
              {body}
            </p>
            <div className="mt-6 sm:mt-8">
              <p className="text-white/45 text-sm sm:text-base italic">{signOff}</p>
              <p className="shop-display shop-display--md text-[#e600ff] mt-1">
                M.A.D.R.E.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

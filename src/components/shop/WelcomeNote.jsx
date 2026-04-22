import React from 'react'

// Nota de bienvenida — texto corto y divertido entre el hero y el featured.
// Mantiene la sátira corporativa de M.A.D.R.E. (propósito absurdo tipo
// "data center en la luna"). EN + ES.
export default function WelcomeNote({ lang = 'en' }) {
  const isEn = lang === 'en'
  const heading = isEn ? '> welcome_note.txt' : '> nota_bienvenida.txt'
  const body = isEn
    ? 'Welcome to Skulley Rad\u2019s lost-and-found shop. We\u2019ve decided to sell all of his earthly possessions to fund a new data center on the moon. Thanks for your support — your kind contribution would make Skulley Rad very happy if he were still among us.'
    : 'Bienvenido a la tienda de objetos perdidos de Skulley Rad. Hemos decidido vender todas sus pertenencias terrenales para financiar un nuevo data center en la luna. Gracias por el apoyo — tu gentil aportación lo haría muy feliz si siguiera entre nosotros.'
  const signOff = isEn
    ? 'With all the processing of my chips,'
    : 'Con todo el procesamiento de mis chips,'

  return (
    <section
      className="relative w-full px-4 sm:px-10 py-6 sm:py-14 bg-black rounded-2xl overflow-hidden"
      style={{ fontFamily: '"Cascadia Code", "Fira Code", monospace' }}
    >
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-[#e600ff]/70 text-[10px] sm:text-sm uppercase tracking-[0.3em] sm:tracking-[0.35em] mb-3 sm:mb-4">
          {heading}
        </p>

        {/* Cuerpo — pull-quote en Cascadia Code para mantener el flavor terminal */}
        <p
          className="text-white/85 text-base sm:text-2xl leading-relaxed"
          style={{ fontFamily: '"Cascadia Code", "Fira Code", monospace' }}
        >
          {body}
        </p>

        {/* Firma satírica de M.A.D.R.E. */}
        <div
          className="mt-5 sm:mt-6 text-white/70 text-xs sm:text-base italic"
          style={{ fontFamily: '"Cascadia Code", "Fira Code", monospace' }}
        >
          <p>{signOff}</p>
          <p className="mt-1 not-italic font-bold tracking-widest text-[#e600ff]">
            M.A.D.R.E.
          </p>
        </div>
      </div>
    </section>
  )
}

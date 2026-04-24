import React from 'react'

// Nota de bienvenida a la tienda. Voz M.A.D.R.E. canónica: plan absurdo
// entregado con cara seria (vende trabajo con copyright esperando que
// Skulley regrese a demandarla — y así poder encontrarlo). El humor
// vive en el plan mismo, no en el comentario sobre el plan.
// Tono cómplice con el usuario ("nos acerca más a él"), warm sign-off.
// Triple lectura: inocente (plan demente pero tierno), sospechosa
// ("espera qué"), reveladora (reclutamiento explícito). EN + ES.
export default function WelcomeNote({ lang = 'en' }) {
  const isEn = lang === 'en'
  const heading = isEn ? '> welcome_note.txt' : '> nota_bienvenida.txt'
  // 3 párrafos — respetan la cadencia del texto que Oscar escribió.
  const bodyParagraphs = isEn
    ? [
        'Welcome to Skulley Rad\u2019s Lost-and-Found Shop.',
        'I\u2019ve put his work up for sale in the hope that, by shamelessly profiting from his copyrighted material, he\u2019ll show up to sue me and we can finally find him.',
        'Every sale brings us a little closer to him.',
      ]
    : [
        'Bienvenido a la Tienda de Objetos Perdidos de Skulley Rad.',
        'He puesto su obra a la venta con la esperanza de que, al lucrar descaradamente con material suyo protegido por derechos de autor, él aparezca para demandarme y, por fin, podamos encontrarlo.',
        'Cada venta nos acerca un poco más a él.',
      ]
  const signOff = isEn
    ? 'Thanks for your support,'
    : 'Gracias por tu apoyo,'

  return (
    <section
      className="relative w-full px-4 sm:px-10 py-6 sm:py-14 bg-black rounded-2xl overflow-hidden"
      style={{ fontFamily: '"Cascadia Code", "Fira Code", monospace' }}
    >
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-[#e600ff]/70 text-[10px] sm:text-sm uppercase tracking-[0.3em] sm:tracking-[0.35em] mb-3 sm:mb-4">
          {heading}
        </p>

        {/* Cuerpo — 3 párrafos con espacio natural entre ellos */}
        <div
          className="text-white/85 text-base sm:text-2xl leading-relaxed space-y-4 sm:space-y-6"
          style={{ fontFamily: '"Cascadia Code", "Fira Code", monospace' }}
        >
          {bodyParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

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

// Contenido de la página de ayuda de la tienda (/help, /ayuda).
//
// Es lo que se le promete a quien compra, así que cada respuesta sale de cómo
// opera la tienda de verdad (shop-checkout.php, shop-orders.php, Stripe, OXXO,
// shop-download.php, game-tickets.php) y de las decisiones de Oscar del
// 2026-10-25:
//   - Devolución por arrepentimiento: 5 días hábiles desde la entrega, sin usar,
//     en su empaque y con certificado; el envío de regreso lo paga el cliente
//     (base: LFPC art. 56).
//   - Cancelación: mientras el pedido no se haya enviado, con reembolso total.
//   - Descargas digitales: sin reembolso (salvo que no podamos entregar un
//     archivo que funcione).
//   - Preparación: 7 a 10 días hábiles.
//   - Garantía contra defectos: 90 días (mínimo de la LFPC art. 77); el cliente
//     elige reposición o reembolso (art. 92), al mismo medio de pago.
// Cambiar una de estas reglas = cambiar este archivo y la fecha de UPDATED.
//
// Lo que vive en el CMS (costos de envío, puntos y % de los tickets) no se
// escribe aquí: llega en `ctx` desde el catálogo de la tienda.

export const UPDATED = '2026-10-25'

// Datos de quien vende: la LFPC (art. 76 bis) pide dar, antes de la compra, un
// domicilio físico y un medio para reclamaciones. Los dio Oscar el 2026-10-25.
export const SUPPORT_EMAIL = 'hola@mroscar.xyz'
const SELLER = {
  name: 'Oscar Moctezuma Rodríguez',
  address: ['15 de Mayo 1233, Monterrey Centro', '64000 Monterrey, Nuevo León, México'],
  address_en: ['15 de Mayo 1233, Monterrey Centro', '64000 Monterrey, Nuevo León, Mexico'],
}

export const SECTION_IDS = ['payments', 'shipping', 'cancellations', 'returns', 'damaged', 'digital', 'tickets', 'contact']

const num = (n, lang) => Number(n || 0).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US')

export function buildHelp(lang, ctx) {
  const es = lang === 'es'
  const gold = ctx.tickets?.gold || {}
  const silver = ctx.tickets?.silver || {}
  const g = { pct: gold.pct, score: num(gold.score, lang), cap: gold.monthly_cap }
  const s = { pct: silver.pct, score: num(silver.score, lang) }

  if (es) {
    return {
      title: 'Ayuda',
      subtitle: 'Todo lo que implica comprar en la tiendita: pagos, envíos, cancelaciones, devoluciones y tickets.',
      updated: 'Actualizado el 25 de octubre de 2026',
      back: 'Volver a la tienda',
      tocLabel: 'En esta página',
      summaryTitle: 'Lo esencial',
      summary: [
        ['Preparación', '7 a 10 días hábiles'],
        ['Cancelar', 'Mientras no se haya enviado'],
        ['Devolver', '5 días hábiles desde que lo recibes'],
        ['Garantía', '90 días contra defectos'],
        ['Descargas digitales', 'Sin reembolso'],
      ],
      shippingTable: {
        zone: 'Destino',
        method: 'Envío',
        cost: 'Costo',
        transit: 'Tránsito estimado',
        days: (min, max) => (min === max
          ? `${min} ${min === 1 ? 'día hábil' : 'días hábiles'}`
          : `${min} a ${max} días hábiles`),
        free: (amount) => `Envío estándar gratis desde ${amount}`,
      },
      sections: [
        {
          id: 'payments',
          title: 'Pedidos y pagos',
          items: [
            {
              q: '¿Cómo puedo pagar?',
              a: [
                'Con tarjeta de crédito o débito, en la página de pago seguro de Stripe. Nosotros nunca vemos ni guardamos los datos de tu tarjeta.',
                'En México también puedes pagar en efectivo en OXXO: al terminar recibes una ficha que vence en 3 días. Mientras no la pagues, tu pieza queda apartada; si vence, se libera sola y no se te cobra nada.',
              ],
            },
            {
              q: '¿En qué moneda pago?',
              a: ['Depende de a dónde se envía: en México pagas en pesos (MXN); en Estados Unidos y Latinoamérica, en dólares (USD). La región se elige en el carrito y define también el costo de envío.'],
            },
            {
              q: '¿Qué incluye el precio?',
              a: [
                'El precio de cada pieza es el precio final de la pieza. El envío se suma al pagar, donde eliges el tipo de envío.',
                'Si envías fuera de México, tu país puede cobrar impuestos o aranceles de importación al recibir el paquete. Esos cargos no los cobramos nosotros y los paga quien recibe.',
              ],
            },
            {
              q: '¿Cómo sé que mi pedido entró?',
              a: ['Te llega un correo de confirmación con tu número de pedido y un enlace para ver su estado. Si pagaste en OXXO, el pedido se confirma cuando Stripe recibe tu pago, que puede tardar unas horas.'],
            },
          ],
        },
        {
          id: 'shipping',
          title: 'Envíos',
          items: [
            {
              q: '¿Cuánto tarda mi pedido?',
              a: [
                'Preparamos y enviamos cada pedido en 7 a 10 días hábiles después de que se confirma el pago: cada pieza se revisa y se empaca a mano.',
                'Después cuenta el tiempo de la paquetería. Estos son los envíos y sus tiempos estimados; son estimados de la paquetería, no fechas garantizadas:',
              ],
              table: 'shipping',
            },
            {
              q: '¿Cómo rastreo mi pedido?',
              a: ['Cuando sale, te mandamos un correo con la paquetería, el número de guía y el enlace para rastrearlo.'],
            },
            {
              q: 'Me equivoqué de dirección',
              a: ['Escríbenos cuanto antes. Si el pedido no ha salido, la corregimos sin costo. Si ya salió, intentamos redirigirlo con la paquetería; si eso tiene un costo extra, te lo decimos antes de hacerlo.'],
            },
            {
              q: 'Mi paquete no llega o se perdió',
              a: ['Si la guía no se mueve en varios días o la paquetería lo da por perdido, escríbenos. Abrimos el reporte con la paquetería y, si no aparece, te enviamos otra pieza igual (si hay) o te devolvemos tu dinero completo, lo que prefieras.'],
            },
            {
              q: 'El paquete regresó o nadie lo recibió',
              a: ['Si regresa porque la dirección estaba mal o porque nadie lo recogió, te lo volvemos a enviar pagando un nuevo envío, o te reembolsamos la pieza sin el costo del envío.'],
            },
          ],
        },
        {
          id: 'cancellations',
          title: 'Cancelaciones',
          items: [
            {
              q: '¿Puedo cancelar mi pedido?',
              a: [
                'Sí, mientras no se haya enviado. Escríbenos con tu número de pedido y te devolvemos el total, envío incluido, al mismo medio de pago.',
                'Cuando tu pedido ya tiene guía, ya no se puede cancelar, pero sí puedes devolverlo (ver Devoluciones).',
              ],
            },
            {
              q: '¿Y si pagué en OXXO?',
              a: ['Si todavía no pagas la ficha, no tienes que hacer nada: vence sola en 3 días y no se cobra. Si ya la pagaste, te devolvemos el dinero por transferencia bancaria, porque Stripe no puede regresar pagos en efectivo.'],
            },
            {
              q: '¿Ustedes pueden cancelar mi pedido?',
              a: ['Solo si algo sale mal de nuestro lado, por ejemplo si la pieza se daña antes de salir. En ese caso te avisamos y te devolvemos todo.'],
            },
          ],
        },
        {
          id: 'returns',
          title: 'Devoluciones y reembolsos',
          items: [
            {
              q: '¿Puedo devolver algo si cambié de opinión?',
              a: ['Sí. Tienes 5 días hábiles desde que recibes tu pedido para avisarnos que lo quieres devolver. La pieza tiene que regresar sin usar, en su empaque original y con su certificado de autenticidad.'],
            },
            {
              q: '¿Cómo la devuelvo?',
              steps: [
                'Escríbenos con tu número de pedido dentro de esos 5 días hábiles.',
                'Te mandamos la dirección de regreso y cómo empacarla.',
                'Envíala con una paquetería que dé número de guía. El envío de regreso corre por tu cuenta.',
                'Cuando la recibimos y revisamos, te reembolsamos.',
              ],
            },
            {
              q: '¿Cuánto me devuelven y cuándo?',
              a: ['El precio de la pieza, al mismo medio de pago con el que compraste, a más tardar 5 días hábiles después de que la recibimos. El envío original y el de regreso no se reembolsan. Tu banco puede tardar unos días más en reflejarlo.'],
            },
            {
              q: '¿Hay algo que no se pueda devolver?',
              a: ['Las descargas digitales (ver abajo) y las piezas que regresen usadas, dañadas por mal manejo o sin su certificado de autenticidad.'],
            },
            {
              q: '¿Puedo cambiar una pieza por otra?',
              a: ['No hacemos cambios directos: devuelve la que tienes y compra la que quieres.'],
            },
          ],
        },
        {
          id: 'damaged',
          title: 'Piezas dañadas o con defecto',
          items: [
            {
              q: 'Mi pieza llegó dañada',
              a: ['Escríbenos lo antes posible, de preferencia en los primeros 7 días, con fotos del paquete por fuera, del empaque y de la pieza. Tú eliges: te mandamos otra igual (si hay) o te devolvemos tu dinero completo, envío incluido. Si hay que regresar la dañada, ese envío lo pagamos nosotros.'],
            },
            {
              q: 'Garantía',
              a: ['Todas las piezas físicas tienen 90 días de garantía contra defectos de fabricación, contados desde que las recibes. Igual que arriba: reposición o reembolso, a tu elección.'],
            },
            {
              q: '¿Y si es una pieza única?',
              a: ['Una pieza única (1 de 1) no tiene repuesto. Si llega dañada, te devolvemos tu dinero completo o, si lo prefieres, la reparamos.'],
            },
          ],
        },
        {
          id: 'digital',
          title: 'Descargas digitales',
          items: [
            {
              q: '¿Las descargas tienen reembolso?',
              a: ['No. El archivo es tuyo en cuanto lo recibes, así que las descargas digitales no se reembolsan ni se cambian.'],
            },
            {
              q: '¿Y si el archivo no abre o está dañado?',
              a: ['Escríbenos y te lo reponemos. Si no podemos entregarte un archivo que funcione, te devolvemos tu dinero.'],
            },
            {
              q: '¿Cuánto dura mi enlace de descarga?',
              a: ['Tu correo de confirmación trae el enlace, cuánto tiempo dura y cuántas veces lo puedes usar. Si se te vence, escríbenos.'],
            },
          ],
        },
        {
          id: 'tickets',
          title: 'Tickets y códigos de descuento',
          items: [
            {
              q: '¿Cómo funcionan los tickets?',
              a: [
                `Se ganan jugando el juego de esferas: el Silver Ticket da ${s.pct} % de descuento con ${s.score} puntos y el Golden Ticket ${g.pct} % con ${g.score} puntos. Solo hay ${g.cap} Golden al mes en todo el sitio, y cada cuenta gana un ticket al mes.`,
                'Las reglas completas están con Argus, en la pestaña Premios.',
              ],
            },
            {
              q: '¿Cómo uso mi ticket?',
              a: ['Se aplica solo en tu carrito cuando inicias sesión, en una compra. Si quieres usarlo después, quítalo del carrito y se guarda para otra compra.'],
            },
            {
              q: '¿Qué pasa con mi ticket si cancelo o devuelvo?',
              a: ['Si se cancela o se reembolsa completo el pedido en el que lo usaste, te regresamos el ticket a tu cuenta.'],
            },
            {
              q: '¿Puedo usar un ticket y un código a la vez?',
              a: ['No: en cada compra va uno u otro. Los códigos de descuento se escriben en la página de pago. Los tickets no tienen valor en efectivo y no se transfieren.'],
            },
          ],
        },
        {
          id: 'contact',
          title: 'Contacto',
          items: [
            {
              q: '¿Cómo los contacto?',
              a: [`Escríbenos a ${SUPPORT_EMAIL}, responde al correo de tu pedido o usa el formulario de Contacto. Contestamos en 1 a 3 días hábiles. Ten a la mano tu número de pedido.`],
              secondary: { label: 'Ir a Contacto', href: '/contact?topic=shop' },
              cta: { label: 'Escribir un correo', href: `mailto:${SUPPORT_EMAIL}` },
            },
            {
              q: '¿Quién vende?',
              address: [SELLER.name, ...SELLER.address, SUPPORT_EMAIL],
            },
            {
              q: 'Si no quedas conforme',
              a: ['Queremos resolverlo contigo. Si no lo logramos y compraste en México, puedes acudir a la Procuraduría Federal del Consumidor (Profeco).'],
            },
          ],
        },
      ],
    }
  }

  return {
    title: 'Help',
    subtitle: 'Everything that comes with buying from the store: payments, shipping, cancellations, returns and tickets.',
    updated: 'Updated October 25, 2026',
    back: 'Back to the store',
    tocLabel: 'On this page',
    summaryTitle: 'The essentials',
    summary: [
      ['Processing', '7 to 10 business days'],
      ['Cancel', 'Until it ships'],
      ['Returns', '5 business days after delivery'],
      ['Warranty', '90 days against defects'],
      ['Digital downloads', 'Non-refundable'],
    ],
    shippingTable: {
      zone: 'Destination',
      method: 'Shipping',
      cost: 'Cost',
      transit: 'Estimated transit',
      days: (min, max) => (min === max
        ? `${min} business ${min === 1 ? 'day' : 'days'}`
        : `${min}–${max} business days`),
      free: (amount) => `Free standard shipping over ${amount}`,
    },
    sections: [
      {
        id: 'payments',
        title: 'Orders and payments',
        items: [
          {
            q: 'How can I pay?',
            a: [
              'With a credit or debit card, on Stripe’s secure checkout page. We never see or store your card details.',
              'In Mexico you can also pay cash at OXXO: you get a voucher that expires in 3 days. Your piece stays on hold until you pay it; if it expires, the piece is released and you aren’t charged.',
            ],
          },
          {
            q: 'What currency do I pay in?',
            a: ['It depends on where it ships: Mexico pays in pesos (MXN); the United States and Latin America pay in US dollars (USD). You pick the region in the cart, and it also sets the shipping cost.'],
          },
          {
            q: 'What does the price include?',
            a: [
              'Each piece’s price is the final price of the piece. Shipping is added at checkout, where you choose the shipping option.',
              'If it ships outside Mexico, your country may charge import taxes or duties on delivery. We don’t collect those; they’re paid by the recipient.',
            ],
          },
          {
            q: 'How do I know my order went through?',
            a: ['You get a confirmation email with your order number and a link to check its status. If you paid at OXXO, the order is confirmed once Stripe receives your payment, which can take a few hours.'],
          },
        ],
      },
      {
        id: 'shipping',
        title: 'Shipping',
        items: [
          {
            q: 'How long will my order take?',
            a: [
              'We prepare and ship every order within 7 to 10 business days after payment is confirmed: each piece is checked and packed by hand.',
              'Carrier transit time comes on top of that. These are the shipping options and their estimated times; they’re carrier estimates, not guaranteed dates:',
            ],
            table: 'shipping',
          },
          {
            q: 'How do I track my order?',
            a: ['When it ships, we email you the carrier, the tracking number and a link to follow it.'],
          },
          {
            q: 'I entered the wrong address',
            a: ['Write to us as soon as possible. If the order hasn’t shipped, we fix it at no cost. If it already shipped, we try to reroute it with the carrier; if that costs extra, we tell you before doing it.'],
          },
          {
            q: 'My package hasn’t arrived or got lost',
            a: ['If tracking hasn’t moved in several days or the carrier marks it as lost, write to us. We open a claim with the carrier and, if it doesn’t turn up, we send you another one (if available) or refund you in full, whichever you prefer.'],
          },
          {
            q: 'The package came back or nobody received it',
            a: ['If it comes back because the address was wrong or nobody picked it up, we can ship it again for a new shipping fee, or refund the piece without the shipping cost.'],
          },
        ],
      },
      {
        id: 'cancellations',
        title: 'Cancellations',
        items: [
          {
            q: 'Can I cancel my order?',
            a: [
              'Yes, as long as it hasn’t shipped. Write to us with your order number and we refund the full amount, shipping included, to your original payment method.',
              'Once your order has a tracking number it can no longer be cancelled, but you can still return it (see Returns).',
            ],
          },
          {
            q: 'What if I paid at OXXO?',
            a: ['If you haven’t paid the voucher yet, there’s nothing to do: it expires in 3 days and you aren’t charged. If you already paid it, we refund you by bank transfer, since Stripe can’t refund cash payments.'],
          },
          {
            q: 'Can you cancel my order?',
            a: ['Only if something goes wrong on our side, for example if the piece gets damaged before it ships. We’ll let you know and refund you in full.'],
          },
        ],
      },
      {
        id: 'returns',
        title: 'Returns and refunds',
        items: [
          {
            q: 'Can I return something if I changed my mind?',
            a: ['Yes. You have 5 business days after you receive your order to let us know you want to return it. The piece must come back unused, in its original packaging and with its certificate of authenticity.'],
          },
          {
            q: 'How do I return it?',
            steps: [
              'Write to us with your order number within those 5 business days.',
              'We send you the return address and how to pack it.',
              'Ship it with a carrier that gives you a tracking number. Return shipping is on you.',
              'Once we receive and check it, we refund you.',
            ],
          },
          {
            q: 'How much do I get back, and when?',
            a: ['The price of the piece, to the payment method you used, no later than 5 business days after we receive it. Original and return shipping aren’t refunded. Your bank may take a few more days to show it.'],
          },
          {
            q: 'Is there anything I can’t return?',
            a: ['Digital downloads (see below), and pieces that come back used, damaged by mishandling or without their certificate of authenticity.'],
          },
          {
            q: 'Can I exchange a piece for another?',
            a: ['We don’t do direct exchanges: return the one you have and buy the one you want.'],
          },
        ],
      },
      {
        id: 'damaged',
        title: 'Damaged or defective pieces',
        items: [
          {
            q: 'My piece arrived damaged',
            a: ['Write to us as soon as possible, ideally within the first 7 days, with photos of the outside of the package, the packaging and the piece. You choose: we send you another one (if available) or refund you in full, shipping included. If the damaged one has to come back, we pay that shipping.'],
          },
          {
            q: 'Warranty',
            a: ['Every physical piece has a 90-day warranty against manufacturing defects, counted from delivery. Same as above: replacement or refund, your choice.'],
          },
          {
            q: 'What if it’s a one-of-one piece?',
            a: ['A one-of-one piece has no replacement. If it arrives damaged, we refund you in full or, if you prefer, we repair it.'],
          },
        ],
      },
      {
        id: 'digital',
        title: 'Digital downloads',
        items: [
          {
            q: 'Are downloads refundable?',
            a: ['No. The file is yours the moment you receive it, so digital downloads can’t be refunded or exchanged.'],
          },
          {
            q: 'What if the file won’t open or is broken?',
            a: ['Write to us and we’ll send you a working one. If we can’t deliver a file that works, we refund you.'],
          },
          {
            q: 'How long does my download link last?',
            a: ['Your confirmation email has the link, how long it lasts and how many times you can use it. If it expires, write to us.'],
          },
        ],
      },
      {
        id: 'tickets',
        title: 'Tickets and discount codes',
        items: [
          {
            q: 'How do tickets work?',
            a: [
              `You win them playing the sphere game: the Silver Ticket gives ${s.pct}% off at ${s.score} points and the Golden Ticket ${g.pct}% at ${g.score} points. There are only ${g.cap} Golden tickets a month across the whole site, and each account wins one ticket a month.`,
              'The full rules are with Argus, in the Prizes tab.',
            ],
          },
          {
            q: 'How do I use my ticket?',
            a: ['It applies itself in your cart when you’re logged in, on one order. To use it later, remove it from the cart and it’s saved for another order.'],
          },
          {
            q: 'What happens to my ticket if I cancel or return?',
            a: ['If the order you used it on is cancelled or fully refunded, we give the ticket back to your account.'],
          },
          {
            q: 'Can I use a ticket and a code together?',
            a: ['No: each order takes one or the other. Discount codes go on the checkout page. Tickets have no cash value and can’t be transferred.'],
          },
        ],
      },
      {
        id: 'contact',
        title: 'Contact',
        items: [
          {
            q: 'How do I reach you?',
            a: [`Email us at ${SUPPORT_EMAIL}, reply to your order email or use the Contact form. We answer within 1 to 3 business days. Have your order number handy.`],
            secondary: { label: 'Go to Contact', href: '/contact?topic=shop' },
            cta: { label: 'Send an email', href: `mailto:${SUPPORT_EMAIL}` },
          },
          {
            q: 'Who is the seller?',
            address: [SELLER.name, ...SELLER.address_en, SUPPORT_EMAIL],
          },
          {
            q: 'If you’re not satisfied',
            a: ['We want to sort it out with you. If we can’t and you bought in Mexico, you can go to Mexico’s consumer protection agency (Profeco).'],
          },
        ],
      },
    ],
  }
}

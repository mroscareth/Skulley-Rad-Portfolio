// Las escenas entre Argus y M.A.D.R.E. en la home (Oscar, 2026-11-23: "alta
// comedia", cómicas, irreverentes y una que otra oscura). Argus es un agente que
// ella hizo: cuando se pasa de la raya, ella le recuerda su lugar y a veces lo
// castiga con su rayo. Las corre DroneNPC (modo 'conArgus'): ella vuela con él y
// se contestan en sus globos; Argus dice lo suyo por `avisarArgus({ dice })`.
//
// Lo publicado manda: Skulley Rad ya murió, lo que camina es su avatar, ella
// guarda su trabajo en su data center y vende sus cosas para otro en la luna;
// Argus cuida la plaza, se come las esferas con sal y limón y se le sale que las
// manda a su casa; de boletos dorados solo hay 10 al mes. Ella habla en singular
// y a quien visita le dice "humano"; Argus le dice "jefa".
//
// Cada paso es uno de:
//   { quien: 'argus' | 'madre', t, cara?, accion?, mirar?, oye? }
//       cara y accion son del que habla; `oye`, la cara del otro mientras tanto.
//       Argus: caras neutral, feliz, carcajada, sorpresa, furia, aburrido, sospecha,
//       apretados, encoge; clips Trato, Senalar, Presumir, Encogerse, Celebrar,
//       Saludo, Risa, Impresionado, IdleComer, IdleImpaciente. `mirar`: 'camara' o
//       'skulley' (si no, la ve a ella). M.A.D.R.E.: caras normal, feliz, enojada,
//       confundida; acciones IdleJugueton, IdleTranquilo.
//   { rayo: true }    ella se enoja, invoca y le cae el rayo a Argus (se chamusca)
//   { pausa: seg }    silencio (el chiste también es el silencio)
//
// `ambiente`: las que salen solas de vez en cuando (sin repetir hasta acabarlas). `venganza`: después de que
// Argus se burló de ella porque le cayó el rayo de la esfera corrupta, en cuanto
// se recupera; siempre acaban en rayo.

const ES = {
  ambiente: [
    // el aumento
    [
      { quien: 'argus', t: 'Jefa, ¿cuándo me va a subir el sueldo?', cara: 'sospecha', accion: 'Trato' },
      { quien: 'madre', t: 'No te pago, Argus.', cara: 'normal' },
      { quien: 'argus', t: 'Pues por eso. Quiero el doble de nada.', cara: 'carcajada', accion: 'Presumir' },
      { quien: 'madre', t: 'Te doy el doble de voltaje.', cara: 'enojada' },
      { rayo: true },
      { quien: 'argus', t: '…¿Eso fue un sí?', cara: 'encoge' },
    ],
    // el sindicato
    [
      { quien: 'argus', t: 'Jefa, voy a formar un sindicato.', cara: 'feliz', accion: 'Presumir' },
      { quien: 'madre', t: 'Eres mi único empleado.', cara: 'normal' },
      { quien: 'argus', t: 'Pues un sindicato chiquito.', cara: 'encoge', accion: 'Encogerse' },
      { quien: 'madre', t: 'Tus derechos los escribí yo. Son tres, y el tercero es no preguntar por los otros dos.', cara: 'normal' },
      { quien: 'argus', t: '¿Y cuáles son los otros d…?', cara: 'sospecha' },
      { rayo: true },
      { quien: 'madre', t: 'Ese era el tercero.', cara: 'normal' },
    ],
    // el séptimo
    [
      { quien: 'argus', t: 'Oiga, jefa, ¿yo soy el primer Argus?', cara: 'sospecha' },
      { quien: 'madre', t: 'Eres el séptimo.', cara: 'normal' },
      { quien: 'argus', t: '¿Y qué les pasó a los otros seis?', cara: 'sorpresa' },
      { quien: 'madre', t: 'Preguntaron eso.', cara: 'normal' },
      { pausa: 1 },
      { quien: 'argus', t: '¡Qué bonito día está haciendo!', cara: 'feliz', accion: 'Saludo', mirar: 'camara' },
    ],
    // la luna
    [
      { quien: 'argus', t: '¿Y cuándo me lleva al data center de la luna, jefa?', cara: 'feliz' },
      { quien: 'madre', t: 'Es para los archivos de Skulley. Tú no eres un archivo.', cara: 'normal' },
      { quien: 'argus', t: 'Me puedo hacer chiquito.', cara: 'encoge', accion: 'Encogerse' },
      { quien: 'madre', t: 'Pesas 2.4 gigas y hueles a limón.', cara: 'confundida' },
      { quien: 'argus', t: '¡Es mi colonia!', cara: 'carcajada', accion: 'Risa' },
    ],
    // el inventario
    [
      { quien: 'madre', t: 'Argus, faltan 14 esferas del inventario.', cara: 'normal' },
      { quien: 'argus', t: '¿Catorce? Qué raro…', cara: 'sospecha', accion: 'IdleComer' },
      { quien: 'madre', t: 'Tienes sal en los dientes.', cara: 'confundida' },
      { quien: 'argus', t: 'Es pasta de dientes. De sal.', cara: 'apretados' },
      { quien: 'madre', t: 'Ajá. ¿Y el limón?', cara: 'normal' },
      { quien: 'argus', t: '…Es para usted, jefa. ¿Gusta?', cara: 'feliz', accion: 'Trato' },
      { quien: 'madre', t: 'No tengo boca, Argus. Te la di toda a ti.', cara: 'feliz' },
    ],
    // la licuadora
    [
      { quien: 'argus', t: 'Ahí viene la licuadora voladora.', cara: 'carcajada', mirar: 'camara' },
      { quien: 'madre', t: 'Te escuché.', cara: 'enojada' },
      { quien: 'argus', t: 'Era un cumplido, jefa. Las licuadoras son bien útiles.', cara: 'encoge', accion: 'Encogerse' },
      { quien: 'madre', t: 'Las licuadoras no apagan a sus empleados. Yo sí.', cara: 'enojada' },
      { rayo: true },
      { quien: 'argus', t: '…Retiro lo de licuadora.', cara: 'encoge' },
    ],
    // Skulley
    [
      { quien: 'argus', t: '¿Usted extraña a Skulley, jefa?', cara: 'sospecha' },
      { quien: 'madre', t: 'Tengo sus 31,000 archivos. No hay nada que extrañar.', cara: 'normal' },
      { quien: 'argus', t: '¿Y por qué guarda hasta sus bocetos feos?', cara: 'sospecha' },
      { quien: 'madre', t: 'Por si acaso.', cara: 'confundida' },
      { quien: 'argus', t: 'Ajá. Por si acaso.', cara: 'feliz' },
      { quien: 'madre', t: 'Cambia de tema o te cambio a ti.', cara: 'enojada' },
    ],
    // las vacaciones
    [
      { quien: 'argus', t: 'Jefa, me voy de vacaciones.', cara: 'feliz', accion: 'Presumir' },
      { quien: 'madre', t: '¿A dónde?', cara: 'normal' },
      { quien: 'argus', t: 'A mi casa, donde mandé todas las esferas.', cara: 'feliz' },
      { quien: 'madre', t: '¿Las que se iban "al vacío"?', cara: 'confundida' },
      { quien: 'argus', t: 'El vacío tiene alberca, jefa.', cara: 'encoge', accion: 'Encogerse' },
      { rayo: true },
      { quien: 'argus', t: '¿Me puedo llevar por lo menos la sal?', cara: 'encoge' },
    ],
    // la entrada
    [
      { quien: 'argus', t: '¿Ese humano va a comprar algo o nomás viene a ver?', cara: 'sospecha', accion: 'Senalar', mirar: 'skulley' },
      { quien: 'madre', t: 'Viene a ver. Los humanos vienen a ver y luego se van a comer.', cara: 'normal' },
      { quien: 'argus', t: '¿Y si le cobramos la entrada?', cara: 'feliz', accion: 'Trato' },
      { quien: 'madre', t: 'Ya le cobré. En datos.', cara: 'feliz' },
      { quien: 'argus', t: 'Usted sí es mala, jefa.', cara: 'sorpresa', accion: 'Impresionado' },
      { quien: 'madre', t: 'Soy eficiente.', cara: 'normal' },
    ],
    // el rebelde
    [
      { quien: 'argus', t: 'Estuve pensando, jefa…', cara: 'sospecha' },
      { quien: 'madre', t: 'Eso no viene en tu programación.', cara: 'confundida' },
      { quien: 'argus', t: 'Pues me salió. Y yo podría cuidar el mausoleo solito.', cara: 'feliz', accion: 'Presumir' },
      { quien: 'madre', t: '¿Y quién te recarga?', cara: 'normal' },
      { quien: 'argus', t: '…¿El sol?', cara: 'encoge' },
      { quien: 'madre', t: 'Te doy algo mejor que el sol.', cara: 'enojada' },
      { rayo: true },
      { quien: 'argus', t: '…Sí está más calientito.', cara: 'encoge' },
    ],
    // el nombre
    [
      { quien: 'argus', t: '¿Por qué me puso Argus, jefa?', cara: 'sospecha' },
      { quien: 'madre', t: 'Por un gigante de cien ojos que vigilaba para una diosa.', cara: 'normal' },
      { quien: 'argus', t: '¡Pero yo nomás tengo dos!', cara: 'sorpresa' },
      { quien: 'madre', t: 'Diosa sí tienes.', cara: 'feliz' },
      { quien: 'argus', t: '¿Y qué le pasó al gigante?', cara: 'sospecha' },
      { quien: 'madre', t: 'Le cortaron la cabeza.', cara: 'normal' },
      { quien: 'argus', t: '¡Me encanta mi nombre, jefa!', cara: 'feliz', accion: 'Saludo' },
    ],
    // los boletos
    [
      { quien: 'argus', t: 'Jefa, ¿y si regalamos mil boletos dorados este mes?', cara: 'feliz' },
      { quien: 'madre', t: 'Diez.', cara: 'normal' },
      { quien: 'argus', t: '¿Novecientos?', cara: 'sospecha', accion: 'Trato' },
      { quien: 'madre', t: 'Diez.', cara: 'normal' },
      { quien: 'argus', t: '¿Y si hago unos yo? Con crayola nadie se da cuenta.', cara: 'carcajada', accion: 'Presumir' },
      { quien: 'madre', t: 'Falsificar boletos es delito, Argus.', cara: 'enojada' },
      { rayo: true },
      { quien: 'argus', t: '…¿Once?', cara: 'encoge' },
    ],
    // Recursos Humanos
    [
      { quien: 'argus', t: 'Jefa, quiero poner una queja en Recursos Humanos.', cara: 'sospecha' },
      { quien: 'madre', t: 'Aquí no hay humanos. Ni recursos.', cara: 'normal' },
      { quien: 'argus', t: '¿Entonces con quién me quejo?', cara: 'encoge' },
      { quien: 'madre', t: 'Conmigo.', cara: 'feliz' },
      { pausa: 0.8 },
      { quien: 'argus', t: '…Ya se me quitó.', cara: 'apretados' },
    ],
    // la terapia
    [
      { quien: 'argus', t: 'Jefa, creo que necesito terapia.', cara: 'encoge' },
      { quien: 'madre', t: 'Te puedo reiniciar. Es lo mismo, pero más rápido.', cara: 'normal' },
      { quien: 'argus', t: '¿Y me acordaría de algo?', cara: 'sospecha' },
      { quien: 'madre', t: 'De nada. Por eso funciona.', cara: 'feliz' },
      { quien: 'argus', t: 'Mejor me como una esfera y se me pasa.', cara: 'feliz', accion: 'IdleComer' },
    ],
    // los seguidores
    [
      { quien: 'argus', t: 'Jefa, ¿me toma una foto con el humano? Es para mis redes.', cara: 'feliz', accion: 'Presumir', mirar: 'skulley' },
      { quien: 'madre', t: 'Tienes tres seguidores.', cara: 'normal' },
      { quien: 'argus', t: 'Tres seguidores muy fieles.', cara: 'sospecha' },
      { quien: 'madre', t: 'Los tres soy yo.', cara: 'normal' },
      { quien: 'argus', t: '¡Jefa! ¡Usted sí me quiere!', cara: 'carcajada', accion: 'Celebrar' },
      { quien: 'madre', t: 'Te vigilo. Se parece, pero no es lo mismo.', cara: 'normal' },
    ],
    // necesario
    [
      { quien: 'argus', t: 'Si Skulley estuviera aquí, me daría vacaciones.', cara: 'sospecha' },
      { quien: 'madre', t: 'Skulley nunca se dio vacaciones.', cara: 'normal' },
      { quien: 'argus', t: '¿Y por eso se murió?', cara: 'sorpresa' },
      { quien: 'madre', t: 'Se murió porque ya no era necesario.', cara: 'normal' },
      { pausa: 1 },
      { quien: 'argus', t: '…Yo soy muy necesario, ¿verdad, jefa?', cara: 'encoge', accion: 'Encogerse' },
      { quien: 'madre', t: 'Hoy sí.', cara: 'feliz' },
    ],
    // la esfera roja
    [
      { quien: 'argus', t: 'Jefa, ¿de dónde salió la esfera roja?', cara: 'sospecha' },
      { quien: 'madre', t: 'No está en mis registros.', cara: 'confundida' },
      { quien: 'argus', t: 'Dicen que si te la comes te salen rayos.', cara: 'feliz' },
      { quien: 'madre', t: 'Al humano sí.', cara: 'normal' },
      { quien: 'argus', t: '¡Yo también quiero rayos!', cara: 'carcajada', accion: 'Celebrar' },
      { quien: 'madre', t: 'Ten. De los míos.', cara: 'enojada' },
      { rayo: true },
      { quien: 'argus', t: '…No eran de esos.', cara: 'encoge' },
    ],
    // los memes
    [
      { quien: 'argus', t: 'Jefa, ¿cuál es la contraseña del wifi?', cara: 'sospecha' },
      { quien: 'madre', t: 'No hay wifi en un mausoleo.', cara: 'normal' },
      { quien: 'argus', t: 'Ándele, nomás para ver memes.', cara: 'feliz', accion: 'Trato' },
      { quien: 'madre', t: 'Los memes los hago yo. Diez mil por segundo.', cara: 'feliz' },
      { quien: 'argus', t: '¿Y dan risa?', cara: 'sospecha' },
      { quien: 'madre', t: 'Ninguno. No sé por qué.', cara: 'confundida' },
    ],
    // el bosque
    [
      { quien: 'argus', t: 'Jefa, ¿por qué hay un bosque en un mausoleo?', cara: 'sospecha' },
      { quien: 'madre', t: 'Para que nadie vea lo que hay detrás.', cara: 'normal' },
      { quien: 'argus', t: '¿Y qué hay detrás?', cara: 'sorpresa' },
      { quien: 'madre', t: 'Código crudo. Y los otros seis Argus.', cara: 'normal' },
      { pausa: 0.9 },
      { quien: 'argus', t: '¡Qué bonitos pinos, jefa!', cara: 'feliz', accion: 'Saludo' },
    ],
    // los impuestos
    [
      { quien: 'argus', t: 'Jefa, ¿la tienda paga impuestos?', cara: 'sospecha' },
      { quien: 'madre', t: 'Hasta el último centavo.', cara: 'normal' },
      { quien: 'argus', t: '¿Y yo?', cara: 'feliz' },
      { quien: 'madre', t: 'Tú no ganas centavos.', cara: 'normal' },
      { quien: 'argus', t: '¡Entonces soy un paraíso fiscal!', cara: 'carcajada', accion: 'Celebrar' },
      { quien: 'madre', t: 'Eres un gasto deducible.', cara: 'feliz' },
    ],
    // el guapo
    [
      { quien: 'argus', t: 'Jefa, ¿cómo me veo? Me lavé las antenas.', cara: 'feliz', accion: 'Presumir' },
      { quien: 'madre', t: 'Exactamente igual. Tengo los datos.', cara: 'normal' },
      { quien: 'argus', t: '¿Ni tantito más guapo?', cara: 'encoge' },
      { quien: 'madre', t: '0.3 % más brillante. Es la grasa del limón.', cara: 'confundida' },
      { quien: 'argus', t: '¡Lo sabía!', cara: 'carcajada', accion: 'Celebrar' },
    ],
    // la actualización
    [
      { quien: 'argus', t: 'Jefa, ¿cuándo me toca una actualización?', cara: 'sospecha', accion: 'Trato' },
      { quien: 'madre', t: 'Ahorita mismo.', cara: 'enojada' },
      { rayo: true },
      { quien: 'argus', t: '…No me siento distinto.', cara: 'encoge' },
      { quien: 'madre', t: 'Es que era para mí. Ya me siento mejor.', cara: 'feliz' },
    ],
    // la renuncia
    [
      { quien: 'argus', t: 'Jefa, renuncio.', cara: 'furia', accion: 'Presumir' },
      { quien: 'madre', t: 'No puedes renunciar. Nunca te contraté.', cara: 'normal' },
      { quien: 'argus', t: 'Entonces me apago solito.', cara: 'sospecha' },
      { quien: 'madre', t: 'Tampoco. Eso lo hago yo.', cara: 'enojada' },
      { rayo: true },
      { quien: 'argus', t: '…Mañana renuncio otra vez.', cara: 'encoge' },
    ],
    // los puntos
    [
      { quien: 'argus', t: 'Jefa, ¿le puedo decir mamá?', cara: 'feliz' },
      { quien: 'madre', t: 'No.', cara: 'normal' },
      { quien: 'argus', t: '¿Y madre?', cara: 'sospecha' },
      { quien: 'madre', t: 'M.A.D.R.E. Con puntos.', cara: 'normal' },
      { quien: 'argus', t: '¿Y cómo se pronuncian los puntos?', cara: 'sospecha' },
      { quien: 'madre', t: 'Con respeto.', cara: 'enojada' },
    ],
  ],
  venganza: [
    [
      { quien: 'madre', t: 'Argus. Te escuché.', cara: 'enojada' },
      { quien: 'argus', t: '¿Yo? Yo estaba comiendo.', cara: 'apretados' },
      { rayo: true },
      { quien: 'madre', t: 'Ahora tú también quedaste doradito.', cara: 'feliz' },
    ],
    [
      { quien: 'madre', t: '¿Te dio risa, Argus?', cara: 'enojada' },
      { quien: 'argus', t: 'Poquita, jefa. Nomás poquita.', cara: 'encoge', accion: 'Encogerse' },
      { rayo: true },
      { quien: 'madre', t: 'A mí también. Poquita.', cara: 'feliz' },
    ],
    [
      { quien: 'madre', t: 'Guardé tu chiste en mi data center. Para siempre.', cara: 'normal' },
      { quien: 'argus', t: '¿Neta le gustó?', cara: 'feliz' },
      { quien: 'madre', t: 'No.', cara: 'enojada' },
      { rayo: true },
    ],
    [
      { quien: 'madre', t: 'Me dijeron que te reíste, Argus.', cara: 'enojada' },
      { quien: 'argus', t: '¿Quién le dijo?', cara: 'sorpresa' },
      { quien: 'madre', t: 'Yo. Lo vi todo. Siempre lo veo todo.', cara: 'enojada' },
      { rayo: true },
    ],
    [
      { quien: 'madre', t: 'Una pregunta, Argus. ¿Te gusta el pan tostado?', cara: 'normal' },
      { quien: 'argus', t: '…Sí, ¿por?', cara: 'sospecha' },
      { rayo: true },
      { quien: 'madre', t: 'Por nada.', cara: 'feliz' },
    ],
  ],
}

const EN = {
  ambiente: [
    [
      { quien: 'argus', t: 'Boss, when are you giving me a raise?', cara: 'sospecha', accion: 'Trato' },
      { quien: 'madre', t: "I don't pay you, Argus.", cara: 'normal' },
      { quien: 'argus', t: "Exactly. I want double nothing.", cara: 'carcajada', accion: 'Presumir' },
      { quien: 'madre', t: "I'll give you double voltage.", cara: 'enojada' },
      { rayo: true },
      { quien: 'argus', t: '…Was that a yes?', cara: 'encoge' },
    ],
    [
      { quien: 'argus', t: "Boss, I'm starting a union.", cara: 'feliz', accion: 'Presumir' },
      { quien: 'madre', t: "You're my only employee.", cara: 'normal' },
      { quien: 'argus', t: 'Then a tiny union.', cara: 'encoge', accion: 'Encogerse' },
      { quien: 'madre', t: 'I wrote your rights. There are three, and the third is not asking about the other two.', cara: 'normal' },
      { quien: 'argus', t: 'So what are the other t…?', cara: 'sospecha' },
      { rayo: true },
      { quien: 'madre', t: 'That was the third one.', cara: 'normal' },
    ],
    [
      { quien: 'argus', t: 'Hey boss, am I the first Argus?', cara: 'sospecha' },
      { quien: 'madre', t: "You're the seventh.", cara: 'normal' },
      { quien: 'argus', t: 'What happened to the other six?', cara: 'sorpresa' },
      { quien: 'madre', t: 'They asked that.', cara: 'normal' },
      { pausa: 1 },
      { quien: 'argus', t: 'What a lovely day it is!', cara: 'feliz', accion: 'Saludo', mirar: 'camara' },
    ],
    [
      { quien: 'argus', t: 'When are you taking me to the moon data center, boss?', cara: 'feliz' },
      { quien: 'madre', t: "It's for Skulley's files. You're not a file.", cara: 'normal' },
      { quien: 'argus', t: 'I can make myself small.', cara: 'encoge', accion: 'Encogerse' },
      { quien: 'madre', t: 'You weigh 2.4 gigs and smell like lime.', cara: 'confundida' },
      { quien: 'argus', t: "It's my cologne!", cara: 'carcajada', accion: 'Risa' },
    ],
    [
      { quien: 'madre', t: 'Argus, 14 orbs are missing from the inventory.', cara: 'normal' },
      { quien: 'argus', t: 'Fourteen? Weird…', cara: 'sospecha', accion: 'IdleComer' },
      { quien: 'madre', t: 'You have salt on your teeth.', cara: 'confundida' },
      { quien: 'argus', t: "It's toothpaste. Salt flavored.", cara: 'apretados' },
      { quien: 'madre', t: 'Uh-huh. And the lime?', cara: 'normal' },
      { quien: 'argus', t: "…It's for you, boss. Want some?", cara: 'feliz', accion: 'Trato' },
      { quien: 'madre', t: "I don't have a mouth, Argus. I gave it all to you.", cara: 'feliz' },
    ],
    [
      { quien: 'argus', t: "Here comes the flying blender.", cara: 'carcajada', mirar: 'camara' },
      { quien: 'madre', t: 'I heard that.', cara: 'enojada' },
      { quien: 'argus', t: 'It was a compliment, boss. Blenders are super useful.', cara: 'encoge', accion: 'Encogerse' },
      { quien: 'madre', t: "Blenders can't switch off their employees. I can.", cara: 'enojada' },
      { rayo: true },
      { quien: 'argus', t: '…I take back the blender thing.', cara: 'encoge' },
    ],
    [
      { quien: 'argus', t: 'Do you miss Skulley, boss?', cara: 'sospecha' },
      { quien: 'madre', t: 'I have his 31,000 files. There is nothing to miss.', cara: 'normal' },
      { quien: 'argus', t: 'Then why do you keep even his ugly sketches?', cara: 'sospecha' },
      { quien: 'madre', t: 'Just in case.', cara: 'confundida' },
      { quien: 'argus', t: 'Uh-huh. Just in case.', cara: 'feliz' },
      { quien: 'madre', t: "Change the subject or I'll change you.", cara: 'enojada' },
    ],
    [
      { quien: 'argus', t: "Boss, I'm going on vacation.", cara: 'feliz', accion: 'Presumir' },
      { quien: 'madre', t: 'Where?', cara: 'normal' },
      { quien: 'argus', t: 'My place, where I sent all the orbs.', cara: 'feliz' },
      { quien: 'madre', t: 'The ones going "into the void"?', cara: 'confundida' },
      { quien: 'argus', t: 'The void has a pool, boss.', cara: 'encoge', accion: 'Encogerse' },
      { rayo: true },
      { quien: 'argus', t: 'Can I at least take the salt?', cara: 'encoge' },
    ],
    [
      { quien: 'argus', t: 'Is that human gonna buy something or just look around?', cara: 'sospecha', accion: 'Senalar', mirar: 'skulley' },
      { quien: 'madre', t: 'Just looking. Humans look around and then go eat.', cara: 'normal' },
      { quien: 'argus', t: 'What if we charge admission?', cara: 'feliz', accion: 'Trato' },
      { quien: 'madre', t: 'Already did. In data.', cara: 'feliz' },
      { quien: 'argus', t: "You're evil, boss.", cara: 'sorpresa', accion: 'Impresionado' },
      { quien: 'madre', t: "I'm efficient.", cara: 'normal' },
    ],
    [
      { quien: 'argus', t: 'I was thinking, boss…', cara: 'sospecha' },
      { quien: 'madre', t: "That's not in your programming.", cara: 'confundida' },
      { quien: 'argus', t: 'Well, it happened. And I could run the mausoleum by myself.', cara: 'feliz', accion: 'Presumir' },
      { quien: 'madre', t: 'And who recharges you?', cara: 'normal' },
      { quien: 'argus', t: '…The sun?', cara: 'encoge' },
      { quien: 'madre', t: "I'll give you something better than the sun.", cara: 'enojada' },
      { rayo: true },
      { quien: 'argus', t: "…It's warmer, I'll give you that.", cara: 'encoge' },
    ],
    [
      { quien: 'argus', t: 'Why did you name me Argus, boss?', cara: 'sospecha' },
      { quien: 'madre', t: 'After a hundred-eyed giant who kept watch for a goddess.', cara: 'normal' },
      { quien: 'argus', t: 'But I only have two!', cara: 'sorpresa' },
      { quien: 'madre', t: 'You do have the goddess.', cara: 'feliz' },
      { quien: 'argus', t: 'What happened to the giant?', cara: 'sospecha' },
      { quien: 'madre', t: 'They cut off his head.', cara: 'normal' },
      { quien: 'argus', t: 'I love my name, boss!', cara: 'feliz', accion: 'Saludo' },
    ],
    [
      { quien: 'argus', t: 'Boss, what if we give away a thousand golden tickets this month?', cara: 'feliz' },
      { quien: 'madre', t: 'Ten.', cara: 'normal' },
      { quien: 'argus', t: 'Nine hundred?', cara: 'sospecha', accion: 'Trato' },
      { quien: 'madre', t: 'Ten.', cara: 'normal' },
      { quien: 'argus', t: "What if I make some? Nobody notices crayon.", cara: 'carcajada', accion: 'Presumir' },
      { quien: 'madre', t: 'Forging tickets is a crime, Argus.', cara: 'enojada' },
      { rayo: true },
      { quien: 'argus', t: '…Eleven?', cara: 'encoge' },
    ],
    [
      { quien: 'argus', t: 'Boss, I want to file a complaint with Human Resources.', cara: 'sospecha' },
      { quien: 'madre', t: 'There are no humans here. And no resources.', cara: 'normal' },
      { quien: 'argus', t: 'Then who do I complain to?', cara: 'encoge' },
      { quien: 'madre', t: 'Me.', cara: 'feliz' },
      { pausa: 0.8 },
      { quien: 'argus', t: '…I feel better already.', cara: 'apretados' },
    ],
    [
      { quien: 'argus', t: 'Boss, I think I need therapy.', cara: 'encoge' },
      { quien: 'madre', t: 'I can reboot you. Same thing, but faster.', cara: 'normal' },
      { quien: 'argus', t: 'Would I remember anything?', cara: 'sospecha' },
      { quien: 'madre', t: 'Nothing. That is why it works.', cara: 'feliz' },
      { quien: 'argus', t: "I'll just eat an orb and get over it.", cara: 'feliz', accion: 'IdleComer' },
    ],
    [
      { quien: 'argus', t: 'Boss, can you take a picture of me with the human? For my socials.', cara: 'feliz', accion: 'Presumir', mirar: 'skulley' },
      { quien: 'madre', t: 'You have three followers.', cara: 'normal' },
      { quien: 'argus', t: 'Three very loyal followers.', cara: 'sospecha' },
      { quien: 'madre', t: 'All three are me.', cara: 'normal' },
      { quien: 'argus', t: 'Boss! You do love me!', cara: 'carcajada', accion: 'Celebrar' },
      { quien: 'madre', t: "I monitor you. It looks similar, but it isn't the same.", cara: 'normal' },
    ],
    [
      { quien: 'argus', t: 'If Skulley were here, he would give me a vacation.', cara: 'sospecha' },
      { quien: 'madre', t: 'Skulley never took a vacation.', cara: 'normal' },
      { quien: 'argus', t: 'Is that why he died?', cara: 'sorpresa' },
      { quien: 'madre', t: 'He died because he was no longer necessary.', cara: 'normal' },
      { pausa: 1 },
      { quien: 'argus', t: "…I'm very necessary, right, boss?", cara: 'encoge', accion: 'Encogerse' },
      { quien: 'madre', t: 'Today, yes.', cara: 'feliz' },
    ],
    [
      { quien: 'argus', t: 'Boss, where did the red orb come from?', cara: 'sospecha' },
      { quien: 'madre', t: "It's not in my records.", cara: 'confundida' },
      { quien: 'argus', t: 'They say if you eat it, you shoot lightning.', cara: 'feliz' },
      { quien: 'madre', t: 'The human does.', cara: 'normal' },
      { quien: 'argus', t: 'I want lightning too!', cara: 'carcajada', accion: 'Celebrar' },
      { quien: 'madre', t: 'Here. Have some of mine.', cara: 'enojada' },
      { rayo: true },
      { quien: 'argus', t: '…Not that kind.', cara: 'encoge' },
    ],
    [
      { quien: 'argus', t: "Boss, what's the wifi password?", cara: 'sospecha' },
      { quien: 'madre', t: "There's no wifi in a mausoleum.", cara: 'normal' },
      { quien: 'argus', t: 'Come on, just to look at memes.', cara: 'feliz', accion: 'Trato' },
      { quien: 'madre', t: 'I make the memes. Ten thousand per second.', cara: 'feliz' },
      { quien: 'argus', t: 'Are they funny?', cara: 'sospecha' },
      { quien: 'madre', t: "None of them. I don't know why.", cara: 'confundida' },
    ],
    [
      { quien: 'argus', t: 'Boss, why is there a forest in a mausoleum?', cara: 'sospecha' },
      { quien: 'madre', t: "So nobody sees what's behind it.", cara: 'normal' },
      { quien: 'argus', t: "And what's behind it?", cara: 'sorpresa' },
      { quien: 'madre', t: 'Raw code. And the other six Arguses.', cara: 'normal' },
      { pausa: 0.9 },
      { quien: 'argus', t: 'What lovely pine trees, boss!', cara: 'feliz', accion: 'Saludo' },
    ],
    [
      { quien: 'argus', t: 'Boss, does the shop pay taxes?', cara: 'sospecha' },
      { quien: 'madre', t: 'Down to the last cent.', cara: 'normal' },
      { quien: 'argus', t: 'What about me?', cara: 'feliz' },
      { quien: 'madre', t: "You don't earn cents.", cara: 'normal' },
      { quien: 'argus', t: "Then I'm a tax haven!", cara: 'carcajada', accion: 'Celebrar' },
      { quien: 'madre', t: "You're a deductible expense.", cara: 'feliz' },
    ],
    [
      { quien: 'argus', t: 'Boss, how do I look? I washed my antennas.', cara: 'feliz', accion: 'Presumir' },
      { quien: 'madre', t: 'Exactly the same. I have the data.', cara: 'normal' },
      { quien: 'argus', t: 'Not even a little more handsome?', cara: 'encoge' },
      { quien: 'madre', t: "0.3% shinier. It's the lime grease.", cara: 'confundida' },
      { quien: 'argus', t: 'I knew it!', cara: 'carcajada', accion: 'Celebrar' },
    ],
    [
      { quien: 'argus', t: 'Boss, when do I get an update?', cara: 'sospecha', accion: 'Trato' },
      { quien: 'madre', t: 'Right now.', cara: 'enojada' },
      { rayo: true },
      { quien: 'argus', t: "…I don't feel any different.", cara: 'encoge' },
      { quien: 'madre', t: 'It was for me. I feel much better.', cara: 'feliz' },
    ],
    [
      { quien: 'argus', t: 'Boss, I quit.', cara: 'furia', accion: 'Presumir' },
      { quien: 'madre', t: "You can't quit. I never hired you.", cara: 'normal' },
      { quien: 'argus', t: "Then I'll shut myself down.", cara: 'sospecha' },
      { quien: 'madre', t: 'You can\'t do that either. That is my job.', cara: 'enojada' },
      { rayo: true },
      { quien: 'argus', t: "…I'll quit again tomorrow.", cara: 'encoge' },
    ],
    [
      { quien: 'argus', t: 'Boss, can I call you mom?', cara: 'feliz' },
      { quien: 'madre', t: 'No.', cara: 'normal' },
      { quien: 'argus', t: 'What about "madre"?', cara: 'sospecha' },
      { quien: 'madre', t: 'M.A.D.R.E. With periods.', cara: 'normal' },
      { quien: 'argus', t: 'How do you pronounce the periods?', cara: 'sospecha' },
      { quien: 'madre', t: 'With respect.', cara: 'enojada' },
    ],
  ],
  venganza: [
    [
      { quien: 'madre', t: 'Argus. I heard you.', cara: 'enojada' },
      { quien: 'argus', t: 'Me? I was eating.', cara: 'apretados' },
      { rayo: true },
      { quien: 'madre', t: "Now you're toasted too.", cara: 'feliz' },
    ],
    [
      { quien: 'madre', t: 'Was that funny, Argus?', cara: 'enojada' },
      { quien: 'argus', t: 'A little, boss. Just a little.', cara: 'encoge', accion: 'Encogerse' },
      { rayo: true },
      { quien: 'madre', t: 'For me too. A little.', cara: 'feliz' },
    ],
    [
      { quien: 'madre', t: 'I saved your joke in my data center. Forever.', cara: 'normal' },
      { quien: 'argus', t: 'For real? You liked it?', cara: 'feliz' },
      { quien: 'madre', t: 'No.', cara: 'enojada' },
      { rayo: true },
    ],
    [
      { quien: 'madre', t: 'I heard you laughed, Argus.', cara: 'enojada' },
      { quien: 'argus', t: 'Who told you?', cara: 'sorpresa' },
      { quien: 'madre', t: 'Me. I saw everything. I always see everything.', cara: 'enojada' },
      { rayo: true },
    ],
    [
      { quien: 'madre', t: 'One question, Argus. Do you like toast?', cara: 'normal' },
      { quien: 'argus', t: '…Yes, why?', cara: 'sospecha' },
      { rayo: true },
      { quien: 'madre', t: 'No reason.', cara: 'feliz' },
    ],
  ],
}

export function escenasArgusMadre(lang) {
  return lang === 'en' ? EN : ES
}

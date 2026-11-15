import React, { useEffect, useRef, useState } from 'react'
import { escuchar, juego, RELOJ, FUEGO } from '../lib/juegoEsferas.js'
import { playTic, playChicharra } from '../lib/juegoSonidos.js'

// Lo que el juego de esferas le enseña al jugador mientras juega (Oscar,
// 2026-11-15): el reloj arriba al centro, los segundos que gana o pierde con cada
// esfera y los avisos grandes (multiplicador, fiebre, dorada, portal en llamas,
// tiempo). Escucha los avisos de lib/juegoEsferas.js, que solo llegan cuando algo
// cambia: no re-renderiza por cuadro. El puntaje y su multiplicador viven en
// ScoreHUD.

const TEXTOS = {
  es: {
    fiebre: '¡FIEBRE!',
    fiebreSub: 'Todas las esferas entran en cualquier portal',
    dorada: '¡ESFERA DORADA!',
    doradaSub: '500 puntos en cualquier portal. Atrápala si puedes',
    doradaFin: 'Se escapó la dorada',
    fuego: '¡PORTAL EN LLAMAS!',
    fuegoSub: (nombre) => `${nombre}: lo que entre bien vale doble ${FUEGO.dura} s`,
    rota: 'Se rompió la racha',
    tiempo: '¡SE ACABÓ EL TIEMPO!',
    reloj: 'Tiempo',
  },
  en: {
    fiebre: 'FEVER!',
    fiebreSub: 'Every sphere goes in any portal',
    dorada: 'GOLDEN SPHERE!',
    doradaSub: '500 points in any portal. Catch it if you can',
    doradaFin: 'The golden one got away',
    fuego: 'PORTAL ON FIRE!',
    fuegoSub: (nombre) => `${nombre}: right colors score double for ${FUEGO.dura} s`,
    rota: 'Streak broken',
    tiempo: 'TIME’S UP!',
    reloj: 'Time',
  },
}

const fmtReloj = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`

function JuegoHUD({ isCompactUi = false, lang = 'es', sectionLabel = {} }) {
  const tr = lang === 'es' ? TEXTOS.es : TEXTOS.en
  const [reloj, setReloj] = useState(() => Math.ceil(juego.reloj))
  const [fiebre, setFiebre] = useState(false)
  // Aviso grande: { id, titulo, sub, tono }. Uno a la vez; el nuevo pisa al viejo.
  const [aviso, setAviso] = useState(null)
  // Segundos ganados o perdidos que suben junto al reloj.
  const [bonos, setBonos] = useState([])
  const idRef = useRef(0)
  const avisoTimer = useRef(null)
  const trRef = useRef(tr)
  trRef.current = tr
  const labelRef = useRef(sectionLabel)
  labelRef.current = sectionLabel

  useEffect(() => {
    const avisar = (titulo, sub, tono, ms = 1900) => {
      idRef.current += 1
      setAviso({ id: idRef.current, titulo, sub, tono })
      clearTimeout(avisoTimer.current)
      avisoTimer.current = setTimeout(() => setAviso(null), ms)
    }
    const quitar = escuchar((tipo, d) => {
      const t = trRef.current
      if (tipo === 'inicio') {
        setReloj(Math.ceil(d.reloj))
        setFiebre(false)
        setAviso(null)
      } else if (tipo === 'reloj') {
        setReloj(d.reloj)
        if (d.reloj > 0 && d.reloj <= RELOJ.urgente) playTic(d.reloj <= 3)
      } else if (tipo === 'tiempo') {
        setReloj(0)
        playChicharra()
        avisar(t.tiempo, null, 'rojo', 2400)
      } else if (tipo === 'captura') {
        setReloj(Math.ceil(juego.reloj))
        if (d.segundos) {
          idRef.current += 1
          const id = idRef.current
          setBonos((b) => [...b.slice(-3), { id, txt: `${d.segundos > 0 ? '+' : ''}${d.segundos}s`, mal: d.segundos < 0 }])
          setTimeout(() => setBonos((b) => b.filter((x) => x.id !== id)), 1100)
        }
        if (d.fiebre) {
          setFiebre(true)
          avisar(t.fiebre, t.fiebreSub, 'fiebre', 2200)
        } else if (d.subioMult) {
          avisar(`×${d.mult}`, null, 'amarillo', 1200)
        } else if (d.rompioRacha) {
          avisar(t.rota, null, 'rojo', 1100)
        }
      } else if (tipo === 'fiebre-fin') {
        setFiebre(false)
      } else if (tipo === 'dorada') {
        avisar(t.dorada, t.doradaSub, 'dorada', 2400)
      } else if (tipo === 'dorada-fin') {
        avisar(t.doradaFin, null, 'gris', 1300)
      } else if (tipo === 'fuego') {
        avisar(t.fuego, t.fuegoSub(labelRef.current?.[d.portal] || ''), 'fuego', 2400)
      }
    })
    return () => {
      quitar()
      clearTimeout(avisoTimer.current)
    }
  }, [])

  const urgente = reloj <= RELOJ.urgente
  const arriba = isCompactUi ? 12 : 40

  return (
    <>
      {fiebre && <div className="juego-fiebre" aria-hidden />}
      <div className="juego-reloj-wrap" style={{ top: arriba }}>
        <div
          className={`juego-reloj${urgente ? ' juego-reloj--urgente' : ''}${fiebre ? ' juego-reloj--fiebre' : ''}`}
          role="timer"
          aria-label={`${tr.reloj}: ${fmtReloj(reloj)}`}
        >
          {fmtReloj(reloj)}
        </div>
        <div className="juego-bonos" aria-hidden>
          {bonos.map((b) => (
            <span key={b.id} className={`juego-bono${b.mal ? ' juego-bono--mal' : ''}`}>{b.txt}</span>
          ))}
        </div>
      </div>
      {aviso && (
        <div key={aviso.id} className={`juego-aviso juego-aviso--${aviso.tono}`} style={{ top: arriba + 88 }} role="status">
          <p className="juego-aviso__titulo">{aviso.titulo}</p>
          {aviso.sub && <p className="juego-aviso__sub">{aviso.sub}</p>}
        </div>
      )}
    </>
  )
}

export default JuegoHUD

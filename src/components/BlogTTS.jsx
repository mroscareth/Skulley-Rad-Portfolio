/**
 * BlogTTS — Text-to-Speech player for blog posts
 * Flat toon audio player (DESIGN.md §14): 2px borders, flat fills, no glow,
 * blog orange accent, animated waveform visualization.
 *
 * DUAL ENGINE:
 *   1. Native speechSynthesis — used when a matching voice exists
 *   2. Server-side proxy TTS — fallback via /api/tts.php → Google TTS
 *
 * ROBOTIC VOICE PROCESSING (proxy engine):
 *   Audio from Google TTS is processed through Web Audio API to create
 *   a cyberpunk/robotic voice effect:
 *   - Pitch shifted down (deeper, masculine)
 *   - Band-pass filter (metallic/radio quality)
 *   - Subtle waveshaper distortion (digital crunch)
 *   - Compressor (punchy, consistent levels)
 *
 * MUSIC DUCKING: Dispatches 'tts-start' and 'tts-stop' custom events
 * so the MusicPlayer can fade out/in automatically.
 */

import React, { useState, useEffect, useRef, useCallback, useId } from 'react'
import {
    PlayIcon,
    PauseIcon,
    BackwardIcon,
    ForwardIcon,
    StopIcon,
    SpeakerWaveIcon,
    ChevronDownIcon,
} from '@heroicons/react/24/solid'

const TTS_API = '/api/tts.php'

// ─── Waveform Canvas ───
function WaveformCanvas({ isPlaying, progress, accentColor = '#ff6b00' }) {
    const canvasRef = useRef(null)
    const animFrameRef = useRef(null)
    const timeRef = useRef(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        const dpr = window.devicePixelRatio || 1

        const resize = () => {
            const rect = canvas.getBoundingClientRect()
            canvas.width = rect.width * dpr
            canvas.height = rect.height * dpr
            ctx.scale(dpr, dpr)
        }
        resize()

        const draw = () => {
            const rect = canvas.getBoundingClientRect()
            const W = rect.width
            const H = rect.height
            ctx.clearRect(0, 0, W, H)

            if (isPlaying) timeRef.current += 0.04
            const t = timeRef.current

            const barCount = Math.floor(W / 3.5)
            const barWidth = 2
            const gap = (W - barCount * barWidth) / (barCount - 1)

            for (let i = 0; i < barCount; i++) {
                const x = i * (barWidth + gap)
                const normalizedX = i / barCount

                const wave1 = Math.sin(normalizedX * 6 + t * 2.5) * 0.3
                const wave2 = Math.sin(normalizedX * 12 + t * 1.8) * 0.15
                const wave3 = Math.sin(normalizedX * 3 + t * 3.2) * 0.2
                const noise = Math.sin(i * 127.1 + t * 0.7) * 0.1
                const envelope = Math.sin(normalizedX * Math.PI) * 0.8 + 0.2

                let amplitude
                if (isPlaying) {
                    amplitude = (0.3 + wave1 + wave2 + wave3 + noise) * envelope
                    amplitude = Math.max(0.05, Math.min(1, amplitude))
                } else {
                    amplitude = 0.03 + Math.sin(i * 73.7) * 0.02
                }

                const barH = amplitude * H * 0.85
                const y = (H - barH) / 2

                const isBeforeProgress = normalizedX <= progress
                if (isBeforeProgress) {
                    const alpha = isPlaying ? 0.6 + wave1 * 0.4 : 0.3
                    ctx.fillStyle = accentColor + Math.round(alpha * 255).toString(16).padStart(2, '0')
                } else {
                    ctx.fillStyle = isPlaying
                        ? `rgba(255,255,255,${0.08 + Math.abs(wave2) * 0.12})`
                        : 'rgba(255,255,255,0.06)'
                }

                const radius = Math.min(barWidth / 2, barH / 2, 1)
                ctx.beginPath()
                ctx.roundRect(x, y, barWidth, barH, radius)
                ctx.fill()
            }

            animFrameRef.current = requestAnimationFrame(draw)
        }

        draw()
        window.addEventListener('resize', resize)
        return () => {
            cancelAnimationFrame(animFrameRef.current)
            window.removeEventListener('resize', resize)
        }
    }, [isPlaying, progress, accentColor])

    return (
        <canvas
            ref={canvasRef}
            className="w-full"
            style={{ height: '48px', display: 'block' }}
        />
    )
}

// ─── Transport Button ───
// Botón de ícono plano (borde 2px, sin glow) con área táctil de 44px.
function TBtn({ onClick, disabled, children, title }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-label={title}
            className="inline-flex items-center justify-center w-11 h-11 rounded-full border-2 border-white/15 text-white/75 enabled:hover:text-white enabled:hover:border-white/50 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-section-blog"
        >
            {children}
        </button>
    )
}

// ─── Time formatter ───
function fmtTime(seconds) {
    if (!seconds || seconds < 0) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
}

// ─── Smart text splitter ───
function splitIntoChunks(text, maxLen = 180) {
    const paragraphs = text.split(/\n\n+/).filter(Boolean)
    const chunks = []
    for (const para of paragraphs) {
        if (para.length <= maxLen) {
            chunks.push(para.trim())
            continue
        }
        const sentences = para.match(/[^.!?]+[.!?]+[\s]*/g) || [para]
        let current = ''
        for (const s of sentences) {
            if ((current + s).length > maxLen && current) {
                chunks.push(current.trim())
                current = ''
            }
            current += s
        }
        if (current.trim()) chunks.push(current.trim())
    }
    return chunks.length ? chunks : [text]
}

// ─── Waveshaper distortion curve (soft clip for digital crunch) ───
function makeDistortionCurve(amount = 20) {
    const samples = 44100
    const curve = new Float32Array(samples)
    const deg = Math.PI / 180
    for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1
        curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x))
    }
    return curve
}

// ─── Global kill switch ───
if (typeof window !== 'undefined') {
    const killTTS = () => {
        try { window.speechSynthesis?.cancel() } catch { }
        try { window.dispatchEvent(new CustomEvent('tts-stop')) } catch { }
    }
    window.addEventListener('beforeunload', killTTS)
    window.addEventListener('pagehide', killTTS)
}

// ─── Build proxy TTS URL ───
function buildTTSUrl(text, lang) {
    const tl = lang === 'es' ? 'es' : 'en'
    return `${TTS_API}?text=${encodeURIComponent(text)}&lang=${tl}`
}

// ────────────────────── Main BlogTTS Component ──────────────────────
export default function BlogTTS({ htmlContent, plainText, lang = 'en' }) {
    const [active, setActive] = useState(false)
    const [playing, setPlaying] = useState(false)
    const [progress, setProgress] = useState(0)
    const [elapsed, setElapsed] = useState(0)
    const [totalTime, setTotalTime] = useState(0)
    const [collapsed, setCollapsed] = useState(true)
    const [voiceName, setVoiceName] = useState('')
    const [engine, setEngine] = useState('')

    const intervalRef = useRef(null)
    const startTimeRef = useRef(0)
    const accumulatedRef = useRef(0)
    const textRef = useRef('')
    const chunksRef = useRef([])
    const currentChunkRef = useRef(0)
    const isCanceledRef = useRef(false)
    const hasNativeVoiceRef = useRef(false)

    // Web Audio for robotic processing
    const audioCtxRef = useRef(null)
    const currentSourceRef = useRef(null)  // current playing AudioBufferSourceNode

    // Extract clean text from HTML
    useEffect(() => {
        if (plainText) {
            textRef.current = plainText
        } else if (htmlContent) {
            const div = document.createElement('div')
            div.innerHTML = htmlContent
            const walk = (node) => {
                if (node.nodeType === 3) return node.textContent
                if (node.nodeType !== 1) return ''
                const tag = node.tagName.toLowerCase()
                const children = Array.from(node.childNodes).map(walk).join('')
                if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'br'].includes(tag)) {
                    return children + '\n\n'
                }
                return children
            }
            textRef.current = walk(div).replace(/\n{3,}/g, '\n\n').trim()
        }
        const words = textRef.current.split(/\s+/).length
        setTotalTime(Math.round((words / 140) * 60))
        chunksRef.current = splitIntoChunks(textRef.current)
    }, [htmlContent, plainText])

    // Always use CYBER_VOX proxy engine for both languages
    useEffect(() => {
        const isEs = lang === 'es'
        hasNativeVoiceRef.current = false  // always use proxy + robotic effects
        setEngine('proxy')
        setVoiceName(isEs ? 'CYBER_VOX (es-MX)' : 'CYBER_VOX (en)')
    }, [lang])


    function findBestVoice(voices, targetLang) {
        const isEs = targetLang === 'es'
        if (isEs) {
            const prefs = ['Microsoft Sabina', 'Paulina', 'Google español', 'Microsoft Raul', 'Monica', 'Jorge']
            for (const name of prefs) {
                const v = voices.find(v => v.name.includes(name))
                if (v) return v
            }
            return voices.find(v => v.lang === 'es-MX')
                || voices.find(v => v.lang === 'es-419')
                || voices.find(v => v.lang.startsWith('es'))
                || null
        } else {
            const prefs = ['Microsoft Mark', 'Microsoft David', 'Microsoft Zira', 'Google US English', 'Samantha', 'Daniel', 'Alex']
            for (const name of prefs) {
                const v = voices.find(v => v.name.includes(name))
                if (v) return v
            }
            return voices.find(v => v.lang.startsWith('en')) || null
        }
    }

    // ─── Initialize / get AudioContext for robotic processing ───
    function getAudioCtx() {
        if (!audioCtxRef.current) {
            const Ctx = window.AudioContext || window.webkitAudioContext
            if (Ctx) audioCtxRef.current = new Ctx()
        }
        const ctx = audioCtxRef.current
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => { })
        return ctx
    }

    // ─── Stop current Web Audio source ───
    function stopCurrentSource() {
        if (currentSourceRef.current) {
            try { currentSourceRef.current.stop(0) } catch { }
            currentSourceRef.current = null
        }
    }

    // ─── ENGINE 1: Native speechSynthesis ───
    const speakNativeChunk = useCallback((index) => {
        if (index >= chunksRef.current.length) {
            window.speechSynthesis.cancel()
            setActive(false)
            setPlaying(false)
            setProgress(1)
            clearInterval(intervalRef.current)
            window.dispatchEvent(new CustomEvent('tts-stop'))
            return
        }
        currentChunkRef.current = index
        isCanceledRef.current = false

        const text = chunksRef.current[index]
        const utter = new SpeechSynthesisUtterance(text)
        utter.lang = lang === 'es' ? 'es-MX' : 'en-US'
        const voices = window.speechSynthesis?.getVoices() || []
        const voice = findBestVoice(voices, lang)
        if (voice) utter.voice = voice
        utter.pitch = 0.82
        utter.rate = 0.88
        utter.volume = 1

        utter.onend = () => {
            if (isCanceledRef.current) return
            speakNativeChunk(index + 1)
        }
        utter.onerror = (e) => {
            if (e.error === 'canceled' || e.error === 'interrupted') return
            window.speechSynthesis.cancel()
            setActive(false); setPlaying(false)
            clearInterval(intervalRef.current)
            window.dispatchEvent(new CustomEvent('tts-stop'))
        }
        window.speechSynthesis.speak(utter)
    }, [lang])

    // ─── ENGINE 2: Proxy TTS with robotic Web Audio processing ───
    const speakProxyChunk = useCallback((index) => {
        if (index >= chunksRef.current.length) {
            stopCurrentSource()
            setActive(false)
            setPlaying(false)
            setProgress(1)
            clearInterval(intervalRef.current)
            window.dispatchEvent(new CustomEvent('tts-stop'))
            return
        }
        currentChunkRef.current = index
        isCanceledRef.current = false

        const text = chunksRef.current[index]
        const url = buildTTSUrl(text, lang)

        const ctx = getAudioCtx()
        if (!ctx) {
            console.warn('[TTS] No AudioContext available')
            return
        }

        fetch(url)
            .then(r => {
                if (!r.ok) throw new Error('fetch-failed')
                return r.arrayBuffer()
            })
            .then(buf => ctx.decodeAudioData(buf))
            .then(audioBuffer => {
                if (isCanceledRef.current) return

                // ══════════════════════════════════════════════════
                //  CYBER_VOX — Robotic voice effects chain
                //
                //  Source (1.05x speed — snappy, not slow)
                //    → Ring Modulator (30Hz sine — classic robot voice)
                //    → Ring Modulator 2 (80Hz sine — metallic harmonics)
                //    → Bandpass (1600Hz, narrow — walkie-talkie/intercom)
                //    → Peaking EQ (+8dB @ 2200Hz — harsh metallic edge)
                //    → Waveshaper (aggressive digital distortion)
                //    → Highpass (remove muddy lows)
                //    → Compressor (punch + even levels)
                //    → Output gain
                //    → destination
                // ══════════════════════════════════════════════════

                const source = ctx.createBufferSource()
                source.buffer = audioBuffer
                // Normal-to-slightly-fast speed — NOT slow
                source.playbackRate.value = 1.05

                // ── Ring Modulator 1: Classic robot voice ──
                // Multiply signal by a low-frequency sine wave
                // This creates the signature "robot talking" effect
                const ringOsc1 = ctx.createOscillator()
                ringOsc1.type = 'sine'
                ringOsc1.frequency.value = 30  // 30Hz gives deep robotic modulation
                const ringGain1 = ctx.createGain()
                ringGain1.gain.value = 0  // modulated by oscillator
                ringOsc1.connect(ringGain1.gain) // AM modulation
                ringOsc1.start()

                // ── Ring Modulator 2: Metallic harmonics ──
                const ringOsc2 = ctx.createOscillator()
                ringOsc2.type = 'square'  // square wave = harsher harmonics
                ringOsc2.frequency.value = 80
                const ringGain2 = ctx.createGain()
                ringGain2.gain.value = 0
                ringOsc2.connect(ringGain2.gain)
                ringOsc2.start()

                // ── Dry/wet mix for ring modulators ──
                // Blend: 55% ring-modulated + 45% dry signal
                // Too much ring mod makes speech unintelligible
                const dryGain = ctx.createGain()
                dryGain.gain.value = 0.45
                const wetGain1 = ctx.createGain()
                wetGain1.gain.value = 0.35
                const wetGain2 = ctx.createGain()
                wetGain2.gain.value = 0.20
                const mixBus = ctx.createGain()
                mixBus.gain.value = 1.0

                // Wire ring mod 1
                source.connect(ringGain1)
                ringGain1.connect(wetGain1)
                wetGain1.connect(mixBus)

                // Wire ring mod 2
                source.connect(ringGain2)
                ringGain2.connect(wetGain2)
                wetGain2.connect(mixBus)

                // Wire dry signal
                source.connect(dryGain)
                dryGain.connect(mixBus)

                // ── Bandpass: Walkie-talkie / intercom quality ──
                const bandpass = ctx.createBiquadFilter()
                bandpass.type = 'bandpass'
                bandpass.frequency.value = 1600
                bandpass.Q.value = 0.8  // narrow-ish for "radio" feel

                // ── Peaking EQ: Harsh metallic edge ──
                const peaking = ctx.createBiquadFilter()
                peaking.type = 'peaking'
                peaking.frequency.value = 2200
                peaking.Q.value = 2.0
                peaking.gain.value = 8  // +8dB — aggressive mid boost

                // ── Waveshaper: Heavy digital distortion ──
                const waveshaper = ctx.createWaveShaper()
                waveshaper.curve = makeDistortionCurve(35) // more aggressive than before
                waveshaper.oversample = '4x'

                // ── Highpass: Remove muddy low end ──
                const highpass = ctx.createBiquadFilter()
                highpass.type = 'highpass'
                highpass.frequency.value = 300
                highpass.Q.value = 0.7

                // ── Compressor: Even out levels ──
                const compressor = ctx.createDynamicsCompressor()
                compressor.threshold.value = -20
                compressor.knee.value = 6
                compressor.ratio.value = 12
                compressor.attack.value = 0.002
                compressor.release.value = 0.1

                // ── Output gain ──
                const outputGain = ctx.createGain()
                outputGain.gain.value = 2.0  // boost to compensate for processing

                // Wire the post-mix chain
                mixBus.connect(bandpass)
                bandpass.connect(peaking)
                peaking.connect(waveshaper)
                waveshaper.connect(highpass)
                highpass.connect(compressor)
                compressor.connect(outputGain)
                outputGain.connect(ctx.destination)

                source.onended = () => {
                    // Clean up oscillators
                    try { ringOsc1.stop() } catch { }
                    try { ringOsc2.stop() } catch { }
                    if (isCanceledRef.current) return
                    currentSourceRef.current = null
                    setTimeout(() => {
                        if (!isCanceledRef.current) speakProxyChunk(index + 1)
                    }, 100)
                }

                stopCurrentSource()
                source.start(0)
                currentSourceRef.current = source
            })
            .catch(err => {
                console.warn('[TTS] Chunk error:', err)
                if (!isCanceledRef.current) {
                    setTimeout(() => speakProxyChunk(index + 1), 200)
                }
            })
    }, [lang])

    // ─── Unified speak ───
    const speakChunk = useCallback((index) => {
        if (hasNativeVoiceRef.current) {
            speakNativeChunk(index)
        } else {
            speakProxyChunk(index)
        }
    }, [speakNativeChunk, speakProxyChunk])

    // ─── Progress timer ───
    const startProgressTimer = useCallback(() => {
        clearInterval(intervalRef.current)
        startTimeRef.current = Date.now()
        intervalRef.current = setInterval(() => {
            const now = Date.now()
            const e = accumulatedRef.current + (now - startTimeRef.current) / 1000
            setElapsed(e)
            if (totalTime > 0) setProgress(Math.min(e / totalTime, 1))
        }, 150)
    }, [totalTime])

    // ─── Stop everything ───
    const fullStop = useCallback(() => {
        isCanceledRef.current = true
        window.speechSynthesis?.cancel()
        stopCurrentSource()
        clearInterval(intervalRef.current)
        setActive(false)
        setPlaying(false)
        setProgress(0)
        setElapsed(0)
        accumulatedRef.current = 0
        currentChunkRef.current = 0
        window.dispatchEvent(new CustomEvent('tts-stop'))
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isCanceledRef.current = true
            window.speechSynthesis?.cancel()
            stopCurrentSource()
            clearInterval(intervalRef.current)
            try { audioCtxRef.current?.close() } catch { }
            window.dispatchEvent(new CustomEvent('tts-stop'))
        }
    }, [])

    // Stop when language changes
    useEffect(() => {
        if (active) fullStop()
    }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps

    // ─── PLAY ───
    const handlePlay = useCallback(() => {
        if (!textRef.current) return
        window.dispatchEvent(new CustomEvent('tts-start'))

        if (active && !playing) {
            isCanceledRef.current = true
            window.speechSynthesis?.cancel()
            stopCurrentSource()
            setTimeout(() => {
                setPlaying(true)
                startProgressTimer()
                speakChunk(currentChunkRef.current)
            }, 50)
            return
        }

        isCanceledRef.current = true
        window.speechSynthesis?.cancel()
        stopCurrentSource()
        clearInterval(intervalRef.current)
        setTimeout(() => {
            setActive(true)
            setPlaying(true)
            setProgress(0)
            setElapsed(0)
            accumulatedRef.current = 0
            currentChunkRef.current = 0
            startProgressTimer()
            speakChunk(0)
        }, 50)
    }, [active, playing, speakChunk, startProgressTimer])

    // ─── PAUSE ───
    const handlePause = useCallback(() => {
        isCanceledRef.current = true
        window.speechSynthesis?.cancel()
        stopCurrentSource()
        clearInterval(intervalRef.current)
        accumulatedRef.current += (Date.now() - startTimeRef.current) / 1000
        setPlaying(false)
    }, [])

    // ─── STOP ───
    const handleStop = useCallback(() => { fullStop() }, [fullStop])

    // ─── SKIP ───
    const handleSkip = useCallback((direction) => {
        if (!active) return
        isCanceledRef.current = true
        window.speechSynthesis?.cancel()
        stopCurrentSource()
        clearInterval(intervalRef.current)

        const nextIndex = Math.max(0, Math.min(
            chunksRef.current.length - 1,
            currentChunkRef.current + direction
        ))
        currentChunkRef.current = nextIndex

        const chunkFraction = nextIndex / chunksRef.current.length
        accumulatedRef.current = chunkFraction * totalTime
        setElapsed(accumulatedRef.current)
        setProgress(chunkFraction)

        if (playing) {
            setTimeout(() => {
                startProgressTimer()
                speakChunk(nextIndex)
            }, 80)
        }
    }, [active, playing, totalTime, speakChunk, startProgressTimer])

    const labels = lang === 'es'
        ? {
            idle: 'Deja que M.A.D.R.E. lea por ti',
            playing: 'Leyendo en voz alta',
            paused: 'En pausa',
            play: 'Reproducir',
            pause: 'Pausa',
            prev: 'Sección anterior',
            next: 'Sección siguiente',
            stop: 'Detener',
            progress: 'Progreso de la lectura',
        }
        : {
            idle: 'Let M.A.D.R.E. read for you',
            playing: 'Reading aloud',
            paused: 'Paused',
            play: 'Play',
            pause: 'Pause',
            prev: 'Previous section',
            next: 'Next section',
            stop: 'Stop',
            progress: 'Reading progress',
        }

    const statusLabel = active
        ? (playing ? labels.playing : labels.paused)
        : labels.idle

    const isSpeaking = active && playing
    const panelId = useId()

    return (
        <div className="my-8 rounded-2xl overflow-hidden border-2 border-white/10 bg-[#0d0714]">
            {/* Header bar */}
            <button
                type="button"
                aria-expanded={!collapsed}
                aria-controls={panelId}
                onClick={() => {
                    const willExpand = collapsed
                    setCollapsed(!collapsed)
                    if (willExpand && !active) {
                        // Auto-start TTS when expanding
                        setTimeout(() => handlePlay(), 150)
                    } else if (!willExpand && active) {
                        // Stop TTS when collapsing
                        handleStop()
                    }
                }}
                className="w-full flex items-center gap-3 sm:gap-4 min-h-14 px-4 sm:px-5 py-3 text-left rounded-2xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-section-blog"
            >
                <span className="shrink-0 grid place-items-center w-10 h-10 rounded-full bg-section-blog text-[#0a0510]">
                    <SpeakerWaveIcon className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0 font-bold text-white text-base sm:text-lg leading-snug">
                    {statusLabel}
                </span>
                {active && (
                    <span className="shrink-0 text-sm text-white/55 tabular-nums">
                        {fmtTime(elapsed)} / {fmtTime(totalTime)}
                    </span>
                )}
                <ChevronDownIcon
                    className={`shrink-0 w-5 h-5 text-white/50 transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`}
                    aria-hidden="true"
                />
            </button>

            {/* Expandable player. `inert` mientras está cerrado: si no, los
                controles ocultos por el max-height seguirían en el orden de tab. */}
            <div
                id={panelId}
                inert={collapsed}
                style={{
                    maxHeight: collapsed ? 0 : 480,
                    opacity: collapsed ? 0 : 1,
                    overflow: 'hidden',
                    transition: 'max-height 0.3s ease, opacity 0.3s ease',
                }}
            >
                <div className="border-t-2 border-white/10 px-4 sm:px-5 py-5">
                    <div className="flex flex-col sm:flex-row items-center gap-5">
                        {/* Avatar video */}
                        <div
                            className={`shrink-0 w-28 h-28 sm:w-40 sm:h-40 rounded-full overflow-hidden border-2 transition-colors duration-300 ${isSpeaking ? 'border-section-blog' : 'border-white/15'}`}
                        >
                            <video
                                src="/bipbop.mp4"
                                muted
                                loop
                                autoPlay
                                playsInline
                                aria-hidden="true"
                                className="w-full h-full object-cover"
                            />
                        </div>

                        <div className="flex-1 min-w-0 w-full">
                            {/* Waveform */}
                            <WaveformCanvas
                                isPlaying={isSpeaking}
                                progress={progress}
                                accentColor="#ff6b00"
                            />

                            {/* Progress bar */}
                            <div
                                role="progressbar"
                                aria-label={labels.progress}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.round(progress * 100)}
                                className="mt-3 h-1.5 w-full rounded-full bg-white/10 overflow-hidden"
                            >
                                <div
                                    className="h-full rounded-full bg-section-blog transition-[width] duration-300"
                                    style={{ width: `${progress * 100}%` }}
                                />
                            </div>

                            {/* Transport controls */}
                            <div className="mt-4 flex items-center justify-center gap-2">
                                <TBtn onClick={() => handleSkip(-1)} disabled={!active} title={labels.prev}>
                                    <BackwardIcon className="w-5 h-5" aria-hidden="true" />
                                </TBtn>

                                {!active || !playing ? (
                                    <button
                                        type="button"
                                        onClick={handlePlay}
                                        className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-section-blog text-[#0a0510] font-bold text-sm uppercase tracking-[0.14em] hover:bg-[#ff8a33] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-section-blog"
                                    >
                                        <PlayIcon className="w-5 h-5" aria-hidden="true" />
                                        <span>{labels.play}</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handlePause}
                                        className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-section-blog text-[#0a0510] font-bold text-sm uppercase tracking-[0.14em] hover:bg-[#ff8a33] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-section-blog"
                                    >
                                        <PauseIcon className="w-5 h-5" aria-hidden="true" />
                                        <span>{labels.pause}</span>
                                    </button>
                                )}

                                <TBtn onClick={() => handleSkip(1)} disabled={!active} title={labels.next}>
                                    <ForwardIcon className="w-5 h-5" aria-hidden="true" />
                                </TBtn>

                                <TBtn onClick={handleStop} disabled={!active} title={labels.stop}>
                                    <StopIcon className="w-4 h-4" aria-hidden="true" />
                                </TBtn>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

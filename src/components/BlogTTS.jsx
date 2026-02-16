/**
 * BlogTTS — Text-to-Speech player for blog posts
 * Futuristic terminal CRT theme with animated waveform visualization
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

import React, { useState, useEffect, useRef, useCallback } from 'react'

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

            if (isPlaying && progress > 0) {
                const px = progress * W
                const grad = ctx.createLinearGradient(px - 8, 0, px + 8, 0)
                grad.addColorStop(0, 'transparent')
                grad.addColorStop(0.5, accentColor + '66')
                grad.addColorStop(1, 'transparent')
                ctx.fillStyle = grad
                ctx.fillRect(px - 8, 0, 16, H)
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
function TBtn({ onClick, disabled, children, title, glow }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className="transition-all active:scale-95 disabled:opacity-30"
            style={{
                background: glow ? 'rgba(255,107,0,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${glow ? 'rgba(255,107,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 6,
                padding: '6px 10px',
                color: glow ? '#ffb366' : 'rgba(226,232,240,0.6)',
                fontSize: 14,
                cursor: disabled ? 'default' : 'pointer',
                boxShadow: glow ? '0 0 12px rgba(255,107,0,0.15)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 36,
                minHeight: 36,
            }}
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
        ? { idle: 'Deja que M.A.D.R.E. lea por ti', playing: 'reproduciendo...', paused: 'en_pausa' }
        : { idle: 'Let M.A.D.R.E. read for you', playing: 'now_playing...', paused: 'audio_paused' }

    const statusLabel = active
        ? (playing ? labels.playing : labels.paused)
        : labels.idle

    return (
        <div
            className="my-6 rounded-xl overflow-hidden transition-all"
            style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,107,0,0.15)',
                backdropFilter: 'blur(8px)',
            }}
        >
            {/* Header bar */}
            <button
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
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
                style={{ background: collapsed ? 'transparent' : 'rgba(255,107,0,0.04)' }}
            >
                <span style={{ color: '#ff6b00', fontSize: 16, fontFamily: 'monospace', opacity: 0.8 }}>
                    {'>'}_
                </span>
                <span
                    className="text-[11px] uppercase tracking-widest flex-1 text-left"
                    style={{ color: 'rgba(255,179,102,0.6)', fontFamily: '"Cascadia Code", monospace' }}
                >
                    {statusLabel}
                </span>
                {active && (
                    <span className="text-[10px]" style={{ color: 'rgba(255,179,102,0.4)', fontFamily: 'monospace' }}>
                        {fmtTime(elapsed)} / {fmtTime(totalTime)}
                    </span>
                )}
                <span style={{ color: 'rgba(255,179,102,0.3)', fontSize: 10 }}>
                    {collapsed ? '\u25BC' : '\u25B2'}
                </span>
            </button>

            {/* Expandable player */}
            <div
                style={{
                    maxHeight: collapsed ? 0 : 400,
                    opacity: collapsed ? 0 : 1,
                    overflow: 'hidden',
                    transition: 'max-height 0.3s ease, opacity 0.3s ease',
                }}
            >
                <div className="px-5 pt-4 pb-5">
                    <div className="flex gap-5" style={{ alignItems: 'center' }}>
                        {/* Avatar video */}
                        <div style={{
                            width: 160, height: 160, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                            border: `2px solid ${active && playing ? 'rgba(255,107,0,0.5)' : 'rgba(255,107,0,0.15)'}`,
                            boxShadow: active && playing
                                ? '0 0 16px rgba(255,107,0,0.3), inset 0 0 8px rgba(255,107,0,0.15)'
                                : '0 0 4px rgba(255,107,0,0.1)',
                            transition: 'border-color 0.4s, box-shadow 0.4s',
                            alignSelf: 'center',
                        }}>
                            <video
                                src="/bipbop.mp4"
                                muted
                                loop
                                autoPlay
                                playsInline
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Waveform */}
                            <div className="mb-3 rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)' }}>
                                <WaveformCanvas
                                    isPlaying={active && playing}
                                    progress={progress}
                                    accentColor="#ff6b00"
                                />
                            </div>

                            {/* Progress bar */}
                            <div className="w-full h-1 rounded-full mb-3 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                        width: `${progress * 100}%`,
                                        background: 'linear-gradient(90deg, #ff6b00, #ffb366)',
                                        boxShadow: '0 0 8px rgba(255,107,0,0.4)',
                                    }}
                                />
                            </div>

                            {/* Transport controls */}
                            <div className="flex items-center justify-center gap-2">
                                <TBtn onClick={() => handleSkip(-1)} disabled={!active} title="Previous section">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M18 18L9.5 12L18 6v12zM8 6H6v12h2V6z" />
                                    </svg>
                                </TBtn>

                                {!active || !playing ? (
                                    <TBtn onClick={handlePlay} glow title="Play">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </TBtn>
                                ) : (
                                    <TBtn onClick={handlePause} glow title="Pause">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                                        </svg>
                                    </TBtn>
                                )}

                                <TBtn onClick={() => handleSkip(1)} disabled={!active} title="Next section">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                                    </svg>
                                </TBtn>

                                <TBtn onClick={handleStop} disabled={!active} title="Stop">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                        <rect x="6" y="6" width="12" height="12" rx="1" />
                                    </svg>
                                </TBtn>
                            </div>

                            {/* Voice/engine info */}
                            <p className="text-center mt-2 text-[9px]" style={{ color: 'rgba(255,179,102,0.25)', fontFamily: 'monospace' }}>
                                {engine === 'proxy'
                                    ? `engine: CYBER_VOX | ${lang === 'es' ? 'es-MX' : 'en-US'} | robotic`
                                    : `voice: ${voiceName || 'default'} | ${lang === 'es' ? 'es-MX' : 'en-US'}`
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    )
}

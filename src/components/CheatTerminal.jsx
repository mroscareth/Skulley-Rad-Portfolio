import React, { useState, useEffect, useRef, useCallback } from 'react'
import { playSfx } from '../lib/sfx.js'
import { useAuth } from '../auth/authContext.js'

/**
 * CheatTerminal — CRT-style terminal modal for entering cheat / discount codes.
 * Validates codes against the server API instead of a static registry.
 */

const API = `${import.meta.env.VITE_API_URL || ''}/api/codes.php`

// Execution animation lines (shown after server validation succeeds)
function buildSuccessLines(label, type, discountPct) {
  const reward = type === 'discount'
    ? `${discountPct}% discount applied!`
    : label || 'Reward unlocked!'
  return [
    { text: '> Validating access code...', delay: 0, color: '#94a3b8' },
    { text: '> Querying rewards database...', delay: 400, color: '#94a3b8' },
    { text: '> Decrypting payload...', delay: 800, color: '#94a3b8' },
    { text: 'PROGRESS', delay: 1000, duration: 1200 },
    { text: `> ✨ CODE ACCEPTED — ${label?.toUpperCase() || 'REWARD UNLOCKED'}`, delay: 2400, color: '#4ade80' },
    { text: `> Reward: ${reward}`, delay: 2800, color: '#facc15' },
  ]
}

const WELCOME_LINES = [
  { text: ' ██████╗██╗  ██╗███████╗ █████╗ ████████╗', color: '#3b82f6' },
  { text: '██╔════╝██║  ██║██╔════╝██╔══██╗╚══██╔══╝', color: '#3b82f6' },
  { text: '██║     ███████║█████╗  ███████║   ██║   ', color: '#60a5fa' },
  { text: '██║     ██╔══██║██╔══╝  ██╔══██║   ██║   ', color: '#60a5fa' },
  { text: '╚██████╗██║  ██║███████╗██║  ██║   ██║   ', color: '#93c5fd' },
  { text: ' ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ', color: '#93c5fd' },
  { text: ' ██████╗ ██████╗ ██████╗ ███████╗███████╗', color: '#3b82f6' },
  { text: '██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔════╝', color: '#3b82f6' },
  { text: '██║     ██║   ██║██║  ██║█████╗  ███████╗', color: '#60a5fa' },
  { text: '██║     ██║   ██║██║  ██║██╔══╝  ╚════██║', color: '#60a5fa' },
  { text: '╚██████╗╚██████╔╝██████╔╝███████╗███████║', color: '#93c5fd' },
  { text: ' ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚══════╝', color: '#93c5fd' },
  { text: '', color: '#94a3b8' },
  { text: '> SKULLEY_RAD Cheat System v1.0', color: '#94a3b8' },
  { text: '> Enter activation code below:', color: '#94a3b8' },
]

const ACTION_DELAY = 3200 // ms before triggering the frontend action

export default function CheatTerminal({ open, onClose, onCodeAccepted, goldSkinUnlocked = false }) {
  const { authenticated, user } = useAuth()
  const [outputLines, setOutputLines] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressPercent, setProgressPercent] = useState(0)
  // Two-phase input: 'code' → 'email'
  const [inputPhase, setInputPhase] = useState('code')
  const [pendingCode, setPendingCode] = useState('')
  const inputRef = useRef(null)
  const scrollRef = useRef(null)
  const timersRef = useRef([])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id))
    timersRef.current = []
  }, [])

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setOutputLines([])
      setInputValue('')
      setIsProcessing(false)
      setProgressPercent(0)
      setInputPhase('code')
      setPendingCode('')
      clearTimers()
      WELCOME_LINES.forEach((line, i) => {
        const id = setTimeout(() => {
          setOutputLines((prev) => [...prev, line])
        }, i * 60)
        timersRef.current.push(id)
      })
      const focusId = setTimeout(() => {
        inputRef.current?.focus()
      }, WELCOME_LINES.length * 60 + 100)
      timersRef.current.push(focusId)
    } else {
      clearTimers()
    }
  }, [open, clearTimers])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [outputLines, progressPercent])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e?.key === 'Escape' && !isProcessing) onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, isProcessing])

  // Run animated execution lines + trigger action
  const runExecution = useCallback((lines, action) => {
    lines.forEach((line) => {
      if (line.text === 'PROGRESS') {
        const startTime = line.delay
        const duration = line.duration || 1200
        const steps = 20
        for (let s = 0; s <= steps; s++) {
          const id = setTimeout(() => {
            setProgressPercent(Math.round((s / steps) * 100))
          }, startTime + (duration * s) / steps)
          timersRef.current.push(id)
        }
        return
      }
      const id = setTimeout(() => {
        setOutputLines((prev) => [...prev, { text: line.text, color: line.color }])
      }, line.delay)
      timersRef.current.push(id)
    })

    const actionId = setTimeout(() => {
      setIsProcessing(false)
      setProgressPercent(0)
      setInputPhase('code')
      try { onCodeAccepted?.(action) } catch { }
    }, ACTION_DELAY)
    timersRef.current.push(actionId)
  }, [onCodeAccepted])

  // Validate code + email against server (includes privy_id for profile linking)
  const validateWithServer = useCallback(async (code, email) => {
    setIsProcessing(true)
    try {
      const res = await fetch(`${API}?action=validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email, privy_id: user?.id || '' }),
      })
      const json = await res.json()

      if (!json.ok) {
        let errorMsg = 'Unknown activation code'
        if (json.error === 'code_inactive') errorMsg = 'This code has been deactivated'
        else if (json.error === 'code_expired') errorMsg = 'This code has expired'
        else if (json.error === 'code_exhausted') errorMsg = 'This code has reached its usage limit'
        else if (json.error === 'rate_limited') errorMsg = 'Too many attempts. Try again later'
        else if (json.error === 'valid_email_required') errorMsg = 'Invalid email address'

        try { playSfx('click', { volume: 0.5 }) } catch { }
        const id = setTimeout(() => {
          setOutputLines((prev) => [
            ...prev,
            { text: `> ERROR: ${errorMsg}`, color: '#ef4444', shake: true },
            { text: '> Type a valid code to continue.', color: '#94a3b8' },
          ])
          setIsProcessing(false)
          setInputPhase('code')
        }, 300)
        timersRef.current.push(id)
        return
      }

      // Success — run execution animation
      try { playSfx('click', { volume: 0.8 }) } catch { }
      const lines = buildSuccessLines(json.label, json.type, json.discount_pct)
      runExecution(lines, json.action)
    } catch {
      const id = setTimeout(() => {
        setOutputLines((prev) => [
          ...prev,
          { text: '> ERROR: Connection failed. Try again.', color: '#ef4444', shake: true },
        ])
        setIsProcessing(false)
        setInputPhase('code')
      }, 300)
      timersRef.current.push(id)
    }
  }, [runExecution, user])

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault()
    if (isProcessing || !inputValue.trim()) return
    const val = inputValue.trim()
    setInputValue('')

    if (inputPhase === 'code') {
      // --- Phase 1: Code entered ---
      setOutputLines((prev) => [
        ...prev,
        { text: `skulley@rad:~$ ${val}`, color: '#60a5fa' },
      ])

      // Quick local check for goldSkin already active
      if (val.toLowerCase() === 'goldeneggs' && goldSkinUnlocked) {
        const id = setTimeout(() => {
          setOutputLines((prev) => [
            ...prev,
            { text: '> WARNING: Code already redeemed', color: '#f59e0b' },
            { text: '> This reward is already active.', color: '#94a3b8' },
          ])
        }, 300)
        timersRef.current.push(id)
        return
      }

      // Ask for email OR submit automatically if authenticated
      setPendingCode(val)
      
      if (authenticated && user) {
        const identity = user.email?.address || user.wallet?.address || 'auth_identity'
        const id = setTimeout(() => {
          setOutputLines((prev) => [
            ...prev,
            { text: '> Code registered. Authenticated session detected.', color: '#22d3ee' },
            { text: `> Confirming identity: ${identity}...`, color: '#60a5fa' },
          ])
          // Validate immediately instead of asking for email
          validateWithServer(val, identity)
        }, 300)
        timersRef.current.push(id)
      } else {
        const id = setTimeout(() => {
          setOutputLines((prev) => [
            ...prev,
            { text: '> Code registered. Enter your email to confirm:', color: '#22d3ee' },
          ])
          setInputPhase('email')
          inputRef.current?.focus()
        }, 300)
        timersRef.current.push(id)
      }

    } else if (inputPhase === 'email') {
      // --- Phase 2: Email entered ---
      setOutputLines((prev) => [
        ...prev,
        { text: `email:~$ ${val}`, color: '#60a5fa' },
      ])

      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        const id = setTimeout(() => {
          setOutputLines((prev) => [
            ...prev,
            { text: '> ERROR: Invalid email format', color: '#ef4444', shake: true },
            { text: '> Please enter a valid email address:', color: '#22d3ee' },
          ])
          inputRef.current?.focus()
        }, 200)
        timersRef.current.push(id)
        return
      }

      // Validate with server (code + email)
      validateWithServer(pendingCode, val)
    }
  }, [inputValue, isProcessing, inputPhase, pendingCode, goldSkinUnlocked, validateWithServer, authenticated, user])

  // Dynamic prompt text based on phase
  const promptText = inputPhase === 'email' ? 'email:~$' : 'skulley@rad:~$'

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-debug flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Cheat Terminal"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose?.()
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-none" />

      {/* Terminal styles */}
      <style>{`
        @keyframes terminalGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3), inset 0 0 60px rgba(59, 130, 246, 0.05); }
          50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.4), inset 0 0 80px rgba(59, 130, 246, 0.08); }
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes lineAppear {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shakeError {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .cheat-line-enter { animation: lineAppear 0.2s ease-out both; }
        .cheat-line-shake { animation: shakeError 0.4s ease-out both; }
        .cheat-cursor { animation: cursorBlink 0.8s step-end infinite; }
      `}</style>

      {/* Modal content - Terminal style */}
      <div
        className="relative w-[min(520px,92vw)] rounded-lg overflow-hidden crt-scanlines"
        style={{
          backgroundColor: '#0a0a14',
          border: '2px solid #3b82f6',
          fontFamily: '"Cascadia Code", "Fira Code", monospace',
          animation: 'terminalGlow 3s ease-in-out infinite',
        }}
      >

        {/* Terminal header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-blue-500/30 bg-blue-500/10 relative z-20">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer z-30"
              onClick={() => { try { playSfx('click', { volume: 0.8 }) } catch { }; if (!isProcessing) onClose?.() }}
              aria-label="Close"
              disabled={isProcessing}
            >
              <span className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
            </button>
            <div className="w-3 h-3 rounded-full bg-white/20" />
            <div className="w-3 h-3 rounded-full bg-white/20" />
          </div>
          <span className="text-blue-500/70 text-xs">M.A.D.R.E.@mausoleum:~/cheats</span>
          <div className="w-6" />
        </div>

        {/* Terminal output */}
        <div
          ref={scrollRef}
          className="px-4 py-3 max-h-[320px] overflow-y-auto relative z-20"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#3b82f6 transparent' }}
        >
          {outputLines.map((line, i) => (
            <div
              key={i}
              className={`text-xs leading-relaxed whitespace-pre ${line.shake ? 'cheat-line-shake' : 'cheat-line-enter'}`}
              style={{ color: line.color || '#94a3b8' }}
            >
              {line.text || '\u00A0'}
            </div>
          ))}

          {/* Progress bar */}
          {isProcessing && progressPercent > 0 && (
            <div className="cheat-line-enter text-xs leading-relaxed flex items-center gap-2 mt-1">
              <span style={{ color: '#94a3b8' }}>&gt; </span>
              <span style={{ color: '#94a3b8' }}>[</span>
              <div className="flex-1 h-2 rounded-sm overflow-hidden bg-blue-900/50 max-w-[220px]">
                <div
                  className="h-full rounded-sm transition-all duration-75"
                  style={{
                    width: `${progressPercent}%`,
                    background: progressPercent >= 100
                      ? 'linear-gradient(90deg, #4ade80, #22d3ee)'
                      : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                    boxShadow: `0 0 8px ${progressPercent >= 100 ? 'rgba(74,222,128,0.5)' : 'rgba(59,130,246,0.4)'}`,
                  }}
                />
              </div>
              <span style={{ color: progressPercent >= 100 ? '#4ade80' : '#60a5fa', minWidth: '32px', textAlign: 'right' }}>
                {progressPercent}%
              </span>
              <span style={{ color: '#94a3b8' }}>]</span>
            </div>
          )}
        </div>

        {/* Input line */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-0 px-4 py-3 border-t border-blue-500/30 bg-blue-500/5 relative z-20"
        >
          <span className="text-blue-400 text-xs whitespace-nowrap mr-1" style={{ textShadow: '0 0 6px rgba(59,130,246,0.4)' }}>
            {promptText}
          </span>
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isProcessing}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className="w-full bg-transparent outline-none text-xs caret-transparent"
              style={{
                color: '#e2e8f0',
                fontFamily: '"Cascadia Code", "Fira Code", monospace',
              }}
              aria-label={inputPhase === 'email' ? 'Email input' : 'Cheat code input'}
            />
            {/* Custom blinking cursor */}
            {!isProcessing && (
              <span
                className="cheat-cursor absolute top-0 text-xs pointer-events-none select-none"
                style={{
                  color: '#3b82f6',
                  left: `${inputValue.length * 0.6}em`,
                  textShadow: '0 0 6px rgba(59,130,246,0.6)',
                }}
              >
                █
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

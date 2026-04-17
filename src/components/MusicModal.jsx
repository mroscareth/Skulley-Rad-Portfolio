import React from 'react'
import MusicPlayer from './MusicPlayer.jsx'

// Centered modal wrapper for the DJ deck. Backdrop click closes; player's own
// X button (onClose) also closes. Kept mounted across open/closes (CSS hides
// it with `hidden`) so internal audio state / track buffers persist.
export default function MusicModal({
  open,
  onClose,
  tracks,
  navHeight,
  audioReady,
  pageHidden,
}) {
  return (
    <div
      className={`fixed inset-0 z-[14050] sm:z-[900] ${open ? 'grid' : 'hidden'} place-items-center`}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`relative pointer-events-auto transition-all duration-200 ${open ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95 pointer-events-none'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <MusicPlayer
          tracks={tracks}
          navHeight={navHeight}
          autoStart={audioReady}
          pageHidden={pageHidden}
          forceMobile={true}
          mobileBreakpointPx={1100}
          onClose={onClose}
        />
      </div>
    </div>
  )
}

import React from 'react'
import MusicPlayer from './MusicPlayer.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

// Centered modal wrapper for the music console. Backdrop click closes; the
// player's own X button and Escape (onClose) also close. Kept mounted across
// open/closes (CSS hides it with `hidden`) so internal audio state / track
// buffers persist.
export default function MusicModal({
  open,
  onClose,
  tracks,
  audioReady,
  pageHidden,
}) {
  const { t } = useLanguage()
  return (
    <div
      className={`fixed inset-0 z-[14050] sm:z-[900] ${open ? 'grid' : 'hidden'} place-items-center`}
      role="dialog"
      aria-modal="true"
      aria-label={t('music.dialogLabel')}
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
          autoStart={audioReady}
          pageHidden={pageHidden}
          active={open}
          onClose={onClose}
        />
      </div>
    </div>
  )
}

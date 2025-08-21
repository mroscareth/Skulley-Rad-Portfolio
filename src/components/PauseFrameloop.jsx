import { useThree } from '@react-three/fiber'
import React, { useEffect } from 'react'

export default function PauseFrameloop({ paused = false }) {
  const { setFrameloop, invalidate } = useThree()
  useEffect(() => {
    try {
      setFrameloop(paused ? 'never' : 'always')
      if (!paused) invalidate()
    } catch {}
  }, [paused, setFrameloop, invalidate])
  return null
}



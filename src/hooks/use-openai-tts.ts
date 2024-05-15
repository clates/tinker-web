import { useCallback, useEffect, useState } from 'react'
import { useOpenAI } from './use-openai'

export function useOpenAiTts(audioRef: React.RefObject<HTMLAudioElement>) {
  const [ttsPlayQueue, setTtsPlayQueue] = useState<string[]>([])
  const [isPlayingTTS, setIsPlayingTTS] = useState(false)
  const openai = useOpenAI()

  useEffect(() => {
    if (audioRef.current !== null) {
      // When the audio ends, play the next item in the queue.
      audioRef.current.onended = () => {
        if (audioRef.current === null) return
        console.log(`TTS ended, playing next item. ${ttsPlayQueue.length} remaining`)
        if (ttsPlayQueue.length > 0) {
          audioRef.current.src = ttsPlayQueue[0] || ''
          audioRef.current.load()
          audioRef.current.play()
          setTtsPlayQueue(ttsPlayQueue.slice(1))
        } else {
          console.log('TTS Queue is exhausted, resetting.')
          setIsPlayingTTS(false)
        }
      }
    }
  }, [audioRef, ttsPlayQueue])

  // When the queue changes, play the first item if we're not already playing.
  useEffect(() => {
    if (audioRef.current && ttsPlayQueue.length > 0 && !isPlayingTTS) {
      console.log('Starting TTS Queue...')
      setIsPlayingTTS(true)
      audioRef.current.src = ttsPlayQueue[0] || ''
      audioRef.current.load()
      audioRef.current.play()
      setTtsPlayQueue(ttsPlayQueue.slice(1))
    }
  }, [audioRef, isPlayingTTS, ttsPlayQueue])

  const addToTtsQueue = useCallback(
    (text: string) => {
      // Use Promises here to not block the main thread.
      //TODO: This has a race condition probably. Don't care enough to fix it.
      console.log('Sending TTS request:', text)
      const ttsRequest = openai.audio.speech
        .create({
          input: text,
          model: 'voice-en-us-ryan-high',
          voice: 'alloy', // Not used in LocalAi
          // backend: 'coqui', // Not used in OpenAi
        })
        .then((response) => {
          response.blob().then((blob) => {
            const audioSource = URL.createObjectURL(blob)
            console.log('Queueing TTS', audioSource)
            setTtsPlayQueue((_) => [..._, audioSource])
          })
        })
        .catch((error) => {
          console.error('Failed to generate TTS:', error)
        })
    },
    [openai.audio.speech],
  )

  return [isPlayingTTS, addToTtsQueue] as const
}

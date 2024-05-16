import { useEffect, useState } from 'react'
import { useOpenAI } from './use-openai'
import { Recorder } from 'vmsg'

const recorder = new Recorder({
  wasmURL: 'https://unpkg.com/vmsg@0.3.0/vmsg.wasm',
})
export function useOpenAIStt() {
  const [isRecording, setIsRecording] = useState(false)
  const [audioData, setAudioData] = useState<Blob>()
  const [recordedText, setRecordedText] = useState<string>()
  const [sttIsLoading, setSttIsLoading] = useState(false)
  const openai = useOpenAI()

  const record = async () => {
    setIsRecording(true)
    await recorder.initAudio()
    await recorder.initWorker()
    recorder.startRecording()
  }

  const stopRecording = async () => {
    if (!isRecording) return
    const audioBlob = await recorder.stopRecording()
    setAudioData(audioBlob)
    setIsRecording(false)
  }

  useEffect(() => {
    if (!audioData) return
    setSttIsLoading(true)
    openai.audio.transcriptions
      .create({
        file: new File([audioData], 'audio.mp3'),
        model: 'whisper-1',
      })
      .then((response) => {
        setRecordedText(response.text)
        setAudioData(undefined)
      })
      .catch((error) => {
        console.error('Exception during STT transcription:', error)
      })
      .finally(() => {
        setSttIsLoading(false)
      })
  }, [audioData, openai.audio.transcriptions])

  return [record, stopRecording, isRecording, sttIsLoading, recordedText] as const
}

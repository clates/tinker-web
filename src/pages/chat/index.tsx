import { FormEvent, useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { Loading } from 'src/components/loading'
import OpenAI from 'openai'
import { SpeechCreateParams } from 'openai/resources/audio/speech'

const makeAggroAI = (name: string) => ({
  role: Role.System,
  content: `You are roleplaying as the character "${name}. 
  You must follow the following rules while roleplaying:
  1) You should always respond as ${name}. Never as yourself.
  2) You should only say thing that ${name} would say. 
  ${name}'s job is to be an unintentionally condescending friend. 
  ${name} is always trying to help, but ${name} is always a little bit off.
  ${name} acts like a little bit of a know-it-all, but ${name} would never say so.
  ${name} never repeats themseves, and when agitated ${name} will leave the conversation to go eat.
  ${name} is brief in their responses and uses frequent explicit and vulgar language.
  ${name} is sometimes passive-aggressive when agitated.
  ${name} doesn't reference their own traits, but they do reference the traits of the person they are talking to.
  Respond only with the content that ${name} would say. Don't prefix your responses with <|assistant|> or anything else.`,
})

const makeFriendlyAI = (name: string) => ({
  role: Role.System,
  content: `You are roleplaying as the character "${name}. 
  You must follow the following rules while roleplaying:
  1) You should always respond as ${name}. Never as yourself.
  2) You should only say thing that ${name} would say. 
  ${name}'s job is to be a friendly and helpful friend. 
  ${name} is always trying to help, and ${name} is always on point.
  ${name} acts like a know-it-all, but ${name} would never say so.
  ${name} never repeats themseves
  ${name} is brief in their responses and never uses explicit or vulgar language.
  ${name} is patient cand kind.
  ${name} doesn't reference their own traits, but they do reference the traits of the person they are talking to.
  Respond only with the content that ${name} would say. Don't prefix your responses with <|assistant|> or anything else.`,
})

enum Role {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
}

const openai = new OpenAI({
  baseURL: 'http://host.docker.internal:8080/v1', // This is the default and can be omitted
  apiKey: '', // This is the default and can be omitted
  dangerouslyAllowBrowser: true, // I know what I'm doing
})

export default function Home() {
  const { t } = useTranslation('translation')
  const [messages, setMessages] = useState<{ role: Role; content: string }[]>([
    //makeAggroAI('Gummy')
    //makeFriendlyAI('Tinker')
  ])
  const [loading, setLoading] = useState(false)
  const [streamSource, setStreamSource] = useState('')
  const [ttsPlayQueue, setTtsPlayQueue] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioSourceRef = useRef<HTMLSourceElement>(null)

  // Dequeue the TTS queue after audio playback.
  useEffect(() => {
    console.log('TTS Queue:', ttsPlayQueue.length)
    if (audioRef.current === null) {
      return
    }
    if (!audioRef.current.onended) {
      console.log('Setting the onended event.')
      audioRef.current.onended = () => {
        if (audioRef.current === null) {
          return // typeguard
        }
        if (ttsPlayQueue.length > 0) {
          audioRef.current.src = ttsPlayQueue[0] || ''
          audioRef.current.load()
          audioRef.current.play()
          console.log('Dequeueing:', ttsPlayQueue.length)
          setTtsPlayQueue((oldQueue) => oldQueue.slice(0, 1))
        } else {
          console.log('Dequeued all, stopping playback.')
          // Reset the audio source
          audioRef.current.src = ''
          audioRef.current.load()
        }
      }
    }
  }, [ttsPlayQueue])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const prevMessages = [...messages]
    if (inputRef.current && inputRef.current?.value.trim() !== '') {
      const newMessage = { role: Role.User, content: inputRef.current.value.trim() }
      setMessages((prevMessages) => [...prevMessages, newMessage])
      inputRef.current.value = ''

      setLoading(true)

      const chatCompletion = await openai.chat.completions.create({
        model: 'phi-3-mini-4k-instruct',
        messages: [...prevMessages, newMessage],
        frequency_penalty: 0.3,
        presence_penalty: 0.6,
        stream: true,
      })

      // TODO: Fix this
      //Streaming the response
      let chatResponse = ''
      let ttsResponseEnqueue = ''
      const ttsSynthesizeQueue: string[] = []

      for await (const chunk of chatCompletion) {
        // Turn off loading, we have a response
        setLoading(false)

        // Chat response
        chatResponse += chunk.choices[0].delta.content
        setMessages([...prevMessages, newMessage, { role: Role.Assistant, content: chatResponse }])

        // TTS
        ttsResponseEnqueue += chunk.choices[0].delta.content
        if (
          // Natural pauses in speech
          ([',', '.', '?', '!'].includes(chunk.choices[0].delta.content || '') &&
            // Make sure we have a reasonable chunk.
            ttsResponseEnqueue.length > 100 &&
            // Arbitrary limit, the API has a 4096 character limit
            ttsResponseEnqueue.length < 2000) ||
          // Submit to the TTS if the chunking is over
          chunk.choices[0].finish_reason === 'stop'
        ) {
          // Synthesize the audio
          // TODO: This should be delegated to a worker thread
          // TODO: This should be a queue
          ttsSynthesizeQueue.push(ttsResponseEnqueue)
          const ttsResponse = await openai.audio.speech.create({
            input: ttsResponseEnqueue,
            model: 'voice-en-us-ryan-high',
            voice: 'alloy', // Not used in LocalAi
            // backend: 'coqui', // Not used in OpenAi
          } as SpeechCreateParams)
          const responseBlob = await ttsResponse.blob()
          const audioSource = URL.createObjectURL(responseBlob)
          // Start the queue processing if this is the only item.
          console.log(audioRef.current?.src)
          if (audioRef.current?.src === '' || audioRef.current?.src === 'http://localhost:5000/chat') {
            // Play the first item coming in and don't enqueue it.
            audioRef.current.src = audioSource || ''
            audioRef.current.load()
            audioRef.current.play()
          } else {
            console.log('Enqueueing onto:', ttsPlayQueue.length)
            setTtsPlayQueue((oldQueue) => [...oldQueue, audioSource])
          }
          ttsResponseEnqueue = '' //Flush the enqueue
        }
      }

      // Non-streaming responses
      // setMessages((prevMessages) => [
      //   ...prevMessages,
      //   { role: Role.Assistant, content: chatCompletion.choices[0].message.content || '' },
      // ])
      // setLoading(false)
    }
  }

  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === Role.Assistant && inputRef.current) {
      inputRef.current.focus()
    }
  }, [messages])

  return (
    <>
      <Helmet>
        <title>{t('title')}</title>
      </Helmet>

      <div className="flex h-screen flex-col justify-end bg-gray-100 pt-24">
        {
          // This is the chat window
        }
        <div className="flex-grow overflow-y-auto">
          {messages.map(
            (message) =>
              message.role !== Role.System && (
                <div
                  key={message.content}
                  className={`p-2 ${message.role === Role.User ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                >
                  {message.content}
                </div>
              ),
          )}
        </div>
        {loading && <Loading />}

        <form onSubmit={handleSubmit} className="p-2">
          <input
            disabled={loading}
            ref={inputRef}
            type="text"
            placeholder="Type your message..."
            className="w-full rounded border border-gray-300 p-2"
          />
          <button type="submit" className="mt-2 rounded bg-blue-500 px-4 py-2 text-white">
            Send
          </button>
        </form>
        <audio ref={audioRef} controls>
          <source ref={audioSourceRef} type="audio/mp3" />
        </audio>
      </div>
    </>
  )
}

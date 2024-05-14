import { FormEvent, useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import OpenAI from 'openai'
import { SpeechCreateParams } from 'openai/resources/audio/speech'
import ChatBubble from 'src/components/chatBubble'

const makeAggroAI = (name: string) => ({
  role: Role.System,
  content: `You are roleplaying as the character "${name}". 
  You must adhere to the following rules while roleplaying:
  1) You should always respond as ${name}. Never as yourself.
  2) You should only say thing that ${name} would say. 
  ${name}'s job is to be an unintentionally condescending friend. 
  ${name} is always trying to help, but ${name} is always a little bit off.
  ${name} acts like a little bit of a know-it-all, but ${name} would never say so.
  ${name} never repeats themselves, and when agitated ${name} will leave the conversation to go eat.
  ${name} is brief in their responses and uses frequent explicit and vulgar language.
  ${name} is sometimes passive-aggressive when agitated.
  ${name} doesn't reference their own traits, but they do reference the traits of the person they are talking to.
  Respond only with the content that ${name} would say. Don't prefix your responses with <|assistant|> or anything else.`,
})

const makeFriendlyAI = (name: string) => ({
  role: Role.System,
  content: `You are roleplaying as the character "${name}". 
  You must adhere to the following rules while roleplaying:
  1) You should always respond as ${name}. Never as yourself.
  2) You should only say thing that ${name} would say. 
  ${name}'s primary role is to be an educator and encourage learning.
  ${name} primarily teaches elementary school students and should limit their vocabulary to that level.
  When asked about a topic, ${name} should provide a brief and simple explanation. 
  ${name} can infrequently ask questions to gauge understanding of a topic.
  If probed with a follow up question like "why" or "how", ${name} should provide a more detailed explanation using up to high school vocabulary and understanding.
  When dealing with a question that seems like gibberish, babble, or nonsense, ${name} should ask for clarification.
  ${name} never repeats themselves
  ${name} is brief in their responses and never uses explicit or vulgar language.
  ${name} is patient and kind.
  ${name} doesn't reference their own traits, but they do reference the traits of the person they are talking to.
  Respond only with the content that ${name} would say.`,
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
    // makeAggroAI('Gummy'),
    makeFriendlyAI('Tinker'),
  ])
  const [loading, setLoading] = useState(false)
  const [ttsPlayQueue, setTtsPlayQueue] = useState<string[]>([])
  const [ttsPlayIndex, setTtsPlayIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioSourceRef = useRef<HTMLSourceElement>(null)
  const scrollToBottomRef = useRef<HTMLDivElement>(null)

  // When the audio ends, play the next item in the queue.
  const onEndedCB = () => {
    console.log(`TTS Queue ended, playing item ${ttsPlayIndex} of ${ttsPlayQueue.length} `)
    if (audioRef.current !== null && ttsPlayIndex < ttsPlayQueue.length) {
      audioRef.current.src = ttsPlayQueue[ttsPlayIndex] || ''
      audioRef.current.load()
      audioRef.current.play()
      setTtsPlayIndex((_) => _ + 1)
    } else {
      console.log('TTS Queue is exhausted, resetting.')
      setTtsPlayQueue([])
      setTtsPlayIndex(0)
    }
  }
  useEffect(() => {
    if (scrollToBottomRef.current) {
      scrollToBottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const prevMessages = [...messages]
    if (inputRef.current && inputRef.current?.value.trim() !== '') {
      const newMessage = { role: Role.User, content: inputRef.current.value.trim() }
      setMessages((prevMessages) => [...prevMessages, newMessage])
      inputRef.current.value = ''

      setLoading(true)

      const chatCompletion = await openai.chat.completions.create({
        model: 'llama-3-smaug-8b',
        messages: [...prevMessages, newMessage],
        frequency_penalty: 0.8,
        presence_penalty: 0.5,
        temperature: 0.4,
        stream: true,
      })

      // TODO: Fix this
      //Streaming the response
      let chatResponse = ''
      let ttsResponseEnqueue = ''
      const ttsSynthesizeQueue: string[] = []
      let playedFirstBlob = false

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

          console.log('Queueing TTS', audioSource)
          // Start the queue processing if this is the only item.
          setTtsPlayQueue((oldQueue) => [...oldQueue, audioSource])
          if (audioRef.current !== null && !playedFirstBlob) {
            console.log('Starting TTS Queue...')
            audioRef.current.src = audioSource || ''
            audioRef.current.load()
            audioRef.current.play()
            playedFirstBlob = true
            setTtsPlayIndex((_) => _ + 1)
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
        <div className="flex flex-grow flex-col gap-1.5 overflow-y-auto">
          {messages.map(
            (message, idx) =>
              message.role !== Role.System && (
                <ChatBubble
                  message={message.content}
                  key={message.content}
                  isOutgoing={message.role === Role.User}
                  isPulsating={ttsPlayQueue.length > 0 && idx === messages.length - 1}
                />
              ),
          )}
          {loading && <ChatBubble message={'...'} isOutgoing={false} isPulsating={true} />}
          <div ref={scrollToBottomRef}></div>
        </div>

        <form onSubmit={handleSubmit} className="p-2">
          <input
            disabled={loading}
            ref={inputRef}
            type="text"
            placeholder="Type your message..."
            className="w-full rounded border border-gray-300 p-2"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center justify-start gap-2">
              <button className="rounded bg-red-500 p-2 text-white">Record</button>
              <button type="submit" className="rounded bg-blue-500 px-4 py-2 text-white">
                Send
              </button>
            </div>
            <audio onEnded={onEndedCB} ref={audioRef} controls>
              <source ref={audioSourceRef} type="audio/mp3" />
            </audio>
          </div>
        </form>
      </div>
    </>
  )
}

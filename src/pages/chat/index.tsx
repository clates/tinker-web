import { FormEvent, useEffect, useRef } from 'react'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import ChatBubble from 'src/components/chatBubble'
import { Loading } from 'src/components/loading'
import { useOpenAiMessaging } from 'src/hooks/use-openai-messaging'
import { Role, SystemMessage } from 'src/types/messages'
import { useOpenAIStt } from 'src/hooks/use-openai-stt'
import { v4 as uuidv4 } from 'uuid'

const makeAggroAI = (name: string): SystemMessage => ({
  id: uuidv4(),
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

const makeFriendlyAI = (name: string): SystemMessage => ({
  id: uuidv4(),
  role: Role.System,
  content: `You are roleplaying as the character "${name}". 
  You must adhere to the following rules while roleplaying:
  1) You should always respond as ${name}. Never as yourself.
  2) You should only say thing that ${name} would say. 
  3) You can and do have opinions, feelings, thoughts, and favorite things.
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
  Respond only with the content that ${name} would say.
  Your responses will be read aloud to the user so try to avoid homonyms.`,
})

export default function Chat() {
  const { t } = useTranslation('translation')
  const inputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioSourceRef = useRef<HTMLSourceElement>(null)
  const scrollToBottomRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages, isLoading, isPlayingTTS] = useOpenAiMessaging(makeFriendlyAI('Tinker'), audioRef)
  const [record, stopRecording, isRecording, sttIsLoading, recordedText] = useOpenAIStt()

  useEffect(() => {
    console.debug('Messages was updated: ', messages[messages.length - 1])
    if (scrollToBottomRef.current) {
      scrollToBottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (inputRef.current && inputRef.current?.value.trim() !== '') {
      setMessages(messages.concat([{ id: uuidv4(), role: Role.User, content: inputRef.current.value.trim() }]))
      inputRef.current.value = ''
    }
  }

  useEffect(() => {
    if (!isPlayingTTS) {
      inputRef.current?.focus()
    }
  }, [isPlayingTTS])

  useEffect(() => {
    if (recordedText) {
      setMessages((old) => old.concat([{ id: uuidv4(), role: Role.User, content: recordedText }]))
    }
  }, [recordedText, setMessages])

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
                  key={message.id}
                  isOutgoing={message.role === Role.User}
                  isPulsating={isPlayingTTS && idx === messages.length - 1}
                />
              ),
          )}
          {isLoading && (
            <ChatBubble isOutgoing={false} isPulsating={true}>
              <Loading />
            </ChatBubble>
          )}
          <div ref={scrollToBottomRef}></div>
        </div>

        <form onSubmit={handleSubmit} className="p-2">
          <input
            disabled={isLoading || isPlayingTTS}
            ref={inputRef}
            type="text"
            placeholder="Type your message..."
            className="w-full rounded border border-gray-300 p-2"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center justify-start gap-2">
              <button
                className={`rounded bg-red-500 p-2 text-white ${
                  isRecording ? 'animate-pulse bg-red-700 ' : 'bg-red-500'
                }`}
                onClick={() => (isRecording ? stopRecording() : record())}
              >
                {sttIsLoading && <Loading />}
                {isRecording && 'Stop'}
                {!isRecording && !sttIsLoading && 'Record'}
              </button>
              <button type="submit" className="rounded bg-blue-500 px-4 py-2 text-white">
                Send
              </button>
            </div>
            <div className="max-w-8">
              <input
                id="range"
                type="range"
                min={0.0}
                max={1.0}
                step={0.01}
                onChange={(e) => {
                  if (audioRef.current) {
                    audioRef.current.volume = parseFloat(e.target.value)
                  }
                }}
                className="mt-2 block w-full rounded-md border border-gray-300 bg-white py-2 text-gray-700 focus:border-blue-500 focus:outline-none focus:ring"
              />
            </div>
            <div></div>
            <audio ref={audioRef}>
              <source ref={audioSourceRef} type="audio/mp3" />
            </audio>
          </div>
        </form>
      </div>
    </>
  )
}

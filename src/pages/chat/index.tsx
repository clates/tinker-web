import { FormEvent, useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { Loading } from 'src/components/loading'
import OpenAI from 'openai'

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
  ${name} doesn't reference their own traits, but they do reference the traits of the person they are talking to.`,
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
  const [messages, setMessages] = useState<{ role: Role; content: string }[]>([makeAggroAI('Gummy')])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const prevMessages = [...messages]
    if (inputRef.current && inputRef.current?.value.trim() !== '') {
      const newMessage = { role: Role.User, content: inputRef.current.value.trim() }
      setMessages((prevMessages) => [...prevMessages, newMessage])
      inputRef.current.value = ''

      setLoading(true)

      const chatCompletion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [...prevMessages, newMessage],
        stream: true,
      })

      // const tts = await openai.tts.create({
      //   text: chatCompletion.choices[0].message.content || '',
      //   voice: 'en-US-Wavenet-F',
      // })

      // TODO: Fix this
      //Streaming the response
      let chatResponse = ''
      for await (const chunk of chatCompletion) {
        console.log(chunk.choices[0])
        chatResponse += chunk.choices[0].delta.content
        setMessages([...prevMessages, newMessage, { role: Role.Assistant, content: chatResponse }])
        setLoading(false)
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
    if (lastMessage.role === Role.Assistant && inputRef.current) {
      inputRef.current.focus()
    }
  }, [messages])

  return (
    <>
      <Helmet>
        <title>{t('title')}</title>
      </Helmet>
      <div className="flex h-screen flex-col justify-end bg-gray-100 py-24">
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
      </div>
    </>
  )
}

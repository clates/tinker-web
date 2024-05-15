import { useCallback, useEffect, useState } from 'react'
import { useOpenAI } from './use-openai'
import { useOpenAiTts } from './use-openai-tts'
import { Role, Message, SystemMessage } from 'src/types/messages'

export function useOpenAiMessaging(systemPrompt: SystemMessage, audioRef: React.RefObject<HTMLAudioElement>) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const openai = useOpenAI()
  const [isPlayingTTS, addToTtsQueue] = useOpenAiTts(audioRef)
  const submitUserMessage = useCallback(
    async (messages: Message[]) => {
      setIsLoading(true)
      const chatCompletion = await openai.chat.completions.create({
        model: 'llama-3-smaug-8b',
        messages: messages,
        frequency_penalty: 0.8,
        presence_penalty: 0.5,
        temperature: 0.4,
        stream: true,
      })

      let chatResponse = ''
      let ttsEnqueue = ''
      for await (const chunk of chatCompletion) {
        setIsLoading(false)
        chatResponse += chunk.choices[0].delta.content
        ttsEnqueue += chunk.choices[0].delta.content
        setMessages(messages.concat([{ role: Role.Assistant, content: chatResponse }]))

        // Determine if we should submit the TTS
        if (
          // Natural pauses in speech
          ([',', '.', '?', '!'].includes(chunk.choices[0].delta.content || '') &&
            // Make sure we have a reasonable chunk.
            ttsEnqueue.length > 100 &&
            // Arbitrary limit, the API has a 4096 character limit
            ttsEnqueue.length < 2000) ||
          // Submit to the TTS if the chunking is over
          chunk.choices[0].finish_reason === 'stop'
        ) {
          // Synthesize the audio
          console.log('Enqueueing TTS:', ttsEnqueue)
          addToTtsQueue(ttsEnqueue)
          //Flush the enqueue
          ttsEnqueue = ''
        }
      }
    },
    [addToTtsQueue, openai.chat.completions],
  )
  useEffect(() => {
    console.log('Messages was updated: ', messages[messages.length - 1], isLoading)

    if (messages.length === 0) {
      setMessages((messages) => [...messages, systemPrompt])
    } else if (messages.length > 0 && messages[messages.length - 1].role === Role.User && !isLoading) {
      // The user has sent a message, so we need to send it to OpenAI
      console.log('Submitting user message to OpenAI')
      submitUserMessage(messages)
    }
  }, [addToTtsQueue, messages, openai.chat.completions, submitUserMessage, systemPrompt])

  return [messages, setMessages, isLoading, isPlayingTTS] as const
}

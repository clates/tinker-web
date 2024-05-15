import React from 'react'

const ChatBubble = ({
  message = '',
  isOutgoing,
  isPulsating,
  children,
}: {
  message?: string
  isOutgoing: boolean
  isPulsating: boolean
  children?: React.ReactNode
}) => {
  const bubbleStyle = isOutgoing ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'
  const cornerStyle = isOutgoing
    ? 'rounded-br-3xl rounded-tr-3xl rounded-tl-xl'
    : 'rounded-bl-3xl rounded-tl-3xl rounded-tr-xl'
  const marginStyle = isOutgoing ? 'ml-4' : 'mr-4'
  const slideInStyle = isOutgoing ? 'slide-in-from-left' : 'slide-in-from-right'
  const pulsateAnimation = isPulsating ? 'animate-pulse' : ''
  const justifyStyle = isOutgoing ? 'justify-start' : 'justify-end'

  return (
    <div className={`accordion-up flex ${slideInStyle} w-full ${justifyStyle}`}>
      <div className={`max-w-xs ${cornerStyle} ${marginStyle} break-words p-3 ${bubbleStyle} ${pulsateAnimation}`}>
        {message}
        {children}
      </div>
    </div>
  )
}

export default ChatBubble

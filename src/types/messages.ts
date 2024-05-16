export enum Role {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
}
export type BaseMessage = {
  id: string
  content: string
}
export type SystemMessage = BaseMessage & {
  role: Role.System
}
export type UserMessage = BaseMessage & {
  role: Role.User
}
export type AssistantMessage = BaseMessage & {
  role: Role.Assistant
}
export type Message = UserMessage | AssistantMessage | SystemMessage

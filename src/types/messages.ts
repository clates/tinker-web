export enum Role {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
}
export type SystemMessage = {
  role: Role.System
  content: string
}
export type UserMessage = {
  role: Role.User
  content: string
}
export type AssistantMessage = {
  role: Role.Assistant
  content: string
}
export type Message = UserMessage | AssistantMessage | SystemMessage

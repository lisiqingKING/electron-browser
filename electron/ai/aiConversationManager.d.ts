import type { ChatSession, Message } from './aiConversationDb'

export { ChatSession, Message } from './aiConversationDb'

export function syncConversationsFromDb(): void
export function getChatSessions(): ChatSession[]
export function getChatSession(convId: string): ChatSession | undefined
export function createChatSession(title?: string): ChatSession
export function updateChatSessionTitle(convId: string, title: string): void
export function deleteChatSession(convId: string): void
export function addMessage(convId: string, role: 'user' | 'assistant', content: string): Message
export function deleteAIMessage(convId: string, msgId: string): void
export function getOrCreateDefaultChatSession(): ChatSession

import type { ChatSession, Message } from './aiConversationDb'

export { ChatSession, Message }

export function getAllChatSessions(): ChatSession[]
export function getChatSessionsPage(limit: number, offset: number): ChatSession[]
export function createChatSession(title?: string): ChatSession
export function updateTitle(convId: string, title: string): void
export function updateMessages(convId: string, messages: Message[]): void
export function deleteChatSession(convId: string): void
export function updatePinned(convId: string, pinned: number): void

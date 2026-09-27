import { getDatabase } from '../../shared/database'

export interface AssistantConv {
  convId: string
  title: string
  sourceType: string | null
  sourceId: string | null
  createdAt: number
  updatedAt: number
}

export interface AssistantMsg {
  id: string
  convId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

export interface AssistantLink {
  id: number
  sourceType: string
  sourceId: string
  assistantConvId: string
  createdAt: number
}

export function createAssistantConv(convId: string, title: string, sourceType: string | null, sourceId: string | null, now: number): void {
  getDatabase().prepare(
    'INSERT INTO assistant_conversations (convId, title, sourceType, sourceId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(convId, title, sourceType, sourceId, now, now)
}

export function getAssistantConv(convId: string): AssistantConv | undefined {
  return getDatabase().prepare('SELECT * FROM assistant_conversations WHERE convId = ?').get(convId) as AssistantConv | undefined
}

export function updateAssistantTitle(convId: string, title: string, now: number): void {
  getDatabase().prepare('UPDATE assistant_conversations SET title = ?, updatedAt = ? WHERE convId = ?').run(title, now, convId)
}

export function deleteAssistantConv(convId: string): void {
  const db = getDatabase()
  db.exec('BEGIN TRANSACTION')
  try {
    getDatabase().prepare('DELETE FROM assistant_messages WHERE convId = ?').run(convId)
    getDatabase().prepare('DELETE FROM assistant_links WHERE assistantConvId = ?').run(convId)
    getDatabase().prepare('DELETE FROM assistant_conversations WHERE convId = ?').run(convId)
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export function addAssistantMessage(id: string, convId: string, role: string, content: string, now: number): void {
  getDatabase().prepare(
    'INSERT INTO assistant_messages (id, convId, role, content, createdAt) VALUES (?, ?, ?, ?, ?)'
  ).run(id, convId, role, content, now)
  getDatabase().prepare('UPDATE assistant_conversations SET updatedAt = ? WHERE convId = ?').run(now, convId)
}

export function getAssistantMessages(convId: string): AssistantMsg[] {
  return getDatabase().prepare('SELECT * FROM assistant_messages WHERE convId = ? ORDER BY createdAt ASC').all(convId) as AssistantMsg[]
}

export function getLinkForSource(sourceType: string, sourceId: string): AssistantLink | undefined {
  return getDatabase().prepare('SELECT * FROM assistant_links WHERE sourceType = ? AND sourceId = ?').get(sourceType, sourceId) as AssistantLink | undefined
}

export function createLink(sourceType: string, sourceId: string, assistantConvId: string, now: number): void {
  getDatabase().prepare(
    'INSERT OR IGNORE INTO assistant_links (sourceType, sourceId, assistantConvId, createdAt) VALUES (?, ?, ?, ?)'
  ).run(sourceType, sourceId, assistantConvId, now)
}

export function getConvIdForSource(sourceType: string, sourceId: string): string | undefined {
  const link = getLinkForSource(sourceType, sourceId)
  return link?.assistantConvId
}

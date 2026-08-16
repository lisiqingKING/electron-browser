// AI Provider 类型常量
export const PROVIDER_TYPES = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic'
} as const
export type ProviderType = typeof PROVIDER_TYPES[keyof typeof PROVIDER_TYPES]

// Anthropic SSE 事件类型
export const SSE_EVENTS = {
  MESSAGE_START: 'message_start',
  CONTENT_BLOCK_START: 'content_block_start',
  CONTENT_BLOCK_DELTA: 'content_block_delta',
  CONTENT_BLOCK_STOP: 'content_block_stop',
  MESSAGE_DELTA: 'message_delta',
  MESSAGE_STOP: 'message_stop',
  PING: 'ping'
} as const

// AI Provider 接口定义
export interface AIRequest {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

export interface AIResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message?: { role: 'assistant'; content: string }
    delta?: { content?: string; role?: 'assistant' }
    finish_reason?: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface AIProvider {
  readonly type: ProviderType

  transformRequest(body: AIRequest): {
    url: string
    headers: Record<string, string>
    body: any
  }

  transformResponse(data: any): AIResponse | null
  transformSSEEvent(data: any): AIResponse | null
}

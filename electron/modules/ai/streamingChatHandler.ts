import { webContents } from 'electron'
import { createProvider } from './providers'
import type { AIRequest } from './providers/AIProvider'
import { broadcast } from '../../shared/broadcast'
import { touchConversation } from './aiDb'
import { appendMessage } from './aiConversationDb'

// ============ 流式聊天核心 ============
// 主进程 fetch LLM → SSE 解析 → IPC 推送 → DB 持久化

export interface ChatStreamOptions {
  conversationId: string
  messageId: string
  apiUrl: string
  apiKey?: string
  providerType: string
  model: string
  messages: AIRequest['messages']
  targetWindowId?: number
}

// 维护每个 messageId 的 AbortController
const abortControllers = new Map<string, AbortController>()

export function abortStream(messageId: string): boolean {
  const controller = abortControllers.get(messageId)
  if (controller) {
    controller.abort()
    abortControllers.delete(messageId)
    return true
  }
  return false
}

export async function startStreaming(options: ChatStreamOptions): Promise<void> {
  const { conversationId, messageId, providerType, model, messages, targetWindowId } = options
  const controller = new AbortController()
  abortControllers.set(messageId, controller)

  const provider = createProvider(providerType)

  const push = (channel: string, data: Record<string, unknown>) => {
    if (targetWindowId) {
      const wc = webContents.fromId(targetWindowId)
      wc?.send(channel, { messageId, ...data })
    } else {
      broadcast(channel, { messageId, ...data })
    }
  }

  try {
    // 1. 构造请求（URL、headers、body 全由 provider 处理）
    const { url, headers, body } = provider.transformRequest({
      apiUrl: options.apiUrl,
      apiKey: options.apiKey,
      model,
      messages,
      stream: true,
    })

    // 2. 发起 fetch（30s 超时）
    const fetchWithTimeout = (fetchUrl: string, init: RequestInit, timeoutMs = 30000) => {
      return Promise.race([
        fetch(fetchUrl, init),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
        )
      ])
    }

    let response: Response
    try {
      response = await fetchWithTimeout(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      }) as Response
    } catch (err: any) {
      if (err.message === 'TIMEOUT') {
        err.name = 'TimeoutError'
      }
      throw err
    }

    console.log('[startStreaming] response status:', response.status)
    if (!response.ok) {
      const text = await response.text()
      console.error('[startStreaming] HTTP error body:', text.slice(0, 200))
      throw new Error(`HTTP ${response.status}: ${text}`)
    }

    // 3. 通知开始
    push('ai:start', {})

    // 4. 读流循环
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // 按 \n 分割，处理完整行
      const lines = buffer.split('\n')
      buffer = lines.pop()!

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const dataStr = line.slice(6).trim()
        if (dataStr === '[DONE]' || !dataStr) continue

        try {
          const data = JSON.parse(dataStr)
          const transformed = provider.transformSSEEvent(data)
          if (!transformed) continue

          const content = transformed.choices?.[0]?.delta?.content
          if (content) {
            fullContent += content
            push('ai:chunk', { content })
          }

          const finishReason = transformed.choices?.[0]?.finish_reason
          if (finishReason && finishReason !== 'streaming') {
            break
          }
        } catch {
          // JSON 解析失败，跳过该行
        }
      }
    }

    // 5. 流正常结束 → 写 DB → 推 complete
    appendMessage(conversationId, messageId, 'assistant', fullContent, Date.now())
    push('ai:complete', {})

  } catch (err: any) {
    const isAbort = controller.signal.aborted
    const isNetwork = err.name === 'TimeoutError'
      || err.name === 'TypeError'
      || err.message?.includes('fetch')
      || err.message?.includes('network')
      || err.message?.includes('ENOTFOUND')
      || err.message?.includes('ECONNREFUSED')
    const reason = isAbort ? 'user' : (isNetwork ? 'network' : 'error')

    push('ai:halted', { reason })

  } finally {
    abortControllers.delete(messageId)
    touchConversation(conversationId, Date.now())
  }
}

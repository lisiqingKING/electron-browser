import { webContents } from 'electron'
import { createProvider } from './providers'
import type { AIRequest } from './providers/AIProvider'
import { broadcast } from '../../shared/broadcast'
import { updateMessageStatus, createMessage, touchConversation } from './aiDb'

// ============ 流式聊天核心 ============
// 主进程 fetch LLM → SSE 解析 → IPC 推送 → DB 持久化

export interface StreamPayload {
  type: 'start' | 'chunk' | 'complete' | 'halted' | 'error'
  content?: string
  reason?: 'user' | 'error' | 'network'
}

export interface ChatStreamOptions {
  conversationId: string
  messageId: string
  apiUrl: string
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
  const now = Date.now()

  const provider = createProvider(providerType)

  // 1. 创建 assistant 消息记录（status=sending）
  createMessage({
    id: messageId,
    conversation_id: conversationId,
    role: 'assistant',
    content: '',
    status: 'sending',
    halt_reason: null,
    model,
    created_at: now,
    updated_at: now,
  })

  const push = (payload: StreamPayload) => {
    // payload 不含 messageId，发送时拼接
    if (targetWindowId) {
      const wc = webContents.fromId(targetWindowId)
      wc?.send('ai:stream', { messageId, ...payload })
    } else {
      broadcast('ai:stream', { messageId, ...payload })
    }
  }

  try {
    // 2. 构造请求（URL、headers、body 全由 provider 处理）
    const { url, headers, body } = provider.transformRequest({
      model,
      messages,
      stream: true,
    })

    // 3. 发起 fetch（30s 超时）
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

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`HTTP ${response.status}: ${text}`)
    }

    // 4. 更新状态 → streaming
    updateMessageStatus(messageId, 'streaming', null, Date.now())
    push({ type: 'start' })

    // 5. 读流循环
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // 按 \n 分割，处理完整行
      const lines = buffer.split('\n')
      buffer = lines.pop()! // 最后一节留在 buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const dataStr = line.slice(6).trim()
        if (dataStr === '[DONE]' || !dataStr) continue

        try {
          const data = JSON.parse(dataStr)
          // dev-only: console.log('[chunk] type:', data.type, 'delta:', data.delta?.text)
          const transformed = provider.transformSSEEvent(data)
          if (!transformed) continue

          // 提取 content delta
          const content = transformed.choices?.[0]?.delta?.content
          if (content) {
            // 流中不写 DB，只推渲染端
            push({ type: 'chunk', content })
          }

          // 检查结束
          const finishReason = transformed.choices?.[0]?.finish_reason
          if (finishReason && finishReason !== 'streaming') {
            // dev-only: console.log('[break] 流结束, finish_reason:', finishReason)
            break
          }
        } catch {
          // JSON 解析失败，跳过该行
        }
      }
    }

    // 6. 流正常结束 → 写 DB → 推 complete
    updateMessageStatus(messageId, 'complete', null, Date.now())
    push({ type: 'complete' })

  } catch (err: any) {
    // 推断停止原因
    const isAbort = controller.signal.aborted
    const isNetwork = err.name === 'TimeoutError'
      || err.name === 'TypeError'                    // 网络错误（DNS/连接失败）
      || err.message?.includes('fetch')              // fetch 相关错误
      || err.message?.includes('network')            // 明确的网络错误字样
      || err.message?.includes('ENOTFOUND')
      || err.message?.includes('ECONNREFUSED')
    const reason = isAbort ? 'user' : (isNetwork ? 'network' : 'error')

    updateMessageStatus(messageId, 'halted', reason, Date.now())
    push({ type: 'halted', reason })

  } finally {
    abortControllers.delete(messageId)
    touchConversation(conversationId, Date.now())
  }
}

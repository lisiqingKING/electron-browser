import { getSetting } from '../../modules/settings/manager'
import type { AIProvider, AIRequest } from './AIProvider'
import { PROVIDER_TYPES, SSE_EVENTS } from './AIProvider'

export class AnthropicProvider implements AIProvider {
  readonly type = PROVIDER_TYPES.ANTHROPIC

  transformRequest(body: AIRequest) {
    const baseUrl = (getSetting('ai_api_url') || '').replace(/\/$/, '')
    const apiKey = getSetting('ai_api_key') || ''

    const systemMessages = body.messages.filter(m => m.role === 'system')
    const nonSystemMessages = body.messages.filter(m => m.role !== 'system')

    return {
      url: `${baseUrl}/v1/messages`,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: {
        model: body.model,
        messages: nonSystemMessages.map(m => ({ role: m.role, content: m.content })),
        system: systemMessages.map(m => m.content).join('\n') || undefined,
        max_tokens: body.max_tokens ?? 4096,
        temperature: body.temperature,
        stream: body.stream ?? false
      }
    }
  }

  transformResponse(data: any) {
    if (data.type === 'message') {
      const textContent = data.content
        ?.filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('') ?? ''

      return {
        id: data.id || `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: data.created || Math.floor(Date.now() / 1000),
        model: data.model,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: textContent },
          finish_reason: data.stop_reason || 'stop'
        }],
        usage: data.usage ? {
          prompt_tokens: data.usage.input_tokens,
          completion_tokens: data.usage.output_tokens,
          total_tokens: data.usage.input_tokens + data.usage.output_tokens
        } : undefined
      }
    }
    return data
  }

  transformSSEEvent(data: any) {
    const now = Date.now()
    const chunkId = `chatcmpl-${now}`
    const created = Math.floor(now / 1000)

    if (data.type === SSE_EVENTS.MESSAGE_START) {
      return {
        id: data.message?.id || chunkId,
        object: 'chat.completion.chunk',
        created,
        model: data.message?.model,
        choices: [{ index: 0, delta: { role: 'assistant', content: '' } }]
      }
    }

    if (data.type === SSE_EVENTS.CONTENT_BLOCK_START) {
      return { id: chunkId, object: 'chat.completion.chunk', created, model: '', choices: [{ index: data.index ?? 0, delta: { content: '' } }] }
    }

    if (data.type === SSE_EVENTS.CONTENT_BLOCK_DELTA) {
      return { id: chunkId, object: 'chat.completion.chunk', created, model: '', choices: [{ index: data.index ?? 0, delta: { content: data.delta?.text || '' } }] }
    }

    if (data.type === SSE_EVENTS.CONTENT_BLOCK_STOP) {
      return { id: chunkId, object: 'chat.completion.chunk', created, model: '', choices: [{ index: data.index ?? 0, delta: {} }] }
    }

    if (data.type === SSE_EVENTS.MESSAGE_DELTA) {
      return { id: chunkId, object: 'chat.completion.chunk', created, model: '', choices: [{ index: 0, delta: {}, finish_reason: data.delta?.stop_reason || 'stop' }] }
    }

    if (data.type === SSE_EVENTS.MESSAGE_STOP || data.type === SSE_EVENTS.PING) {
      return null
    }

    return data
  }
}

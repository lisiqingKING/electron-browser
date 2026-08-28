import { getSetting } from '../../../modules/settings/manager'
import type { AIProvider, AIRequest } from './AIProvider'
import { PROVIDER_TYPES } from './AIProvider'

export class OpenAIProvider implements AIProvider {
  readonly type = PROVIDER_TYPES.OPENAI

  transformRequest(body: AIRequest) {
    const baseUrl = (getSetting('ai_api_url') || '').replace(/\/$/, '')
    const apiKey = getSetting('ai_api_key') || ''

    return {
      url: `${baseUrl}/v1/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body
    }
  }

  // OpenAI 兼容格式直接透传
  transformResponse(data: any): any {
    return data
  }

  transformSSEEvent(data: any): any {
    return data
  }
}

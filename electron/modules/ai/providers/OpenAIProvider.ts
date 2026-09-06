import { getSetting } from '../../../modules/settings/manager'
import type { AIProvider, AIRequest } from './AIProvider'
import { PROVIDER_TYPES } from './AIProvider'

export class OpenAIProvider implements AIProvider {
  readonly type = PROVIDER_TYPES.OPENAI

  transformRequest(body: AIRequest) {
    const baseUrl = (body.apiUrl || getSetting('ai_api_url') || '').replace(/\/$/, '')
    const apiKey = body.apiKey || getSetting('ai_api_key') || ''
    // 剥离 apiUrl/apiKey，避免泄露到请求体
    const { apiUrl: _unused1, apiKey: _unused2, ...cleanBody } = body

    return {
      url: `${baseUrl}/v1/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: cleanBody
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

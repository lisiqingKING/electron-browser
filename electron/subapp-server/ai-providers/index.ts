import { getSetting } from '../../modules/settings/manager'
import type { AIProvider, ProviderType } from './AIProvider'
import { PROVIDER_TYPES, SSE_EVENTS } from './AIProvider'
import { OpenAIProvider } from './OpenAIProvider'
import { AnthropicProvider } from './AnthropicProvider'

export function createProvider(type?: string): AIProvider {
  const providerType = (type || getSetting('ai_provider_type') || PROVIDER_TYPES.OPENAI) as ProviderType

  switch (providerType) {
    case PROVIDER_TYPES.ANTHROPIC:
      return new AnthropicProvider()
    case PROVIDER_TYPES.OPENAI:
    default:
      return new OpenAIProvider()
  }
}

export { PROVIDER_TYPES, SSE_EVENTS }
export { OpenAIProvider, AnthropicProvider }
export type { AIProvider, AIRequest, AIResponse, ProviderType } from './AIProvider'

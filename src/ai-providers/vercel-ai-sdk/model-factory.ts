/**
 * Model factory — creates Vercel AI SDK LanguageModel instances from config.
 *
 * Reads ai-provider-manager.json from disk on each call so that model
 * changes take effect without a restart.  Uses dynamic imports so unused
 * provider packages don't prevent startup.
 */

import type { LanguageModel } from 'ai'
import { readAIProviderConfig } from '../../core/config.js'

/** Result includes the model plus a cache key for change detection. */
export interface ModelFromConfig {
  model: LanguageModel
  /** `provider:modelId:baseUrl` — use this to detect config changes. */
  key: string
}

/** Per-request model override (e.g. from a sub-channel's vercelAiSdk config). */
export interface ModelOverride {
  provider: string
  model: string
  baseUrl?: string
  apiKey?: string
}

/**
 * Custom fetch wrapper for OpenAI-compatible proxies (like 9router) that:
 * 1. Forces `stream: false` to ensure proper tool calling
 * 2. Cleans SSE artifacts from the response (some proxies return SSE format even for non-streaming)
 */
function createProxyFetch(): (url: string, init?: RequestInit) => Promise<Response> {
  return async (url: string, init?: RequestInit) => {
    // Force stream: false in the request
    if (init?.body && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body)
        if (body.stream !== false) {
          body.stream = false
          init = { ...init, body: JSON.stringify(body) }
          console.log('proxy-fetch: forced stream: false for request')
        }
      } catch { /* not JSON, leave as-is */ }
    }

    const response = await fetch(url, init)

    // Clean SSE artifacts from response if present
    // Some proxies return "text/event-stream" even for non-streaming requests
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('text/event-stream') || contentType.includes('application/json')) {
      const text = await response.text()
      // Remove trailing SSE data like "data: [DONE]" that some proxies append
      const cleanText = text.replace(/data:\s*\[DONE\]\s*$/g, '').trim()
      console.log(`proxy-fetch: cleaned response (${text.length} -> ${cleanText.length} chars)`)

      // Return a new response with clean JSON
      return new Response(cleanText, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          'content-type': 'application/json',
        },
      })
    }

    return response
  }
}

export async function createModelFromConfig(override?: ModelOverride): Promise<ModelFromConfig> {
  // Resolve effective values: override takes precedence over global config
  const config = await readAIProviderConfig()
  const p = override?.provider ?? config.provider
  const m = override?.model ?? config.model
  const url = override?.baseUrl ?? config.baseUrl
  const key = `${p}:${m}:${url ?? ''}`

  // Resolve API key: override.apiKey > global config.apiKeys[provider]
  const resolveApiKey = (provider: string) => {
    if (override?.apiKey) return override.apiKey
    return (config.apiKeys as Record<string, string | undefined>)[provider] || undefined
  }

  // Use custom fetch for non-OpenAI endpoints to handle proxy quirks
  const isProxyEndpoint = url && !url.includes('api.openai.com')
  const proxyFetch = isProxyEndpoint ? createProxyFetch() : undefined

  switch (p) {
    case 'anthropic': {
      const { createAnthropic } = await import('@ai-sdk/anthropic')
      const client = createAnthropic({ apiKey: resolveApiKey('anthropic'), baseURL: url || undefined })
      return { model: client(m), key }
    }
    case 'openai': {
      const { createOpenAI } = await import('@ai-sdk/openai')
      const client = createOpenAI({
        apiKey: resolveApiKey('openai'),
        baseURL: url || undefined,
        fetch: proxyFetch,
      })
      // Use .chat() explicitly to use chat completions API (not responses API)
      // This is needed for OpenAI-compatible proxies like 9router
      return { model: client.chat(m), key }
    }
    case 'google': {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google')
      const client = createGoogleGenerativeAI({ apiKey: resolveApiKey('google'), baseURL: url || undefined })
      return { model: client(m), key }
    }
    default:
      throw new Error(`Unsupported model provider: "${p}". Supported: anthropic, openai, google`)
  }
}

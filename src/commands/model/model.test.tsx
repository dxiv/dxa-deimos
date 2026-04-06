import { createRequire } from 'node:module'
import { afterEach, beforeEach, expect, mock, test } from 'bun:test'

const require = createRequire(import.meta.url)

const originalEnv = {
  CLAUDE_CODE_USE_OPENAI: process.env.CLAUDE_CODE_USE_OPENAI,
  CLAUDE_CODE_USE_GITHUB: process.env.CLAUDE_CODE_USE_GITHUB,
  CLAUDE_CODE_USE_GEMINI: process.env.CLAUDE_CODE_USE_GEMINI,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_API_BASE: process.env.OPENAI_API_BASE,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
}

function invalidateModelCommandModuleCache(): void {
  const specs = [
    './model.js',
    '../../utils/model/openaiModelDiscovery.js',
  ] as const
  for (const spec of specs) {
    try {
      const resolved = require.resolve(spec)
      delete require.cache[resolved]
    } catch {
      // not loaded yet
    }
  }
}

beforeEach(() => {
  mock.restore()
})

afterEach(() => {
  mock.restore()
  invalidateModelCommandModuleCache()
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
})

test('opens the model picker without awaiting local model discovery refresh', async () => {
  process.env.CLAUDE_CODE_USE_OPENAI = '1'
  delete process.env.CLAUDE_CODE_USE_GITHUB
  delete process.env.CLAUDE_CODE_USE_GEMINI
  process.env.OPENAI_BASE_URL = 'http://127.0.0.1:8080/v1'
  delete process.env.OPENAI_API_BASE
  process.env.OPENAI_MODEL = 'qwen2.5-coder-7b-instruct'

  let resolveDiscovery: (() => void) | undefined
  const discoverOpenAICompatibleModelOptions = mock(
    () =>
      new Promise<void>(resolve => {
        resolveDiscovery = resolve
      }),
  )

  const discoverySpecifier = import.meta.resolve(
    '../../utils/model/openaiModelDiscovery.js',
  )
  mock.module(discoverySpecifier, () => ({
    discoverOpenAICompatibleModelOptions,
  }))

  invalidateModelCommandModuleCache()

  const { call } = await import('./model.js')
  const result = await Promise.race([
    call(() => {}, {} as never, ''),
    new Promise(resolve => setTimeout(() => resolve('timeout'), 3000)),
  ])

  resolveDiscovery?.()

  expect(result).not.toBe('timeout')
  expect(discoverOpenAICompatibleModelOptions).toHaveBeenCalledTimes(1)
})
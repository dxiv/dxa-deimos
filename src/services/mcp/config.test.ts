import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  NodeFsOperations,
  setFsImplementation,
  setOriginalFsImplementation,
  type FsOperations,
} from '../../utils/fsOperations.js'
import {
  parseMcpConfigFromFilePath,
  parseMcpConfigFromFilePathAsync,
} from './config.js'

const validMcpJson = JSON.stringify({
  mcpServers: {
    echo: { command: 'echo', args: ['hi'] },
  },
})

/** Stabilize mtime for parse cache tests (Linux CI can otherwise see sub-ms mtime drift). */
function touchFixedMtime(filePath: string, variant = 0): void {
  const t = new Date(Date.UTC(2024, 5, 1 + variant, 12, 0, 0))
  utimesSync(filePath, t, t)
}

function makeTrackingFs(): {
  fs: FsOperations
  counters: { readFileAsyncCalls: number; readFileSyncCalls: number }
} {
  const counters = { readFileAsyncCalls: 0, readFileSyncCalls: 0 }
  const fs: FsOperations = {
    ...NodeFsOperations,
    readFile: async (p, opts) => {
      counters.readFileAsyncCalls++
      return NodeFsOperations.readFile(p, opts)
    },
    readFileSync: (p, opts) => {
      counters.readFileSyncCalls++
      return NodeFsOperations.readFileSync(p, opts)
    },
  }
  return { fs, counters }
}

test('parseMcpConfigFromFilePathAsync: valid file returns servers', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'deimos-mcp-async-'))
  try {
    const filePath = join(dir, 'mcp.json')
    writeFileSync(filePath, validMcpJson, 'utf8')
    const { config, errors } = await parseMcpConfigFromFilePathAsync({
      filePath,
      expandVars: true,
      scope: 'dynamic',
    })
    assert.equal(errors.length, 0)
    assert.ok(config)
    assert.ok(config!.mcpServers.echo)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('parseMcpConfigFromFilePathAsync: missing file', async () => {
  const missing = join(tmpdir(), `deimos-mcp-missing-${randomUUID()}.json`)
  const { config, errors } = await parseMcpConfigFromFilePathAsync({
    filePath: missing,
    expandVars: true,
    scope: 'dynamic',
  })
  assert.equal(config, null)
  assert.equal(errors.length, 1)
  assert.match(errors[0]!.message, /not found/i)
})

test('parseMcpConfigFromFilePathAsync: invalid JSON', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'deimos-mcp-badjson-'))
  try {
    const filePath = join(dir, 'bad.json')
    writeFileSync(filePath, '{ not json', 'utf8')
    const { config, errors } = await parseMcpConfigFromFilePathAsync({
      filePath,
      expandVars: true,
      scope: 'dynamic',
    })
    assert.equal(config, null)
    assert.ok(errors.some(e => /not a valid JSON/i.test(e.message)))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('parseMcpConfigFromFilePathAsync: path is directory', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'deimos-mcp-isdir-'))
  try {
    const { config, errors } = await parseMcpConfigFromFilePathAsync({
      filePath: dir,
      expandVars: true,
      scope: 'dynamic',
    })
    assert.equal(config, null)
    assert.ok(errors.some(e => /not a regular file/i.test(e.message)))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('parseMcpConfigFromFilePath and async agree on valid file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'deimos-mcp-parity-'))
  try {
    const filePath = join(dir, 'mcp.json')
    writeFileSync(filePath, validMcpJson, 'utf8')
    const syncResult = parseMcpConfigFromFilePath({
      filePath,
      expandVars: true,
      scope: 'dynamic',
    })
    const asyncResult = await parseMcpConfigFromFilePathAsync({
      filePath,
      expandVars: true,
      scope: 'dynamic',
    })
    assert.deepEqual(asyncResult.errors, syncResult.errors)
    assert.equal(
      JSON.stringify(asyncResult.config),
      JSON.stringify(syncResult.config),
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('MCP file parse cache: second async read skips readFile', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'deimos-mcp-cache-'))
  const { fs: fsTrack, counters } = makeTrackingFs()
  setFsImplementation(fsTrack)
  try {
    const filePath = join(dir, 'mcp.json')
    writeFileSync(filePath, validMcpJson, 'utf8')
    touchFixedMtime(filePath)

    await parseMcpConfigFromFilePathAsync({
      filePath,
      expandVars: true,
      scope: 'dynamic',
    })
    assert.equal(counters.readFileAsyncCalls, 1)

    await parseMcpConfigFromFilePathAsync({
      filePath,
      expandVars: true,
      scope: 'dynamic',
    })
    assert.equal(counters.readFileAsyncCalls, 1)

    writeFileSync(filePath, validMcpJson + '\n', 'utf8')
    touchFixedMtime(filePath, 1)
    await parseMcpConfigFromFilePathAsync({
      filePath,
      expandVars: true,
      scope: 'dynamic',
    })
    assert.equal(counters.readFileAsyncCalls, 2)
  } finally {
    setOriginalFsImplementation()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('MCP file parse cache: sync hits cache after async parse', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'deimos-mcp-cache-mix-'))
  const { fs: fsTrack, counters } = makeTrackingFs()
  setFsImplementation(fsTrack)
  try {
    const filePath = join(dir, 'mcp.json')
    writeFileSync(filePath, validMcpJson, 'utf8')
    touchFixedMtime(filePath)

    await parseMcpConfigFromFilePathAsync({
      filePath,
      expandVars: true,
      scope: 'dynamic',
    })
    assert.equal(counters.readFileAsyncCalls, 1)
    assert.equal(counters.readFileSyncCalls, 0)

    parseMcpConfigFromFilePath({
      filePath,
      expandVars: true,
      scope: 'dynamic',
    })
    assert.equal(counters.readFileSyncCalls, 0)
  } finally {
    setOriginalFsImplementation()
    rmSync(dir, { recursive: true, force: true })
  }
})

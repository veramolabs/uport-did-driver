// FailoverProvider: sequential failover across multiple JsonRpcProvider instances.
// Extends JsonRpcProvider so it can be used anywhere a full ethers provider is expected.
// Overrides `send` to try each backing provider in order, failing over on retriable errors.

import { JsonRpcProvider } from 'ethers'

const RETRIABLE_CODES = new Set(['NETWORK_ERROR', 'SERVER_ERROR', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'])

function isRetriableError(err) {
  if (RETRIABLE_CODES.has(err.code)) return true
  if (typeof err.code === 'number' && err.code <= -32000 && err.code >= -32099) return true
  if (err.code === -32603) return true
  if (err.code === 4444) return true
  if (err.code === 'CALL_EXCEPTION' && err.data == null) return true
  if (err.code === 'UNKNOWN_ERROR') return true
  return false
}

// Any specific block tag (not 'latest'/'pending'/'earliest') is an archive query.
// ethr-did-resolver uses 'latest' for current state and specific block numbers for versionId queries.
function isHistoricalBlockRange(params) {
  const filter = params?.[0]
  if (!filter) return false
  const toBlock = filter.toBlock
  return !(!toBlock || toBlock === 'latest' || toBlock === 'pending' || toBlock === 'earliest')
}

export class FailoverProvider extends JsonRpcProvider {
  #providers

  constructor(url, providers, chainId, options) {
    if (!providers?.length) throw new Error('FailoverProvider requires at least one provider')
    super(url, chainId, { staticNetwork: true, ...options })
    this.#providers = providers
  }

  async send(method, params) {
    let lastError
    for (const provider of this.#providers) {
      try {
        const result = await provider.send(method, params)
        if (method === 'eth_getLogs' && Array.isArray(result) && result.length === 0) {
          if (isHistoricalBlockRange(params)) {
            lastError = Object.assign(new Error('empty historical logs'), { code: 'EMPTY_HISTORICAL' })
            continue
          }
        }
        return result
      } catch (err) {
        if (isRetriableError(err)) {
          lastError = err
          continue
        }
        throw err
      }
    }
    throw lastError
  }
}

// Factory: builds a FailoverProvider from a list of RPC URLs
export function buildFailoverProvider(chainId, rpcUrls) {
  const providers = rpcUrls.map((url) => new JsonRpcProvider(url, chainId, { staticNetwork: true }))
  return new FailoverProvider(rpcUrls[0], providers, chainId)
}

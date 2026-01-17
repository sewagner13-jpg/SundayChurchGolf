import { GhinProvider } from './types'
import { NullGhinProvider } from './null-provider'
import { GhinApiProvider } from './api-provider'

export * from './types'

export function getGhinProvider(): GhinProvider {
  const apiKey = process.env.GHIN_API_KEY

  if (apiKey) {
    return new GhinApiProvider()
  } else {
    return new NullGhinProvider()
  }
}

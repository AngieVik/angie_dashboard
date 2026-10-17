import type { IncomingMessage, ServerResponse } from 'node:http'

export function isForecastRequest(url: string): boolean
export function handleForecastRequest(request: IncomingMessage, response: ServerResponse): Promise<void>

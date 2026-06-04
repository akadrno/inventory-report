import { HttpResponseInit } from '@azure/functions'

export function json(body: unknown, status = 200): HttpResponseInit {
  return { status, jsonBody: body, headers: { 'Content-Type': 'application/json' } }
}

export function noContent(): HttpResponseInit {
  return { status: 204 }
}

// Thrown by guards/handlers to short-circuit with a clean status the SPA understands.
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function errorResponse(e: unknown): HttpResponseInit {
  if (e instanceof HttpError) return json({ error: e.message }, e.status)
  const message = e instanceof Error ? e.message : 'Unexpected error'
  return json({ error: message }, 500)
}

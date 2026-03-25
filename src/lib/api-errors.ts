/**
 * API Error Handling Utilities
 * 
 * Provides consistent error responses that don't expose internal details
 * while logging the actual errors server-side for debugging.
 */

import { NextResponse } from 'next/server'

// Error codes for consistent API responses
export enum ApiErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
}

// User-friendly error messages (no internal details exposed)
const USER_FRIENDLY_MESSAGES: Record<ApiErrorCode, string> = {
  [ApiErrorCode.VALIDATION_ERROR]: 'Invalid input provided. Please check your data and try again.',
  [ApiErrorCode.NOT_FOUND]: 'The requested resource was not found.',
  [ApiErrorCode.UNAUTHORIZED]: 'Authentication required. Please log in and try again.',
  [ApiErrorCode.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ApiErrorCode.RATE_LIMITED]: 'Too many requests. Please wait a moment and try again.',
  [ApiErrorCode.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again later.',
  [ApiErrorCode.BAD_REQUEST]: 'Invalid request. Please check your input and try again.',
}

// Log error server-side (not exposed to client)
export function logApiError(context: string, error: unknown): void {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, error)
  } else {
    // In production, log to external service or structured logging
    console.error(`[${context}]`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    })
  }
}

// Create a standardized API error response
export function apiErrorResponse(
  code: ApiErrorCode,
  customMessage?: string,
  statusCode: number = 400
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: customMessage || USER_FRIENDLY_MESSAGES[code],
      code,
    },
    { status: statusCode }
  )
}

// Convenience functions for common errors
export function validationError(message?: string): NextResponse {
  return apiErrorResponse(ApiErrorCode.VALIDATION_ERROR, message, 400)
}

export function notFoundError(message?: string): NextResponse {
  return apiErrorResponse(ApiErrorCode.NOT_FOUND, message, 404)
}

export function unauthorizedError(): NextResponse {
  return apiErrorResponse(ApiErrorCode.UNAUTHORIZED, undefined, 401)
}

export function forbiddenError(): NextResponse {
  return apiErrorResponse(ApiErrorCode.FORBIDDEN, undefined, 403)
}

export function rateLimitedError(resetAt?: number): NextResponse {
  const response = apiErrorResponse(ApiErrorCode.RATE_LIMITED, undefined, 429)
  if (resetAt) {
    response.headers.set('X-RateLimit-Reset', resetAt.toString())
  }
  return response
}

export function internalError(context: string, error: unknown): NextResponse {
  logApiError(context, error)
  return apiErrorResponse(ApiErrorCode.INTERNAL_ERROR, undefined, 500)
}

export function badRequestError(message?: string): NextResponse {
  return apiErrorResponse(ApiErrorCode.BAD_REQUEST, message, 400)
}

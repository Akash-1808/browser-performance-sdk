/**
 * sdk/src/errors.ts
 *
 * Captures uncaught JS errors and unhandled promise rejections.
 * Enqueues them for batched delivery via beacon.ts.
 *
 * Important: NEVER let SDK errors surface on the host page.
 * All SDK code is wrapped in try/catch. We are a guest on their site.
 */

import type { QueuedEvent } from "./type";

type EnqueueFn = (event: QueuedEvent) => void

export function initErrors(enqueue: EnqueueFn): void {
    // Uncaught synchronous errors
    window.addEventListener('error', (e: ErrorEvent) => {

        // Ignore errors from other scripts (e.g. browser extensions)
        // e.filename will be empty string for cross-origin scripts
        enqueue({
            type: 'error',
            message: e.message,
            stack: e.error instanceof Error ? e.error.stack || null : null,
            ts: Date.now(),
            url: location.href,
        })
    })

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
        const message = e.reason instanceof Error
            ? e.reason.message
            : typeof e.reason === 'string'
                ? e.reason
                : 'Unhandle promised rejection'

        const stack = e.reason instanceof Error ? e.reason.stack : undefined

        enqueue({
            type: 'error',
            message,
            stack: stack || null,
            ts: Date.now(),
            url: location.href
        })

    })
}
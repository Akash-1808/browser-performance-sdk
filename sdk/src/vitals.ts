/**
 * sdk/src/vitals.ts
 *
 * Captures LCP, CLS, FID, TTFB via PerformanceObserver.
 *
 * Tricky parts:
 *   - LCP fires MULTIPLE times as larger elements load. We keep updating
 *     lcpValue and only finalize it on user input or visibilitychange.
 *   - CLS is CUMULATIVE. Add every layout-shift value, but SKIP entries
 *     with hadRecentInput: true (user-triggered shifts don't count).
 *   - FID fires at most ONCE (first input only).
 *   - TTFB comes from the navigation entry, not PerformanceObserver.
 */

import type { QueuedEvent } from "./type";

type EnqueueFn = (event: QueuedEvent) => void;


let lcpValue = 0;
let clsValue = 0;
let lcpFinalized = false
let enqueueFn: EnqueueFn

//Called from index.ts

export function initVitals(enqueue: EnqueueFn) {
    enqueueFn = enqueue
    observeLcp()
    observeCls()
    observeFid()
    captureTtfb()
    listenForUserInteractions()
}

// Called from index.ts on visibilitychange:hidden — takes the last LCP value
export function finalizeLcp(): void {
    if (lcpFinalized || !lcpValue) return
    lcpFinalized = true
    enqueueFn({ type: 'lcp', value: lcpValue, projectId: '', sessionId: '', ts: Date.now() })
}

// ---------------------------------------------------------------------------
// LCP — Largest Contentful Paint
// ---------------------------------------------------------------------------
function observeLcp(): void {
    try {
        const po = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                // Keep overwriting — we want the LAST value before user interaction
                lcpValue = (entry as PerformanceEntry & { startTime: number }).startTime
            }
        })
        po.observe({ type: 'largest-contentful-paint', buffered: true })
    } catch {
        // PerformanceObserver not supported — skip silently
    }
}

// ---------------------------------------------------------------------------
// CLS — Cumulative Layout Shift
// ---------------------------------------------------------------------------
function observeCls(): void {
    try {
        const po = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean }
                // Per spec: only count shifts NOT caused by user input
                if (!shift.hadRecentInput) {
                    clsValue += shift.value
                }
            }
        })
        po.observe({ type: 'layout-shift', buffered: true })

        // CLS is reported at page hide — send the accumulated value then
        // (handled by finalizeCls called from index.ts visibilitychange)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                enqueueFn({ type: 'cls', value: clsValue, projectId: '', sessionId: '', ts: Date.now() })
            }
        })
    } catch {
        // skip
    }
}

// ---------------------------------------------------------------------------
// FID — First Input Delay (fires at most once)
// ---------------------------------------------------------------------------
function observeFid(): void {
    try {
        const po = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const fid = entry as PerformanceEntry & { processingStart: number; startTime: number }
                enqueueFn({
                    type: 'fid',
                    value: fid.processingStart - fid.startTime,
                    projectId: '',
                    sessionId: '',
                    ts: Date.now(),
                })
            }
        })
        po.observe({ type: 'first-input', buffered: true })
    } catch {
        // skip
    }
}

// ---------------------------------------------------------------------------
// TTFB — Time to First Byte
// Comes from the navigation entry, available immediately after page load.
// ---------------------------------------------------------------------------

function captureTtfb(): void {
    const capture = () => {
        const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
        if (!nav) return

        enqueueFn({
            type: 'ttfb',
            value: nav.responseStart,
            projectId: '',
            sessionId: '',
            ts: Date.now()
        })
    }

    // Navigate entry is usually available immediatly, but DOMContentLoaded
    // is a safe guarantee.
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', capture, { once: true })
    }
    else {
        capture()
    }
}

// ------------------------------------------------------------------------
// Stop LCP updates after the first user interaction.
// Per the spce, LCP stops beign recoded once the user interacts.
// ------------------------------------------------------------------------

function listenForUserInteractions(): void {
    const stop = () => {
        finalizeLcp();
        ['pointerdown', 'keydown', 'click', 'touchstart'].forEach((evt) =>
            document.removeEventListener(evt, stop, { capture: true }))

    }

    ['pointerdown', 'keydown', 'click', 'touchstart'].forEach((evt) =>
        document.addEventListener(evt, stop, { once: true, capture: true, passive: true }))
}
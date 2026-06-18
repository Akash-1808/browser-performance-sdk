/**
 * sdk/src/index.ts
 *
 * Entry point — reads data-project-id, inits all observers.
 *
 * This file runs at <script> evaluation time on the host page.
 * It MUST read data-project-id synchronously from document.currentScript
 * before any async code runs (currentScript becomes null after evaluation).
 */

import { setMeta, enqueue, flush } from './beacon'
import { initVitals, finalizeLcp } from './vitals'   // TODO: implement vitals.ts
import { initReplay, stopReplay } from './replay'   // TODO: implement replay.ts
import { initErrors } from './error'   // TODO: implement errors.ts
import { SdkConfig } from './type'

// ─── 1. Read config synchronously at evaluation time ────────────────
const scriptEl = document.currentScript as HTMLScriptElement | null

const config: SdkConfig = {
    projectId: scriptEl?.getAttribute('data-project-id') ?? '',
    ingestUrl: scriptEl?.getAttribute('data-ingest-url') ?? 'http://localhost:3000/api/ingest',
    debug: scriptEl?.getAttribute('data-debug') === 'true'
}

if (!config.projectId) {
    console.warn('[perf-sdk] No data-project-id found on the script tag. Events will not be sent.')
}

// ─── 2. Generate a unique session ID for this page load ─────────────
const sessionId = crypto.randomUUID()

// ─── 3. Configure the beacon transport ──────────────────────────────
setMeta({
    projectId: config.projectId,
    sessionId,
    domain: location.hostname,
    timestamp: Date.now(),
    url: location.href,
}, config.ingestUrl)

// ─── 4. Initialize observers after DOM is ready ─────────────────────
function init(): void {
    if (!config.debug) {
        console.log('[perf-sdk] Initialized', config.projectId, sessionId)
    }

    initVitals(enqueue)
    initReplay(enqueue)
    initErrors(enqueue)
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
    // DOM already loaded (script is deferred or loaded late)
    init()
}

// ─── 5. Flush remaining events when the tab goes hidden ─────────────
// IMPORTANT: Do NOT use 'beforeunload' — it is blocked on iOS Safari.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        finalizeLcp()
        stopReplay()
        flush()
    }
})

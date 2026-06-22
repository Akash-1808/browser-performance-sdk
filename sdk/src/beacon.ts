/**
 * sdk/src/beacon.ts
 *
 * Batches events and sends them via navigator.sendBeacon().
 *
 * Why sendBeacon over fetch:
 *   fetch() is cancelled when the tab closes. sendBeacon() is guaranteed
 *   delivery even on unload — critical for capturing the final LCP value.
 *
 * Why NOT beforeunload:
 *   Blocked on iOS Safari. We flush on visibilitychange instead (index.ts).
 */

import type { QueuedEvent, BeaconMeta, IngestPayload, MetricType } from "./type";

let queue: QueuedEvent[] = []
let timer: ReturnType<typeof setTimeout> | null = null;
let meta: BeaconMeta = { projectId: '', sessionId: '', domain: '', timestamp: 0, url: '' }
let ingestUrl = 'http://localhost:3000/ingest';

const FLUSH_INTERVAL_MS = 2000
const MAX_QUEUE_SIZE = 200  // safety cap- avoid gaint payloads

// Called once from index.ts before any events are queued
export function setMeta(m: BeaconMeta, url: string): void {
    meta = m
    ingestUrl = url
}

export function enqueue(event: QueuedEvent): void {
    queue.push(event);

    //Hard cap - if queue fills up, flush immediately
    if (queue.length >= MAX_QUEUE_SIZE) {
        flush()
        return
    }

    //Start the 2s debounce timer if not already running
    if (!timer) {
        timer = setTimeout(flush, FLUSH_INTERVAL_MS)
    }
}

export function flush(): void {
    if (timer) {
        clearTimeout(timer)
        timer = null
    }
    if (!queue.length) return
    if (!meta.projectId) return // no project id - dont send

    const payload = {
        projectId: meta.projectId,
        sessionId: meta.sessionId,
        domain: meta.domain,
        timestamp: meta.timestamp,
        events: queue.splice(0, queue.length) // automatically drain the queue
    }

    // CRITICAL: We MUST use 'text/plain' instead of 'application/json'.
    // If you use 'application/json', Chrome forces a CORS preflight which 
    // often fails or gets blocked. 'text/plain' is a CORS-safelisted type 
    // so it sends immediately without a preflight!
    const blob = new Blob(
        [JSON.stringify(payload)],
        { type: 'text/plain' }
    )

    const sent = navigator.sendBeacon(ingestUrl, blob)
    console.log("sendBeacon queued:", sent)

    if (!sent) {
        // If sendBeacon returns false (payload > 64KB), fallback to fetch
        fetch(ingestUrl, {
            method: 'POST',
            body: blob,
            keepalive: true
        }).catch(() => { })
    }

}
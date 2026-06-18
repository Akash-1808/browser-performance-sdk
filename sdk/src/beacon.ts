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
let ingestUrl = 'http://localhost:3000/ingest'


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

    const payload: IngestPayload = {
        projectId: meta.projectId,
        sessionId: meta.sessionId,
        domain: meta.domain,
        timestamp: meta.timestamp,
        events: queue.splice(0) // automatically drain the queue
    }

    const blob = new Blob(
        [JSON.stringify(payload)],
        { type: 'application/json' }
    )
    // sendBeacon returns false if the browser can't queue the request.
    // Fall back to a fire-and-forget fetch in that case.
    const sent = navigator.sendBeacon(ingestUrl, blob)
    console.log(sent)

    if (!sent) {
        // fetch fallback - keepalive ensure it survives tab close in modern browsers

        fetch(ingestUrl, {
            method: 'POST',
            body: blob,
            keepalive: true,
            mode: 'no-cors'
        }).catch(() => {

        })
    }

}
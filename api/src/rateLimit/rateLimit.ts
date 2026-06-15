const limits = new Map<string, number[]>();

export function resetLimits() {
    limits.clear();
}

const MAX_EVENTS = 1000;
const WINDOW_MS = 60_000; // 1 minute

export function checkRateLimit(domain: string, eventCount: number): boolean {
    const now = Date.now();

    // 1. Get existing timestamps for this domain (or start fresh)
    let timestamps = limits.get(domain) || [];

    // 2. Slide the window — drop everything older than 60 seconds
    const windowStart = now - WINDOW_MS;
    timestamps = timestamps.filter(ts => ts > windowStart);

    // 3. Would adding these new events exceed the limit?
    if (timestamps.length + eventCount > MAX_EVENTS) {
        limits.set(domain, timestamps);
        return false; // 429 — blocked
    }

    // 4. Allowed — record one timestamp per event in the batch
    for (let i = 0; i < eventCount; i++) {
        timestamps.push(now);
    }
    limits.set(domain, timestamps);
    return true; // 200 — allowed
}

// Cleanup: every 60s, purge domains with no recent activity to prevent memory leaks
setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS;
    for (const [domain, timestamps] of limits.entries()) {
        const active = timestamps.filter(ts => ts > cutoff);
        if (active.length === 0) {
            limits.delete(domain);
        } else {
            limits.set(domain, active);
        }
    }
}, WINDOW_MS);

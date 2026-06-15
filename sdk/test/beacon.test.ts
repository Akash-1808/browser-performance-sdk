// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { enqueue, flush, setMeta } from '../src/beacon'
import type { VitalEntry } from '../src/type'

describe('beacon transport', () => {
    beforeEach(() => {
        // We use Vitest's fake timers so we don't actually have to wait 2 seconds
        // in our tests for the debounce timer to fire
        vi.useFakeTimers()
        
        // Mock the browser APIs that beacon.ts uses
        Object.assign(navigator, {
            sendBeacon: vi.fn(() => true)
        })
        globalThis.fetch = vi.fn(() => Promise.resolve(new Response())) as any

        // Setup baseline meta so flush() doesn't exit early
        setMeta({
            projectId: 'test-proj',
            sessionId: 'test-session',
            domain: 'localhost',
            timestamp: 12345,
            url: 'http://localhost'
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
        flush() // Ensure queue is cleared for the next test
    })

    it('enqueues an event and flushes after 2 seconds', () => {
        const event: VitalEntry = { type: 'lcp', value: 100, projectId: '', sessionId: '', ts: 1 }
        enqueue(event)
        
        // The event is queued, but flush hasn't happened yet
        expect(navigator.sendBeacon).not.toHaveBeenCalled()
        
        // Fast-forward time by 2000ms
        vi.advanceTimersByTime(2000)
        
        // Now it should have flushed
        expect(navigator.sendBeacon).toHaveBeenCalledOnce()
    })

    it('flushes immediately if the queue hits 200 items', () => {
        // Add 199 items
        for (let i = 0; i < 199; i++) {
            enqueue({ type: 'lcp', value: i, projectId: '', sessionId: '', ts: 1 })
        }
        // Still hasn't flushed yet
        expect(navigator.sendBeacon).not.toHaveBeenCalled()
        
        // The 200th item should trigger an immediate flush without waiting 2 seconds
        enqueue({ type: 'lcp', value: 200, projectId: '', sessionId: '', ts: 1 })
        
        expect(navigator.sendBeacon).toHaveBeenCalledOnce()
    })

    it('falls back to fetch() if sendBeacon returns false', () => {
        // Mock sendBeacon to simulate failure (e.g., payload too large)
        navigator.sendBeacon = vi.fn(() => false)
        
        enqueue({ type: 'lcp', value: 100, projectId: '', sessionId: '', ts: 1 })
        flush() // manual flush
        
        // Both should be called
        expect(navigator.sendBeacon).toHaveBeenCalledOnce()
        expect(globalThis.fetch).toHaveBeenCalledOnce()
    })
})

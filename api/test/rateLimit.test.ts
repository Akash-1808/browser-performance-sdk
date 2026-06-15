import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit, resetLimits } from "../src/rateLimit/rateLimit";

describe('checkRateLimit', () => {
    beforeEach(() => {
        resetLimits();
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('allows events under the limit', () => {
        expect(checkRateLimit('test.com', 100)).toBe(true);
    });

    it('allow exactly 1000 events', () => {
        expect(checkRateLimit('test.com', 999)).toBe(true);
    })
    it('block when events exceed 1000 in the window', () => {
        checkRateLimit('test.com', 999);

        expect(checkRateLimit('test.com', 2)).toBe(false) // 999+2 > 1000
    })
    it('isolates limits per domain', () => {
        checkRateLimit('a.com', 800);

        expect(checkRateLimit('b.com', 800)).toBe(true);
    })

    it('it allows event again after window expires', () => {
        expect(checkRateLimit('test.com', 1000)).toBe(true);

        expect(checkRateLimit('test.com', 100)).toBe(false);
        // fast forward 60 seconds
        vi.advanceTimersByTime(60_001);

        //should be allowed again
        expect(checkRateLimit('test.com', 100)).toBe(true);
    })

    it('partially slide the window', () => {
        checkRateLimit('test.com', 600);
        vi.advanceTimersByTime(30_000);

        checkRateLimit('test.com', 300);
        vi.advanceTimersByTime(31_000);

        expect(checkRateLimit('test.com', 500)).toBe(true);
    })

})
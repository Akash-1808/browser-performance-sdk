// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initVitals, finalizeLcp } from "../src/vitals";
import type { QueuedEvent } from "../src/type";

describe('Vitals SDK', () => {
    let enqueue: any;
    let poCallbacks: Record<string, Function>;

    beforeEach(() => {
        enqueue = vi.fn();
        poCallbacks = {};


        // 1. Mock PerformanceObserver with a real class so 'new' works!
        class MockPO {
            private cb: Function;
            constructor(cb: Function) {
                this.cb = cb;
            }
            observe(options: any) {
                poCallbacks[options.type] = this.cb;
            }
            disconnect() { }
        }

        globalThis.PerformanceObserver = MockPO as any;

        // 2. Mock performance.getEntriesByType for TTFB
        window.performance.getEntriesByType = vi.fn((type: string) => {
            if (type === 'navigation') {
                return [{ responseStart: 120 } as PerformanceNavigationTiming];
            }
            return [];
        });

        // 3. Reset document visibility state for CLS test
        Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('captures TTFB immediately on initVitals', () => {
        initVitals(enqueue);

        // Since we are using JSDOM, document.readyState is 'complete', 
        // which triggers captureTtfb() immediately
        const ttfbCall = enqueue.mock.calls.find(c => c[0].type === 'ttfb');
        expect(ttfbCall).toBeDefined();
        expect(ttfbCall![0].value).toBe(120);
    });

    it('records LCP and only finalizes on user interaction', () => {
        initVitals(enqueue);

        // Simulate an LCP entry firing (e.g. large image loads)
        const lcpCb = poCallbacks['largest-contentful-paint'];
        lcpCb({
            getEntries: () => [{ startTime: 1500 }]
        });

        // LCP should NOT be enqueued yet (we wait for interaction)
        let lcpCalls = enqueue.mock.calls.filter(c => c[0].type === 'lcp');
        expect(lcpCalls.length).toBe(0);

        // Simulate user interacting with the page
        document.dispatchEvent(new Event('click'));

        // Now LCP should be finalized and enqueued
        lcpCalls = enqueue.mock.calls.filter(c => c[0].type === 'lcp');
        expect(lcpCalls.length).toBe(1);
        expect(lcpCalls[0][0].value).toBe(1500);
    });

    it('accumulates CLS but ignores shifts caused by user input', () => {
        initVitals(enqueue);

        // Simulate layout shifts
        const clsCb = poCallbacks['layout-shift'];
        clsCb({
            getEntries: () => [
                { value: 0.1, hadRecentInput: false },
                { value: 0.05, hadRecentInput: false },
                { value: 0.3, hadRecentInput: true } // This one should be ignored!
            ]
        });

        // Simulate the user navigating away (visibilitychange: hidden)
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
        document.dispatchEvent(new Event('visibilitychange'));

        const clsCalls = enqueue.mock.calls.filter(c => c[0].type === 'cls');
        expect(clsCalls.length).toBeGreaterThan(1);

        // 0.1 + 0.05 = 0.15000000000000002 (floating point math)
        expect(clsCalls[0][0].value).toBeCloseTo(0.15);
    });

    it('records FID immediately when observed', () => {
        initVitals(enqueue);

        // Simulate First Input Delay
        const fidCb = poCallbacks['first-input'];
        fidCb({
            getEntries: () => [{ processingStart: 300, startTime: 250 }]
        });

        const fidCalls = enqueue.mock.calls.filter(c => c[0].type === 'fid');
        expect(fidCalls.length).toBe(1);

        // 300 - 250 = 50ms delay
        expect(fidCalls[0][0].value).toBe(50);
    });
});
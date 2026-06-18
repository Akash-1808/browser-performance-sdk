import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { useWebSocket } from "./useWebSocket";
import { renderHook, act } from "@testing-library/react";

describe("useWebSocket", () => {

    let mockWebSocket: any;

    beforeEach(() => {
        vi.useFakeTimers();
        mockWebSocket = {
            send: vi.fn(),
            close: vi.fn(),
            onmessage: null,
            onopen: null,
            onclose: null,
        };

        window.WebSocket = vi.fn(function() { return mockWebSocket }) as any
    })

    afterEach(() => {
        vi.clearAllTimers();
        vi.restoreAllMocks();
    });

    it("connects to the websocket and subscribe to the domain", () => {
        renderHook(() => useWebSocket("test.com"));
        expect(window.WebSocket).toHaveBeenCalledWith("ws://localhost:3000");

        act(() => {
            mockWebSocket.onopen()
        })
        // Verify it sent the subscribe message
        expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({
            type: 'subscribe',
            domain: 'test.com'
        }))

    });
    it('receives events and limits the buffer to 500', () => {
        const { result } = renderHook(() => useWebSocket('test.com'))
        // Send 1 event
        act(() => {
            mockWebSocket.onmessage({
                data: JSON.stringify([{ metric: 'lcp', value: 200 }])
            })
        })
        expect(result.current).toHaveLength(1)
        expect(result.current[0].metric).toBe('lcp')
        // Create a massive array of 600 events
        const massiveArray = Array(600).fill({ metric: 'cls', value: 0.1 })

        act(() => {
            mockWebSocket.onmessage({
                data: JSON.stringify(massiveArray)
            })
        })
        expect(result.current).toHaveLength(500)
    })
    it('reconnects with exponential backoff when closed', () => {
        renderHook(() => useWebSocket('test.com'))
        expect(window.WebSocket).toHaveBeenCalledTimes(1)
        // Simulate connection closing
        act(() => { mockWebSocket.onclose() })
        // Fast-forward exactly 1000ms (the first reconnect delay)
        act(() => { vi.advanceTimersByTime(1000) })

        // It should have tried to connect a 2nd time
        expect(window.WebSocket).toHaveBeenCalledTimes(2)

        act(() => {
            mockWebSocket.onclose()
        })

        act(() => {
            vi.advanceTimersByTime(1000)
        })

        expect(window.WebSocket).toHaveBeenCalledTimes(2)

        act(() => {
            vi.advanceTimersByTime(1000)
        })
        expect(window.WebSocket).toHaveBeenCalledTimes(3)

    })

}) 
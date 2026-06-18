import { useState, useEffect, useRef } from 'react'


export interface LiveEvent {
    metric: string;
    value: number | null;
    time: string;
    // Error events
    message?: string;
    stack?: string;
    url?: string;
    // Mutation events
    target?: string;
    added?: number;
    removed?: number;
}

export function useWebSocket(domain: string) {
    const [events, setEvents] = useState<LiveEvent[]>([]);
    const wsRef = useRef<WebSocket | null>(null);

    // In the browser, setTimeout returns a number, not a NodeJS.Timeout
    const reconnectTimeout = useRef<number | null>(null);

    useEffect(() => {
        if (!domain) return;
        let reconnectDelay = 1000;

        const connect = () => {
            // Your API is running on port 3000, not 8000
            const ws = new WebSocket('ws://localhost:3000')
            wsRef.current = ws;

            ws.onopen = () => {
                console.log(`[WS] connected, subscribing to: ${domain}`)
                ws.send(JSON.stringify({ type: 'subscribe', domain }))
                reconnectDelay = 1000
            }

            ws.onmessage = (event: MessageEvent) => {
                try {
                    const rawEvents = JSON.parse(event.data);
                    const newEvents: LiveEvent[] = rawEvents.map((e: any) => {
                        const base: LiveEvent = {
                            metric: e.type,
                            value: e.value ?? null,
                            time: new Date().toISOString(),
                        };
                        // Error events carry a message and stack
                        if (e.type === 'error') {
                            base.message = e.message || 'Unknown error';
                            base.stack = e.stack;
                            base.url = e.url;
                        }
                        // Mutation events carry target, added/removed counts
                        if (e.type === 'mutation') {
                            base.target = e.target || '';
                            base.added = Array.isArray(e.added) ? e.added.length : 0;
                            base.removed = Array.isArray(e.removed) ? e.removed.length : 0;
                        }
                        return base;
                    });
                    
                    setEvents((prev) => {
                        // Spread both arrays to combine them
                        const combined = [...prev, ...newEvents]
                        return combined.slice(-500)
                    })
                } catch (err) {
                    console.error('Failed to parse ws message', err)
                }
            }

            ws.onclose = () => {
                console.log(`[WS] Disconnected. Reconnecting in ${reconnectDelay}ms.....`);

                reconnectTimeout.current = setTimeout(() => {
                    connect();
                }, reconnectDelay);

                reconnectDelay = Math.min(reconnectDelay * 2, 30000);
            }
        }

        connect()

        return () => {
            if (wsRef.current) wsRef.current.close();
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
        }
    }, [domain])
    return events;
}
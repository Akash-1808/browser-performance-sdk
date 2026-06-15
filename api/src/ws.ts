import { WebSocketServer, WebSocket } from "ws";
import { Server } from 'http'

const subscriber = new Map<string, Set<WebSocket>>();

export function setupWebsocket(server: Server) {
    const wss = new WebSocketServer({ server })

    wss.on('connection', (ws) => {
        ws.on('message', (row) => {
            const data = JSON.parse(row.toString());
            if (data.type === 'subscribe' && data.domain) {
                if (!subscriber.has(data.domain)) {
                    subscriber.set(data.domain, new Set([ws]))
                } else {
                    subscriber.get(data.domain)?.add(ws)
                }
            }
        })

        ws.on('close', () => {
            for (const sockets of subscriber.values()) {
                sockets.delete(ws)
            }
        })
    })
}

export function broadcast(domain: string, events: any[]) {
    const sockets = subscriber.get(domain)
    if (!sockets) return

    const data = JSON.stringify(events)
    for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data)
        }
    }
}
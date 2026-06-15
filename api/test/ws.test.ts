import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, Server } from 'http'
import WebSocket from 'ws'
import { setupWebsocket, broadcast } from '../src/ws'

describe('WebSocket Server', () => {
    let server: Server
    let port: number

    // 1. Start a real HTTP server on an available port before tests run
    beforeAll(async () => {
        server = createServer()
        setupWebsocket(server)
        
        await new Promise<void>((resolve) => {
            server.listen(0, () => {
                const addr = server.address()
                if (addr && typeof addr !== 'string') {
                    port = addr.port
                }
                resolve()
            })
        })
    })

    afterAll(() => {
        server.close()
    })

    it('subscribes to a domain and receives broadcasts', async () => {
        return new Promise<void>((resolve, reject) => {
            // Connect a real WebSocket client to our test server
            const client = new WebSocket(`ws://localhost:${port}`)
            
            client.on('open', () => {
                // Subscribe to 'test.com'
                client.send(JSON.stringify({ type: 'subscribe', domain: 'test.com' }))
                
                // Wait a tiny bit for the server to process the subscription, then broadcast
                setTimeout(() => {
                    broadcast('test.com', [{ metric: 'LCP', value: 1200 }])
                }, 50)
            })

            // Verify the client receives the broadcasted data
            client.on('message', (data) => {
                const events = JSON.parse(data.toString())
                expect(events).toHaveLength(1)
                expect(events[0].metric).toBe('LCP')
                
                client.close()
                resolve()
            })

            client.on('error', reject)
        })
    })

    it('cleans up sockets on close without crashing', async () => {
        const client = new WebSocket(`ws://localhost:${port}`)
        
        await new Promise<void>((resolve) => {
            client.on('open', () => {
                client.send(JSON.stringify({ type: 'subscribe', domain: 'test-cleanup.com' }))
                client.close() // Close the client immediately
                resolve()
            })
        })

        // Wait a tiny bit for the server's 'close' event handler to run
        await new Promise(r => setTimeout(r, 50))
        
        // Broadcasting to the domain shouldn't throw an error, even if the socket was removed
        expect(() => {
            broadcast('test-cleanup.com', [{ metric: 'FCP' }])
        }).not.toThrow()
    })
})
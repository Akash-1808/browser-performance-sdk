import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import ingestRoute from './routes/ingest'
import { migrate } from './db/db';
import metricsRoute from './routes/metrics'
import { setupWebsocket } from './ws';
import sessionsRoute from './routes/sessions'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// 1. Enable CORS for all origins
app.use(cors({
    origin: '*',
    methods: ['POST', 'OPTIONS', 'GET'],
    allowedHeaders: ['Content-Type']
}));

// 2. Parse incoming JSON payloads (from our sendBeacon Blob)
app.use(express.json());
// Fallback text parser just in case the browser drops the content-type
app.use(express.text({ type: 'text/plain' }));

// 3. Serve the project root so test.html loads over HTTP (not file://)
//    This avoids CORS issues — file:// origin is 'null' and gets blocked.
const projectRoot = path.resolve(__dirname, '..', '..');
app.use(express.static(projectRoot));

// 3. The ingest route
app.use('/api', ingestRoute)

// metrics route
app.use('/api', metricsRoute)
app.use('/api', sessionsRoute)

async function start() {
    await migrate();
    const server = app.listen(PORT, () => {
        console.log(`🚀 API Ingestion server running at http://localhost:${PORT}`);
        console.log(`Ready to receive events from test.html...`);
    })
    setupWebsocket(server)
}

start().catch((err) => {
    console.error("start fail:", err)
    process.exit(1);
})


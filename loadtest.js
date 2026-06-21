import http from 'k6/http';
import { check } from 'k6';


export const options = {
    vus: 50, // 50 Virtual Users
    duration: '10s', // run for 10 seconds
};

// URL from inside Docker needs to hit the host machine on Windows
const INGEST_URL = 'http://host.docker.internal:3000/api/ingest';
const PROJECT_ID = '00000000-0000-0000-0000-000000000000'; // The Demo Project

export default function () {
    // Generate a mock UUID for each VU iteration
    const randomHex = () => Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    const sessionId = `12345678-1234-1234-1234-${randomHex()}${randomHex()}`;

    const domain = 'test-domain-' + Math.random().toString(36).substring(7)

    const payload = JSON.stringify({
        domain: domain,
        projectId: PROJECT_ID,
        sessionId: sessionId,
        events: [
            { type: 'fcp', value: Math.random() * 1000 },
            { type: 'lcp', value: Math.random() * 2500 },
            { type: 'cls', value: Math.random() * 0.1 },
            { type: 'fid', value: Math.random() * 100 },
            { type: 'ttfb', value: Math.random() * 200 }
        ]
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const res = http.post(INGEST_URL, payload, params);

    check(res, {
        'is status 200 or 201': (r) => r.status === 200 || r.status === 201,
    });
}

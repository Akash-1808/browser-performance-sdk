export type MetricType = 'lcp' | 'cls' | 'fid' | 'ttfb' | 'error' | 'mutation';

export interface SdkConfig {
    projectId: string;
    ingestUrl: string;
    debug: boolean;
}

export interface BeaconMeta {
    projectId: string;
    sessionId: string;
    domain: string;
    timestamp: number;
    url: string;
}
// Sent for every Core Web Vital measurement
export interface VitalEntry {
    type: MetricType
    value: number
    projectId: string
    sessionId: string
    ts: number
}

// Sent for every DOM mutation (session replay)
export interface MutationDiff {
    type: 'mutation';
    target: string;            // CSS selector path to the mutated element
    added: SerializedNode[];
    removed: string[];       // selector paths of removed nodes
    attr: string | null;   // changed attribute name
    oldValue: string | null;
    newValue: string | null;
    ts: number
}

export interface ErrorEntry {
    type: 'error'
    message: string
    stack: string | null
    url: string
    ts: number
}

// Minimal serialized DOM node for replay reconstruction
export interface SerializedNode {
    tag: string
    attributes: Record<string, string>
    text: string | null
    children: SerializedNode[]
}
// Union of everything that goes in the beacon queue
export type QueuedEvent = VitalEntry | MutationDiff | ErrorEntry

export interface IngestPayload {
    projectId: string;
    sessionId: string;
    domain: string;
    timestamp: number;
    events: QueuedEvent[];
}
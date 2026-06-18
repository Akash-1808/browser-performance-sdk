import { useEffect, useRef, useState } from "react"

interface SerializedNode {
    tag: string;
    attributes: Record<string, string>;
    text: string | null;
    children: SerializedNode[];
}

interface MutationEvent {
    target: string;
    added: SerializedNode[];
    removed: string[];
    attr?: string | null;
    newValue?: string | null;
}

interface ReplayPlayerProps {
    // We only care about the mutation events for replay
    mutations: MutationEvent[];
}

export function ReplayPlayer({ mutations }: ReplayPlayerProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [currentIndex, setCurrentIndex] = useState(-1);

    // ─── 1. Reset the iframe when mutations change ─────────────────
    useEffect(() => {
        if (iframeRef.current) {
            const doc = iframeRef.current.contentDocument;
            if (doc) {
                doc.body.innerHTML = '';
            }
        }
        setCurrentIndex(-1)
    }, [mutations]);

    // ─── 2. Helper function to recreate a DOM node ─────────────────

    const createNode = (doc: Document, serialized: SerializedNode): Node => {
        if (serialized.tag === '#text') {
            return doc.createTextNode(serialized.text || '');
        }
        const el = doc.createElement(serialized.tag)
        for (const [key, value] of Object.entries(serialized.attributes)) {
            el.setAttribute(key, value);
        }
        if (serialized.text) {
            el.textContent = serialized.text;
        }

        // Recursively attach children
        for (const child of serialized.children) {
            el.appendChild(createNode(doc, child));
        }
        return el
    };

    // ─── 3. Stepper controls ────────────────────────────────────────

    const applyMutation = (doc: Document, diff: MutationEvent) => {
        // Find the target element (fallback to body if we can't find it)
        const targetEl = diff.target === 'body'
            ? doc.body
            : doc.querySelector(diff.target) || doc.body;

        // Apply attribute changes
        if (diff.attr && targetEl instanceof Element) {
            if (diff.newValue !== null) {
                targetEl.setAttribute(diff.attr, diff.newValue);
            } else {
                targetEl.removeAttribute(diff.attr);
            }
        }

        // Apply Added nodes
        for (const added of diff.added) {
            targetEl.appendChild(createNode(doc, added));
        }
        // Apply Removed nodes (we remove by matching the selector)
        for (const removedSelector of diff.removed) {
            const elToRemove = doc.querySelector(removedSelector);
            if (elToRemove && elToRemove.parentNode) {
                elToRemove.parentNode.removeChild(elToRemove);
            }
        }
    };

    const stepForward = () => {
        if (currentIndex >= mutations.length - 1) return;
        const nextIndex = currentIndex + 1;
        const doc = iframeRef.current?.contentDocument;
        if (!doc) return;

        applyMutation(doc, mutations[nextIndex]);
        setCurrentIndex(nextIndex);
    }

    const stepBack = () => {
        if (currentIndex <= -1) return;
        const targetIndex = currentIndex - 1;
        const doc = iframeRef.current?.contentDocument;
        if (!doc) return;

        // Because DOM diffs are destructive, stepping backwards requires 
        // completely resetting the iframe and fast-forwarding from 0 to (currentIndex - 1).
        doc.body.innerHTML = '';
        for (let i = 0; i <= targetIndex; i++) {
            applyMutation(doc, mutations[i]);
        }
        
        setCurrentIndex(targetIndex);
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            height: '100%'
        }}>
            {/** The Screen Viewer */}
            <div style={{
                flex: 1,
                border: '1px solid var(--text-subtle)',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#fff' // Replay Screen is white
            }}>
                <iframe
                    ref={iframeRef}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none'
                    }}
                    title="Session Replay" />
            </div>
            { /** Playback Controls */}
            <div className="glass-card"
                style={{
                    padding: '1rem',
                    display: 'flex',
                    gap: '1rem',
                    alignItems: 'center'
                }}>
                <button onClick={stepBack}
                    disabled={currentIndex <= -1}
                    style={btnStyle}
                >
                    &larr; Prev
                </button>
                <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                    Step: {currentIndex + 1} / {mutations.length}
                </div>
                <button onClick={stepForward} disabled={currentIndex >= mutations.length - 1} style={btnStyle}>Next &rarr;</button>
            </div>
        </div>
    );
}

const btnStyle = {
    padding: '0.5rem 1rem',
    background: 'var(--accent-primary)',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
}
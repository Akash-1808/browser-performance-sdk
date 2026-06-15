/**
 * sdk/src/replay.ts
 *
 * Records DOM mutations as serialized diffs using MutationObserver.
 * On playback (in the dashboard), applying these diffs in order reconstructs
 * the page state at any point in the session.
 *
 * Tricky parts:
 *   - serializeNode() must avoid circular references — never store the Node
 *     itself, only its tag, attributes, and text content.
 *   - Don't serialize the entire subtree for large additions — cap depth at 5.
 *   - The observer must be stoppable so index.ts can pause it on tab hide.
 */

import { getSelector } from "./selector";
import type { QueuedEvent, SerializedNode, MutationDiff } from "./type";

type EnqueueFn = (event: QueuedEvent) => void

let observer: MutationObserver | null = null

export function initReplay(enqueue: EnqueueFn): void {
    // Disconnect any existing observer before creating a new one
    stopReplay()

    observer = new MutationObserver((records) => {
        for (const record of records) {
            try {
                const diff: MutationDiff = {
                    type: 'mutation',
                    target: getSelector(record.target),
                    added: [...record.addedNodes].map(serializeNode),
                    removed: [...record.removedNodes].map((n) => getSelector(n)),
                    attr: record.attributeName,
                    oldValue: record.oldValue,
                    newValue: record.attributeName && record.target instanceof Element
                        ? record.target.getAttribute(record.attributeName)
                        : null,
                    ts: performance.now(),
                }
                enqueue(diff)
            } catch {

            }
        }
    })

    observer.observe(document.body, {
        childList: true, // child node additions/removals
        subtree: true, // all descendants, not just direct children
        attributes: true, //atribute changes
        attributeOldValue: true, // capture previous attribute values for replay
        characterData: false, //skip text node changes - too noisy
    })
}

export function stopReplay(): void {
    if (observer) {
        observer.disconnect()
        observer = null;
    }
}

// ---------------------------------------------------------------------------
// Serialize a DOM node to a plain object safe for JSON.stringify.
// Depth-limited to avoid huge payloads on complex DOM trees.
// ---------------------------------------------------------------------------

function serializeNode(node: Node, depth = 0): SerializedNode {
    // Text node
    if (node.nodeType === Node.TEXT_NODE) {
        return {
            tag: '#text',
            attributes: {},
            text: node.textContent?.slice(0, 500) ?? null, // cap long text
            children: []
        }
    }

    // Element node
    if (node.nodeType === Node.ELEMENT_NODE && node instanceof Element) {
        const attributes: Record<string, string> = {}
        for (const attr of node.attributes) {
            // Skip event handler atttributes - security and size concern
            if (!attr.name.startsWith('on')) {
                attributes[attr.name] = attr.value.slice(0, 200) // cap long values
            }
        }

        // Cap recursion depth at 5 levels to keep payload manageable
        const children: SerializedNode[] = depth < 5
            ? [...node.childNodes].map((child) => serializeNode(child, depth + 1))
            : []

        return {
            tag: node.tagName.toLowerCase(),
            attributes,
            text: node.childNodes.length === 0 ? node.textContent.slice(0, 200) ?? null : null,
            children,
        }
    }

    // All other node types (comments, etc.) - return empty placeholder
    return {
        tag: '#other',
        attributes: {},
        text: null,
        children: [],
    }
}
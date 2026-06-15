export function getSelector(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
        return getSelector(node.parentElement) + ' > #text'
    }
    if (!(node instanceof Element)) return ''

    const parts: string[] = []
    let current: Element | null = node;
    while (current && current !== document.body && current !== document.documentElement) {
        const tag = current.tagName.toLowerCase();

        //id is unique - use it and stop walking
        if (current.id) {
            // Sanitize id — ids can contain special chars that break selectors
            const safeId = CSS.escape(current.id)
            parts.unshift(`${tag}#${safeId}`)
            break
        } // Compute nth-child index among siblings with the same tag
        // (nth-child is more stable than nth-of-type for replay purposes)
        const siblings = current.parentElement
            ? [...current.parentElement.children]
            : []
        const index = siblings.indexOf(current) + 1   // 1-based

        parts.unshift(`${tag}:nth-child(${index})`)
        current = current.parentElement
    }

    return parts.join(' > ') || node.nodeName.toLowerCase()
}
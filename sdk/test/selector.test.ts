// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { getSelector } from '../src/selector'

describe('getSelector', () => {
    beforeEach(() => {
        // jsdom doesn't implement CSS.escape, so we polyfill it for the tests
        if (typeof window.CSS === 'undefined') {
            (window as any).CSS = {};
        }
        window.CSS.escape = (str: string) => str;
        
        // Clear the body before each test so nth-child indices are predictable
        document.body.innerHTML = '';
    })
    it('return an id selector if element has an id', () => {
        const div = document.createElement('div')
        div.id = 'my-id'

        document.body.appendChild(div)

        expect(getSelector(div)).toBe('div#my-id')
    })
    it('generates nth-child paths for nested elements', () => {
        const parent = document.createElement('div')
        const child1 = document.createElement('p')
        const child2 = document.createElement('span')

        parent.appendChild(child1)
        parent.appendChild(child2)

        document.body.appendChild(parent)

        expect(getSelector(child2)).toBe('div:nth-child(1) > span:nth-child(2)')
    })
})
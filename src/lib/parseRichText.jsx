import React from 'react'

/**
 * Detect whether a string contains HTML tags.
 */
function isHtml(text) {
    return /<[a-z][\s\S]*?>/i.test(text)
}

/**
 * Parse a rich-text string and return React elements.
 *
 * Supports two input formats:
 *   1. Plain text with lightweight markdown: **bold**, *italic*, \n → <br/>
 *   2. HTML (as produced by TipTap): <p>, <strong>, <em>, <a>, <ul>, <ol>, <li>
 *
 * HTML is rendered via dangerouslySetInnerHTML after basic sanitisation.
 * Markdown mode never uses dangerouslySetInnerHTML.
 */
export default function parseRichText(text) {
    if (!text || typeof text !== 'string') return null

    // If the content contains HTML tags, render as sanitised HTML
    if (isHtml(text)) {
        const sanitised = sanitiseHtml(text)
        return (
            <span
                className="rich-html-content"
                dangerouslySetInnerHTML={{ __html: sanitised }}
            />
        )
    }

    // Otherwise, fall back to the original markdown-style parser
    return parseMarkdownText(text)
}

/**
 * Truncate text to a max length for previews.
 * Handles both HTML and plain-text/markdown inputs.
 * Returns the raw truncated string for further processing.
 */
export function truncateRichText(text, maxLen = 120) {
    if (!text || typeof text !== 'string') return ''

    // If it's HTML, strip tags first to get visible text, then truncate
    if (isHtml(text)) {
        const plain = stripHtml(text)
        if (plain.length <= maxLen) return text
        // Return truncated plain text (will be re-wrapped by parseRichText)
        return plain.slice(0, maxLen) + '…'
    }

    // Plain text / markdown truncation
    const plain = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
    if (plain.length <= maxLen) return text

    let visible = 0
    let i = 0
    while (i < text.length && visible < maxLen) {
        if (text[i] === '*' && text[i + 1] === '*') { i += 2; continue }
        if (text[i] === '*') { i += 1; continue }
        visible++
        i++
    }

    return text.slice(0, i) + '…'
}

/* ────────────────────── Internal helpers ────────────────────── */

/**
 * Strip HTML tags and decode common entities to get visible text.
 */
function stripHtml(html) {
    return html
        .replace(/<[^>]+>/g, ' ')       // Replace tags with spaces
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')           // Collapse whitespace
        .trim()
}

/**
 * Basic HTML sanitisation — allow only safe tags and attributes.
 * This is NOT a full sanitiser, but sufficient for content we control
 * (saved by our own CMS via TipTap).
 */
function sanitiseHtml(html) {
    // Allowed tags (TipTap output)
    const allowedTags = new Set([
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a',
        'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'span', 'blockquote', 'code', 'pre', 'hr', 'sub', 'sup',
    ])

    // Remove <script>, <style>, <iframe>, event handlers, etc.
    let clean = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
        .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')  // Remove on* event handlers
        .replace(/\son\w+\s*=\s*[^\s>]*/gi, '')          // Remove unquoted on* handlers
        .replace(/javascript\s*:/gi, '')                  // Remove javascript: URLs

    // Remove tags not in the allowlist
    clean = clean.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => {
        if (allowedTags.has(tagName.toLowerCase())) return match
        return '' // Strip disallowed tags entirely
    })

    return clean
}

/**
 * Original markdown-style parser for plain-text descriptions.
 * Supports **bold**, *italic*, and \n → <br/>.
 */
function parseMarkdownText(text) {
    const parts = []
    let key = 0

    const boldRegex = /\*\*(.+?)\*\*/g
    let lastIndex = 0
    let match

    const processItalic = (str, parentKey) => {
        const italicRegex = /\*(.+?)\*/g
        const result = []
        let iLastIndex = 0
        let iMatch

        while ((iMatch = italicRegex.exec(str)) !== null) {
            if (iMatch.index > iLastIndex) {
                result.push(processLineBreaks(str.slice(iLastIndex, iMatch.index), `${parentKey}-t${iLastIndex}`))
            }
            result.push(
                <em key={`${parentKey}-i${iMatch.index}`}>{processLineBreaks(iMatch[1], `${parentKey}-ie${iMatch.index}`)}</em>
            )
            iLastIndex = iMatch.index + iMatch[0].length
        }

        if (iLastIndex < str.length) {
            result.push(processLineBreaks(str.slice(iLastIndex), `${parentKey}-t${iLastIndex}`))
        }

        return result.length === 1 ? result[0] : result
    }

    const processLineBreaks = (str, k) => {
        if (!str.includes('\n')) return str
        const lines = str.split('\n')
        return lines.map((line, i) => (
            <React.Fragment key={`${k}-ln${i}`}>
                {line}
                {i < lines.length - 1 && <br />}
            </React.Fragment>
        ))
    }

    while ((match = boldRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const segment = text.slice(lastIndex, match.index)
            parts.push(<React.Fragment key={`t${key++}`}>{processItalic(segment, `s${key}`)}</React.Fragment>)
        }
        parts.push(
            <strong key={`b${key++}`}>{processItalic(match[1], `b${key}`)}</strong>
        )
        lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
        const segment = text.slice(lastIndex)
        parts.push(<React.Fragment key={`t${key++}`}>{processItalic(segment, `s${key}`)}</React.Fragment>)
    }

    return parts.length > 0 ? parts : text
}

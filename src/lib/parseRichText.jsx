import React from 'react'

/**
 * Parse a plain-text string that may contain lightweight markdown markers
 * and return an array of React elements.
 *
 * Supported syntax:
 *   **bold text**   → <strong>
 *   *italic text*   → <em>
 *   \n              → <br/>
 *
 * The markers can be nested: **bold and *italic* inside**
 * The function is safe against XSS because it never uses dangerouslySetInnerHTML.
 */
export default function parseRichText(text) {
    if (!text || typeof text !== 'string') return null

    // Split by double-asterisk first (bold), then by single-asterisk (italic)
    const parts = []
    let key = 0

    // Regex: match **bold** or *italic* segments
    // We process **bold** first, then *italic* in a second pass
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

/**
 * Truncate text to a max length, stripping markdown markers for accurate counting.
 * Returns the raw truncated string (still with markers) for further processing.
 */
export function truncateRichText(text, maxLen = 120) {
    if (!text || typeof text !== 'string') return ''

    // Strip markers to count visible characters
    const plain = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')

    if (plain.length <= maxLen) return text

    // Walk through original text, counting only visible characters
    let visible = 0
    let i = 0
    while (i < text.length && visible < maxLen) {
        // Skip ** markers
        if (text[i] === '*' && text[i + 1] === '*') {
            i += 2
            continue
        }
        // Skip single * markers (only if it's an italic marker, not a literal asterisk)
        if (text[i] === '*') {
            i += 1
            continue
        }
        visible++
        i++
    }

    return text.slice(0, i) + '…'
}

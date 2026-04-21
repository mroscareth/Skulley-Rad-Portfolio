<?php
/**
 * HTML Sanitizer — strips all tags/attributes not in the whitelist.
 * Defense-in-depth complement to client-side DOMPurify: even if the CMS
 * is compromised or someone POSTs raw HTML directly to blog.php, no
 * <script>, event handlers, or javascript: URLs survive the DB write.
 *
 * Uses DOMDocument (built into PHP — no composer deps required).
 */

declare(strict_types=1);

final class HtmlSanitizer {
    /** Tags allowed in TipTap content. */
    private const ALLOWED_TAGS = [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
        'a', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'span', 'blockquote', 'code', 'pre', 'hr', 'sub', 'sup',
        'img', 'figure', 'figcaption',
    ];

    /** Attributes allowed on ANY tag (global). */
    private const ALLOWED_ATTRS_GLOBAL = ['class', 'title'];

    /** Attributes allowed only on specific tags. */
    private const ALLOWED_ATTRS_BY_TAG = [
        'a'   => ['href', 'target', 'rel'],
        'img' => ['src', 'alt', 'width', 'height'],
    ];

    /** URI schemes allowed in href/src attributes. */
    private const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel'];

    /** Data URIs allowed (for inline images only). */
    private const ALLOWED_DATA_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

    /**
     * Sanitize HTML. Returns the cleaned HTML fragment.
     * Safe to store in the database and render with dangerouslySetInnerHTML
     * (still recommended to re-sanitize on the client as defense-in-depth).
     */
    public static function clean(?string $html): string {
        if ($html === null || $html === '') return '';
        // Hard-cap to prevent resource exhaustion on pathological inputs.
        if (strlen($html) > 500_000) {
            $html = substr($html, 0, 500_000);
        }

        // Pre-strip obviously dangerous content before DOM parse (belt-and-suspenders).
        // These patterns can confuse DOMDocument with embedded HTML in CDATA, etc.
        $html = preg_replace('#<\?[^>]*\?>#', '', $html) ?? $html;         // PHP tags
        $html = preg_replace('#<!\[CDATA\[[\s\S]*?\]\]>#i', '', $html) ?? $html;
        $html = preg_replace('#<!--[\s\S]*?-->#', '', $html) ?? $html;      // comments

        // libxml requires a root element and UTF-8 declaration to parse HTML fragments.
        $wrapped = '<?xml encoding="UTF-8"?><!DOCTYPE html><html><body>' . $html . '</body></html>';

        $dom = new DOMDocument('1.0', 'UTF-8');
        $dom->substituteEntities = false;
        $dom->resolveExternals = false;

        // Suppress parse warnings from malformed admin HTML.
        $prev = libxml_use_internal_errors(true);
        $ok = @$dom->loadHTML($wrapped, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING | LIBXML_NOBLANKS);
        libxml_clear_errors();
        libxml_use_internal_errors($prev);

        if (!$ok) return '';

        $body = $dom->getElementsByTagName('body')->item(0);
        if (!$body) return '';

        self::cleanNode($body);

        // Serialize children of <body> (not the body tag itself).
        $out = '';
        foreach ($body->childNodes as $child) {
            $out .= $dom->saveHTML($child);
        }

        // Collapse any lingering whitespace-only runs.
        return trim($out);
    }

    /**
     * Recursively walk the DOM, removing disallowed tags/attributes.
     */
    private static function cleanNode(DOMNode $node): void {
        // Walk children backwards so removals don't invalidate indices.
        $children = iterator_to_array($node->childNodes);
        foreach ($children as $child) {
            if ($child instanceof DOMElement) {
                $tag = strtolower($child->tagName);

                // Drop disallowed tags entirely (children are also discarded —
                // safer than "unwrap" for unknown elements).
                if (!in_array($tag, self::ALLOWED_TAGS, true)) {
                    $child->parentNode?->removeChild($child);
                    continue;
                }

                // Strip disallowed attributes.
                self::cleanAttributes($child, $tag);

                // Recurse into children.
                self::cleanNode($child);
            } elseif ($child instanceof DOMComment || $child instanceof DOMProcessingInstruction) {
                // Always remove comments and PIs.
                $child->parentNode?->removeChild($child);
            }
            // DOMText nodes stay as-is (libxml entity-encodes them safely on output).
        }
    }

    /**
     * Strip disallowed attributes and sanitize URI-bearing attrs.
     */
    private static function cleanAttributes(DOMElement $el, string $tag): void {
        $allowed = array_merge(
            self::ALLOWED_ATTRS_GLOBAL,
            self::ALLOWED_ATTRS_BY_TAG[$tag] ?? []
        );

        // Copy attribute names first so we can safely remove during iteration.
        $attrNames = [];
        foreach ($el->attributes as $attr) {
            $attrNames[] = $attr->name;
        }

        foreach ($attrNames as $name) {
            $lower = strtolower($name);
            if (!in_array($lower, $allowed, true)) {
                $el->removeAttribute($name);
                continue;
            }

            $value = $el->getAttribute($name);

            // Validate URI-bearing attributes.
            if ($lower === 'href' || $lower === 'src') {
                if (!self::isSafeUri($value)) {
                    $el->removeAttribute($name);
                    continue;
                }
            }

            // target=_blank → force rel="noopener noreferrer nofollow"
            if ($tag === 'a' && $lower === 'target' && strtolower($value) === '_blank') {
                $el->setAttribute('rel', 'noopener noreferrer nofollow ugc');
            }

            // Constrain target to safe values.
            if ($lower === 'target' && !in_array(strtolower($value), ['_blank', '_self'], true)) {
                $el->removeAttribute($name);
            }
        }

        // If <a> has no href, drop the tag's link-ness (becomes a span-ish anchor).
        if ($tag === 'a' && !$el->hasAttribute('href')) {
            $el->setAttribute('href', '#');
        }
    }

    /**
     * Validate a URI against the scheme allowlist.
     * Relative/anchor URLs are allowed.
     */
    private static function isSafeUri(string $uri): bool {
        $uri = trim($uri);
        if ($uri === '') return false;

        // Decode HTML entities once (catches &#106;avascript: bypass).
        $decoded = html_entity_decode($uri, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        // Also strip null bytes and control chars that attackers use to fool parsers.
        $decoded = preg_replace('/[\x00-\x1F\x7F]/', '', $decoded) ?? $decoded;

        // Relative / anchor / query-only URIs are safe.
        if ($decoded[0] === '#' || $decoded[0] === '/' || $decoded[0] === '?') return true;
        if (!str_contains($decoded, ':')) return true;

        // Has a scheme — enforce allowlist.
        $colonPos = strpos($decoded, ':');
        $scheme = strtolower(substr($decoded, 0, $colonPos));

        if ($scheme === 'data') {
            // Only whitelisted image MIME types allowed in data: URIs.
            foreach (self::ALLOWED_DATA_MIMES as $mime) {
                if (stripos($decoded, 'data:' . $mime) === 0) return true;
            }
            return false;
        }

        return in_array($scheme, self::ALLOWED_SCHEMES, true);
    }
}

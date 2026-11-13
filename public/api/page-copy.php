<?php
/**
 * Texto de About y Contacto (y del noscript del home) para el HTML que sirve
 * page-prerender.php, en los dos idiomas.
 *
 * Esas páginas salían con ~30 palabras en el HTML: el texto de verdad solo
 * existía después de que corre la SPA. La bio NO se escribe aquí: About y el
 * home toman los párrafos del About del CMS (about_content), así que lo que
 * Oscar edite allá es lo que lee Google. Aquí solo va lo de estructura
 * (cómo contactar, servicios, enlaces).
 */

declare(strict_types = 1);

require_once __DIR__ . '/seo-shell.php';

final class PageCopy
{
    private const H2 = 'font-size:1.15rem;line-height:1.3;margin:32px 0 8px;';
    private const P = 'margin:0 0 14px;color:#b9b4c9;';

    private static function a(string $path, string $label, bool $isEs): string
    {
        return '<a href="' . SeoShell::attr(SeoShell::localUrl($path, $isEs)) . '" style="color:#e8e6f0;">'
            . SeoShell::attr($label) . '</a>';
    }

    private static function ext(string $url, string $label): string
    {
        return '<a href="' . SeoShell::attr($url) . '" rel="me noopener" style="color:#e8e6f0;">'
            . SeoShell::attr($label) . '</a>';
    }

    private static function h2(string $t): string
    {
        return '<h2 style="' . self::H2 . '">' . SeoShell::attr($t) . '</h2>';
    }

    /** $html ya viene armado (puede llevar enlaces). */
    private static function p(string $html): string
    {
        return '<p style="' . self::P . '">' . $html . '</p>';
    }

    private static function ul(array $items): string
    {
        $out = '<ul style="margin:0 0 14px;padding:0 0 0 20px;color:#b9b4c9;">';
        foreach ($items as $it)
            $out .= '<li style="margin:0 0 6px;">' . $it . '</li>';
        return $out . '</ul>';
    }

    private static function services(bool $isEs): string
    {
        return self::ul($isEs ? [
            'Identidad de marca y dirección creativa',
            'Diseño gráfico',
            'Arte 3D y diseño de personajes, animación y motion graphics',
            'Diseño web y desarrollo frontend con React, Three.js y WebGL',
            'Art toys y piezas de colección con edición física',
        ] : [
            'Brand identity and creative direction',
            'Graphic design',
            '3D art and character design, animation and motion graphics',
            'Web design and frontend development with React, Three.js and WebGL',
            'Art toys and collectibles with physical editions',
        ]);
    }

    private static function social(): string
    {
        return self::ext('https://www.instagram.com/skulleyrad', 'Instagram @skulleyrad') . ' · '
            . self::ext('https://x.com/mroscareth', 'X @mroscareth') . ' · '
            . self::ext('https://www.behance.net/mroscar', 'Behance');
    }

    /**
     * Los párrafos del About del CMS (about_content), tal cual se guardaron:
     * el CMS es la fuente, así que aquí no se escribe la bio. Ya pasaron por
     * HtmlSanitizer al guardarse (about.php). $paragraphs: ['p1' => html, ...]
     */
    private static function cmsParagraphs(array $paragraphs): string
    {
        ksort($paragraphs, SORT_NATURAL);
        $out = '';
        foreach ($paragraphs as $html) {
            $html = trim((string) $html);
            if ($html !== '')
                $out .= '<div style="' . self::P . '">' . $html . '</div>';
        }
        return $out;
    }

    /** $projects: [['slug' => ..., 'title' => ...], ...] */
    private static function projectList(bool $isEs, array $projects): string
    {
        $list = [];
        foreach ($projects as $p) {
            if (!empty($p['slug']))
                $list[] = self::a('work/' . $p['slug'], (string) $p['title'], $isEs);
        }
        return $list ? self::h2($isEs ? 'Proyectos' : 'Projects') . self::ul($list) : '';
    }

    public static function about(bool $isEs, array $paragraphs, array $projects): string
    {
        $a = fn(string $path, string $label) => self::a($path, $label, $isEs);
        return self::cmsParagraphs($paragraphs)
            . self::projectList($isEs, $projects)
            . self::p($isEs
                ? 'Puedes ' . $a('work', 'ver mi trabajo') . ' o, si tienes un proyecto en mente, ' . $a('contact', 'escribirme') . '.'
                : 'You can ' . $a('work', 'see my work') . ' or, if you have a project in mind, ' . $a('contact', 'write to me') . '.');
    }

    public static function contact(bool $isEs): string
    {
        $a = fn(string $path, string $label) => self::a($path, $label, $isEs);
        $mail = '<a href="mailto:hola@skulleyrad.com" style="color:#e8e6f0;">hola@skulleyrad.com</a>';

        if ($isEs) {
            return self::p('Estoy disponible para proyectos de marca, 3D e interactivos con marcas y agencias. Trabajo desde Monterrey, México, con clientes de cualquier parte, en español y en inglés.')
                . self::h2('Cómo escribirme')
                . self::p('Usa el formulario de esta página: tu nombre, tu correo y de qué quieres hablar (trabajar juntos, una colaboración, la tiendita o un pedido, u otra cosa). Te responderé lo más rápido que pueda.')
                . self::h2('En qué te puedo ayudar')
                . self::services(true)
                . self::p('Antes de escribir puedes ' . $a('work', 'ver mi trabajo') . ' o ' . $a('about', 'saber más de mí') . '.')
                . self::h2('Pedidos de la tiendita')
                . self::p('Si es sobre un pedido, incluye su número (por ejemplo SR-1008). Envíos, cancelaciones y devoluciones están en la ' . $a('help', 'página de ayuda') . ', y también puedes escribir a ' . $mail . '.')
                . self::h2('En redes')
                . self::p(self::social());
        }

        return self::p('I’m available for brand, 3D and interactive projects with brands and agencies. I work from Monterrey, Mexico, with clients anywhere, in English and Spanish.')
            . self::h2('How to reach me')
            . self::p('Use the form on this page: your name, your email and what you want to talk about (working together, a collaboration, the store or an order, or something else). I’ll get back to you as soon as I can.')
            . self::h2('What I can help with')
            . self::services(false)
            . self::p('Before writing, you can ' . $a('work', 'see my work') . ' or ' . $a('about', 'read more about me') . '.')
            . self::h2('Store orders')
            . self::p('If it’s about an order, include its number (for example SR-1008). Shipping, cancellations and returns are on the ' . $a('help', 'help page') . ', and you can also write to ' . $mail . '.')
            . self::h2('Elsewhere')
            . self::p(self::social());
    }

    /**
     * El noscript del home, en el idioma de la página. El home NO lleva texto
     * visible antes de la SPA (el preloader es la entrada del sitio y un
     * destello de texto la arruinaría); quien no ejecuta JavaScript lee esto.
     * $projects: [['slug' => ..., 'title' => ...], ...]
     */
    public static function homeNoscript(bool $isEs, array $paragraphs, array $projects): string
    {
        $a = fn(string $path, string $label) => self::a($path, $label, $isEs);
        return '<div style="max-width:760px;margin:0 auto;padding:48px 24px;color:#e8e6f0;background:#06060d;font-family:system-ui,-apple-system,sans-serif;line-height:1.7;">'
            . '<h1 style="font-size:2rem;line-height:1.2;margin:0 0 12px;">Oscar Moctezuma Rodriguez — '
            . ($isEs ? 'diseñador gráfico, ilustrador y artista 3D' : 'graphic designer, illustrator and 3D artist') . '</h1>'
            . self::cmsParagraphs($paragraphs)
            . self::projectList($isEs, $projects)
            . self::h2($isEs ? 'En el sitio' : 'On this site')
            . self::p(implode(' · ', [
                $a('work', $isEs ? 'Trabajo' : 'Work'),
                $a('about', $isEs ? 'Sobre mí' : 'About'),
                $a('blog', $isEs ? 'Memorias' : 'Memories'),
                $a('lost-and-found-shop', $isEs ? 'Tiendita' : 'Store'),
                $a('contact', $isEs ? 'Contacto' : 'Contact'),
            ]))
            . self::p(self::social())
            . '</div>';
    }
}

<?php
/**
 * Texto de About y Contacto (y del noscript del home) para el HTML que sirve
 * page-prerender.php, en los dos idiomas.
 *
 * Esas páginas salían con ~30 palabras en el HTML: el texto de verdad solo
 * existía después de que corre la SPA. Aquí va en primera persona, como el
 * About del sitio, y SOLO con hechos que el sitio ya publica (About de la
 * SPA en LanguageContext, el JSON-LD y el noscript de index.html). Si cambia
 * la bio allá, cambia aquí también.
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

    public static function about(bool $isEs): string
    {
        $a = fn(string $path, string $label) => self::a($path, $label, $isEs);

        if ($isEs) {
            return self::p('Soy Oscar Moctezuma Rodríguez, diseñador creativo, desarrollador frontend y artista 3D en Monterrey, México. Mi trabajo vive donde se juntan la narrativa, el diseño y la tecnología: identidades de marca, personajes 3D, art toys y sitios interactivos como este.')
                . self::p('Skulley Rad es el nombre de mi ' . $a('lost-and-found-shop', 'tiendita') . ' y el personaje que manejas en este sitio.')
                . self::h2('Estudio y clientes')
                . self::p('Con mi hermano fundé ' . $a('work/heritage', 'The Heritage Design') . ', un estudio que ha trabajado con marcas como Valve, Koto Studio y Pinturas Berel, entre otras.')
                . self::h2('Reconocimientos')
                . self::p('Los curadores de Behance eligieron dos de mis proyectos, ' . $a('work/3d-heads', '3D Heads') . ' y ' . $a('work/2dheads', '2D Heads') . ', para la galería Best of Behance, y cinco han aparecido en sus galerías de 3D Art, Illustration y Photoshop.')
                . self::h2('Arte, blockchain y art toys')
                . self::p($a('work/ethereans', 'The Ethereans') . ' es una colección de arte 3D con ediciones físicas impresas en 3D, y ' . $a('work/arttoys', 'The Voxels') . ' es una serie de art toys hecha con Iconic Design Objects, de Países Bajos.')
                . self::h2('Otros proyectos')
                . self::p('Soy cofundador de Ethereum Monterrey, Rancho Stake, Paisano DAO y Apefur, y estoy ayudando a construir Hiv3, la primera tesorería digital privada de México.')
                . self::h2('En qué te puedo ayudar')
                . self::services(true)
                . self::p('Trabajo con marcas y agencias de cualquier parte, en español y en inglés. Puedes ' . $a('work', 'ver mi trabajo') . ' o, si tienes un proyecto en mente, ' . $a('contact', 'escribirme') . '.');
        }

        return self::p('I’m Oscar Moctezuma Rodríguez, a creative designer, frontend developer and 3D artist working from Monterrey, Mexico. My work lives where storytelling, design and technology meet: brand identities, 3D characters, art toys and interactive websites like this one.')
            . self::p('Skulley Rad is the name of my ' . $a('lost-and-found-shop', 'store') . ' and the character you play on this site.')
            . self::h2('Studio and clients')
            . self::p('Together with my brother I co-founded ' . $a('work/heritage', 'The Heritage Design') . ', a studio that has worked with brands like Valve, Koto Studio and Pinturas Berel, among others.')
            . self::h2('Recognition')
            . self::p('Behance’s curators picked two of my projects, ' . $a('work/3d-heads', '3D Heads') . ' and ' . $a('work/2dheads', '2D Heads') . ', for the Best of Behance gallery, and five have been featured in its 3D Art, Illustration and Photoshop galleries.')
            . self::h2('Art, blockchain and art toys')
            . self::p($a('work/ethereans', 'The Ethereans') . ' is a 3D art collection with physical 3D-printed editions, and ' . $a('work/arttoys', 'The Voxels') . ' is an art-toy series made with Iconic Design Objects, from the Netherlands.')
            . self::h2('Other projects')
            . self::p('I’m a co-founder of Ethereum Monterrey, Rancho Stake, Paisano DAO and Apefur, and I’m helping build Hiv3, the first private digital treasury from Mexico.')
            . self::h2('What I can help with')
            . self::services(false)
            . self::p('I work with brands and agencies anywhere, in English and Spanish. You can ' . $a('work', 'see my work') . ' or, if you have a project in mind, ' . $a('contact', 'write to me') . '.');
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
    public static function homeNoscript(bool $isEs, array $projects): string
    {
        $a = fn(string $path, string $label) => self::a($path, $label, $isEs);
        $list = [];
        foreach ($projects as $p)
            $list[] = $a('work/' . $p['slug'], (string) $p['title']);

        $out = '<div style="max-width:760px;margin:0 auto;padding:48px 24px;color:#e8e6f0;background:#06060d;font-family:system-ui,-apple-system,sans-serif;line-height:1.7;">'
            . '<h1 style="font-size:2rem;line-height:1.2;margin:0 0 12px;">Oscar Moctezuma Rodriguez</h1>'
            . self::about($isEs);
        if ($list) {
            $out .= self::h2($isEs ? 'Proyectos' : 'Projects') . self::ul($list);
        }
        $out .= self::h2($isEs ? 'En el sitio' : 'On this site')
            . self::p(implode(' · ', [
                $a('work', $isEs ? 'Trabajo' : 'Work'),
                $a('about', $isEs ? 'Sobre mí' : 'About'),
                $a('blog', $isEs ? 'Memorias' : 'Memories'),
                $a('lost-and-found-shop', $isEs ? 'Tiendita' : 'Store'),
                $a('contact', $isEs ? 'Contacto' : 'Contact'),
            ]))
            . self::p(self::social());
        return $out . '</div>';
    }
}

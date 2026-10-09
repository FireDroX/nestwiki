import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { MarkdownRenderer } from './MarkdownRenderer'

describe('MarkdownRenderer', () => {
  describe('restricted mode (default)', () => {
    it('strips an unknown custom tag', () => {
      const { container } = render(<MarkdownRenderer content="<mon-widget>hi</mon-widget>" />)
      expect(container.querySelector('mon-widget')).toBeNull()
      expect(container).toHaveTextContent('hi')
    })

    it('strips a style attribute', () => {
      const { container } = render(
        <MarkdownRenderer content='<div style="color:red">hi</div>' />,
      )
      expect(container.querySelector('[style]')).toBeNull()
      expect(container).toHaveTextContent('hi')
    })

    it('still renders the api-reference custom element', () => {
      const { container } = render(<MarkdownRenderer content="<api-reference></api-reference>" />)
      expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull()
    })
  })

  describe('full mode', () => {
    it('keeps an unknown custom tag', () => {
      const { container } = render(
        <MarkdownRenderer content="<mon-widget>hi</mon-widget>" mode="full" />,
      )
      expect(container.querySelector('mon-widget')).not.toBeNull()
    })

    it('strips script, iframe, object, embed, form, and base tags, including nested ones', () => {
      const content = [
        '<script>window.x = 1</script>',
        '',
        '<iframe src="//x"></iframe>',
        '',
        '<object data="//x"></object>',
        '',
        '<embed src="//x" />',
        '',
        '<form></form>',
        '',
        '<base href="//evil.example/" />',
        '',
        '<link rel="stylesheet" href="//evil.example/x.css" />',
        '',
        '<meta http-equiv="refresh" content="0;url=//evil.example" />',
        '',
        '<div><iframe src="//nested"></iframe></div>',
      ].join('\n')
      const { container } = render(<MarkdownRenderer content={content} mode="full" />)
      expect(container.querySelector('script')).toBeNull()
      expect(container.querySelector('iframe')).toBeNull()
      expect(container.querySelector('object')).toBeNull()
      expect(container.querySelector('embed')).toBeNull()
      expect(container.querySelector('form')).toBeNull()
      expect(container.querySelector('base')).toBeNull()
      expect(container.querySelector('link')).toBeNull()
      expect(container.querySelector('meta')).toBeNull()
    })

    it('renders the element with the on* attribute (proof the plugin ran; see markdown-sanitize.test.ts for the actual removal assertion)', () => {
      const { container } = render(
        <MarkdownRenderer content='<div onclick="evil()">hi</div>' mode="full" />,
      )
      expect(container.querySelector('div')).not.toBeNull()
      expect(container).toHaveTextContent('hi')
    })

    it('neutralizes a javascript: href', () => {
      const { container } = render(
        <MarkdownRenderer content='<a href="javascript:alert(1)">click</a>' mode="full" />,
      )
      expect(container.querySelector('a')?.getAttribute('href')).toBeNull()
    })

    it('keeps the style attribute and custom data attributes untouched', () => {
      const { container } = render(
        <MarkdownRenderer content='<div style="color:red" data-x="1">hi</div>' mode="full" />,
      )
      const div = container.querySelector('div[data-x="1"]')
      expect(div).not.toBeNull()
      expect(div?.getAttribute('style')).toBe('color: red;')
    })

    it('scopes a <style> block to the rendered content root', () => {
      const { container } = render(
        <MarkdownRenderer content={'<style>p { color: red }</style>\n\nhello'} mode="full" />,
      )
      const style = container.querySelector('style')
      const rootId = container.firstElementChild?.getAttribute('id')
      expect(rootId).toBeTruthy()
      expect(style?.textContent).toContain(`@scope ([id="${rootId}"])`)
      expect(style?.textContent).toContain('p { color: red }')
    })

    it('strips @import rules from a <style> block', () => {
      const { container } = render(
        <MarkdownRenderer
          content={'<style>@import url(http://evil.example/x.css);\np { color: red }</style>'}
          mode="full"
        />,
      )
      expect(container.querySelector('style')?.textContent).not.toContain('@import')
    })

    it('strips a javascript: url() from a <style> block', () => {
      const { container } = render(
        <MarkdownRenderer
          content={'<style>p { background: url(javascript:alert(1)) }</style>'}
          mode="full"
        />,
      )
      expect(container.querySelector('style')?.textContent).not.toContain('javascript:')
    })

    it('does not crash on an empty style block', () => {
      const { container } = render(
        <MarkdownRenderer content={'<style></style>\n\nhello'} mode="full" />,
      )
      expect(container.querySelector('style')).not.toBeNull()
    })

    it('scopes multiple style blocks to the same root id', () => {
      const { container } = render(
        <MarkdownRenderer
          content={'<style>p { color: red }</style>\n\n<style>a { color: blue }</style>'}
          mode="full"
        />,
      )
      const styles = container.querySelectorAll('style')
      const rootId = container.firstElementChild?.getAttribute('id')
      expect(styles).toHaveLength(2)
      styles.forEach((style) => {
        expect(style.textContent).toContain(`[id="${rootId}"]`)
      })
    })

    it('drops the entire style block when braces are unbalanced (scope bypass exploit)', () => {
      const { container } = render(
        <MarkdownRenderer
          content={'<style>} body { background: red } p {</style>'}
          mode="full"
        />,
      )
      const style = container.querySelector('style')
      expect(style?.textContent).not.toContain('background: red')
    })

    it('drops a style block where an unterminated string hides an unbalanced brace', () => {
      const { container } = render(
        <MarkdownRenderer
          content={'<style>p { content: "\nbroken } body { background: red } p {" }</style>\n\nhello'}
          mode="full"
        />,
      )
      expect(container.querySelector('style')?.textContent).not.toContain('background: red')
    })
  })

  describe('LaTeX (full mode only)', () => {
    it('renders inline math with $$...$$', () => {
      const { container } = render(<MarkdownRenderer content="Euler: $$x^2$$" mode="full" />)
      expect(container.querySelector('.katex')).not.toBeNull()
    })

    it('renders block math with $$...$$ alone on its own paragraph', () => {
      const { container } = render(
        <MarkdownRenderer content={'$$\\int_0^1 f(x)dx$$'} mode="full" />,
      )
      expect(container.querySelector('.katex')).not.toBeNull()
    })

    it('does not render single-$ math (disabled via singleDollarTextMath: false)', () => {
      const { container } = render(<MarkdownRenderer content="Euler: $x^2$" mode="full" />)
      expect(container.querySelector('.katex')).toBeNull()
      expect(container).toHaveTextContent('Euler: $x^2$')
    })

    it('does not render math in restricted mode', () => {
      const { container } = render(<MarkdownRenderer content="Euler: $$x^2$$" />)
      expect(container.querySelector('.katex')).toBeNull()
      expect(container).toHaveTextContent('$$x^2$$')
    })

    it('does not treat two dollar signs in a price/shell-variable sentence as math', () => {
      const { container } = render(
        <MarkdownRenderer content="Ça coûte 5 $ ou 10 $ par mois." mode="full" />,
      )
      expect(container.querySelector('.katex')).toBeNull()
      expect(container).toHaveTextContent('Ça coûte 5 $ ou 10 $ par mois.')
    })

    it('does not render math inside a code block', () => {
      const { container } = render(
        <MarkdownRenderer content={'```\n$$x^2$$\n```'} mode="full" />,
      )
      expect(container.querySelector('.katex')).toBeNull()
    })
  })

  describe('preformatted text', () => {
    it('keeps a fenced code block without language inside a <pre>', () => {
      const { container } = render(<MarkdownRenderer content={'```\nline1\nline2\n```'} mode="full" />)
      expect(container.querySelector('pre > code')).toHaveTextContent('line1 line2')
    })

    it('keeps a raw HTML <pre> block', () => {
      const { container } = render(<MarkdownRenderer content={'<pre>a\nb</pre>'} mode="full" />)
      expect(container.querySelector('pre')?.textContent).toBe('a\nb')
    })

    it('does not wrap block math in a <pre>', () => {
      const { container } = render(<MarkdownRenderer content={'$$\nx^2\n$$'} mode="full" />)
      expect(container.querySelector('.katex')).not.toBeNull()
      expect(container.querySelector('pre')).toBeNull()
    })
  })

  describe('heading anchors', () => {
    it('gives each heading an id derived from its text, with a link to it', () => {
      const { container } = render(
        <MarkdownRenderer content={'# Guide de démarrage\n\n## Installation'} mode="full" />,
      )
      const heading = container.querySelector('h1')
      expect(heading?.id).toBe('guide-de-démarrage')
      expect(heading?.querySelector('a')?.getAttribute('href')).toBe('#guide-de-démarrage')
      expect(heading?.querySelector('a')).toHaveAccessibleName('Lien vers cette section')
      expect(container.querySelector('h2')?.id).toBe('installation')
    })

    it('suffixes duplicate headings', () => {
      const { container } = render(
        <MarkdownRenderer content={'## Exemple\n\n## Exemple'} mode="full" />,
      )
      const ids = Array.from(container.querySelectorAll('h2')).map((heading) => heading.id)
      expect(ids).toEqual(['exemple', 'exemple-1'])
    })

    it('keeps an id written by hand in raw HTML', () => {
      const { container } = render(
        <MarkdownRenderer content={'<h2 id="perso">Titre</h2>\n\n## Perso'} mode="full" />,
      )
      const ids = Array.from(container.querySelectorAll('h2')).map((heading) => heading.id)
      expect(ids).toEqual(['perso', 'perso-1'])
    })

    it('does not add ids or anchor links in restricted mode', () => {
      const { container } = render(<MarkdownRenderer content="## Installation" />)
      expect(container.querySelector('h2')?.id).toBe('')
      expect(container.querySelector('h2 a')).toBeNull()
    })
  })

  describe('callouts', () => {
    it.each([
      ['NOTE', 'note', 'Remarque'],
      ['TIP', 'tip', 'Astuce'],
      ['IMPORTANT', 'important', 'Important'],
      ['WARNING', 'warning', 'Attention'],
      ['CAUTION', 'caution', 'Danger'],
    ])('renders a [!%s] blockquote as a %s callout', (marker, type, title) => {
      const { container } = render(
        <MarkdownRenderer content={`> [!${marker}]\n> Contenu`} mode="full" />,
      )
      const callout = container.querySelector(`[data-callout="${type}"]`)
      expect(callout).not.toBeNull()
      expect(callout).toHaveTextContent(title)
      expect(callout).toHaveTextContent('Contenu')
      expect(callout).not.toHaveTextContent('[!')
      expect(container.querySelector('blockquote')).toBeNull()
    })

    it('accepts a lowercase marker', () => {
      const { container } = render(<MarkdownRenderer content={'> [!tip]\n> Contenu'} mode="full" />)
      expect(container.querySelector('[data-callout="tip"]')).not.toBeNull()
    })

    it('uses the text after the marker as a custom title', () => {
      const { container } = render(
        <MarkdownRenderer content={'> [!WARNING] Migration requise\n> Lancez les migrations.'} mode="full" />,
      )
      const callout = container.querySelector('[data-callout="warning"]')
      expect(callout).toHaveTextContent('Migration requise')
      expect(callout).not.toHaveTextContent('Attention')
      expect(callout).toHaveTextContent('Lancez les migrations.')
    })

    it('keeps every paragraph of a multi-paragraph callout', () => {
      const { container } = render(
        <MarkdownRenderer content={'> [!NOTE]\n>\n> Premier\n>\n> Second'} mode="full" />,
      )
      const paragraphs = container.querySelectorAll('[data-callout="note"] > p')
      expect(paragraphs).toHaveLength(3)
      expect(paragraphs[1]).toHaveTextContent('Premier')
      expect(paragraphs[2]).toHaveTextContent('Second')
    })

    it('leaves a blockquote with an unknown marker untouched', () => {
      const { container } = render(<MarkdownRenderer content={'> [!FOO]\n> Contenu'} mode="full" />)
      expect(container.querySelector('[data-callout]')).toBeNull()
      expect(container.querySelector('blockquote')).toHaveTextContent('[!FOO]')
    })

    it('leaves a regular blockquote untouched', () => {
      const { container } = render(<MarkdownRenderer content="> Une citation" mode="full" />)
      expect(container.querySelector('blockquote')).toHaveTextContent('Une citation')
    })

    it('renders callouts in restricted mode too', () => {
      const { container } = render(<MarkdownRenderer content={'> [!CAUTION]\n> Contenu'} />)
      expect(container.querySelector('[data-callout="caution"]')).toHaveTextContent('Danger')
    })

    it('does not let restricted mode forge a callout with raw HTML', () => {
      const { container } = render(
        <MarkdownRenderer content='<wiki-callout data-callout-type="note">x</wiki-callout>' />,
      )
      expect(container.querySelector('[data-callout]')).toBeNull()
    })
  })
})

/*-*- js-indent-level: 2 -*-*/
/*jshint esversion: 9, asi: true, strict: true, browser: true, jquery: true,
  devel: false */
/*global baremark */

// Remove 'Javascript missing.' warning.
document.documentElement.id = 'js'

function escapeHtml(text) {
  'use strict'
  return text.replace(/["&<>]/g, a => (
    { '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' }[a]
  ))
}

function walkTheDOM(e, func) {
  'use strict'
  func(e)
  e = e.firstChild
  while (e) {
    walkTheDOM(e, func)
    e = e.nextSibling
  }
}

// Traverse a set of jQuery elements recursively, inserting '<wbr>' after '/'
// in text nodes if the word after '/' is five letters or longer (this
// limitation is mostly to not break 'him/her/it/them' combinations, which, if
// it occurs in the first cell of a table in TKD, looks really ugly since line
// breaks are forced there).
function insertOptionalBreakAfterSlash($, $e) {
  'use strict'
  $e.each((_, e) => {
    walkTheDOM(e, e => {
      if (e.nodeType === 3) {
        const text = e.data
        const html = text.replace(/\/(?=\w{5,})/g, '/<wbr>')
        if (html !== text) {
          $(e).replaceWith(html)
        }
      }
    })
  })
}

// Move all 'id' found inside <a id=...> tags to its parent element (removing
// the <a> tag). This will only happen if a) the parent element does not
// already have an 'id' attribute set, b) the <a> tag occurs first inside the
// parent (i.e. not even text can precede it) and c) the <a> tag has no content
// of its own (e.g. <a..>CONTENT</a>). If these criteria are not met, then the
// <a> tag will be left unmodified.
function insertIdIntoParentElement($) {
  'use strict'
  $('a[id]:empty:first-child')                     // find <a> tags
    .filter((_, e) => e.previousSibling === null)  //   not preceded by text
    .each((_, e) => {
      const $e = $(e)
      const $parent = $(e.parentElement)
      const id = $e.attr('id') || ''
      if (!$parent.attr('id') &&                   // if parent 'id' is unset
          !id.match(/^[a-z]+=\d+$/)) {             //   and isn't WORD=NUM
        $parent.attr('id', $e.remove().attr('id'))
      }
    })
}

// This will replace any occurrence of the tag '<toc>' with a nested unordered
// list containing a table of contents for the document with links to the
// relevant headings. The outermost <ul> tag in the newly generated table of
// content will have 'class=toc' set, and any attributes specified in the
// '<toc>' tag will also be copied over.
//
// <h#> tags that have the class 'title' will not be included in the
// table-of-contents.
function insertTableOfContent($) {
  'use strict'
  const $toc = $('toc')
  if ($toc.length === 0) { return }            // abort if <toc> not found

  const tocAttrs = $.map(
    $toc.prop('attributes'),
    x => ` ${x.name}` +
      (x.value === undefined ? '' : `="${escapeHtml(x.value)}"`)
  ).join('')

  // Create ToC item from '<h#>...</h#>' element.
  function tocItem($h) {
    const $i = $h.clone()
    $i.find('a').replaceWith(                  // strip <a> tags,
      () => $(this).contents())                //    but keep their content
    $i.find('[id],[name]').replaceWith(        // strip 'id' and 'name' attr
      () => $(this).removeAttr('id').removeAttr('name'))
    return $i.html()
  }
  let level = 0
  let html = ''
  $('h1,h2,h3,h4,h5,h6,h7').each((_, h) => {
    const $h = $(h)
    if ($h.attr('title') === '' ||      // skip if 'title' or 'notoc'
        $h.closest('[notoc]').length || // attribute or 'id=toc'
        $h.attr('id') === 'toc') {      //   is used
      return
    }
    const num = $h.prop('tagName').match(/\d$/)[0]
    if (!level) { level = num }
    if (num > level) {
      html += (new Array(num - level + 1)).join('<ul>\n')
    } else if (num < level) {
      html += (new Array(level - num + 1)).join('</ul>\n')
    }
    level = num
    html += `<li class="h${num}"><a href="#${$h.attr('id')}">${tocItem($h)}</a>\n`
  })
  $toc.replaceWith(`<ul class=toc hanging${tocAttrs}>${html}</ul>`)
}

/******************************************************************************/

import('./jquery-3.7.1.slim.js').then(() => {
  afterjQueryLoad()
})

function afterjQueryLoad() {
  'use strict'
  // jQuery .reduce() plugin (from https://bugs.jquery.com/ticket/1886)
  jQuery.fn.reduce = [].reduce

  $('head').append('<meta name="viewport" content="width=device-width,initial-scale=1">')

  $('html').attr('lang', 'en')                 // set document language
  if (location.search.match(/\bDEBUG\b/i)) {   // set 'class=DEBUG'
    $('html').addClass('DEBUG')
  }
  import(`./baremark.js`).then(() => {
    baremark().unshift(
      [/<!--.*?-->/gs, ''],                               // strip <!--..-->
      [/\^([^^\n]+)\^/g, '<sup>$1</sup>'],                        // ^...^
      // [#...] -> <a id="..."></a>. IDs must not contain space, nor any of
      // '.:[]' (colon and period interferes with CSS styling). Note: Spaces
      // and tabs following the tag are also stripped, but not newline (as this
      // can cause a mess inside tables). If you put a [#...] in a paragraph of
      // its own you'll get an empty paragraph with a single <a> tag in it!)
      [/\[#([^.:\[\]\s]+)\][\t ]*/g, '<a id="$1"></a>'],        // [#id]
      //[/(?<!\]\()\b[a-z]+:\/\/[^ \n<>]*[^,;:.?!"'\)\]}<> \n]/gi,x =>     // autolink URL
      [/(?<!\]\(|\]: +)\b[a-z]+:\/\/[^ \n<>]*[^,;:.?!"'\)\]}<> \n]/gi,x =>     // autolink URL
        `<a href="${baremark.escape(x)}">${baremark.escape(x)}</a>`],
      [/\n\n\|(\n?(.+\n)*.*?)(?=\n\n)/g, x =>
        '<table>' + x.trim().split('\n').map(x =>
          '<tr>' + x.split(/\s*\|\s*/).map((x, i, a) =>
            (i&&i<a.length-1||x)?`<td>${x}</td>`:'').join('') + '</tr>\n'
        ).join('') + '</table>\n\n'],
    )
    main(jQuery)
  })
}

/******************************************************************************/

function asciify(txt) {
  'use strict'
  return txt
    .normalize('NFD')                         // turn accents into own chars
    .replace(/[^a-z0-9\n\r\u0020\-]/gui, '')  // strip off non A-Z, space or hyphen
    .replace(/\s+/gu, '-')
    .toLowerCase()
}

/******************************************************************************/

function main($) {
  'use strict'
  const $elem = $('textarea[disabled]:first')
  const markdown = $elem[0].value ?? ''

  // Baremark rule for reading header style metadata. Processes first paragraph
  // as metadata if (and only if) it looks like an email headers (e.g. 'Author:
  // <name>'). After `baremark()` cal `baremarkHeaders.get()` to get object
  // with metadata values.
  const baremarkHeaders = (head => Object.assign(
    [/^(\n*)((\w+:.*\n)+)\n+/, (_, nl, txt) => {
      head = {}
      txt.split(/^/m).forEach(x => {
        const [_, name, value] = /^(\w+):\s*(.*)\n/.exec(x)
        head[name.toLowerCase()] = value
      })
      return nl
    }], { get: () => head }
  ))()

  baremark().unshift(baremarkHeaders)
  const html = baremark(markdown)
  const head = baremarkHeaders.get()

  const cred = [head.author, head.date].filter(x => x)
  document.title = (head.title||'').replace(/<br>/g, ' ')
    + (cred.length ? ' (' : '')
    + [(head.author ? `by ${head.author}` : ''),
       (head.date ? head.date : '')].filter(x => x).join(', ')
    + (cred.length ? ')' : '')
  const preHtml = `<hgroup notoc>`
    + (head.title  ? `<h1>${head.title}</h1>`      : '')
    + (cred.length ? `<h2>${cred.join(', ')}</h2>` : '')
    + `</hgroup>\n\n`

  if (head.favicon) {
    $(document.head).append(`<link rel=icon href="${head.favicon}" sizes=any>`)
  }

  $elem.replaceWith(preHtml + html)

  insertIdIntoParentElement($)

  // Add ID attribute to <h#> tags.
  $('h1,h2,h3,h4,h5,h6,h7').each((_, h) => {
    const $h = $(h)
    if (!$h.attr('id')) {              // if parent 'id' is unset
      $h.attr('id', asciify($h.text()))
    }
  })

  // Add 'target="_blank"' to all external links.
  $('a[href]:not([href^="#"],[href^="javascript:"])').attr('target', '_blank')

  insertOptionalBreakAfterSlash($, $('html'))
  insertTableOfContent($)

  // Add left margin link icon for each hashlink in document.
  ;(body => {
    let prev = {}
    // Walk DOM, invoking cb for each element (ignoring text nodes). If cb
    // returns true, continue recursing through its child elements.
    function domwalk(e, cb) {
      if (cb(e)) {
        e = e.firstElementChild
        while (e) {
          domwalk(e, cb)
          e = e.nextElementSibling
        }
      }
    }
    // Find topmost tags with 'id' attributes, add margin element with
    // links (on left side) for each of them.
    domwalk(body, e => {
      const id = e.getAttribute('id')
      if (id) {
        // If tag is a <a> tag inside a previously seen tag, add it to
        // the same margin element, otherwise add new margin element.
        const $m = e.tagName === 'A' && e.parentElement === prev.parent
          ? prev.$sidebar
          : $('<div>').appendTo($('<div class=linky>').prependTo(e))
        prev = { parent: e.parentElement, $sidebar: $m }
        // Add all 'id's in this element (and its children) to current
        // margin element.
        domwalk(e, e => {
          const id = e.getAttribute('id')
          if (id) {
            $m.append(`<a title="#${id}" href="#${id}"></a>`)
          }
          return true
        })
      }
      return !id  // don't traverse below found 'id' attr
    })

    // Set 'hover' class on hash target when hovering over a #-link.
    $(body).on('mouseover mouseout', 'a[href^="#"]', e => {
      const id = $(e.currentTarget).attr('href').slice(1)
      $(`#${CSS.escape(id)}`).toggleClass('hover')
    })
  })(document.body)

  /* If table cell contains single link: Allow click/click on whole cell. */
  $('td:has(>a[href]:only-child),th:has(>a[href]:only-child)')
    .hover(() => { $(this).toggleClass('hover') })
    .click(e  => { $(e.currentTarget).children()[0].click() })

  // After page load: Jump to hash location.
  if (location.hash) {
    setTimeout(() => { location.href = location.hash }, 100)
  }

  // Return pixel height of 1rem * line-height in the root element.
  function getRhythm(e = ':root') {
    return $('<p style="position:absolute">​</p>').appendTo(e).hide().height()
  }

  // Distance from the top of the document to baseline of this element. Will
  // only work on an element whose first child node is a text node, returns
  // null on failure.
  function getBaselineFromTop(e = ':root') {
    for (const n of $(e).contents()) {       // look through nodes
      const type = n.nodeType
      if ((type === 3 && n.nodeValue.trim() !== '') ||          // text node
          (type === 1 && /^inline\b/.test($(n).css('display'))) // inline
          // FIXME: Ignore elements that are not in the flow (position: absolute, any other?)
          // FIXME: If an element exists, but in a non-inline element, traverse down it to find the first text node?
          // in flow: static, relative, sticky (ignored are: absolute, fixed)
         ) {
        const $c = $('<span style="display:inline-block;font-size:0;outline:4px solid green"></span>')
          .prependTo(e)
        return $c[0].getBoundingClientRect().top + scrollY
      }
    }
    return undefined
  }

  setTimeout(() => {
    const unit = getRhythm()
    let i = 0
    $('html.DEBUG *:visible').each((_, e) => {
      if (!$(e).is('h1,h2,h3,h4,h5,h6,p,span')) { return }

      if (i >= 10) { return }

      const baseline = getBaselineFromTop(e)
      if (baseline !== undefined) {
        const deviance = Math.round(baseline / unit) * unit - baseline
        const opacity  = Math.abs(Math.round((deviance / unit) * 15)).toString(16)
        $(e).css({ background: `#000${opacity}` })
        if (deviance > 0) {
          console.log(">>", e, deviance, opacity)
          i += 1
        }
      }
    })
  }, 0)
}

import('./elemental.mjs').then(elemental => {
  window.$ = elemental.$                       // for use in browser console
})

/*[eof]*/

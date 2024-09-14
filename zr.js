//-*-ispell-dictionary:"en";js-indent-level:2-*-
/* jshint
   esversion:9,
   asi: true,
   browser: true,
   devel: true,
   jquery: true,
   strict: true
*/
/* globals showdown */
/* exported openLink */

(() => {
  'use strict'

// From: https://codereview.stackexchange.com/a/132140/197081
String.prototype.rot13 = (() => {
  const i = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz']
  const o = [...'NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm']
  const rot13 = i.reduce((a, k, i) => Object.assign(a, { [k]: o[i] }), {})
  return function () {
    return [...this].map(c => rot13[c] || c).join('')
  }
})()

function escapeHtml(text) {
  return text.replace(
    /["&<>]/g, c => `&${{ '"': 'quot', '&': 'amp', '<': 'lt', '>': 'gt' }[c]};`)
}

function walkTheDOM(e, func) {
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
function insertOptionalBreakAfterSlash($e) {
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
function insertIdIntoParentElement() {
  $('a[id]:empty:first-child')                    // find <a> tags
    .filter((_, e) => e.previousSibling === null) //   not preceded by text
    .each((_, e) => {
      const $e = $(e)
      const $parent = $(e.parentElement)
      const id = $e.attr('id') || ''
      if (!$parent.attr('id') &&                  // if parent 'id' is unset
          !id.match(/^p\d+$/)) {                  //   and id isnt page number
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
function insertTableOfContent() {
  let $toc = $('toc')
  if ($toc.length === 0) {  // abort if no <toc> found
    return
  }
  const tocAttrs = $.map(
    $toc.prop('attributes'),
    x => ` ${x.name}${x.value === undefined ? '' : `="${escapeHtml(x.value)}"`}`
  ).join('')

  // Create ToC item from '<h#>…</h#>' element.
  function tocItem($h) {
    const $i = $h.clone()
    $i.find('a,err').replaceWith(function () {  // strip <err> and <a> tags
      return $(this).contents()                 //   but keep their content
    })
    $i.find('[id],[name]').replaceWith(         // strip 'id' and 'name'
      function () {                             //   attributes
        return $(this).removeAttr('id').removeAttr('name')
      }
    )
    return $i.html()
  }
  let level = 0
  let html = ''
  $('h1,h2,h3,h4,h5,h6,h7').each((_, h) => {
    const $h = $(h)
    if ($h.attr('title') === '' ||   // skip if 'title' or 'notoc'
        $h.attr('notoc') === '' ||   //   attribute or 'id=toc'
        $h.attr('id') === 'toc') {   //   is used
      return
    }
    const num = $h.prop('tagName').match(/\d$/)[0]
    if (!level) {
      level = num
    }
    if (num > level) {
      html += (new Array(num - level + 1)).join('<ul>\n')
    } else if (num < level) {
      html += (new Array(level - num + 1)).join('</ul>\n')
    }
    level = num
    html += `<li class="h${num}"><a href="#{$h.attr('id')}">${tocItem($h)}</a>\n`
  })
  $toc.replaceWith(`<ul class=toc hanging${tocAttrs}>${html}</ul>`)
}

const scriptPath = getRelativeScriptPath()
console.log(scriptPath)

include(`${scriptPath}/jquery-3.7.1.slim.min.js`, afterjQueryLoad)
include(`${scriptPath}/zr.css`)

function afterjQueryLoad() {
  jQuery.fn.reduce = [].reduce // from https://bugs.jquery.com/ticket/1886

  $('html').attr('lang', 'en')                       // set document language
  if (window.location.search.match(/\bDEBUG\b/i)) {  // set 'class=DEBUG'
    $('html').addClass('DEBUG')
    // If there are <iframe>s, add '?DEBUG' parameter in those too.
    $('iframe').each((_, elem) => {
      const $elem = $(elem)
      const src = $elem.attr('src')
      $elem.attr('src', src + '?DEBUG')
    })
  }
  include(`${scriptPath}/showdown.min.js`, afterShowdownLoad)
}

// Enable 'Show page' button when showdown has loaded.
function afterShowdownLoad() {
  const $elem = $('[markdown]:first')  // 1st element with attr 'markdown'
  if ($elem.is('[rot13]')) {
    const $btn = $('<button>Show page</button>').prependTo('body')
    $btn.focus().on('click', () => {
      // Display (CSS only) wait animation.
      $btn.html('<div class=loading><div></div><div></div><div></div><div></div></div>')
      // Run main() then remove button.
      setTimeout(() => {
        main(window.jQuery)
        $btn.remove()
      }, 100)
    })
  } else {
    main(window.jQuery)
  }
}

// Load Javascript, then invoke callback function.
function include(url, cb) {
  function tag(tag, opt) {
    return Object.assign(
      document.createElement(tag), opt, { async: true, onload: cb })
  }
  function fileTag(ext, url) {
    switch (ext) {
      case 'css': return tag('link', { href: url, rel: 'stylesheet' })
      case 'js':  return tag('script', { src: url })
    }
    throw TypeError(`include(): Unknown file type '.${ext}'`)
  }
  const ext = url.split('.').pop()
  document.head.append(fileTag(ext, url))
}

// Get Javascript path (path name relative to page script was included on).
function getRelativeScriptPath() {
  // Lists with each path component for element (removing trailing filename).
  let [script, page] = [document.currentScript.src, document.location.href]
    .map(url => url.split('/').slice(0, -1))

  // Remove leading common parts.
  while (script.length && page.length && script[0] === page[0]) {
    script.shift()
    page.shift()
  }
  return [
    // Replace remaining page path elements with '..'.
    ...(page.length > 0 ? page.map(() => '..') : ['.']),
    ...script,
  ].join('/')
}

function asciify(x) {
  return x
    .normalize('NFD')                       // turn accents into own chars
    .replace(/[^a-z0-9\n\r\u0020-]/gui, '') // strip off non-A-Z, space or hyphen
    .replace(/\s+/gu, '-')
    .toLowerCase()
}

// Processes a inputted markdown by moving source references to the end of it.
// Returns an array with two elements, where the first element is the
// reconfigured markdown, and the second is an object with references to for
// all the links found.
function getMarkdownLinks(md) {
  let refs = {}
  const singleRefReStr = '\\[([^\\[\\]]+)\\]:\\s*(\\S+)(?:\\s+"([^"]*)")?\\n'
  const onlyReferences = new RegExp(`^(${singleRefReStr})+$`)
  const oneReference   = new RegExp(singleRefReStr)
  const newMd = md.split(/\n{2,}/).map(paragraph => {
    // Remove paragraphs containing only link references, and store
    // these in 'refs' to be appended to the end of the document.
    if (`${paragraph}\n`.match(onlyReferences)) {
      let refName = ''
      `${paragraph}\n`.split(oneReference).forEach((str, i) => {
        switch (i % 4) {
        case 0:
          if (str !== '') { throw 'Bad string' }
          break
        case 1:
          refName = str.replace(
            /&(amp|gt|lt);/, (_, a) => ({ amp: '&', gt: '>', lt: '<' }[a]))
          if (refs[refName] !== undefined) {
            throw `Source reference '${refName}' already exists!`
          }
          refs[refName] = []
          break
        default:
          refs[refName].push(str)
        }
      })
      return ''
    }
    return paragraph
  }).filter(a => a).concat(
    // Add back removed link references at end of markdown.
    Object.keys(refs).sort().map(name => {
      const [fullLink, title] = refs[name]
      const [link, pageOffset] = fullLink.match(/^(.*?)([+\-][0-9]+)?$/).slice(1)
      refs[name].push(Number(pageOffset) || 0)
      refs[name][0] = link
      return `[${name}]: ${link}${title !== '' ? ` "${title}"` : ''}`
    }).join('\n')
  ).join('\n\n')
  return [newMd, refs]
}

function main($) {
  const $elem = $('[markdown]:first')  // 1st element with attr 'markdown'
  const [text, refs] = getMarkdownLinks(($elem.text() || '')[
    $elem.is('[rot13]') ? 'rot13' : 'toString' // rot13 decode
  ]())

  // Define Showdown extensions.
  showdown.extension('tlh', {  // {…} = Klingon
    type: 'lang',
    regex: /\{([^}]+)\}/g,
    replace: (_, tlh) => {
      // FIXME: Hyphenation of Klingon.
      return '<b lang=tlh>' + (
        // Insert <nobr> around leading '-' & following word.
        tlh.replace(/(-[^< ]+)/, '<nobr>$1</nobr>')
      ) + '</b>'
    },
  })
  // Translation example: «…» for English, «:iso:…» for ISO language.
  showdown.extension('en', {
    type: 'lang',
    filter: md => md.replace(/«([^»]+)»/g, (_, md) => {
      let lang = 'en'
      md = md.replace(/^:([^:\s]+):/, (_, prefix) => {
        lang = prefix
        return ''
      })
      return `<i lang="${lang}" class="transl">${md}</i>`
    }),
  })
  showdown.extension('sup', {
    type: 'lang',
    regex: /\^([^^]+)\^/g,
    replace: '<sup>$1</sup>',
  })
  showdown.extension('ref', {
    type: 'lang',
    regex: /‹([^›]+)›/g,
    replace: '<mark>$1</mark>',
  })
  // [#…] -> <a id="…"></a>. IDs must not contain space, nor any of '.:[]'
  // (colon and period interferes with CSS styling). Note: Spaces and tabs
  // following the tag are also stripped, as is a single newline -- but if is
  // followed by another newline it is left as-is; so if you put a [#…] in a
  // paragraph of its own you'll get an empty paragraph with a single <a> tag
  // in it!)
  showdown.extension('id', {
    type: 'lang',
    regex: /\[#([^.:\[\]\s]+)\][\t ]*(\n(?!\n))?/g,
    replace: '<a id="$1"></a>',
  })
  // Table in '| xxx | yyy' format. Cell separator ('|') may be surrounded by
  // space. Rows start with '|', but do not end in '|' (unless you want extra
  // empty table cells at the end of the row). Last cell have 'colspan'
  // attribute added if needed to make all rows equally long. Use '>' first
  // in a cell to add attribute 'indent' to that cell.
  showdown.extension('table', {
    type: 'lang',
    regex: /(\n{2,})((?:[ ]*\|.*\n??)+)(?=\n{2,})/g,
    replace: (_, pre, md) => {
      function processCell(md, colNum, rowCols, maxCols) {
        let attr = ''
        // If there is leading '>', add attribute 'indent'.
        const newMd = md.replace(/^>\s*/, '')
        if (newMd !== md) {
          attr += ' indent'
        }
        // If last cell in row add attribute 'colspan' if needed.
        if (colNum === rowCols && colNum < maxCols) {
          attr += ' colspan=' + (maxCols - rowCols + 1)
        }
        return `<td${attr}>${newMd}`
      }
      // Split markdown into array-of-arrays (one element = one cell).
      let tbl = md.split(/\n/).map(
        row => row
          .replace(/^\s*\|\s*/, '')  // strip leading cell separator
          .replace(/\s*$/, '')       // strip trailing space
          .split(/\s*\|\s*/)         // split into cells
      )
      // Number of cells in longest row.
      let maxcols = Math.max(...tbl.map(x => x.length))
      return pre + '<table markdown class=example>\n' +
        tbl.map((row, i) => {
          return '<tr>' + row.map((text, i) => {
            return processCell(text, i + 1, row.length, maxcols)
          }).join('') + '</tr>\n'
        }).join('') + '</table>'
    },
  })
  // https://github.com/showdownjs/showdown/wiki/Showdown-Options
  const converter = new showdown.Converter({
    extensions        : ['id', 'table', 'tlh', 'en', 'ref', 'sup'],
    noHeaderId        : true,
    simplifiedAutoLink: true,
    strikethrough     : true,
    underline         : true,
    excludeTrailingPunctuationFromURLs: true,
  })
  $elem.replaceWith(                      // replace with markdown
    converter.makeHtml(text)
  )
  insertIdIntoParentElement()

  // Add ID attribute to <h#> tags.
  $('h1,h2,h3,h4,h5,h6,h7').each((_, h) => {
    const $h = $(h)
    if (!$h.attr('id')) {                // if parent 'id' is unset
      $h.attr('id', asciify($h.text()))
    }
  })

  // Replace remaining [TEXT] and [TEXT][…] with links.
  const existingId = $('[id]').reduce((a, elem) => {
    a[ $(elem).attr('id') ] = true
    return a
  }, {})
  $('body *:not(script)').contents().each((_, node) => {
    if (node.nodeType !== 3) {                 // only process text nodes
      return
    }
    const $node = $(node)
    const html = $node.text()                  // split into text & links
      .split(/(\[.*?\](?:\[.*?\])?)/s)
    if (html.length > 1) {
      const newHtml = html.map((full, i) => {
        if (i % 2 === 0) {                     // plain text elements
          return full
        }
        const [, desc, rawLink = desc] = full
          .replace(/\n+/g, ' ')                // newline = space
          .match(/\[(.*?)\](?:\[(.*?)\])?/s)

        // Find (and remove) pageref (format :NUM1[–NUM2]).
        let startPage = 0
        const linkref = rawLink.replace(
          /:([0-9]+)(?:–[0-9]+)?\b/,
          (_, n) => {
            startPage = Number(n)
            return ''
          })

        const anchor = asciify(linkref)
        if (refs[linkref]) {              // external link
          const [extlink, _comment, pageOffset] = refs[linkref]
          const page = startPage ? '#page=' + (startPage + pageOffset) : ''
          return `<a href="${extlink}${page}">${desc}</a>`
        } else if (existingId[anchor]) {  // page internal link
          return `<a href="#${anchor}">${desc}</a>`
        }
        return full
      }).join('')
      $node.replaceWith(newHtml)
    }
  })

  // Add 'target="_blank"' to all external links.
  $('a[href]:not([href^="#"],[href^="javascript:"])').attr('target', '_blank')

  insertOptionalBreakAfterSlash($('html'))
  insertTableOfContent()

  /* FIXME: put into separate module */
  // Hashlinks
  ;(function ($win, $doc) {
    let menu = []
    let shown = false
    let $menu = $('<div class=menu hidden></div>').css({
      position: 'fixed',
      zIndex: 2147483647, // topmost allowed
      background: '#fff',
      borderRadius: 2,
      padding: 'calc(var(--cellpad) * .25) calc(var(--cellpad) * .5)',
      boxShadow: '0 2px 15px #0008',
      fontSize: '1rem',
      lineHeight: 'var(--rlead)',
    })
      .on('mouseover', 'a', addHilite)
      .on('mouseout', 'a', removeHilite)
      .appendTo('body')

    $doc.on('click', '[id]', e => {
      let id = $(e.currentTarget).attr('id')
      menu.push($(`<a href="#${id}">#${id}</a>`).css({
        display: 'block',
        width: '100%',
        padding: '0 var(--cellpad)',
      }))
      openMenu(e.clientX - 10, e.clientY - 10)
    })

    function addHilite(e) {
      const id = $(e.target).attr('href')
      $(id).addClass('hover')
    }
    function removeHilite(e) {
      const id = $(e.target).attr('href')
      $(id).removeClass('hover')
    }
    function openMenu(x, y) {
      shown = true
      // Display element topleft to get its height + width.
      $menu
        .css({ left: 0, top: 0 })
        .html(menu)
        .show()

      // Now use height and width of displayed menu, to move it to the right
      // place (making sure it doesn't stick out of right/bottom corner of
      // window).
      let xMax = $win.width()  - $menu.outerWidth()
      let yMax = $win.height() - $menu.outerHeight()
      $menu.css({
        left: x < xMax ? x : (xMax < 0 ? 0 : xMax),
        top:  y < yMax ? y : (yMax < 0 ? 0 : yMax),
      })
    }
    function hideMenu() {
      if (shown) {
        menu = []
        shown = false
        $menu.hide()
      }
    }
    $win.on('hashchange resize', hideMenu)
    $doc.on('scroll keydown mouseup', hideMenu)
  }($(window), $(document)))

  // If table cell contains single link: Allow click/click on whole cell.
  $('td:has(>a:only-child),th:has(>a:only-child)').hover(function () {
    $(this).toggleClass('hover')
  }).click(e => {
    $(e.currentTarget).children()[0].click()  // non-jquery click
  })

  // After page load: Jump to hash location.
  if (window.location.hash) {
    setTimeout(() => {
      window.location.href = window.location.hash
    }, 100)
  }
}

})()

function openLink(src) {
  'use strict'
  $('html').addClass('show-source')
  $('iframe').attr('src', src)
}

//[eof]

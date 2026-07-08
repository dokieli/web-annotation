import {
  cloneSelection,
  restoreSelection,
  getSelectedParentElement,
  selectionToTextQuote,
  createAnnotation,
} from '/dist/index.js'
import { DEFAULT_LANGUAGES, DEFAULT_LICENSES, DEFAULT_LABELS, ACTION_TO_MOTIVATION } from './defaults.js'

function generateId() {
  const array = new Uint8Array(1)
  crypto.getRandomValues(array)
  const letter = String.fromCharCode(97 + (array[0] % 6)) // a–f
  return letter + crypto.randomUUID().slice(1)
}

export class SelectionToolbar {
  constructor(options) {
    if (!options.container) throw new Error('SelectionToolbar: container is required')

    this.container       = options.container
    this.actions         = options.actions ?? ['comment', 'bookmark', 'approve', 'disapprove', 'specificity']
    this.onAnnotate      = options.onAnnotate
    this.creator         = options.creator ?? {}
    this.languages       = options.languages ?? DEFAULT_LANGUAGES
    this.licenses        = options.licenses ?? DEFAULT_LICENSES
    this.labels          = { ...DEFAULT_LABELS, ...options.labels }
    this.excludeSelector = options.excludeSelector ?? null

    this.selection = null
    this.dom = null

    this.onSelectionChange = this.handleSelectionChange.bind(this)
    this.onMouseDown       = this.handleMouseDown.bind(this)
  }

  mount() {
    this.dom = this.createDOM()
    document.body.appendChild(this.dom)

    document.addEventListener('mouseup',   this.onSelectionChange)
    document.addEventListener('keyup',     this.onSelectionChange)
    document.addEventListener('mousedown', this.onMouseDown)
  }

  destroy() {
    this.dom?.remove()
    this.dom = null

    document.removeEventListener('mouseup',   this.onSelectionChange)
    document.removeEventListener('keyup',     this.onSelectionChange)
    document.removeEventListener('mousedown', this.onMouseDown)
  }

  handleSelectionChange() {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) return
    if (!selection.toString().trim().length) return

    const range = selection.getRangeAt(0)

    if (!this.container.contains(range.commonAncestorContainer)) return

    if (this.excludeSelector) {
      const parent = getSelectedParentElement(range)
      if (parent?.closest(this.excludeSelector)) return
    }

    this.selection = cloneSelection()

    this.positionToolbar(range)
    this.dom?.classList.add('st-active')
  }

  handleMouseDown(e) {
    if (this.dom && !this.dom.contains(e.target)) {
      this.hide()
    }
  }

  createDOM() {
    const root = document.createElement('div')
    root.className = 'st-toolbar'
    root.setAttribute('role', 'toolbar')
    root.setAttribute('aria-label', 'Annotation toolbar')

    const ul = document.createElement('ul')
    ul.className = 'st-actions'

    this.actions.forEach(action => {
      const labels = this.labels[action] ?? {}

      const li  = document.createElement('li')
      const btn = document.createElement('button')
      btn.type      = 'button'
      btn.id        = `st-btn-${action}`
      btn.className = 'st-action-btn'
      btn.setAttribute('aria-label', labels.legend ?? action)
      btn.setAttribute('title',      labels.legend ?? action)
      btn.textContent = labels.buttonLabel ?? action

      btn.addEventListener('mousedown', e => e.preventDefault())
      btn.addEventListener('click', e => {
        e.preventDefault()
        e.stopPropagation()
        this.toggleForm(action)
      })

      li.appendChild(btn)
      ul.appendChild(li)
    })

    root.appendChild(ul)

    this.actions.forEach(action => {
      root.appendChild(this.createForm(action))
    })

    return root
  }

  createForm(action) {
    const labels      = this.labels[action] ?? {}
    const legend      = labels.legend      ?? action
    const placeholder = labels.placeholder ?? ''

    const noneOption     = '<option value="">— None —</option>'
    const langOptions    = this.languages.map(l => `<option value="${l.value}">${l.label}</option>`).join('')
    const licenseOptions = this.licenses.map(l => `<option value="${l.value}">${l.label}</option>`).join('')

    const form = document.createElement('form')
    form.id        = `st-form-${action}`
    form.className = 'st-form'
    form.innerHTML = `
      <fieldset>
        <legend>${legend}</legend>
        <label for="st-${action}-content">Note <span aria-hidden="true">*</span></label>
        <textarea id="st-${action}-content" name="content" placeholder="${placeholder}" required rows="4" dir="auto"></textarea>
        <label for="st-${action}-tags">Tags</label>
        <input id="st-${action}-tags" name="tags" placeholder="tag1, tag2" type="text" />
        <label for="st-${action}-language">Language</label>
        <select id="st-${action}-language" name="language">${noneOption}${langOptions}</select>
        <label for="st-${action}-license">License</label>
        <select id="st-${action}-license" name="license">${noneOption}${licenseOptions}</select>
        <button type="submit" class="st-submit">Post</button>
        <button type="button" class="st-cancel">Cancel</button>
      </fieldset>
    `

    form.addEventListener('submit', e => {
      e.preventDefault()
      this.handleSubmit(action, form)
    })

    form.addEventListener('click', e => {
      if (e.target.closest('.st-cancel')) {
        e.preventDefault()
        this.closeForm(action)
        this.dom?.querySelector(`#st-btn-${action}`)?.focus()
      }
    })

    form.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.preventDefault()
        this.closeForm(action)
        this.dom?.querySelector(`#st-btn-${action}`)?.focus()
      }
    })

    return form
  }

  toggleForm(action) {
    const form     = this.dom?.querySelector(`#st-form-${action}`)
    if (!form) return
    const isActive = form.classList.contains('st-form-active')

    this.closeAllForms()

    if (!isActive) {
      form.classList.add('st-form-active')
      this.dom?.querySelector(`#st-btn-${action}`)?.classList.add('st-btn-active')
      this.positionForm(form)
      ;(form.querySelector('textarea') ?? form.querySelector('input'))?.focus()
    }
  }

  closeForm(action) {
    const form = this.dom?.querySelector(`#st-form-${action}`)
    if (!form) return
    form.classList.remove('st-form-active')
    form.reset()
    this.dom?.querySelector(`#st-btn-${action}`)?.classList.remove('st-btn-active')
  }

  closeAllForms() {
    this.actions.forEach(a => {
      const form = this.dom?.querySelector(`#st-form-${a}`)
      if (form?.classList.contains('st-form-active')) this.closeForm(a)
    })
  }

  hide() {
    this.closeAllForms()
    this.dom?.classList.remove('st-active')
  }

  positionToolbar(range) {
    if (!this.dom) return
    const rect    = range.getBoundingClientRect()
    const toolbar = this.dom
    const margin  = 10

    toolbar.style.position = 'fixed'
    toolbar.style.left = `${rect.left + rect.width / 2 - toolbar.offsetWidth / 2}px`

    if (rect.top >= toolbar.offsetHeight + margin * 2) {
      toolbar.style.top = `${rect.top - toolbar.offsetHeight - margin}px`
      toolbar.dataset.arrow = 'under'
    } else {
      toolbar.style.top = `${rect.bottom + margin}px`
      toolbar.dataset.arrow = 'over'
    }
  }

  positionForm(form) {
    if (!this.dom) return
    const toolbarWidth = this.dom.offsetWidth
    form.style.left = `${toolbarWidth / 2 - form.offsetWidth / 2}px`
    form.style.top  = `${this.dom.offsetHeight + 4}px`
  }

  async handleSubmit(action, form) {
    restoreSelection(this.selection)

    const selection = window.getSelection()
    const selector = selection ? selectionToTextQuote(this.container, selection) : null
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null

    const anchorEl  = range ? getSelectedParentElement(range)?.closest('[id]') : null
    const baseURL   = document.location.href.split('#')[0]
    const targetIRI = anchorEl?.id ? `${baseURL}#${anchorEl.id}` : baseURL

    const data = new FormData(form)

    const id = generateId()
    const annotation = createAnnotation({
      motivatedBy: ACTION_TO_MOTIVATION[action] ?? 'oa:replying',
      id,
      refId: `r-${id}`,
      target: {
        iri:      targetIRI,
        source:   baseURL,
        selector: selector ?? undefined,
      },
      body: {
        content:  data.get('content') ?? '',
        tags:     data.get('tags')    ?? '',
        language: data.get('language') || undefined,
        license:  data.get('license')  || undefined,
      },
      creator: this.creator,
    })

    this.hide()

    await this.onAnnotate?.({ action, annotation, selector, range })
  }
}

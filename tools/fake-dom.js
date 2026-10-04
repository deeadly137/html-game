/**
 * fake-dom.js — DOM mínimo para testar a GUI (src/ui.js) sem navegador.
 *
 * Cobre apenas o subconjunto usado pela interface: criação de elementos,
 * classes, dataset, innerHTML/textContent simples, eventos e consultas
 * com seletores simples (#id, tag, .classe, [attr="valor"], combinações).
 *
 * NÃO é um DOM completo: innerHTML é tratado como texto (sem parsing).
 */

function parseSelector(selector) {
  const tag = selector.match(/^([a-zA-Z][\w-]*)/);
  const id = selector.match(/#([\w-]+)/);
  const classes = [...selector.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  const attrs = [...selector.matchAll(/\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g)].map((m) => ({
    name: m[1],
    value: m[2] ?? m[3] ?? m[4],
  }));
  return { tag: tag ? tag[1].toLowerCase() : null, id: id ? id[1] : null, classes, attrs };
}

function resolveAttr(el, name) {
  if (name.startsWith('data-')) {
    const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return el.dataset[key];
  }
  if (Object.prototype.hasOwnProperty.call(el.attributes, name)) return el.attributes[name];
  return el[name];
}

function matches(el, selector) {
  const sel = typeof selector === 'string' ? parseSelector(selector) : selector;
  if (sel.tag && el.tagName.toLowerCase() !== sel.tag) return false;
  if (sel.id && el.id !== sel.id) return false;
  if (!sel.classes.every((c) => el._classes.has(c))) return false;
  return sel.attrs.every(({ name, value }) => {
    const actual = resolveAttr(el, name);
    if (value === undefined) return actual !== undefined && actual !== null && actual !== false;
    return String(actual) === String(value);
  });
}

class FakeClassList {
  constructor(el) {
    this.el = el;
  }
  add(...names) {
    names.forEach((n) => this.el._classes.add(n));
  }
  remove(...names) {
    names.forEach((n) => this.el._classes.delete(n));
  }
  toggle(name, force) {
    // Como no DOM real: o segundo argumento (force) manda, se vier.
    const tem = this.el._classes.has(name);
    const deve = force === undefined ? !tem : Boolean(force);
    if (deve) this.el._classes.add(name);
    else this.el._classes.delete(name);
    return deve;
  }
  contains(name) {
    return this.el._classes.has(name);
  }
  toString() {
    return [...this.el._classes].join(' ');
  }
}

class FakeStyle {
  constructor() {
    this._props = new Map();
  }
  setProperty(name, value) {
    this._props.set(name, String(value));
  }
  getPropertyValue(name) {
    return this._props.get(name) || '';
  }
  removeProperty(name) {
    this._props.delete(name);
  }
}

/** Como no DOM real, valores de dataset são sempre strings. */
function createDataset() {
  const store = new Map();
  return new Proxy(store, {
    set(target, prop, value) {
      target.set(String(prop), String(value));
      return true;
    },
    get(target, prop) {
      if (prop === 'store') return target;
      return target.get(String(prop));
    },
    has(target, prop) {
      return target.has(String(prop));
    },
  });
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.dataset = createDataset();
    this.style = new FakeStyle();
    this._classes = new Set();
    this._listeners = new Map();
    this._innerHTML = '';
    this._text = '';
    this.id = '';
    this.value = '';
    this.type = '';
    this.title = '';
    this.disabled = false;
    this.hidden = false;
    this.scrollTop = 0;
    this.scrollHeight = 0;
  }

  get classList() {
    return new FakeClassList(this);
  }

  set className(value) {
    this._classes = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  get className() {
    return [...this._classes].join(' ');
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children = [];
    this._text = '';
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }

  get textContent() {
    return this._text;
  }

  append(...nodes) {
    for (const node of nodes) {
      if (node == null) continue;
      node.parentNode = this;
      this.children.push(node);
    }
  }

  appendChild(node) {
    this.append(node);
    return node;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    const list = this._listeners.get(type);
    if (list) this._listeners.set(type, list.filter((h) => h !== handler));
  }

  /** Como no DOM real, mas sem subir a árvore (o shim é plano). */
  closest(selector) {
    return matches(this, selector) ? this : null;
  }

  matches(selector) {
    return matches(this, selector);
  }

  setPointerCapture() {}

  releasePointerCapture() {}

  dispatchEvent(type, extra = {}) {
    const handlers = this._listeners.get(type) || [];
    const event = { type, target: this, preventDefault() {}, ...extra };
    handlers.forEach((h) => h(event));
    // Como no DOM real, também dispara a propriedade on<evento> (onclick etc).
    const inline = this[`on${type}`];
    if (typeof inline === 'function') inline(event);
    return event;
  }

  click() {
    this.dispatchEvent('click');
  }

  querySelectorAll(selector) {
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (matches(child, selector)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

/** Cria um "documento" com um elemento por id informado.
 *  Aceita uma lista de strings ("meu-id") ou de objetos { id, classes }.
 */
export function createFakeDocument(entries = []) {
  const root = new FakeElement('html');
  const byId = new Map();

  for (const entry of entries) {
    const id = typeof entry === 'string' ? entry : entry.id;
    const classes = typeof entry === 'string' ? '' : entry.classes || '';
    const hidden = typeof entry === 'string' ? false : Boolean(entry.hidden);
    const el = new FakeElement('div');
    el.id = id;
    el.className = classes;
    el.hidden = hidden;
    byId.set(id, el);
    root.append(el);
  }

  const document = {
    root,
    body: root,
    byId,
    createElement: (tag) => new FakeElement(tag),
    querySelector: (sel) => root.querySelector(sel),
    querySelectorAll: (sel) => root.querySelectorAll(sel),
    getElementById: (id) => byId.get(id) || null,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
  };

  return document;
}

/**
 * Instala os globais que a interface usa (document, window, rAF, location).
 * Devolve uma função para restaurar tudo no fim do teste.
 *
 * requestAnimationFrame vira um no-op: sem ele o laço de render ficaria
 * rodando para sempre e travaria o processo de teste. Os testes chamam a
 * atualização de câmera diretamente.
 */
export function installGlobals(doc) {
  const anteriores = {};
  const definidos = {
    document: doc,
    window: {
      innerWidth: 1280,
      innerHeight: 800,
      addEventListener() {},
      removeEventListener() {},
      devicePixelRatio: 1,
    },
    location: undefined,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
  };

  for (const [chave, valor] of Object.entries(definidos)) {
    anteriores[chave] = globalThis[chave];
    if (valor === undefined) delete globalThis[chave];
    else globalThis[chave] = valor;
  }

  return () => {
    for (const [chave, valor] of Object.entries(anteriores)) {
      if (valor === undefined) delete globalThis[chave];
      else globalThis[chave] = valor;
    }
  };
}

/** Extrai { id, classes, hidden } de todas as tags com id em um HTML. */
export function parseHtmlIds(html) {
  const out = [];
  for (const match of html.matchAll(/<[a-z][^>]*\bid="([\w-]+)"[^>]*>/gi)) {
    const tag = match[0];
    const classMatch = tag.match(/\bclass="([^"]*)"/i);
    out.push({
      id: match[1],
      classes: classMatch ? classMatch[1] : '',
      hidden: /(^|\s)hidden(\s|=|>|$)/i.test(tag.replace(/\s+/g, ' ')),
    });
  }
  return out;
}

export { FakeElement };
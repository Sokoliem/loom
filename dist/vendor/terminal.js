"use strict";
var __loomTerminalBoot = (() => {
  // ../../../Development/celestial/.worktrees/claude-wrapper-rewire/packages/rift/dist/index.js
  var ANSI_16 = [
    "rgb(0,0,0)",
    // 0 black
    "rgb(205,49,49)",
    // 1 red
    "rgb(13,188,121)",
    // 2 green
    "rgb(229,229,16)",
    // 3 yellow
    "rgb(36,114,200)",
    // 4 blue
    "rgb(188,63,188)",
    // 5 magenta
    "rgb(17,168,205)",
    // 6 cyan
    "rgb(204,204,204)",
    // 7 white
    "rgb(102,102,102)",
    // 8 bright black
    "rgb(241,76,76)",
    // 9 bright red
    "rgb(35,209,139)",
    // 10 bright green
    "rgb(245,245,67)",
    // 11 bright yellow
    "rgb(59,142,234)",
    // 12 bright blue
    "rgb(214,112,214)",
    // 13 bright magenta
    "rgb(41,184,219)",
    // 14 bright cyan
    "rgb(242,242,242)"
    // 15 bright white
  ];
  function color256ToCSS(index) {
    if (index < 0 || index > 255) return null;
    if (index < 16) return ANSI_16[index];
    if (index < 232) {
      const ci = index - 16;
      const b = ci % 6;
      const g = Math.floor(ci / 6) % 6;
      const r = Math.floor(ci / 36);
      const toVal = (v) => v === 0 ? 0 : 55 + v * 40;
      return `rgb(${toVal(r)},${toVal(g)},${toVal(b)})`;
    }
    const gray = 8 + (index - 232) * 10;
    return `rgb(${gray},${gray},${gray})`;
  }
  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }
  function parseFg(ansi) {
    if (!ansi) return null;
    const match = ansi.match(/\x1b\[([\d;]*)m/);
    if (!match) return null;
    const params = match[1].split(";").map(Number);
    if (params.length === 0) return null;
    const code = params[0];
    if (code >= 30 && code <= 37) return ANSI_16[code - 30];
    if (code >= 90 && code <= 97) return ANSI_16[code - 90 + 8];
    if (code === 38) {
      if (params.length >= 3 && params[1] === 5) return color256ToCSS(params[2]);
      if (params.length >= 5 && params[1] === 2) {
        return `rgb(${clamp(params[2], 0, 255)},${clamp(params[3], 0, 255)},${clamp(params[4], 0, 255)})`;
      }
    }
    return null;
  }
  function parseBg(ansi) {
    if (!ansi) return null;
    const match = ansi.match(/\x1b\[([\d;]*)m/);
    if (!match) return null;
    const params = match[1].split(";").map(Number);
    if (params.length === 0) return null;
    const code = params[0];
    if (code >= 40 && code <= 47) return ANSI_16[code - 40];
    if (code >= 100 && code <= 107) return ANSI_16[code - 100 + 8];
    if (code === 48) {
      if (params.length >= 3 && params[1] === 5) return color256ToCSS(params[2]);
      if (params.length >= 5 && params[1] === 2) {
        return `rgb(${clamp(params[2], 0, 255)},${clamp(params[3], 0, 255)},${clamp(params[4], 0, 255)})`;
      }
    }
    return null;
  }
  function asCssColor(value) {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("\x1B[")) return null;
    if (/^rgba?\([\d\s.,%]+\)$/i.test(trimmed)) {
      return trimmed;
    }
    if (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(trimmed)) {
      return trimmed;
    }
    return /^[a-zA-Z]+$/.test(trimmed) ? trimmed : null;
  }
  function cellStyleToCSS(style) {
    const result = {};
    if (style.fg) {
      const color = parseFg(style.fg) ?? asCssColor(style.fg);
      if (color) result.color = color;
    }
    if (style.bg) {
      const bgColor = parseBg(style.bg) ?? asCssColor(style.bg);
      if (bgColor) result.backgroundColor = bgColor;
    }
    if (style.bold) {
      result.fontWeight = "600";
    }
    if (style.dim) {
      result.opacity = "0.5";
    }
    if (style.italic) {
      result.fontStyle = "italic";
    }
    const decorations = [];
    if (style.underline) decorations.push("underline");
    if (style.strikethrough) decorations.push("line-through");
    if (decorations.length > 0) {
      result.textDecoration = decorations.join(" ");
    }
    return result;
  }
  var STYLE_CACHE_LIMIT = 2048;
  var styleCache = /* @__PURE__ */ new Map();
  function styleCacheKey(css) {
    return `${css.color ?? ""}|${css.backgroundColor ?? ""}|${css.fontWeight ?? ""}|${css.opacity ?? ""}|${css.fontStyle ?? ""}|${css.textDecoration ?? ""}`;
  }
  function cssStyleToString(css) {
    const key = styleCacheKey(css);
    const cached = styleCache.get(key);
    if (cached !== void 0) {
      styleCache.delete(key);
      styleCache.set(key, cached);
      return cached;
    }
    const parts = [];
    if (css.color) parts.push(`color:${css.color}`);
    if (css.backgroundColor) parts.push(`background-color:${css.backgroundColor}`);
    if (css.fontWeight) parts.push(`font-weight:${css.fontWeight}`);
    if (css.opacity) parts.push(`opacity:${css.opacity}`);
    if (css.fontStyle) parts.push(`font-style:${css.fontStyle}`);
    if (css.textDecoration) parts.push(`text-decoration:${css.textDecoration}`);
    const result = parts.join(";");
    if (styleCache.size >= STYLE_CACHE_LIMIT) {
      const oldest = styleCache.keys().next().value;
      if (oldest !== void 0) styleCache.delete(oldest);
    }
    styleCache.set(key, result);
    return result;
  }
  function cssStylesEqual(a, b) {
    return a.color === b.color && a.backgroundColor === b.backgroundColor && a.fontWeight === b.fontWeight && a.opacity === b.opacity && a.fontStyle === b.fontStyle && a.textDecoration === b.textDecoration;
  }
  var DEFAULT_SELECTION_STYLE = {
    background: "rgba(174,186,211,0.3)"
  };
  var DEFAULT_CONFIG = {
    fontFamily: "Geist Mono, monospace",
    fontSize: 13,
    lineHeight: 1.4,
    cursorBlink: true,
    cursorStyle: "block",
    cursorColor: "#c8d6e5",
    className: "",
    selectionStyle: { ...DEFAULT_SELECTION_STYLE }
  };
  function normalizeFontFamily(value) {
    if (!value) return DEFAULT_CONFIG.fontFamily;
    if (typeof value === "string") return value;
    return value.map((f) => {
      const trimmed = f.trim();
      if (/\s/.test(trimmed) && !/^(?:serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-monospace)$/i.test(trimmed)) {
        const escaped = trimmed.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        return `'${escaped}'`;
      }
      return trimmed;
    }).filter(Boolean).join(", ") || DEFAULT_CONFIG.fontFamily;
  }
  function resolveConfig(config) {
    const fontFamily = normalizeFontFamily(config?.fontFamily);
    return {
      ...DEFAULT_CONFIG,
      ...config,
      fontFamily,
      selectionStyle: { ...DEFAULT_SELECTION_STYLE, ...config?.selectionStyle }
    };
  }
  function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function sanitizeHref(href) {
    if (!href) return void 0;
    const trimmed = href.trim();
    if (!trimmed) return void 0;
    const colonIndex = trimmed.indexOf(":");
    const scheme = colonIndex === -1 ? void 0 : trimmed.slice(0, colonIndex).replace(/[\u0000-\u001F\u007F\s]+/g, "").toLowerCase();
    if (scheme === "javascript" || scheme === "data" || scheme === "vbscript") {
      return void 0;
    }
    return trimmed;
  }
  function sanitizeFontFamily(fontFamily) {
    const trimmed = fontFamily.trim();
    if (!trimmed) return DEFAULT_CONFIG.fontFamily;
    if (/[;{}*/\\\r\n\f]/.test(trimmed)) return DEFAULT_CONFIG.fontFamily;
    return trimmed;
  }
  function sanitizeNumber(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  }
  function groupCells(row) {
    if (row.length === 0) return [];
    const spans = [];
    let currentStyle = cellStyleToCSS(row[0].style);
    let currentHref = sanitizeHref(row[0].href);
    let currentText = row[0].char;
    let currentColumns = 1;
    for (let i = 1; i < row.length; i++) {
      const cell = row[i];
      const style = cellStyleToCSS(cell.style);
      const href = sanitizeHref(cell.href);
      if (cssStylesEqual(currentStyle, style) && currentHref === href) {
        currentText += cell.char;
        currentColumns += 1;
      } else {
        spans.push({ text: currentText, style: currentStyle, href: currentHref, columns: currentColumns });
        currentStyle = style;
        currentHref = href;
        currentText = cell.char;
        currentColumns = 1;
      }
    }
    spans.push({ text: currentText, style: currentStyle, href: currentHref, columns: currentColumns });
    return spans;
  }
  function spanStyleString(span) {
    const styleStr = cssStyleToString(span.style);
    const widthStr = `width:${span.columns}ch`;
    return styleStr ? `${styleStr};${widthStr}` : widthStr;
  }
  function spanToHTML(span) {
    const styleStr = spanStyleString(span);
    const escaped = escapeHTML(span.text);
    const href = sanitizeHref(span.href);
    if (href) {
      const styleAttr = styleStr ? ` style="${escapeHTML(styleStr)}"` : "";
      return `<a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer"${styleAttr}>${escaped}</a>`;
    }
    if (styleStr) {
      return `<span style="${escapeHTML(styleStr)}">${escaped}</span>`;
    }
    return `<span>${escaped}</span>`;
  }
  function renderRowContent(row) {
    return groupCells(row).map(spanToHTML).join("");
  }
  function containerStyle(config) {
    return [
      `font-family:${sanitizeFontFamily(config.fontFamily)}`,
      `font-size:${sanitizeNumber(config.fontSize, DEFAULT_CONFIG.fontSize)}px`,
      `line-height:${sanitizeNumber(config.lineHeight, DEFAULT_CONFIG.lineHeight)}`,
      `--rift-row-height:${sanitizeNumber(config.lineHeight, DEFAULT_CONFIG.lineHeight)}em`
    ].join(";");
  }
  function createRowElement(html) {
    const temp = document.createElement("div");
    temp.textContent = "";
    temp.insertAdjacentHTML("afterbegin", html);
    return temp.firstElementChild;
  }
  function cursorOverlayCSS(config) {
    const baseStyle = `position:absolute;pointer-events:none;z-index:1;background:${config.cursorColor}`;
    switch (config.cursorStyle) {
      case "bar":
        return `${baseStyle};width:2px;height:1em`;
      case "underline":
        return `${baseStyle};width:1ch;height:2px;margin-top:calc(1em - 2px)`;
      case "block":
      default:
        return `${baseStyle};width:1ch;height:1em;opacity:0.5`;
    }
  }
  function normalizeSelection(range) {
    const { start, end } = range;
    if (start.row < end.row || start.row === end.row && start.col <= end.col) {
      return range;
    }
    return { start: end, end: start };
  }
  function createRiftRenderer(config) {
    let resolved = resolveConfig(config);
    let container = null;
    let terminalEl = null;
    let prevRowHTML = [];
    let cursorEl = null;
    let selectionEl = null;
    let currentCursor = null;
    let currentSelection = null;
    let currentGrid = null;
    function buildTerminalElement() {
      const el = document.createElement("div");
      el.className = resolved.className ? `rift-terminal ${resolved.className}` : "rift-terminal";
      el.style.cssText = containerStyle(resolved);
      el.setAttribute("role", "log");
      el.setAttribute("aria-roledescription", "terminal");
      el.setAttribute("aria-label", "Terminal output");
      el.setAttribute("aria-live", "polite");
      el.style.position = "relative";
      return el;
    }
    function updateCursor() {
      if (!terminalEl) return;
      if (!currentCursor) {
        if (cursorEl?.parentNode) cursorEl.parentNode.removeChild(cursorEl);
        cursorEl = null;
        return;
      }
      if (!cursorEl) {
        cursorEl = document.createElement("div");
        cursorEl.className = "rift-cursor";
        cursorEl.setAttribute("aria-hidden", "true");
      }
      cursorEl.style.cssText = cursorOverlayCSS(resolved);
      cursorEl.style.left = `${currentCursor.col}ch`;
      cursorEl.style.top = `calc(${currentCursor.row} * ${resolved.lineHeight}em)`;
      if (resolved.cursorBlink) {
        cursorEl.classList.add("rift-cursor-blink");
      } else {
        cursorEl.classList.remove("rift-cursor-blink");
      }
      if (!cursorEl.parentNode) terminalEl.appendChild(cursorEl);
    }
    function updateSelection() {
      if (!terminalEl) return;
      if (selectionEl?.parentNode) {
        selectionEl.parentNode.removeChild(selectionEl);
      }
      selectionEl = null;
      if (!currentSelection || !currentGrid) return;
      selectionEl = document.createElement("div");
      selectionEl.className = "rift-selection";
      selectionEl.setAttribute("aria-hidden", "true");
      selectionEl.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:0";
      const norm = normalizeSelection(currentSelection);
      for (let row = norm.start.row; row <= norm.end.row && row < currentGrid.height; row++) {
        const startCol = row === norm.start.row ? norm.start.col : 0;
        const endCol = row === norm.end.row ? norm.end.col : currentGrid.width;
        if (endCol <= startCol) continue;
        const highlight = document.createElement("div");
        highlight.style.cssText = [
          "position:absolute",
          `left:${startCol}ch`,
          `top:calc(${row} * ${resolved.lineHeight}em)`,
          `width:${endCol - startCol}ch`,
          `height:${resolved.lineHeight}em`,
          `background:${resolved.selectionStyle.background}`
        ].join(";");
        selectionEl.appendChild(highlight);
      }
      terminalEl.insertBefore(selectionEl, terminalEl.firstChild);
    }
    const renderer = {
      get mounted() {
        return terminalEl !== null && container !== null && terminalEl.parentNode === container;
      },
      mount(target) {
        if (terminalEl) renderer.unmount();
        container = target;
        terminalEl = buildTerminalElement();
        container.appendChild(terminalEl);
        prevRowHTML = [];
      },
      unmount() {
        if (terminalEl && container && terminalEl.parentNode === container) {
          container.removeChild(terminalEl);
        }
        terminalEl = null;
        container = null;
        cursorEl = null;
        selectionEl = null;
        prevRowHTML = [];
        currentGrid = null;
      },
      render(grid) {
        if (!terminalEl || !renderer.mounted) return;
        currentGrid = grid;
        const newRowHTML = grid.cells.map((row) => `<div class="rift-row" role="row">${renderRowContent(row)}</div>`);
        if (cursorEl && cursorEl.parentNode === terminalEl) terminalEl.removeChild(cursorEl);
        if (selectionEl && selectionEl.parentNode === terminalEl) terminalEl.removeChild(selectionEl);
        if (prevRowHTML.length === 0) {
          for (const html of newRowHTML) {
            terminalEl.appendChild(createRowElement(html));
          }
        } else {
          const children = terminalEl.children;
          const maxRows = Math.max(newRowHTML.length, prevRowHTML.length);
          for (let i = 0; i < maxRows; i++) {
            if (i >= newRowHTML.length) {
              if (children[newRowHTML.length]) {
                terminalEl.removeChild(children[newRowHTML.length]);
              }
            } else if (i >= prevRowHTML.length) {
              terminalEl.appendChild(createRowElement(newRowHTML[i]));
            } else if (newRowHTML[i] !== prevRowHTML[i]) {
              const newEl = createRowElement(newRowHTML[i]);
              terminalEl.replaceChild(newEl, children[i]);
            }
          }
        }
        prevRowHTML = newRowHTML;
        updateCursor();
        updateSelection();
      },
      resize(_cols, _rows) {
        prevRowHTML = [];
        if (terminalEl) {
          while (terminalEl.firstChild) {
            terminalEl.removeChild(terminalEl.firstChild);
          }
        }
        cursorEl = null;
        selectionEl = null;
      },
      setConfig(newConfig) {
        resolved = resolveConfig({ ...resolved, ...newConfig });
        if (terminalEl) {
          terminalEl.className = resolved.className ? `rift-terminal ${resolved.className}` : "rift-terminal";
          terminalEl.style.cssText = containerStyle(resolved);
          terminalEl.style.position = "relative";
        }
        updateCursor();
        updateSelection();
      },
      setCursor(position) {
        currentCursor = position;
        updateCursor();
      },
      setSelection(range) {
        currentSelection = range;
        updateSelection();
      }
    };
    return renderer;
  }
  var RIFT_CSS = `
.rift-terminal {
  background: #000;
  color: #c8d6e5;
  font-variant-ligatures: none;
  font-feature-settings: 'liga' 0, 'calt' 0;
  font-kerning: none;
  white-space: pre;
  overflow: hidden;
  tab-size: 8;
  letter-spacing: 0;
  text-rendering: optimizeSpeed;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  cursor: inherit;
}
.rift-row {
  display: block;
  height: var(--rift-row-height, 1em);
  line-height: var(--rift-row-height, 1em);
  white-space: pre;
}
.rift-row span,
.rift-row a {
  display: inline-block;
  height: var(--rift-row-height, 1em);
  line-height: inherit;
  white-space: pre;
  overflow: hidden;
  margin: 0;
  padding: 0;
  border: 0;
  box-sizing: border-box;
  vertical-align: top;
  transition:
    color 140ms linear,
    background-color 140ms linear,
    opacity 140ms linear,
    text-decoration-color 140ms linear;
}
.rift-terminal a {
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
}
.rift-terminal a:hover {
  opacity: 0.8;
}
.rift-cursor-blink {
  animation: rift-blink 1s step-start infinite;
}
@keyframes rift-blink {
  50% { opacity: 0; }
}
`.trim();
  var STYLE_ID = "rift-default-styles";
  function injectRiftStyles() {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = RIFT_CSS;
    document.head.appendChild(style);
  }
  function createTerminal(container, config) {
    injectRiftStyles();
    const renderer = createRiftRenderer(config);
    renderer.mount(container);
    return {
      renderer,
      write(grid) {
        renderer.render(grid);
      },
      clear() {
        renderer.resize(80, 24);
      },
      destroy() {
        renderer.unmount();
      }
    };
  }

  // src/studio/terminal-client.ts
  window.__loomTerminal = (opts) => {
    injectRiftStyles();
    const term = createTerminal(opts.host);
    const status = (s, detail) => opts.onStatus?.(s, detail);
    let ws = null;
    let alive = true;
    let reconnectAttempt = 0;
    let cellMetrics = null;
    function connect() {
      status("connecting");
      ws = new WebSocket(opts.wsUrl);
      ws.addEventListener("open", async () => {
        reconnectAttempt = 0;
        status("open");
        if (document.fonts?.ready) {
          try {
            await document.fonts.ready;
          } catch {
          }
        }
        cellMetrics = null;
        sendResize();
        setTimeout(() => {
          cellMetrics = null;
          sendResize();
        }, 250);
      });
      ws.addEventListener("message", (ev) => {
        let msg;
        try {
          msg = JSON.parse(typeof ev.data === "string" ? ev.data : "{}");
        } catch {
          return;
        }
        if (msg.kind === "frame" && msg.frame && typeof msg.frame === "object") {
          const grid = portalFrameToRiftGrid(msg.frame);
          if (grid) {
            try {
              term.write(grid);
            } catch {
            }
          }
        } else if (msg.kind === "exit") {
          status("exited", String(msg.code ?? "?"));
        } else if (msg.kind === "error") {
          status("error", msg.message ?? "");
        }
      });
      ws.addEventListener("close", () => {
        status("closed");
        if (!alive) return;
        const delay = Math.min(8e3, 500 * 2 ** reconnectAttempt++);
        setTimeout(connect, delay);
      });
      ws.addEventListener("error", () => {
        status("error", "ws error");
      });
    }
    function send(message) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
    }
    function measureCell() {
      const riftEl = opts.host.querySelector(".rift-terminal");
      const container = riftEl ?? opts.host;
      const probe = document.createElement("span");
      probe.textContent = "M".repeat(80);
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;pointer-events:none;left:0;top:0";
      container.appendChild(probe);
      const rect = probe.getBoundingClientRect();
      const lineHeight = parseFloat(getComputedStyle(container).lineHeight);
      container.removeChild(probe);
      const cellWidth = Math.max(1, rect.width / 80);
      const cellHeight = Math.max(
        1,
        Number.isFinite(lineHeight) ? lineHeight : rect.height
      );
      return { cellWidth, cellHeight };
    }
    function pointToCell(clientX, clientY) {
      if (!cellMetrics) cellMetrics = measureCell();
      const rect = opts.host.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top + opts.host.scrollTop;
      const col = Math.max(0, Math.floor(x / cellMetrics.cellWidth));
      const row = Math.max(0, Math.floor(y / cellMetrics.cellHeight));
      return { row, col };
    }
    function modifiersOf(e) {
      return {
        ctrl: e.ctrlKey || e.metaKey,
        alt: e.altKey,
        shift: e.shiftKey
      };
    }
    function sendResize() {
      if (!cellMetrics) cellMetrics = measureCell();
      const riftEl = opts.host.querySelector(".rift-terminal");
      let widthPx;
      let heightPx;
      if (riftEl) {
        const rect = riftEl.getBoundingClientRect();
        widthPx = rect.width;
        heightPx = rect.height || opts.host.clientHeight;
      } else {
        const cs = getComputedStyle(opts.host);
        const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
        const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
        widthPx = opts.host.clientWidth - padX;
        heightPx = opts.host.clientHeight - padY;
      }
      const cols = Math.max(40, Math.floor(widthPx / cellMetrics.cellWidth) - 1);
      const rows = Math.max(8, Math.floor(heightPx / cellMetrics.cellHeight) - 1);
      send({ kind: "resize", cols, rows });
    }
    opts.host.tabIndex = 0;
    opts.host.style.cursor = "text";
    opts.host.addEventListener("pointerdown", () => opts.host.focus());
    opts.host.addEventListener("keydown", (e) => {
      if (isBrowserReservedShortcut(e)) return;
      if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;
      e.preventDefault();
      send({ kind: "key", key: e.key, modifiers: modifiersOf(e) });
    });
    opts.host.addEventListener("paste", (e) => {
      if (!e.clipboardData) return;
      e.preventDefault();
      for (const item of e.clipboardData.items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = () => {
            const result = typeof reader.result === "string" ? reader.result : "";
            if (!result) return;
            send({
              kind: "paste-image",
              dataBase64: result,
              mime: file.type,
              filename: file.name || void 0
            });
          };
          reader.readAsDataURL(file);
          return;
        }
      }
      const text = e.clipboardData.getData("text") ?? "";
      if (text) send({ kind: "paste", data: text });
    });
    opts.host.addEventListener("mousedown", (e) => {
      if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
      const { row, col } = pointToCell(e.clientX, e.clientY);
      send({
        kind: "mouse",
        type: "down",
        button: ["left", "middle", "right"][e.button] ?? "left",
        row,
        col,
        modifiers: modifiersOf(e)
      });
    });
    opts.host.addEventListener("mouseup", (e) => {
      if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
      const { row, col } = pointToCell(e.clientX, e.clientY);
      send({
        kind: "mouse",
        type: "up",
        button: ["left", "middle", "right"][e.button] ?? "left",
        row,
        col,
        modifiers: modifiersOf(e)
      });
    });
    opts.host.addEventListener("click", (e) => {
      const { row, col } = pointToCell(e.clientX, e.clientY);
      send({
        kind: "mouse",
        type: "click",
        button: "left",
        row,
        col,
        modifiers: modifiersOf(e)
      });
    });
    opts.host.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const { row, col } = pointToCell(e.clientX, e.clientY);
        const direction = e.deltaY > 0 ? "down" : "up";
        send({
          kind: "wheel",
          direction,
          row,
          col,
          modifiers: modifiersOf(e)
        });
      },
      { passive: false }
    );
    let resizeRaf = 0;
    const resizeObs = new ResizeObserver(() => {
      cellMetrics = null;
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(sendResize);
    });
    resizeObs.observe(opts.host);
    connect();
    return () => {
      alive = false;
      resizeObs.disconnect();
      try {
        ws?.close();
      } catch {
      }
      try {
        term.destroy();
      } catch {
      }
    };
  };
  function isBrowserReservedShortcut(e) {
    if (e.key === "F5" || e.key === "F11" || e.key === "F12") return true;
    if ((e.ctrlKey || e.metaKey) && e.key === "Tab") return true;
    if (e.altKey && e.key === "F4") return true;
    if (e.ctrlKey || e.metaKey) {
      const k = (e.key || "").toLowerCase();
      if (/^[twnrlfjh]$/.test(k)) return true;
      if (/^[0=\-+]$/.test(k)) return true;
    }
    return false;
  }
  function portalFrameToRiftGrid(frame) {
    if (!frame || typeof frame !== "object") return null;
    const f = frame;
    const bufferName = f.activeBuffer === "alternate" ? "alternate" : "main";
    const buffer = f.buffers?.[bufferName] ?? f.buffers?.main;
    if (!buffer?.grid || !Array.isArray(buffer.grid)) return null;
    const grid = buffer.grid;
    const height = grid.length;
    const width = grid.reduce((m, row) => Math.max(m, row.length), 0);
    const empty = { char: " ", style: {} };
    const cells = grid.map((row) => {
      const out = [];
      for (let i = 0; i < width; i++) out.push(row[i] ?? empty);
      return out;
    });
    return { cells, width, height };
  }
})();
//# sourceMappingURL=terminal.js.map

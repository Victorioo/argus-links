(function () {
  "use strict";

  var scriptEl = document.currentScript;
  var slug = scriptEl && scriptEl.dataset ? scriptEl.dataset.reportSlug : null;
  if (!slug) return;

  var API = "/api/comments/" + encodeURIComponent(slug);

  // ---------------------------------------------------------------- host + shadow root
  var host = document.createElement("div");
  host.style.all = "initial";
  document.documentElement.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = [
    ":host { all: initial; }",
    "* { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }",
    ".layer { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; }",
    ".toggle { position: fixed; right: 20px; bottom: 20px; z-index: 2147483001; pointer-events: auto;",
    "  background: linear-gradient(100deg, #6D28D9, #8B5CF6); color: #fff; border: none; border-radius: 999px;",
    "  padding: 12px 18px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 10px 28px -10px rgba(109,40,217,.7);",
    "  display: flex; align-items: center; gap: 8px; }",
    ".toggle.active { background: linear-gradient(100deg, #F0B94D, #C4B5FD); color: #231803; }",
    ".hint { position: fixed; left: 50%; top: 16px; transform: translateX(-50%); z-index: 2147483001; pointer-events: none;",
    "  background: rgba(19,16,34,.92); color: #F3F0FA; padding: 8px 16px; border-radius: 999px; font-size: 12.5px;",
    "  box-shadow: 0 8px 20px -8px rgba(0,0,0,.5); opacity: 0; transition: opacity .2s; }",
    ".hint.show { opacity: 1; }",
    ".highlight { position: fixed; pointer-events: none; border: 2px solid #8B5CF6; background: rgba(139,92,246,.12);",
    "  border-radius: 4px; z-index: 2147483000; display: none; }",
    ".pin { position: fixed; pointer-events: auto; width: 26px; height: 26px; border-radius: 50% 50% 50% 4px;",
    "  background: #8B5CF6; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center;",
    "  justify-content: center; cursor: pointer; box-shadow: 0 4px 10px -2px rgba(0,0,0,.5); transform: translate(-6px, -26px);",
    "  z-index: 2147483001; border: 2px solid rgba(255,255,255,.85); }",
    ".pin:hover { background: #F0B94D; color: #231803; }",
    ".popover { position: fixed; pointer-events: auto; width: 280px; background: #131022; color: #F3F0FA;",
    "  border: 1px solid #2A2340; border-radius: 14px; padding: 14px; box-shadow: 0 24px 55px -20px rgba(0,0,0,.7);",
    "  z-index: 2147483002; font-size: 13px; }",
    ".popover h4 { margin: 0 0 8px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #A79FC2; font-weight: 700; }",
    ".thread { max-height: 180px; overflow-y: auto; margin-bottom: 10px; display: flex; flex-direction: column; gap: 8px; }",
    ".c-item { border-bottom: 1px solid #1F1A33; padding-bottom: 8px; }",
    ".c-item:last-child { border-bottom: none; padding-bottom: 0; }",
    ".c-author { font-weight: 700; font-size: 12.5px; color: #C4B5FD; }",
    ".c-text { margin-top: 2px; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }",
    ".popover input, .popover textarea { width: 100%; background: #1A152C; border: 1px solid #2A2340; color: #F3F0FA;",
    "  border-radius: 8px; padding: 8px 10px; font-size: 13px; margin-bottom: 8px; outline: none; resize: vertical; }",
    ".popover textarea { min-height: 60px; }",
    ".popover .row { display: flex; gap: 8px; justify-content: flex-end; }",
    ".btn { border: none; border-radius: 999px; padding: 7px 14px; font-size: 12.5px; font-weight: 700; cursor: pointer; }",
    ".btn-primary { background: linear-gradient(100deg, #6D28D9, #8B5CF6); color: #fff; }",
    ".btn-quiet { background: #221B38; color: #A79FC2; }",
    ".close { position: absolute; top: 10px; right: 12px; background: none; border: none; color: #6E6488; font-size: 16px; cursor: pointer; }",
  ].join("\n");
  root.appendChild(style);

  var layer = document.createElement("div");
  layer.className = "layer";
  root.appendChild(layer);

  var highlight = document.createElement("div");
  highlight.className = "highlight";
  layer.appendChild(highlight);

  var hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = "Hacé clic en cualquier parte de la página para dejar un comentario";
  layer.appendChild(hint);

  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "toggle";
  toggle.textContent = "💬 Comentar";
  layer.appendChild(toggle);

  var pinsContainer = document.createElement("div");
  layer.appendChild(pinsContainer);

  var pickMode = false;
  var comments = []; // { id, selector, authorName, text, createdAt }
  var openPopover = null;

  toggle.addEventListener("click", function () {
    pickMode = !pickMode;
    toggle.classList.toggle("active", pickMode);
    hint.classList.toggle("show", pickMode);
    highlight.style.display = "none";
    closePopover();
  });

  // ---------------------------------------------------------------- selector generation
  function buildSelector(el) {
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement) {
      if (node.id) {
        parts.unshift("#" + CSS.escape(node.id));
        break;
      }
      var tag = node.tagName.toLowerCase();
      var parent = node.parentElement;
      var index = 1;
      if (parent) {
        var siblings = parent.children;
        var count = 0;
        for (var i = 0; i < siblings.length; i++) {
          if (siblings[i].tagName === node.tagName) {
            count++;
            if (siblings[i] === node) index = count;
          }
        }
      }
      parts.unshift(tag + ":nth-of-type(" + index + ")");
      node = node.parentElement;
    }
    return parts.length ? parts.join(">") : "body";
  }

  function findTarget(selector) {
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------- hover highlight + click
  document.addEventListener(
    "mousemove",
    function (e) {
      if (!pickMode) return;
      var el = e.target;
      if (host.contains(el)) return;
      var rect = el.getBoundingClientRect();
      highlight.style.display = "block";
      highlight.style.left = rect.left + "px";
      highlight.style.top = rect.top + "px";
      highlight.style.width = rect.width + "px";
      highlight.style.height = rect.height + "px";
    },
    true,
  );

  document.addEventListener(
    "click",
    function (e) {
      if (!pickMode) return;
      var el = e.target;
      if (host.contains(el)) return;
      e.preventDefault();
      e.stopPropagation();
      var selector = buildSelector(el);
      var rect = el.getBoundingClientRect();
      openComposer(selector, rect.left, rect.bottom + 8);
    },
    true,
  );

  // ---------------------------------------------------------------- popovers
  function closePopover() {
    if (openPopover) {
      openPopover.remove();
      openPopover = null;
    }
  }

  function clampX(x, width) {
    var max = window.innerWidth - width - 12;
    return Math.max(12, Math.min(x, max));
  }

  function clampY(y, height) {
    var max = window.innerHeight - height - 12;
    return Math.max(12, Math.min(y, max));
  }

  function openComposer(selector, x, y) {
    closePopover();
    var pop = document.createElement("div");
    pop.className = "popover";
    var savedName = "";
    try {
      savedName = localStorage.getItem("report-hub-commenter-name") || "";
    } catch {}

    pop.innerHTML =
      '<button class="close" type="button">✕</button>' +
      '<h4>Dejar un comentario</h4>' +
      '<input type="text" placeholder="Tu nombre (opcional)" maxlength="80" />' +
      '<textarea placeholder="Escribí tu comentario..." maxlength="2000"></textarea>' +
      '<div class="row"><button class="btn btn-primary" type="button">Comentar</button></div>';

    root.appendChild(pop);
    openPopover = pop;

    var nameInput = pop.querySelector("input");
    var textArea = pop.querySelector("textarea");
    nameInput.value = savedName;

    var rect = pop.getBoundingClientRect();
    pop.style.left = clampX(x, rect.width) + "px";
    pop.style.top = clampY(y, rect.height) + "px";

    pop.querySelector(".close").addEventListener("click", closePopover);
    pop.querySelector(".btn-primary").addEventListener("click", function () {
      var text = textArea.value.trim();
      if (!text) return;
      var authorName = nameInput.value.trim();
      try {
        if (authorName) localStorage.setItem("report-hub-commenter-name", authorName);
      } catch {}
      submitComment(selector, authorName, text);
    });
  }

  function submitComment(selector, authorName, text) {
    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selector: selector, authorName: authorName, text: text }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.comment) {
          comments.push(data.comment);
          closePopover();
          renderPins();
        }
      })
      .catch(function () {});
  }

  function openThread(selector, x, y) {
    closePopover();
    var pop = document.createElement("div");
    pop.className = "popover";

    var items = comments.filter(function (c) {
      return c.selector === selector;
    });

    var html =
      '<button class="close" type="button">✕</button>' +
      '<h4>Comentarios (' + items.length + ")</h4>" +
      '<div class="thread">';
    items.forEach(function (c) {
      html +=
        '<div class="c-item"><div class="c-author">' +
        escapeHtml(c.authorName) +
        '</div><div class="c-text">' +
        escapeHtml(c.text) +
        "</div></div>";
    });
    html +=
      "</div>" +
      '<input type="text" placeholder="Tu nombre (opcional)" maxlength="80" />' +
      '<textarea placeholder="Responder..." maxlength="2000"></textarea>' +
      '<div class="row"><button class="btn btn-primary" type="button">Comentar</button></div>';
    pop.innerHTML = html;

    root.appendChild(pop);
    openPopover = pop;

    var nameInput = pop.querySelector("input");
    try {
      nameInput.value = localStorage.getItem("report-hub-commenter-name") || "";
    } catch {}
    var textArea = pop.querySelector("textarea");

    var rect = pop.getBoundingClientRect();
    pop.style.left = clampX(x, rect.width) + "px";
    pop.style.top = clampY(y, rect.height) + "px";

    pop.querySelector(".close").addEventListener("click", closePopover);
    pop.querySelector(".btn-primary").addEventListener("click", function () {
      var text = textArea.value.trim();
      if (!text) return;
      var authorName = nameInput.value.trim();
      try {
        if (authorName) localStorage.setItem("report-hub-commenter-name", authorName);
      } catch {}
      submitComment(selector, authorName, text);
    });
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s == null ? "" : String(s);
    return div.innerHTML;
  }

  // ---------------------------------------------------------------- pins
  function renderPins() {
    pinsContainer.innerHTML = "";
    var bySelector = {};
    comments.forEach(function (c) {
      if (!bySelector[c.selector]) bySelector[c.selector] = [];
      bySelector[c.selector].push(c);
    });

    Object.keys(bySelector).forEach(function (selector) {
      var el = findTarget(selector);
      if (!el) return;
      var rect = el.getBoundingClientRect();
      var pin = document.createElement("div");
      pin.className = "pin";
      pin.textContent = String(bySelector[selector].length);
      pin.style.left = rect.left + "px";
      pin.style.top = rect.top + "px";
      pin.addEventListener("click", function (e) {
        e.stopPropagation();
        var r = pin.getBoundingClientRect();
        openThread(selector, r.left, r.bottom + 6);
      });
      pinsContainer.appendChild(pin);
    });
  }

  var repositionQueued = false;
  function queueReposition() {
    if (repositionQueued) return;
    repositionQueued = true;
    requestAnimationFrame(function () {
      repositionQueued = false;
      renderPins();
    });
  }
  window.addEventListener("scroll", queueReposition, true);
  window.addEventListener("resize", queueReposition);

  // ---------------------------------------------------------------- initial load
  fetch(API)
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      comments = (data && data.comments) || [];
      renderPins();
    })
    .catch(function () {});
})();

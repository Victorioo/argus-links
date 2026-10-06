(function () {
  "use strict";

  var scriptEl = document.currentScript;
  var slug = scriptEl && scriptEl.dataset ? scriptEl.dataset.reportSlug : null;
  if (!slug) return;

  var API = "/api/comments/" + encodeURIComponent(slug);
  var NAME_KEY = "report-hub-commenter-name";

  // ---------------------------------------------------------------- saved name
  function getSavedName() {
    try {
      return localStorage.getItem(NAME_KEY) || "";
    } catch {
      return "";
    }
  }
  function setSavedName(name) {
    try {
      if (name) localStorage.setItem(NAME_KEY, name);
    } catch {}
  }

  // ---------------------------------------------------------------- page key
  // Multi-page (.zip) sites share one report, so comments are scoped to the
  // page they were left on: path relative to /r/<slug>/ plus the query string.
  var BASE_PATH = "/r/" + slug;
  function currentPage() {
    var path = location.pathname;
    if (path.indexOf(BASE_PATH) === 0) path = path.slice(BASE_PATH.length);
    path = path.replace(/^\/+/, "");
    if (path === "index.html") path = "";
    return (path + location.search).slice(0, 300);
  }
  function pageUrl(page) {
    return BASE_PATH + "/" + page;
  }
  function pageLabel(page) {
    return page || "Página principal";
  }
  function onThisPage(c) {
    return (c.page || "") === currentPage();
  }

  // ---------------------------------------------------------------- host + shadow root
  var host = document.createElement("div");
  host.style.all = "initial";
  document.documentElement.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = [
    ":host { all: initial; }",
    "[hidden] { display: none !important; }",
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
    ".who-row { display: flex; align-items: center; justify-content: space-between; font-size: 11.5px;",
    "  color: #A79FC2; margin-bottom: 8px; }",
    ".link-btn { background: none; border: none; color: #A78BFA; font-size: 11.5px; font-weight: 700;",
    "  cursor: pointer; padding: 0; text-decoration: underline; }",
    ".btn { border: none; border-radius: 999px; padding: 7px 14px; font-size: 12.5px; font-weight: 700; cursor: pointer; }",
    ".btn-primary { background: linear-gradient(100deg, #6D28D9, #8B5CF6); color: #fff; }",
    ".btn-quiet { background: #221B38; color: #A79FC2; }",
    ".close { position: absolute; top: 10px; right: 12px; background: none; border: none; color: #6E6488; font-size: 16px; cursor: pointer; }",
    ".panel-tab { position: fixed; right: 0; top: 50%; transform: translateY(-50%) rotate(180deg); writing-mode: vertical-rl;",
    "  pointer-events: auto; background: #1A152C; color: #F3F0FA; border: 1px solid #2A2340; border-right: none;",
    "  border-radius: 10px 0 0 10px; padding: 14px 9px; font-size: 12px; font-weight: 700; cursor: pointer; letter-spacing: .03em;",
    "  z-index: 2147483001; }",
    ".panel-tab:hover { background: #221B38; }",
    ".panel { position: fixed; top: 0; right: 0; bottom: 0; width: min(340px, 88vw); background: #131022;",
    "  border-left: 1px solid #2A2340; box-shadow: -18px 0 45px -20px rgba(0,0,0,.65); z-index: 2147483003;",
    "  pointer-events: auto; display: flex; flex-direction: column; transform: translateX(100%); transition: transform .25s ease; }",
    ".panel.open { transform: translateX(0); }",
    ".panel-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px;",
    "  border-bottom: 1px solid #1F1A33; flex: none; }",
    ".panel-head h3 { font-size: 12.5px; text-transform: uppercase; letter-spacing: .08em; color: #A79FC2; margin: 0; font-weight: 700; }",
    ".panel-head .close { position: static; color: #F3F0FA; }",
    ".panel-msg { padding: 8px 18px; font-size: 11.5px; color: #F0B94D; flex: none; }",
    ".panel-list { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }",
    ".panel-item { border: 1px solid #1F1A33; border-radius: 10px; padding: 10px 12px; cursor: pointer; color: #F3F0FA; }",
    ".panel-item:hover { border-color: #6D28D9; }",
    ".pi-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }",
    ".pi-author { font-weight: 700; color: #C4B5FD; font-size: 12.5px; }",
    ".pi-text { margin-top: 4px; font-size: 12.5px; line-height: 1.4; word-break: break-word; }",
    ".pi-date { margin-top: 6px; font-size: 10.5px; color: #6E6488; }",
    ".reply { margin-left: 14px; padding-left: 10px; border-left: 2px solid #2A2340; }",
    ".reply-btn { margin-top: 4px; }",
    ".replying { font-size: 11.5px; color: #A79FC2; margin-bottom: 8px; }",
    ".pi-actions { display: flex; gap: 6px; flex: none; }",
    ".pi-reply-item { margin-top: 10px; margin-left: 12px; padding-left: 10px; border-left: 2px solid #2A2340; cursor: default; }",
    ".panel-empty { padding: 30px 16px; text-align: center; color: #6E6488; font-size: 12.5px; }",
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

  var panelTab = document.createElement("button");
  panelTab.type = "button";
  panelTab.className = "panel-tab";
  panelTab.textContent = "Comentarios";
  layer.appendChild(panelTab);

  var panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML =
    '<div class="panel-head"><h3>Todos los comentarios</h3><button type="button" class="close">✕</button></div>' +
    '<div class="panel-msg" hidden></div>' +
    '<div class="panel-list"></div>';
  layer.appendChild(panel);

  var panelList = panel.querySelector(".panel-list");
  var panelMsg = panel.querySelector(".panel-msg");

  panelTab.addEventListener("click", function () {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) renderPanel();
  });
  panel.querySelector(".close").addEventListener("click", function () {
    panel.classList.remove("open");
  });

  var pickMode = false;
  var comments = []; // { id, selector, authorName, text, createdAt }
  var openPopover = null;
  var viewer = null; // { name } when the visitor is signed in to Report Hub

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

  function flashHighlight(el) {
    var rect = el.getBoundingClientRect();
    highlight.style.display = "block";
    highlight.style.left = rect.left + "px";
    highlight.style.top = rect.top + "px";
    highlight.style.width = rect.width + "px";
    highlight.style.height = rect.height + "px";
    setTimeout(function () {
      if (!pickMode) highlight.style.display = "none";
    }, 1200);
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

  // ---------------------------------------------------------------- name control
  var NAME_SECTION_HTML =
    '<div class="who-row" hidden><span>Comentando como <b class="who-name"></b></span>' +
    '<button type="button" class="link-btn">cambiar</button></div>' +
    '<input type="text" class="name-input" placeholder="Tu nombre (opcional)" maxlength="80" />';

  function setupNameControl(pop) {
    var whoRow = pop.querySelector(".who-row");
    var whoName = pop.querySelector(".who-name");
    var nameInput = pop.querySelector(".name-input");
    // Scoped to the name row: a thread also contains "Responder" link buttons.
    var changeBtn = pop.querySelector(".who-row .link-btn");
    var saved = getSavedName();

    if (viewer) {
      nameInput.value = viewer.name;
      whoName.textContent = viewer.name;
      whoRow.hidden = false;
      changeBtn.hidden = true;
      nameInput.hidden = true;
      return nameInput;
    }

    if (saved) {
      nameInput.value = saved;
      whoName.textContent = saved;
      whoRow.hidden = false;
      nameInput.hidden = true;
    } else {
      whoRow.hidden = true;
      nameInput.hidden = false;
    }

    changeBtn.addEventListener("click", function () {
      whoRow.hidden = true;
      nameInput.hidden = false;
      nameInput.focus();
      nameInput.select();
    });

    return nameInput;
  }

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

    pop.innerHTML =
      '<button class="close" type="button">✕</button>' +
      "<h4>Dejar un comentario</h4>" +
      NAME_SECTION_HTML +
      '<textarea placeholder="Escribí tu comentario..." maxlength="2000"></textarea>' +
      '<div class="row"><button class="btn btn-primary" type="button">Comentar</button></div>';

    root.appendChild(pop);
    openPopover = pop;

    var nameInput = setupNameControl(pop);
    var textArea = pop.querySelector("textarea");

    var rect = pop.getBoundingClientRect();
    pop.style.left = clampX(x, rect.width) + "px";
    pop.style.top = clampY(y, rect.height) + "px";

    pop.querySelector(".close").addEventListener("click", closePopover);
    pop.querySelector(".btn-primary").addEventListener("click", function () {
      var text = textArea.value.trim();
      if (!text) return;
      var authorName = nameInput.value.trim();
      if (!viewer) setSavedName(authorName);
      submitComment({ selector: selector }, authorName, text);
    });
  }

  function submitComment(target, authorName, text, onDone) {
    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selector: target.selector,
        page: currentPage(),
        parentId: target.parentId || undefined,
        authorName: authorName,
        text: text,
      }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.comment) {
          comments.push(data.comment);
          renderPins();
          renderPanel();
          if (onDone) onDone();
          else closePopover();
        }
      })
      .catch(function () {});
  }

  function commentHtml(c, withReply) {
    return (
      '<div class="c-item"><div class="c-author">' + escapeHtml(c.authorName) + "</div>" +
      '<div class="c-text">' + escapeHtml(c.text) + "</div>" +
      (withReply ? '<button type="button" class="link-btn reply-btn" data-reply="' + escapeHtml(c.id) + '">Responder</button>' : "") +
      "</div>"
    );
  }

  function openThread(selector, x, y, replyToId) {
    closePopover();
    var pop = document.createElement("div");
    pop.className = "popover";

    var roots = comments.filter(function (c) {
      return c.selector === selector && onThisPage(c) && !c.parentId;
    });
    var total = comments.filter(function (c) {
      return c.selector === selector && onThisPage(c);
    }).length;
    var replyTarget = replyToId
      ? comments.filter(function (c) {
          return c.id === replyToId;
        })[0]
      : null;

    var html = '<button class="close" type="button">✕</button><h4>Comentarios (' + total + ")</h4>" +
      '<div class="thread">';
    roots.forEach(function (root) {
      html += commentHtml(root, true);
      comments.forEach(function (r) {
        if (r.parentId === root.id) html += '<div class="reply">' + commentHtml(r, false) + "</div>";
      });
    });
    html += "</div>";
    html += '<div class="replying" ' + (replyTarget ? "" : "hidden") + ">Respondiendo a <b>" +
      (replyTarget ? escapeHtml(replyTarget.authorName) : "") +
      '</b> <button type="button" class="link-btn cancel-reply">cancelar</button></div>';
    html += NAME_SECTION_HTML +
      '<textarea placeholder="' + (replyTarget ? "Escribí tu respuesta..." : "Agregar un comentario nuevo...") +
      '" maxlength="2000"></textarea>' +
      '<div class="row"><button class="btn btn-primary" type="button">' + (replyTarget ? "Responder" : "Comentar") + "</button></div>";
    pop.innerHTML = html;

    root.appendChild(pop);
    openPopover = pop;

    var nameInput = setupNameControl(pop);
    var textArea = pop.querySelector("textarea");

    var rect = pop.getBoundingClientRect();
    pop.style.left = clampX(x, rect.width) + "px";
    pop.style.top = clampY(y, rect.height) + "px";

    pop.querySelector(".close").addEventListener("click", closePopover);
    pop.querySelectorAll(".reply-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openThread(selector, x, y, btn.getAttribute("data-reply"));
      });
    });
    var cancel = pop.querySelector(".cancel-reply");
    if (cancel) {
      cancel.addEventListener("click", function () {
        openThread(selector, x, y, null);
      });
    }
    if (replyTarget) textArea.focus();

    pop.querySelector(".btn-primary").addEventListener("click", function () {
      var text = textArea.value.trim();
      if (!text) return;
      var authorName = nameInput.value.trim();
      if (!viewer) setSavedName(authorName);
      submitComment({ selector: selector, parentId: replyTarget ? replyTarget.id : null }, authorName, text, function () {
        openThread(selector, x, y, null);
      });
    });
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s == null ? "" : String(s);
    return div.innerHTML;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  // ---------------------------------------------------------------- side panel (all comments)
  function showPanelMsg(text) {
    panelMsg.textContent = text;
    panelMsg.hidden = false;
    setTimeout(function () {
      panelMsg.hidden = true;
    }, 3500);
  }

  function deleteComment(id) {
    fetch(API + "/" + encodeURIComponent(id), { method: "DELETE" })
      .then(function (res) {
        if (res.status === 401) {
          showPanelMsg("Iniciá sesión en Report Hub para borrar comentarios.");
          return null;
        }
        if (!res.ok) {
          showPanelMsg("No se pudo borrar el comentario.");
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok) {
          comments = comments.filter(function (c) {
            return c.id !== id;
          });
          renderPanel();
          renderPins();
        }
      })
      .catch(function () {
        showPanelMsg("No se pudo borrar el comentario.");
      });
  }

  function renderPanel() {
    panelTab.textContent = "Comentarios (" + comments.length + ")";

    if (!comments.length) {
      panelList.innerHTML = '<div class="panel-empty">Todavía no hay comentarios.</div>';
      return;
    }

    var roots = comments
      .filter(function (c) {
        return !c.parentId;
      })
      .sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

    function itemHtml(c, isReply) {
      return (
        '<div class="pi-top"><span class="pi-author">' + escapeHtml(c.authorName) + "</span>" +
        '<span class="pi-actions">' +
        (isReply ? "" : '<button type="button" class="btn btn-quiet pi-reply" style="padding:3px 9px;font-size:10.5px;">Responder</button>') +
        '<button type="button" class="btn btn-quiet pi-delete" style="padding:3px 9px;font-size:10.5px;">Borrar</button></span></div>' +
        '<div class="pi-text">' + escapeHtml(c.text) + "</div>" +
        '<div class="pi-date">' + formatDate(c.createdAt) +
        (!isReply && !onThisPage(c) ? " · " + escapeHtml(pageLabel(c.page)) : "") + "</div>"
      );
    }

    panelList.innerHTML = "";
    roots.forEach(function (c) {
      var item = document.createElement("div");
      item.className = "panel-item";
      item.innerHTML = itemHtml(c, false);

      comments.forEach(function (r) {
        if (r.parentId !== c.id) return;
        var reply = document.createElement("div");
        reply.className = "pi-reply-item";
        reply.innerHTML = itemHtml(r, true);
        reply.addEventListener("click", function (e) {
          e.stopPropagation();
        });
        reply.querySelector(".pi-delete").addEventListener("click", function (e) {
          e.stopPropagation();
          deleteComment(r.id);
        });
        item.appendChild(reply);
      });

      function goTo(replyId) {
        if (!onThisPage(c)) {
          location.href = pageUrl(c.page || "");
          return;
        }
        var el = findTarget(c.selector);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        flashHighlight(el);
        if (replyId) {
          panel.classList.remove("open");
          setTimeout(function () {
            var r = el.getBoundingClientRect();
            openThread(c.selector, r.left, r.bottom + 6, replyId);
          }, 350);
        }
      }

      item.addEventListener("click", function () {
        goTo(null);
      });
      item.querySelector(".pi-reply").addEventListener("click", function (e) {
        e.stopPropagation();
        goTo(c.id);
      });
      item.querySelector(".pi-delete").addEventListener("click", function (e) {
        e.stopPropagation();
        deleteComment(c.id);
      });
      panelList.appendChild(item);
    });
  }

  // ---------------------------------------------------------------- pins
  function renderPins() {
    pinsContainer.innerHTML = "";
    var bySelector = {};
    comments.forEach(function (c) {
      if (!onThisPage(c)) return;
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

  // Pages like a product detail are often rendered by JS after load, so
  // pins must be re-placed once the elements they point to actually exist.
  if (window.MutationObserver) {
    new MutationObserver(queueReposition).observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // ---------------------------------------------------------------- initial load
  fetch(API)
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      comments = (data && data.comments) || [];
      viewer = (data && data.viewer) || null;
      renderPins();
      renderPanel();
    })
    .catch(function () {});
})();

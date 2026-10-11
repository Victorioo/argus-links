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
    ".thread { max-height: 220px; overflow-y: auto; margin-bottom: 10px; display: flex; flex-direction: column; gap: 8px; }",
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
    ".panel-filters { display: flex; gap: 6px; flex-wrap: wrap; padding: 12px 16px 0; flex: none; }",
    ".chip { background: #1A152C; color: #A79FC2; border: 1px solid #2A2340; border-radius: 999px; padding: 4px 10px;",
    "  font-size: 11px; font-weight: 700; cursor: pointer; }",
    ".chip:hover { border-color: #6D28D9; }",
    ".chip.on { background: #6D28D9; border-color: #8B5CF6; color: #fff; }",
    ".panel-item.resolved, .c-item.is-resolved { opacity: .62; }",
    ".badge-ok { margin-left: 8px; font-size: 10px; font-weight: 700; color: #2DD9C4; border: 1px solid rgba(45,217,196,.45);",
    "  border-radius: 999px; padding: 1px 7px; white-space: nowrap; }",
    ".pin.resolved { background: #2DD9C4; color: #06241f; }",
    ".c-img { display: block; max-width: 100%; max-height: 140px; border-radius: 8px; margin-top: 6px; border: 1px solid #2A2340; }",
    ".c-actions { margin-top: 4px; display: flex; gap: 12px; flex-wrap: wrap; }",
    ".attach { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 11.5px; color: #6E6488; }",
    ".attach-preview { position: relative; margin-bottom: 8px; }",
    ".attach-preview img { display: block; max-width: 100%; max-height: 120px; border-radius: 8px; border: 1px solid #2A2340; }",
    ".attach-remove { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 50%; border: none;",
    "  background: rgba(0,0,0,.72); color: #fff; cursor: pointer; font-size: 11px; line-height: 1; }",
    ".pop-msg { font-size: 11.5px; color: #F0729B; margin-bottom: 8px; line-height: 1.35; }",
    ".btn:disabled { opacity: .6; cursor: default; }",
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
    '<div class="panel-filters" hidden></div>' +
    '<div class="panel-msg" hidden></div>' +
    '<div class="panel-list"></div>';
  layer.appendChild(panel);

  var panelList = panel.querySelector(".panel-list");
  var panelMsg = panel.querySelector(".panel-msg");
  var panelFilters = panel.querySelector(".panel-filters");

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

  // ---------------------------------------------------------------- images
  var MAX_SIDE = 1600;
  var MAX_BYTES = 3 * 1024 * 1024;

  // Screenshots are shrunk in the browser first: a phone screenshot can be
  // several MB, and the server refuses anything over 3MB.
  function shrinkImage(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
        reject(new Error("Solo se pueden adjuntar imágenes PNG, JPG, GIF o WebP."));
        return;
      }
      if (file.type === "image/gif") {
        if (file.size <= MAX_BYTES) resolve(file);
        else reject(new Error("La imagen pesa demasiado (máximo 3MB)."));
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          function (blob) {
            // Keep the original when it was not resized and is already smaller.
            var best = blob && (scale < 1 || blob.size < file.size) ? blob : file;
            if (best.size <= MAX_BYTES) resolve(best);
            else reject(new Error("La imagen pesa demasiado (máximo 3MB)."));
          },
          "image/jpeg",
          0.85,
        );
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("No se pudo leer la imagen."));
      };
      img.src = url;
    });
  }

  function safeImageUrl(u) {
    return typeof u === "string" && /^https:\/\//i.test(u) ? u : "";
  }

  function imageHtml(c) {
    var u = safeImageUrl(c.imageUrl);
    if (!u) return "";
    return (
      '<a class="c-imglink" href="' + escapeHtml(u) + '" target="_blank" rel="noopener noreferrer">' +
      '<img class="c-img" src="' + escapeHtml(u) + '" alt="Imagen adjunta" loading="lazy" referrerpolicy="no-referrer"></a>'
    );
  }

  var ATTACH_HTML =
    '<div class="attach"><button type="button" class="link-btn attach-btn">📎 Adjuntar imagen</button>' +
    '<input type="file" class="attach-input" accept="image/png,image/jpeg,image/webp,image/gif" hidden />' +
    '<span class="attach-hint">o pegala con Ctrl+V</span></div>' +
    '<div class="attach-preview" hidden><img alt="Vista previa" /><button type="button" class="attach-remove" title="Quitar imagen">✕</button></div>' +
    '<div class="pop-msg" hidden></div>';

  // Wires the attach button, the file picker and pasting a screenshot into the
  // textarea. Returns accessors used when the comment is sent.
  function setupAttach(pop, textArea) {
    var btn = pop.querySelector(".attach-btn");
    var input = pop.querySelector(".attach-input");
    var hintEl = pop.querySelector(".attach-hint");
    var preview = pop.querySelector(".attach-preview");
    var previewImg = preview.querySelector("img");
    var msg = pop.querySelector(".pop-msg");
    var state = { blob: null };

    function showMsg(text) {
      msg.textContent = text || "";
      msg.hidden = !text;
    }
    function clear() {
      state.blob = null;
      if (previewImg.src) URL.revokeObjectURL(previewImg.src);
      previewImg.removeAttribute("src");
      preview.hidden = true;
      btn.hidden = false;
      hintEl.hidden = false;
      input.value = "";
    }
    function attach(file) {
      showMsg("");
      shrinkImage(file)
        .then(function (blob) {
          state.blob = blob;
          previewImg.src = URL.createObjectURL(blob);
          preview.hidden = false;
          btn.hidden = true;
          hintEl.hidden = true;
        })
        .catch(function (e) {
          showMsg(e.message);
        });
    }

    btn.addEventListener("click", function () {
      input.click();
    });
    input.addEventListener("change", function () {
      if (input.files && input.files[0]) attach(input.files[0]);
    });
    pop.querySelector(".attach-remove").addEventListener("click", clear);
    textArea.addEventListener("paste", function (e) {
      var files = (e.clipboardData && e.clipboardData.files) || [];
      for (var i = 0; i < files.length; i++) {
        if (/^image\//.test(files[i].type)) {
          e.preventDefault();
          attach(files[i]);
          return;
        }
      }
    });

    return {
      get: function () {
        return state.blob;
      },
      showMsg: showMsg,
    };
  }

  // ---------------------------------------------------------------- popovers (composer + thread)
  function openComposer(selector, x, y) {
    closePopover();
    var pop = document.createElement("div");
    pop.className = "popover";

    pop.innerHTML =
      '<button class="close" type="button">✕</button>' +
      "<h4>Dejar un comentario</h4>" +
      NAME_SECTION_HTML +
      '<textarea placeholder="Escribí tu comentario..." maxlength="2000"></textarea>' +
      ATTACH_HTML +
      '<div class="row"><button class="btn btn-primary" type="button">Comentar</button></div>';

    root.appendChild(pop);
    openPopover = pop;

    var nameInput = setupNameControl(pop);
    var textArea = pop.querySelector("textarea");
    var attach = setupAttach(pop, textArea);

    var rect = pop.getBoundingClientRect();
    pop.style.left = clampX(x, rect.width) + "px";
    pop.style.top = clampY(y, rect.height) + "px";

    pop.querySelector(".close").addEventListener("click", closePopover);
    var send = pop.querySelector(".btn-primary");
    send.addEventListener("click", function () {
      var text = textArea.value.trim();
      var image = attach.get();
      if (!text && !image) return;
      var authorName = nameInput.value.trim();
      if (!viewer) setSavedName(authorName);
      send.disabled = true;
      send.textContent = "Enviando…";
      submitComment({ selector: selector }, authorName, text, image, null, function (message) {
        send.disabled = false;
        send.textContent = "Comentar";
        attach.showMsg(message);
      });
    });
  }

  function submitComment(target, authorName, text, image, onDone, onFail) {
    var request;
    if (image) {
      // A comment with a screenshot travels as multipart so the image is created
      // together with it.
      var fd = new FormData();
      fd.append("selector", target.selector || "");
      fd.append("page", currentPage());
      if (target.parentId) fd.append("parentId", target.parentId);
      fd.append("authorName", authorName);
      fd.append("text", text);
      var ext = image.type === "image/jpeg" ? "jpg" : (image.type.split("/")[1] || "png");
      fd.append("image", image, "captura." + ext);
      request = fetch(API, { method: "POST", body: fd });
    } else {
      request = fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selector: target.selector,
          page: currentPage(),
          parentId: target.parentId || undefined,
          authorName: authorName,
          text: text,
        }),
      });
    }

    request
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (r) {
        if (r.ok && r.data && r.data.comment) {
          comments.push(r.data.comment);
          updateTab();
          renderFilters();
          renderPins();
          renderPanel();
          if (onDone) onDone();
          else closePopover();
        } else if (onFail) {
          onFail((r.data && r.data.error) || "No se pudo enviar el comentario.");
        }
      })
      .catch(function () {
        if (onFail) onFail("No se pudo enviar el comentario. Revisá tu conexión.");
      });
  }

  // A thread: the top-level comment (with its status and, for the team, the
  // resolve button) followed by its replies.
  function commentHtml(c, isRoot) {
    var id = escapeHtml(c.id);
    var badge = isRoot && c.resolved ? '<span class="badge-ok">✓ Resuelto</span>' : "";
    var actions = "";
    if (isRoot) {
      actions += '<button type="button" class="link-btn reply-btn" data-reply="' + id + '">Responder</button>';
      if (viewer) {
        actions +=
          '<button type="button" class="link-btn resolve-btn" data-resolve="' + id + '" data-to="' + (c.resolved ? "0" : "1") + '">' +
          (c.resolved ? "Reabrir" : "Marcar como resuelto") + "</button>";
      }
    }
    return (
      '<div class="c-item' + (isRoot && c.resolved ? " is-resolved" : "") + '">' +
      '<div class="c-author">' + escapeHtml(c.authorName) + badge + "</div>" +
      (c.text ? '<div class="c-text">' + escapeHtml(c.text) + "</div>" : "") +
      imageHtml(c) +
      (actions ? '<div class="c-actions">' + actions + "</div>" : "") +
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
    roots.forEach(function (rootComment) {
      html += commentHtml(rootComment, true);
      comments.forEach(function (r) {
        if (r.parentId === rootComment.id) html += '<div class="reply">' + commentHtml(r, false) + "</div>";
      });
    });
    html += "</div>";
    html += '<div class="replying" ' + (replyTarget ? "" : "hidden") + ">Respondiendo a <b>" +
      (replyTarget ? escapeHtml(replyTarget.authorName) : "") +
      '</b> <button type="button" class="link-btn cancel-reply">cancelar</button></div>';
    html += NAME_SECTION_HTML +
      '<textarea placeholder="' + (replyTarget ? "Escribí tu respuesta..." : "Agregar un comentario nuevo...") +
      '" maxlength="2000"></textarea>' + ATTACH_HTML +
      '<div class="row"><button class="btn btn-primary" type="button">' + (replyTarget ? "Responder" : "Comentar") + "</button></div>";
    pop.innerHTML = html;

    root.appendChild(pop);
    openPopover = pop;

    var nameInput = setupNameControl(pop);
    var textArea = pop.querySelector("textarea");
    var attach = setupAttach(pop, textArea);

    var rect = pop.getBoundingClientRect();
    pop.style.left = clampX(x, rect.width) + "px";
    pop.style.top = clampY(y, rect.height) + "px";

    pop.querySelector(".close").addEventListener("click", closePopover);
    pop.querySelectorAll(".reply-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openThread(selector, x, y, btn.getAttribute("data-reply"));
      });
    });
    pop.querySelectorAll(".resolve-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setResolved(
          btn.getAttribute("data-resolve"),
          btn.getAttribute("data-to") === "1",
          function () {
            openThread(selector, x, y, null);
          },
          attach.showMsg,
        );
      });
    });
    var cancel = pop.querySelector(".cancel-reply");
    if (cancel) {
      cancel.addEventListener("click", function () {
        openThread(selector, x, y, null);
      });
    }
    if (replyTarget) textArea.focus();

    var send = pop.querySelector(".btn-primary");
    var label = replyTarget ? "Responder" : "Comentar";
    send.addEventListener("click", function () {
      var text = textArea.value.trim();
      var image = attach.get();
      if (!text && !image) return;
      var authorName = nameInput.value.trim();
      if (!viewer) setSavedName(authorName);
      send.disabled = true;
      send.textContent = "Enviando…";
      submitComment(
        { selector: selector, parentId: replyTarget ? replyTarget.id : null },
        authorName,
        text,
        image,
        function () {
          openThread(selector, x, y, null);
        },
        function (message) {
          send.disabled = false;
          send.textContent = label;
          attach.showMsg(message);
        },
      );
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

  // ---------------------------------------------------------------- status (pending / resolved)
  var filter = "all"; // "all" | "pending" | "resolved"

  function stats() {
    var roots = comments.filter(function (c) {
      return !c.parentId;
    });
    var resolved = roots.filter(function (c) {
      return c.resolved;
    }).length;
    return { total: roots.length, resolved: resolved, pending: roots.length - resolved };
  }

  function matchesFilter(c) {
    if (filter === "pending") return !c.resolved;
    if (filter === "resolved") return !!c.resolved;
    return true;
  }

  function updateTab() {
    var s = stats();
    panelTab.textContent = s.total
      ? "Comentarios (" + s.pending + ")" + (s.resolved ? " · " + s.resolved + " ✓" : "")
      : "Comentarios";
    panelTab.title = s.pending + " pendientes · " + s.resolved + " resueltos";
  }

  // Only the team (signed in) can change a comment's status; the server checks too.
  function setResolved(id, resolved, onDone, onError) {
    function fail(text) {
      if (onError) onError(text);
      else showPanelMsg(text);
    }
    fetch(API + "/" + encodeURIComponent(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: resolved }),
    })
      .then(function (res) {
        if (res.status === 401) {
          fail("Iniciá sesión en Report Hub para resolver comentarios.");
          return null;
        }
        if (!res.ok) {
          fail("No se pudo actualizar el comentario.");
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok) return;
        comments.forEach(function (c) {
          if (c.id === id) c.resolved = resolved;
        });
        updateTab();
        renderFilters();
        renderPanel();
        renderPins();
        if (onDone) onDone();
      })
      .catch(function () {
        fail("No se pudo actualizar el comentario.");
      });
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
    if (!window.confirm("¿Borrar este comentario? No se puede deshacer.")) return;
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
            return c.id !== id && c.parentId !== id;
          });
          updateTab();
          renderFilters();
          renderPanel();
          renderPins();
        }
      })
      .catch(function () {
        showPanelMsg("No se pudo borrar el comentario.");
      });
  }

  function renderFilters() {
    var s = stats();
    var defs = [
      ["all", "Todos", s.total],
      ["pending", "Pendientes", s.pending],
      ["resolved", "Resueltos", s.resolved],
    ];
    panelFilters.hidden = !s.total;
    panelFilters.innerHTML = "";
    defs.forEach(function (d) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (filter === d[0] ? " on" : "");
      b.textContent = d[1] + " (" + d[2] + ")";
      b.addEventListener("click", function () {
        filter = d[0];
        renderFilters();
        renderPanel();
        renderPins();
      });
      panelFilters.appendChild(b);
    });
  }

  function renderPanel() {
    updateTab();

    if (!comments.length) {
      panelList.innerHTML = '<div class="panel-empty">Todavía no hay comentarios.</div>';
      return;
    }

    // Pending first, then resolved; newest first inside each group.
    var roots = comments
      .filter(function (c) {
        return !c.parentId && matchesFilter(c);
      })
      .sort(function (a, b) {
        if (!!a.resolved !== !!b.resolved) return a.resolved ? 1 : -1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

    if (!roots.length) {
      panelList.innerHTML =
        '<div class="panel-empty">' +
        (filter === "pending" ? "No hay comentarios pendientes. 🎉" : "No hay comentarios resueltos todavía.") +
        "</div>";
      return;
    }

    function itemHtml(c, isReply) {
      var buttons = "";
      if (!isReply) {
        buttons += '<button type="button" class="btn btn-quiet pi-reply" style="padding:3px 9px;font-size:10.5px;">Responder</button>';
        if (viewer) {
          buttons +=
            '<button type="button" class="btn btn-quiet pi-resolve" style="padding:3px 9px;font-size:10.5px;">' +
            (c.resolved ? "Reabrir" : "Resolver") + "</button>";
        }
      }
      if (viewer) {
        buttons += '<button type="button" class="btn btn-quiet pi-delete" style="padding:3px 9px;font-size:10.5px;">Borrar</button>';
      }
      return (
        '<div class="pi-top"><span class="pi-author">' + escapeHtml(c.authorName) +
        (!isReply && c.resolved ? '<span class="badge-ok">✓ Resuelto</span>' : "") + "</span>" +
        '<span class="pi-actions">' + buttons + "</span></div>" +
        (c.text ? '<div class="pi-text">' + escapeHtml(c.text) + "</div>" : "") +
        imageHtml(c) +
        '<div class="pi-date">' + formatDate(c.createdAt) +
        (!isReply && !onThisPage(c) ? " · " + escapeHtml(pageLabel(c.page)) : "") + "</div>"
      );
    }

    function stopImageClicks(el) {
      el.querySelectorAll(".c-imglink").forEach(function (a) {
        a.addEventListener("click", function (e) {
          e.stopPropagation();
        });
      });
    }

    panelList.innerHTML = "";
    roots.forEach(function (c) {
      var item = document.createElement("div");
      item.className = "panel-item" + (c.resolved ? " resolved" : "");
      item.innerHTML = itemHtml(c, false);
      stopImageClicks(item);

      comments.forEach(function (r) {
        if (r.parentId !== c.id) return;
        var reply = document.createElement("div");
        reply.className = "pi-reply-item";
        reply.innerHTML = itemHtml(r, true);
        stopImageClicks(reply);
        reply.addEventListener("click", function (e) {
          e.stopPropagation();
        });
        var replyDelete = reply.querySelector(".pi-delete");
        if (replyDelete) {
          replyDelete.addEventListener("click", function (e) {
            e.stopPropagation();
            deleteComment(r.id);
          });
        }
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
      var resolveBtn = item.querySelector(".pi-resolve");
      if (resolveBtn) {
        resolveBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          setResolved(c.id, !c.resolved);
        });
      }
      var deleteBtn = item.querySelector(".pi-delete");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          deleteComment(c.id);
        });
      }
      panelList.appendChild(item);
    });
  }

  // ---------------------------------------------------------------- pins
  // One pin per element with threads that match the current filter. Its number is
  // how many of them are still pending; when all are resolved it shows a tick.
  function renderPins() {
    pinsContainer.innerHTML = "";
    var bySelector = {};
    comments.forEach(function (c) {
      if (c.parentId || !onThisPage(c) || !matchesFilter(c)) return;
      if (!bySelector[c.selector]) bySelector[c.selector] = [];
      bySelector[c.selector].push(c);
    });

    Object.keys(bySelector).forEach(function (selector) {
      var el = findTarget(selector);
      if (!el) return;
      var pending = bySelector[selector].filter(function (c) {
        return !c.resolved;
      }).length;
      var rect = el.getBoundingClientRect();
      var pin = document.createElement("div");
      pin.className = "pin" + (pending ? "" : " resolved");
      pin.textContent = pending ? String(pending) : "✓";
      pin.title = pending ? pending + " pendiente(s)" : "Resuelto";
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

  // ---------------------------------------------------------------- deep link from a notification
  // Links look like /r/<slug>/<page>#rh-comment=<id>: scroll to the element the
  // comment is on and open its thread. Pages rendered by JS may need a moment
  // before the element exists, so retry briefly.
  function focusFromHash() {
    var m = /rh-comment=([A-Za-z0-9_-]+)/.exec(location.hash);
    if (!m) return;
    var target = comments.filter(function (c) {
      return c.id === m[1];
    })[0];
    if (!target) return;
    var rootComment = target.parentId
      ? comments.filter(function (c) {
          return c.id === target.parentId;
        })[0] || target
      : target;

    var tries = 0;
    (function attempt() {
      var el = findTarget(rootComment.selector);
      if (!el) {
        if (++tries < 15) setTimeout(attempt, 300);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      flashHighlight(el);
      setTimeout(function () {
        var r = el.getBoundingClientRect();
        openThread(rootComment.selector, r.left, r.bottom + 6, null);
      }, 500);
    })();
  }

  // ---------------------------------------------------------------- initial load
  fetch(API)
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      comments = (data && data.comments) || [];
      viewer = (data && data.viewer) || null;
      renderFilters();
      renderPins();
      renderPanel();
      focusFromHash();
    })
    .catch(function () {});
})();

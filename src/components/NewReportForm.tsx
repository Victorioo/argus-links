"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { ExternalLinkIcon, EyeIcon, PencilIcon, UploadIcon } from "@/components/Icons";
import { ClientPeriodFields } from "@/components/ClientPeriodFields";
import { VisibilityControl, type Visibility } from "@/components/VisibilityControl";

function previewSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type Published = { id: string; slug: string };

// A .zip can be big; reading its index.html in the browser is only worth it up to here.
const MAX_ZIP_FOR_AUTOFILL = 60 * 1024 * 1024;

type AiNote = { kind: "ok" | "error"; text: string };

// The page Claude should read in a .zip: index.html, or the shallowest .html.
async function readZipEntryHtml(file: File): Promise<string | null> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(file);
  const pages = Object.values(zip.files)
    .filter((f) => !f.dir && /\.html?$/i.test(f.name) && !f.name.startsWith("__MACOSX/"))
    .sort((a, b) => {
      const ai = /(^|\/)index\.html?$/i.test(a.name) ? 0 : 1;
      const bi = /(^|\/)index\.html?$/i.test(b.name) ? 0 : 1;
      return ai - bi || a.name.split("/").length - b.name.split("/").length;
    });
  return pages.length ? pages[0].async("string") : null;
}

export function NewReportForm({
  knownClients,
  aiEnabled,
}: {
  knownClients: string[];
  aiEnabled: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [client, setClient] = useState("");
  const [period, setPeriod] = useState("");
  const [slugOverride, setSlugOverride] = useState("");
  const [html, setHtml] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState(0);
  const [uploadStage, setUploadStage] = useState<"" | "zip" | "creating">("");
  const [dragOver, setDragOver] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [allowComments, setAllowComments] = useState(false);
  const [internal, setInternal] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");
  const [password, setPassword] = useState("");
  const [viewerIds, setViewerIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [published, setPublished] = useState<Published | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiNote, setAiNote] = useState<AiNote | null>(null);
  // What Claude reads when the upload is a .zip (its main page), kept for "Analizar de nuevo".
  const [zipHtml, setZipHtml] = useState<string | null>(null);
  // Fields the person has edited by hand: Claude never overwrites those.
  const touched = useRef<Set<string>>(new Set());
  const analyzeSeq = useRef(0);

  const touch = (field: string) => touched.current.add(field);

  async function runAutofill(source: string) {
    if (!aiEnabled || !source.trim()) return;
    const seq = ++analyzeSeq.current;
    setAnalyzing(true);
    setAiNote(null);
    try {
      const res = await fetch("/api/reports/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: source }),
      });
      const data = await res.json().catch(() => ({}));
      if (seq !== analyzeSeq.current) return; // a newer file replaced this one
      if (!res.ok) {
        setAiNote({ kind: "error", text: data.error || "No se pudo autocompletar. Completalo a mano." });
        return;
      }
      const t = touched.current;
      if (!t.has("title") && data.title) setTitle(data.title);
      if (!t.has("description") && data.description) setDescription(data.description);
      if (!t.has("client")) setClient(data.client ?? "");
      if (!t.has("period") && data.period) setPeriod(data.period);
      if (!t.has("internal")) setInternal(!!data.internal);
      if (!t.has("slug") && data.slug) setSlugOverride(data.slug);
      setAiNote({ kind: "ok", text: "Completado con Claude. Revisá los datos antes de publicar." });
    } catch {
      if (seq === analyzeSeq.current) {
        setAiNote({ kind: "error", text: "No se pudo autocompletar. Completalo a mano." });
      }
    } finally {
      if (seq === analyzeSeq.current) setAnalyzing(false);
    }
  }

  const slug = slugOverride ? previewSlug(slugOverride) : previewSlug(title);

  async function handleFile(file: File) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      setZipFile(file);
      setHtml("");
      setFileName(file.name);
      setFileSize(file.size);
      if (!title) setTitle(file.name.replace(/\.zip$/i, ""));
      setZipHtml(null);
      if (aiEnabled && file.size <= MAX_ZIP_FOR_AUTOFILL) {
        setAnalyzing(true);
        const entry = await readZipEntryHtml(file).catch(() => null);
        setZipHtml(entry);
        if (entry) runAutofill(entry);
        else setAnalyzing(false);
      }
      return;
    }

    const text = await file.text();
    setHtml(text);
    setZipFile(null);
    setFileName(file.name);
    setFileSize(file.size);
    if (!title) {
      setTitle(file.name.replace(/\.html?$/i, ""));
    }
    setZipHtml(null);
    runAutofill(text);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!html.trim() && !zipFile) {
      setError("Subí un archivo .html o .zip, o pegá el contenido");
      return;
    }

    if (visibility === "PASSWORD" && !password.trim()) {
      setError("Ingresá una contraseña de acceso");
      return;
    }

    setPending(true);

    const commonBody = {
      title,
      description,
      client,
      period,
      slug: slugOverride || undefined,
      allowComments,
      internal,
      visibility,
      password: visibility === "PASSWORD" ? password : undefined,
      viewerIds: visibility === "RESTRICTED" ? viewerIds : undefined,
    };

    let res: Response;
    try {
      if (zipFile) {
        setUploadStage("zip");
        const blob = await upload(zipFile.name, zipFile, {
          access: "public",
          handleUploadUrl: "/api/blob/upload-zip",
        });
        setUploadStage("creating");
        res = await fetch("/api/reports/from-zip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...commonBody, blobUrl: blob.url }),
        });
      } else {
        setUploadStage("creating");
        res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...commonBody, html }),
        });
      }
    } catch {
      setPending(false);
      setUploadStage("");
      setError("No se pudo subir el archivo. Probá de nuevo.");
      return;
    }

    const data = await res.json().catch(() => ({}));
    setPending(false);
    setUploadStage("");

    if (!res.ok) {
      setError(data.error || "No se pudo subir el reporte");
      return;
    }

    setPublished({ id: data.id, slug: data.slug });
  }

  function reset() {
    setTitle("");
    setDescription("");
    setClient("");
    setPeriod("");
    setSlugOverride("");
    setHtml("");
    setZipFile(null);
    setFileName(null);
    setFileSize(0);
    setShowPreview(false);
    setPublished(null);
    setUploadStage("");
    touched.current = new Set();
    setZipHtml(null);
    analyzeSeq.current++;
    setAnalyzing(false);
    setAiNote(null);
    setAllowComments(false);
    setInternal(false);
    setVisibility("PUBLIC");
    setPassword("");
    setViewerIds([]);
  }

  if (published) {
    return (
      <section className="panel result">
        <div className="tag">
          <span className="d" />
          Link listo para entregar
        </div>
        <a
          href={`/r/${published.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="url"
        >
          {typeof window !== "undefined" ? window.location.origin : ""}/r/{published.slug}
        </a>
        <div className="btn-row">
          <CopyLinkButton path={`/r/${published.slug}`} gold />
          <a href={`/r/${published.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
            <ExternalLinkIcon />
            Abrir página
          </a>
          <Link href={`/reports/${published.id}`} className="btn btn-quiet">
            <PencilIcon />
            Editar detalles
          </Link>
          <button type="button" onClick={reset} className="btn btn-quiet">
            <UploadIcon />
            Subir otro
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel" id="uploader">
      <form onSubmit={handleSubmit}>
        {fileName ? (
          <div className="file-pill">
            <span className="fi">{zipFile ? "ZIP" : "HTML"}</span>
            <div>
              <div className="fn">{fileName}</div>
              <div className="fs">{formatSize(fileSize)}</div>
            </div>
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Cambiar
            </button>
          </div>
        ) : (
          <label
            className={`drop${dragOver ? " over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
          >
            <span className="ico">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M6 10l6-6 6 6" />
                <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
              </svg>
            </span>
            <span className="t">Arrastrá aquí tu .html o .zip</span>
            <span className="s">el .zip puede traer fotos, videos y otros archivos sueltos</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm,.zip,text/html,application/zip"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
        )}

        {aiEnabled && (analyzing || aiNote || html || zipFile) && (
          <div className={`ai-note${aiNote?.kind === "error" ? " err" : ""}${analyzing ? " busy" : ""}`}>
            <span aria-hidden="true">✦</span>
            <span>{analyzing ? "Claude está leyendo el reporte…" : aiNote?.text ?? "Autocompletá los datos con Claude."}</span>
            {!analyzing && (html || zipHtml) && (
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => {
                  touched.current = new Set();
                  runAutofill(html || zipHtml || "");
                }}
              >
                {aiNote ? "Analizar de nuevo" : "Autocompletar"}
              </button>
            )}
          </div>
        )}

        <details style={{ marginTop: 14, fontSize: "0.85rem" }} hidden={!!zipFile}>
          <summary className="mono-label" style={{ cursor: "pointer" }}>
            O pegá el HTML directamente
          </summary>
          <textarea
            value={html}
            onChange={(e) => {
              setHtml(e.target.value);
              setFileSize(new Blob([e.target.value]).size);
            }}
            rows={8}
            placeholder="<!doctype html>..."
            className="input"
            style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: "0.78rem" }}
          />
        </details>

        <div className="fields">
          <div className="field">
            <label className="mono-label" htmlFor="title">
              Título
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => {
                touch("title");
                setTitle(e.target.value);
              }}
              className="input"
              style={{ marginTop: 8 }}
            />
          </div>
          <div className="field">
            <label className="mono-label" htmlFor="description">
              Descripción (opcional)
            </label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => {
                touch("description");
                setDescription(e.target.value);
              }}
              className="input"
              style={{ marginTop: 8 }}
            />
          </div>
        </div>

        <ClientPeriodFields
          client={client}
          period={period}
          onClientChange={(v) => {
            touch("client");
            setClient(v);
          }}
          onPeriodChange={(v) => {
            touch("period");
            setPeriod(v);
          }}
          knownClients={knownClients}
        />

        <div className="field" style={{ marginTop: 14 }}>
          <label className="mono-label" htmlFor="slug">
            Link
          </label>
          <div className="slug-box" style={{ marginTop: 8 }}>
            <span className="pre">/r/</span>
            <input
              id="slug"
              value={slugOverride}
              onChange={(e) => {
                touch("slug");
                setSlugOverride(e.target.value);
              }}
              placeholder={slug || "se genera del título"}
              autoComplete="off"
              spellCheck={false}
              maxLength={80}
            />
          </div>
          <div className="hint">Solo minúsculas, números y guiones.</div>
        </div>

        <label className="replace" style={{ marginTop: 14, display: "flex" }}>
          <input
            type="checkbox"
            checked={internal}
            onChange={(e) => {
              touch("internal");
              setInternal(e.target.checked);
            }}
          />
          Reporte interno de Argus (no es para un cliente)
        </label>

        <label className="replace" style={{ marginTop: 14, display: "flex" }}>
          <input
            type="checkbox"
            checked={allowComments}
            onChange={(e) => setAllowComments(e.target.checked)}
          />
          Permitir comentarios (cualquiera con el link podrá comentar sobre el reporte)
        </label>

        <VisibilityControl
          visibility={visibility}
          onVisibilityChange={setVisibility}
          password={password}
          onPasswordChange={setPassword}
          viewerIds={viewerIds}
          onViewerIdsChange={setViewerIds}
        />

        {html && (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="btn btn-ghost btn-sm"
            >
              <EyeIcon />
              {showPreview ? "Ocultar vista previa" : "Ver vista previa"}
            </button>
            {showPreview && (
              <iframe
                srcDoc={html}
                sandbox=""
                style={{ marginTop: 10, height: 384, width: "100%", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}
              />
            )}
          </div>
        )}

        {zipFile && (
          <div className="hint">La vista previa no está disponible para archivos .zip todavía.</div>
        )}

        {error && <div className="err">{error}</div>}

        <div className="actions">
          <button type="submit" disabled={pending || analyzing} className="btn btn-primary">
            {uploadStage === "zip"
              ? "Subiendo ZIP..."
              : uploadStage === "creating"
                ? "Procesando..."
                : "Publicar reporte"}
          </button>
        </div>
      </form>
    </section>
  );
}

"use client";

import { ChangeEvent, FormEvent, MouseEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type UserRole = "Admin" | "Viewer";
type UserSession = {
  name: string;
  role: UserRole;
};

type Annotation = {
  id: string;
  documentId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "DOCUMENT" | "COMMENT" | "NOT_RELEVANT";
  category: string;
  comment: string;
  linkedDocumentId?: string;
};

type DraftAnnotation = Omit<Annotation, "x" | "y" | "width" | "height"> & {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DocumentType = "BANK" | "INVOICE";

type DocumentModel = {
  id: string;
  name: string;
  aliasName: string;
  type: DocumentType;
  filePath: string;
  pageCount: number;
  createdAt: string;
};

const MIN_ANNOTATION_SIZE = 20;

const sectionName: Record<DocumentType, string> = {
  BANK: "Bank Documents",
  INVOICE: "Invoices",
};

export default function DashboardClient() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [role, setRole] = useState<UserRole>("Viewer");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [documents, setDocuments] = useState<DocumentModel[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [drawingRect, setDrawingRect] = useState<DraftAnnotation | null>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isLoadingAnnotations, setIsLoadingAnnotations] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingAlias, setEditingAlias] = useState("");
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const fullscreenIframeRef = useRef<HTMLIFrameElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isFullscreenOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreenOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreenOpen]);

  useLayoutEffect(() => {
    const image = imgRef.current;
    if (!image) return;

    const updateSize = () => {
      const rect = image.getBoundingClientRect();
      setImageSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(image);

    return () => {
      observer.disconnect();
    };
  }, [selectedId, currentPage]);

  const downloadLinkedDocument = () => {
    if (!linkedDocument) return;
    const anchor = document.createElement("a");
    anchor.href = linkedDocument.filePath;
    anchor.download = linkedDocument.name || "document.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const printLinkedDocument = (iframeRef: { current: HTMLIFrameElement | null }) => {
    if (!linkedDocument) return;
    const iframe = iframeRef.current;

    if (iframe?.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      return;
    }

    const win = window.open(linkedDocument.filePath, "_blank");
    if (win) {
      win.focus();
      win.print();
    }
  };

  const openFullscreen = () => {
    if (!linkedDocument) return;
    setIsFullscreenOpen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreenOpen(false);
  };

  const loadDocuments = async () => {
    setIsLoadingDocuments(true);
    const response = await fetch("/api/documents");
    if (!response.ok) {
      setIsLoadingDocuments(false);
      return;
    }

    const data = (await response.json()) as DocumentModel[];
    setDocuments(data);
    setIsLoadingDocuments(false);
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setAnnotations([]);
      return;
    }

    const loadAnnotations = async () => {
      setIsLoadingAnnotations(true);
      const response = await fetch(`/api/annotations?documentId=${selectedId}&page=${currentPage}`);
      if (!response.ok) {
        setIsLoadingAnnotations(false);
        return;
      }

      const data = (await response.json()) as Annotation[];
      setAnnotations(data);
      setSelectedAnnotationId(null);
      setIsLoadingAnnotations(false);
    };

    loadAnnotations();
  }, [selectedId, currentPage]);

  const selectedItem = useMemo(
    () => (selectedId ? documents.find((document) => document.id === selectedId) ?? null : null),
    [selectedId, documents]
  );

  const currentDocumentAnnotations = useMemo(
    () => (selectedId ? annotations.filter((annotation) => annotation.documentId === selectedId && annotation.page === currentPage) : []),
    [annotations, selectedId, currentPage]
  );

  const selectedAnnotation = useMemo(
    () => currentDocumentAnnotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null,
    [currentDocumentAnnotations, selectedAnnotationId]
  );

  const currentPageCount = selectedItem?.pageCount ?? 1;

  const pageList = useMemo(
    () => (selectedItem ? Array.from({ length: selectedItem.pageCount }, (_, index) => index + 1) : []),
    [selectedItem]
  );

  useEffect(() => {
    const handlePageKeys = (event: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") {
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        setCurrentPage((value) => Math.max(1, value - 1));
      }

      if (event.key === "ArrowRight" || event.key === "PageDown") {
        setCurrentPage((value) => Math.min(currentPageCount, value + 1));
      }
    };

    window.addEventListener("keydown", handlePageKeys);
    return () => window.removeEventListener("keydown", handlePageKeys);
  }, [currentPageCount]);

  const groupedDocuments = useMemo(
    () =>
      documents.reduce<Record<string, DocumentModel[]>>((groups, document) => {
        const section = sectionName[document.type];
        groups[section] = groups[section] ?? [];
        groups[section].push(document);
        return groups;
      }, {}),
    [documents]
  );

  const invoiceDocuments = useMemo(
    () => documents.filter((document) => document.type === "INVOICE"),
    [documents]
  );

  useEffect(() => {
    if (selectedAnnotationId) {
      const found = currentDocumentAnnotations.some((annotation) => annotation.id === selectedAnnotationId);
      if (!found) {
        setSelectedAnnotationId(null);
      }
    }
  }, [currentDocumentAnnotations, selectedAnnotationId]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedAnnotationId(null);
  }, [selectedId]);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const session = { name: `${role} User`, role };
    setUser(session);
  };

  const handleLogout = () => {
    setUser(null);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        setUploadError(errorData?.error || "Upload failed.");
        return;
      }

      await loadDocuments();
    } catch (error) {
      setUploadError("Upload failed.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDocumentRename = async (documentId: string, aliasName: string) => {
    const trimmed = aliasName.trim();
    if (!trimmed) {
      return;
    }

    const response = await fetch(`/api/documents/${documentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aliasName: trimmed }),
    });

    if (!response.ok) {
      return;
    }

    setEditingDocumentId(null);
    setEditingAlias("");
    await loadDocuments();
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !selectedId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setSelectedAnnotationId(null);
    setStartPoint({ x, y });
    setDrawingRect({
      id: "",
      documentId: selectedId,
      page: currentPage,
      x,
      y,
      width: 0,
      height: 0,
      type: "DOCUMENT",
      category: "Review",
      comment: "New annotation",
      linkedDocumentId: undefined,
    });
  };

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!startPoint) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const currentX = (event.clientX - rect.left) / rect.width;
    const currentY = (event.clientY - rect.top) / rect.height;
    const x = Math.min(startPoint.x, currentX);
    const y = Math.min(startPoint.y, currentY);
    const width = Math.abs(currentX - startPoint.x);
    const height = Math.abs(currentY - startPoint.y);
    setDrawingRect((current) =>
      current ? { ...current, x, y, width, height } : null
    );
  };

  const commitAnnotation = async () => {
    if (!drawingRect || !selectedId) {
      setDrawingRect(null);
      setStartPoint(null);
      return;
    }

    const viewerWidth = imageSize.width || 1;
    const viewerHeight = imageSize.height || 1;
    const pixelWidth = drawingRect.width * viewerWidth;
    const pixelHeight = drawingRect.height * viewerHeight;

    if (pixelWidth < MIN_ANNOTATION_SIZE || pixelHeight < MIN_ANNOTATION_SIZE) {
      setDrawingRect(null);
      setStartPoint(null);
      return;
    }

    const nextType: Annotation["type"] =
      annotations.length % 3 === 0
        ? "DOCUMENT"
        : annotations.length % 3 === 1
        ? "COMMENT"
        : "NOT_RELEVANT";

    const payload = {
      documentId: selectedId,
      page: currentPage,
      x: Math.max(0, Math.min(1, drawingRect.x)),
      y: Math.max(0, Math.min(1, drawingRect.y)),
      width: Math.max(0, Math.min(1, drawingRect.width)),
      height: Math.max(0, Math.min(1, drawingRect.height)),
      type: nextType,
      category:
        annotations.length % 3 === 0
          ? "Bank entry"
          : annotations.length % 3 === 1
          ? "Invoice note"
          : "Review",
      comment:
        annotations.length % 3 === 0
          ? "Review this bank area"
          : annotations.length % 3 === 1
          ? "Check invoice detail"
          : "Mark as not relevant",
      linkedDocumentId: undefined,
    };

    const response = await fetch("/api/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setDrawingRect(null);
      setStartPoint(null);
      return;
    }

    const createdAnnotation = (await response.json()) as Annotation;
    setAnnotations((current) => [...current, createdAnnotation]);
    setSelectedAnnotationId(createdAnnotation.id);
    setDrawingRect(null);
    setStartPoint(null);
  };

  const pageAnnotationCount = currentDocumentAnnotations.length;

  const handleMouseUp = () => {
    commitAnnotation();
  };

  const handleMouseLeave = () => {
    if (startPoint) {
      commitAnnotation();
    }
  };

  const handleAnnotationDelete = async (annotationId: string) => {
    const response = await fetch(`/api/annotations/${annotationId}`, {
      method: "DELETE",
    });

    if (!response.ok) return;

    setAnnotations((current) => current.filter((annotation) => annotation.id !== annotationId));
    if (selectedAnnotationId === annotationId) {
      setSelectedAnnotationId(null);
    }
  };

  const updateSelectedAnnotation = async (updates: Partial<Omit<Annotation, "id" | "x" | "y" | "width" | "height">>) => {
    if (!selectedAnnotationId) return;

    const response = await fetch(`/api/annotations/${selectedAnnotationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) return;

    const updatedAnnotation = (await response.json()) as Annotation;
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === selectedAnnotationId ? updatedAnnotation : annotation
      )
    );
  };

  const linkedDocument = selectedAnnotation
    ? documents.find((document) => document.id === selectedAnnotation.linkedDocumentId)
    : null;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12 text-zinc-900">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Sign in to TaxSpeedy</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Choose a role to continue. Admin can later manage documents and annotations.
          </p>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-zinc-700" htmlFor="role">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-slate-900"
              >
                <option value="Admin">Admin</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Sign in as {role}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "Admin";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
              TaxSpeedy
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Document analysis dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700">
              {user.role}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full bg-zinc-900 px-3 py-1 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-88px)] max-w-auto gap-6 px-6 py-8 lg:grid-cols-[250px_minmax(0,1fr)_minmax(0,1fr)]">
        {/* COLUMN 1 */}
        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Navigation</h2>
              <p className="mt-2 text-sm text-zinc-600">Browse bank documents and invoices.</p>
            </div>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
              {isAdmin ? "Admin access" : "Viewer access"}
            </span>
          </div>
          {isAdmin ? (
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={handleUploadClick}
                disabled={isUploading}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
              >
                {isUploading ? "Uploading…" : "Upload PDFs"}
              </button>
              {uploadError ? <p className="text-sm text-red-600">{uploadError}</p> : null}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />
            </div>
          ) : null}
          <div className="mt-5 space-y-5">
            {Object.entries(groupedDocuments).map(([section, sectionItems]) => (
              <div key={section}>
                <p className="text-sm font-semibold text-zinc-900">{section}</p>
                <ul className="mt-3 space-y-2 border-l border-zinc-200 pl-4 text-sm text-zinc-700">
                  {sectionItems.map((item) => (
                    <li key={item.id}>
                      <div className="flex items-center gap-2">
                        {editingDocumentId === item.id ? (
                          <input
                            type="text"
                            autoFocus
                            value={editingAlias}
                            onChange={(event) => setEditingAlias(event.target.value)}
                            onBlur={() => handleDocumentRename(item.id, editingAlias)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                handleDocumentRename(item.id, editingAlias);
                              }
                            }}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(item.id);
                              setSelectedAnnotationId(null);
                              setCurrentPage(1);
                            }}
                            className={`w-full rounded-2xl px-3 py-2 text-left text-sm transition ${
                              selectedId === item.id
                                ? "bg-slate-900 text-white"
                                : "text-zinc-700 hover:text-slate-900 hover:bg-zinc-100"
                            }`}
                          >
                            {item.aliasName}
                          </button>
                        )}
                        {isAdmin && editingDocumentId !== item.id ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDocumentId(item.id);
                              setEditingAlias(item.aliasName);
                            }}
                            className="rounded-full px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-100"
                            aria-label={`Rename ${item.aliasName}`}
                          >
                            ✏️
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        {/* COLUMN 2 */}
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
                Document viewer
              </p>
              <h2 className="mt-2 text-2xl font-semibold">{selectedItem ? selectedItem.aliasName : "Select a document"}</h2>
              <p className="mt-2 text-sm text-zinc-600">
                {selectedItem ? (selectedItem.type === "BANK" ? "Bank document preview" : "Invoice preview") : "Choose a document from the left to start."}
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end sm:flex-row sm:gap-4">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                Ready
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
                  disabled={!selectedItem || currentPage === 1}
                  className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
                >
                  Previous
                </button>
                <span className="text-sm text-zinc-700">
                  {selectedItem ? `Page ${currentPage} / ${currentPageCount}` : "No document selected"}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((value) => Math.min(currentPageCount, value + 1))}
                  disabled={!selectedItem || currentPage === currentPageCount}
                  className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {selectedItem ? (
              pageList.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-[72px] rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                    page === currentPage
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-slate-900 hover:bg-zinc-50"
                  }`}
                >
                  Page {page}
                </button>
              ))
            ) : (
              <div className="min-w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
                Select a document to enable page navigation.
              </div>
            )}
          </div>

          <div className="mt-6 rounded-3xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-5">
            <div className="text-sm font-medium text-zinc-900">Draw annotations on the placeholder page</div>
            <div className="relative mt-4 mx-auto max-w-full overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
              {selectedItem ? (
                <>
                  <img
                    ref={imgRef}
                    src={`/api/documents/${selectedId}/page/${currentPage}`}
                    alt={`${selectedItem.aliasName} page ${currentPage}`}
                    className="w-full h-auto object-contain block"
                    onLoad={() => {
                      if (!imgRef.current) return;
                      const rect = imgRef.current.getBoundingClientRect();
                      setImageSize({
                        width: rect.width,
                        height: rect.height,
                      });
                    }}
                  />
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2"
                    style={{
                      width: imageSize.width,
                      height: imageSize.height,
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className="absolute inset-x-0 top-4 flex justify-center text-xs uppercase tracking-[0.24em] text-zinc-400">
                      Page {currentPage} preview
                    </div>

                    {currentDocumentAnnotations.map((annotation) => {
                      const renderWidth = imageSize.width || 1;
                      const renderHeight = imageSize.height || 1;
                      return (
                        <div
                          key={annotation.id}
                          className={`group absolute rounded-sm border-2 bg-cyan-500/10 transition ${
                            selectedAnnotationId === annotation.id
                              ? "border-fuchsia-500 bg-fuchsia-500/15"
                              : "border-cyan-500/80 hover:border-slate-900"
                          } cursor-pointer`}
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedAnnotationId(annotation.id);
                          }}
                          style={{
                            left: annotation.x * renderWidth,
                            top: annotation.y * renderHeight,
                            width: annotation.width * renderWidth,
                            height: annotation.height * renderHeight,
                          }}
                        >
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleAnnotationDelete(annotation.id);
                            }}
                            className="absolute -right-3 -top-3 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white bg-white/90 text-xs font-bold text-zinc-700 opacity-0 shadow transition-opacity duration-150 hover:bg-red-500 hover:text-white group-hover:opacity-100"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}

                    {drawingRect && (
                      <div
                        className="pointer-events-none absolute rounded-sm border-2 border-slate-900/70 bg-slate-900/10"
                        style={{
                          left: drawingRect.x * imageSize.width,
                          top: drawingRect.y * imageSize.height,
                          width: drawingRect.width * imageSize.width,
                          height: drawingRect.height * imageSize.height,
                        }}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="flex min-h-[260px] items-center justify-center p-10 text-sm text-zinc-500">
                  Select a document from the left menu to load the preview and start annotating.
                </div>
              )}
            </div>
            <div className="mt-4 rounded-3xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
              Annotations: {currentDocumentAnnotations.length}
            </div>
          </div>
        </section>
        {/* COLUMN 3 */}   
        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Invoice preview</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Select a linked invoice to inspect it alongside the annotation.
              </p>
            </div>
          </div>
          <div className="mt-5 rounded-3xl bg-zinc-50 p-4 text-sm text-zinc-600">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="mb-4 rounded-2xl bg-zinc-100 p-3 text-sm text-zinc-700">
                <p className="font-semibold text-zinc-900">Current document</p>
                {selectedItem ? (
                  <>
                    <p className="mt-1 text-zinc-700">{selectedItem.aliasName}</p>
                    <p className="mt-1 text-sm text-zinc-500">{selectedItem.pageCount} page(s)</p>
                  </>
                ) : (
                  <p className="mt-1 text-zinc-500">Select a document from the left panel to view details.</p>
                )}
              </div>
              {!selectedAnnotation ? (
                <>
                  <p className="font-semibold text-zinc-900">No annotation selected</p>
                  <p className="mt-2 text-zinc-700">
                    Click a rectangle on the document preview to view details here.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-zinc-900">Annotation details</p>
                  <div className="mt-4 space-y-4 text-sm text-zinc-700">
                    <div className="grid gap-3">
                      <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Type
                          </label>
                          <select
                            value={selectedAnnotation.type}
                            onChange={(event) =>
                              updateSelectedAnnotation({ type: event.target.value as Annotation["type"] })
                            }
                            className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none"
                          >
                            <option value="DOCUMENT">DOCUMENT</option>
                            <option value="COMMENT">COMMENT</option>
                            <option value="NOT_RELEVANT">NOT_RELEVANT</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Category
                          </label>
                          <input
                            type="text"
                            value={selectedAnnotation.category}
                            onChange={(event) => updateSelectedAnnotation({ category: event.target.value })}
                            className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Comment
                        </label>
                        <textarea
                          value={selectedAnnotation.comment}
                          onChange={(event) => updateSelectedAnnotation({ comment: event.target.value })}
                          rows={3}
                          className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Linked document
                        </label>
                        <select
                          value={selectedAnnotation.linkedDocumentId ?? ""}
                          onChange={(event) =>
                            updateSelectedAnnotation({
                              linkedDocumentId: event.target.value || undefined,
                            })
                          }
                          className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none"
                        >
                          <option value="">No document linked</option>
                          {invoiceDocuments.map((invoice) => (
                            <option key={invoice.id} value={invoice.id}>
                              {invoice.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-zinc-100 p-3 text-sm text-zinc-700">
                      {linkedDocument ? (
                        <div>
                          <p className="font-semibold text-zinc-900">Linked invoice</p>
                          <p className="mt-1 text-zinc-700">{linkedDocument.name}</p>
                          <p className="mt-1 text-sm text-zinc-500">{linkedDocument.pageCount} page(s)</p>
                        </div>
                      ) : (
                        <div className="text-zinc-500">No document linked</div>
                      )}
                    </div>

                    <div className="rounded-3xl border border-zinc-200 bg-white p-0 text-sm text-zinc-700">
                      <div className="flex flex-col gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-zinc-900">Preview</p>
                          <p className="text-xs text-zinc-500">Open, download, or print the linked invoice.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={openFullscreen}
                            disabled={!linkedDocument}
                            className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
                          >
                            Open fullscreen
                          </button>
                          <button
                            type="button"
                            onClick={downloadLinkedDocument}
                            disabled={!linkedDocument}
                            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
                          >
                            Download
                          </button>
                          <button
                            type="button"
                            onClick={() => printLinkedDocument(previewIframeRef)}
                            disabled={!linkedDocument}
                            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
                          >
                            Print
                          </button>
                        </div>
                      </div>
                      {linkedDocument ? (
                        <div className="h-[360px] overflow-hidden rounded-b-3xl bg-zinc-950">
                          <iframe
                            ref={previewIframeRef}
                            src={linkedDocument.filePath}
                            title={linkedDocument.name}
                            className="h-full w-full"
                          />
                        </div>
                      ) : (
                        <div className="flex h-[360px] items-center justify-center rounded-b-3xl border-t border-dashed border-zinc-200 bg-zinc-50 text-zinc-500">
                          No preview available
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl bg-zinc-100 p-3 text-xs text-zinc-600">
                      Position: {(selectedAnnotation.x * 100).toFixed(1)}%, {(selectedAnnotation.y * 100).toFixed(1)}%
                      <br />
                      Size: {(selectedAnnotation.width * 100).toFixed(1)}% x {(selectedAnnotation.height * 100).toFixed(1)}%
                    </div>
                  </div>
                </>
              )}
              <p className="mt-4 rounded-2xl bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-600">
                {isAdmin
                  ? "Admin mode: you can upload documents and create annotations later."
                  : "Viewer mode: read-only access for document review."}
              </p>
            </div>
          </div>
        </section>
      </main>

      {isFullscreenOpen && linkedDocument ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-zinc-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-zinc-900">Fullscreen invoice preview</p>
                <p className="mt-1 text-sm text-zinc-500">{linkedDocument.name}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadLinkedDocument}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => printLinkedDocument(fullscreenIframeRef)}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
                >
                  Print
                </button>
                <button
                  type="button"
                  onClick={closeFullscreen}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-zinc-900">
              <iframe
                ref={fullscreenIframeRef}
                src={linkedDocument.filePath}
                title={linkedDocument.name}
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { ChangeEvent, DragEvent, FormEvent, MouseEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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
  type: "DOCUMENT" | "INVOICE" | "COMMENT" | "NOT_RELEVANT";
  category: string;
  comment: string;
  linkedDocumentId?: string | null;
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
  const [annotationUploadError, setAnnotationUploadError] = useState<string | null>(null);
  const [isAnnotationDropActive, setIsAnnotationDropActive] = useState(false);
  const [categoryInput, setCategoryInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const saveTimeoutRef = useRef<number | null>(null);
  const pendingAnnotationUpdateRef = useRef<Partial<Omit<Annotation, "id" | "x" | "y" | "width" | "height">> | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingAlias, setEditingAlias] = useState("");
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const annotationFileInputRef = useRef<HTMLInputElement | null>(null);
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

  const loadAnnotations = async () => {
    setIsLoadingAnnotations(true);
    const response = await fetch("/api/annotations");
    if (!response.ok) {
      setIsLoadingAnnotations(false);
      return;
    }

    const data = (await response.json()) as Annotation[];
    setAnnotations(data);
    setIsLoadingAnnotations(false);
  };

  useEffect(() => {
    loadDocuments();
    loadAnnotations();
  }, []);

  const selectedItem = useMemo(
    () => (selectedId ? documents.find((document) => document.id === selectedId) ?? null : null),
    [selectedId, documents]
  );

  const currentDocumentAnnotations = useMemo(
    () => (selectedId ? annotations.filter((annotation) => annotation.documentId === selectedId && annotation.page === currentPage) : []),
    [annotations, selectedId, currentPage]
  );

  const invoiceCountsByDocument = useMemo(() => {
    return annotations.reduce<Record<string, number>>((counts, annotation) => {
      if (annotation.type === "INVOICE") {
        counts[annotation.documentId] = (counts[annotation.documentId] ?? 0) + 1;
      }
      return counts;
    }, {});
  }, [annotations]);

  const pageInvoiceCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    if (!selectedId) return counts;

    annotations.forEach((annotation) => {
      if (annotation.documentId === selectedId && annotation.type === "INVOICE") {
        counts[annotation.page] = (counts[annotation.page] ?? 0) + 1;
      }
    });

    return counts;
  }, [annotations, selectedId]);

  const selectedAnnotation = useMemo(
    () => currentDocumentAnnotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null,
    [currentDocumentAnnotations, selectedAnnotationId]
  );

  useEffect(() => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    pendingAnnotationUpdateRef.current = null;
    setCategoryInput(selectedAnnotation?.category ?? "");
    setCommentInput(selectedAnnotation?.comment ?? "");
    setSaveStatus("saved");
    setIsAnnotationDropActive(false);
  }, [selectedAnnotation?.id]);

  const annotationTypeLabel: Record<Annotation["type"], string> = {
    DOCUMENT: "Document",
    INVOICE: "Invoice",
    COMMENT: "Comment",
    NOT_RELEVANT: "Not relevant",
  };

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
      formData.append("type", "BANK");
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

  const handleDocumentDelete = async (documentId: string, aliasName: string) => {
    const confirmed = window.confirm(`Delete ${aliasName}? This will remove the document and all annotations.`);
    if (!confirmed) {
      return;
    }

    setDeletingDocumentId(documentId);

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        return;
      }

      if (selectedId === documentId) {
        setSelectedId(null);
        setSelectedAnnotationId(null);
        setCurrentPage(1);
      }

      await loadDocuments();
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const uploadAnnotationInvoiceFile = async (file: File) => {
    if (!selectedAnnotationId) return;

    setAnnotationUploadError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("type", "INVOICE");
      formData.append("files", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        setAnnotationUploadError(errorData?.error || "Invoice upload failed.");
        return;
      }

      const uploaded = (await response.json()) as DocumentModel[];
      if (!uploaded.length) {
        setAnnotationUploadError("Invoice upload failed.");
        return;
      }

      const invoice = uploaded[0];
      await loadDocuments();
      await updateSelectedAnnotation({ linkedDocumentId: invoice.id }, selectedAnnotationId);
    } catch (error) {
      setAnnotationUploadError("Invoice upload failed.");
    } finally {
      setIsUploading(false);
      if (annotationFileInputRef.current) {
        annotationFileInputRef.current.value = "";
      }
    }
  };

  const handleAnnotationInvoiceUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) {
      return;
    }

    await uploadAnnotationInvoiceFile(files[0]);
  };

  const handleAnnotationDrop = async (event: DragEvent<HTMLDivElement>) => {
    if (!isAdmin || !selectedAnnotation || selectedAnnotation.id !== selectedAnnotationId) {
      setIsAnnotationDropActive(false);
      return;
    }

    if (!["DOCUMENT", "INVOICE"].includes(selectedAnnotation.type)) {
      setIsAnnotationDropActive(false);
      return;
    }

    event.preventDefault();
    setIsAnnotationDropActive(false);

    const file = event.dataTransfer?.files?.[0];
    if (!file || !(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
      setAnnotationUploadError("Please drop a PDF file.");
      return;
    }

    await uploadAnnotationInvoiceFile(file);
  };

  const openAnnotationInvoicePicker = () => {
    annotationFileInputRef.current?.click();
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
      type: "INVOICE",
      category: "",
      comment: "",
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

    const payload = {
      documentId: selectedId,
      page: currentPage,
      x: Math.max(0, Math.min(1, drawingRect.x)),
      y: Math.max(0, Math.min(1, drawingRect.y)),
      width: Math.max(0, Math.min(1, drawingRect.width)),
      height: Math.max(0, Math.min(1, drawingRect.height)),
      type: drawingRect.type || "INVOICE",
      category: drawingRect.category,
      comment: drawingRect.comment,
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

  const updateSelectedAnnotation = async (
    updates: Partial<Omit<Annotation, "id" | "x" | "y" | "width" | "height">>,
    annotationId: string | null = selectedAnnotationId
  ) => {
    if (!annotationId) return false;

    const response = await fetch(`/api/annotations/${annotationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) return false;

    const updatedAnnotation = (await response.json()) as Annotation;
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === annotationId ? updatedAnnotation : annotation
      )
    );
    return true;
  };

  const scheduleAnnotationUpdate = (updates: Partial<Omit<Annotation, "id" | "x" | "y" | "width" | "height">>) => {
    if (!selectedAnnotationId) return;

    setSaveStatus("saving");
    pendingAnnotationUpdateRef.current = {
      ...pendingAnnotationUpdateRef.current,
      ...updates,
    };

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    const annotationId = selectedAnnotationId;
    saveTimeoutRef.current = window.setTimeout(async () => {
      saveTimeoutRef.current = null;
      const pendingUpdates = pendingAnnotationUpdateRef.current;
      pendingAnnotationUpdateRef.current = null;
      if (!pendingUpdates) return;

      const success = await updateSelectedAnnotation(pendingUpdates, annotationId);
      if (success) {
        setSaveStatus("saved");
      }
    }, 750);
  };

  const handleUnlinkAnnotation = async () => {
    if (!selectedAnnotationId) return;

    const response = await fetch(`/api/annotations/${selectedAnnotationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedDocumentId: null }),
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
              <input
                ref={annotationFileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleAnnotationInvoiceUpload}
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
                            <div className="flex items-center justify-between gap-2">
                              <span>{item.aliasName}</span>
                              {item.type === "BANK" && invoiceCountsByDocument[item.id] ? (
                                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-900 px-2 text-[10px] font-semibold text-white">
                                  {invoiceCountsByDocument[item.id]}
                                </span>
                              ) : null}
                            </div>
                          </button>
                        )}
                        {isAdmin && editingDocumentId !== item.id ? (
                          <>
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
                            <button
                              type="button"
                              onClick={() => handleDocumentDelete(item.id, item.aliasName)}
                              disabled={deletingDocumentId === item.id}
                              className="rounded-full px-2 py-1 text-xs text-red-500 transition hover:bg-red-100 disabled:opacity-50"
                              aria-label={`Delete ${item.aliasName}`}
                            >
                              🗑
                            </button>
                          </>
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
          <div className="mt-3 flex flex-wrap gap-2 pb-2">
            {selectedItem ? (
              pageList.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`flex min-w-[44px] items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                    page === currentPage
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-slate-900 hover:bg-zinc-50"
                  }`}
                >
                  <span>{page}</span>
                  {pageInvoiceCounts[page] ? (
                    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-2 text-[10px] font-semibold text-white">
                      {pageInvoiceCounts[page]}
                    </span>
                  ) : null}
                </button>
              ))
            ) : (
              <div className="min-w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
                Select a document to enable page navigation.
              </div>
            )}
          </div>

          <div className="mt-6 rounded-3xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-5">
            <div className="text-sm font-medium text-zinc-900">
                {isAdmin
                  ? "Draw annotations on the placeholder page"
                  : "Click on annotations to get more details"}
                </div>
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
                      const baseAnnotationClasses =
                        annotation.type === "NOT_RELEVANT"
                          ? "bg-slate-900/10"
                          : annotation.type === "COMMENT"
                          ? "bg-yellow-300/20"
                          : annotation.type === "INVOICE"
                          ? "bg-blue-400/20 "
                          : "bg-cyan-500/10";
                      
                      const selectedClasses =
                        selectedAnnotationId === annotation.id
                          ? "border-red-400"
                          : "border-zinc-400";
                      
                      const isSelectedDropZone =
                        annotation.id === selectedAnnotationId &&
                        isAdmin &&
                        (annotation.type === "DOCUMENT" || annotation.type === "INVOICE");
                      const dropClasses = isSelectedDropZone && isAnnotationDropActive
                        ? "border-orange-500 bg-orange-400/15 shadow-[0_0_20px_rgba(249,115,22,0.18)]"
                        : "";

                      return (
                        <div
                          key={annotation.id}
                          className={`group absolute rounded-sm border-2 hover:border-amber-400 ${baseAnnotationClasses} ${selectedClasses} ${dropClasses} transition cursor-pointer`}
                          onDragOver={(event) => {
                            if (!isSelectedDropZone) return;
                            event.preventDefault();
                            setIsAnnotationDropActive(true);
                          }}
                          onDragLeave={() => {
                            if (!isSelectedDropZone) return;
                            setIsAnnotationDropActive(false);
                          }}
                          onDrop={handleAnnotationDrop}
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
                          {isSelectedDropZone && isAnnotationDropActive ? (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-sm bg-white/75 text-xs font-semibold text-amber-700">
                              Drop invoice here
                            </div>
                          ) : null}
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
        <section className="flex h-full flex-col rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{!selectedAnnotation ? (null) : (annotationTypeLabel[selectedAnnotation.type] + ' ')}Preview</h2>
              
                {selectedItem ? (
                  <p className="mt-1 text-sm text-zinc-700">Bank Document: {selectedItem.aliasName} - Page {currentPage} / {selectedItem.pageCount}</p>
                ) : (
                  <p className="mt-1 text-sm text-zinc-500">Select a document from the left panel to view details.</p>
                )}
            </div>
            {selectedAnnotation?.category ? (
              <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                {selectedAnnotation.category}
              </span>
            ) : null}
          </div>

          {selectedAnnotation && selectedAnnotation.comment ? (
            <div className="flex shrink-0 mt-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-500 whitespace-pre-wrap">
                    {selectedAnnotation.comment}
            </div>
             ) : null}

            {!selectedAnnotation ? (
            <div className="mt-5 rounded-3xl bg-zinc-50 p-4 text-sm text-zinc-600">
                <div className="flex h-full flex-1 flex-col rounded-2xl border border-zinc-200 bg-white p-4">
                    <p className="font-semibold text-zinc-900">No annotation selected</p>
                    <p className="mt-2 text-zinc-700">
                        Click a rectangle on the document preview to view details here.
                    </p>
                </div>
            </div>
            ) : null}
                
            {
            /** Admin Annotationserfassung */
            isAdmin && selectedAnnotation ? (
                <div className="flex flex-col overflow-hidden mt-4 space-y-4 text-sm text-zinc-700 p-5 bg-zinc-50 border-zinc-200 rounded-3xl border-2">
                    <div className="flex-1 grid gap-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h2 className="text-lg font-semibold">Edit Annotation</h2>
                            <div className="text-xs font-normal">Position: {(selectedAnnotation.x * 100).toFixed(1)}%, {(selectedAnnotation.y * 100).toFixed(1)}% / Size: {(selectedAnnotation.width * 100).toFixed(1)}% x {(selectedAnnotation.height * 100).toFixed(1)}%</div>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-semibold">
                            {saveStatus === "saving" ? (
                              <span className="flex items-center gap-2 text-orange-400">
                                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-orange-400" />
                                Saving...
                              </span>
                            ) : (
                              <span className="flex items-center gap-2 text-emerald-500">
                                <span>✔</span>
                                Saved
                              </span>
                            )}
                          </div>
                        </div>
                        
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
                                    className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none"
                                >
                                    <option value="DOCUMENT">DOCUMENT</option>
                                    <option value="INVOICE">INVOICE</option>
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
                                    placeholder="Type a category"
                                    value={categoryInput}
                                    onChange={(event) => {
                                      setCategoryInput(event.target.value);
                                      scheduleAnnotationUpdate({ category: event.target.value });
                                    }}
                                    className="mt-2 w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 bg-white outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                Comment
                            </label>
                            <textarea
                            placeholder="Type a comment"
                            value={commentInput}
                            onChange={(event) => {
                              setCommentInput(event.target.value);
                              scheduleAnnotationUpdate({ comment: event.target.value });
                            }}
                            rows={3}
                            className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                Linked Document
                            </label>
                            <div className="flex gap-5">
                                <div className="flex-1">
                                    <div className="flex rounded-2xl bg-zinc-100 p-3 text-sm text-zinc-600">
                                        {linkedDocument ? (
                                            <div className="text-zinc-700">{linkedDocument.aliasName || linkedDocument.name} / <span className="text-xs text-zinc-500">{linkedDocument.pageCount} page(s)</span></div>
                                        ) : (
                                            <div className="text-zinc-700">No invoice or document linked yet.</div>
                                        )}
                                    </div>
                                    <div className="flex whitespace-nowrap gap-2">
                                        {((selectedAnnotation.type === "DOCUMENT" || selectedAnnotation.type === "INVOICE") && isAdmin) ? (
                                        <div>
                                            <button
                                            type="button"
                                            onClick={openAnnotationInvoicePicker}
                                            disabled={isUploading}
                                            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
                                            >
                                            {isUploading ? "Uploading…" : "Upload"}
                                            </button>
                                        </div>
                                        ) : null }
                                        {linkedDocument ? (
                                        <button
                                            type="button"
                                            onClick={handleUnlinkAnnotation}
                                            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100"
                                        >
                                            Unlink
                                        </button>
                                        ) : null}
                                    </div>
                                    </div>
                                    {annotationUploadError ? (
                                            <div className="text-sm text-red-600">{annotationUploadError}</div>
                                    ) : null}
                            </div>
                        </div>
                        
                    </div>
                </div>
            ) : ''}
          {
          /**  Iframe and Buttons for PDF */
          selectedAnnotation ? (
            <div className="flex-1 h-full min-h-0 rounded-3xl border-2 border-dashed border-zinc-200 bg-zink p-5 text-sm text-zinc-700">
                <div className="flex flex-col gap-3 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-zinc-900">Preview</p>
                        <p className="text-xs text-zinc-500">
                            {linkedDocument ? (
                            'Open, download, or print the linked invoice') : (
                            'No invoice or document linked yet'
                            )}
                            </p>
                        {linkedDocument ? (
                        <p className="text-sm text-zinc-700">{linkedDocument.aliasName || linkedDocument.name} / <span className="text-xs text-zinc-500">{linkedDocument.pageCount} page(s)</span></p>
                        ) : null}
                    </div>
                    {linkedDocument ? (
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
                    </div>): null}
                </div>
                {linkedDocument ? (
                <div className="flex-1 h-full min-h-0 overflow-hidden rounded-b-3xl bg-zinc-950">
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
          ): null}
        </section>
      </main>

      {isFullscreenOpen && linkedDocument ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-zinc-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-zinc-900">Fullscreen {selectedAnnotation ? (annotationTypeLabel[selectedAnnotation.type]) : null} preview</p>
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

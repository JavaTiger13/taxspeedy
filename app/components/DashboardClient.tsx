"use client";

import { ChangeEvent, DragEvent, FormEvent, MouseEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// Module-level cache: key = `${documentId}-${page}`, value = url
// Persists across renders; cleared on expiry errors.
const pageUrlCache = new Map<string, string>();

async function fetchPageUrl(documentId: string, page: number): Promise<string> {
  const key = `${documentId}-${page}`;
  const cached = pageUrlCache.get(key);
  if (cached) return cached;
  const res = await fetch(`/api/documents/${documentId}/page/${page}`);
  if (!res.ok) throw new Error("Failed to fetch page URL");
  const { url }: { url: string } = await res.json();
  pageUrlCache.set(key, url);
  return url;
}
import { Annotation, DocumentModel, DocumentType, DraftAnnotation, MIN_ANNOTATION_SIZE, UserRole, UserSession } from "./types";
import NavigationColumn from "./NavigationColumn";
import DocumentViewerColumn from "./DocumentViewerColumn";
import AnnotationDetailColumn from "./AnnotationDetailColumn";

export default function DashboardClient({ initialRole }: { initialRole: UserRole | null }) {
  const [user, setUser] = useState<UserSession | null>(
    initialRole ? { name: `${initialRole} User`, role: initialRole } : null
  );
  const [role, setRole] = useState<UserRole | "">("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [documents, setDocuments] = useState<DocumentModel[]>([]);
  const [allDocuments, setAllDocuments] = useState<DocumentModel[]>([]);
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
  const [isDraggingAnnotation, setIsDraggingAnnotation] = useState(false);
  const [isResizingAnnotation, setIsResizingAnnotation] = useState(false);
  const [draggedDocumentId, setDraggedDocumentId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const resizeStartRef = useRef<{
    startX: number;
    startY: number;
    origWidth: number;
    origHeight: number;
  } | null>(null);
  const [categoryInput, setCategoryInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const saveTimeoutRef = useRef<number | null>(null);
  const pendingAnnotationUpdateRef = useRef<Partial<Omit<Annotation, "id" | "x" | "y" | "width" | "height">> | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingAlias, setEditingAlias] = useState("");
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const annotationFileInputRef = useRef<HTMLInputElement | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const fullscreenIframeRef = useRef<HTMLIFrameElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isAdmin = user?.role === "Admin";

  // ─── Derived state ───────────────────────────────────────────────────────────

  const selectedItem = useMemo(
    () => (selectedId ? documents.find((d) => d.id === selectedId) ?? null : null),
    [selectedId, documents]
  );

  const currentDocumentAnnotations = useMemo(
    () =>
      selectedId
        ? annotations.filter((a) => a.documentId === selectedId && a.page === currentPage)
        : [],
    [annotations, selectedId, currentPage]
  );

  const invoiceCountsByDocument = useMemo(
    () =>
      annotations.reduce<Record<string, number>>((counts, annotation) => {
        if (annotation.type === "INVOICE") {
          counts[annotation.documentId] = (counts[annotation.documentId] ?? 0) + 1;
        }
        return counts;
      }, {}),
    [annotations]
  );

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
    () => currentDocumentAnnotations.find((a) => a.id === selectedAnnotationId) ?? null,
    [currentDocumentAnnotations, selectedAnnotationId]
  );

  const currentPageCount = selectedItem?.pageCount ?? 1;

  const pageList = useMemo(
    () => (selectedItem ? Array.from({ length: selectedItem.pageCount }, (_, i) => i + 1) : []),
    [selectedItem]
  );

  const linkedDocument = selectedAnnotation
    ? allDocuments.find((d) => d.id === selectedAnnotation.linkedDocumentId) ?? null
    : null;

  // ─── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isFullscreenOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreenOpen(false);
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
    return () => observer.disconnect();
  }, [selectedId, currentPage]);

  useEffect(() => {
    if (!user) return;
    loadDocuments();
    loadAllDocuments();
    loadAnnotations();
  }, []);

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

  useEffect(() => {
    const handlePageKeys = (event: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") return;
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

  useEffect(() => {
    if (selectedAnnotationId) {
      const found = currentDocumentAnnotations.some((a) => a.id === selectedAnnotationId);
      if (!found) setSelectedAnnotationId(null);
    }
  }, [currentDocumentAnnotations, selectedAnnotationId]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedAnnotationId(null);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) { setPageImageUrl(null); return; }
    let cancelled = false;
    fetchPageUrl(selectedId, currentPage)
      .then((url) => { if (!cancelled) setPageImageUrl(url); })
      .catch(() => { if (!cancelled) setPageImageUrl(null); });
    return () => { cancelled = true; };
  }, [selectedId, currentPage]);

  const handlePageImageError = async () => {
    if (!selectedId) return;
    // Remove stale cached entry so fetchPageUrl re-fetches
    pageUrlCache.delete(`${selectedId}-${currentPage}`);
    try {
      const url = await fetchPageUrl(selectedId, currentPage);
      setPageImageUrl(url);
    } catch {
      // silently ignore
    }
  };

  // ─── Data loaders ────────────────────────────────────────────────────────────

  const loadDocuments = async () => {
    setIsLoadingDocuments(true);
    const response = await fetch("/api/documents?type=BANK");
    if (!response.ok) { setIsLoadingDocuments(false); return; }
    const data = (await response.json()) as DocumentModel[];
    setDocuments(data);
    setIsLoadingDocuments(false);
  };

  const loadAllDocuments = async () => {
    const response = await fetch("/api/documents");
    if (!response.ok) return;
    const data = (await response.json()) as DocumentModel[];
    setAllDocuments(data);
  };

  const loadAnnotations = async () => {
    setIsLoadingAnnotations(true);
    const response = await fetch("/api/annotations");
    if (!response.ok) { setIsLoadingAnnotations(false); return; }
    const data = (await response.json()) as Annotation[];
    setAnnotations(data);
    setIsLoadingAnnotations(false);
  };

  // ─── Auth handlers ───────────────────────────────────────────────────────────

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);
    if (!role) { setLoginError("Please select a role."); return; }
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, password }),
      });
      if (!response.ok) { setLoginError("Invalid password. Please try again."); return; }
      window.location.reload();
    } catch {
      setLoginError("Login failed. Please try again.");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.reload();
  };

  // ─── Document handlers ───────────────────────────────────────────────────────

  const handleSelectDocument = (id: string) => {
    setSelectedId(id);
    setSelectedAnnotationId(null);
    setCurrentPage(1);
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("type", "BANK");
      Array.from(files).forEach((file) => formData.append("files", file));
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      if (!response.ok) {
        const isJson = response.headers.get("content-type")?.includes("application/json");
        const errorData = isJson ? await response.json().catch(() => null) : null;
        setUploadError(errorData?.error || "Upload failed.");
        return;
      }
      await loadDocuments();
    } catch {
      setUploadError("Upload failed.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDocumentRename = async (documentId: string, aliasName: string) => {
    const trimmed = aliasName.trim();
    if (!trimmed) return;
    const response = await fetch(`/api/documents/${documentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aliasName: trimmed }),
    });
    if (!response.ok) return;
    setEditingDocumentId(null);
    setEditingAlias("");
    await loadDocuments();
  };

  const handleDocumentDelete = async (documentId: string, aliasName: string) => {
    const confirmed = window.confirm(`Delete ${aliasName}? This will remove the document and all annotations.`);
    if (!confirmed) return;
    setDeletingDocumentId(documentId);
    try {
      const response = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      if (!response.ok) return;
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

  const handleDocumentReorder = async (draggedId: string, targetIndex: number) => {
    const snapshot = [...documents];
    const fromIndex = snapshot.findIndex((d) => d.id === draggedId);
    if (fromIndex === -1 || fromIndex === targetIndex || fromIndex + 1 === targetIndex) return;
    const reordered = [...snapshot];
    const [moved] = reordered.splice(fromIndex, 1);
    const insertAt = targetIndex > fromIndex ? targetIndex - 1 : targetIndex;
    reordered.splice(insertAt, 0, moved);
    setDocuments(reordered);
    const orders = reordered.map((doc, idx) => ({ id: doc.id, sortOrder: idx + 1 }));
    const response = await fetch("/api/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders }),
    });
    if (!response.ok) setDocuments(snapshot);
  };

  const handleCleanupInvoices = async () => {
    if (!confirm("Are you sure you want to delete all unused invoices?")) return;
    const response = await fetch("/api/documents/cleanup-unused-invoices", { method: "DELETE" });
    if (!response.ok) { alert("Cleanup failed."); return; }
    const isJson = response.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await response.json() : null;
    const deleted = data?.deleted ?? 0;
    alert(`${deleted} invoice${deleted === 1 ? "" : "s"} deleted.`);
    loadAllDocuments();
    loadDocuments();
  };

  // ─── Annotation handlers ─────────────────────────────────────────────────────

  const updateSelectedAnnotation = async (
    updates: Partial<Omit<Annotation, "id">>,
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
      current.map((a) => (a.id === annotationId ? updatedAnnotation : a))
    );
    return true;
  };

  const scheduleAnnotationUpdate = (
    updates: Partial<Omit<Annotation, "id" | "x" | "y" | "width" | "height">>
  ) => {
    if (!selectedAnnotationId) return;
    setSaveStatus("saving");
    pendingAnnotationUpdateRef.current = { ...pendingAnnotationUpdateRef.current, ...updates };
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    const annotationId = selectedAnnotationId;
    saveTimeoutRef.current = window.setTimeout(async () => {
      saveTimeoutRef.current = null;
      const pendingUpdates = pendingAnnotationUpdateRef.current;
      pendingAnnotationUpdateRef.current = null;
      if (!pendingUpdates) return;
      const success = await updateSelectedAnnotation(pendingUpdates, annotationId);
      if (success) setSaveStatus("saved");
    }, 750);
  };

  const handleAnnotationDelete = async (annotationId: string) => {
    const response = await fetch(`/api/annotations/${annotationId}`, { method: "DELETE" });
    if (!response.ok) return;
    setAnnotations((current) => current.filter((a) => a.id !== annotationId));
    if (selectedAnnotationId === annotationId) setSelectedAnnotationId(null);
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
      current.map((a) => (a.id === selectedAnnotationId ? updatedAnnotation : a))
    );
  };

  // ─── Annotation drawing ──────────────────────────────────────────────────────

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !selectedId || isDraggingAnnotation || isResizingAnnotation) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setSelectedAnnotationId(null);
    setStartPoint({ x, y });
    setDrawingRect({
      id: "",
      documentId: selectedId,
      page: currentPage,
      x, y,
      width: 0, height: 0,
      type: "INVOICE",
      category: "",
      comment: "",
      linkedDocumentId: undefined,
    });
  };

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (isResizingAnnotation && selectedAnnotation && resizeStartRef.current) {
      const rect = imgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const currentX = (event.clientX - rect.left) / rect.width;
      const currentY = (event.clientY - rect.top) / rect.height;
      const dx = currentX - resizeStartRef.current.startX;
      const dy = currentY - resizeStartRef.current.startY;
      const minWidth = MIN_ANNOTATION_SIZE / rect.width;
      const minHeight = MIN_ANNOTATION_SIZE / rect.height;
      const newWidth = Math.min(Math.max(minWidth, resizeStartRef.current.origWidth + dx), 1 - selectedAnnotation.x);
      const newHeight = Math.min(Math.max(minHeight, resizeStartRef.current.origHeight + dy), 1 - selectedAnnotation.y);
      setAnnotations((current) =>
        current.map((a) => a.id === selectedAnnotation.id ? { ...a, width: newWidth, height: newHeight } : a)
      );
      return;
    }
    if (isDraggingAnnotation && selectedAnnotation && dragStartRef.current) {
      const rect = imgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const currentX = (event.clientX - rect.left) / rect.width;
      const currentY = (event.clientY - rect.top) / rect.height;
      const dx = currentX - dragStartRef.current.startX;
      const dy = currentY - dragStartRef.current.startY;
      const newX = Math.min(Math.max(0, dragStartRef.current.origX + dx), 1 - selectedAnnotation.width);
      const newY = Math.min(Math.max(0, dragStartRef.current.origY + dy), 1 - selectedAnnotation.height);
      setAnnotations((current) =>
        current.map((a) => a.id === selectedAnnotation.id ? { ...a, x: newX, y: newY } : a)
      );
      return;
    }
    if (!startPoint) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const currentX = (event.clientX - rect.left) / rect.width;
    const currentY = (event.clientY - rect.top) / rect.height;
    const x = Math.min(startPoint.x, currentX);
    const y = Math.min(startPoint.y, currentY);
    const width = Math.abs(currentX - startPoint.x);
    const height = Math.abs(currentY - startPoint.y);
    setDrawingRect((current) => current ? { ...current, x, y, width, height } : null);
  };

  const commitAnnotation = async () => {
    if (!drawingRect || !selectedId) { setDrawingRect(null); setStartPoint(null); return; }
    const viewerWidth = imageSize.width || 1;
    const viewerHeight = imageSize.height || 1;
    if (drawingRect.width * viewerWidth < MIN_ANNOTATION_SIZE || drawingRect.height * viewerHeight < MIN_ANNOTATION_SIZE) {
      setDrawingRect(null); setStartPoint(null); return;
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
    if (!response.ok) { setDrawingRect(null); setStartPoint(null); return; }
    const createdAnnotation = (await response.json()) as Annotation;
    setAnnotations((current) => [...current, createdAnnotation]);
    setSelectedAnnotationId(createdAnnotation.id);
    setDrawingRect(null);
    setStartPoint(null);
  };

  const handleMouseUp = async () => {
    if (isResizingAnnotation) {
      setIsResizingAnnotation(false);
      resizeStartRef.current = null;
      if (selectedAnnotationId) {
        const finalAnnotation = annotations.find((a) => a.id === selectedAnnotationId);
        if (finalAnnotation) {
          await updateSelectedAnnotation({ width: finalAnnotation.width, height: finalAnnotation.height }, selectedAnnotationId);
        }
      }
      return;
    }
    if (isDraggingAnnotation) {
      setIsDraggingAnnotation(false);
      dragStartRef.current = null;
      if (selectedAnnotationId) {
        const finalAnnotation = annotations.find((a) => a.id === selectedAnnotationId);
        if (finalAnnotation) {
          await updateSelectedAnnotation({ x: finalAnnotation.x, y: finalAnnotation.y }, selectedAnnotationId);
        }
      }
      return;
    }
    commitAnnotation();
  };

  const handleMouseLeave = () => { if (startPoint) commitAnnotation(); };

  const handleAnnotationDragMouseDown = (annotation: Annotation, event: MouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    setSelectedAnnotationId(annotation.id);
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = (event.clientX - rect.left) / rect.width;
    const startY = (event.clientY - rect.top) / rect.height;
    dragStartRef.current = { startX, startY, origX: annotation.x, origY: annotation.y };
    setIsDraggingAnnotation(true);
    setIsAnnotationDropActive(false);
  };

  const handleAnnotationResizeMouseDown = (annotation: Annotation, event: MouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    setSelectedAnnotationId(annotation.id);
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = (event.clientX - rect.left) / rect.width;
    const startY = (event.clientY - rect.top) / rect.height;
    resizeStartRef.current = { startX, startY, origWidth: annotation.width, origHeight: annotation.height };
    setIsResizingAnnotation(true);
    setIsAnnotationDropActive(false);
  };

  // ─── Invoice upload for annotations ─────────────────────────────────────────

  const uploadAnnotationInvoiceFile = async (file: File) => {
    if (!selectedAnnotationId) return;
    setAnnotationUploadError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("type", "INVOICE");
      formData.append("files", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      if (!response.ok) {
        const isJson = response.headers.get("content-type")?.includes("application/json");
        const errorData = isJson ? await response.json().catch(() => null) : null;
        setAnnotationUploadError(errorData?.error || "Invoice upload failed.");
        return;
      }
      const isJson = response.headers.get("content-type")?.includes("application/json");
      const uploaded = isJson ? (await response.json()) as DocumentModel[] : [];
      if (!uploaded.length) { setAnnotationUploadError("Invoice upload failed."); return; }
      const invoice = uploaded[0];
      await loadDocuments();
      await loadAllDocuments();
      await updateSelectedAnnotation({ linkedDocumentId: invoice.id }, selectedAnnotationId);
    } catch {
      setAnnotationUploadError("Invoice upload failed.");
    } finally {
      setIsUploading(false);
      if (annotationFileInputRef.current) annotationFileInputRef.current.value = "";
    }
  };

  const handleAnnotationInvoiceUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    await uploadAnnotationInvoiceFile(files[0]);
  };

  const handleAnnotationDrop = async (event: DragEvent<HTMLDivElement>) => {
    if (isDraggingAnnotation || isResizingAnnotation) { setIsAnnotationDropActive(false); return; }
    if (!isAdmin || !selectedAnnotation || selectedAnnotation.id !== selectedAnnotationId) {
      setIsAnnotationDropActive(false); return;
    }
    if (!["DOCUMENT", "INVOICE"].includes(selectedAnnotation.type)) {
      setIsAnnotationDropActive(false); return;
    }
    event.preventDefault();
    setIsAnnotationDropActive(false);
    const file = event.dataTransfer?.files?.[0];
    if (!file || !(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
      setAnnotationUploadError("Please drop a PDF file."); return;
    }
    await uploadAnnotationInvoiceFile(file);
  };

  // ─── Linked document actions ─────────────────────────────────────────────────

  const downloadLinkedDocument = () => {
    if (!linkedDocument) return;
    const anchor = document.createElement("a");
    anchor.href = linkedDocument.filePath;
    anchor.download = linkedDocument.name || "document.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const printLinkedDocument = (iframeRef: React.RefObject<HTMLIFrameElement | null>) => {
    if (!linkedDocument) return;
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) { iframe.contentWindow.focus(); iframe.contentWindow.print(); return; }
    const win = window.open(linkedDocument.filePath, "_blank");
    if (win) { win.focus(); win.print(); }
  };

  const handleImageLoad = () => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    setImageSize({ width: rect.width, height: rect.height });
  };

  // ─── Login screen ────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12 text-zinc-900">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Sign in to TaxSpeedy</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Select your role and enter the password to continue.
          </p>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-zinc-700" htmlFor="role">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole | "")}
                required
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-slate-900"
              >
                <option value="" disabled>Select a role…</option>
                <option value="Admin">Admin</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-slate-900"
                placeholder="Enter your password"
              />
            </div>
            {loginError && (
              <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{loginError}</p>
            )}
            <button
              type="submit"
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              {role ? `Sign in as ${role}` : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
              TaxSpeedy
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Steuerjahr 2024</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700">
              {user.role}
            </span>
            {isAdmin && (
              <button
                type="button"
                onClick={handleCleanupInvoices}
                className="rounded-full border border-zinc-200 px-3 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Cleanup unused invoices
              </button>
            )}
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

      <main className="mx-auto grid min-h-[calc(100vh-88px)] max-w-auto gap-6 px-6 py-8 lg:grid-cols-[270px_minmax(0,1fr)_minmax(0,1fr)]">
        <NavigationColumn
          isAdmin={isAdmin}
          documents={documents}
          selectedId={selectedId}
          isUploading={isUploading}
          uploadError={uploadError}
          editingDocumentId={editingDocumentId}
          editingAlias={editingAlias}
          deletingDocumentId={deletingDocumentId}
          draggedDocumentId={draggedDocumentId}
          dropIndex={dropIndex}
          invoiceCountsByDocument={invoiceCountsByDocument}
          fileInputRef={fileInputRef}
          onUploadClick={handleUploadClick}
          onFilesSelected={handleFilesSelected}
          onSelectDocument={handleSelectDocument}
          onEditStart={(id, alias) => { setEditingDocumentId(id); setEditingAlias(alias); }}
          onEditAliasChange={setEditingAlias}
          onDocumentRename={handleDocumentRename}
          onDocumentDelete={handleDocumentDelete}
          onDocumentReorder={handleDocumentReorder}
          setDropIndex={setDropIndex}
          setDraggedDocumentId={setDraggedDocumentId}
        />

        <DocumentViewerColumn
          isAdmin={isAdmin}
          selectedItem={selectedItem}
          selectedId={selectedId}
          currentPage={currentPage}
          currentPageCount={currentPageCount}
          pageList={pageList}
          pageInvoiceCounts={pageInvoiceCounts}
          currentDocumentAnnotations={currentDocumentAnnotations}
          selectedAnnotationId={selectedAnnotationId}
          drawingRect={drawingRect}
          imageSize={imageSize}
          isDraggingAnnotation={isDraggingAnnotation}
          isAnnotationDropActive={isAnnotationDropActive}
          imgRef={imgRef}
          pageImageUrl={pageImageUrl}
          onSetCurrentPage={setCurrentPage}
          onImageLoad={handleImageLoad}
          onImageError={handlePageImageError}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onAnnotationClick={setSelectedAnnotationId}
          onAnnotationDelete={handleAnnotationDelete}
          onAnnotationDragMouseDown={handleAnnotationDragMouseDown}
          onAnnotationResizeMouseDown={handleAnnotationResizeMouseDown}
          onAnnotationDrop={handleAnnotationDrop}
          onAnnotationDragOver={() => setIsAnnotationDropActive(true)}
          onAnnotationDragLeave={() => setIsAnnotationDropActive(false)}
        />

        <AnnotationDetailColumn
          isAdmin={isAdmin}
          selectedItem={selectedItem}
          currentPage={currentPage}
          selectedAnnotation={selectedAnnotation}
          linkedDocument={linkedDocument}
          categoryInput={categoryInput}
          commentInput={commentInput}
          saveStatus={saveStatus}
          isUploading={isUploading}
          annotationUploadError={annotationUploadError}
          isFullscreenOpen={isFullscreenOpen}
          previewIframeRef={previewIframeRef}
          fullscreenIframeRef={fullscreenIframeRef}
          annotationFileInputRef={annotationFileInputRef}
          onTypeChange={(type) => updateSelectedAnnotation({ type })}
          onCategoryChange={(value) => { setCategoryInput(value); scheduleAnnotationUpdate({ category: value }); }}
          onCommentChange={(value) => { setCommentInput(value); scheduleAnnotationUpdate({ comment: value }); }}
          onAnnotationInvoiceUpload={handleAnnotationInvoiceUpload}
          onUnlinkAnnotation={handleUnlinkAnnotation}
          onOpenFullscreen={() => { if (linkedDocument) setIsFullscreenOpen(true); }}
          onCloseFullscreen={() => setIsFullscreenOpen(false)}
          onDownload={downloadLinkedDocument}
          onPrint={printLinkedDocument}
          onOpenInvoicePicker={() => annotationFileInputRef.current?.click()}
        />
      </main>
    </div>
  );
}


"use client";

import { DragEvent, MouseEvent } from "react";
import { Annotation, DocumentModel, DraftAnnotation } from "./types";

type Props = {
  isAdmin: boolean;
  selectedItem: DocumentModel | null;
  selectedId: string | null;
  currentPage: number;
  currentPageCount: number;
  pageList: number[];
  pageInvoiceCounts: Record<number, number>;
  currentDocumentAnnotations: Annotation[];
  selectedAnnotationId: string | null;
  drawingRect: DraftAnnotation | null;
  imageSize: { width: number; height: number };
  isDraggingAnnotation: boolean;
  isAnnotationDropActive: boolean;
  imgRef: React.RefObject<HTMLImageElement | null>;
  pageImageUrl: string | null;
  onSetCurrentPage: (page: number) => void;
  onImageLoad: () => void;
  onImageError: () => void;
  onMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (event: MouseEvent<HTMLDivElement>) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onAnnotationClick: (id: string) => void;
  onAnnotationDelete: (id: string) => void;
  onAnnotationDragMouseDown: (annotation: Annotation, event: MouseEvent<HTMLButtonElement>) => void;
  onAnnotationResizeMouseDown: (annotation: Annotation, event: MouseEvent<HTMLButtonElement>) => void;
  onAnnotationDrop: (event: DragEvent<HTMLDivElement>) => void;
  onAnnotationDragOver: () => void;
  onAnnotationDragLeave: () => void;
};

export default function DocumentViewerColumn({
  isAdmin,
  selectedItem,
  selectedId,
  currentPage,
  currentPageCount,
  pageList,
  pageInvoiceCounts,
  currentDocumentAnnotations,
  selectedAnnotationId,
  drawingRect,
  imageSize,
  isDraggingAnnotation,
  isAnnotationDropActive,
  imgRef,
  pageImageUrl,
  onSetCurrentPage,
  onImageLoad,
  onImageError,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onAnnotationClick,
  onAnnotationDelete,
  onAnnotationDragMouseDown,
  onAnnotationResizeMouseDown,
  onAnnotationDrop,
  onAnnotationDragOver,
  onAnnotationDragLeave,
}: Props) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
            Document viewer
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            {selectedItem ? selectedItem.aliasName : "Select a document"}
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            {selectedItem
              ? selectedItem.type === "BANK"
                ? "Bank document preview"
                : "Invoice preview"
              : "Choose a document from the left to start."}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end sm:flex-row sm:gap-4">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
            Ready
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSetCurrentPage(Math.max(1, currentPage - 1))}
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
              onClick={() => onSetCurrentPage(Math.min(currentPageCount, currentPage + 1))}
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
              onClick={() => onSetCurrentPage(page)}
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
                src={pageImageUrl ?? undefined}
                alt={`${selectedItem.aliasName} page ${currentPage}`}
                className="w-full h-auto object-contain block"
                onLoad={onImageLoad}
                onError={onImageError}
              />
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2"
                style={{ width: imageSize.width, height: imageSize.height }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseLeave}
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
                  const isSelectedAnnotation = selectedAnnotationId === annotation.id;
                  const selectedClasses = isSelectedAnnotation ? "border-red-400" : "border-zinc-400";
                  const isSelectedDropZone =
                    isSelectedAnnotation &&
                    isAdmin &&
                    (annotation.type === "DOCUMENT" || annotation.type === "INVOICE");
                  const dropClasses =
                    isSelectedDropZone && isAnnotationDropActive
                      ? "border-orange-500 bg-orange-400/15 shadow-[0_0_20px_rgba(249,115,22,0.18)]"
                      : "";

                  return (
                    <div
                      key={annotation.id}
                      className={`group absolute rounded-sm border-2 hover:border-amber-400 ${baseAnnotationClasses} ${selectedClasses} ${dropClasses} transition cursor-pointer`}
                      onDragOver={(event) => {
                        if (!isSelectedDropZone) return;
                        event.preventDefault();
                        onAnnotationDragOver();
                      }}
                      onDragLeave={() => {
                        if (!isSelectedDropZone) return;
                        onAnnotationDragLeave();
                      }}
                      onDrop={onAnnotationDrop}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        onAnnotationClick(annotation.id);
                      }}
                      style={{
                        left: annotation.x * renderWidth,
                        top: annotation.y * renderHeight,
                        width: annotation.width * renderWidth,
                        height: annotation.height * renderHeight,
                      }}
                    >
                      {isAdmin ? (
                        <>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onAnnotationDelete(annotation.id);
                            }}
                            className="absolute right-1 top-1 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white bg-white/90 text-xs font-bold text-zinc-700 opacity-0 shadow transition-opacity duration-150 hover:bg-red-500 hover:text-white group-hover:opacity-100"
                          >
                            ×
                          </button>
                          <button
                            type="button"
                            onMouseDown={(event) => onAnnotationDragMouseDown(annotation, event)}
                            className={`absolute right-8 top-1 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white bg-white/90 text-xs text-zinc-700 shadow transition duration-150 opacity-0 group-hover:opacity-100 ${
                              isDraggingAnnotation ? "cursor-grabbing" : "cursor-grab"
                            } hover:bg-slate-100`}
                            aria-label="Drag annotation"
                          >
                            ≡
                          </button>
                          <button
                            type="button"
                            onMouseDown={(event) => onAnnotationResizeMouseDown(annotation, event)}
                            className="absolute right-1 bottom-1 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white bg-white/90 text-xs text-zinc-700 shadow transition duration-150 opacity-0 group-hover:opacity-100 cursor-pointer hover:bg-slate-100"
                            aria-label="Resize annotation"
                          >
                            ↘
                          </button>
                        </>
                      ) : null}
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
  );
}

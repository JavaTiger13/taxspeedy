"use client";

import { ChangeEvent } from "react";
import { Annotation, annotationTypeLabel, DocumentModel } from "./types";

type Props = {
  isAdmin: boolean;
  selectedItem: DocumentModel | null;
  currentPage: number;
  selectedAnnotation: Annotation | null;
  linkedDocument: DocumentModel | null;
  categoryInput: string;
  commentInput: string;
  saveStatus: "saved" | "saving";
  isUploading: boolean;
  annotationUploadError: string | null;
  isFullscreenOpen: boolean;
  previewIframeRef: React.RefObject<HTMLIFrameElement | null>;
  fullscreenIframeRef: React.RefObject<HTMLIFrameElement | null>;
  annotationFileInputRef: React.RefObject<HTMLInputElement | null>;
  onTypeChange: (type: Annotation["type"]) => void;
  onCategoryChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onAnnotationInvoiceUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onUnlinkAnnotation: () => void;
  onOpenFullscreen: () => void;
  onCloseFullscreen: () => void;
  onDownload: () => void;
  onPrint: (iframeRef: React.RefObject<HTMLIFrameElement | null>) => void;
  onOpenInvoicePicker: () => void;
};

export default function AnnotationDetailColumn({
  isAdmin,
  selectedItem,
  currentPage,
  selectedAnnotation,
  linkedDocument,
  categoryInput,
  commentInput,
  saveStatus,
  isUploading,
  annotationUploadError,
  isFullscreenOpen,
  previewIframeRef,
  fullscreenIframeRef,
  annotationFileInputRef,
  onTypeChange,
  onCategoryChange,
  onCommentChange,
  onAnnotationInvoiceUpload,
  onUnlinkAnnotation,
  onOpenFullscreen,
  onCloseFullscreen,
  onDownload,
  onPrint,
  onOpenInvoicePicker,
}: Props) {
  return (
    <>
      <section className="flex h-full flex-col rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {!selectedAnnotation ? null : annotationTypeLabel[selectedAnnotation.type] + " "}Preview
            </h2>
            {selectedItem ? (
              <p className="mt-1 text-sm text-zinc-700">
                Bank Document: {selectedItem.aliasName} - Page {currentPage} / {selectedItem.pageCount}
              </p>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">
                Select a document from the left panel to view details.
              </p>
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

        {isAdmin && selectedAnnotation ? (
          <div className="flex flex-col overflow-hidden mt-4 space-y-4 text-sm text-zinc-700 p-5 bg-zinc-50 border-zinc-200 rounded-3xl border-2">
            <div className="flex-1 grid gap-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Edit Annotation</h2>
                  <div className="text-xs font-normal">
                    Position: {(selectedAnnotation.x * 100).toFixed(1)}%, {(selectedAnnotation.y * 100).toFixed(1)}% / Size: {(selectedAnnotation.width * 100).toFixed(1)}% x {(selectedAnnotation.height * 100).toFixed(1)}%
                  </div>
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
                    onChange={(event) => onTypeChange(event.target.value as Annotation["type"])}
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
                    onChange={(event) => onCategoryChange(event.target.value)}
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
                  onChange={(event) => onCommentChange(event.target.value)}
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
                        <div className="text-zinc-700">
                          {linkedDocument.aliasName || linkedDocument.name} /{" "}
                          <span className="text-xs text-zinc-500">{linkedDocument.pageCount} page(s)</span>
                        </div>
                      ) : (
                        <div className="text-zinc-700">No invoice or document linked yet.</div>
                      )}
                    </div>
                    <div className="flex whitespace-nowrap gap-2">
                      {(selectedAnnotation.type === "DOCUMENT" || selectedAnnotation.type === "INVOICE") && isAdmin ? (
                        <div>
                          <button
                            type="button"
                            onClick={onOpenInvoicePicker}
                            disabled={isUploading}
                            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
                          >
                            {isUploading ? "Uploading…" : "Upload"}
                          </button>
                        </div>
                      ) : null}
                      {linkedDocument ? (
                        <button
                          type="button"
                          onClick={onUnlinkAnnotation}
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
        ) : null}

        {selectedAnnotation ? (
          <div className="flex-1 h-full min-h-0 rounded-3xl border-2 border-dashed border-zinc-200 bg-zink p-5 text-sm text-zinc-700">
            <div className="flex flex-col gap-3 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-900">Preview</p>
                <p className="text-xs text-zinc-500">
                  {linkedDocument
                    ? "Open, download, or print the linked invoice"
                    : "No invoice or document linked yet"}
                </p>
                {linkedDocument ? (
                  <p className="text-sm text-zinc-700">
                    {linkedDocument.aliasName || linkedDocument.name} /{" "}
                    <span className="text-xs text-zinc-500">{linkedDocument.pageCount} page(s)</span>
                  </p>
                ) : null}
              </div>
              {linkedDocument ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenFullscreen}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
                  >
                    Open fullscreen
                  </button>
                  <button
                    type="button"
                    onClick={onDownload}
                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => onPrint(previewIframeRef)}
                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
                  >
                    Print
                  </button>
                </div>
              ) : null}
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
        ) : null}

        <input
          ref={annotationFileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onAnnotationInvoiceUpload}
        />
      </section>

      {isFullscreenOpen && linkedDocument ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-zinc-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-zinc-900">
                  Fullscreen {selectedAnnotation ? annotationTypeLabel[selectedAnnotation.type] : null} preview
                </p>
                <p className="mt-1 text-sm text-zinc-500">{linkedDocument.name}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onDownload}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => onPrint(fullscreenIframeRef)}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
                >
                  Print
                </button>
                <button
                  type="button"
                  onClick={onCloseFullscreen}
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
    </>
  );
}

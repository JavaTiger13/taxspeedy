"use client";

import { ChangeEvent, Fragment, useMemo } from "react";
import { DocumentModel, sectionName } from "./types";

type Props = {
  isAdmin: boolean;
  documents: DocumentModel[];
  selectedId: string | null;
  isUploading: boolean;
  uploadError: string | null;
  editingDocumentId: string | null;
  editingAlias: string;
  deletingDocumentId: string | null;
  draggedDocumentId: string | null;
  dropIndex: number | null;
  invoiceCountsByDocument: Record<string, number>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUploadClick: () => void;
  onFilesSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelectDocument: (id: string) => void;
  onEditStart: (id: string, alias: string) => void;
  onEditAliasChange: (alias: string) => void;
  onDocumentRename: (id: string, alias: string) => void;
  onDocumentDelete: (id: string, alias: string) => void;
  onDocumentReorder: (draggedId: string, targetIndex: number) => void;
  setDropIndex: (index: number | null) => void;
  setDraggedDocumentId: (id: string | null) => void;
};

export default function NavigationColumn({
  isAdmin,
  documents,
  selectedId,
  isUploading,
  uploadError,
  editingDocumentId,
  editingAlias,
  deletingDocumentId,
  draggedDocumentId,
  dropIndex,
  invoiceCountsByDocument,
  fileInputRef,
  onUploadClick,
  onFilesSelected,
  onSelectDocument,
  onEditStart,
  onEditAliasChange,
  onDocumentRename,
  onDocumentDelete,
  onDocumentReorder,
  setDropIndex,
  setDraggedDocumentId,
}: Props) {
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

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Navigation</h2>
          <p className="mt-2 text-sm text-zinc-600">Browse bank documents and invoices.</p>
        </div>
      </div>
      {isAdmin ? (
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={onUploadClick}
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
            onChange={onFilesSelected}
          />
        </div>
      ) : null}
      <div className="mt-5 space-y-5">
        {Object.entries(groupedDocuments).map(([section, sectionItems]) => (
          <div key={section}>
            <p className="text-sm font-semibold text-zinc-900">{section}</p>
            <ul
              className="mt-3 border-l border-zinc-200 pl-0 text-sm text-zinc-700"
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropIndex(null);
              }}
            >
              {isAdmin ? (
                <li
                  role="none"
                  className={`overflow-hidden rounded-lg transition-all duration-150 ${
                    !draggedDocumentId ? "h-0" : dropIndex === 0 ? "h-8 bg-blue-400/50" : "h-1"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDropIndex(0); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    console.log("[reorder] drop at 0", { id });
                    if (id) onDocumentReorder(id, 0);
                    setDropIndex(null);
                    setDraggedDocumentId(null);
                  }}
                />
              ) : null}
              {sectionItems.map((item, itemIndex) => (
                <Fragment key={item.id}>
                  <li
                    draggable={isAdmin && editingDocumentId !== item.id}
                    onDragStart={(e) => {
                      setDraggedDocumentId(item.id);
                      e.dataTransfer.setData("text/plain", item.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggedDocumentId(null);
                      setDropIndex(null);
                    }}
                    className={`mb-0.5 ${draggedDocumentId === item.id ? "opacity-40" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      {editingDocumentId === item.id ? (
                        <input
                          type="text"
                          autoFocus
                          value={editingAlias}
                          onChange={(event) => onEditAliasChange(event.target.value)}
                          onBlur={() => onDocumentRename(item.id, editingAlias)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              onDocumentRename(item.id, editingAlias);
                            }
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectDocument(item.id)}
                          className={`w-full rounded-2xl px-3 py-2 text-left text-sm transition ${
                            selectedId === item.id
                              ? "bg-slate-900 text-white"
                              : "text-zinc-700 hover:text-slate-900 hover:bg-zinc-100"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>{item.aliasName}</span>
                            {item.type === "BANK" && invoiceCountsByDocument[item.id] ? (
                              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-2 text-[10px] font-semibold text-white">
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
                            onClick={() => onEditStart(item.id, item.aliasName)}
                            className="rounded-full px-1 py-1 text-xs text-zinc-500 transition hover:bg-zinc-100"
                            aria-label={`Rename ${item.aliasName}`}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => onDocumentDelete(item.id, item.aliasName)}
                            disabled={deletingDocumentId === item.id}
                            className="rounded-full px-1 py-1 text-xs text-red-500 transition hover:bg-red-100 disabled:opacity-50"
                            aria-label={`Delete ${item.aliasName}`}
                          >
                            🗑
                          </button>
                        </>
                      ) : null}
                    </div>
                  </li>
                  {isAdmin ? (
                    <li
                      role="none"
                      className={`overflow-hidden rounded-lg transition-all duration-150 ${
                        !draggedDocumentId ? "h-0" : dropIndex === itemIndex + 1 ? "h-8 bg-blue-400/50" : "h-1"
                      }`}
                      onDragOver={(e) => { e.preventDefault(); setDropIndex(itemIndex + 1); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/plain");
                        console.log("[reorder] drop at", itemIndex + 1, { id });
                        if (id) onDocumentReorder(id, itemIndex + 1);
                        setDropIndex(null);
                        setDraggedDocumentId(null);
                      }}
                    />
                  ) : null}
                </Fragment>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

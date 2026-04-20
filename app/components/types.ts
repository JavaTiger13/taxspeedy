export type UserRole = "Admin" | "Viewer";

export type UserSession = {
  name: string;
  role: UserRole;
};

export type Annotation = {
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

export type DraftAnnotation = Omit<Annotation, "x" | "y" | "width" | "height"> & {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DocumentType = "BANK" | "INVOICE";

export type DocumentModel = {
  id: string;
  name: string;
  aliasName: string;
  type: DocumentType;
  filePath: string;
  pageCount: number;
  createdAt: string;
};

export const MIN_ANNOTATION_SIZE = 20;

export const sectionName: Record<DocumentType, string> = {
  BANK: "Bank Documents",
  INVOICE: "Invoices",
};

export const annotationTypeLabel: Record<Annotation["type"], string> = {
  DOCUMENT: "Document",
  INVOICE: "Invoice",
  COMMENT: "Comment",
  NOT_RELEVANT: "Not relevant",
};

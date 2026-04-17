export type DocumentType = "BANK" | "INVOICE";

export type DocumentModel = {
  id: string;
  name: string;
  date: string;
  type: DocumentType;
  filePath: string;
  pageCount: number;
};

/* export const documents: DocumentModel[] = [
  {
    id: "bank-january-2024",
    name: "January 2024",
    date: "2024-01-31",
    type: "BANK",
    filePath: "/documents/january-2024.pdf",
    pageCount: 3,
  },
  {
    id: "bank-february-2024",
    name: "February 2024",
    date: "2024-02-29",
    type: "BANK",
    filePath: "/documents/february-2024.pdf",
    pageCount: 2,
  },
  {
    id: "invoice-amazon-2024",
    name: "Amazon Invoice",
    date: "2024-02-08",
    type: "INVOICE",
    filePath: "/documents/amazon-invoice.pdf",
    pageCount: 1,
  },
  {
    id: "invoice-telekom-2024",
    name: "Telekom Invoice",
    date: "2024-03-02",
    type: "INVOICE",
    filePath: "/documents/telekom-invoice.pdf",
    pageCount: 1,
  },
]; */

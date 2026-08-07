/**
 * File-type policy for attachments — which MIME types may be uploaded and which
 * can be previewed inline. Centralised so upload endpoints and the Attachment
 * Center preview agree on the same rules.
 */

const PREVIEW_IMAGE = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
const PREVIEW_PDF = ["application/pdf"];

/** Non-previewable but accepted document/spreadsheet types (proof files). */
const ALLOWED_DOCS = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const ALLOWED_UPLOAD = new Set([...PREVIEW_IMAGE, ...PREVIEW_PDF, ...ALLOWED_DOCS]);

export type PreviewType = "image" | "pdf" | "none";

/** Classify how a file may be previewed inline. */
export function classifyPreview(fileType?: string | null): PreviewType {
  if (!fileType) return "none";
  const t = fileType.toLowerCase();
  if (PREVIEW_IMAGE.includes(t)) return "image";
  if (PREVIEW_PDF.includes(t)) return "pdf";
  return "none";
}

/** Whether a file can be previewed inline (image or PDF). */
export function isPreviewable(fileType?: string | null): boolean {
  return classifyPreview(fileType) !== "none";
}

/**
 * Whether a file type is allowed for upload. An unknown/empty type is permitted
 * (the client may not send one); a provided type must be on the allow-list.
 */
export function isAllowedUpload(fileType?: string | null): boolean {
  if (!fileType) return true;
  return ALLOWED_UPLOAD.has(fileType.toLowerCase());
}

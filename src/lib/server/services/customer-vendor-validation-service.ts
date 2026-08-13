/**
 * Master Customer & Vendor validation. Field-level business rules for a party
 * record, kept out of the route handler so create/update share one definition.
 * Returns every problem found so the form can flag them together.
 */

export type PartyValidationError = { field: string; message: string };

export type PartyInput = {
  code: string;
  name: string;
  type: string;
  email?: string;
  phone?: string;
  npwp?: string;
};

const CODE_RE = /^[A-Z][A-Z0-9-]{1,47}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^[0-9()+\-.\s]{6,24}$/;

/**
 * Validate a party payload. `code` must be an uppercase business code; `type`
 * must be customer/vendor; a supplied email/phone must be well-formed; a supplied
 * NPWP must carry the 15 digits of an Indonesian tax id (formatting punctuation
 * is ignored). Empty optional fields are allowed — they simply skip their check.
 */
export function validatePartyInput(input: PartyInput): PartyValidationError[] {
  const errors: PartyValidationError[] = [];

  if (!input.code) errors.push({ field: "code", message: "Kode wajib diisi." });
  else if (!CODE_RE.test(input.code)) {
    errors.push({ field: "code", message: "Kode harus huruf kapital/angka/strip (mis. CUST-BUMA)." });
  }

  if (!input.name) errors.push({ field: "name", message: "Nama wajib diisi." });

  if (input.type !== "customer" && input.type !== "vendor") {
    errors.push({ field: "type", message: "Tipe harus customer atau vendor." });
  }

  if (input.email && !EMAIL_RE.test(input.email)) {
    errors.push({ field: "email", message: "Format email tidak valid." });
  }

  if (input.phone && !PHONE_RE.test(input.phone)) {
    errors.push({ field: "phone", message: "Format nomor telepon tidak valid." });
  }

  if (input.npwp) {
    const digits = input.npwp.replace(/\D/g, "");
    if (digits.length !== 15 && digits.length !== 16) {
      errors.push({ field: "npwp", message: "NPWP harus 15 digit." });
    }
  }

  return errors;
}

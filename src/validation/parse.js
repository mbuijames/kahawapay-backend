// src/validation/parse.js
export function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues?.[0];
    const msg = first?.message || "Invalid input";
    const path = first?.path?.join(".") || "";
    const error = path ? `${path}: ${msg}` : msg;
    const err = new Error(error);
    err.status = 400;
    throw err;
  }
  return result.data;
}

// Lazy loader for the docx library — keeps it out of the initial bundle.
// Call loadDocx() inside async download functions; the chunk is fetched once and cached.
let cached = null;
export async function loadDocx() {
  if (!cached) cached = await import('docx');
  return cached;
}
export async function loadFileSaver() {
  return import('file-saver');
}

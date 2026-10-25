export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
const TYPES = Object.freeze({
  'application/pdf': { ext: 'pdf', label: 'PDF' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', label: 'DOCX' },
  'text/plain': { ext: 'txt', label: 'text' }
});

function validUtf8(bytes) {
  for (let i = 0; i < bytes.length;) {
    const a = bytes[i++];
    if (a === 0) return false;
    if (a <= 0x7f) continue;
    if (a >= 0xc2 && a <= 0xdf) {
      if (i >= bytes.length || (bytes[i++] & 0xc0) !== 0x80) return false;
      continue;
    }
    if (a >= 0xe0 && a <= 0xef) {
      if (i + 1 >= bytes.length) return false;
      const b = bytes[i++], c = bytes[i++];
      if ((c & 0xc0) !== 0x80 || (b & 0xc0) !== 0x80) return false;
      if (a === 0xe0 && b < 0xa0) return false;
      if (a === 0xed && b >= 0xa0) return false;
      continue;
    }
    if (a >= 0xf0 && a <= 0xf4) {
      if (i + 2 >= bytes.length) return false;
      const b = bytes[i++], c = bytes[i++], d = bytes[i++];
      if ((c & 0xc0) !== 0x80 || (d & 0xc0) !== 0x80 || (b & 0xc0) !== 0x80) return false;
      if (a === 0xf0 && b < 0x90) return false;
      if (a === 0xf4 && b > 0x8f) return false;
      continue;
    }
    return false;
  }
  return true;
}

export function validateDocumentFile(file) {
  if (!file || typeof file !== 'object' || !file.buffer || typeof file.buffer.length !== 'number') {
    return { ok: false, error: 'Choose a file to upload.' };
  }
  const bytes = file.buffer;
  const size = bytes.length;
  if (!Number.isInteger(size) || size < 1) return { ok: false, error: 'The selected file is empty.' };
  if (size > MAX_DOCUMENT_BYTES) return { ok: false, error: 'Files must be 4 MB or smaller.' };

  const mime = String(file.contentType || '').toLowerCase();
  const type = TYPES[mime];
  if (!type) return { ok: false, error: 'Only PDF, DOCX and plain-text resumes are supported.' };

  const filename = String(file.filename || '')
    .split(/[\\/]/)
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 180);
  if (!filename || !filename.toLowerCase().endsWith('.' + type.ext)) {
    return { ok: false, error: 'File extension does not match the supported content type.' };
  }

  if (mime === 'application/pdf') {
    if (size < 5 || String.fromCharCode(...Array.from(bytes.slice(0, 5))) !== '%PDF-') {
      return { ok: false, error: 'The file does not appear to be a valid PDF.' };
    }
  } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    if (size < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
      return { ok: false, error: 'The file does not appear to be a valid DOCX archive.' };
    }
  } else if (!validUtf8(bytes)) {
    return { ok: false, error: 'Text files must be valid UTF-8 without binary NUL bytes.' };
  }

  return { ok: true, filename, contentType: mime, bytes: size, extension: type.ext };
}

export function runDocumentUploadUnitTests() {
  const bytes = s => new TextEncoder().encode(s);
  const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
  const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
  const cases = [
    ['accepts PDF magic bytes', validateDocumentFile({ filename: 'resume.pdf', contentType: 'application/pdf', buffer: pdf }).ok],
    ['accepts DOCX zip signature', validateDocumentFile({ filename: 'resume.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docx }).ok],
    ['accepts UTF-8 text', validateDocumentFile({ filename: 'resume.txt', contentType: 'text/plain', buffer: bytes('Salesforce Engineer') }).ok],
    ['rejects missing file', !validateDocumentFile(null).ok],
    ['rejects empty file', !validateDocumentFile({ filename: 'resume.txt', contentType: 'text/plain', buffer: new Uint8Array([]) }).ok],
    ['rejects unsupported executable MIME', !validateDocumentFile({ filename: 'resume.exe', contentType: 'application/octet-stream', buffer: bytes('MZ') }).ok],
    ['rejects MIME-spoofed PDF', !validateDocumentFile({ filename: 'resume.pdf', contentType: 'application/pdf', buffer: bytes('not a PDF') }).ok],
    ['rejects mismatched extension', !validateDocumentFile({ filename: 'resume.txt', contentType: 'application/pdf', buffer: pdf }).ok],
    ['rejects invalid UTF-8 text', !validateDocumentFile({ filename: 'resume.txt', contentType: 'text/plain', buffer: new Uint8Array([0xff, 0xfe]) }).ok],
    ['rejects binary text', !validateDocumentFile({ filename: 'resume.txt', contentType: 'text/plain', buffer: new Uint8Array([65, 0, 66]) }).ok],
    ['strips Unix path traversal from filename', validateDocumentFile({ filename: '../resume.pdf', contentType: 'application/pdf', buffer: pdf }).filename === 'resume.pdf'],
    ['strips Windows path traversal from filename', validateDocumentFile({ filename: '..\\resume.pdf', contentType: 'application/pdf', buffer: pdf }).filename === 'resume.pdf'],
    ['removes control characters from filename', validateDocumentFile({ filename: 'resume\u0000.pdf', contentType: 'application/pdf', buffer: pdf }).filename === 'resume.pdf'],
    ['rejects oversized file', !validateDocumentFile({ filename: 'resume.txt', contentType: 'text/plain', buffer: new Uint8Array(MAX_DOCUMENT_BYTES + 1) }).ok]
  ];
  return {
    passed: cases.filter(x => x[1]).length,
    failed: cases.filter(x => !x[1]).map(x => x[0]),
    total: cases.length,
    results: cases.map(x => ({ name: x[0], passed: x[1] }))
  };
}
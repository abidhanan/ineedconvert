// Which inputs we recognise and what each can become. Keys are lower-case file extensions.

export const KINDS = {
  image: {
    label: 'Gambar',
    inputs: ['jpg', 'jpeg', 'jfif', 'png', 'webp', 'gif', 'bmp', 'ico', 'svg', 'avif', 'heic', 'heif', 'tif', 'tiff'],
    targets: ['jpg', 'png', 'webp', 'avif', 'gif', 'bmp', 'ico', 'tiff', 'pdf'],
  },
  video: {
    label: 'Video',
    inputs: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'flv', 'wmv', 'm4v', '3gp', 'mpeg', 'mpg', 'ts', 'mts', 'm2ts', 'ogv', 'vob'],
    targets: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'gif', 'mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac', 'opus'],
  },
  audio: {
    label: 'Audio',
    inputs: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'wma', 'aiff', 'aif', 'amr', 'weba', 'caf'],
    targets: ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac', 'opus'],
  },
  pdf: {
    label: 'PDF',
    inputs: ['pdf'],
    targets: ['png', 'jpg', 'webp', 'txt', 'docx', 'html'],
  },
  doc: {
    label: 'Dokumen',
    inputs: ['docx', 'txt', 'md', 'markdown', 'html', 'htm'],
    targets: ['pdf', 'docx', 'html', 'txt', 'md'],
  },
  sheet: {
    label: 'Spreadsheet',
    inputs: ['xlsx', 'xls', 'xlsm', 'xlsb', 'ods', 'csv', 'tsv', 'numbers'],
    targets: ['xlsx', 'xls', 'ods', 'csv', 'tsv', 'json', 'html', 'txt'],
  },
  data: {
    label: 'Data',
    inputs: ['json', 'yaml', 'yml', 'xml'],
    targets: ['json', 'yaml', 'xml', 'csv', 'xlsx'],
  },
  archive: {
    label: 'Arsip',
    inputs: ['zip'],
    targets: ['extract'],
  },
};

// Every file, whatever it is, can at least be zipped or turned into Base64 text.
export const UNIVERSAL = ['zip', 'base64'];

export const TARGET_LABEL = { extract: 'Ekstrak isi', base64: 'Base64 (TXT)' };

export const extOf = (name) => {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
};

export const baseOf = (name) => {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
};

const MIME_KIND = [
  [/^image\//, 'image'], [/^video\//, 'video'], [/^audio\//, 'audio'], [/pdf$/, 'pdf'],
];

export function kindOf(file) {
  const ext = extOf(file.name);
  for (const [k, v] of Object.entries(KINDS)) if (v.inputs.includes(ext)) return k;
  for (const [re, k] of MIME_KIND) if (re.test(file.type)) return k;
  return null;
}

export function targetsFor(file, { avif = true } = {}) {
  const kind = kindOf(file);
  const ext = extOf(file.name);
  const norm = (e) => (e === 'jpeg' || e === 'jfif' ? 'jpg' : e === 'htm' ? 'html' : e === 'markdown' ? 'md' : e === 'yml' ? 'yaml' : e === 'tif' ? 'tiff' : e);
  let list = kind ? KINDS[kind].targets.filter((t) => t !== norm(ext)) : [];
  if (!avif) list = list.filter((t) => t !== 'avif');
  // Animated GIFs can also become video.
  if (ext === 'gif') list = [...list, 'mp4', 'webm'];
  const universal = UNIVERSAL.filter((t) => t !== ext && !list.includes(t));
  return { kind, list, universal };
}

export const labelOf = (t) => TARGET_LABEL[t] || t.toUpperCase();

import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export function load() {
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

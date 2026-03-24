import * as pdfjsLib from 'pdfjs-dist';

// Use a CDN to load the worker. This avoids all bundler-related issues (like 404s or blank pages)
// when deploying to Vercel, Netlify, etc.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export async function processPdfInBatches<T>(
  file: File,
  onProgress: (current: number, total: number) => void,
  processPageCb: (base64Image: string, pageNum: number) => Promise<T[]>
): Promise<T[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  
  onProgress(0, numPages);

  let completed = 0;
  const allData: T[][] = new Array(numPages).fill([]);
  
  // Process up to 3 pages concurrently to speed up extraction without hitting rate limits
  const CONCURRENCY_LIMIT = 3;
  let currentPage = 1;

  const worker = async () => {
    while (true) {
      // Safely get the next page number to process
      let pageNum: number;
      // We don't have a mutex, but JS is single-threaded so this synchronous block is safe
      if (currentPage <= numPages) {
        pageNum = currentPage++;
      } else {
        break;
      }
      
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            canvas: canvas,
            viewport: viewport,
          }).promise;

          // Get base64 string, remove the data:image/jpeg;base64, part
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const base64 = dataUrl.split(',')[1];

          // Free canvas memory to prevent browser crashes on large PDFs
          canvas.width = 0;
          canvas.height = 0;
          page.cleanup();

          // Process the page with the provided callback (e.g., Gemini API)
          const pageData = await processPageCb(base64, pageNum);
          allData[pageNum - 1] = pageData;
        }
      } catch (err) {
        console.error(`Error processing page ${pageNum}:`, err);
        allData[pageNum - 1] = []; // Fallback to empty array on error
      } finally {
        completed++;
        onProgress(completed, numPages);
      }
    }
  };

  // Start workers
  const workers = Array(Math.min(CONCURRENCY_LIMIT, numPages)).fill(null).map(() => worker());
  await Promise.all(workers);

  pdf.destroy();
  
  // Flatten the array of arrays
  return allData.flat();
}

import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { Dimensions, Position } from '../types';

// Configure worker for PDF.js
// We use the version property to ensure the worker matches the API version exactly.
// Using .mjs for the worker as is standard for newer PDF.js versions (v3+)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const loadPDF = async (file: File): Promise<pdfjsLib.PDFDocumentProxy> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  return loadingTask.promise;
};

export const renderPageToCanvas = async (
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<Dimensions> => {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const renderContext = {
    canvasContext: canvas.getContext('2d')!,
    viewport: viewport,
  };

  await page.render(renderContext).promise;

  return { width: viewport.width, height: viewport.height };
};

export const embedSignature = async (
  pdfFile: File,
  signatureDataUrl: string,
  pageIndex: number,
  position: Position,
  pdfPageDimensions: Dimensions, // The dimensions of the page as rendered on screen
  signatureDimensions: Dimensions
): Promise<Uint8Array> => {
  const existingPdfBytes = await pdfFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  const pngImage = await pdfDoc.embedPng(signatureDataUrl);
  const pages = pdfDoc.getPages();
  const page = pages[pageIndex];
  
  // PDF coordinates start from bottom-left. Screen coordinates start from top-left.
  // We need to scale the inputs based on the actual PDF page size vs the rendered canvas size.
  const { width: actualWidth, height: actualHeight } = page.getSize();
  
  // Calculate scale factor between the rendered canvas and the actual PDF point size
  const scaleX = actualWidth / pdfPageDimensions.width;
  const scaleY = actualHeight / pdfPageDimensions.height;

  // The signature size on the PDF
  const sigWidth = signatureDimensions.width * scaleX;
  const sigHeight = signatureDimensions.height * scaleY;

  // Calculate X and Y in PDF coordinates
  const pdfX = position.x * scaleX;
  const pdfY = actualHeight - ((position.y * scaleY) + sigHeight);

  page.drawImage(pngImage, {
    x: pdfX,
    y: pdfY,
    width: sigWidth,
    height: sigHeight,
  });

  return await pdfDoc.save();
};
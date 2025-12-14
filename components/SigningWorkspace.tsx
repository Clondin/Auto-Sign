import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { renderPageToCanvas, embedSignature } from '../services/pdfService';
import { Dimensions, Position, SignatureData } from '../types';
import { Button } from './Button';
import { Download, ChevronLeft, ChevronRight, Maximize2, Move } from 'lucide-react';

interface SigningWorkspaceProps {
  file: File;
  signatureData: SignatureData;
  onBack: () => void;
  onComplete: (url: string) => void;
}

export const SigningWorkspace: React.FC<SigningWorkspaceProps> = ({ 
  file, 
  signatureData, 
  onBack,
  onComplete 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [isRendering, setIsRendering] = useState(true);
  
  // Signature State
  const [sigPosition, setSigPosition] = useState<Position>({ x: 0, y: 0 });
  const [sigDimensions, setSigDimensions] = useState<Dimensions>({ width: 100, height: 50 });
  
  // Interaction State
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState<Position>({ x: 0, y: 0 });
  const [initialResizeDims, setInitialResizeDims] = useState<Dimensions>({ width: 0, height: 0 });
  const [initialized, setInitialized] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize PDF
  useEffect(() => {
    const loadPdfDocument = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
      } catch (error) {
        console.error("Error loading PDF", error);
      }
    };
    loadPdfDocument();
  }, [file]);

  // Render Page
  useEffect(() => {
    const render = async () => {
      if (!pdfDoc || !canvasRef.current) return;
      setIsRendering(true);
      try {
        const containerWidth = containerRef.current?.clientWidth || 800;
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1 });
        
        // Calculate nice scale
        const calculatedScale = Math.min((containerWidth - 48) / viewport.width, 1.5);
        setScale(calculatedScale);
        
        await renderPageToCanvas(pdfDoc, currentPage, canvasRef.current, calculatedScale);
        
        // Center signature on first load of the canvas
        if (!initialized && canvasRef.current) {
            setSigPosition({
                x: (canvasRef.current.width / 2) - (sigDimensions.width / 2),
                y: (canvasRef.current.height / 3) - (sigDimensions.height / 2)
            });
            setInitialized(true);
        }
      } catch (err) {
        console.error("Render error", err);
      } finally {
        setIsRendering(false);
      }
    };
    render();
  }, [pdfDoc, currentPage]);

  // Set initial signature dimensions based on aspect ratio
  useEffect(() => {
    const img = new Image();
    img.src = signatureData.dataUrl;
    img.onload = () => {
      const aspectRatio = img.width / img.height;
      const baseWidth = 100; // Even smaller default width as requested
      setSigDimensions({
        width: baseWidth,
        height: baseWidth / aspectRatio
      });
    };
  }, [signatureData.dataUrl]);

  // Global Mouse Events for robust dragging/resizing
  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
        if (!canvasRef.current) return;
        const canvasRect = canvasRef.current.getBoundingClientRect();

        if (isDragging) {
            const relativeX = e.clientX - canvasRect.left - dragOffset.x;
            const relativeY = e.clientY - canvasRect.top - dragOffset.y;
            
            // Constrain to canvas
            const maxX = canvasRect.width - sigDimensions.width;
            const maxY = canvasRect.height - sigDimensions.height;
            
            setSigPosition({
                x: Math.min(Math.max(0, relativeX), maxX),
                y: Math.min(Math.max(0, relativeY), maxY)
            });
        } 
        else if (isResizing) {
            const deltaX = e.clientX - resizeStart.x;
            // Maintain aspect ratio
            const aspectRatio = initialResizeDims.width / initialResizeDims.height;
            
            let newWidth = initialResizeDims.width + deltaX;
            newWidth = Math.max(30, Math.min(newWidth, canvasRect.width - sigPosition.x)); // Limits
            
            const newHeight = newWidth / aspectRatio;
            
            // Check vertical bounds
            if (sigPosition.y + newHeight <= canvasRect.height) {
                setSigDimensions({ width: newWidth, height: newHeight });
            }
        }
    };

    const handleGlobalUp = () => {
        setIsDragging(false);
        setIsResizing(false);
    };

    if (isDragging || isResizing) {
        document.addEventListener('mousemove', handleGlobalMove);
        document.addEventListener('mouseup', handleGlobalUp);
    }
    
    return () => {
        document.removeEventListener('mousemove', handleGlobalMove);
        document.removeEventListener('mouseup', handleGlobalUp);
    };
  }, [isDragging, isResizing, dragOffset, resizeStart, initialResizeDims, sigDimensions, sigPosition]);

  const startDrag = (e: React.MouseEvent) => {
    if (isResizing) return;
    e.preventDefault();
    e.stopPropagation();
    
    // Get mouse offset relative to signature element
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    });
    setIsDragging(true);
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({ x: e.clientX, y: e.clientY });
    setInitialResizeDims({ ...sigDimensions });
  };

  const handleFinish = async () => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    try {
      const pdfBytes = await embedSignature(
        file,
        signatureData.dataUrl,
        currentPage - 1,
        sigPosition,
        { width: canvasRef.current.width, height: canvasRef.current.height },
        sigDimensions
      );

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      onComplete(url);
    } catch (e) {
      console.error("Error saving PDF", e);
      alert("Failed to save PDF. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center space-x-4">
          <Button variant="secondary" size="sm" onClick={onBack}>Back</Button>
          <div className="h-6 w-px bg-slate-200"></div>
          <h2 className="text-slate-700 font-medium truncate max-w-xs">{file.name}</h2>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-slate-100 rounded-lg p-1">
            <button 
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-50 transition-all"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-xs font-mono w-16 text-center text-slate-600">
              {currentPage} / {numPages}
            </span>
            <button 
              disabled={currentPage >= numPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-50 transition-all"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          <Button onClick={handleFinish} isLoading={isProcessing}>
            <Download className="w-4 h-4 mr-2" />
            Finish
          </Button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 bg-slate-100 overflow-auto p-8 flex justify-center relative select-none" ref={containerRef}>
        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        )}
        
        <div className="relative shadow-xl transition-shadow duration-300 ring-1 ring-black/5" style={{ width: 'fit-content', height: 'fit-content' }}>
          <canvas ref={canvasRef} className="bg-white block rounded-sm" />
          
          {/* Draggable Signature */}
          {!isRendering && (
            <div
              onMouseDown={startDrag}
              style={{
                position: 'absolute',
                left: sigPosition.x,
                top: sigPosition.y,
                width: sigDimensions.width,
                height: sigDimensions.height,
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
              className={`
                group z-10 border transition-all duration-75
                ${(isDragging || isResizing) ? 'border-indigo-500 bg-indigo-500/10' : 'border-dashed border-indigo-400/50 hover:border-indigo-500 hover:bg-indigo-500/5'}
              `}
            >
                {/* Signature Image */}
                <img 
                    src={signatureData.dataUrl} 
                    alt="Signature" 
                    className="w-full h-full object-contain pointer-events-none select-none"
                    draggable={false}
                />
              
              {/* Move Handle (Visual aid) */}
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                Drag to move
              </div>

              {/* Resize Handle */}
              <div 
                onMouseDown={startResize}
                className="absolute -right-2 -bottom-2 w-5 h-5 bg-white border border-slate-300 rounded-full shadow-sm flex items-center justify-center cursor-nwse-resize hover:bg-indigo-50 hover:border-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity z-20"
              >
                 <Maximize2 className="w-3 h-3 text-indigo-600 rotate-90" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
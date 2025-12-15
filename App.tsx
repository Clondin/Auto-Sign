import React, { useState, useEffect } from 'react';
import { AppStep, SignatureData } from './types';
import { UploadDropzone } from './components/UploadDropzone';
import { SignaturePad } from './components/SignaturePad';
import { SigningWorkspace } from './components/SigningWorkspace';
import { PenTool, CheckCircle, ShieldCheck, FileText, ArrowRight, Download, Mail, Share2 } from 'lucide-react';
import { Button } from './components/Button';

export default function App() {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [file, setFile] = useState<File | null>(null);
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [signedBlob, setSignedBlob] = useState<Blob | null>(null);
  const [canShare, setCanShare] = useState(false);

  // Check if Web Share API with file sharing is supported
  useEffect(() => {
    const checkShareSupport = async () => {
      if (navigator.share && navigator.canShare) {
        // Test if file sharing is supported
        const testFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
        try {
          const supported = navigator.canShare({ files: [testFile] });
          setCanShare(supported);
        } catch {
          setCanShare(false);
        }
      }
    };
    checkShareSupport();
  }, []);

  const handleFileSelect = (uploadedFile: File) => {
    setFile(uploadedFile);
    setStep(AppStep.SIGNATURE);
  };

  const handleSignatureSave = (dataUrl: string) => {
    setSignatureData({
      dataUrl,
      width: 0,
      height: 0
    });
    setStep(AppStep.PLACE);
  };

  const handleSigningComplete = (url: string, blob?: Blob) => {
    setSignedUrl(url);
    if (blob) setSignedBlob(blob);
    setStep(AppStep.SUCCESS);
  };

  const handleShare = async () => {
    if (!signedBlob || !file) return;

    const filename = `signed_${file.name}`;
    const shareFile = new File([signedBlob], filename, { type: 'application/pdf' });

    try {
      await navigator.share({
        files: [shareFile],
        title: 'Signed Document',
        text: 'Here is your signed document.'
      });
    } catch (err: any) {
      // User cancelled or share failed - that's okay
      if (err.name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
  };

  const handleDownload = () => {
    if (signedUrl && file) {
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = `signed_${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!signedUrl || !file) return;

    // Do NOT preventDefault() here, as it stops the native anchor drag behavior
    e.dataTransfer.effectAllowed = 'copy';

    const filename = `signed_${file.name}`;
    const mimeType = 'application/pdf';

    // Chrome/Edge specific: allows dragging file out to desktop/apps
    // Format: "mimetype:filename:absolute_url"
    e.dataTransfer.setData('DownloadURL', `${mimeType}:${filename}:${signedUrl}`);

    // Fallbacks for other contexts
    e.dataTransfer.setData('text/uri-list', signedUrl);
    e.dataTransfer.setData('text/plain', signedUrl);

    // Add text/html as a fallback for rich text editors (like some webmail)
    // This inserts a clickable link instead of just the URL if dropped into a text area
    e.dataTransfer.setData('text/html', `<a href="${signedUrl}" download="${filename}">Download Signed Document</a>`);
  };

  const resetApp = () => {
    setStep(AppStep.UPLOAD);
    setFile(null);
    setSignatureData(null);
    setSignedUrl(null);
    setSignedBlob(null);
  };

  // Step 1: Upload
  if (step === AppStep.UPLOAD) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
              <PenTool className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
              Sign documents in <span className="text-indigo-600">seconds</span>.
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Secure, free, and runs entirely in your browser. Your files never leave your device.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
            <UploadDropzone onFileSelect={handleFileSelect} />
          </div>

          <div className="flex items-center justify-center space-x-6 text-sm text-slate-500">
            <div className="flex items-center">
              <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-500" />
              <span>Local Processing</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-1.5 text-emerald-500" />
              <span>No Signup Required</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Create Signature
  if (step === AppStep.SIGNATURE) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Create your signature</h2>
            <p className="text-slate-500 mt-2">Draw your signature below to add it to your document.</p>
          </div>

          <SignaturePad
            onSave={handleSignatureSave}
            onCancel={resetApp}
          />
        </div>
      </div>
    );
  }

  // Step 3: Place & Download
  if (step === AppStep.PLACE && file && signatureData) {
    return (
      <SigningWorkspace
        file={file}
        signatureData={signatureData}
        onBack={() => setStep(AppStep.SIGNATURE)}
        onComplete={handleSigningComplete}
      />
    );
  }

  // Step 4: Success
  if (step === AppStep.SUCCESS && file && signedUrl) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-md w-full border border-slate-100">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Document Signed!</h2>
          <p className="text-slate-600 mb-8">
            Your file is ready. Drag the card below to your <b>Desktop</b> first, then to your email.
          </p>

          <a
            href={signedUrl}
            download={`signed_${file.name}`}
            className="group relative block bg-slate-50 border-2 border-dashed border-indigo-200 rounded-xl p-6 mb-8 cursor-grab active:cursor-grabbing hover:bg-indigo-50 hover:border-indigo-400 transition-all select-none text-decoration-none"
            draggable={true}
            onDragStart={handleDragStart}
          >
            <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
              <div className="relative">
                <FileText className="w-12 h-12 text-indigo-500" />
                <div className="absolute -right-1 -bottom-1 bg-white rounded-full p-0.5 shadow-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
              </div>
              <span className="font-medium text-slate-700 truncate max-w-[200px] block">signed_{file.name}</span>
              <div className="flex items-center text-xs text-indigo-500 font-medium bg-indigo-50 px-2 py-1 rounded-full">
                <Mail className="w-3 h-3 mr-1" />
                Drag to Desktop
              </div>
            </div>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <ArrowRight className="w-4 h-4 text-indigo-400" />
            </div>
          </a>

          <div className="space-y-3">
            {canShare && signedBlob && (
              <Button onClick={handleShare} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
                <Share2 className="w-4 h-4 mr-2" />
                Share to Email / Apps
              </Button>
            )}
            <Button onClick={handleDownload} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={resetApp} variant="secondary" className="w-full">
              Sign Another Document
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

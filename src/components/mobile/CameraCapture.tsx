'use client';

import React, { useRef, useState } from 'react';
import { Camera, Image, Check, RefreshCw } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (compressedBlob: Blob, previewUrl: string) => void;
  maxDimension?: number;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  maxDimension = 1200
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState<boolean>(false);

  const handleTriggerCamera = () => {
    fileInputRef.current?.click();
  };

  const processImage = (file: File) => {
    setCompressing(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        // Create canvas
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize if exceeding max dimensions
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setCompressing(false);
          return;
        }

        // Draw image onto canvas: this process automatically strips EXIF headers
        ctx.drawImage(img, 0, 0, width, height);

        // Compress and output blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const previewUrl = URL.createObjectURL(blob);
              setPreview(previewUrl);
              onCapture(blob, previewUrl);
            }
            setCompressing(false);
          },
          'image/jpeg',
          0.80 // 80% compression quality matches perfect bandwidth-to-detail sweetspot
        );
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  return (
    <div className="flex flex-col gap-3.5 bg-slate-900/40 p-4 border border-slate-900 rounded-lg">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-slate-200 block">Mobile Field Photo Capture</span>
          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">EXIF METADATA STRIPPED & COMPRESSED</span>
        </div>

        <button
          type="button"
          onClick={handleTriggerCamera}
          className="px-3 py-1.5 rounded bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 text-xs transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,229,160,0.15)]"
        >
          <Camera size={13} />
          {preview ? 'Retake' : 'Open Camera'}
        </button>
      </div>

      {/* Preview box */}
      {compressing ? (
        <div className="h-44 w-full rounded border border-dashed border-slate-800 bg-slate-950 flex flex-col items-center justify-center">
          <RefreshCw className="text-emerald-400 animate-spin mb-2" size={18} />
          <span className="text-[10px] font-mono text-slate-500">Processing image...</span>
        </div>
      ) : preview ? (
        <div className="relative rounded overflow-hidden border border-slate-800 bg-slate-950 aspect-video">
          <img
            src={preview}
            alt="Compressed mobile capture"
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2 bg-emerald-500 text-slate-950 p-1 rounded-full shadow-md">
            <Check size={12} className="stroke-[3]" />
          </div>
        </div>
      ) : (
        <div className="h-24 w-full rounded border border-dashed border-slate-900 bg-slate-950/20 flex flex-col items-center justify-center text-slate-600">
          <Image size={24} className="opacity-10 mb-1" />
          <span className="text-[10px] font-mono">No capture loaded.</span>
        </div>
      )}
    </div>
  );
};

export default CameraCapture;

"use client";

import React, { useRef, useState } from "react";

interface DropzoneProps {
  accept?: string;
  onFiles: (files: File[]) => void;
  files?: File[];
}

export default function UploadDropzone({ accept = "*", onFiles, files = [] }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDrag, setIsDrag] = useState(false);

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const handleFiles = (fList: FileList | null) => {
    // If user cancels file picker, browsers may provide an empty FileList.
    // Ignore empty selections so we don't clear an existing preview.
    if (!fList || fList.length === 0) return;
    const arr = Array.from(fList);
    onFiles(arr);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDrag(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    // The parent grid strictly controls the exact max-widths so both columns match sizes symmetrically.
    <div className="w-full h-full flex flex-col">
      <div
        onClick={openFilePicker}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDrag(true);
        }}
        onDragLeave={() => setIsDrag(false)}
        onDrop={onDrop}
        className={`w-full flex-1 min-h-[280px] border-2 rounded-2xl flex flex-col items-center justify-center p-6 transition-colors cursor-pointer shadow-sm ${
          isDrag ? "border-primary bg-primary/5" : "border-dashed border-border/60 bg-surface/40 backdrop-blur-md hover:bg-surface/60 hover:border-border"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={false}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="text-center">
          <div className="text-2xl text-text-secondary mb-2">📤</div>
          <div className="text-lg font-semibold text-text-main">Drag & Drop Video File Here</div>
          <div className="text-sm text-text-secondary mt-2">Max resolution: 1080×1920 (250MB)</div>
          <button className="mt-6 px-6 py-2.5 rounded-xl font-bold bg-primary text-white hover:bg-secondary transition-all shadow-md hover:shadow-lg active:scale-95">
            Browse Files
          </button>
        </div>
      </div>

      {/* Always-visible file info box */}
      <div className="mt-4 p-4 border border-border/60 rounded-xl bg-surface/40 backdrop-blur-md flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-surface-highlight border border-border/40 rounded-lg flex items-center justify-center flex-shrink-0 text-lg shadow-inner drop-shadow-sm">
            🎬
          </div>
          <div>
            {/* 2. Hardcoded Max-Widths + Truncate on the Text Container */}
            {/* The text will immediately turn to "..." once it hits these pixel widths */}
            <div
              className="font-medium text-text-main truncate inline-block align-bottom max-w-[120px] sm:max-w-[200px] md:max-w-[280px] lg:max-w-[190px] xl:max-w-[190px]"
              title={files && files.length > 0 ? files[0].name : "Video Name"}
            >
              {files && files.length > 0 ? files[0].name : "Video Name"}
            </div>

            <div className="text-xs text-text-secondary mt-0.5">
              {files && files.length > 0 ? `${(files[0].size / 1024 / 1024).toFixed(2)} MB` : "—"}
            </div>
          </div>
        </div>

        {files && files.length > 0 ? (
          <div className="text-xs text-text-secondary ml-2 shrink-0">Selected</div>
        ) : (
          <div className="text-xs text-text-secondary ml-2 shrink-0">No file</div>
        )}
      </div>
    </div>
  );
}

// src/lib/uploadService.ts
type ProgressDetail = { progress: number };
type DoneDetail = { status: number; responseText: string };

class UploadService extends EventTarget {
  private xhr: XMLHttpRequest | null = null;
  private currentFile: File | null = null;

  async start(file: File) {
    // abort any existing upload
    if (this.xhr) this.abort();

    this.currentFile = file;

    try {
      // 1. Get a presigned URL from our API
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });

      if (!presignRes.ok) {
        const err = await presignRes.json();
        throw new Error(err.error || "Failed to get upload URL");
      }

      const { uploadUrl, publicUrl } = await presignRes.json();

      // 2. Upload directly to B2 using the presigned URL via PUT
      const xhr = new XMLHttpRequest();
      this.xhr = xhr;

      xhr.open("PUT", uploadUrl);
      
      // B2 requires the Content-Type to match what was presigned
      xhr.setRequestHeader("Content-Type", file.type);

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        this.dispatchEvent(new CustomEvent<ProgressDetail>("progress", { detail: { progress: pct } }));
      };

      xhr.onload = () => {
        const status = xhr.status;
        // B2 returns 200 OK on successful PUT
        if (status >= 200 && status < 300) {
          this.dispatchEvent(new CustomEvent<DoneDetail>("done", { 
            detail: { status, responseText: JSON.stringify({ url: publicUrl }) } 
          }));
        } else {
          this.dispatchEvent(new CustomEvent("error"));
        }
        this.cleanup();
      };

      xhr.onerror = () => {
        this.dispatchEvent(new CustomEvent("error"));
        this.cleanup();
      };

      xhr.onabort = () => {
        this.dispatchEvent(new CustomEvent("aborted"));
        this.cleanup();
      };

      // notify that upload started
      this.dispatchEvent(new CustomEvent("start"));

      // Send the file blob directly
      xhr.send(file);

    } catch (err) {
      console.error("Upload error:", err);
      this.dispatchEvent(new CustomEvent("error"));
      this.cleanup();
    }
  }

  abort() {
    if (!this.xhr) return;
    try {
      this.xhr.abort();
    } catch {
      // ignore
    }
  }

  private cleanup() {
    this.xhr = null;
    this.currentFile = null;
  }

  // convenience subscriptions
  onProgress(fn: (pct: number) => void) {
    const handler = (e: Event) => fn((e as CustomEvent<ProgressDetail>).detail.progress);
    this.addEventListener("progress", handler as EventListener);
    return () => this.removeEventListener("progress", handler as EventListener);
  }

  onDone(fn: (detail: DoneDetail) => void) {
    const handler = (e: Event) => fn((e as CustomEvent<DoneDetail>).detail);
    this.addEventListener("done", handler as EventListener);
    return () => this.removeEventListener("done", handler as EventListener);
  }

  onError(fn: () => void) {
    const handler = () => fn();
    this.addEventListener("error", handler as EventListener);
    return () => this.removeEventListener("error", handler as EventListener);
  }

  onStart(fn: () => void) {
    const handler = () => fn();
    this.addEventListener("start", handler as EventListener);
    return () => this.removeEventListener("start", handler as EventListener);
  }

  onAbort(fn: () => void) {
    const handler = () => fn();
    this.addEventListener("aborted", handler as EventListener);
    return () => this.removeEventListener("aborted", handler as EventListener);
  }
}

export const uploadService = new UploadService();
export default uploadService;
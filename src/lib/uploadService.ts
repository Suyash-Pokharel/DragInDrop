type ProgressDetail = { progress: number };
type DoneDetail = { status: number; responseText: string };
type ErrorDetail = { message: string; code?: string };

class UploadService extends EventTarget {
  private xhr: XMLHttpRequest | null = null;

  async start(file: File) {
    if (this.xhr) this.abort();

    try {
      console.log("Starting upload for file:", { name: file.name, type: file.type, size: file.size });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('fileType', file.type);

      const xhr = new XMLHttpRequest();
      this.xhr = xhr;

      xhr.open("POST", "/api/upload/presign");

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        this.dispatchEvent(
          new CustomEvent<ProgressDetail>("progress", { detail: { progress: pct } }),
        );
      };

      xhr.onload = () => {
        const status = xhr.status;
        console.log("Upload completed with status:", status);
        
        if (status >= 200 && status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.fileKey) {
              const responseText = JSON.stringify({ fileKey: response.fileKey, success: true });
              this.dispatchEvent(
                new CustomEvent<DoneDetail>("done", { detail: { status, responseText } }),
              );
            } else {
              throw new Error("No fileKey in response");
            }
          } catch (error) {
            console.error("Failed to parse upload response:", error);
            this.dispatchEvent(
              new CustomEvent<ErrorDetail>("error", {
                detail: { message: "Upload completed but response was invalid", code: "INVALID_RESPONSE" },
              })
            );
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            this.dispatchEvent(
              new CustomEvent<ErrorDetail>("error", {
                detail: { message: errorResponse.error || "Upload failed", code: "UPLOAD_FAILED" },
              })
            );
          } catch {
            this.dispatchEvent(
              new CustomEvent<ErrorDetail>("error", {
                detail: { message: "Upload failed. Please try again.", code: "UPLOAD_FAILED" },
              })
            );
          }
        }
        this.cleanup();
      };

      xhr.onerror = () => {
        console.error("XHR error occurred during upload");
        console.error("XHR readyState:", xhr.readyState);
        console.error("XHR status:", xhr.status);
        console.error("XHR statusText:", xhr.statusText);
        const errorDetail: ErrorDetail = { 
          message: "Upload failed. Please check your connection and try again.", 
          code: "UPLOAD_FAILED" 
        };
        console.log("Dispatching error with detail:", errorDetail);
        this.dispatchEvent(
          new CustomEvent<ErrorDetail>("error", {
            detail: errorDetail,
          })
        );
        this.cleanup();
      };

      xhr.onabort = () => {
        this.dispatchEvent(new CustomEvent("aborted"));
        this.cleanup();
      };

      this.dispatchEvent(new CustomEvent("start"));

      console.log("Sending file to backend...");
      xhr.send(formData);
    } catch (error) {
      console.error("Upload error:", error);
      this.dispatchEvent(
        new CustomEvent<ErrorDetail>("error", {
          detail: { message: "An unexpected error occurred. Please try again.", code: "UNKNOWN_ERROR" },
        })
      );
    }
  }

  abort() {
    if (!this.xhr) return;
    try {
      this.xhr.abort();
    } catch {
      // ignore
    }
    // cleanup will be triggered via onabort
  }

  private cleanup() {
    this.xhr = null;
  }

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

  onError(fn: (detail: ErrorDetail) => void) {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<ErrorDetail>;
      fn(customEvent.detail || { message: "Unknown error occurred", code: "UNKNOWN" });
    };
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

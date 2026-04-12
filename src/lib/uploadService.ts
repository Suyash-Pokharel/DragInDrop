// app/lib/uploadService.ts
type ProgressDetail = { progress: number };
type DoneDetail = { status: number; responseText: string };
type ErrorDetail = { message: string; code?: string };

class UploadService extends EventTarget {
  private xhr: XMLHttpRequest | null = null;

  async start(file: File) {
    // abort any existing upload
    if (this.xhr) this.abort();

    try {
      console.log("Starting upload for file:", { name: file.name, type: file.type, size: file.size });
      
      // Request presigned URL from API
      const presignResponse = await fetch("/api/upload/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      console.log("Presign response status:", presignResponse.status);

      // Handle non-OK response
      if (!presignResponse.ok) {
        const error = await presignResponse.json();
        console.error("Failed to get presigned URL:", error);
        
        // Dispatch error with specific message
        const errorMessage = error.error || "Failed to generate upload URL";
        const errorCode = presignResponse.status === 401 ? "AUTH_FAILED" : "PRESIGN_FAILED";
        this.dispatchEvent(
          new CustomEvent<ErrorDetail>("error", {
            detail: { message: errorMessage, code: errorCode },
          })
        );
        return;
      }

      // Extract uploadUrl and fileKey from response
      const responseData = await presignResponse.json();
      console.log("Presign response data:", { 
        hasUploadUrl: !!responseData.uploadUrl, 
        hasFileKey: !!responseData.fileKey,
        fileKey: responseData.fileKey 
      });
      const { uploadUrl, fileKey } = responseData;

      // Validate we have the required data
      if (!uploadUrl || !fileKey) {
        console.error("Missing uploadUrl or fileKey from presign response");
        this.dispatchEvent(
          new CustomEvent<ErrorDetail>("error", {
            detail: { message: "Invalid upload configuration received", code: "INVALID_PRESIGN_RESPONSE" },
          })
        );
        return;
      }

      // Log the URL domain to verify it's correct
      const urlObj = new URL(uploadUrl);
      console.log("Upload destination:", {
        host: urlObj.hostname,
        bucket: urlObj.pathname.split('/')[1],
        path: urlObj.pathname
      });

      // Create new XMLHttpRequest and store in xhr property
      const xhr = new XMLHttpRequest();
      this.xhr = xhr;

      // Open XMLHttpRequest with PUT method and uploadUrl
      xhr.open("PUT", uploadUrl);

      // Set Content-Type header to file's type
      xhr.setRequestHeader("Content-Type", file.type);

      // Implement upload progress handler
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        this.dispatchEvent(
          new CustomEvent<ProgressDetail>("progress", { detail: { progress: pct } }),
        );
      };

      // Implement onload handler that dispatches "done" event
      xhr.onload = () => {
        const status = xhr.status;
        console.log("XHR upload completed with status:", status);
        // Create response with fileKey
        const responseText = JSON.stringify({ fileKey, success: true });
        this.dispatchEvent(
          new CustomEvent<DoneDetail>("done", { detail: { status, responseText } }),
        );
        this.cleanup();
      };

      // Implement onerror handler
      xhr.onerror = (event) => {
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

      // Implement onabort handler
      xhr.onabort = () => {
        this.dispatchEvent(new CustomEvent("aborted"));
        this.cleanup();
      };

      // Dispatch "start" event when upload begins
      this.dispatchEvent(new CustomEvent("start"));

      // Send file directly (not wrapped in FormData)
      console.log("Sending file to B2...");
      xhr.send(file);
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

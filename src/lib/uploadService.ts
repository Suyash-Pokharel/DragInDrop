// app/lib/uploadService.ts
type ProgressDetail = { progress: number };
type DoneDetail = { status: number; responseText: string };

class UploadService extends EventTarget {
  private xhr: XMLHttpRequest | null = null;

  start(file: File) {
    // abort any existing upload
    if (this.xhr) this.abort();

    const fd = new FormData();
    fd.append("file", file);

    const xhr = new XMLHttpRequest();
    this.xhr = xhr;

    xhr.open("POST", "/api/upload");

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      this.dispatchEvent(
        new CustomEvent<ProgressDetail>("progress", { detail: { progress: pct } }),
      );
    };

    xhr.onload = () => {
      const status = xhr.status;
      const resp = xhr.responseText;
      this.dispatchEvent(
        new CustomEvent<DoneDetail>("done", { detail: { status, responseText: resp } }),
      );
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

    // optional: set timeout / retry headers here
    xhr.send(fd);

    // notify that upload started
    this.dispatchEvent(new CustomEvent("start"));
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

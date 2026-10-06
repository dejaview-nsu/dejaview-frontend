class FakeXMLHttpRequestUpload extends EventTarget {
  readonly listenedTypes: string[] = [];

  override addEventListener(...args: Parameters<EventTarget["addEventListener"]>) {
    this.listenedTypes.push(args[0]);
    super.addEventListener(...args);
  }
}

export class FakeXMLHttpRequest extends EventTarget {
  static readonly UNSENT = 0;
  static readonly OPENED = 1;
  static readonly HEADERS_RECEIVED = 2;
  static readonly LOADING = 3;
  static readonly DONE = 4;
  static instances: FakeXMLHttpRequest[] = [];

  readonly upload = new FakeXMLHttpRequestUpload();
  readyState = 0;
  method = "";
  url = "";
  withCredentials = false;
  requestHeaders: Record<string, string> = {};
  body: unknown = undefined;
  status = 0;
  responseText = "";
  aborted = false;
  private responseHeaders: Record<string, string> = {};
  private sent = false;

  static reset() {
    FakeXMLHttpRequest.instances = [];
  }

  static last() {
    const instance = FakeXMLHttpRequest.instances.at(-1);

    if (!instance) {
      throw new Error("No XMLHttpRequest was sent");
    }

    return instance;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
    this.readyState = FakeXMLHttpRequest.OPENED;
  }

  setRequestHeader(name: string, value: string) {
    this.requestHeaders[name] = value;
  }

  send(body: unknown) {
    this.body = body;
    this.sent = true;
    FakeXMLHttpRequest.instances.push(this);
  }

  abort() {
    this.aborted = true;

    if (!this.sent) {
      return;
    }

    this.failRequest("abort");
    this.readyState = FakeXMLHttpRequest.UNSENT;
  }

  getResponseHeader(name: string) {
    return this.responseHeaders[name.toLowerCase()] ?? null;
  }

  progressUpload(loaded: number, total: number, lengthComputable = true) {
    this.upload.dispatchEvent(new ProgressEvent("progress", { loaded, total, lengthComputable }));
  }

  finishUpload() {
    this.upload.dispatchEvent(new ProgressEvent("load"));
  }

  receiveHeaders() {
    this.readyState = FakeXMLHttpRequest.HEADERS_RECEIVED;
    this.dispatchEvent(new Event("readystatechange"));
  }

  respond(status: number, body: string, headers: Record<string, string> = {}) {
    this.readyState = FakeXMLHttpRequest.DONE;
    this.status = status;
    this.responseText = body;
    this.responseHeaders = Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
    );
    this.sent = false;
    this.dispatchEvent(new Event("readystatechange"));
    this.dispatchEvent(new Event("load"));
  }

  failNetwork() {
    this.failRequest("error");
  }

  private failRequest(type: "abort" | "error") {
    this.readyState = FakeXMLHttpRequest.DONE;
    this.status = 0;
    this.responseText = "";
    this.sent = false;
    this.dispatchEvent(new Event("readystatechange"));
    this.upload.dispatchEvent(new ProgressEvent(type));
    this.dispatchEvent(new Event(type));
  }
}

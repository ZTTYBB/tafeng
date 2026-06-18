import { ArrowUp, Download, FileText, Folder, FolderOpen, Save, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RemoteFile, TerminalMessage } from "../../shared/types";
import type { TFunction } from "../lib/i18n";

type Props = {
  socket: WebSocket | null;
  t: TFunction;
};

export function FileEditor({ socket, t }: Props) {
  const [currentPath, setCurrentPath] = useState("/root");
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [activeFile, setActiveFile] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const downloadChunksRef = useRef<Map<string, string[]>>(new Map());

  const sendMessage = useCallback(
    (msg: TerminalMessage) => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(msg));
      }
    },
    [socket]
  );

  const listDirectory = useCallback(
    (path: string) => {
      setLoading(true);
      setStatus("");
      sendMessage({ type: "sftp-ls", requestId: crypto.randomUUID(), path });
    },
    [sendMessage]
  );

  // List directory when socket becomes available or path changes
  useEffect(() => {
    if (!socket) return;
    listDirectory(currentPath);
  }, [socket, currentPath, listDirectory]);

  // Listen for WebSocket messages
  useEffect(() => {
    if (!socket) return;

    function handleMessage(event: MessageEvent) {
      const msg = JSON.parse(String(event.data)) as TerminalMessage;

      if (msg.type === "sftp-ls-result") {
        setFiles(msg.files);
        setLoading(false);
      } else if (msg.type === "sftp-read-result") {
        setContent(msg.content);
        setActiveFile(msg.path);
        setLoading(false);
      } else if (msg.type === "sftp-write-result") {
        setLoading(false);
        if (msg.ok) {
          setStatus(`${t("savedAt")} ${new Date().toLocaleTimeString()}`);
        } else {
          setStatus(t("writeError"));
        }
      } else if (msg.type === "sftp-upload-progress") {
        if (msg.done) {
          setLoading(false);
          setStatus(t("uploadSuccess"));
          listDirectory(currentPath);
        } else {
          setStatus(t("uploading"));
        }
      } else if (msg.type === "sftp-download-chunk") {
        const chunks = downloadChunksRef.current.get(msg.requestId);
        if (chunks) {
          chunks.push(msg.chunk);
          if (msg.done) {
            downloadChunksRef.current.delete(msg.requestId);
            setLoading(false);
            setStatus("");
            try {
              const combined = chunks.join("");
              const binary = atob(combined);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }
              const blob = new Blob([bytes]);
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = activeFile.split("/").pop() ?? "download";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } catch {
              setStatus(t("downloadFailed"));
            }
          }
        }
      } else if (msg.type === "sftp-error") {
        setLoading(false);
        setStatus(msg.message);
      }
    }

    socket.addEventListener("message", handleMessage);
    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, t, currentPath, listDirectory, activeFile]);

  function navigateToParent() {
    const parent = currentPath.replace(/\/[^/]+$/, "") || "/";
    setCurrentPath(parent);
  }

  function handleFileClick(file: RemoteFile) {
    if (loading) return;
    if (file.type === "directory") {
      setCurrentPath(file.path);
    } else {
      setLoading(true);
      setStatus("");
      sendMessage({ type: "sftp-read", requestId: crypto.randomUUID(), path: file.path });
    }
  }

  function handleSave() {
    if (loading || !activeFile) return;
    setLoading(true);
    setStatus("");
    sendMessage({ type: "sftp-write", requestId: crypto.randomUUID(), path: activeFile, content });
  }

  function handleUpload() {
    if (loading) return;
    fileInputRef.current?.click();
  }

  async function onFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    setLoading(true);
    setStatus(t("uploading"));

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const chunkSize = 64 * 1024; // 64KB
      const requestId = crypto.randomUUID();
      const uploadPath = `${currentPath}/${file.name}`;

      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const slice = bytes.slice(offset, offset + chunkSize);
        let binary = "";
        for (let i = 0; i < slice.length; i++) {
          binary += String.fromCharCode(slice[i]);
        }
        const chunk = btoa(binary);
        const done = offset + chunkSize >= bytes.length;
        sendMessage({ type: "sftp-upload", requestId, path: uploadPath, chunk, offset, done });
      }

      // Handle empty files
      if (bytes.length === 0) {
        sendMessage({ type: "sftp-upload", requestId, path: uploadPath, chunk: "", offset: 0, done: true });
      }
    } catch {
      setLoading(false);
      setStatus(t("uploadFailed"));
    }
  }

  function handleDownload() {
    if (loading || !activeFile) return;
    setLoading(true);
    setStatus(t("downloading"));
    const requestId = crypto.randomUUID();
    downloadChunksRef.current.set(requestId, []);
    sendMessage({ type: "sftp-download", requestId, path: activeFile });
  }

  if (!socket) {
    return (
      <section className="file-editor">
        <div style={{ gridColumn: "1 / -1", display: "grid", placeItems: "center", color: "#9d9d9d" }}>
          {t("noSshConnection")}
        </div>
      </section>
    );
  }

  return (
    <section className="file-editor">
      <div className="file-browser">
        <div className="panel-title">
          <FolderOpen size={18} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentPath}</span>
        </div>
        <div className="file-list">
          {currentPath !== "/" && (
            <button type="button" onClick={navigateToParent} disabled={loading}>
              <ArrowUp size={15} />
              <span>..</span>
              <small>{t("parentDir")}</small>
            </button>
          )}
          {files.length === 0 && !loading && (
            <small style={{ color: "#9d9d9d", padding: "9px" }}>{t("emptyDir")}</small>
          )}
          {files.map((file) => (
            <button key={file.path} type="button" onClick={() => handleFileClick(file)} disabled={loading}>
              {file.type === "directory" ? <Folder size={15} /> : <FileText size={15} />}
              <span>{file.name}</span>
              <small>{file.type === "file" ? `${file.size} B` : t("directory")}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="editor-pane">
        <div className="editor-toolbar">
          <span>{activeFile || t("fileManager")}</span>
          <div>
            <button type="button" title={t("uploadFile")} onClick={handleUpload} disabled={loading}>
              <Upload size={16} />
            </button>
            <button type="button" title={t("downloadFile")} onClick={handleDownload} disabled={loading || !activeFile}>
              <Download size={16} />
            </button>
            <button type="button" title={t("save")} onClick={handleSave} disabled={loading || !activeFile}>
              <Save size={16} />
            </button>
          </div>
        </div>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} />
        <small className="editor-status">{status}</small>
      </div>
      <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={onFileSelected} />
    </section>
  );
}

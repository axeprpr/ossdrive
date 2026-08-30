import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Download, FolderPlus, FolderUp, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Toaster, toast } from "sonner";
import { FileTable } from "./components/file-table";
import { PreviewDialog } from "./components/preview-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "./components/ui/alert-dialog";
import { Button, IconButton } from "./components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { useDebouncedValue } from "./hooks/use-debounced-value";
import { listFiles, postJson } from "./lib/api";
import { formatSize } from "./lib/utils";
import type { Listing, PreviewData, SortDirection, SortKey } from "./types";

const emptyListing: Listing = { items: [], total: 0, usage: 0, page: 1, page_size: 10 };
const textExtensions = new Set(["txt", "md", "markdown"]);
const extension = (name: string) => name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";

export default function App() {
  const [path, setPath] = useState("");
  const [listing, setListing] = useState<Listing>(emptyListing);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; kind: "file" | "folder" } | null>(null);
  const [mkdirName, setMkdirName] = useState("");
  const [uploading, setUploading] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebouncedValue(query, 250);

  const fullName = (name: string) => path ? `${path}/${name}` : name;
  const downloadUrl = (name: string) => `/api/download?name=${encodeURIComponent(fullName(name))}`;
  const pages = Math.max(1, Math.ceil(listing.total / pageSize));
  const showError = (error: unknown) => toast.error(error instanceof Error ? error.message : "操作失败", { duration: Infinity });

  async function load(refresh = false) {
    setLoading(true);
    try {
      const data = await listFiles({ path, page, pageSize, query: debouncedQuery, sort, direction, refresh });
      const lastPage = Math.max(1, Math.ceil(data.total / pageSize));
      if (page > lastPage) {
        setPage(lastPage);
        return;
      }
      setListing(data);
      setSelected(new Set());
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [path, page, pageSize, debouncedQuery, sort, direction]);

  function sortBy(key: SortKey) {
    if (sort === key) setDirection((value) => value === "asc" ? "desc" : "asc");
    else {
      setSort(key);
      setDirection("asc");
    }
    setPage(1);
  }

  async function remove(name: string, kind: "file" | "folder" = "file") {
    setDeleting(name);
    try {
      await postJson("/api/delete", { name: fullName(name), kind });
      await load(true);
    } catch (error) {
      showError(error);
    } finally {
      setDeleting(null);
    }
  }

  async function upload(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      try {
        const startedAt = performance.now();
        setUploading(file.name);
        const contentType = file.type || "application/octet-stream";
        const signed = await postJson<{ url: string }>("/api/upload-url", { name: fullName(file.name), content_type: contentType });
        await new Promise<void>((resolve, reject) => {
          const request = new XMLHttpRequest();
          request.open("PUT", signed.url);
          request.setRequestHeader("Content-Type", contentType);
          request.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            const percent = Math.round(event.loaded / event.total * 100);
            const elapsed = Math.max((performance.now() - startedAt) / 1000, 0.1);
            setUploading(`${file.name} · ${percent}% · ${formatSize(event.loaded / elapsed)}/s`);
          };
          request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`上传接口返回 HTTP ${request.status}`));
          request.onerror = () => reject(new Error("上传网络错误"));
          request.onabort = () => reject(new Error("上传已取消"));
          request.ontimeout = () => reject(new Error("上传超时"));
          request.send(file);
        });
        await postJson("/api/upload-complete", { name: fullName(file.name) });
      } catch (error) {
        showError(error);
      }
    }
    setUploading("");
    if (fileInput.current) fileInput.current.value = "";
    await load(true);
  }

  async function openPreview(name: string) {
    const url = downloadUrl(name);
    if (!textExtensions.has(extension(name))) {
      setPreview({ name, url });
      return;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`预览失败（HTTP ${response.status}）`);
      setPreview({ name, url, text: await response.text() });
    } catch (error) {
      showError(error);
    }
  }

  async function mkdir() {
    const name = mkdirName.trim();
    if (!/^[\u4e00-\u9fffA-Za-z0-9_-]{1,64}$/.test(name)) {
      toast.error("目录名只能使用中文、英文、数字、- 和 _", { duration: Infinity });
      return;
    }
    try {
      await postJson("/api/mkdir", { name: fullName(name) });
      setMkdirOpen(false);
      setMkdirName("");
      await load(true);
    } catch (error) {
      showError(error);
    }
  }

  async function batchDelete() {
    const names = [...selected];
    setBatchDeleteOpen(false);
    for (const name of names) {
      setDeleting(name);
      try {
        await postJson("/api/delete", { name: fullName(name) });
      } catch (error) {
        showError(error);
        break;
      }
    }
    setDeleting(null);
    await load(true);
  }

  function batchDownload() {
    for (const name of selected) {
      const anchor = document.createElement("a");
      anchor.href = downloadUrl(name);
      anchor.download = name;
      anchor.click();
    }
  }

  return (
    <div className="min-h-screen bg-[#fbfdf8] text-[#26332b]">
      <Toaster position="bottom-right" closeButton richColors />
      <main className="mx-auto flex h-screen max-w-5xl flex-col overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
        <header className="flex shrink-0 items-center pb-3">
          <a href="https://axe3.cn" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xl text-[#26332b] no-underline">
            <img src="/logo.svg" alt="OSS 网盘" className="h-6 w-6" />OSS 网盘
          </a>
        </header>

        <section className="mb-3 flex h-16 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#b8cbb9] bg-white/60 px-3 text-center text-sm shadow-sm" onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (event.dataTransfer.files.length) void upload(event.dataTransfer.files); }}>
          <input ref={fileInput} hidden type="file" multiple onChange={(event) => event.target.files && void upload(event.target.files)} />
          <span className="max-w-full truncate">{uploading || "点击或拖拽文件上传"}</span>
        </section>

        <div className="mb-2 flex min-w-0 shrink-0 items-center gap-2">
          <IconButton label="返回上一级" disabled={!path} onClick={() => { setPath(path.split("/").slice(0, -1).join("/")); setPage(1); }}><FolderUp className="h-[18px] w-[18px]" /></IconButton>
          <div className="relative min-w-24 max-w-[260px] flex-1">
            <Search className="absolute left-2 top-2 h-4 w-4 text-[#8fa493]" />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="搜索" className="h-9 w-full rounded-md border border-[#cfdfd0] bg-[#fffffc] pl-8 pr-7 text-xs outline-none focus:border-[#8fb398] focus:ring-2 focus:ring-[#dcecdc]" />
            {query && <button aria-label="清除搜索" className="absolute right-1.5 top-1.5 rounded p-0.5 text-[#829488] hover:bg-[#edf6eb]" onClick={() => setQuery("")}><X className="h-4 w-4" /></button>}
          </div>
          <span className="ml-auto hidden whitespace-nowrap text-xs text-[#829488] md:block">{formatSize(listing.usage)} / 500 GB</span>
          <IconButton label="批量下载" disabled={!selected.size} onClick={batchDownload}><Download className="h-[18px] w-[18px]" /></IconButton>
          <IconButton label="批量删除" variant="destructive" disabled={!selected.size} onClick={() => setBatchDeleteOpen(true)}><Trash2 className="h-[18px] w-[18px]" /></IconButton>
          <IconButton label="刷新目录" disabled={loading} onClick={() => void load(true)}><RefreshCw className={`h-[18px] w-[18px] ${loading ? "animate-spin" : ""}`} /></IconButton>
          <IconButton label="新建目录" onClick={() => setMkdirOpen(true)}><FolderPlus className="h-[18px] w-[18px]" /></IconButton>
        </div>

        <FileTable items={listing.items} selected={selected} deleting={deleting} sort={sort} direction={direction} onSort={sortBy} onOpenFolder={(name) => { setPath(fullName(name)); setPage(1); }} onToggle={(name, checked) => { const next = new Set(selected); checked ? next.add(name) : next.delete(name); setSelected(next); }} onPreview={(name) => void openPreview(name)} onDownload={(name) => { location.href = downloadUrl(name); }} onDelete={(name, kind = "file") => kind === "folder" ? setDeleteTarget({ name, kind }) : void remove(name)} />

        <footer className="flex shrink-0 items-center justify-between gap-2 pt-3 sm:gap-3">
          <span className="min-w-0 max-w-[35%] truncate pl-[30px] text-xs text-[#829488]" title={path || "/"}>{path || "/"}</span>
          <div className="flex items-center justify-center gap-2 pr-[30px] sm:gap-3">
          <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}>
            <SelectTrigger aria-label="每页数量"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="10">10 条/页</SelectItem><SelectItem value="30">30 条/页</SelectItem><SelectItem value="50">50 条/页</SelectItem></SelectContent>
          </Select>
          <IconButton label="上一页" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft className="h-[18px] w-[18px]" /></IconButton>
          <span className="min-w-24 text-center text-xs text-[#718c78]">{Math.min(page, pages)} / {pages} · 共 {listing.total} 项</span>
          <IconButton label="下一页" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}><ArrowRight className="h-[18px] w-[18px]" /></IconButton>
          </div>
        </footer>
      </main>

      <Dialog open={mkdirOpen} onOpenChange={setMkdirOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>新建目录</DialogTitle><DialogDescription>仅支持中文、英文、数字、- 和 _</DialogDescription></DialogHeader>
          <input autoFocus value={mkdirName} onChange={(event) => setMkdirName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void mkdir()} placeholder="输入目录名称" className="h-9 w-full rounded-md border border-[#cfdfd0] px-3 text-sm outline-none focus:ring-2 focus:ring-[#dcecdc]" />
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setMkdirOpen(false)}>取消</Button><Button onClick={() => void mkdir()}>创建</Button></div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogTitle className="text-base font-semibold">确认批量删除</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-sm text-[#718c78]">将删除选中的 {selected.size} 个文件，此操作无法撤销。</AlertDialogDescription>
          <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => void batchDelete()}>删除</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogTitle className="text-base font-semibold">确认删除目录</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-sm text-[#718c78]">将删除目录“{deleteTarget?.name}”以及目录下的所有内容，此操作无法撤销。</AlertDialogDescription>
          <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteTarget) void remove(deleteTarget.name, "folder"); setDeleteTarget(null); }}>删除目录</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {preview && <PreviewDialog data={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

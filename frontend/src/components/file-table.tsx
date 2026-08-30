import { ChevronDown, ChevronUp, Download, Eye, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Checkbox } from "./ui/checkbox";
import { IconButton } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { cn, formatSize } from "../lib/utils";
import type { DriveItem, SortDirection, SortKey } from "../types";
import { previewExtensions } from "./preview-dialog";

const desktopGridClass = "grid-cols-[28px_minmax(0,1fr)_88px_145px_112px]";
const extension = (name: string) => name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";

function SortButton({ label, active, direction, onClick, className }: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button type="button" className={cn("flex items-center gap-1 bg-transparent p-0 text-left text-xs font-semibold text-[#68786c] outline-none", className)} onClick={onClick}>
      <span>{label}</span>
      <span className={active ? "text-[#5f8969]" : "text-[#aab7ac]"}>
        {active ? direction === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" /> : (
          <span className="flex flex-col -space-y-1.5"><ChevronUp className="h-2.5 w-2.5" /><ChevronDown className="h-2.5 w-2.5" /></span>
        )}
      </span>
    </button>
  );
}

function FileName({ item }: { item: DriveItem }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    const element = textRef.current;
    setOpen(nextOpen && Boolean(element && element.scrollWidth > element.clientWidth));
  }

  return (
    <TooltipProvider delayDuration={450}>
      <Tooltip open={open} onOpenChange={handleOpenChange}>
        <TooltipTrigger asChild>
          <span ref={textRef} className={cn("block w-fit max-w-full truncate", item.kind === "folder" && "font-semibold text-[#4f7c5b]")}>{item.kind === "folder" ? "📁" : "📄"} {item.name}</span>
        </TooltipTrigger>
        <TooltipContent>{item.name}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function FileActions({ item, deleting, onPreview, onDownload, onDelete }: {
  item: DriveItem;
  deleting: string | null;
  onPreview: (name: string) => void;
  onDownload: (name: string) => void;
  onDelete: (name: string, kind?: "file" | "folder") => void;
}) {
  return (
    <span className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
      {item.kind === "file" && previewExtensions.has(extension(item.name)) && <IconButton label="预览" onClick={() => onPreview(item.name)}><Eye className="h-[18px] w-[18px]" /></IconButton>}
      {item.kind === "file" && <IconButton label="下载" onClick={() => onDownload(item.name)}><Download className="h-[18px] w-[18px]" /></IconButton>}
      <IconButton label={item.kind === "folder" ? "删除目录" : "删除"} variant="destructive" disabled={deleting === item.name} onClick={() => onDelete(item.name, item.kind)}>{deleting === item.name ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Trash2 className="h-[18px] w-[18px]" />}</IconButton>
    </span>
  );
}

export function FileTable({ items, selected, deleting, sort, direction, onSort, onOpenFolder, onToggle, onPreview, onDownload, onDelete }: {
  items: DriveItem[];
  selected: Set<string>;
  deleting: string | null;
  sort: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  onOpenFolder: (name: string) => void;
  onToggle: (name: string, checked: boolean) => void;
  onPreview: (name: string) => void;
  onDownload: (name: string) => void;
  onDelete: (name: string, kind?: "file" | "folder") => void;
}) {
  return (
    <section className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#dce7dc] bg-white shadow-sm">
      <div className="border-b border-[#dce7dc] bg-[#f4f8f2] px-3 py-2 text-xs font-semibold text-[#68786c] sm:hidden"><div className="grid grid-cols-[28px_minmax(0,1fr)_104px]"><span /><SortButton label="名称" active={sort === "name"} direction={direction} onClick={() => onSort("name")} /><span /></div></div>
      <div className={cn("hidden border-b border-[#dce7dc] bg-[#f4f8f2] px-3 py-2 text-xs font-semibold text-[#68786c] sm:grid", desktopGridClass)}>
        <span /><SortButton label="名称" active={sort === "name"} direction={direction} onClick={() => onSort("name")} /><SortButton label="大小" active={sort === "size"} direction={direction} onClick={() => onSort("size")} /><SortButton label="修改时间" active={sort === "modified"} direction={direction} onClick={() => onSort("modified")} /><span />
      </div>
      <div className="min-h-0 h-full overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
      {items.length === 0 && <div className="flex h-32 items-center justify-center text-sm text-[#829488]">当前目录没有内容</div>}
      {items.map((item) => item.kind === "folder" ? (
        <div key={item.name} className="cursor-pointer border-b border-[#edf2ec] px-3 py-2 text-sm hover:bg-[#f3f8f1]" onClick={() => onOpenFolder(item.name)}>
          <div className="grid grid-cols-[28px_minmax(0,1fr)_104px] items-center sm:hidden"><span /><FileName item={item} /><FileActions item={item} deleting={deleting} onPreview={onPreview} onDownload={onDownload} onDelete={onDelete} /></div>
          <div className={cn("hidden items-center sm:grid", desktopGridClass)}><span /><FileName item={item} /><span /><span /><FileActions item={item} deleting={deleting} onPreview={onPreview} onDownload={onDownload} onDelete={onDelete} /></div>
        </div>
      ) : (
        <div key={item.name} className="cursor-pointer border-b border-[#edf2ec] px-3 py-2 text-sm hover:bg-[#f3f8f1]" onClick={() => onDownload(item.name)}>
          <div className="grid grid-cols-[28px_minmax(0,1fr)_104px] items-center sm:hidden">
            <span onClick={(event) => event.stopPropagation()}><Checkbox checked={selected.has(item.name)} onCheckedChange={(checked) => onToggle(item.name, checked === true)} /></span>
            <FileName item={item} />
            <FileActions item={item} deleting={deleting} onPreview={onPreview} onDownload={onDownload} onDelete={onDelete} />
          </div>
          <div className={cn("hidden items-center sm:grid", desktopGridClass)}>
            <span onClick={(event) => event.stopPropagation()}><Checkbox checked={selected.has(item.name)} onCheckedChange={(checked) => onToggle(item.name, checked === true)} /></span>
            <FileName item={item} />
            <span className="text-xs text-[#718c78]">{formatSize(item.size)}</span>
            <span className="text-xs text-[#718c78]">{new Date(item.modified).toLocaleString()}</span>
            <FileActions item={item} deleting={deleting} onPreview={onPreview} onDownload={onDownload} onDelete={onDelete} />
          </div>
        </div>
      ))}
      </div>
    </section>
  );
}

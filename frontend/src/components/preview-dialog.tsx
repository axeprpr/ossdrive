import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import type { PreviewData } from "../types";

const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);
const videoExtensions = new Set(["mp4", "webm", "mov", "m4v", "ogv"]);
const extension = (name: string) => name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";

export const previewExtensions = new Set(["txt", "md", "markdown", ...imageExtensions, ...videoExtensions]);

export function PreviewDialog({ data, onClose }: { data: PreviewData; onClose: () => void }) {
  const fileExtension = extension(data.name);
  const [html, setHtml] = useState("");
  const [rendering, setRendering] = useState(fileExtension === "md" || fileExtension === "markdown");

  useEffect(() => {
    if (data.text === undefined || (fileExtension !== "md" && fileExtension !== "markdown")) return;
    let active = true;
    void Promise.all([import("marked"), import("dompurify")]).then(([markedModule, purifyModule]) => {
      if (!active) return;
      const parsed = markedModule.marked.parse(data.text || "") as string;
      setHtml(purifyModule.default.sanitize(parsed));
      setRendering(false);
    });
    return () => { active = false; };
  }, [data.text, fileExtension]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-[#e2ebe1] p-3">
          <DialogTitle className="truncate pr-6 text-sm font-medium">{data.name}</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto p-4">
          {imageExtensions.has(fileExtension) && <img src={data.url} alt={data.name} className="mx-auto max-h-[70vh] max-w-full" />}
          {videoExtensions.has(fileExtension) && <video src={data.url} controls className="mx-auto max-h-[70vh] max-w-full" />}
          {rendering && <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-[#5f8969]" /></div>}
          {!rendering && html && <article className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />}
          {data.text !== undefined && fileExtension !== "md" && fileExtension !== "markdown" && <pre className="whitespace-pre-wrap break-words text-sm">{data.text}</pre>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

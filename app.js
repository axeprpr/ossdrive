(() => {
  let cur = "";
  let source = { folders: [], files: [], usage: 0 };
  let page = 1;
  let pageSize = 10;
  let query = "";
  let sortBy = "name";
  let sortDirection = "asc";
  const selected = new Set();
  const directoryPattern = /^[\u4e00-\u9fffA-Za-z0-9_-]{1,64}$/;
  const previewExtensions = new Set(["txt", "md", "markdown", "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "mp4", "webm", "mov", "m4v", "ogv"]);
  const downloadIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 21h14" /></svg>';
  const deleteIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" /></svg>';
  const previewIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.5"/></svg>';
  const spinner = '<span class="spinner" aria-label="删除中"></span>';
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const fullName = (name) => cur ? `${cur}/${name}` : name;
  const extension = (name) => name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  const downloadURL = (name) => "/api/download?name=" + encodeURIComponent(fullName(name));

  function fmt(value) {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let index = 0;
    while (value >= 1024 && index < units.length - 1) { value /= 1024; index++; }
    return value.toFixed(index ? 1 : 0) + " " + units[index];
  }

  function filteredItems() {
    const keyword = query.trim().toLocaleLowerCase();
    const folders = source.folders
      .filter((name) => !keyword || name.toLocaleLowerCase().includes(keyword))
      .map((name) => ({ kind: "folder", name, size: 0, modified: "" }));
    const files = source.files
      .filter((file) => !keyword || file.name.toLocaleLowerCase().includes(keyword))
      .map((file) => ({ ...file, kind: "file" }));
    const factor = sortDirection === "asc" ? 1 : -1;
    const compare = (left, right) => {
      if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
      if (sortBy === "size") return ((left.size || 0) - (right.size || 0)) * factor || left.name.localeCompare(right.name, "zh-CN");
      if (sortBy === "modified") return ((Date.parse(left.modified) || 0) - (Date.parse(right.modified) || 0)) * factor || left.name.localeCompare(right.name, "zh-CN");
      return left.name.localeCompare(right.name, "zh-CN", { numeric: true, sensitivity: "base" }) * factor;
    };
    return [...folders, ...files].sort(compare);
  }

  function updateBatchButtons() {
    const disabled = selected.size === 0;
    $("batch-download").disabled = disabled;
    $("batch-delete").disabled = disabled;
    $("selected-count").textContent = disabled ? "" : `已选 ${selected.size} 项`;
  }

  function render() {
    const items = filteredItems();
    const pages = Math.max(1, Math.ceil(items.length / pageSize));
    page = Math.min(page, pages);
    const start = (page - 1) * pageSize;
    const visible = items.slice(start, start + pageSize);
    $("crumb").textContent = cur ? "根目录 / " + cur : "根目录";
    $("back").hidden = !cur;
    $("usage").textContent = fmt(source.usage) + " / 500 GB";
    $("page-info").textContent = `${page} / ${pages} · 共 ${items.length} 项`;
    $("prev-page").disabled = page <= 1;
    $("next-page").disabled = page >= pages;

    $("items").innerHTML = visible.map((item) => {
      if (item.kind === "folder") {
        return `<div class="row" data-folder="${encodeURIComponent(item.name)}"><div class="select-cell"></div><div class="name folder">📁 ${esc(item.name)}</div><div></div><div class="date"></div><div></div></div>`;
      }
      const encoded = encodeURIComponent(item.name);
      const checked = selected.has(item.name) ? " checked" : "";
      const preview = previewExtensions.has(extension(item.name))
        ? `<button type="button" class="action" data-preview="${encoded}"><span class="icon">${previewIcon}</span>预览</button>` : "";
      return `<div class="row" data-download="${encoded}"><div class="select-cell"><input class="file-check" type="checkbox" data-select="${encoded}"${checked} aria-label="选择 ${esc(item.name)}"></div><div class="name">📄 ${esc(item.name)}</div><div class="muted">${fmt(item.size)}</div><div class="muted date">${new Date(item.modified).toLocaleString()}</div><div class="ops">${preview}<button type="button" class="action" data-download="${encoded}"><span class="icon">${downloadIcon}</span>下载</button><button type="button" class="action danger" data-delete="${encoded}"><span class="icon">${deleteIcon}</span>删除</button></div></div>`;
    }).join("") || '<div class="empty">没有符合条件的文件</div>';
    updateBatchButtons();
  }

  async function load() {
    try {
      const response = await fetch("/api/list?prefix=" + encodeURIComponent(cur));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "读取失败");
      source = data;
      selected.clear();
      page = 1;
      render();
    } catch (error) {
      alert(error.message || "读取失败");
    }
  }

  function openFolder(name) { cur = fullName(name); selected.clear(); page = 1; load(); }
  function goBack() { const parts = cur.split("/"); parts.pop(); cur = parts.join("/"); selected.clear(); page = 1; load(); }
  function download(name) { location.href = downloadURL(name); }

  async function removeFile(name, button, confirmDelete = true) {
    if (confirmDelete && !window.confirm(`确认删除“${name}”？`)) return false;
    const old = button?.innerHTML;
    if (button) { button.disabled = true; button.classList.add("deleting"); button.innerHTML = spinner; }
    try {
      const response = await fetch("/api/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: fullName(name) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "删除失败");
      return true;
    } catch (error) {
      if (button) { button.disabled = false; button.classList.remove("deleting"); button.innerHTML = old; }
      alert(error.message || "删除失败");
      return false;
    }
  }

  function closePreview() {
    $("preview-modal").classList.remove("visible");
    $("preview-body").innerHTML = "";
  }

  async function preview(name) {
    const ext = extension(name);
    $("preview-title").textContent = name;
    $("preview-body").innerHTML = '<div class="preview-loading">加载中…</div>';
    $("preview-modal").classList.add("visible");
    const url = downloadURL(name);
    if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) {
      $("preview-body").innerHTML = `<img class="preview-image" src="${url}" alt="${esc(name)}">`;
      return;
    }
    if (["mp4", "webm", "mov", "m4v", "ogv"].includes(ext)) {
      $("preview-body").innerHTML = `<video class="preview-video" src="${url}" controls autoplay></video>`;
      return;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (ext === "md" || ext === "markdown") {
        const rendered = window.marked.parse(text);
        const safe = window.DOMPurify ? window.DOMPurify.sanitize(rendered) : esc(text);
        $("preview-body").innerHTML = `<article class="markdown-body">${safe}</article>`;
      } else {
        $("preview-body").innerHTML = `<pre class="preview-text">${esc(text)}</pre>`;
      }
    } catch (error) {
      $("preview-body").innerHTML = `<div class="error">预览失败：${esc(error.message || "请求失败")}</div>`;
    }
  }

  async function batchDelete() {
    const names = [...selected];
    if (!names.length || !window.confirm(`确认删除选中的 ${names.length} 个文件？`)) return;
    $("batch-delete").disabled = true;
    for (const name of names) await removeFile(name, null, false);
    await load();
  }

  async function batchDownload() {
    const names = [...selected];
    if (!names.length) return;
    for (const name of names) {
      const link = document.createElement("a");
      link.href = downloadURL(name);
      link.download = name;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  async function upload(files) {
    for (const file of files) {
      const response = await fetch("/api/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: fullName(file.name) }) });
      if (!response.ok) { alert("上传频率受限"); continue; }
      const data = await response.json();
      const request = new XMLHttpRequest();
      const started = performance.now();
      $("drop").style.setProperty("--progress", "0%");
      $("upload-status").textContent = "上传中 0%";
      request.open("PUT", data.url);
      request.setRequestHeader("Content-Type", "");
      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.round(event.loaded / event.total * 100);
        const speed = fmt(event.loaded / Math.max((performance.now() - started) / 1000, 0.001)) + "/s";
        $("drop").style.setProperty("--progress", percent + "%");
        $("upload-status").textContent = `上传中 ${percent}% · ${speed}`;
      };
      await new Promise((resolve) => { request.onload = resolve; request.onerror = resolve; request.send(file); });
      if (request.status < 200 || request.status >= 300) alert(file.name + " 上传失败");
    }
    $("drop").style.setProperty("--progress", "0%");
    $("drop-title").textContent = "点击或拖拽文件上传";
    $("upload-status").textContent = "";
    load();
  }

  $("back").onclick = goBack;
  $("items").onclick = (event) => {
    const select = event.target.closest("[data-select]");
    if (select) { event.stopPropagation(); return; }
    const deleteButton = event.target.closest("[data-delete]");
    if (deleteButton) { event.stopPropagation(); removeFile(decodeURIComponent(deleteButton.dataset.delete), deleteButton).then((removed) => removed && load()); return; }
    const previewButton = event.target.closest("[data-preview]");
    if (previewButton) { event.stopPropagation(); preview(decodeURIComponent(previewButton.dataset.preview)); return; }
    const folder = event.target.closest("[data-folder]");
    if (folder) { openFolder(decodeURIComponent(folder.dataset.folder)); return; }
    const file = event.target.closest("[data-download]");
    if (file) download(decodeURIComponent(file.dataset.download));
  };
  $("items").onchange = (event) => {
    const checkbox = event.target.closest("[data-select]");
    if (!checkbox) return;
    const name = decodeURIComponent(checkbox.dataset.select);
    checkbox.checked ? selected.add(name) : selected.delete(name);
    updateBatchButtons();
  };
  $("search").oninput = (event) => { query = event.target.value; page = 1; render(); };
  $("page-size").onchange = (event) => { pageSize = Number(event.target.value); page = 1; render(); };
  $("sort-by").onchange = (event) => { sortBy = event.target.value; page = 1; render(); };
  $("sort-direction").onclick = () => { sortDirection = sortDirection === "asc" ? "desc" : "asc"; $("sort-direction").textContent = sortDirection === "asc" ? "升序" : "降序"; render(); };
  $("prev-page").onclick = () => { if (page > 1) { page--; render(); } };
  $("next-page").onclick = () => { page++; render(); };
  $("batch-download").onclick = batchDownload;
  $("batch-delete").onclick = batchDelete;
  $("preview-close").onclick = closePreview;
  $("preview-modal").onclick = (event) => { if (event.target === $("preview-modal")) closePreview(); };

  $("mkdir").onclick = () => { $("mkdir-form").style.display = "flex"; $("mkdir-name").focus(); };
  $("mkdir-cancel").onclick = () => { $("mkdir-form").style.display = "none"; $("mkdir-name").value = ""; $("mkdir-hint").textContent = "仅支持中文、英文、数字、- 和 _"; };
  $("mkdir-submit").onclick = async () => {
    const name = $("mkdir-name").value.trim();
    if (!name) return $("mkdir-name").focus();
    if (!directoryPattern.test(name)) { $("mkdir-hint").textContent = "目录名只能使用中文、英文、数字、- 和 _（1-64 个字符）"; return $("mkdir-name").focus(); }
    $("mkdir-submit").disabled = true;
    try {
      const response = await fetch("/api/mkdir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: fullName(name) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "创建目录失败");
      $("mkdir-cancel").click();
      load();
    } catch (error) { alert(error.message); } finally { $("mkdir-submit").disabled = false; }
  };
  $("mkdir-name").onkeydown = (event) => { if (event.key === "Enter") $("mkdir-submit").click(); if (event.key === "Escape") $("mkdir-cancel").click(); };
  $("file").onchange = (event) => upload(event.target.files);
  $("drop").onclick = () => $("file").click();
  $("drop").ondragover = (event) => event.preventDefault();
  $("drop").ondrop = (event) => { event.preventDefault(); upload(event.dataTransfer.files); };
  document.onkeydown = (event) => { if (event.key === "Escape") closePreview(); };
  load();
  setInterval(() => { if (!selected.size && !$("preview-modal").classList.contains("visible")) load(); }, 10000);
})();

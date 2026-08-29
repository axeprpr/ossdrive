    let cur = "";
    const directoryPattern = /^[\u4e00-\u9fffA-Za-z0-9_-]{1,64}$/;
    const downloadIcon =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 21h14" /></svg>';
    const deleteIcon =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" /></svg>';
    const $ = (x) => document.getElementById(x),
      esc = (x) =>
        x.replace(
          /[&<>"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[c],
        );
    function fmt(n) {
      let u = ["B", "KB", "MB", "GB", "TB"],
        i = 0;
      while (n >= 1024 && i < 4) (n /= 1024), i++;
      return n.toFixed(i ? 1 : 0) + " " + u[i];
    }
    async function load() {
      let r = await fetch("/api/list?prefix=" + encodeURIComponent(cur));
      let d = await r.json();
      if (!r.ok) return alert(d.error || "读取失败");
      $("crumb").textContent = cur ? "根目录 / " + cur : "根目录";
      $("back").hidden = !cur;
      $("usage").textContent = fmt(d.usage) + " / 500 GB";
      let h = d.folders
        .map(
          (f) =>
            '<div class="row" data-folder="' +
            encodeURIComponent(f) +
            '"><div class="name folder">📁 ' +
            esc(f) +
            "</div><div></div><div class=date></div><div></div></div>",
        )
        .join("");
      h += d.files
        .map(
          (x) =>
            '<div class="row" data-download="' +
            encodeURIComponent(x.name) +
            '"><div class=name>📄 ' +
            esc(x.name) +
            "</div><div class=muted>" +
            fmt(x.size) +
            '</div><div class="muted date">' +
            new Date(x.modified).toLocaleString() +
            '</div><div class=ops><button type=button class=action data-download="' +
            encodeURIComponent(x.name) +
            '"><span class="icon">' +
            downloadIcon +
            '</span>下载</button><button type=button class="action danger" data-delete="' +
            esc(x.name) +
            '"><span class="icon">' +
            deleteIcon +
            "</span>删除</button></div></div>",
        )
        .join("");
      $("items").innerHTML = h || "<div class=empty>暂无文件</div>";
    }
    function openFolder(x) {
      cur = cur ? cur + "/" + x : x;
      load();
    }
    function goBack() {
      let parts = cur.split("/");
      parts.pop();
      cur = parts.join("/");
      load();
    }
    function download(n) {
      location.href =
        "/api/download?name=" + encodeURIComponent(cur ? cur + "/" + n : n);
    }
    async function removeFile(n, button) {
      if (!window.confirm("确认删除？")) return;
      if (button) {
        button.disabled = true;
        button.textContent = "删除中...";
      }
      try {
        let r = await fetch("/api/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: cur ? cur + "/" + n : n }),
        });
        if (!r.ok) {
          let d = await r.json().catch(() => ({}));
          throw new Error(d.error || "删除失败");
        }
        await load();
      } catch (e) {
        if (button) {
          button.disabled = false;
          button.innerHTML = '<span class="icon">' + deleteIcon + "</span>删除";
        }
        alert(e.message);
      }
    }
    async function upload(fs) {
      for (const f of fs) {
        let n = cur ? cur + "/" + f.name : f.name;
        let r = await fetch("/api/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: n }),
        });
        if (!r.ok) {
          alert("上传频率受限");
          continue;
        }
        let d = await r.json(),
          x = new XMLHttpRequest(),
          started = performance.now();
        $("drop").style.setProperty("--progress", "0%");
        $("upload-status").textContent = "上传中 0%";
        x.open("PUT", d.url);
        x.setRequestHeader("Content-Type", "");
        x.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            let percent = Math.round((e.loaded / e.total) * 100);
            let elapsed = Math.max((performance.now() - started) / 1000, 0.001);
            let speed = fmt(e.loaded / elapsed) + "/s";
            $("drop").style.setProperty("--progress", percent + "%");
            $("upload-status").textContent =
              "上传中 " + percent + "% · " + speed;
          }
        };
        await new Promise((z) => {
          x.onload = z;
          x.onerror = z;
          x.send(f);
        });
        if (x.status < 200 || x.status >= 300) alert(f.name + " 上传失败");
      }
      $("drop").style.setProperty("--progress", "0%");
      $("drop-title").textContent = "点击或拖拽文件上传";
      $("upload-status").textContent = "";
      load();
    }
    $("back").onclick = goBack;
    $("items").onclick = (e) => {
      let button = e.target.closest("[data-delete]");
      if (button) {
        removeFile(button.dataset.delete, button);
        return;
      }
      let folder = e.target.closest("[data-folder]");
      if (folder) {
        openFolder(decodeURIComponent(folder.dataset.folder));
        return;
      }
      let file = e.target.closest("[data-download]");
      if (file) download(decodeURIComponent(file.dataset.download));
    };
    $("mkdir").onclick = () => {
      $("mkdir-form").style.display = "flex";
      $("mkdir-name").focus();
    };
    $("mkdir-cancel").onclick = () => {
      $("mkdir-form").style.display = "none";
      $("mkdir-name").value = "";
      $("mkdir-hint").textContent = "仅支持中文、英文、数字、- 和 _";
    };
    $("mkdir-submit").onclick = async () => {
      let n = $("mkdir-name").value.trim();
      if (!n) return $("mkdir-name").focus();
      if (!directoryPattern.test(n)) {
        $("mkdir-hint").textContent =
          "目录名只能使用中文、英文、数字、- 和 _（1-64 个字符）";
        $("mkdir-name").focus();
        return;
      }
      $("mkdir-submit").disabled = true;
      try {
        let r = await fetch("/api/mkdir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: cur ? cur + "/" + n : n }),
        });
        if (!r.ok) {
          let d = await r.json().catch(() => ({}));
          throw new Error(d.error || "创建目录失败");
        }
      } catch (e) {
        alert(e.message);
        $("mkdir-submit").disabled = false;
        return;
      }
      $("mkdir-form").style.display = "none";
      $("mkdir-name").value = "";
      $("mkdir-hint").textContent = "仅支持中文、英文、数字、- 和 _";
      $("mkdir-submit").disabled = false;
      load();
    };
    $("mkdir-name").onkeydown = (e) => {
      if (e.key === "Enter") $("mkdir-submit").click();
      if (e.key === "Escape") $("mkdir-cancel").click();
    };
    $("file").onchange = (e) => upload(e.target.files);
    $("drop").ondragover = (e) => e.preventDefault();
    $("drop").ondrop = (e) => {
      e.preventDefault();
      upload(e.dataTransfer.files);
    };
    load();
    setInterval(load, 10000);

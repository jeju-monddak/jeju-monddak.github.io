/* 몬딱 데모 페이지(바깥 틀): 이용자 화면과 직원 화면 두 창 사이에서 소식을 날라 준다.
   실제로는 분석실 PC와 직원 PC가 센터 내부망으로 이어져 있고, 여기서는 이 페이지가 그 자리를 대신한다. */
(function () {
  "use strict";
  const D = window.DEMO;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const fv = $("f-visitor"), fs = $("f-staff");
  const toVisitor = m => fv.contentWindow.postMessage(Object.assign({monddak: 1, from: "site"}, m), "*");
  const toStaff = m => fs.contentWindow.postMessage(Object.assign({monddak: 1, from: "site"}, m), "*");

  // ------------------------------------------------------------ 화면 틀: 칸 너비에 맞춰 줄여서 보여 줌
  const BASE_W = 1180, BASE_H = 760;
  function fit() {
    // 첫 화면에 데모 전체가 다 보이게: 칸 너비와 창 높이 둘 다에 맞춰 줄임(넓기만 하고 낮은 창에서 아래가 잘리지 않게)
    const cw = $("scaler").clientWidth;
    const above = 61 + document.querySelector(".shead").offsetHeight + 28;      // 위 머리줄 + 화면 위 단추 줄 + 위아래 여백
    const k = Math.min(1, cw / BASE_W, Math.max(420, innerHeight - above) / BASE_H);
    const w = cw / k;
    // 줄일 때는 transform(그림처럼 늘려서 흐려짐) 대신 zoom(그 크기로 다시 그려서 또렷함). zoom이 없는 브라우저만 transform
    const Z = CSS.supports("zoom", "1");
    for (const f of [fv, fs]) {
      f.style.width = w + "px"; f.style.height = BASE_H + "px";
      f.style.zoom = Z && k < 1 ? String(k) : "";
      f.style.transform = !Z && k < 1 ? `scale(${k})` : "";
    }
    $("scaler").style.height = Math.round(BASE_H * k) + "px";
  }
  window.addEventListener("resize", fit);
  fit();

  let unread = 0;
  function showTab(name) {
    fv.classList.toggle("hide", name !== "visitor");
    fs.classList.toggle("hide", name !== "staff");
    for (const b of document.querySelectorAll(".seg button")) b.classList.toggle("on", b.dataset.tab === name);
    if (name === "staff") { unread = 0; badge(); try { fs.contentWindow.focus(); } catch (e) { /* */ } }
    if (name === "visitor") { try { fv.contentWindow.focus(); } catch (e) { /* */ } toVisitor({t: "focus"}); }   // 키보드(엔터)도 이용자 화면으로
  }
  function badge() { $("badge").textContent = unread; $("badge").classList.toggle("hide", !unread); }
  document.querySelector(".seg").onclick = e => { const b = e.target.closest("button"); if (b) showTab(b.dataset.tab); };
  $("reset").onclick = () => { $("alert").classList.add("hide"); unread = 0; badge(); fv.src = fv.src; fs.src = fs.src; showTab("visitor"); };

  let toastTimer = null, toastGo = null;
  function toast(text, go) {
    const el = $("toast");
    el.textContent = text; toastGo = go || null;
    el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 4200);
  }
  $("toast").onclick = () => { $("toast").classList.remove("show"); if (toastGo) toastGo(); };

  // ------------------------------------------------------------ 직원 PC 알림 창
  let alertSession = "";
  function showAlert(item) {
    alertSession = item.session;
    $("al-seat").textContent = item.seat;
    $("al-want").textContent = (item.card && item.card.want) || item.title;
    $("al-why").textContent = (item.card && item.card.why) || "";
    const a = $("alert");
    a.classList.add("hide"); void a.offsetWidth; a.classList.remove("hide");
  }
  $("al-shut").onclick = () => $("alert").classList.add("hide");
  $("al-open").onclick = () => { $("alert").classList.add("hide"); toStaff({t: "open", session: alertSession}); showTab("staff"); };

  // ------------------------------------------------------------ 두 화면 사이 소식
  window.addEventListener("message", ev => {
    const m = ev.data;
    if (!m || !m.monddak || m.from === "site") return;
    if (m.from === "visitor") {
      if (m.t === "inquiry") { toStaff(m); unread += 1; badge(); showAlert(m.item); }
      if (m.t === "left") toStaff(m);
      if (m.t === "visit") { toStaff(m); toast("방문 내역이 직원 화면 보관함에 쌓였어요", () => showTab("staff")); }
      if (m.t === "show_staff") showTab("staff");
      if (m.t === "enter_staff") { if (!$("alert").classList.contains("hide")) $("al-open").click(); else showTab("staff"); }   // 직원 답을 기다릴 때 엔터: 알림 [열기]
    }
    if (m.from === "staff" && m.t === "enter" && fs.classList.contains("hide")) { showTab("visitor"); toVisitor({t: "enter"}); }
    if (m.from === "staff" && m.t === "push") { toVisitor(m); toast("이용자 화면에 전했어요", () => showTab("visitor")); showTab("visitor"); fv.classList.remove("fade-in"); void fv.offsetWidth; fv.classList.add("fade-in"); }
  });

  // 바깥에서 엔터를 눌러도 다음 걸음이 이어지게: 알림이 떠 있으면 [열기], 아니면 보이는 화면으로
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.isComposing) return;
    if (e.target.closest && e.target.closest("input,textarea,select,button,a,form")) return;
    e.preventDefault();
    if (!$("alert").classList.contains("hide")) { $("al-open").click(); return; }
    if (!fs.classList.contains("hide")) { try { fs.contentWindow.focus(); } catch (e2) { /* */ } toStaff({t: "enter"}); return; }
    try { fv.contentWindow.focus(); } catch (e2) { /* */ }
    toVisitor({t: "enter"});
  });

  // ------------------------------------------------------------ 직원 설정(몬딱 설정 바꾸기)
  const form = $("set-form");
  const clamp = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  form.onsubmit = e => {
    e.preventDefault();
    const f = new FormData(form);
    const set = {mascot: f.get("mascot") || "auto", idle_min: clamp(f.get("idle_min"), 1, 120, 5), idle_sec: clamp(f.get("idle_sec"), 10, 600, 60),
                 seat: String(f.get("seat") || "").trim() || "분석실 3번", ai: !!f.get("ai")};
    form.idle_min.value = set.idle_min; form.idle_sec.value = set.idle_sec; form.seat.value = set.seat;
    toVisitor({t: "settings", set});
    const sv = $("set-save");                 // 같은 자리에서 1초 동안 '저장 완료'로 바뀌었다가 돌아옴
    sv.textContent = "저장 완료"; sv.classList.add("done");
    clearTimeout(sv._t); sv._t = setTimeout(() => { sv.textContent = "저장하기"; sv.classList.remove("done"); }, 1000);
  };
  $("idle-now").onclick = () => {
    showTab("visitor");
    $("demo").scrollIntoView({behavior: "smooth", block: "start"});
    toVisitor({t: "idle_now"});
  };
})();

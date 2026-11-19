/* 몬딱 데모(이용자 화면): 글을 치는 대신, 다음에 할 말이 입력칸에 미리 적혀 있고 엔터(또는 보내기)만 누르면 이어진다.
   보기·이대로 볼게요·반출 신청·이용 종료 같은 단계는 실제 화면의 그 단추를 대신 눌러 줄 뿐이라, 화면에서 직접 눌러도 똑같이 진행된다. */
(function () {
  "use strict";
  const D = window.DEMO;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // 데모 안에서 입력칸에 초점이 가도 바깥 쪽(데모 페이지)이 따라 움직이지 않게
  const focus0 = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function () { focus0.call(this, {preventScroll: true}); };

  const say = $("say"), form = $("f-say");
  say.readOnly = true;

  // 입력칸 바로 위: 예시 세 가지(누르면 그 질문이 입력칸에 적힘)
  const picks = document.createElement("div");
  picks.id = "demo-picks"; picks.className = "demo-picks";
  form.parentNode.insertBefore(picks, form);
  const thumbOf = s => { for (const st of s.steps) { const m = st.add.find(x => x.chart); if (m) return "charts/" + st.charts[m.chart]; } return ""; };
  picks.innerHTML = D.scenarios.map(s => `<button type="button" class="demo-pick" data-pick="${esc(s.key)}">
    <span class="pt" style="background-image:url('${thumbOf(s)}')"></span><span class="pw"><b>${esc(s.title)}</b><small>${esc(s.field)} · ${esc(s.who)}</small></span></button>`).join("");
  let picked = "";
  picks.onclick = e => { const b = e.target.closest("[data-pick]"); if (!b) return; picked = b.dataset.pick; draw(); say.focus(); };

  let running = false, passing = false;
  function submitSay(text) {               // 적혀 있는 말을 그대로 보냄(화면 본래의 보내기)
    say.value = text;
    passing = true;
    try { form.requestSubmit(); } finally { passing = false; }
  }
  async function sendFile(name) {
    running = true; say.value = ""; draw();
    addFiles([new File(["데모용 가상 표"], name, {type: "text/csv"})]);
    await wait(700);
    passing = true;
    try { form.requestSubmit(); } finally { passing = false; }
    for (let k = 0; k < 30 && !busy; k++) await wait(100);   // 파일을 읽어 보내기 시작할 때까지 입력칸을 비워 둠
    running = false;
  }
  // 직원 도움 창: 이 예시의 까닭을 미리 골라 두고, 엔터로 '직원 부르기'
  const helpBox = () => [...document.querySelectorAll("#layer .veil")].find(v => v.querySelector('[data-k="go"]') && v.querySelector("textarea.note"));
  function openHelp(why) {
    say.value = "";
    $("b-help").click();
    const w = helpBox(); if (!w) return;
    const c = [...w.querySelectorAll("[data-r]")].find(x => x.dataset.r === why);
    if (c && !c.classList.contains("on")) c.click();
    const goBtn = w.querySelector('[data-k="go"]'); if (goBtn) goBtn.classList.add("demo-next");
  }
  const click = sel => { say.value = ""; const el = typeof sel === "string" ? document.querySelector(sel) : sel; if (el) el.click(); return !!el; };
  const choiceBy = label => [...document.querySelectorAll("#msgs .choice")].find(b => b.textContent.trim() === label);

  // 지금 걸음 → {입력칸에 적어 둘 말, 엔터를 누르면 할 일}
  function nextOf(st) {
    if (st.card) return {text: "직원이 왔어요", go: () => click('[data-k="arrived"]')};
    if (document.querySelector(".close-m")) return {text: "", go: () => click('.close-m [data-k="done"]'), mark: '.close-m [data-k="done"]'};
    if (!st.key) {                          // 처음: 왼쪽 예시 카드를 골랐으면 그 질문
      const k = picked || st.only, s = k && D.scenarios.find(x => x.key === k);
      return s ? {text: s.question, go: () => submitSay(s.question)} : null;
    }
    const e = st.expect;
    if (!e) return null;
    if (e.t === "help") return {text: `직원 도움 — ${e.why}`, go: () => openHelp(e.why)};
    if (e.t === "staff") return null;     // 직원 화면에서 답할 때까지 기다림
    if (e.t === "say") return {text: e.text, go: () => submitSay(e.text)};
    if (e.t === "file") return {text: `${e.name} 올리기`, go: () => sendFile(e.name)};
    if (e.t === "plan_ok") return {text: "이대로 볼게요", go: () => click('[data-pc="ok"]')};
    if (e.t === "choice" || e.t === "box_yes") return {text: e.label, go: () => click(choiceBy(e.label))};
    if (e.t === "basket") return {text: "", go: () => click("[data-bkgo]"), mark: "[data-bkgo]", hint: "오른쪽 반출 신청 단추를 눌러 주세요."};   // 채팅이 아니라 그 단추를 직접
    if (e.t === "close") return {text: "", go: () => click("#b-close"), mark: "#b-close", hint: "오른쪽 위 이용 종료 단추를 눌러 주세요."};
    return null;
  }
  const inApp = st => st.on && !$("s-app").classList.contains("hide");
  const quiet = () => busy || running;
  const now = () => { const st = window.DEMO_STATE(); return inApp(st) ? nextOf(st) : null; };
  // 직원 도움 창·신청함 창처럼 다른 창이 떠 있으면 엔터는 그 창의 것
  const blocking = () => [...document.querySelectorAll(".veil")].some(v => !v.classList.contains("callcard-wrap") && !v.querySelector(".close-m"));
  function go() {
    if (quiet() || blocking()) return false;
    const nx = now();
    if (!nx) return false;
    nx.go();
    return true;
  }

  // 입력칸 채우기·보내기 단추 반짝이기
  const HINT = "위 예시 가운데 하나를 골라 주세요.";
  function draw() {
    const st = window.DEMO_STATE();
    const nx = quiet() || !inApp(st) ? null : nextOf(st);
    const want = nx ? nx.text : "";
    if (quiet() || blocking() || helpBox()) { if (say.value) say.value = ""; }   // 몬딱이 답하는 동안·다른 창이 떠 있는 동안엔 비워 둠
    else if (!PEND.length && say.value !== want) say.value = want;
    $("b-send").classList.toggle("demo-next", !!want);
    const mk = nx && nx.mark ? document.querySelector(nx.mark) : null;
    for (const el of document.querySelectorAll(".demo-next")) if (el !== mk && el.id !== "b-send" && el.id !== "b-help" && !el.closest(".veil")) el.classList.remove("demo-next");
    if (mk && mk.closest(".veil")) for (const el of mk.closest(".veil").querySelectorAll(".demo-next")) if (el !== mk) el.classList.remove("demo-next");
    if (mk && !mk.classList.contains("demo-next")) mk.classList.add("demo-next");
    form.classList.toggle("demo-ready", !!want);
    const start = inApp(st) && !st.key && !st.card;
    if (!start) picked = "";
    picks.classList.toggle("hide", !start);
    for (const b of picks.querySelectorAll("[data-pick]")) b.classList.toggle("on", b.dataset.pick === (picked || st.only));
    const waiting = st.expect && st.expect.t === "staff";
    $("b-help").classList.toggle("demo-next", !!(st.expect && st.expect.t === "help") && !helpBox());
    const hb = helpBox();                   // 직원 도움을 마우스로 열었어도 이 예시의 까닭을 미리 골라 두고 [직원 부르기]를 반짝임
    if (hb && st.expect && st.expect.t === "help" && !hb.dataset.demoPre) {
      hb.dataset.demoPre = "1";
      const c = [...hb.querySelectorAll("[data-r]")].find(x => x.dataset.r === st.expect.why);
      if (c && !c.classList.contains("on")) c.click();
      const g = hb.querySelector('[data-k="go"]'); if (g) g.classList.add("demo-next");
    }
    const ph = start && !want ? HINT : waiting ? "직원 화면에서 답해 주세요." : nx && nx.hint ? nx.hint : "";
    if (say.placeholder !== ph && !PEND.length) say.placeholder = ph;
    if (want && document.hasFocus() && document.activeElement === document.body) say.focus();
  }
  new MutationObserver(() => { if (!PEND.length) draw(); }).observe(say, {attributes: true, attributeFilter: ["placeholder"]});

  // 엔터: 지금 화면에서 다음에 누를 것을 누름(입력칸에 적힌 다음 걸음, 첫 화면·동의 화면·끝 화면 단추, 직원 도움 창)
  const toSite = m => { try { parent.postMessage(Object.assign({monddak: 1, from: "visitor"}, m), "*"); } catch (e) { /* 혼자 열었을 때 */ } };
  const shown = id => { const el = $(id); return !!el && !el.classList.contains("hide"); };
  function enter() {
    const hb = helpBox(), st = window.DEMO_STATE();
    if (hb) { if (st.expect && st.expect.t === "help") { hb.querySelector('[data-k="go"]').click(); return true; } return false; }
    const box = document.querySelector("#layer .demo-box");                    // 신청함 보기 창: 엔터로 닫기
    if (box) { box.closest(".veil").remove(); return true; }
    if (shown("s-start")) { $("b-go").click(); return true; }
    if (shown("s-who")) {                                                       // 아무것도 안 골랐으면 '동의 없이 시작'으로
      if ($("b-start").disabled && typeof startLabel === "function") startLabel();
      if (!$("b-start").disabled) { $("b-start").click(); return true; }
      return false;
    }
    if (shown("s-bye")) { $("b-again").click(); return true; }
    if (blocking()) return false;
    if (inApp(st) && st.expect && st.expect.t === "staff") { toSite({t: "enter_staff"}); return true; }   // 직원 답을 기다리는 중: 직원 쪽으로
    return go();
  }
  window.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.isComposing || e.shiftKey) return;
    const a = document.activeElement;
    const typing = a && a !== say && (a.tagName === "TEXTAREA" || a.tagName === "SELECT" || (a.tagName === "INPUT" && !/^(checkbox|radio|file)$/.test(a.type)));
    if (typing && !(helpBox() && a.closest(".veil") === helpBox())) return;    // 직원 도움 창의 메모칸에서도 엔터는 '직원 부르기'
    if (quiet()) { e.preventDefault(); e.stopPropagation(); return; }           // 몬딱이 답하는 중: 기다림
    if (enter()) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  // 보내기 단추도 같은 일(화면 본래의 보내기로는 녹화에 없는 말이 가므로 가로챔)
  document.addEventListener("submit", e => {
    if (passing || e.target !== form || !now()) return;
    e.preventDefault(); e.stopImmediatePropagation();
    setTimeout(go, 0);                     // 보내기 도중에 다시 보내기를 부르면 브라우저가 무시하므로 한 박자 뒤에
  }, true);
  // 바깥(데모 페이지)에서 엔터를 눌렀을 때
  window.addEventListener("message", ev => {
    const m = ev.data;
    if (m && m.monddak && m.from === "site" && m.t === "enter") { say.focus(); if (!quiet()) enter(); }
    if (m && m.monddak && m.from === "site" && m.t === "focus") say.focus();
    if (m && m.monddak && m.from === "site" && m.t === "scenario") picked = m.key || "";
    if (m && m.monddak && m.from === "site" && m.t === "scenario") setTimeout(() => { say.focus(); draw(); }, 400);
  });

  // 화면이 바뀔 때마다 다시 채움
  let soon = null;
  const later = () => { if (!soon) soon = setTimeout(() => { soon = null; draw(); }, 60); };
  for (const id of ["msgs", "layer", "panel", "s-app", "s-start", "s-who", "s-bye"])
    new MutationObserver(later).observe($(id), {childList: true, subtree: id !== "s-app", attributes: true, attributeFilter: ["class", "disabled"]});
  setInterval(draw, 500);

  // 몬딱 로고: 처음 화면으로
  async function goHome() {
    try { if (window.DEMO_STATE().on) await api("/api/close"); } catch (e) { /* */ }
    clearInterval(pollTimer); pollTimer = null; clearInterval(byeTimer);
    $("layer").innerHTML = ""; PEND = []; drawTray(); say.value = ""; picked = "";
    $("b-again").click();
  }
  for (const el of document.querySelectorAll("#s-app .logo, #s-who .logo")) { el.style.cursor = "pointer"; el.title = "처음 화면으로"; el.addEventListener("click", goHome); }

  // 신청함 폴더 열기: 데모에서는 폴더 대신 담긴 파일을 보여 줌
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-box]");
    if (!b) return;
    e.stopPropagation(); e.preventDefault();
    const st = window.DEMO_STATE(), sc = st.scenario;
    const files = (V && V.box_done) || (sc ? sc.box_files : []);
    const pic = V && V.basket && V.basket[0] ? chartUrl(V.basket[0].rid) : "";
    const w = document.createElement("div"); w.className = "veil";
    w.innerHTML = `<div class="modal demo-box"><div class="mh">${ICON("i-folder")} 반출 신청함</div><div class="mb">
      ${files.map(f => `<div class="pfile">${ICON("i-file")}<div><b>${esc(f)}</b></div></div>`).join("")}
      ${pic ? `<img src="${pic}" alt="반출 신청할 그림">` : ""}</div>
      <div class="mf"><button class="btn">닫기</button></div></div>`;
    w.onclick = ev => { if (ev.target === w || ev.target.closest(".btn")) w.remove(); };
    $("layer").appendChild(w);
  }, true);

  draw();
})();

/* 몬딱 데모(직원 화면): 직원 PC의 보관함(app/staff/store.py)이 하는 일을 이 브라우저 안에서 흉내 낸다.
   화면 파일(staff.html)은 프로그램의 app/staff/ui.html 그대로이고, api()만 이 파일의 DEMO_STAFF_API로 바뀌어 있다.
   여기 미리 넣어 둔 문의·방문 내역은 모두 데모용 가상 기록이다. */
(function () {
  "use strict";
  const two = n => String(n).padStart(2, "0");
  const fmt = t => `${t.getFullYear()}-${two(t.getMonth() + 1)}-${two(t.getDate())} ${two(t.getHours())}:${two(t.getMinutes())}`;
  const ago = (days, h, m) => { const t = new Date(); t.setDate(t.getDate() - days); t.setHours(h, m, 0, 0); return fmt(t); };
  const now = () => fmt(new Date());
  const hub = msg => { try { parent.postMessage(Object.assign({monddak: 1, from: "staff"}, msg), "*"); } catch (e) { /* */ } };
  const CLEAR_DAYS = 30;
  const HANDLED = ["coming", "replied", "done", "left"];
  const KO = {coming: "자리로 간다고 알림", reply: "직접 답변", done: "처리 완료", left: "이용자가 상담을 끝냄"};

  const memoOf = (seat, when, want, facts) => `[문의 정리문] ${want}\n자리: ${seat} · 작성 ${when} · 방문 표식 demo0000 · 사유: 이용자가 직원 도움을 요청했어요\n\n` +
    `■ 이용자가 원하는 것\n${want}\n\n■ 직원에게 부탁드릴 일\n- 이용자와 직접 이야기해 주세요.\n\n■ 확인 정보 (몬딱이 적음)\n${facts.map(f => "- " + f).join("\n")}\n`;
  function seedItem(n, seat, days, h, m, want, why, kind, text, facts) {
    const time = ago(days, h, m), at = ago(days, h, m + 6);
    return {session: ("demo" + n).padEnd(32, "0"), seat, title: want, memo: memoOf(seat, time, want, facts), card: {want, why}, time,
            status: kind === "reply" ? "replied" : "coming", read: true, updated: at, outbox: [],
            history: [Object.assign({kind, time: at}, text ? {text} : {})]};
  }
  const items = [
    seedItem(1, "분석실 2번", 1, 15, 20, "서귀포 감귤 생산량이 해마다 어땠는지 알고 싶어 해요.", "찾는 자료가 없어요", "reply",
             "센터 표에는 없지만 제주데이터허브에 감귤 생산 자료가 있어요. 몬딱에게 '허브 감귤 자료 보여 줘'라고 말해 보세요.",
             ["이용자 질문(개인정보 가림): 서귀포 감귤 생산량이 궁금해요", "몬딱이 고른 센터 표: 없음"]),
    seedItem(2, "분석실 1번", 41, 11, 5, "만든 그림을 가져가도 되는지 알고 싶어 해요.", "반출 신청이 궁금해요", "coming", "",
             ["이용자 질문(개인정보 가림): 이 그림 밖으로 가져가도 돼요?"]),
  ];
  const archive = [{name: `${ago(63, 14, 30).slice(0, 10)} 14시30분.txt`,
                    text: `${ago(63, 14, 30)}  분석실 3번\n찾으시는 것: 노형동 음식점 매출 파일을 받는 방법을 알고 싶어 해요.\n도움이 필요한 이유: 파일 받는 방법을 모르겠어요\n\n처리 내용\n${ago(63, 14, 37)}  자리로 간다고 알림\n`}];
  const visits = {};                       // 달(YYYY-MM) → 방문 줄
  function addVisit(r) { (visits[r.date.slice(0, 7)] = visits[r.date.slice(0, 7)] || []).push(r); }
  (function seedVisits() {
    const P = ["상권 분석", "관광 동향", "인구·유동", "교통", "정책·보고서", "기타"], A = ["20대", "30대", "40대", "50대", "60대 이상"], X = ["남성", "여성", "선택 안 함"];
    let k = 7;
    const rnd = n => (k = (k * 1103515245 + 12345) % 2147483648) % n;
    for (const days of [1, 2, 2, 4, 5, 7, 8, 33, 34, 36, 37, 37, 40, 43, 45, 48]) {
      const t = new Date(); t.setDate(t.getDate() - days);
      addVisit({date: fmt(t).slice(0, 10), sex: X[rnd(5) % 3], age: A[rnd(5)], purpose: P[rnd(9) % 6]});
    }
  })();

  const headline = i => ({want: (i.card && i.card.want) || i.title, why: (i.card && i.card.why) || ""});
  const find = s => items.find(i => i.session === s);
  const oldDone = () => { const t = new Date(); t.setDate(t.getDate() - CLEAR_DAYS); const cut = fmt(t);
                          return items.filter(i => HANDLED.includes(i.status) && (i.updated || i.time) < cut); };
  function archiveText(i) {
    const h = headline(i);
    const lines = [`${i.time}  ${i.seat}`, `찾으시는 것: ${h.want}`];
    if (h.why) lines.push(`도움이 필요한 이유: ${h.why}`);
    lines.push("", "처리 내용");
    for (const x of i.history || []) lines.push(`${x.time}  ${KO[x.kind] || x.kind}${x.text ? ": " + String(x.text).replace(/\s+/g, " ") : ""}${x.file_name ? ` (보낸 파일: ${x.file_name})` : ""}`);
    return lines.join("\n") + "\n";
  }
  function archiveName(i) {
    const base = `${i.time.slice(0, 10)} ${i.time.slice(11, 13)}시${i.time.slice(14, 16)}분`;
    let name = base + ".txt", n = 2;
    while (archive.some(a => a.name === name)) name = `${base} (${n++}).txt`;
    return name;
  }
  const monthsOf = () => Object.keys(visits).filter(m => visits[m].length).sort().reverse().map(m => ({month: m, count: visits[m].length}));
  const visitText = m => { const [y, mm] = m.split("-");
    return [`${y}년 ${Number(mm)}월 방문 내역`, "날짜 · 성별 · 연령대 · 방문 목적", ""].concat(visits[m].map(r => [r.date, r.sex, r.age, r.purpose].join(" · "))).join("\n") + "\n"; };

  // ---------------------------------------------------------------- 화면이 부르는 것
  window.DEMO_STAFF_API = function (path, body) {
    const ok = v => Promise.resolve(v), no = () => Promise.reject(new Error("demo"));
    const [p, query] = path.split("?");
    if (p === "/api/items") {
      const list = items.slice().sort((a, b) => String(b.time).localeCompare(String(a.time)))
        .map(i => Object.assign({}, i, headline(i), {outbox: undefined}));
      return ok({items: list, alive: true, old_done: oldDone().length, clear_days: CLEAR_DAYS});
    }
    if (p === "/api/read") { const i = find(body.session); if (i) i.read = true; return i ? ok({ok: true}) : no(); }
    if (p === "/api/push") {
      const i = find(body.session);
      if (!i || (i.status === "left" && body.kind !== "done")) return no();
      const h = {kind: body.kind, text: String(body.text || "").slice(0, 2000), time: now()};
      if (body.file_name) h.file_name = body.file_name;
      i.history.push(h);
      i.status = {coming: "coming", reply: "replied", done: "done"}[body.kind];
      i.updated = now();
      hub({t: "push", session: i.session, kind: body.kind, text: h.text, file_name: body.file_name || "", want: headline(i).want, why: headline(i).why});
      return ok({ok: true});
    }
    if (p === "/api/clear") {
      let targets = body.scope === "pick" ? items.filter(i => HANDLED.includes(i.status) && (body.sessions || []).includes(i.session))
                  : body.scope === "all" ? items.filter(i => HANDLED.includes(i.status)) : oldDone();
      targets = targets.slice().sort((a, b) => String(a.time).localeCompare(String(b.time)));
      const files = [];
      if (body.action === "move") for (const i of targets) { const name = archiveName(i); archive.push({name, text: archiveText(i)}); files.push(name); }
      for (const i of targets) items.splice(items.indexOf(i), 1);
      return ok({ok: true, count: targets.length, file: files[0] || ""});
    }
    if (p === "/api/history") {
      const months = monthsOf();
      let ym = new URLSearchParams(query || "").get("month") || "";
      if (!months.some(m => m.month === ym)) ym = months.length ? months[0].month : "";
      const rows = ym ? visits[ym].slice().sort((a, b) => b.date.localeCompare(a.date)).map(r => [r.date, r.sex, r.age, r.purpose]) : [];
      return ok({months, total: months.reduce((a, m) => a + m.count, 0), month: ym, rows});
    }
    if (p === "/api/open_archive") { openFolder(body && body.which === "visit" ? "visit" : "inquiry"); return ok({ok: true}); }
    return ok({ok: true});
  };

  // ---------------------------------------------------------------- 보관 폴더(데모): 탐색기 대신 이 창에서 파일을 보여 줌
  const esc0 = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  function openFolder(which) {
    const old = document.querySelector(".demo-folder"); if (old) old.remove();
    const v = document.createElement("div"); v.className = "veil demo-folder";
    let open = "";
    const files = () => which === "visit" ? monthsOf().map(m => ({name: m.month + ".txt", text: visitText(m.month), month: m.month}))
                                          : archive.slice().sort((a, b) => b.name.localeCompare(a.name));
    const draw = () => {
      const list = files(), cur = list.find(f => f.name === open);
      v.innerHTML = `<div class="modal folder"><div class="mh">보관 › ${which === "visit" ? "방문 내역" : "처리 내용"}</div>
        <div class="fbody"><div class="flist">${list.length ? list.map(f => `<div class="frow ${f.name === open ? "on" : ""}" data-f="${esc0(f.name)}"><span>${esc0(f.name)}</span>
          <button class="fdel" data-del="${esc0(f.name)}" title="이 파일 지우기">지우기</button></div>`).join("") : `<p class="none">이 폴더는 비어 있어요.</p>`}</div>
          <pre class="ftext">${cur ? esc0(cur.text) : "파일을 누르면 내용을 볼 수 있어요.\n\n여기서 파일을 지우면 직원 화면에서도 바로 사라져요."}</pre></div>
        <div class="mf"><button class="btn" data-x>닫기</button></div></div>`;
    };
    v.onclick = e => {
      const del = e.target.closest("[data-del]");
      if (del) {
        const name = del.dataset.del;
        if (which === "visit") delete visits[name.replace(/\.txt$/, "")]; else { const k = archive.findIndex(a => a.name === name); if (k >= 0) archive.splice(k, 1); }
        if (open === name) open = "";
        draw(); if (window.refresh) window.refresh();
        return;
      }
      const f = e.target.closest("[data-f]");
      if (f) { open = f.dataset.f; return draw(); }
      if (e.target === v || e.target.closest("[data-x]")) v.remove();
    };
    draw();
    document.body.appendChild(v);
  }

  // ---------------------------------------------------------------- 분석실 PC(이용자 화면)에서 오는 것
  window.addEventListener("message", ev => {
    const m = ev.data;
    if (!m || !m.monddak || m.from === "staff") return;
    if (m.t === "inquiry") {
      const old = find(m.item.session);
      const item = Object.assign(old || {outbox: [], history: []}, m.item, {status: "new", read: false, updated: now()});
      if (!old) items.push(item);
    }
    if (m.t === "left") {
      const i = find(m.session);
      if (i) { i.left_time = now(); i.history.push({kind: "left", time: now()}); if (i.status !== "done") { i.status = "left"; i.read = false; } i.updated = now(); }
    }
    if (m.t === "visit") addVisit(m.row);
    if (m.t === "open") {                  // 알림 창 [열기]: 그 문의를 바로 엶
      try { if (find(m.session)) { tab = HANDLED.includes(find(m.session).status) ? "done" : "inbox"; sel = m.session; replyOpen = false; } } catch (e) { /* 화면 준비 전 */ }
    }
    if (window.refresh) window.refresh();
  });
  new MutationObserver(() => {
    const t = document.getElementById("txt");
    if (!t || t.value || t.dataset.demo === sel) return;
    const i = find(sel);
    if (i && i.demo_reply) { t.value = i.demo_reply; t.dataset.demo = sel; }
  }).observe(document.body, {childList: true, subtree: true});
  // 엔터: 열린 문의에서 [자리로 가기], 답변 칸이 열려 있으면 [보내기](줄바꿈은 Shift+엔터). 직원 화면이 숨어 있으면 바깥으로
  const hiddenNow = () => { try { return !!(window.frameElement && window.frameElement.classList.contains("hide")); } catch (e) { return false; } };
  function staffEnter() {
    const q = id => document.getElementById(id);
    if (hiddenNow()) { hub({t: "enter"}); return true; }
    const box = q("replyBox");
    if (box && box.classList.contains("open")) { if (q("send")) { q("send").click(); return true; } return false; }
    const g = q("go");
    if (g && !g.disabled) { g.click(); return true; }
    return false;
  }
  window.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.isComposing || e.shiftKey) return;
    const a = document.activeElement;
    if (a && /^(rep|send|cancel|go)$/.test(a.id)) return;                       // 그 단추에 초점: 브라우저가 그 단추를 누름
    if (a && a.id !== "txt" && (a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.tagName === "INPUT")) return;
    if (staffEnter()) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  window.addEventListener("message", ev => { const m = ev.data; if (m && m.monddak && m.from === "site" && m.t === "enter") staffEnter(); });
  hub({t: "staff_ready"});
})();

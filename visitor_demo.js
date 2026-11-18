/* 몬딱 데모(이용자 화면): 서버 대신, 실제 프로그램에서 녹화해 둔 응답(data.js)을 돌려준다.
   화면 파일(visitor.html)은 프로그램의 app/visitor/ui.html 그대로이고, api()만 이 파일의 DEMO_API로 바뀌어 있다. */
(function () {
  "use strict";
  const D = window.DEMO;
  const SC = Object.fromEntries(D.scenarios.map(s => [s.key, s]));
  // 직원 설정(데모 아래 '몬딱 설정 바꾸기'에서 바꿈)
  const SET = {mascot: "auto", summer: [4, 5, 6, 7, 8, 9], idle_min: 5, idle_sec: 60, seat: D.seat, ai: true};
  const CHART = {};            // 그림 표식 → 파일 이름
  let S = null;                // 지금 방문
  let ONLY = "";               // 위쪽 예시 카드에서 고른 예시(없으면 세 가지 모두 보여 줌)

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => String(s || "").replace(/\s+/g, " ").trim();
  const hex = n => Array.from({length: n}, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
  const two = n => String(n).padStart(2, "0");
  const clock = () => { const t = new Date(), h = t.getHours(); return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${two(t.getMinutes())}`; };
  const stamp = () => { const t = new Date(); return `${t.getFullYear()}-${two(t.getMonth() + 1)}-${two(t.getDate())} ${two(t.getHours())}:${two(t.getMinutes())}`; };
  const hub = msg => { try { parent.postMessage(Object.assign({monddak: 1, from: "visitor"}, msg), "*"); } catch (e) { /* 혼자 열었을 때 */ } };
  const push = m => S.talk.push(Object.assign({}, m, {time: clock()}));

  function config() {
    const c = JSON.parse(JSON.stringify(D.cfg));
    const month = new Date().getMonth() + 1;
    const mode = SET.mascot === "auto" ? (SET.summer.includes(month) ? "summer" : "winter") : SET.mascot;
    c.mascot = `assets/mascot-${mode}.png`;
    c.screen = {idle_after: Math.round(SET.idle_min * 60), idle_grace: SET.idle_sec, magnifier: false};
    return c;
  }

  function newVisit(profile) {
    S = {session: hex(32), profile: {sex: profile.sex || "선택 안 함", age: profile.age || "선택 안 함"}, key: "", i: 0, talk: [],
         staffOpen: false, card: null, asked: false, helpWait: false, helpDone: false};
    for (const m of D.scenarios[0].start.add) push(m);
    tell();
  }

  function leave() {                       // 이용 종료·새 상담·자리 비움: 직원 화면에 '상담 끝남', 보관함에 방문 한 줄
    if (!S) return;
    const t = new Date();
    if (S.staffOpen) hub({t: "left", session: S.session});
    hub({t: "visit", row: {date: `${t.getFullYear()}-${two(t.getMonth() + 1)}-${two(t.getDate())}`, sex: S.profile.sex, age: S.profile.age,
                           purpose: S.key ? SC[S.key].purpose : "기타"}});
  }

  function stepNow() { return S.key ? (S.i ? SC[S.key].steps[S.i - 1] : SC[S.key].start) : D.scenarios[0].start; }
  // 예시마다 직원 도움 없이는 넘어갈 수 없는 곳(build.py SCENARIOS의 help): 누르고, 직원이 답해야 이어짐
  function helpNow() { const sc = S && S.key && SC[S.key]; return !!(sc && sc.help && S.i === sc.help.at && !S.helpDone); }
  function expect() {
    if (!S || !S.key) return null;
    if (helpNow()) return {t: S.helpWait ? "staff" : "help", why: SC[S.key].help.why};
    const st = SC[S.key].steps; return S.i < st.length ? st[S.i].do : {t: "close"};
  }

  function view() {
    const v = JSON.parse(JSON.stringify(stepNow().view));
    v.talk = S.talk;
    v.demo = true;
    v.offline = SET.ai ? "" : D.offline_banner;
    v.seat = SET.seat;
    v.staff_open = false;                  // 직원 소식은 오는 대로 바로 그림(5초마다 묻지 않음)
    if (!S.key) v.ask = null;              // 처음: 예시는 입력칸 위 세 단추로 고름
    if (S.card) v.ask = S.card;            // 직원이 자리로 오는 중: 호출 카드
    return v;
  }

  function matches(path, body, e) {
    const val = body.value;
    if (e.t === "say") return (path === "/api/say" && norm(body.text) === norm(e.text)) || (path === "/api/resume" && val === e.text);
    if (e.t === "file") return path === "/api/send" && (body.files || []).length > 0;
    if (e.t === "plan_ok") return path === "/api/resume" && !!val && val.ok === true;
    if (e.t === "choice") return path === "/api/resume" && val === e.label;
    if (e.t === "basket") return path === "/api/basket" && (body.rids || []).length > 0;
    if (e.t === "box_yes") return path === "/api/basket_ok" && body.ok === true;
    return false;
  }
  const PAUSE = {say: 1200, file: 1000, plan_ok: 1700, choice: 1300, basket: 700, box_yes: 1000};

  function advance() {
    const st = SC[S.key].steps[S.i];
    S.i += 1;
    Object.assign(CHART, st.charts);
    for (const m of st.add) push(m.chart ? Object.assign({}, m, {chart: st.charts[m.chart] || m.chart}) : m);   // 그때 그림 그대로 남게
    tell();
  }

  function handoff(note) {
    const sc = S.key ? SC[S.key] : D.scenarios[0];
    const h = sc.handoff[S.key ? Math.min(S.i, sc.handoff.length - 1) : 0];
    note = norm(note);
    push({who: "이용자", text: D.cfg.labels.handoff + (note ? `: ${note}` : "")});
    for (const m of h.add) push(m);
    S.staffOpen = true;
    if (helpNow()) S.helpWait = true;
    const q = h.inquiry, now = stamp();
    let memo = q.memo.replace(/자리: [^·\n]+·/, `자리: ${SET.seat} ·`).replace(/작성 [0-9-]+ [0-9:]+/, `작성 ${now}`)
                     .replace(/방문 표식 [0-9a-f]+/, `방문 표식 ${S.session.slice(0, 8)}`);
    memo = note ? memo.split(D.help_note).join(note) : memo.split("\n").filter(l => !l.includes("이용자가 적은 도움 내용")).join("\n");
    const want = S.key ? q.card.want : "";
    hub({t: "inquiry", item: {session: S.session, seat: SET.seat, title: q.title, memo, time: now,
                              card: {want: want || "직접 여쭤봐 주세요", why: note || "직원 도움을 요청하셨어요"}, demo_reply: sc.staff_reply}});
    tell();
  }

  function tell() {                        // 바깥(데모 쪽)과 아래 단추 줄에 지금 상태 알리기
    const e = expect();
    hub({t: "state", on: !!S, key: S ? S.key : "", step: S ? S.i : 0, total: S && S.key ? SC[S.key].steps.length + 1 : 0,
         waiting: !!(S && S.staffOpen), expect: e ? e.t : ""});
  }

  window.DEMO_CHART = rid => "charts/" + (String(rid).endsWith(".png") ? rid : (CHART[rid] || rid + ".png"));
  window.DEMO_STATE = () => ({on: !!S, key: S ? S.key : "", i: S ? S.i : 0, expect: expect(), card: S ? S.card : null,
                              waiting: !!(S && S.staffOpen), only: ONLY, total: S && S.key ? SC[S.key].steps.length + 1 : 0,
                              scenario: S && S.key ? SC[S.key] : null});
  window.DEMO_SET = SET;

  window.DEMO_API = async function (path, body) {
    body = body || {};
    if (path === "/api/config") return config();
    if (path === "/api/ime") return {ok: true};
    if (path === "/api/start") { newVisit(body); return view(); }
    if (!S) throw new Error("상담이 끝났어요. 처음 화면에서 다시 시작해 주세요.");
    if (path === "/api/view" || path === "/api/poll") return view();
    if (path === "/api/open_box") return Object.assign(view(), {opened: true});
    if (path === "/api/new") { const p = S.profile; leave(); newVisit(p); return view(); }
    if (path === "/api/close") { leave(); S = null; tell(); return {closed: true, ok: true}; }
    if (path === "/api/handoff") { await wait(900); handoff(body.note); return view(); }
    if (path === "/api/resume" && S.card) { S.card = null; tell(); return view(); }      // '직원이 왔어요'
    if (!S.key) {                          // 처음: 예시 질문 고르기
      const said = path === "/api/resume" ? body.value : (path === "/api/say" ? body.text : "");
      const pick = D.scenarios.find(s => norm(s.question) === norm(said));
      if (!pick) throw new Error("예시 질문 가운데 하나를 골라 주세요.");
      S.key = pick.key; S.i = 0;
    } else {
      const e = expect();
      if (e && e.t === "help") throw new Error("직원 도움을 눌러 주세요.");
      if (e && e.t === "staff") throw new Error("직원이 답할 때까지 잠시만 기다려 주세요.");
      if (!e || !matches(path, body, e)) throw new Error("엔터를 눌러 주세요.");
    }
    await wait(PAUSE[SC[S.key].steps[S.i].do.t] || 1000);
    advance();
    return view();
  };

  // 바깥에서 오는 것: 직원이 한 일(자리로 가기·직접 답변), 설정 저장, 예시 고르기
  function redraw(tries) {
    try {
      if (!S || !V) return;                                 // V·busy·render: 화면 파일의 것
      if (busy) { if ((tries || 0) < 20) setTimeout(() => redraw((tries || 0) + 1), 300); return; }   // 몬딱이 답하는 중이면 끝난 뒤에
      V = view(); render();
    } catch (e) { /* 아직 화면 준비 전 */ }
  }
  window.addEventListener("message", ev => {
    const m = ev.data;
    if (!m || !m.monddak || m.from === "visitor") return;
    if (m.t === "push" && S && m.session === S.session) {
      const sc = S.key ? SC[S.key] : D.scenarios[0];
      if (S.helpWait && (m.kind === "coming" || m.kind === "reply")) { S.helpWait = false; S.helpDone = true; }
      if (m.kind === "coming") {
        for (const x of sc.coming.add) push(x);
        const a = JSON.parse(JSON.stringify(sc.coming.ask));
        a.seat = SET.seat; a.card = Object.assign({}, a.card || {}, {seat: SET.seat, want: m.want || (a.card || {}).want, why: m.why || (a.card || {}).why,
                                                                    time: `${two(new Date().getHours())}:${two(new Date().getMinutes())}`});
        S.card = a;
      } else if (m.kind === "reply") {
        if (m.text) push({who: "운영자", name: D.staff_name, text: m.text});
        push({who: "창구", name: "몬딱", text: "더 궁금한 게 있으세요?"});
      }
      tell(); redraw();
    }
    if (m.t === "settings") {
      Object.assign(SET, m.set);
      try { CFG = config(); applyConfig(); } catch (e) { /* 화면 준비 전 */ }
      redraw();
    }
    if (m.t === "idle_now") { try { idleAt = Date.now() - 100 * 3600 * 1000; } catch (e) { /* */ } }
    if (m.t === "scenario") {
      ONLY = m.key || "";
      (async () => {
        try {
          if (S) leave();
          V = await api("/api/start", {sex: "", age: "", consent: true});
          bkSel = {}; PEND = []; drawTray(); $("layer").innerHTML = ""; clearInterval(byeTimer);
          show("s-app"); render();
        } catch (e) { /* */ }
      })();
    }
  });
})();

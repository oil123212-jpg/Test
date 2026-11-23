const el = id => document.getElementById(id);
const statusLine = el("status");
const audio = document.querySelector("audio");
let active;

async function post(path, data, signal) {
  const res = await fetch(path, {method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify(data), signal});
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "서버 요청 실패");
  return result;
}
function finish(message) {
  const s = active;
  active = null;
  if (s) {
    s.abort.abort();
    s.stream?.getTracks().forEach(track => track.stop());
    s.pc.close();
  }
  audio.srcObject = null;
  el("mode").disabled = false;
  el("start").disabled = false;
  el("stop").disabled = true;
  statusLine.textContent = message;
}
async function onEvent(s, event) {
  if (active !== s) return;
  if (event.type === "error") {
    statusLine.textContent = event.error?.message || "음성 응답 오류";
    return;
  }
  if (event.type === "input_audio_buffer.speech_started") {
    s.turn++;
    statusLine.textContent = "듣고 있어요";
  }
  if (event.type === "response.created") s.turns.set(event.response.id, s.turn);
  if (event.type !== "response.done") return;
  const response = event.response;
  const turn = s.turns.get(response.id);
  s.turns.delete(response.id);
  if (response.status !== "completed") {
    if (response.status === "failed") statusLine.textContent = response.status_details?.error?.message || "응답 실패";
    return;
  }
  const calls = response.output.filter(item => item.type === "function_call");
  if (!calls.length) return;
  for (const call of calls) {
    let result;
    try {
      if (call.name !== "lookup_examples") throw new Error();
      const args = JSON.parse(call.arguments);
      result = await post("/examples", args, s.abort.signal);
      if (active !== s) return;
      el("lookup").textContent = "최근 예시 조회 · " + args.activity + " · " + args.intent + " · " + result.examples.length + "건";
    } catch {
      result = {examples:[], note:"조회 실패. 현재 대화만 사용하세요."};
    }
    if (active !== s || s.dc.readyState !== "open") return;
    s.dc.send(JSON.stringify({type:"conversation.item.create",item:{type:"function_call_output",
      call_id:call.call_id,output:JSON.stringify(result)}}));
  }
  if (turn === s.turn) s.dc.send(JSON.stringify({type:"response.create"}));
}
async function start() {
  const s = {pc:new RTCPeerConnection(), abort:new AbortController(), turn:0, turns:new Map()};
  active = s;
  el("start").disabled = el("mode").disabled = true;
  el("stop").disabled = false;
  el("lookup").textContent = "";
  statusLine.textContent = "마이크 연결 중";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    if (active !== s) { stream.getTracks().forEach(t => t.stop()); return; }
    s.stream = stream;
    s.pc.addTrack(stream.getAudioTracks()[0], stream);
    s.pc.ontrack = e => { if (active === s) audio.srcObject = e.streams[0]; };
    s.pc.onconnectionstatechange = () => {
      if (active === s && s.pc.connectionState === "failed") finish("연결이 끊겼어요. 다시 시작해 주세요.");
    };
    s.dc = s.pc.createDataChannel("oai-events");
    s.dc.onopen = () => { if (active === s) statusLine.textContent = "연결됐어요. 모모에게 말을 걸어 보세요."; };
    s.dc.onclose = () => { if (active === s) finish("연결 종료"); };
    s.dc.onmessage = e => { onEvent(s, JSON.parse(e.data)).catch(() => {
      if (active === s) finish("응답을 처리할 수 없어요. 다시 시작해 주세요.");
    }); };
    const offer = await s.pc.createOffer();
    await s.pc.setLocalDescription(offer);
    const token = await post("/session", {mode:el("mode").value}, s.abort.signal);
    const res = await fetch("https://api.openai.com/v1/realtime/calls", {method:"POST",
      headers:{Authorization:"Bearer "+token.value,"Content-Type":"application/sdp"},
      body:offer.sdp,signal:s.abort.signal});
    if (!res.ok) throw new Error("음성 연결 실패 (HTTP "+res.status+")");
    await s.pc.setRemoteDescription({type:"answer",sdp:await res.text()});
  } catch (err) {
    if (active === s) finish(err.message);
  }
}
el("start").onclick = start;
el("stop").onclick = () => finish("대화가 끝났어요.");
window.addEventListener("pagehide", () => { if (active) finish("대화 종료"); });
fetch("/modes").then(r => r.json()).then(modes => {
  modes.forEach(m => el("mode").add(new Option(m,m)));
  el("start").disabled = false;
  statusLine.textContent = "준비됐어요";
}).catch(() => {statusLine.textContent = "활동 목록을 불러올 수 없어요.";});

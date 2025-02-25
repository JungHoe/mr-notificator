// server.js
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const port = 3000;

app.use(bodyParser.json());

// 현재 SSE 연결을 유지 중인 클라이언트(res)들을 저장할 배열
const sseClients = [];

// 1) SSE 엔드포인트
app.get("/sse", (req, res) => {
  const userId = req.query.id;
  console.log("User ID:", userId);
  // SSE 표준 헤더 설정
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.setHeader("Access-Control-Allow-Origin", "*");

  // 연결이 끊겼을 때 처리
  req.on("close", () => {
    const index = sseClients.indexOf(res);
    if (index !== -1) {
      sseClients.splice(index, 1);
    }
  });

  // 연결된 클라이언트를 배열에 넣어둔다
  sseClients.push(res);

  // 연결되었음을 클라이언트에게 알려줄 수도 있음
  res.write(`data: ${JSON.stringify({ message: "SSE connected" })}\n\n`);
});

// 2) GitLab Webhook 엔드포인트
app.post("/gitlab-webhook", (req, res) => {
  const event = req.headers["x-gitlab-event"]; // "Merge Request Hook", "Note Hook" 등
  const payload = req.body;

  console.log("GitLab Webhook:", event, payload);

  // 이벤트에 따라 보내고 싶은 알림 메시지 구성
  let msg = "";
  if (event === "Merge Request Hook") {
    const mr = payload.object_attributes;
    msg = `[MR] ${mr.title} - 상태: ${mr.state}, 작성자: ${mr.author_id}`;
  } else if (event === "Note Hook") {
    const note = payload.object_attributes;
    msg = `[Comment] ${note.note} - 작성자: ${note.author_id}`;
  } else {
    msg = `GitLab 이벤트 (${event})가 발생했습니다.`;
  }

  // SSE 연결 중인 모든 클라이언트에게 데이터 전송
  broadcastSSE({ event, message: msg });

  res.status(200).send("OK");
});

// SSE Broadcast 함수
function broadcastSSE(data) {
  const serializedData = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((clientRes) => {
    clientRes.write(serializedData);
  });
}

app.listen(port, () => {
  console.log(`SSE server running on http://localhost:${port}`);
});

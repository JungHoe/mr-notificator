// server.js
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const port = 3000;

app.use(bodyParser.json());

// 현재 SSE 연결을 유지 중인 클라이언트(res)들을 저장할 배열
const sseClients = {};

// 1) SSE 엔드포인트
app.get("/sse", (req, res) => {
  const userId = req.query.id;
  let alertList = req.query?.alertList || [];
  if (typeof alertList === "string") {
    alertList = req.query.alertList
      .split(",")
      .map((item) => item.toLowerCase());
  }
  // Check if there's an existing connection with the same ID
  const existingClient = sseClients[userId];
  if (existingClient) {
    res.status(400).json({ error: "이미 존재하는 아이디입니다." });
    return;
  }
  // SSE 표준 헤더 설정
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.setHeader("Access-Control-Allow-Origin", "*");

  // 연결이 끊겼을 때 처리
  req.on("close", () => {
    delete sseClients[userId];
  });

  // 연결된 클라이언트를 배열에 넣어둔다
  sseClients[userId] = { sse: res, config: { alertList } };

  // 연결되었음을 클라이언트에게 알려줄 수도 있음
  res.write(
    `data: ${JSON.stringify({
      event: "[Connected]",
      message: `서버에 연결됐습니다. ID:${userId}`,
    })}\n\n`
  );
});

// 2) GitLab Webhook 엔드포인트
app.post("/gitlab-webhook", (req, res) => {
  const event = req.headers["x-gitlab-event"]; // "Merge Request Hook", "Note Hook" 등
  const payload = req.body;

  console.log("GitLab Webhook:", event, payload);
  // gitlab 계정id
  // 이벤트에 따라 보내고 싶은 알림 메시지 구성
  let msg = "";
  let eventLabel = event;
  let url = undefined;
  let userId = "";
  let projectName = payload?.project?.name || "";

  if (event === "Merge Request Hook") {
    eventLabel = "[MR]";
    const attr = payload.object_attributes;
    userId = payload.user.username;
    url = attr.url;
    const userName = payload.user.name;
    msg = `${attr.title} - 상태: ${attr.state}, 작성자: ${userName}`;
  } else if (event === "Note Hook") {
    eventLabel = "[Comment]";
    const attr = payload.object_attributes;
    url = attr.url;
    userId = payload.user.username;
    const userName = payload.user.name;
    msg = `${attr.note} - 작성자: ${userName}`;
  } else {
    msg = `GitLab 이벤트 (${event})가 발생했습니다.`;
  }

  // SSE 연결 중인 모든 클라이언트에게 데이터 전송
  broadcastSSE({
    event: `${eventLabel} ${projectName}`,
    projectName: projectName.toLowerCase(),
    message: msg,
    userId,
    url,
  });

  res.status(200).send("OK");
});

// SSE Broadcast 함수
function broadcastSSE(data) {
  const serializedData = `data: ${JSON.stringify(data)}\n\n`;
  Object.keys(sseClients).forEach((key) => {
    // 1. 내가발송한 알림이면 받지않음
    if (key !== data.userId) {
      //2. alertList를 설정하면 설정한 알림만받음
      if (
        sseClients[key].config.alertList.length > 0 &&
        !sseClients[key].config.alertList.includes(data.projectName)
      ) {
        return;
      }
      sseClients[key].sse.write(serializedData);
    }
  });
}

app.listen(port, () => {
  console.log(`SSE server running on http://localhost:${port}`);
});

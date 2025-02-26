import { useEffect, useState } from "react";
import { PROTOCOL, SSE_SERVER_URL } from "./constants/common";
import "./App.css";

// window.electronAPI 전역객체에 대한 타입 선언
declare global {
  interface Window {
    electronAPI: {
      saveData: (data: string) => void;
      loadData: () => Promise<string>;
    };
  }
}

function App() {
  const [userId, setUserId] = useState<string>("");
  const [alertList, setAlertList] = useState("");
  const [enableLog, setEnableLog] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  const handleSaveSetting = () => {
    const data = { userId, alertList };
    window.electronAPI.saveData(JSON.stringify(data));
  };

  // SSE 연결
  const handleConnect = (): void => {
    if (!userId) return;

    // 기존 연결이 있으면 닫고 새로 연결
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }

    // 서버 엔드포인트 예: http://localhost:3000/sse?id={userId}
    let url = `${PROTOCOL}${SSE_SERVER_URL}/sse?id=${userId}`;
    if (alertList.trim() !== "") {
      url += `&alertList=${alertList}`;
    }
    const es = new EventSource(url);

    es.onopen = () => {
      console.log("SSE connection opened for user:", userId);
      if (enableLog) {
        setLog((prev) => [...prev, `Connected as ${userId}`]);
      }
    };

    es.onmessage = (event: MessageEvent) => {
      console.log("SSE message:", event.data);
      if (enableLog) {
        setLog((prev) => [...prev, event.data]);
      }
      const parsedData = JSON.parse(event.data);
      // 데스크톱(브라우저) 알림
      if (Notification.permission === "granted") {
        const noti = new Notification(parsedData.event, {
          body: parsedData.message,
        });
        noti.onclick = (e) => {
          e.preventDefault();
          if (parsedData.url) {
            window.open(parsedData.url, "_blank");
          }
        };
      }
    };

    es.onerror = (err) => {
      console.error("SSE error:", err);
      if (enableLog) {
        setLog((prev) => [...prev, "SSE error"]);
      }
    };

    setEventSource(es);
  };

  // SSE 연결 해제
  const handleDisconnect = (): void => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
      setLog((prev) => [...prev, "Disconnected"]);
    }
  };

  // 앱 실행 시 알림 권한 요청 (브라우저 환경)
  useEffect(() => {
    const init = async () => {
      const savedData = await window.electronAPI.loadData();
      if (savedData) {
        const parsedData: { userId: string; alertList: string } =
          JSON.parse(savedData);
        setUserId(parsedData.userId);
        setAlertList(parsedData.alertList);
      }
    };
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }
    init();
  }, []);

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Notificator Client</h1>

      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          style={{ marginRight: "0.5rem" }}
        />
        <button
          onClick={handleConnect}
          className={eventSource === null ? "ready" : "connected"}
        >
          {eventSource === null ? "Connect" : "Connected"}
        </button>
        <button
          onClick={handleDisconnect}
          style={{ marginLeft: "0.5rem" }}
          disabled={eventSource === null}
        >
          Disconnect
        </button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="알림 받을 프로젝트목록(CSV)"
          value={alertList}
          onChange={(e) => setAlertList(e.target.value)}
          style={{ marginRight: "0.5rem", width: 400 }}
        />
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <button onClick={handleSaveSetting} className="save-button">
          State 저장
        </button>
      </div>

      <h2>
        Logs
        <label className="switch">
          <input
            type="checkbox"
            checked={enableLog}
            onChange={() => {
              setEnableLog((prev) => !prev);
            }}
          />
          <span className="slider round"></span>
        </label>
      </h2>

      {enableLog && (
        <div
          style={{
            border: "1px solid #ccc",
            padding: "0.5rem",
            height: "200px",
            overflowY: "auto",
          }}
        >
          {log.map((entry, idx) => (
            <div key={idx}>{entry}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;

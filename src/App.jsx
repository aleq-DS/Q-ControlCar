import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [devices, setDevices] = useState([]);
  const [selectedMac, setSelectedMac] = useState("");
  const [connected, setConnected] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Aguardando conexão Bluetooth");
  const [lastCommand, setLastCommand] = useState("-");
  const [activeKeys, setActiveKeys] = useState([]);

  const pressedSetRef = useRef(new Set());
  const lastSentRef = useRef("");

  const getBluetoothSerial = () => {
    if (typeof window !== "undefined" && window.bluetoothSerial) {
      return window.bluetoothSerial;
    }
    return null;
  };

  const listPairedDevices = () => {
    const bt = getBluetoothSerial();
    if (!bt) {
      setStatusMsg("Modo navegador: simulação ativa.");
      return;
    }

    setStatusMsg("Buscando dispositivos pareados...");
    bt.list(
      (pairedList) => {
        setDevices(pairedList || []);
        if (pairedList && pairedList.length > 0) {
          setSelectedMac((prev) => prev || pairedList[0].address || pairedList[0].id || "");
          setStatusMsg(`${pairedList.length} dispositivo(s) pareado(s).`);
        } else {
          setStatusMsg("Nenhum dispositivo pareado encontrado.");
        }
      },
      (err) => {
        setStatusMsg(`Erro ao listar: ${err}`);
      }
    );
  };

  useEffect(() => {
    const onDeviceReady = () => listPairedDevices();
    document.addEventListener("deviceready", onDeviceReady, false);

    if (!window.cordova) {
      listPairedDevices();
    }

    return () => {
      document.removeEventListener("deviceready", onDeviceReady, false);
    };
  }, []);

  const writeRawCommand = (cmd) => {
    setLastCommand(cmd);
    const bt = getBluetoothSerial();

    if (!bt) {
      console.log(`[SIMULACAO BT] Comando enviado: ${cmd}`);
      return;
    }

    bt.write(
      cmd,
      () => {},
      (err) => {
        setStatusMsg(`Erro ao enviar '${cmd}': ${err}`);
      }
    );
  };

  // Resolve combinação de teclas pressionadas (F, B, L, R)
  const resolveCommandFromSet = (pressed) => {
    const hasF = pressed.has("F");
    const hasB = pressed.has("B");
    const hasR = pressed.has("R");
    const hasL = pressed.has("L");

    if (hasF && hasR) return "G"; // Curva suave frente + direita
    if (hasF && hasL) return "I"; // Curva suave frente + esquerda
    if (hasB && hasR) return "H"; // Curva suave ré + direita
    if (hasB && hasL) return "J"; // Curva suave ré + esquerda

    if (hasF) return "F";
    if (hasB) return "B";
    if (hasR) return "R";
    if (hasL) return "L";

    return "s";
  };

  const syncPressedState = () => {
    const currentSet = pressedSetRef.current;
    setActiveKeys(Array.from(currentSet));

    const nextCmd = resolveCommandFromSet(currentSet);
    if (nextCmd !== lastSentRef.current) {
      lastSentRef.current = nextCmd;
      writeRawCommand(nextCmd);
    }
  };

  const handlePressKey = (key) => {
    pressedSetRef.current.add(key);
    syncPressedState();
  };

  const handleReleaseKey = (key) => {
    pressedSetRef.current.delete(key);
    syncPressedState();
  };

  const handleEmergencyStop = () => {
    pressedSetRef.current.clear();
    setActiveKeys([]);
    lastSentRef.current = "s";
    writeRawCommand("s");
  };

  const bindPadButton = (key) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignora caso não suportado no ambiente
      }
      handlePressKey(key);
    },
    onPointerUp: (e) => {
      e.preventDefault();
      handleReleaseKey(key);
    },
    onPointerCancel: (e) => {
      e.preventDefault();
      handleReleaseKey(key);
    },
  });

  const handleConnect = () => {
    const bt = getBluetoothSerial();
    if (!selectedMac) {
      setStatusMsg("Selecione o HC-06 pareado.");
      return;
    }

    if (!bt) {
      setConnected((prev) => !prev);
      setStatusMsg("Simulação de conexão alternada.");
      return;
    }

    setStatusMsg(`Conectando a ${selectedMac}...`);
    bt.connect(
      selectedMac,
      () => {
        setConnected(true);
        setStatusMsg(`Conectado a ${selectedMac}`);
      },
      (err) => {
        setConnected(false);
        setStatusMsg(`Falha: ${err}`);
      }
    );
  };

  const handleDisconnect = () => {
    handleEmergencyStop();
    const bt = getBluetoothSerial();
    if (!bt) {
      setConnected(false);
      setStatusMsg("Desconectado (simulação).");
      return;
    }

    bt.disconnect(
      () => {
        setConnected(false);
        setStatusMsg("Desconectado.");
      },
      (err) => {
        setStatusMsg(`Erro ao desconectar: ${err}`);
      }
    );
  };

  const isActive = (key) => activeKeys.includes(key);

  return (
    <div className="gamepad-wrapper">
      <div className="gamepad-shell">
        <header className="gamepad-header">
          <div className="brand-block">
            <h1>Q-ControlCar</h1>
            <span className={`led-pill ${connected ? "led-on" : "led-off"}`}>
              {connected ? "HC-06 ONLINE" : "HC-06 OFF"}
            </span>
          </div>

          <div className="telemetry-box">
            <span>
              Ativos: <strong>{activeKeys.length ? activeKeys.join(" + ") : "nenhum"}</strong>
            </span>
            <span>
              TX: <strong className="tx-code">{lastCommand}</strong>
            </span>
          </div>
        </header>

        <section className="bt-bar">
          <select
            className="bt-select"
            value={selectedMac}
            onChange={(e) => setSelectedMac(e.target.value)}
            disabled={connected}
          >
            <option value="">Selecione o HC-06...</option>
            {devices.map((dev, idx) => {
              const addr = dev.address || dev.id || "";
              const label = dev.name ? `${dev.name} (${addr})` : addr;
              return (
                <option key={`${addr}-${idx}`} value={addr}>
                  {label}
                </option>
              );
            })}
          </select>

          <button
            type="button"
            className="btn-secondary"
            onClick={listPairedDevices}
            disabled={connected}
          >
            Buscar
          </button>

          {!connected ? (
            <button type="button" className="btn-connect" onClick={handleConnect}>
              Conectar
            </button>
          ) : (
            <button type="button" className="btn-disconnect" onClick={handleDisconnect}>
              Sair
            </button>
          )}
        </section>

        <p className="status-bar">{statusMsg}</p>

        <main className="controller-deck">
          <div className="dpad-cluster">
            <button
              type="button"
              className={`pad-btn pad-up ${isActive("F") ? "is-pressed" : ""}`}
              {...bindPadButton("F")}
            >
              <span className="arrow">▲</span>
              <span className="code-tag">F</span>
            </button>

            <button
              type="button"
              className={`pad-btn pad-left ${isActive("L") ? "is-pressed" : ""}`}
              {...bindPadButton("L")}
            >
              <span className="arrow">◀</span>
              <span className="code-tag">L</span>
            </button>

            <button
              type="button"
              className="pad-btn pad-center"
              onClick={handleEmergencyStop}
              title="Parar motores"
            >
              <span>STOP</span>
              <span className="code-tag">s</span>
            </button>

            <button
              type="button"
              className={`pad-btn pad-right ${isActive("R") ? "is-pressed" : ""}`}
              {...bindPadButton("R")}
            >
              <span className="arrow">▶</span>
              <span className="code-tag">R</span>
            </button>

            <button
              type="button"
              className={`pad-btn pad-down ${isActive("B") ? "is-pressed" : ""}`}
              {...bindPadButton("B")}
            >
              <span className="arrow">▼</span>
              <span className="code-tag">B</span>
            </button>
          </div>

          <aside className="combo-legend">
            <h2>Curvas por Combinação</h2>
            <ul>
              <li>
                <kbd>F</kbd> + <kbd>R</kbd> → <strong>G</strong> (Curva Dir.)
              </li>
              <li>
                <kbd>F</kbd> + <kbd>L</kbd> → <strong>I</strong> (Curva Esq.)
              </li>
              <li>
                <kbd>B</kbd> + <kbd>R</kbd> → <strong>H</strong> (Ré Dir.)
              </li>
              <li>
                <kbd>B</kbd> + <kbd>L</kbd> → <strong>J</strong> (Ré Esq.)
              </li>
            </ul>
            <p className="hint-text">
              Segure dois botões juntos para fazer curva suave; solte para parar (<strong>s</strong>).
            </p>
          </aside>
        </main>
      </div>
    </div>
  );
}

export default App;
import { useEffect, useRef, useState } from "react";
import "./App.css";
import appLogo from "./assets/favicon.ico";

function App() {
  const [devices, setDevices] = useState([]);
  const [selectedMac, setSelectedMac] = useState("");
  const [connected, setConnected] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Aguardando conexão Bluetooth");
  const [lastCommand, setLastCommand] = useState("s");
  const [activeKeys, setActiveKeys] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const pressedSetRef = useRef(new Set());
  const lastSentRef = useRef("s");
  const touchStartXRef = useRef(null);

  const getBluetoothSerial = () => {
    if (typeof window !== "undefined" && window.bluetoothSerial) {
      return window.bluetoothSerial;
    }
    return null;
  };

  const requestConnectPermission = (onGranted) => {
    const bt = getBluetoothSerial();
    if (!bt) {
      onGranted();
      return;
    }

    if (typeof bt.requestPermission === "function") {
      bt.requestPermission(
        () => {
          onGranted();
        },
        (err) => {
          setStatusMsg(
            `Permissão BLUETOOTH_CONNECT não concedida (${err}). Ative em: Ajustes > Apps > Q-ControlCar > Permissões > Dispositivos próximos.`
          );
        }
      );
    } else {
      onGranted();
    }
  };

  const listPairedDevices = () => {
    const bt = getBluetoothSerial();
    if (!bt) {
      setStatusMsg("Modo navegador: simulação ativa.");
      return;
    }

    requestConnectPermission(() => {
      setStatusMsg("Buscando dispositivos pareados...");
      bt.list(
        (pairedList) => {
          setDevices(pairedList || []);
          if (pairedList && pairedList.length > 0) {
            setSelectedMac((prev) => prev || pairedList[0].address || pairedList[0].id || "");
            setStatusMsg(`${pairedList.length} dispositivo(s) pareado(s).`);
          } else {
            setStatusMsg("Nenhum dispositivo pareado encontrado. Pareie o HC-06 no Bluetooth do celular.");
          }
        },
        (err) => {
          const msg = String(err || "");
          if (msg.includes("BLUETOOTH_CONNECT") && typeof bt.requestPermission === "function") {
            bt.requestPermission(
              () => listPairedDevices(),
              (permErr) => setStatusMsg(`Permissão BLUETOOTH_CONNECT negada: ${permErr}`)
            );
            return;
          }
          setStatusMsg(`Erro ao listar: ${msg}`);
        }
      );
    });
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
    if (!connected) return;

    const currentSet = pressedSetRef.current;
    setActiveKeys(Array.from(currentSet));

    const nextCmd = resolveCommandFromSet(currentSet);
    if (nextCmd !== lastSentRef.current) {
      lastSentRef.current = nextCmd;
      writeRawCommand(nextCmd);
    }
  };

  const handlePressKey = (key) => {
    if (!connected) return;
    pressedSetRef.current.add(key);
    syncPressedState();
  };

  const handleReleaseKey = (key) => {
    if (!connected) return;
    pressedSetRef.current.delete(key);
    syncPressedState();
  };

  const handleEmergencyStop = () => {
    pressedSetRef.current.clear();
    setActiveKeys([]);
    lastSentRef.current = "s";
    setLastCommand("s");

    const bt = getBluetoothSerial();
    if (!bt) {
      console.log("[SIMULACAO BT] Comando enviado: s");
      return;
    }

    if (connected) {
      bt.write(
        "s",
        () => {},
        (err) => setStatusMsg(`Erro ao enviar 's': ${err}`)
      );
    }
  };

  const bindPadButton = (key) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      if (!connected) return;
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
      setConnected((prev) => {
        const next = !prev;
        if (!next) {
          pressedSetRef.current.clear();
          setActiveKeys([]);
          lastSentRef.current = "s";
          setLastCommand("s");
        }
        return next;
      });
      setStatusMsg("Simulação de conexão alternada.");
      return;
    }

    requestConnectPermission(() => {
      setStatusMsg(`Conectando a ${selectedMac}...`);
      bt.connect(
        selectedMac,
        () => {
          setConnected(true);
          pressedSetRef.current.clear();
          setActiveKeys([]);
          lastSentRef.current = "s";
          setLastCommand("s");
          setStatusMsg(`Conectado a ${selectedMac}`);
          setMenuOpen(false);
        },
        (err) => {
          setConnected(false);
          setStatusMsg(`Falha: ${err}`);
        }
      );
    });
  };

  const handleDisconnect = () => {
    pressedSetRef.current.clear();
    setActiveKeys([]);
    lastSentRef.current = "s";
    setLastCommand("s");

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

  const handleWrapperTouchStart = (e) => {
    if (menuOpen) return;
    const x = e.touches?.[0]?.clientX ?? 0;
    if (x <= 28) {
      touchStartXRef.current = x;
    } else {
      touchStartXRef.current = null;
    }
  };

  const handleWrapperTouchMove = (e) => {
    if (touchStartXRef.current === null || menuOpen) return;
    const currentX = e.touches?.[0]?.clientX ?? 0;
    if (currentX - touchStartXRef.current >= 55) {
      setMenuOpen(true);
      touchStartXRef.current = null;
    }
  };

  const handleWrapperTouchEnd = () => {
    touchStartXRef.current = null;
  };

  const isActive = (key) => connected && activeKeys.includes(key);

  const dirLabels = {
    F: "Frente",
    B: "Ré",
    L: "Esquerda",
    R: "Direita",
  };

  const activeDirectionText = !connected
    ? "Parado"
    : activeKeys.length === 0
      ? "Parado"
      : activeKeys.map((k) => dirLabels[k] || k).join(" + ");

  const displayedTx = !connected ? "s" : lastCommand;

  return (
    <div
      className="gamepad-wrapper"
      onTouchStart={handleWrapperTouchStart}
      onTouchMove={handleWrapperTouchMove}
      onTouchEnd={handleWrapperTouchEnd}
    >
      <div
        className={`drawer-backdrop ${menuOpen ? "is-open" : ""}`}
        onClick={() => setMenuOpen(false)}
      />

      <aside className={`side-drawer ${menuOpen ? "is-open" : ""}`} aria-hidden={!menuOpen}>
        <div className="drawer-header">
          <h2>Conexão</h2>
          <button
            type="button"
            className="drawer-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Fechar menu"
          >
            ✕
          </button>
        </div>

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

          <div className="bt-actions">
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
          </div>
        </section>

        <p className="status-bar">{statusMsg}</p>
        <p>------------------------------------------</p>
        <h2>Mapeamento de teclas</h2>

        <aside className="combo-legend">
          <h3>Combinação e curvas</h3>
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
      </aside>

      <main className="gamepad-shell">
        <header className="top-bar">
          <button
            type="button"
            className="menu-trigger"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu lateral"
          >
            ☰
          </button>

          <div className="brand-center">
            <img src={appLogo} alt="Q-ControlCar" className="app-logo-mini" />
          </div>

          <span className={`led-pill ${connected ? "led-on" : "led-off"}`}>
            {connected ? "VEÍCULO ON" : "VEÍCULO OFF"}
          </span>

          <span aria-hidden="true" />
        </header>

        <div className="status-telemetry-row">
          <div className={`telemetry-subtle ${!connected ? "is-frozen" : ""}`}>
            <span>{activeDirectionText}</span>
            <span>•</span>
            <span>
              TX: <strong className="tx-code">{displayedTx}</strong>
            </span>
          </div>
        </div>

        <section className="controller-deck">
          <div className="dpad-cluster">
            <button
              type="button"
              className={`pad-btn pad-up ${isActive("F") ? "is-pressed" : ""}`}
              disabled={!connected}
              {...bindPadButton("F")}
            >
              <span className="arrow">▲</span>
              <span className="code-tag">F</span>
            </button>

            <button
              type="button"
              className={`pad-btn pad-left ${isActive("L") ? "is-pressed" : ""}`}
              disabled={!connected}
              {...bindPadButton("L")}
            >
              <span className="arrow">◀</span>
              <span className="code-tag">L</span>
            </button>

            <button
              type="button"
              className="pad-btn pad-center"
              disabled={!connected}
              onClick={handleEmergencyStop}
              title="Parar motores"
            >
              <span>STOP</span>
              <span className="code-tag">s</span>
            </button>

            <button
              type="button"
              className={`pad-btn pad-right ${isActive("R") ? "is-pressed" : ""}`}
              disabled={!connected}
              {...bindPadButton("R")}
            >
              <span className="arrow">▶</span>
              <span className="code-tag">R</span>
            </button>

            <button
              type="button"
              className={`pad-btn pad-down ${isActive("B") ? "is-pressed" : ""}`}
              disabled={!connected}
              {...bindPadButton("B")}
            >
              <span className="arrow">▼</span>
              <span className="code-tag">B</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
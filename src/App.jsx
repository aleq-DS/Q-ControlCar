import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [devices, setDevices] = useState([]);
  const [selectedMac, setSelectedMac] = useState("");
  const [connected, setConnected] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Aguardando conexão Bluetooth");
  const [lastCommand, setLastCommand] = useState("-");

  const getBluetoothSerial = () => {
    if (typeof window !== "undefined" && window.bluetoothSerial) {
      return window.bluetoothSerial;
    }
    return null;
  };

  const listPairedDevices = () => {
    const bt = getBluetoothSerial();
    if (!bt) {
      setStatusMsg("Modo navegador: Bluetooth nativo disponível apenas no Android/APK.");
      return;
    }

    setStatusMsg("Buscando dispositivos pareados...");
    bt.list(
      (pairedList) => {
        setDevices(pairedList || []);
        if (pairedList && pairedList.length > 0) {
          setSelectedMac((prev) => prev || pairedList[0].address || pairedList[0].id || "");
          setStatusMsg(`Encontrados ${pairedList.length} dispositivo(s) pareado(s).`);
        } else {
          setStatusMsg("Nenhum dispositivo pareado. Pareie o HC-06 nas configurações do Android.");
        }
      },
      (err) => {
        setStatusMsg(`Erro ao listar dispositivos: ${err}`);
      }
    );
  };

  useEffect(() => {
    const onDeviceReady = () => {
      listPairedDevices();
    };

    document.addEventListener("deviceready", onDeviceReady, false);

    // Facilita testar no navegador desktop
    if (!window.cordova) {
      listPairedDevices();
    }

    return () => {
      document.removeEventListener("deviceready", onDeviceReady, false);
    };
  }, []);

  const handleConnect = () => {
    const bt = getBluetoothSerial();
    if (!selectedMac) {
      setStatusMsg("Selecione um dispositivo (ex.: HC-06) antes de conectar.");
      return;
    }

    if (!bt) {
      setConnected((prev) => !prev);
      setStatusMsg("Simulação de conexão alternada no navegador.");
      return;
    }

    setStatusMsg(`Conectando a ${selectedMac}...`);
    bt.connect(
      selectedMac,
      () => {
        setConnected(true);
        setStatusMsg(`Conectado ao dispositivo (${selectedMac})`);
      },
      (err) => {
        setConnected(false);
        setStatusMsg(`Falha na conexão: ${err}`);
      }
    );
  };

  const handleDisconnect = () => {
    const bt = getBluetoothSerial();
    if (!bt) {
      setConnected(false);
      setStatusMsg("Desconectado (modo navegador).");
      return;
    }

    bt.disconnect(
      () => {
        setConnected(false);
        setStatusMsg("Desconectado do Bluetooth.");
      },
      (err) => {
        setStatusMsg(`Erro ao desconectar: ${err}`);
      }
    );
  };

  const sendCommand = (cmd) => {
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

  const bindControlEvents = (cmd) => ({
    onTouchStart: (e) => {
      e.preventDefault();
      sendCommand(cmd);
    },
    onTouchEnd: (e) => {
      e.preventDefault();
      sendCommand("s");
    },
    onMouseDown: () => sendCommand(cmd),
    onMouseUp: () => sendCommand("s"),
  });

  return (
    <main className="app-container">
      <h1>Q-ControlCar</h1>
      <p className="status-text">{statusMsg}</p>

      <section className="bt-panel">
        <div className="bt-row">
          <select
            value={selectedMac}
            onChange={(e) => setSelectedMac(e.target.value)}
            disabled={connected}
          >
            <option value="">Selecione o HC-06 pareado...</option>
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

          <button type="button" onClick={listPairedDevices} disabled={connected}>
            Atualizar
          </button>
        </div>

        <div className="bt-row">
          {!connected ? (
            <button type="button" onClick={handleConnect}>
              Conectar
            </button>
          ) : (
            <button type="button" onClick={handleDisconnect}>
              Desconectar
            </button>
          )}
          <span className="cmd-badge">Último cmd: <strong>{lastCommand}</strong></span>
        </div>
      </section>

      <section className="controls-grid">
        <button type="button" {...bindControlEvents("I")}>
          ↖ Curva Esq (I)
        </button>
        <button type="button" {...bindControlEvents("F")}>
          ⬆️ Frente (F)
        </button>
        <button type="button" {...bindControlEvents("G")}>
          ↗ Curva Dir (G)
        </button>

        <button type="button" {...bindControlEvents("L")}>
          ⬅️ Giro Esq (L)
        </button>
        <button type="button" className="btn-stop" onClick={() => sendCommand("s")}>
          ⏹️ Parar (s)
        </button>
        <button type="button" {...bindControlEvents("R")}>
          ➡️ Giro Dir (R)
        </button>

        <div className="spacer" />
        <button type="button" {...bindControlEvents("B")}>
          ⬇️ Ré (B)
        </button>
        <div className="spacer" />
      </section>
    </main>
  );
}

export default App;
import asyncio
import socket
import struct
import json
import requests
import threading

from pymodbus.datastore import ModbusServerContext, ModbusSlaveContext, ModbusSequentialDataBlock
from pymodbus.server import StartAsyncTcpServer

# Modbus TCP (puerto 1502)
block = ModbusSequentialDataBlock(0, [0] * 6)  # 6 registros
store = ModbusSlaveContext(hr=block)
context = ModbusServerContext(slaves=store, single=True)

# verificación de firma simulada (fake SHA-256 + offset)
def fake_sha256(data: bytes) -> bytes:
    h = bytearray(32)
    for i in range(32):
        h[i] = (i + len(data)) % 256
    return bytes(h)

def verify_signature(payload: bytes, r: bytes, s: bytes) -> bool:
    h = fake_sha256(payload)
    return all(r[i] == h[i] and s[i] == (h[i] + 42) % 256 for i in range(32))

# actualizar registros Modbus: 2 regs por float (big-endian)
def update_registers(start: int, value: float):
    bits = struct.pack(">f", value)
    hi, lo = struct.unpack(">HH", bits)
    context[0].setValues(3, start, [hi, lo])  # Function code 3 = holding registers

#listener TCP de paquetes binarios en puerto 8080
def run_listener():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("0.0.0.0", 8080))
        s.listen()
        print("Servidor intermedio binario escuchando en puerto 8080...")
        while True:
            conn, _ = s.accept()
            threading.Thread(target=handle_client, args=(conn,), daemon=True).start()

def handle_client(conn: socket.socket):
    with conn:
        data = conn.recv(100)
        if len(data) != 100:
            conn.send(b"ERROR")
            return

        #desempaquetar primeros 36 bytes en little endian
        sensor_id, fecha_b, temp, pres, hum = struct.unpack("<i20sfff", data[:36])
        fecha = fecha_b.decode("utf-8").strip("\x00")

        # firma R y S
        r = data[36:68]
        s = data[68:100]

        #reconstruir payload exactamente como fue firmado en C++
        payload = struct.pack("<i20sfff", sensor_id, fecha_b, temp, pres, hum)

        # Mostrar valores recibidos
        #print("Datos recibidos:")
        #print(f"  Sensor ID     : {sensor_id}")
        #print(f"  Fecha         : {fecha}")
        #print(f"  Temperatura   : {temp:.2f} °C   [0x{struct.unpack('<I', struct.pack('<f', temp))[0]:08X}]")
        #print(f"  Presión       : {pres:.2f} hPa  [0x{struct.unpack('<I', struct.pack('<f', pres))[0]:08X}]")
        #print(f"  Humedad       : {hum:.2f} %     [0x{struct.unpack('<I', struct.pack('<f', hum))[0]:08X}]")

        # verificación de firma
        if not verify_signature(payload, r, s):
            print("FIRMA INVALIDA\n")
            conn.send(b"FIRMA_INVALIDA")
            return

        print("FIRMA VÁLIDA\n")

        # actualizar registros Modbus
        update_registers(0, temp)
        update_registers(2, pres)
        update_registers(4, hum)

        # envviar lectura al servidor final
        json_payload = {
            "sensor_id": sensor_id,
            "fecha_hora": fecha,
            "temperatura": temp,
            "presion": pres,
            "humedad": hum
        }
        try:
            resp = requests.post("http://localhost:5000/lecturas",
                                 json=json_payload,
                                 timeout=3)
            print("Servidor final HTTP:", resp.status_code)
        except Exception as e:
            print("Error HTTP:", e)

        conn.send(b"OK")

# iniciar servidor Modbus TCP (asyncio)
async def run_modbus():
    print("Servidor Modbus TCP activo en puerto 1502...")
    await StartAsyncTcpServer(context, address=("0.0.0.0", 1502))

if __name__ == "__main__":
    threading.Thread(target=run_listener, daemon=True).start()
    asyncio.run(run_modbus())

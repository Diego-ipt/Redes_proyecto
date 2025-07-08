# 📡 Proyecto semestral Redes de Computadores: Plataforma IoT Distribuida y Segura para Monitoreo Industrial

## 🧰 Requisitos del Sistema

* **Python**: Versión recomendada **3.10** o superior
* **C++**: Para compilar el cliente sensor
* **Sistema operativo**: Linux (probado en Linux Mint 22.1 Cinnamon) , también puede adaptarse a otros

---

## ⚙️ Configuración del entorno

1. **Crear y activar entorno virtual de Python:**

```bash
python3 -m venv venv
source venv/bin/activate
```

2. **Instalar dependencias requeridas:**

```bash
pip install -r requirements.txt
```

---

## 🚀 Ejecución de los componentes

1. **Iniciar la API REST (servidor final):**

```bash
python api-rest.py
```

2. **Iniciar el servidor intermedio (recepción de datos binarios + Modbus TCP):**

```bash
python server-intermedio.py
```

3. **Compilar y ejecutar el Cliente Sensor en C++:**

```bash
g++ outdata.cpp -o cliente
./cliente
```

---

## 🖥️ Interfaz Web

Una vez todo esté en funcionamiento, puedes abrir tu navegador y visitar:

```
http://localhost:5000
```

Desde allí podrás visualizar las métricas, los gráficos y las alertas en tiempo real.

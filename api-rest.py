from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import sqlite3
import os

app = Flask(__name__)
DB_PATH = "bdd/IoT_Distribuida.db"
COLUMNAS = ["lectura_id", "sensor_id", "fecha_hora", "temperatura", "presion", "humedad"]


@app.route("/")
def index():
    return render_template("index.html")

# ver todas las lecturas
@app.route("/lecturas", methods=["GET"])
def get_lecturas():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Lectura")
    rows = cursor.fetchall()
    conn.close()
    data = [dict(zip(COLUMNAS, row)) for row in rows]
    return jsonify(data)

# ver lectura desde fecha_hora en adelante
@app.route("/lecturas/desde/<fecha_hora>", methods=["GET"])
def get_lecturas_desde(fecha_hora): 
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Lectura WHERE fecha_hora >= ?", (fecha_hora,))
    rows = cursor.fetchall()
    conn.close()
    data = [dict(zip(COLUMNAS, row)) for row in rows]
    return jsonify(data)


# ingresa tipo de alerta
@app.route("/alerta_type", methods=["POST"])
def insertar_tipo_alerta():
    data = request.get_json()
    if not data or "descripcion" not in data:
        return jsonify({"error": "Falta campo descripcion"}), 400
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO Tipo_Alerta (descripcion) VALUES (?)", (data["descripcion"],))
        conn.commit()
        conn.close()
        return jsonify({"mensaje": "Tipo de alerta insertado correctamente"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Tipo de alerta ya existe"}), 409

# Inserta una alerta
@app.route("/alertas", methods=["POST"])
def insertar_alerta():
    data = request.get_json()
    campos = ["lectura_id", "tipo_alerta_id", "fecha_generada"]
    if not all(c in data for c in campos):
        return jsonify({"error": "campos insuficientes"}), 400
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO Alerta (lectura_id, tipo_alerta_id, fecha_generada)
        VALUES (?, ?, ?)
    """, (
        data["lectura_id"],
        data["tipo_alerta_id"],
        data["fecha_generada"]
    ))
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Alerta insertada correctamente"}), 201


# ver lecturas por sensor_id
@app.route("/lecturas/<int:sensor_id>", methods=["GET"])
def get_lecturas_por_sensor(sensor_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Lectura WHERE sensor_id=?", (sensor_id,))
    rows = cursor.fetchall()
    conn.close()
    data = [dict(zip(COLUMNAS, row)) for row in rows]
    return jsonify(data)



# insertar lectura
@app.route("/lecturas", methods=["POST"])
def insertar_lectura():
    data = request.get_json()
    campos = ["sensor_id", "fecha_hora", "temperatura", "presion", "humedad"]

    # revisa si estan todos los campos al momento de recibir la solicitud de post
    if not all(c in data for c in campos):
        return jsonify({"error": "campos insuficientes"}), 400

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO Lectura (sensor_id, fecha_hora, temperatura, presion, humedad)
        VALUES (?, ?, ?, ?, ?)
    """, (
        data["sensor_id"],
        data["fecha_hora"],
        data["temperatura"],
        data["presion"],
        data["humedad"]
    ))
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Lectura insertada correctamente"}), 201

def agregar_tipos_alerta_predeterminados():
    tipos = [
        "Temperatura bajo el rango",
        "Temperatura sobre el rango",
        "Presión bajo el rango",
        "Presión sobre el rango",
        "Humedad bajo el rango",
        "Humedad sobre el rango"
    ]
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    for descripcion in tipos:
        try:
            cursor.execute("INSERT INTO Tipo_Alerta (descripcion) VALUES (?)", (descripcion,))
        except sqlite3.IntegrityError:
            pass  # Ya existe, ignorar
    conn.commit()
    conn.close()

# Llama a la función al iniciar el servidor
agregar_tipos_alerta_predeterminados()

if __name__ == "__main__":
    app.run(debug=True)
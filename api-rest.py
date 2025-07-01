from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)
DB_PATH = "IoT_Distribuida.db"
COLUMNAS = ["id", "sensor_id", "fecha_hora", "temperatura", "presion", "humedad"]

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

if __name__ == "__main__":
    app.run(debug=True)
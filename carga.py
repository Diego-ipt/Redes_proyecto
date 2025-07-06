import sqlite3
conn = sqlite3.connect("bdd/IoT_Distribuida.db")
for row in conn.execute("SELECT lectura_id, fecha_hora FROM Lectura ORDER BY fecha_hora DESC"):
    print(row)
conn.close()
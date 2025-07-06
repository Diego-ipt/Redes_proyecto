Requisitos del Sistema

- Python Versión recomendada: Python 3.10+

- Crear y activar un entorno virtual:

python3 -m venv venv

source venv/bin/activate


- Instalar Flask para crear el servidor local, request y pymodbus para el servidor intermedio: 

pip install Flask==2.3.3 requests==2.31.0 pymodbus==3.5.4


- Finalmente, ejecutar la API rest:

python api-rest.py


- El servidor intermedio:

python server-intermedio.py

- Y compilar y ejecutar el Cliente Sensor en C++

g++ outdata.cpp -o cliente
./cliente

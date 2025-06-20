#include <iostream>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <cstdlib>
#include <ctime>
#include <cstring>

// Estructura extendida para incluir la firma
struct LecturaBinFirmada {
    int32_t sensor_id;
    char fecha_hora[20]; // "YYYY-MM-DD HH:MM:SS" + '\0'
    float temperatura;
    float presion;
    float humedad;
    // Firma (simulada como dos enteros grandes)
    uint8_t firma_r[32];
    uint8_t firma_s[32];
};

// Simulación de función hash SHA256 (solo para ejemplo)
void FakeSha256(const void* data, size_t len, uint8_t out[32]) {
    // Solo para ejemplo: llena con valores fijos
    for (size_t i = 0; i < 32; ++i) out[i] = (uint8_t)((i + len) % 256);
}

// Simulación de firma ECDSA (rellena con valores fijos)
void SignMessage(const void* data, size_t len, uint8_t out_r[32], uint8_t out_s[32]) {
    // Hash del mensaje
    uint8_t hash[32];
    FakeSha256(data, len, hash);
    // Simula la firma usando el hash y una clave privada fija
    for (size_t i = 0; i < 32; ++i) {
        out_r[i] = hash[i];
        out_s[i] = (hash[i] + 42) % 256;
    }
}

struct LecturaBin {
    int32_t sensor_id;
    char fecha_hora[20]; // "YYYY-MM-DD HH:MM:SS" + '\0'
    float temperatura;
    float presion;
    float humedad;
};

int main(int argc, char* argv[]) {
    // Bucle de envío cada 1 segundo
    while(true) {
        int sock = socket(AF_INET, SOCK_STREAM, 0);
        if(sock < 0) {
            std::cerr << "Error creando socket\n";
            break;
        }

        sockaddr_in server;
        std::memset(&server, 0, sizeof(server));
        server.sin_family = AF_INET;
        server.sin_port = htons(8080);
        inet_pton(AF_INET, "127.0.0.1", &server.sin_addr);

        if(connect(sock, (sockaddr*)&server, sizeof(server)) < 0) {
            std::cerr << "Error conectando al servidor\n";
            close(sock);
            break;
        }


        // Simular datos de la tabla Lectura
        srand(time(NULL));
        int sensor_id = 1;
        float temperatura, presion, humedad;
        // Probabilidad de 0.5% de datos fuera de rango
        if (static_cast<float>(rand()) / RAND_MAX < 0.005f) {
            // Generar valores fuera de los parámetros normales
            int tipo = rand() % 3;
            if (tipo == 0) { // Temperatura fuera de rango
            temperatura = 40.0f + static_cast<float>(rand() % 1000) / 100.0f; // 40.00 - 49.99
            presion = 1000.0f + static_cast<float>(rand() % 500) / 10.0f;
            humedad = 30.0f + static_cast<float>(rand() % 700) / 10.0f;
            } else if (tipo == 1) { // Presión fuera de rango
            temperatura = 20.0f + static_cast<float>(rand() % 1000) / 100.0f;
            presion = 1100.0f + static_cast<float>(rand() % 500) / 10.0f; // 1100.0 - 1149.9
            humedad = 30.0f + static_cast<float>(rand() % 700) / 10.0f;
            } else { // Humedad fuera de rango
            temperatura = 20.0f + static_cast<float>(rand() % 1000) / 100.0f;
            presion = 1000.0f + static_cast<float>(rand() % 500) / 10.0f;
            humedad = 110.0f + static_cast<float>(rand() % 200) / 10.0f; // 110.0 - 129.9
            }
        } else {
            // Valores normales
            temperatura = 20.0f + static_cast<float>(rand() % 1000) / 100.0f; // 20.00 - 29.99
            presion = 1000.0f + static_cast<float>(rand() % 500) / 10.0f;     // 1000.0 - 1049.9
            humedad = 30.0f + static_cast<float>(rand() % 700) / 10.0f;       // 30.0 - 99.9
        }

        // Obtener fecha y hora actual en formato YYYY-MM-DD HH:MM:SS
        time_t now = time(0);
        struct tm tstruct;
        char fecha_hora[20];
        tstruct = *localtime(&now);
        strftime(fecha_hora, sizeof(fecha_hora), "%Y-%m-%d %H:%M:%S", &tstruct);


        // Construir estructura original
        LecturaBin lectura;
        lectura.sensor_id = sensor_id;
        std::strncpy(lectura.fecha_hora, fecha_hora, sizeof(lectura.fecha_hora));
        lectura.fecha_hora[sizeof(lectura.fecha_hora)-1] = '\0';
        lectura.temperatura = temperatura;
        lectura.presion = presion;
        lectura.humedad = humedad;

        // Firmar el mensaje
        LecturaBinFirmada lectura_firmada;
        std::memcpy(&lectura_firmada, &lectura, sizeof(LecturaBin));
        SignMessage(&lectura, sizeof(LecturaBin), lectura_firmada.firma_r, lectura_firmada.firma_s);

        // Enviar estructura firmada
        send(sock, &lectura_firmada, sizeof(lectura_firmada), 0);

        // Esperar respuesta del servidor intermedio
        char buffer[1024] = {0};
        int bytes = recv(sock, buffer, sizeof(buffer)-1, 0);
        if(bytes > 0) {
            buffer[bytes] = '\0';
            std::cout << "Recibido: " << buffer << std::endl;
        }

        close(sock);
        sleep(1); // Esperar 1 segundo antes de enviar de nuevo
    }

    return 0;
}

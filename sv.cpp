#include <iostream>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#include <cstring>
#include <signal.h>
#include <stdlib.h>
#include <time.h>
#include <open62541/server.h>
#include <open62541/server_config_default.h>
#include <thread>

static volatile UA_Boolean running = true;

static void stopHandler(int sig) {
    running = false;
}

// Función para actualizar el valor aleatoriamente
static void updateRandomValue(UA_Server *server, void *data) {
    UA_Int32 randVal = rand() % 100;
    UA_Variant value;
    UA_Variant_setScalar(&value, &randVal, &UA_TYPES[UA_TYPES_INT32]);
    UA_Server_writeValue(server, *(UA_NodeId*)data, value);
}

struct LecturaBin {
    int32_t sensor_id;
    char fecha_hora[20];
    float temperatura;
    float presion;
    float humedad;
};

// Estructura extendida para incluir la firma
struct LecturaBinFirmada {
    int32_t sensor_id;
    char fecha_hora[20];
    float temperatura;
    float presion;
    float humedad;
    uint8_t firma_r[32];
    uint8_t firma_s[32];
};

// Simulación de función hash SHA256 (solo para ejemplo)
void FakeSha256(const void* data, size_t len, uint8_t out[32]) {
    for (size_t i = 0; i < 32; ++i) out[i] = (uint8_t)((i + len) % 256);
}

// Simulación de verificación de firma ECDSA (solo para ejemplo)
bool VerifyMessage(const void* data, size_t len, const uint8_t firma_r[32], const uint8_t firma_s[32]) {
    // Simula la verificación: acepta solo si firma_r[i] == hash[i] y firma_s[i] == (hash[i]+42)%256
    uint8_t hash[32];
    FakeSha256(data, len, hash);
    for (size_t i = 0; i < 32; ++i) {
        if (firma_r[i] != hash[i]) return false;
        if (firma_s[i] != (uint8_t)((hash[i] + 42) % 256)) return false;
    }
    return true;
}

int main() {
    signal(SIGINT, stopHandler);
    signal(SIGTERM, stopHandler);
    srand((unsigned) time(NULL));

    UA_Server *server = UA_Server_new();
    UA_ServerConfig_setDefault(UA_Server_getConfig(server));

    // Registrar namespace personalizado y obtener su índice
    UA_UInt16 nsIdx = UA_Server_addNamespace(server, "Demo.Static.Scalar");

    // Nodo 1: variable modificable
    UA_Int32 val1 = 42;
    UA_VariableAttributes attr1 = UA_VariableAttributes_default;
    UA_Variant_setScalar(&attr1.value, &val1, &UA_TYPES[UA_TYPES_INT32]);
    attr1.displayName = UA_LOCALIZEDTEXT((char*)"en-US", (char*)"Nodo1");
    UA_NodeId id1 = UA_NODEID_STRING(nsIdx, (char*)"Demo.Static.Scalar.Int32");
    UA_Server_addVariableNode(server, id1, UA_NODEID_NUMERIC(0, UA_NS0ID_OBJECTSFOLDER),
        UA_NODEID_NUMERIC(0, UA_NS0ID_ORGANIZES),
        UA_QUALIFIEDNAME(nsIdx, (char*)"Nodo1"),
        UA_NODEID_NUMERIC(0, UA_NS0ID_BASEDATAVARIABLETYPE),
        attr1, NULL, NULL);

    // Nodo 2: valor aleatorio que cambia cada 2 segundos
    UA_Int32 val2 = 10;
    UA_VariableAttributes attr2 = UA_VariableAttributes_default;
    UA_Variant_setScalar(&attr2.value, &val2, &UA_TYPES[UA_TYPES_INT32]);
    attr2.displayName = UA_LOCALIZEDTEXT((char*)"en-US", (char*)"Nodo2");
    UA_NodeId id2 = UA_NODEID_STRING(nsIdx, (char*)"Demo.Static.Scalar.Random");
    UA_Server_addVariableNode(server, id2, UA_NODEID_NUMERIC(0, UA_NS0ID_OBJECTSFOLDER),
        UA_NODEID_NUMERIC(0, UA_NS0ID_ORGANIZES),
        UA_QUALIFIEDNAME(nsIdx, (char*)"Nodo2"),
        UA_NODEID_NUMERIC(0, UA_NS0ID_BASEDATAVARIABLETYPE),
        attr2, NULL, NULL);

    // Programar callback periódico para nodo aleatorio
    UA_Server_addRepeatedCallback(server, updateRandomValue, &id2, 2000, NULL);

    // OPC UA en un hilo separado
    std::thread opcua_thread([&server]() {
        printf("Servidor OPC UA ejecutándose en opc.tcp://localhost:4840\n");
        UA_StatusCode status = UA_Server_run(server, &running);
        UA_Server_delete(server);
    });

    // --- Socket TCP ---
    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if(server_fd < 0) {
        std::cerr << "Error creando socket\n";
        running = false;
        opcua_thread.join();
        return 1;
    }
    sockaddr_in address;
    std::memset(&address, 0, sizeof(address));
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(8080);

    if(bind(server_fd, (sockaddr*)&address, sizeof(address)) < 0) {
        std::cerr << "Error en bind\n";
        close(server_fd);
        running = false;
        opcua_thread.join();
        return 1;
    }

    if(listen(server_fd, 3) < 0) {
        std::cerr << "Error en listen\n";
        close(server_fd);
        running = false;
        opcua_thread.join();
        return 1;
    }

    std::cout << "Servidor intermedio escuchando en puerto 8080...\n";

    while(running) {
        sockaddr_in client_addr;
        socklen_t client_len = sizeof(client_addr);
        int client_sock = accept(server_fd, (sockaddr*)&client_addr, &client_len);
        if(client_sock < 0) {
            if (!running) break;
            std::cerr << "Error en accept\n";
            continue;
        }

        char buffer[1024] = {0};
        int bytes = recv(client_sock, buffer, sizeof(buffer)-1, 0);
        if(bytes > 0) {
            // Solo acepta datos binarios CON FIRMA
            if(bytes == sizeof(LecturaBinFirmada)) {
                LecturaBinFirmada* lectura = reinterpret_cast<LecturaBinFirmada*>(buffer);
                // Verificar firma
                if(VerifyMessage(lectura, sizeof(LecturaBin), lectura->firma_r, lectura->firma_s)) {
                    std::cout << "Datos binarios firmados recibidos y validados:\n";
                    std::cout << "sensor_id: " << lectura->sensor_id << "\n";
                    std::cout << "fecha_hora: " << lectura->fecha_hora << "\n";
                    std::cout << "temperatura: " << lectura->temperatura << "\n";
                    std::cout << "presion: " << lectura->presion << "\n";
                    std::cout << "humedad: " << lectura->humedad << "\n";
                    send(client_sock, "OK", 2, 0);
                } else {
                    std::cerr << "Firma inválida, datos rechazados\n";
                    send(client_sock, "FIRMA INVALIDA", 14, 0);
                }
            } else {
                // Rechazar y no responder ni imprimir nada para datos sin firma o de tamaño incorrecto
            }
        }
        close(client_sock);
    }

    close(server_fd);
    opcua_thread.join();
    return 0;
}
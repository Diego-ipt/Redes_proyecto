let tabla;
let chartTemp, chartPresion, chartHumedad;
let ultimoLecturaIdProcesado = null;
const alertasReportadas = new Set();
const alertasVisibles = new Map();
const DURACION_ALERTA_MS = 10000; 

const RANGOS = {
  temperatura: { min: 20.00, max: 29.99 },
  presion: { min: 1000.0, max: 1049.9 },
  humedad: { min: 30.0, max: 99.9 }
};

window.onload = () => {
  inicializarGraficos();
  iniciarClienteConsulta();
};

async function iniciarClienteConsulta() {
  await cargarDatos();
  setInterval(cargarDatos, 1000); // actualiza cada segundo
}

async function cargarDatos() {
  try {
    const ahora = new Date();
    const hace8h = new Date(ahora.getTime() - 8 * 60 * 60 * 1000);
    const fechaStr = hace8h.toISOString().slice(0, 19).replace('T', ' ');

    const response = await fetch(`/lecturas/desde/${fechaStr}`);
    const datos = await response.json();

    actualizarTabla(datos);
    actualizarGraficosDesdeDatos(datos);
    detectarAlertas(datos);
  } catch (error) {
    console.error("Error al obtener datos:", error);
  }
}

function actualizarTabla(datos) {
  const tbody = document.querySelector('#tabla-lecturas tbody');
  tbody.innerHTML = "";

  datos.forEach(lectura => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${lectura.sensor_id}</td>
      <td>${lectura.fecha_hora}</td>
      <td>${lectura.temperatura}</td>
      <td>${lectura.presion}</td>
      <td>${lectura.humedad}</td>
    `;
    tbody.appendChild(fila);
  });

  if (!tabla) {
    tabla = $('#tabla-lecturas').DataTable({
      pageLength: 10,
      lengthChange: false,
      searching: false,
      ordering: true,
      order: [[1, 'desc']],
      language: {
        url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json"
      }
    });
  } else {
    tabla.clear();
    tabla.rows.add($('#tabla-lecturas tbody tr'));
    tabla.draw(false);
  }
}

function crearGrafico(ctx, label, borderColor, bgColor) {
  return new Chart(ctx, {
    type: 'line',
    options: {
      responsive: true,
      animation: {
        duration: 500,
        easing: 'easeOutQuart'
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'second',
            displayFormats: {
              second: 'HH:mm:ss'
            }
          },
          title: { display: true, text: 'Fecha y Hora' },
          ticks: {
            autoSkip: false,
            maxTicksLimit: 10,
            callback: function(value) {
              const date = new Date(value);
              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }
          },
          min: null, // se asigna dinámicamente
          max: null
        }
        ,
        y: {
          beginAtZero: false,
          min: null,
          max: null
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { intersect: true, mode: 'index' }
      }
    },
    data: {
      labels: [],
      datasets: [{
        label,
        data: [],
        borderColor,
        backgroundColor: bgColor,
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointHitRadius: 8
      }]
    }
  });
}

function inicializarGraficos() {
  chartTemp = crearGrafico(
    document.getElementById('chartTemp'),
    'Temperatura (°C)', 'rgb(255, 99, 132)', 'rgba(255, 99, 132, 0.2)'
  );
  chartPresion = crearGrafico(
    document.getElementById('chartPresion'),
    'Presión', 'rgb(54, 162, 235)', 'rgba(54, 162, 235, 0.2)'
  );
  chartHumedad = crearGrafico(
    document.getElementById('chartHumedad'),
    'Humedad (%)', 'rgb(75, 192, 192)', 'rgba(75, 192, 192, 0.2)'
  );
}

function actualizarGraficosDesdeDatos(datos) {
  if (!datos || datos.length === 0) return;

  datos.sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
  const ultimos = datos.slice(-10);
  const fechaInferior = ultimos[0].fecha_hora;
  const fechaSuperior = datos[datos.length - 1].fecha_hora;


  const labels = ultimos.map(d => d.fecha_hora.replace(' ', 'T'));
  const tempData = ultimos.map(d => d.temperatura);
  const presionData = ultimos.map(d => d.presion);
  const humedadData = ultimos.map(d => d.humedad);

  const parseFechas = labels.map(d => new Date(d).getTime());
  const minFecha = Math.min(...parseFechas);
  const maxFecha = Math.max(...parseFechas);


  const formatHora = str => {
  const date = new Date(str.replace(' ', 'T'));
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const intervaloTexto = `Intervalo: ${formatHora(fechaInferior)} – ${formatHora(fechaSuperior)}`;


  document.getElementById('intervalTemp').textContent = intervaloTexto;
  document.getElementById('intervalPresion').textContent = intervaloTexto;
  document.getElementById('intervalHumedad').textContent = intervaloTexto;


  function actualizar(chart, datos, minY, maxY) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = datos;
    chart.options.scales.x.min = minFecha;
    chart.options.scales.x.max = maxFecha;
    chart.options.scales.y.min = minY;
    chart.options.scales.y.max = maxY;
    chart.update();
  }

  actualizar(chartTemp, tempData, RANGOS.temperatura.min, RANGOS.temperatura.max);
  actualizar(chartPresion, presionData, RANGOS.presion.min, RANGOS.presion.max);
  actualizar(chartHumedad, humedadData, RANGOS.humedad.min, RANGOS.humedad.max);
}

function mostrarAlertas(nuevasAlertas) {
  const ahora = Date.now();

  // Agregar nuevas alertas al mapa solo si son recientes
  nuevasAlertas.forEach(alerta => {
    const fechaMs = new Date(alerta.fecha_hora.replace(' ', 'T')).getTime();
    if (ahora - fechaMs <= DURACION_ALERTA_MS) {
      const clave = `${alerta.sensor_id}-${alerta.tipo_alerta_id}`;
      alertasVisibles.set(clave, { ...alerta, timestamp: fechaMs });
    }
  });

  // Eliminar alertas que ya pasaron
  for (const [clave, alerta] of alertasVisibles.entries()) {
    if (ahora - alerta.timestamp > DURACION_ALERTA_MS) {
      alertasVisibles.delete(clave);
    }
  }

  // Mostrar alertas activas
  const panel = document.getElementById('alertas') || crearPanelAlertas();
  const activas = Array.from(alertasVisibles.values());

  if (activas.length === 0) {
    panel.innerHTML = `<h3>Sin alertas</h3>`;
    return;
  }

  panel.innerHTML = `<h3>ALERTAS ACTIVAS</h3>` + activas.map(a => {
    const tempStr = (a.temperatura < RANGOS.temperatura.min || a.temperatura > RANGOS.temperatura.max)
      ? `<span style="color:red; text-decoration: underline;">${a.temperatura}°C</span>`
      : `${a.temperatura}°C`;

    const presStr = (a.presion < RANGOS.presion.min || a.presion > RANGOS.presion.max)
      ? `<span style="color:red; text-decoration: underline;">${a.presion}</span>`
      : `${a.presion}`;

    const humStr = (a.humedad < RANGOS.humedad.min || a.humedad > RANGOS.humedad.max)
      ? `<span style="color:red; text-decoration: underline;">${a.humedad}%</span>`
      : `${a.humedad}%`;

    return `
      <p>
        Sensor ${a.sensor_id} – ${a.fecha_hora}<br>
        Temperatura: ${tempStr} | Presión: ${presStr} | Humedad: ${humStr}
      </p>`;
  }).join('');
}


function crearPanelAlertas() {
  const panel = document.createElement('div');
  panel.id = 'alertas';
  panel.style.background = '#fee';
  panel.style.border = '2px solid red';
  panel.style.padding = '10px';
  panel.style.margin = '20px auto';
  panel.style.width = '80%';
  panel.style.fontFamily = 'Arial';
  document.body.insertBefore(panel, document.body.firstChild);
  return panel;
}

async function detectarAlertas(datos) {
  if (!datos || datos.length === 0) return;

  datos.sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));

  const nuevasLecturas = ultimoLecturaIdProcesado
    ? datos.filter(d => d.lectura_id > ultimoLecturaIdProcesado)
    : datos;

  if (nuevasLecturas.length === 0) return;

  ultimoLecturaIdProcesado = Math.max(...nuevasLecturas.map(d => d.lectura_id));

  const alertas = nuevasLecturas.filter(d =>
    d.temperatura < RANGOS.temperatura.min || d.temperatura > RANGOS.temperatura.max ||
    d.presion < RANGOS.presion.min || d.presion > RANGOS.presion.max ||
    d.humedad < RANGOS.humedad.min || d.humedad > RANGOS.humedad.max
  );

  for (const alerta of alertas) {
    await reportarAlerta(alerta);
  }

  mostrarAlertas(alertas);
}

async function reportarAlerta(alerta) {
  let tipo_alerta_id = null;
  if (alerta.temperatura < RANGOS.temperatura.min) tipo_alerta_id = 1;
  else if (alerta.temperatura > RANGOS.temperatura.max) tipo_alerta_id = 2;
  else if (alerta.presion < RANGOS.presion.min) tipo_alerta_id = 3;
  else if (alerta.presion > RANGOS.presion.max) tipo_alerta_id = 4;
  else if (alerta.humedad < RANGOS.humedad.min) tipo_alerta_id = 5;
  else if (alerta.humedad > RANGOS.humedad.max) tipo_alerta_id = 6;

  const lectura_id = alerta.lectura_id;
  const fecha_generada = alerta.fecha_hora;
  const clave = `${lectura_id}-${tipo_alerta_id}`;

  if (lectura_id && tipo_alerta_id && !alertasReportadas.has(clave)) {
    try {
      await fetch('/alertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lectura_id,
          tipo_alerta_id,
          fecha_generada
        })
      });
      alertasReportadas.add(clave); // marcar como enviada
    } catch (e) {
      console.error('Error reportando alerta:', e);
    }
  }
}


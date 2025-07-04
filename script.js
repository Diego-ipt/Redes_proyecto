let tabla;
let chartTemp, chartPresion, chartHumedad;

const RANGOS = {
  temperatura: { min: 10, max: 37 },
  presion: { min: 950, max: 1100 },
  humedad: { min: 20, max: 85 }
};

// función que inicia el clienteConsulta
async function iniciarClienteConsulta() {
  await cargarDatos();
  setInterval(cargarDatos, 5000);
}

async function cargarDatos() {
  try {
    // Calcula la fecha/hora de hace 8 horas en formato compatible con tu API
    const ahora = new Date();
    const hace8h = new Date(ahora.getTime() - 8 * 60 * 60 * 1000);
    // Formato: YYYY-MM-DDTHH:mm:ss
    const fechaStr = hace8h.toISOString().slice(0,19);

    // Llama al endpoint filtrado
    const response = await fetch(`http://localhost:5000/lecturas/desde/${fechaStr}`);
    const datos = await response.json();

    actualizarTabla(datos);
    actualizarGraficosDesdeTabla();
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
      ordering: false,
      language: { url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json" }, //idioma español
      initComplete: actualizarGraficosDesdeTabla
    });

    tabla.on('draw', actualizarGraficosDesdeTabla);
  } else {
    tabla.clear().rows.add($('#tabla-lecturas tbody tr')).draw();
  }
}

function crearGrafico(ctx, label, borderColor, bgColor) {
  return new Chart(ctx, {
    type: 'line',
    options: {
      responsive: true,
      scales: {
        x: {
          type: 'time',
          time: {
            parser: "yyyy-MM-dd'T'HH:mm:ss",
            tooltipFormat: 'PPpp',
            unit: 'minute',
            displayFormats: { minute: 'HH:mm' }
          },
          title: { display: true, text: 'Fecha y Hora' },
          min: null,
          max: null
        },
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

function actualizarGraficosDesdeTabla() {
  const filas = tabla.rows({ page: 'current' }).data().toArray();

  const labels = filas.map(f => f[1]);
  const tempData = filas.map(f => parseFloat(f[2]));
  const presionData = filas.map(f => parseFloat(f[3]));
  const humedadData = filas.map(f => parseFloat(f[4]));

  const parseFechas = labels.map(d => new Date(d).getTime());
  const minFecha = Math.min(...parseFechas);
  const maxFecha = Math.max(...parseFechas);

  function actualizar(chart, datos, minY, maxY) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = datos;
    chart.options.scales.x.min = minFecha;
    chart.options.scales.x.max = maxFecha;
    chart.options.scales.y.min = minY - 1;
    chart.options.scales.y.max = maxY + 1;
    chart.update();
  }

  actualizar(chartTemp, tempData, Math.min(...tempData), Math.max(...tempData));
  actualizar(chartPresion, presionData, Math.min(...presionData), Math.max(...presionData));
  actualizar(chartHumedad, humedadData, Math.min(...humedadData), Math.max(...humedadData));
}


function mostrarAlertas(alertas) {
  let panel = document.getElementById('alertas');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'alertas';
    panel.style.background = '#fee';
    panel.style.border = '2px solid red';
    panel.style.padding = '10px';
    panel.style.margin = '20px auto';
    panel.style.width = '80%';
    panel.style.fontFamily = 'Arial';
    document.body.insertBefore(panel, document.body.firstChild);
  }

  if (alertas.length === 0) {
    panel.innerHTML = `<h3>Sin alertas</h3>`;
    return;
  }

  panel.innerHTML = `<h3>ALERTAS DETECTADAS!!!</h3>` + alertas.map(a => `
    <p>
      Sensor ${a.sensor_id} – ${a.fecha_hora}<br>
      Temp: ${a.temperatura}°C | Presión: ${a.presion} | Humedad: ${a.humedad}%
    </p>`).join('');
}


async function detectarAlertas(datos) {
  const alertas = datos.filter(d =>
    d.temperatura < RANGOS.temperatura.min || d.temperatura > RANGOS.temperatura.max ||
    d.presion < RANGOS.presion.min || d.presion > RANGOS.presion.max ||
    d.humedad < RANGOS.humedad.min || d.humedad > RANGOS.humedad.max
  );

  // Enviar cada alerta a la API
  for (const alerta of alertas) {
    await reportarAlerta(alerta);
  }

  mostrarAlertas(alertas);
}

// Nueva función para enviar la alerta a la API
async function reportarAlerta(alerta) {
  // Determinar tipo_alerta_id según el tipo de alerta (ajusta según tu lógica)
  let tipo_alerta_id = null;
  if (alerta.temperatura < RANGOS.temperatura.min) tipo_alerta_id = 1; // Bajo el rango
  else if (alerta.temperatura > RANGOS.temperatura.max) tipo_alerta_id = 2; // Sobre el rango
  else if (alerta.presion < RANGOS.presion.min) tipo_alerta_id = 3;
  else if (alerta.presion > RANGOS.presion.max) tipo_alerta_id = 4;
  else if (alerta.humedad < RANGOS.humedad.min) tipo_alerta_id = 5;
  else if (alerta.humedad > RANGOS.humedad.max) tipo_alerta_id = 6;

  // Busca el id de la lectura (puede que necesites ajustarlo si tu API lo retorna con otro nombre)
  const lectura_id = alerta.id || alerta.lectura_id;

  // Fecha de generación de la alerta (puedes usar la fecha de la lectura o la actual)
  const fecha_generada = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Solo reporta si tienes los datos necesarios
  if (lectura_id && tipo_alerta_id) {
    try {
      await fetch('http://localhost:5000/alertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lectura_id,
          tipo_alerta_id,
          fecha_generada
        })
      });
    } catch (e) {
      console.error('Error reportando alerta:', e);
    }
  }
}


window.onload = () => {
  inicializarGraficos();
  iniciarClienteConsulta();
};

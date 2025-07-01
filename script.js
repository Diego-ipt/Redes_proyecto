let tabla;
let chartTemp, chartPresion, chartHumedad;

fetch('prueba.json')
  .then(response => response.json())
  .then(data => {
    const tbody = document.querySelector('#tabla-lecturas tbody');
    data.forEach(lectura => {
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

    $(document).ready(function () {
      tabla = $('#tabla-lecturas').DataTable({
        pageLength: 10,
        lengthChange: false,
        searching: false,
        ordering: false,
        language: { url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json" },
        initComplete: actualizarGraficosDesdeTabla
      });

      tabla.on('draw', actualizarGraficosDesdeTabla);
    });

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
            tooltip: {
              intersect: true,
              mode: 'index'
            }
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

    chartTemp = crearGrafico(
      document.getElementById('chartTemp'),
      'Temperatura (°C)',
      'rgb(255, 99, 132)',
      'rgba(255, 99, 132, 0.2)'
    );

    chartPresion = crearGrafico(
      document.getElementById('chartPresion'),
      'Presión',
      'rgb(54, 162, 235)',
      'rgba(54, 162, 235, 0.2)'
    );

    chartHumedad = crearGrafico(
      document.getElementById('chartHumedad'),
      'Humedad (%)',
      'rgb(75, 192, 192)',
      'rgba(75, 192, 192, 0.2)'
    );
  });

function actualizarGraficosDesdeTabla() {
  const filas = tabla.rows({ page: 'current' }).data().toArray();

  const labels = filas.map(f => f[1]);
  const tempData = filas.map(f => parseFloat(f[2]));
  const presionData = filas.map(f => parseFloat(f[3]));
  const humedadData = filas.map(f => parseFloat(f[4]));

  const parseFechas = labels.map(d => new Date(d).getTime());
  const minFecha = Math.min(...parseFechas);
  const maxFecha = Math.max(...parseFechas);

  function actualizarGrafico(chart, datos, minY, maxY) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = datos;
    chart.options.scales.x.min = minFecha;
    chart.options.scales.x.max = maxFecha;
    chart.options.scales.y.min = minY - 1;
    chart.options.scales.y.max = maxY + 1;
    chart.update();
  }

  actualizarGrafico(chartTemp, tempData, Math.min(...tempData), Math.max(...tempData));
  actualizarGrafico(chartPresion, presionData, Math.min(...presionData), Math.max(...presionData));
  actualizarGrafico(chartHumedad, humedadData, Math.min(...humedadData), Math.max(...humedadData));
}

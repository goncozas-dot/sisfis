const ids = [

 'expediente',

 'empresa',

 'placa',

 'supervisor',

 'antecedentes',

 'analisis',

 'descargos',

 'conclusiones',

 'recomendaciones'

];



let editId = null;



const $ = id => document.getElementById(id);



const form = $('form');

const tieneDescargo = $('tieneDescargo');

const zonaDescargo = $('zonaDescargo');
let contenidoAutogenerado = null;
let descargosAutogenerados = null;
let descargosEditados = false;
let ultimaClaveGeneral = '';

const observacionesDemo = [
 'la señalización de seguridad del vehículo requería actualización',
 'se observó desgaste en un elemento de seguridad de la unidad',
 'no se encontró disponible uno de los documentos de control durante la visita',
 'se recomendó mejorar la identificación visible de los equipos de emergencia',
 'se registró una diferencia en la información consignada para la unidad'
];

const ubicacionesDemo = [
 'la ruta Lima–Huánuco',
 'la vía Huánuco–Tingo María',
 'la carretera Central, en el tramo de Pasco',
 'la ruta Arequipa–Juliaca',
 'la carretera Panamericana Sur'
];

function elegirAleatorio(opciones) {
 return opciones[Math.floor(Math.random() * opciones.length)];
}

function conPuntoFinal(texto) {
 return /[.!?]$/.test(texto) ? texto : `${texto}.`;
}

function generarFechaDemo() {
 const diasAtras = Math.floor(Math.random() * 180);
 const fecha = new Date();
 fecha.setDate(fecha.getDate() - diasAtras);
 return new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: 'long',
  year: 'numeric'
 }).format(fecha);
}

function autocompletarInforme() {
if (editId) {
 return;
}

const expediente = $('expediente').value.trim();
const empresa = $('empresa').value.trim();
if (!expediente || !empresa) {
 return;
}

const placa = $('placa').value.trim();
const supervisor = $('supervisor').value.trim();
const claveGeneral = JSON.stringify([expediente, empresa, placa, supervisor]);
if (claveGeneral === ultimaClaveGeneral) {
 return;
}

const fecha = generarFechaDemo();
const ubicacion = elegirAleatorio(ubicacionesDemo);
const observacion = elegirAleatorio(observacionesDemo);
const unidad = placa ? `unidad de placa ${placa}` : 'unidad vehicular indicada en el formulario';
const responsable = supervisor || 'un supervisor por consignar';
const tieneDescargoGenerado = descargosEditados
 ? tieneDescargo.checked
 : Math.random() < 0.5;
const secciones = {
 antecedentes:
  `2.1 Con fecha ${fecha}, se programó una visita de demostración a la ${unidad}, operada por ${empresa}, en ${ubicacion}.\n` +
  `2.2 La visita corresponde al expediente N.° ${expediente} y queda a cargo de ${responsable}.`,
 analisis:
  `3.1 Para esta demostración, se registró como observación referencial que ${observacion}.\n` +
  `3.2 El análisis se relaciona con la ${unidad} de ${empresa} y el expediente ${expediente}.\n` +
  '3.3 La observación es un dato de ejemplo generado automáticamente y no representa una verificación real.',
 descargos: tieneDescargoGenerado
  ? `Para esta demostración, ${empresa} presentó un descargo de ejemplo relacionado con la observación registrada en el expediente ${expediente}. La evaluación debe revisarse y ajustarse antes de guardar el informe.`
  : '',
 conclusiones:
   `4.1 En el informe de demostración del expediente ${expediente}, se registró una observación referencial para la ${unidad}, operada por ${conPuntoFinal(empresa)}\n` +
  '4.2 La información se generó automáticamente con fines académicos y no determina el cumplimiento real de la empresa.',
 recomendaciones:
  `5.1 Se recomienda revisar y, de ser necesario, corregir la información de la ${unidad}, operada por ${empresa}, antes de guardar el expediente ${expediente}.\n` +
  '5.2 Verifica los datos y reemplaza el contenido de ejemplo antes de utilizar el informe.'
};

Object.entries(secciones).forEach(([id, contenido]) => {
 const campo = $(id);
 const anterior = contenidoAutogenerado && contenidoAutogenerado[id];
 if (!campo.value.trim() || campo.value === anterior) {
  campo.value = contenido;
  secciones[id] = contenido;
 } else {
  delete secciones[id];
 }
});

if (descargosAutogenerados === null || !descargosEditados) {
 tieneDescargo.checked = tieneDescargoGenerado;
 descargosAutogenerados = tieneDescargoGenerado;
}
zonaDescargo.hidden = !tieneDescargo.checked;
contenidoAutogenerado = {
 ...(contenidoAutogenerado || {}),
 ...secciones
};
ultimaClaveGeneral = claveGeneral;
vista(datos());
$('estadoAutocompletado').textContent =
 'Las secciones del informe se completaron automáticamente con los datos generales. Revisa y edita el contenido antes de guardar.';
}

tieneDescargo.addEventListener('change', () => {

 zonaDescargo.hidden = !tieneDescargo.checked;
 descargosEditados = true;

});

['expediente', 'empresa', 'placa', 'supervisor'].forEach(id => {
 $(id).addEventListener('change', autocompletarInforme);
});

form.addEventListener('reset', () => {
 editId = null;
 contenidoAutogenerado = null;
 descargosAutogenerados = null;
 descargosEditados = false;
 ultimaClaveGeneral = '';
 window.setTimeout(() => {
  zonaDescargo.hidden = !tieneDescargo.checked;
  $('estadoAutocompletado').textContent =
   'Ingresa el expediente y la empresa para completar automáticamente las demás secciones.';
 }, 0);
});



// Obtener los datos del formulario

function datos() {

 const x = {};



 ids.forEach(id => {

  const campo = $(id);



  if (!campo) {

   throw new Error(

    'Falta el campo "' + id + '" en index.html'

   );

  }



  x[id] = campo.value.trim();

 });



 x.tieneDescargo = tieneDescargo.checked;



 return x;

}



// Cargar informe para editar

function cargar(x) {

 contenidoAutogenerado = null;
 descargosAutogenerados = null;
 descargosEditados = false;
 ultimaClaveGeneral = '';

 ids.forEach(id => {

  $(id).value = x[id] || '';

 });



 tieneDescargo.checked = !!x.tieneDescargo;

 zonaDescargo.hidden = !x.tieneDescargo;



 editId = x.id;



 vista(x);



 window.scrollTo({

  top: 0,

  behavior: 'smooth'

 });

}



// Numerar párrafos

function numerar(texto) {

 return (texto || 'Sin información')

  .split('\n')

  .filter(linea => linea.trim())

  .map((linea, i) => `${i + 1}. ${linea}`)

  .join('\n');

}



// Vista previa del informe

function vista(x) {

 let n = 1;



 const seccion = (titulo, contenido) => {

  return `${n++}. ${titulo}\n` +

   `${numerar(contenido)}\n\n`;

 };



 $('vista').textContent =

  'INFORME DE FISCALIZACIÓN\n\n' +

  `Expediente: ${x.expediente}\n` +

  `Empresa: ${x.empresa}\n` +

  `Placa: ${x.placa || '-'}\n` +

  `Supervisor: ${x.supervisor || '-'}\n\n` +

  seccion('ANTECEDENTES', x.antecedentes) +

  seccion('ANÁLISIS', x.analisis) +

  (x.tieneDescargo

   ? seccion('ANÁLISIS DE DESCARGOS', x.descargos)

   : '') +

  seccion('CONCLUSIONES', x.conclusiones) +

  seccion('RECOMENDACIONES', x.recomendaciones);
}

async function generarImagenConsulta(x) {
 const imagenBase = new Image();
 imagenBase.src = '/img/registro-hidrocarburos.jpg';
 await imagenBase.decode();

 const lienzo = document.createElement('canvas');
 lienzo.width = 808;
 const contexto = lienzo.getContext('2d');
 if (!contexto) {
  throw new Error('No se pudo preparar la ficha visual de la consulta');
 }

 const campos = [
  ['Expediente', x.expediente],
  ['Razón Social', x.empresa],
  ['Supervisor', x.supervisor || 'No consignado'],
  ['Placa Principal', x.placa || 'No consignada'],
  ['Antecedentes', x.antecedentes],
  ['Análisis de Fiscalización', x.analisis],
  ['Descargos', x.tieneDescargo ? x.descargos : 'No presentó descargos'],
  ['Conclusiones', x.conclusiones],
  ['Recomendaciones', x.recomendaciones]
 ];
 const margenEtiqueta = 77;
 const margenValor = 226;
 const anchoValor = 540;
 const altoLinea = 15;
 const filas = [];
 let alturaContenido = 70;

 contexto.font = '12px Arial';
 campos.forEach(([etiqueta, valor]) => {
  const palabras = String(valor || 'Sin información').trim().split(/\s+/);
  const lineas = [];
  let linea = '';

  palabras.forEach(palabra => {
   const candidata = linea ? `${linea} ${palabra}` : palabra;
   if (linea && contexto.measureText(candidata).width > anchoValor) {
    lineas.push(linea);
    linea = palabra;
   } else {
    linea = candidata;
   }
  });
  if (linea) lineas.push(linea);

  filas.push({ etiqueta, lineas });
  alturaContenido += Math.max(1, lineas.length) * altoLinea + 5;
 });

 if (alturaContenido > 2400) {
  throw new Error('El texto del formulario es demasiado extenso para la ficha visual de consulta');
 }

 lienzo.height = Math.max(344, alturaContenido + 10);
 contexto.drawImage(imagenBase, 0, 0, lienzo.width, 344);
 contexto.fillStyle = '#e9e9e9';
 contexto.fillRect(40, 40, 741, lienzo.height - 51);
 contexto.strokeStyle = '#07528f';
 contexto.lineWidth = 6;
 contexto.strokeRect(35, 40, 750, lienzo.height - 50);
 contexto.fillStyle = '#07528f';
 contexto.fillRect(41, 42, 738, 13);
 contexto.font = 'bold 11px Arial';
 contexto.fillStyle = '#ffffff';
 contexto.fillText('Datos del Transporte de Combustibles Líquidos', 44, 52);

 let y = 71;
 filas.forEach(({ etiqueta, lineas }) => {
  contexto.font = '12px Arial';
  contexto.fillStyle = '#5c7893';
  contexto.fillText(`${etiqueta}:`, margenEtiqueta, y);
  contexto.font = 'bold 12px Arial';
  contexto.fillStyle = '#164f7e';
  lineas.forEach((texto, indice) => {
   contexto.fillText(texto, margenValor, y + indice * altoLinea);
  });
  y += Math.max(1, lineas.length) * altoLinea + 5;
 });

 return lienzo.toDataURL('image/png');
}

async function generarWord(x) {
 const consultaImagen = await generarImagenConsulta(x);
 const respuesta = await fetch('/api/informes/word', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...x, consultaImagen })
 });

 if (!respuesta.ok) {
  const tipoContenido = respuesta.headers.get('content-type') || '';

  if (!tipoContenido.includes('application/json')) {
   throw new Error(
    respuesta.status === 404
     ? 'El servidor está ejecutando una versión anterior. Detén node server.js con Ctrl+C y vuelve a iniciarlo.'
     : `El servidor no pudo generar el Word (HTTP ${respuesta.status}).`
   );
  }

  const resultado = await respuesta.json();
  throw new Error(resultado.error || 'No se pudo generar el documento Word');
 }

 const blob = await respuesta.blob();
 const url = URL.createObjectURL(blob);
 const enlace = document.createElement('a');
 const expediente = (x.expediente || 'informe')
  .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');

 enlace.href = url;
 enlace.download = `Informe_${expediente}.docx`;
 document.body.appendChild(enlace);
 enlace.click();
 enlace.remove();
 window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Listar informes registrados
async function listar() {

 try {

  const respuesta = await fetch('/api/informes');



  if (!respuesta.ok) {

   throw new Error('No se pudo obtener la lista');

  }



  const informes = await respuesta.json();

  const lista = $('lista');



  lista.replaceChildren();



  if (informes.length === 0) {

   lista.textContent = 'No hay informes registrados.';

   return;

  }



  informes.forEach(x => {

   const p = document.createElement('p');



   const nombre = document.createElement('span');

   nombre.textContent =

    `${x.expediente} - ${x.empresa} `;



   const editar = document.createElement('button');

   editar.textContent = 'Editar';

   editar.className = 'btn-editar';
   editar.onclick = () => cargar(x);

   const word = document.createElement('button');
   word.textContent = 'Generar Word';
   word.className = 'btn-primary';
   word.onclick = async () => {
    try {
     await generarWord(x);
    } catch (error) {
     console.error('Error al generar Word:', error);
     alert('Error al generar Word: ' + error.message);
    }
   };

   const eliminar = document.createElement('button');

   eliminar.textContent = 'Eliminar';

   eliminar.className = 'btn-eliminar';



   eliminar.onclick = async () => {

    if (!confirm('¿Desea eliminar este informe?')) {

     return;

    }



    try {

     const r = await fetch(

      '/api/informes/' + encodeURIComponent(x.id),

      { method: 'DELETE' }

     );



     if (!r.ok) {

      throw new Error('No se pudo eliminar');

     }



     await listar();



    } catch (error) {

     alert(error.message);

    }

   };



   p.append(nombre, editar, word, eliminar);

   lista.appendChild(p);

  });



 } catch (error) {

  console.error(error);

  alert('Error al listar informes: ' + error.message);

 }

}



// Guardar o actualizar informe

form.addEventListener('submit', async ev => {

 ev.preventDefault();



 try {

  const x = datos();



  if (!x.expediente) {

   alert('Ingrese el número de expediente');

   $('expediente').focus();

   return;

  }



  if (!x.empresa) {

   alert('Ingrese el nombre de la empresa');

   $('empresa').focus();

   return;

  }



  const url = '/api/informes' +

   (editId ? '/' + encodeURIComponent(editId) : '');



  const metodo = editId ? 'PUT' : 'POST';



  const respuesta = await fetch(url, {

   method: metodo,

   headers: {

    'Content-Type': 'application/json'

   },

   body: JSON.stringify(x)

  });



  const resultado = await respuesta.json();



  if (!respuesta.ok) {

   throw new Error(

    resultado.error || 'No se pudo guardar'

   );

  }



  vista(resultado);



  editId = null;

  form.reset();

  zonaDescargo.hidden = true;



  await listar();



  alert('Informe guardado correctamente');



 } catch (error) {

  console.error('Error al guardar:', error);

  alert('Error: ' + error.message);

 }

});



// Cargar informes al iniciar

listar();
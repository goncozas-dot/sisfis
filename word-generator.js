const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const plantilla = path.join(
  __dirname,
  'templates',
  'informe-supervision.docx'
);

function decodificarXml(texto) {
  return texto.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entidad, valor) => {
    if (valor[0] === '#') {
      const codigo = valor[1].toLowerCase() === 'x'
        ? parseInt(valor.slice(2), 16)
        : parseInt(valor.slice(1), 10);
      return String.fromCodePoint(codigo);
    }

    return {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: '\''
    }[valor.toLowerCase()];
  });
}

function codificarXml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function identificadorXml() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function obtenerNodosTexto(parrafo) {
  return [...parrafo.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map(coincidencia => ({
      inicio: coincidencia.index,
      fin: coincidencia.index + coincidencia[0].length,
      apertura: coincidencia[0].slice(0, coincidencia[0].indexOf('>') + 1),
      texto: decodificarXml(coincidencia[1])
    }));
}

function textoParrafo(parrafo) {
  return obtenerNodosTexto(parrafo)
    .map(nodo => nodo.texto)
    .join('');
}

function sustituirTexto(parrafo, anterior, nuevo) {
  if (!anterior) return parrafo;

  const nodos = obtenerNodosTexto(parrafo);
  const partes = nodos.map(nodo => nodo.texto);
  let texto = partes.join('');
  let buscarDesde = 0;
  let indice;

  while ((indice = texto.indexOf(anterior, buscarDesde)) !== -1) {
    const fin = indice + anterior.length;
    let inicioNodo = -1;
    let finNodo = 0;
    let inicioLocal = 0;
    let finLocal = 0;
    let desplazamiento = 0;

    for (let i = 0; i < partes.length; i++) {
      const siguiente = desplazamiento + partes[i].length;
      if (indice >= desplazamiento && indice < siguiente) {
        inicioNodo = i;
        inicioLocal = indice - desplazamiento;
      }
      if (fin > desplazamiento && fin <= siguiente) {
        finNodo = i;
        finLocal = fin - desplazamiento;
        break;
      }
      desplazamiento = siguiente;
    }

    if (inicioNodo < 0) {
      break;
    }

    if (inicioNodo === finNodo) {
      partes[inicioNodo] = partes[inicioNodo].slice(0, inicioLocal) +
        nuevo + partes[inicioNodo].slice(finLocal);
    } else {
      partes[inicioNodo] = partes[inicioNodo].slice(0, inicioLocal) + nuevo;
      for (let i = inicioNodo + 1; i < finNodo; i++) partes[i] = '';
      partes[finNodo] = partes[finNodo].slice(finLocal);
    }

    texto = partes.join('');
    buscarDesde = indice + nuevo.length;
  }

  let nodoActual = 0;
  return parrafo.replace(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/g, () => {
    const nodo = nodos[nodoActual];
    return `${nodo.apertura}${codificarXml(partes[nodoActual++])}</w:t>`;
  });
}

function sustituirTextoParrafoCompleto(parrafo, texto) {
  const nodos = obtenerNodosTexto(parrafo);
  if (!nodos.length) {
    throw new Error('No se puede actualizar un párrafo sin contenido de texto');
  }

  let nodoActual = 0;
  const actualizado = parrafo.replace(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/g, () => {
    const nodo = nodos[nodoActual];
    const nuevoTexto = nodoActual === 0 ? texto : '';
    nodoActual++;
    return `${nodo.apertura}${codificarXml(nuevoTexto)}</w:t>`;
  });

  return actualizado
    .replace(/\bw14:paraId="[^"]+"/, `w14:paraId="${identificadorXml()}"`)
    .replace(/\bw14:textId="[^"]+"/, `w14:textId="${identificadorXml()}"`);
}

function reemplazarEnParrafos(xml, reemplazos) {
  return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, parrafo => {
    for (const [anterior, nuevo] of reemplazos) {
      parrafo = sustituirTexto(parrafo, anterior, nuevo);
    }
    return parrafo;
  });
}

function reemplazarParrafo(xml, marcador, contenido) {
  const parrafos = [...xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)];
  const objetivo = parrafos.find(parrafo =>
    textoParrafo(parrafo[0]).includes(marcador)
  );

  if (!objetivo) {
    throw new Error(`No se encontró el texto "${marcador}" en el Word modelo`);
  }

  const actualizado = sustituirTextoParrafoCompleto(objetivo[0], contenido);
  return xml.slice(0, objetivo.index) +
    actualizado +
    xml.slice(objetivo.index + objetivo[0].length);
}

function actualizarConsultaEnLinea(xml, relationshipId, imageWidth, imageHeight) {
  const tablas = [...xml.matchAll(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g)];
  const coincidencia = tablas.find(tabla =>
    textoParrafo(tabla[0]).includes('Consulta del Registro de Hidrocarburos de fecha')
  );

  if (!coincidencia) {
    throw new Error('No se encontró el recuadro de consulta en línea del Word modelo');
  }

  const filas = [...coincidencia[0].matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)];
  if (filas.length < 2) {
    throw new Error('El recuadro de consulta en línea del Word modelo está incompleto');
  }

  const celdas = [...filas[0][0].matchAll(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g)];
  if (celdas.length !== 1 || !/<w:drawing\b/.test(celdas[0][0])) {
    throw new Error('No se encontró la imagen de consulta en línea para reemplazar');
  }

  const dibujo = celdas[0][0].replace(/<w:drawing\b[^>]*>[\s\S]*?<\/w:drawing>/, dibujo => {
    if (!/<a:blip\b[^>]*\br:embed="[^"]+"/.test(dibujo)) {
      throw new Error('No se encontró la imagen de consulta en línea para actualizar');
    }

    const ancho = /<wp:extent\b[^>]*\bcx="(\d+)"/.exec(dibujo);
    if (!ancho) {
      throw new Error('No se pudo determinar el tamaño original de la imagen de consulta');
    }
    const alto = Math.round(Number(ancho[1]) * imageHeight / imageWidth);

    return dibujo
      .replace(/(<a:blip\b[^>]*\br:embed=")[^"]+(")/, `$1${relationshipId}$2`)
      .replace(/(<wp:extent\b[^>]*\bcy=")\d+(")/, `$1${alto}$2`)
      .replace(/(<a:ext\b[^>]*\bcy=")\d+(")/, `$1${alto}$2`);
  });
  const fila = filas[0][0].replace(celdas[0][0], dibujo);
  let tablaActualizada = coincidencia[0].replace(filas[0][0], fila);
  const pie = [...tablaActualizada.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)]
    .find(parrafo =>
      textoParrafo(parrafo[0]).includes('Consulta del Registro de Hidrocarburos de fecha')
    );

  if (!pie) {
    throw new Error('No se encontró la leyenda de la consulta en línea');
  }

  tablaActualizada = tablaActualizada.slice(0, pie.index) +
    sustituirTextoParrafoCompleto(
      pie[0],
      'Representación visual generada con los datos del formulario.'
    ) +
    tablaActualizada.slice(pie.index + pie[0].length);

  return xml.slice(0, coincidencia.index) +
    tablaActualizada +
    xml.slice(coincidencia.index + coincidencia[0].length);
}

function lineasDe(texto, quitarNumeracion = false) {
  const lineas = String(texto || '')
    .split(/\r?\n/)
    .map(linea => linea.trim())
    .filter(Boolean);

  const resultado = quitarNumeracion
    ? lineas.map(linea => linea.replace(/^\d+(?:\.\d+)*\.?\s*/, ''))
      .filter(Boolean)
    : lineas;

  return resultado.length ? resultado : ['Sin información'];
}

function reemplazarSecuencia(
  xml,
  marcadorInicio,
  marcadorFin,
  contenido,
  incluirInicio,
  quitarNumeracion = false
) {
  const parrafos = [...xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)]
    .map(coincidencia => ({
      xml: coincidencia[0],
      inicio: coincidencia.index,
      fin: coincidencia.index + coincidencia[0].length,
      texto: textoParrafo(coincidencia[0])
    }));
  const indiceInicio = parrafos.findIndex(parrafo =>
    parrafo.texto.includes(marcadorInicio)
  );
  const indiceFin = parrafos.findIndex((parrafo, indice) =>
    indice > indiceInicio && parrafo.texto.includes(marcadorFin)
  );

  if (indiceInicio < 0 || indiceFin < 0) {
    throw new Error(`No se encontró la sección "${marcadorInicio}" en el Word modelo`);
  }

  const primero = indiceInicio + (incluirInicio ? 0 : 1);
  const objetivos = parrafos
    .slice(primero, indiceFin)
    .filter(parrafo => parrafo.texto.trim());

  if (!objetivos.length) {
    throw new Error(`La sección "${marcadorInicio}" no tiene párrafos editables`);
  }

  const lineas = lineasDe(contenido, quitarNumeracion);
  const muestra = objetivos[0].xml;
  const ediciones = [];

  objetivos.forEach((parrafo, indice) => {
    ediciones.push({
      inicio: parrafo.inicio,
      fin: parrafo.fin,
      texto: indice < lineas.length
        ? sustituirTextoParrafoCompleto(parrafo.xml, lineas[indice])
        : ''
    });
  });

  if (lineas.length > objetivos.length) {
    const textoAdicional = lineas
      .slice(objetivos.length)
      .map(linea => sustituirTextoParrafoCompleto(muestra, linea))
      .join('');
    ediciones.push({
      inicio: objetivos[objetivos.length - 1].fin,
      fin: objetivos[objetivos.length - 1].fin,
      texto: textoAdicional
    });
  }

  ediciones.sort((a, b) => b.inicio - a.inicio);
  for (const edicion of ediciones) {
    xml = xml.slice(0, edicion.inicio) + edicion.texto + xml.slice(edicion.fin);
  }

  return xml;
}

function actualizarCampoMerge(xml, campo, valor) {
  return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, parrafo => {
    if (!new RegExp(`MERGEFIELD\\s+${campo}\\b`, 'i').test(parrafo)) {
      return parrafo;
    }

    return parrafo.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, run => {
      if (/<w:(?:fldChar|instrText)\b/.test(run)) return '';
      if (textoParrafo(run).includes(`«${campo}»`)) {
        return sustituirTexto(run, `«${campo}»`, valor);
      }
      return run;
    });
  });
}

function actualizarCelda(celda, contenido) {
  const parrafos = [...celda.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)];
  if (!parrafos.length) {
    throw new Error('La fila del cuadro de análisis no tiene una celda válida');
  }

  const lineas = contenido ? lineasDe(contenido) : [''];
  const muestra = parrafos[0][0];
  const nuevos = lineas.map((linea, indice) =>
    sustituirTextoParrafoCompleto(indice < parrafos.length ? parrafos[indice][0] : muestra, linea)
  );
  const inicio = parrafos[0].index;
  const fin = parrafos[parrafos.length - 1].index + parrafos[parrafos.length - 1][0].length;

  return celda.slice(0, inicio) + nuevos.join('') + celda.slice(fin);
}

function actualizarFila(fila, titulo, analisis) {
  fila = fila.replace(/(<w:tr\b[^>]*\bw14:paraId=")[^"]+(")/, (_, antes, despues) =>
    `${antes}${identificadorXml()}${despues}`
  );
  const celdas = [...fila.matchAll(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g)];
  if (celdas.length !== 4) {
    throw new Error('La tabla del Word modelo no tiene las cuatro columnas esperadas');
  }

  const valores = [titulo, '', analisis, ''];
  let resultado = fila;

  celdas.slice().reverse().forEach((coincidencia, orden) => {
    const indice = celdas.length - 1 - orden;
    const actualizada = actualizarCelda(coincidencia[0], valores[indice]);
    resultado = resultado.slice(0, coincidencia.index) +
      actualizada +
      resultado.slice(coincidencia.index + coincidencia[0].length);
  });

  return resultado;
}

function configurarPaginacionFila(fila, repetirEncabezado = false) {
  const propiedades = /<w:trPr\b[^>]*>[\s\S]*?<\/w:trPr>/.exec(fila);
  const ajustes = `${repetirEncabezado ? '<w:tblHeader w:val="true"/>' : ''}<w:cantSplit/>`;

  if (propiedades) {
    let contenido = propiedades[0]
      .replace(/<w:tblHeader\b[^>]*\/>/g, '')
      .replace(/<w:cantSplit\b[^>]*\/>/g, '');
    contenido = contenido.replace('</w:trPr>', `${ajustes}</w:trPr>`);
    return fila.replace(propiedades[0], contenido);
  }

  return fila.replace(/(<w:tr\b[^>]*>)/, `$1<w:trPr>${ajustes}</w:trPr>`);
}

function configurarParrafoMantenerConSiguiente(parrafo, mantener, saltoAntes = false) {
  const propiedades = /<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/.exec(parrafo);
  if (!mantener && !saltoAntes) {
    return propiedades
      ? parrafo.replace(
        propiedades[0],
        propiedades[0]
          .replace(/<w:keepNext\b[^>]*\/>/g, '')
          .replace(/<w:pageBreakBefore\b[^>]*\/>/g, '')
      )
      : parrafo;
  }

  if (propiedades) {
    const contenido = propiedades[0]
      .replace(/<w:keepNext\b[^>]*\/>/g, '')
      .replace(/<w:pageBreakBefore\b[^>]*\/>/g, '');
    const estilo = /<w:pStyle\b[^>]*\/>/.exec(contenido);
    const posicion = estilo
      ? estilo.index + estilo[0].length
      : contenido.indexOf('>') + 1;
    const propiedadesPaginacion = `${mantener ? '<w:keepNext w:val="true"/>' : ''}` +
      `${saltoAntes ? '<w:pageBreakBefore/>' : ''}`;
    const actualizado = contenido.slice(0, posicion) +
      propiedadesPaginacion +
      contenido.slice(posicion);
    return parrafo.replace(propiedades[0], actualizado);
  }

  const propiedadesPaginacion = `${mantener ? '<w:keepNext w:val="true"/>' : ''}` +
    `${saltoAntes ? '<w:pageBreakBefore/>' : ''}`;
  return parrafo.replace(
    /(<w:p\b[^>]*>)/,
    `$1<w:pPr>${propiedadesPaginacion}</w:pPr>`
  );
}

function mantenerTablaEnUnaPagina(xml, tabla) {
  const parrafos = [...tabla.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)];
  if (!parrafos.length) return xml;

  let tablaActualizada = tabla;
  for (let i = parrafos.length - 1; i >= 0; i--) {
    const parrafo = parrafos[i][0];
    const actualizado = configurarParrafoMantenerConSiguiente(
      parrafo,
      i < parrafos.length - 1
    );
    tablaActualizada = tablaActualizada.slice(0, parrafos[i].index) +
      actualizado +
      tablaActualizada.slice(parrafos[i].index + parrafo.length);
  }

  const inicioOriginal = xml.indexOf(tabla);
  xml = xml.slice(0, inicioOriginal) +
    tablaActualizada +
    xml.slice(inicioOriginal + tabla.length);

  const inicioTabla = xml.indexOf(tablaActualizada);
  const parrafosAnteriores = [
    ...xml.slice(0, inicioTabla).matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)
  ];
  const indiceRotulo = parrafosAnteriores
    .map(parrafo => textoParrafo(parrafo[0]).includes('Hechos Constatados'))
    .lastIndexOf(true);
  const indiceIntroduccion = indiceRotulo - 1;
  const indiceTitulo = indiceIntroduccion - 1;

  if (indiceTitulo < 0 ||
    !textoParrafo(parrafosAnteriores[indiceTitulo][0]).includes('DE LA VISITA DE FISCALIZACIÓN') ||
    indiceIntroduccion < 0) {
    throw new Error('No se encontró el encabezado de la sección de visita antes de la tabla');
  }

  const ediciones = [
    {
      parrafo: parrafosAnteriores[indiceTitulo],
      mantener: true,
      salto: true
    },
    {
      parrafo: parrafosAnteriores[indiceIntroduccion],
      mantener: true,
      salto: false
    },
    {
      parrafo: parrafosAnteriores[indiceRotulo],
      mantener: true,
      salto: false
    }
  ];

  ediciones.sort((a, b) => b.parrafo.index - a.parrafo.index);
  for (const edicion of ediciones) {
    const actualizado = configurarParrafoMantenerConSiguiente(
      edicion.parrafo[0],
      edicion.mantener,
      edicion.salto
    );
    xml = xml.slice(0, edicion.parrafo.index) +
      actualizado +
      xml.slice(edicion.parrafo.index + edicion.parrafo[0].length);
  }

  return xml;
}

function actualizarTablaAnalisis(xml, analisis, tieneDescargo, descargos) {
  const tablas = [...xml.matchAll(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g)];
  const coincidencia = tablas.find(tabla =>
    textoParrafo(tabla[0]).includes('INCUMPLIMIENTO NORMATIVO')
  );

  if (!coincidencia) {
    throw new Error('No se encontró la tabla de análisis del Word modelo');
  }

  const filas = [...coincidencia[0].matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)];
  if (filas.length < 2) {
    throw new Error('La tabla de análisis del Word modelo está incompleta');
  }

  const filasNuevas = [
    actualizarFila(filas[1][0], 'ANÁLISIS', analisis)
  ];
  if (tieneDescargo) {
    filasNuevas.push(actualizarFila(filas[1][0], 'DESCARGOS', descargos));
  }

  const filasActualizadas = [
    configurarPaginacionFila(filas[0][0], true),
    ...filasNuevas.map(fila => configurarPaginacionFila(fila))
  ];
  const inicio = filas[1].index;
  const fin = filas[filas.length - 1].index + filas[filas.length - 1][0].length;
  const tablaActualizada = coincidencia[0].slice(0, inicio) +
    filasActualizadas.slice(1).join('') +
    coincidencia[0].slice(fin);
  const tablaConEncabezado = tablaActualizada.replace(
    filas[0][0],
    filasActualizadas[0]
  );

  const resultado = xml.slice(0, coincidencia.index) +
    tablaConEncabezado +
    xml.slice(coincidencia.index + coincidencia[0].length);
  return mantenerTablaEnUnaPagina(resultado, tablaConEncabezado);
}

function fechaDelInforme() {
  const partes = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).formatToParts(new Date());
  const valores = Object.fromEntries(partes.map(parte => [parte.type, parte.value]));
  const mes = valores.month.charAt(0).toUpperCase() + valores.month.slice(1);
  return `${valores.day} de ${mes} de ${valores.year}`;
}

function leerImagenConsulta(dataUrl) {
  const coincidencia = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    String(dataUrl || '')
  );
  if (!coincidencia) {
    throw new Error('No se recibió la ficha visual de consulta en formato PNG');
  }

  const imagen = Buffer.from(coincidencia[1], 'base64');
  if (
    imagen.length < 24 ||
    imagen.length > 4 * 1024 * 1024 ||
    imagen.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
  ) {
    throw new Error('La ficha visual de consulta no es una imagen PNG válida');
  }

  const imageWidth = imagen.readUInt32BE(16);
  const imageHeight = imagen.readUInt32BE(20);
  if (!imageWidth || !imageHeight || imageWidth > 4096 || imageHeight > 2400) {
    throw new Error('Las dimensiones de la ficha visual de consulta no son válidas');
  }

  return { imagen, imageWidth, imageHeight };
}

function generarDocumentoWord(informe) {
  if (!fs.existsSync(plantilla)) {
    throw new Error('No se encontró el documento Word modelo en la carpeta templates');
  }

  const consulta = leerImagenConsulta(informe.consultaImagen);
  const archivo = new AdmZip(plantilla);
  const entrada = archivo.getEntry('word/document.xml');
  const relacionesEntrada = archivo.getEntry('word/_rels/document.xml.rels');
  const tiposEntrada = archivo.getEntry('[Content_Types].xml');
  if (!entrada) {
    throw new Error('El documento Word modelo no contiene su documento principal');
  }
  if (!relacionesEntrada || !tiposEntrada) {
    throw new Error('El documento Word modelo no contiene sus relaciones o tipos de contenido');
  }

  let xml = entrada.getData().toString('utf8');
  let relaciones = relacionesEntrada.getData().toString('utf8');
  let tiposContenido = tiposEntrada.getData().toString('utf8');
  let indiceRelacion = 1;
  while (new RegExp(`\\bId="rId${indiceRelacion}"`).test(relaciones)) {
    indiceRelacion++;
  }
  const relationshipId = `rId${indiceRelacion}`;
  relaciones = relaciones.replace(
    '</Relationships>',
    `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/consulta-dinamica.png"/></Relationships>`
  );

  if (!/<Default\b[^>]*\bExtension="png"/i.test(tiposContenido)) {
    tiposContenido = tiposContenido.replace(
      '</Types>',
      '<Default Extension="png" ContentType="image/png"/></Types>'
    );
  }

  const empresa = informe.empresa.trim();
  const placa = String(informe.placa || '').trim() || 'No consignada';
  const supervisor = String(informe.supervisor || '').trim() || 'No consignado';
  const reemplazos = [
    ['TRANSPORTES MODELO DEMOSTRATIVO S.A.C.', empresa],
    ['Carlos Ejemplo Rivera', supervisor],
    ['ABC-000', placa],
    ['XYZ-000', 'No consignada'],
    ['202600000000', informe.expediente.trim()],
    ['00000-060-000000', 'No consignado'],
    ['0000000-0', 'No consignado'],
    ['20000000001', 'No consignado'],
    ['03 de Noviembre de 2026', fechaDelInforme()]
  ];

  xml = actualizarCampoMerge(xml, 'osinumero', informe.expediente.trim());
  xml = reemplazarEnParrafos(xml, reemplazos);
  xml = actualizarConsultaEnLinea(
    xml,
    relationshipId,
    consulta.imageWidth,
    consulta.imageHeight
  );
  xml = reemplazarParrafo(
    xml,
    'IMAGEN N° 01 CONSULTA EN LÍNEA DEL REGISTRO DE HIDROCARBUROS',
    'CONSULTA EN LÍNEA DEL REGISTRO DE HIDROCARBUROS'
  );
  xml = reemplazarSecuencia(
    xml,
    'ANTECEDENTES:',
    'BASE LEGAL:',
    informe.antecedentes,
    false,
    true
  );
  xml = reemplazarSecuencia(
    xml,
    'NO CUMPLIÓ',
    'RECOMENDACIONES:',
    informe.conclusiones,
    true,
    true
  );
  xml = reemplazarSecuencia(
    xml,
    'Comunicar a',
    'Atentamente.',
    informe.recomendaciones,
    true,
    true
  );

  xml = reemplazarEnParrafos(xml, [
    [
      'El objetivo de la presente visita de fiscalización es de verificar el cumplimiento de las obligaciones relativas a las condiciones de seguridad del MEDIO DE TRANSPORTE DE COMBUSTIBLE LIQUIDOS Y OPDH de placa de rodaje principal Nº',
      'El objetivo de la presente visita de fiscalización es verificar las condiciones de seguridad del medio de transporte de combustibles líquidos y OPDH de placa principal Nº'
    ]
  ]);
  xml = reemplazarParrafo(
    xml,
    'El medio de transporte terrestre de combustibles líquidos y OPDH, operado por',
    `El medio de transporte terrestre de combustibles líquidos y OPDH, de placa principal ${placa}, operado por ${empresa}; cuenta con la información consignada en el formulario.`
  );

  xml = reemplazarSecuencia(
    xml,
    'La fiscalización realizada al medio de transporte terrestre',
    'DE LA VISITA DE FISCALIZACIÓN',
    `La fiscalización se realizó al medio de transporte de placa ${placa}, operado por ${empresa}, de acuerdo con la información consignada en el formulario.`,
    true
  );
  xml = reemplazarSecuencia(
    xml,
    'Con fecha 24 de septiembre de 2026, siendo las 10:16 horas',
    'TABLA Nº 01',
    `Durante la visita de fiscalización a la unidad de placa ${placa}, operada por ${empresa}, se registró la siguiente información del expediente ${informe.expediente.trim()}:`,
    true
  );
  xml = reemplazarSecuencia(
    xml,
    'Culminada la fiscalización, se suscribió',
    'ANEXO:',
    `El informe corresponde al expediente ${informe.expediente.trim()} y a la unidad de placa ${placa}, operada por ${empresa}.`,
    true
  );

  xml = actualizarTablaAnalisis(
    xml,
    informe.analisis,
    Boolean(informe.tieneDescargo),
    informe.descargos
  );

  archivo.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
  archivo.updateFile(
    'word/_rels/document.xml.rels',
    Buffer.from(relaciones, 'utf8')
  );
  archivo.updateFile('[Content_Types].xml', Buffer.from(tiposContenido, 'utf8'));
  archivo.addFile('word/media/consulta-dinamica.png', consulta.imagen);
  return archivo.toBuffer();
}

module.exports = { generarDocumentoWord };

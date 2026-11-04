# SISFIS_LUIS

Aplicación web académica para registrar y administrar informes de fiscalización y generar informes en formato Word a partir de una plantilla.

> **Aviso:** este proyecto es educativo y usa datos ficticios. No lo utilices para almacenar información real, confidencial o personal ni lo publiques en Internet: no incluye autenticación ni controles para un entorno de producción.

## Descargar y ejecutar en Windows

1. En GitHub, descarga el proyecto con **Code > Download ZIP** y extrae el contenido.
2. Instala [Node.js](https://nodejs.org/) 18 o posterior una sola vez en la computadora. No hace falta configurar el proyecto ni ejecutar `npm install`: las dependencias vienen incluidas.
3. Haz doble clic en `Iniciar SISFIS.bat`. Se abrirá la aplicación en el navegador, normalmente en [http://localhost:3000](http://localhost:3000).
4. Deja abierta la ventana de consola mientras uses la aplicación. Para detenerla, presiona `Ctrl+C` en esa ventana.

Se requiere un navegador actualizado, como Chrome, Edge o Firefox. Si Windows no reconoce `node` después de instalar Node.js, cierra y vuelve a abrir la sesión o reinicia la computadora.

### Inicio manual

Si prefieres usar una terminal, abre una en la carpeta del proyecto e inicia el servidor:

```bash
npm start
```

## Uso de la aplicación

1. Ve a **Nuevo informe** e ingresa el expediente y la empresa en **Datos generales**. La placa y el supervisor son opcionales.
2. Al salir del campo, las demás secciones se completan automáticamente con textos de demostración vinculados a los datos generales; no se consulta una API externa.
3. Revisa y edita el contenido autocompletado antes de presionar **Guardar informe**. El registro aparecerá en **Informes registrados** y podrás seleccionarlo para ver su vista previa.
4. En la lista puedes **Editar**, **Eliminar** o **Generar Word** para cada informe.
5. El documento se descarga como `Informe_<expediente>.docx`. Se basa en la plantilla del proyecto y conserva su diseño; la consulta visual usa los datos del formulario.

El contenido autocompletado es de demostración, puede incluir observaciones aleatorias y no representa una fiscalización real. Revísalo antes de guardar y no lo utilices para trámites oficiales.

## Datos y archivos importantes

- `informes.json`: almacena los informes en esta computadora. El servidor lo crea al usar la aplicación si no existe; no se incluye en la descarga para proteger los datos guardados.
- `templates/informe-supervision.docx`: plantilla usada para generar el documento. No la muevas ni cambies su nombre.
- `public/`: contiene la aplicación web, estilos e imágenes que utiliza la página y el documento.
- `server.js`: servidor web y API.
- `word-generator.js`: generación del archivo Word.

Haz una copia de `informes.json` si necesitas respaldar los registros. Para pasar los registros a otra computadora, copia ese archivo manualmente y colócalo junto a `server.js`.

## Cambiar el puerto

El servidor usa el puerto `3000` por defecto. Si está ocupado, puedes iniciar la aplicación en otro puerto.

En PowerShell:

```powershell
$env:PORT=3001
npm start
```

En macOS o Linux:

```bash
PORT=3001 npm start
```

Después abre `http://localhost:3001`. Si cambias el puerto en una terminal, el valor se aplica a esa terminal y a los procesos iniciados desde ella.

## API disponible

La aplicación ofrece estos endpoints REST:

| Método | Ruta | Acción |
|---|---|---|
| `GET` | `/api/informes` | Lista los informes |
| `GET` | `/api/informes/:id` | Consulta un informe por ID |
| `POST` | `/api/informes` | Registra un informe |
| `PUT` | `/api/informes/:id` | Actualiza un informe |
| `DELETE` | `/api/informes/:id` | Elimina un informe |
| `POST` | `/api/informes/word` | Genera y descarga el documento Word |

Para registrar o actualizar, envía JSON con `expediente` y `empresa` como cadenas no vacías. La aplicación web se encarga de enviar los datos con el formato esperado.

## Solución de problemas

- **`node` o `npm` no se reconoce:** instala Node.js 18 o posterior y vuelve a abrir la terminal. El lanzador abre la página de descarga si no encuentra Node.js.
- **El puerto ya está en uso:** detén la otra instancia del servidor con `Ctrl+C` o configura otro puerto con `PORT`.
- **No se genera el Word:** verifica que el servidor esté ejecutándose desde la carpeta del proyecto y que exista `templates/informe-supervision.docx`. Recarga la página después de reiniciar el servidor.
- **No aparecen los registros:** confirma que `informes.json` esté en la carpeta raíz y que el usuario tenga permiso para escribir en esa carpeta. Evita editarlo mientras el servidor está activo.

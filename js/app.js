// Variables globales
let video;
let canvas;
let streaming = false;
let autoMode = false;
let autoModeInterval = null;
let lastImportedImage = null;
const AUTO_MODE_INTERVAL = 1500; // Intervalo para el modo automático en ms

// Información técnica de los conectores
let connectorInfo = {};

// Cargar la información de los conectores desde el archivo JSON
async function loadConnectorInfo() {
    try {
        const response = await fetch('info.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        connectorInfo = await response.json();
        console.log('Información de conectores cargada correctamente');
    } catch (error) {
        console.error('Error al cargar la información de los conectores:', error);
    }
}

// Elementos del DOM
document.addEventListener('DOMContentLoaded', async () => {
    // Cargar la información de los conectores primero
    await loadConnectorInfo();
    
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    
    const startBtn = document.getElementById('startBtn');
    const captureBtn = document.getElementById('captureBtn');
    const importBtn = document.getElementById('importBtn');
    const fileInput = document.getElementById('fileInput');
    
    // Configurar listeners
    startBtn.addEventListener('click', startCamera);
    captureBtn.addEventListener('click', captureAndPredict);
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleImageImport);
});

// Función para iniciar la cámara
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'environment'
            },
            audio: false
        });
        
        // Asignar stream al video
        video.srcObject = stream;
        video.play();
        
        // Actualizar UI
        document.getElementById('startBtn').disabled = true;
        document.getElementById('captureBtn').disabled = false;
        
        // Mostrar video y ocultar canvas
        video.style.display = 'block';
        canvas.style.display = 'none';
        
        // Limpiar imagen importada
        lastImportedImage = null;
        
        // Ocultar instrucciones cuando se activa la cámara
        document.getElementById('instructions-container').style.display = 'none';
        
        console.log('Cámara iniciada correctamente');
        
        // Configurar tamaño del canvas cuando el video esté listo
        video.addEventListener('canplay', () => {
            if (!streaming) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                streaming = true;
            }
        });
        
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        alert('No se pudo acceder a la cámara. Por favor, verifica los permisos.');
    }
}

// Función para capturar imagen y realizar predicción
function captureAndPredict() {
    if (!streaming) return;
    
    // Limpiar resultados anteriores
    document.getElementById('result').style.display = 'none';
    document.getElementById('connector-info').style.display = 'none';
    
    // Mostrar indicador de carga
    document.getElementById('loading').style.display = 'flex';
    
    console.log('Capturando imagen desde la cámara');
    
    try {
        // Capturar imagen del video
        const context = canvas.getContext('2d');
        
        // Asegurar que el canvas tiene dimensiones correctas
        if (canvas.width <= 0 || canvas.height <= 0 || !streaming) {
            console.log('Ajustando dimensiones del canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
        }
        
        // Limpiar el canvas antes de dibujar
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Dibujar la imagen del video en el canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        console.log(`Imagen capturada con dimensiones: ${canvas.width}x${canvas.height}`);
        
        // Verificar que el canvas tenga datos válidos
        const testData = canvas.toDataURL('image/jpeg', 0.1);
        if (testData === 'data:,' || testData.length < 100) {
            throw new Error('El canvas no contiene datos de imagen válidos');
        }
        
        // Convertir a base64 con buena calidad
        const imageData = canvas.toDataURL('image/jpeg', 0.95);
        console.log('Longitud de datos de imagen:', imageData.length);
        
        // Crear o actualizar el contenedor de la vista previa en escala de grises
        const grayscaleOverlay = createGrayscaleOverlay();
        console.log('Overlay de escala de grises creado/actualizado:', grayscaleOverlay.id);
        
        // Enviar al servidor para predicción
        console.log('Enviando imagen al servidor para procesamiento en escala de grises y predicción');
        console.log('Incluyendo parámetro source=camera para solicitar imagen en escala de grises');
        
        fetch('http://localhost:5000/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                image: imageData,
                source: 'camera'  // Indicar que la imagen proviene de la cámara
            })
        })
        .then(response => {
            console.log('Respuesta del servidor recibida, estado:', response.status);
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`Error en la respuesta del servidor: ${response.status} - ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Datos de predicción recibidos:', data.top_prediction.class);
            
            // Mostrar la imagen en escala de grises si está disponible
            console.log('Verificando si se recibió la imagen en escala de grises:', Boolean(data.grayscale_image));
            if (data.grayscale_image) {
                console.log('Mostrando vista previa en escala de grises');
                const grayscalePreview = document.getElementById('grayscale-preview');
                if (grayscalePreview) {
                    console.log('Elemento grayscale-preview encontrado, asignando imagen');
                    grayscalePreview.onload = function() {
                        console.log('Imagen en escala de grises cargada correctamente');
                    };
                    grayscalePreview.onerror = function() {
                        console.error('Error al cargar la imagen en escala de grises');
                    };
                    grayscalePreview.src = data.grayscale_image;
                    grayscaleOverlay.style.display = 'flex';
                    console.log('Vista previa en escala de grises ahora visible');
                } else {
                    console.error('No se encontró el elemento grayscale-preview');
                }
            } else {
                console.warn('No se recibió imagen en escala de grises del servidor');
            }
            
            displayResults(data);
            displayConnectorInfo(data.top_prediction.class);
        })
        .catch(error => {
            console.error('Error durante la predicción:', error);
            alert('Ocurrió un error durante la predicción: ' + error.message);
            
            // Ocultar indicador de carga
            document.getElementById('loading').style.display = 'none';
            document.getElementById('result').style.display = 'block';
        });
    } catch (error) {
        console.error('Error al capturar la imagen:', error);
        alert('Error al capturar la imagen: ' + error.message);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('result').style.display = 'block';
    }
}

// Función para crear o actualizar el overlay de escala de grises
function createGrayscaleOverlay() {
    let grayscaleOverlay = document.getElementById('grayscale-overlay');
    
    // Si el overlay no existe, crearlo
    if (!grayscaleOverlay) {
        console.log('Creando overlay para vista previa en escala de grises');
        grayscaleOverlay = document.createElement('div');
        grayscaleOverlay.id = 'grayscale-overlay';
        grayscaleOverlay.className = 'grayscale-overlay';
        
        // Agregar título
        const title = document.createElement('h4');
        title.textContent = 'Vista Previa - Escala de Grises';
        grayscaleOverlay.appendChild(title);
        
        // Agregar imagen
        const img = document.createElement('img');
        img.id = 'grayscale-preview';
        img.alt = 'Vista previa en escala de grises';
        grayscaleOverlay.appendChild(img);
        
        // Agregar botón para cerrar
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Cerrar';
        closeBtn.className = 'btn primary close-btn';
        closeBtn.onclick = function() {
            grayscaleOverlay.style.display = 'none';
        };
        grayscaleOverlay.appendChild(closeBtn);
        
        // Agregar al DOM
        const cameraContainer = document.querySelector('.camera-container');
        cameraContainer.appendChild(grayscaleOverlay);
    }
    
    // Asegurar que está inicialmente oculto
    grayscaleOverlay.style.display = 'none';
    
    return grayscaleOverlay;
}

// Función para mostrar resultados
function displayResults(data) {
    // Ocultar indicador de carga
    document.getElementById('loading').style.display = 'none';
    document.getElementById('result').style.display = 'block';
    
    // Mostrar clase con mayor probabilidad
    const topPrediction = data.top_prediction;
    document.getElementById('detectedClass').textContent = topPrediction.class;
    
    // Calcular y mostrar el porcentaje de confianza
    const topConfidence = (topPrediction.probability * 100).toFixed(2);
    console.log(`Mostrando confianza: ${topConfidence}%`);
    
    // Asegurar que el elemento de confianza existe
    const confidenceElement = document.getElementById('confidence');
    
    if (confidenceElement) {
        confidenceElement.innerHTML = `
            <div class="progress-container">
                <div class="progress-bar" style="width: ${topConfidence}%"></div>
                <span class="progress-text">${topConfidence}%</span>
            </div>
        `;
    } else {
        console.error('No se encontró el elemento de confianza en el DOM');
    }
    
    // Mostrar otras predicciones
    const otherPredictionsList = document.getElementById('otherPredictions');
    otherPredictionsList.innerHTML = '';
    
    // Mostrar las siguientes 2 mejores predicciones (total 3 con la principal)
    data.predictions.slice(1, 3).forEach(prediction => {
        const probability = (prediction.probability * 100).toFixed(2);
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <div class="prediction-item">
                <span class="prediction-name">${prediction.class}</span>
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${probability}%"></div>
                    <span class="progress-text">${probability}%</span>
                </div>
            </div>
        `;
        otherPredictionsList.appendChild(listItem);
    });
}

// Función para mostrar información detallada del conector
function displayConnectorInfo(connectorClass) {
    // Obtener contenedor de información
    const infoContainer = document.getElementById('connector-info');
    
    // Actualizar info del conector detectado
    document.getElementById('connector-name').textContent = connectorClass;
    
    // Comprobar si tenemos información para este conector
    if (connectorInfo[connectorClass]) {
        const info = connectorInfo[connectorClass];
        
        // Actualizar campos de información
        document.getElementById('connector-compatibility').textContent = info.compatibility;
        document.getElementById('connector-speed').textContent = info.speed;
        document.getElementById('connector-power').textContent = info.power;
        document.getElementById('connector-uses').textContent = info.uses;
        
        // Mostrar el contenedor de información
        infoContainer.style.display = 'block';
    } else {
        // Si no hay información, mostrar mensaje genérico
        document.getElementById('connector-compatibility').textContent = 'Información no disponible';
        document.getElementById('connector-speed').textContent = 'Información no disponible';
        document.getElementById('connector-power').textContent = 'Información no disponible';
        document.getElementById('connector-uses').textContent = 'Información no disponible';
        
        // Mostrar el contenedor de información
        infoContainer.style.display = 'block';
    }
}

// Función para manejar la importación de imagen
function handleImageImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.match('image.*')) {
        alert('Por favor, selecciona un archivo de imagen válido');
        return;
    }
    
    // Limpiar resultados anteriores
    document.getElementById('result').style.display = 'none';
    document.getElementById('connector-info').style.display = 'none';
    document.getElementById('loading').style.display = 'flex';
    
    // Ocultar instrucciones cuando se importa una imagen
    document.getElementById('instructions-container').style.display = 'none';
    
    console.log('Procesando nueva imagen:', file.name, 'tipo:', file.type, 'tamaño:', file.size);
    
    const reader = new FileReader();
    reader.onload = function(e) {
        console.log('Imagen leída correctamente, creando objeto Image');
        const img = new Image();
        img.onload = function() {
            console.log('Imagen cargada, dimensiones:', img.width, 'x', img.height);
            
            // Inicializar el canvas con dimensiones mínimas antes de ajustarlo
            if (canvas.width <= 0 || canvas.height <= 0) {
                canvas.width = 640;
                canvas.height = 480;
                console.log('Canvas inicializado con dimensiones predeterminadas');
            }
            
            // Obtener el contexto del canvas
            const context = canvas.getContext('2d');
            
            // Limpiar el canvas para evitar problemas con imágenes anteriores
            context.clearRect(0, 0, canvas.width, canvas.height);
            
            // Ajustar el canvas al tamaño de la imagen manteniendo proporciones
            const aspectRatio = img.width / img.height;
            const maxWidth = video.offsetWidth || 640;
            const maxHeight = video.offsetHeight || 480;
            
            let newWidth = maxWidth;
            let newHeight = maxWidth / aspectRatio;
            
            if (newHeight > maxHeight) {
                newHeight = maxHeight;
                newWidth = maxHeight * aspectRatio;
            }
            
            // Asegurar dimensiones mínimas
            newWidth = Math.max(newWidth, 224);
            newHeight = Math.max(newHeight, 224);
            
            console.log('Redimensionando canvas a:', newWidth, 'x', newHeight);
            canvas.width = newWidth;
            canvas.height = newHeight;
            
            // Guardar la imagen para poder alternar
            lastImportedImage = img;
            
            // Mostrar la imagen en el canvas
            context.drawImage(img, 0, 0, newWidth, newHeight);
            
            // Mostrar el canvas y ocultar el video
            video.style.display = 'none';
            canvas.style.display = 'block';
            
            // Habilitar el botón de iniciar cámara
            document.getElementById('startBtn').disabled = false;
            
            // Verificar que el canvas tenga datos válidos antes de continuar
            try {
                // Prueba para verificar que el canvas contiene datos reales
                const testData = canvas.toDataURL('image/jpeg', 0.1);
                if (testData === 'data:,' || testData.length < 100) {
                    throw new Error('El canvas no contiene datos de imagen válidos');
                }
                
                // Realizar la predicción
                console.log('Canvas validado, procediendo con la predicción');
                predictFromCanvas();
            } catch (error) {
                console.error('Error al validar el canvas:', error);
                alert('Error al procesar la imagen. Por favor, intenta con otra imagen.');
                document.getElementById('loading').style.display = 'none';
            }
        };
        img.onerror = function(error) {
            console.error('Error al cargar la imagen:', error);
            alert('No se pudo cargar la imagen. Por favor, intenta con otra.');
            document.getElementById('loading').style.display = 'none';
        };
        console.log('Asignando src a la imagen');
        img.src = e.target.result;
    };
    reader.onerror = function(error) {
        console.error('Error al leer el archivo:', error);
        alert('Error al leer el archivo. Por favor, intenta de nuevo.');
        document.getElementById('loading').style.display = 'none';
    };
    console.log('Iniciando lectura del archivo como URL de datos');
    reader.readAsDataURL(file);
    
    // Limpiar el input de archivo para permitir seleccionar el mismo archivo nuevamente
    event.target.value = '';
}

// Función para realizar predicción desde el canvas
function predictFromCanvas() {
    // Mostrar indicador de carga
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('result').style.display = 'none';
    
    try {
        // Convertir a base64
        console.log('Obteniendo datos de imagen desde canvas');
        const imageData = canvas.toDataURL('image/jpeg', 0.95);
        console.log('Longitud de datos de imagen:', imageData.length);
        
        // Verificar que tenemos datos válidos
        if (!imageData || imageData === 'data:,' || imageData.length < 100) {
            throw new Error('Canvas vacío o datos de imagen inválidos');
        }
        
        console.log('Enviando imagen al servidor para predicción');
        // Enviar al servidor para predicción
        fetch('http://localhost:5000/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image: imageData })
        })
        .then(response => {
            console.log('Respuesta del servidor recibida, estado:', response.status);
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`Error en la respuesta del servidor: ${response.status} - ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Datos de predicción recibidos:', data.top_prediction.class);
            displayResults(data);
            displayConnectorInfo(data.top_prediction.class);
        })
        .catch(error => {
            console.error('Error durante la predicción:', error);
            alert('Ocurrió un error durante la predicción: ' + error.message);
            
            // Ocultar indicador de carga
            document.getElementById('loading').style.display = 'none';
            document.getElementById('result').style.display = 'block';
        });
    } catch (error) {
        console.error('Error al preparar la imagen:', error);
        alert('Error al preparar la imagen: ' + error.message);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('result').style.display = 'block';
    }
}

// Detener modo automático y video cuando se cierra la página
window.addEventListener('beforeunload', () => {
    if (autoModeInterval) {
        clearInterval(autoModeInterval);
    }
    
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
}); 
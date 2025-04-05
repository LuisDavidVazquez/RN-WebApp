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
    
    // Capturar imagen del video
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convertir a base64
    const imageData = canvas.toDataURL('image/jpeg');
    
    // Enviar al servidor para predicción
    fetch('http://localhost:5000/predict', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: imageData })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error en la respuesta del servidor');
        }
        return response.json();
    })
    .then(data => {
        displayResults(data);
        displayConnectorInfo(data.top_prediction.class);
    })
    .catch(error => {
        console.error('Error durante la predicción:', error);
        alert('Ocurrió un error durante la predicción. Por favor, intenta de nuevo.');
        
        // Ocultar indicador de carga
        document.getElementById('loading').style.display = 'none';
        document.getElementById('result').style.display = 'block';
    });
}

// Función para mostrar resultados
function displayResults(data) {
    // Ocultar indicador de carga
    document.getElementById('loading').style.display = 'none';
    document.getElementById('result').style.display = 'block';
    
    // Mostrar clase con mayor probabilidad
    const topPrediction = data.top_prediction;
    document.getElementById('detectedClass').textContent = topPrediction.class;
    const topConfidence = (topPrediction.probability * 100).toFixed(2);
    document.getElementById('confidence').innerHTML = `
        <div class="progress-container">
            <div class="progress-bar" style="width: ${topConfidence}%"></div>
            <span class="progress-text">${topConfidence}%</span>
        </div>
    `;
    
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
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Ajustar el canvas al tamaño de la imagen manteniendo proporciones
            const aspectRatio = img.width / img.height;
            const maxWidth = video.offsetWidth;
            const maxHeight = video.offsetHeight;
            
            let newWidth = maxWidth;
            let newHeight = maxWidth / aspectRatio;
            
            if (newHeight > maxHeight) {
                newHeight = maxHeight;
                newWidth = maxHeight * aspectRatio;
            }
            
            canvas.width = newWidth;
            canvas.height = newHeight;
            
            // Guardar la imagen para poder alternar
            lastImportedImage = img;
            
            // Mostrar la imagen en el canvas
            const context = canvas.getContext('2d');
            context.drawImage(img, 0, 0, newWidth, newHeight);
            
            // Mostrar el canvas y ocultar el video
            video.style.display = 'none';
            canvas.style.display = 'block';
            
            // Habilitar el botón de iniciar cámara
            document.getElementById('startBtn').disabled = false;
            
            // Realizar la predicción
            predictFromCanvas();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Función para realizar predicción desde el canvas
function predictFromCanvas() {
    // Mostrar indicador de carga
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('result').style.display = 'none';
    
    // Convertir a base64
    const imageData = canvas.toDataURL('image/jpeg');
    
    // Enviar al servidor para predicción
    fetch('http://localhost:5000/predict', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: imageData })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error en la respuesta del servidor');
        }
        return response.json();
    })
    .then(data => {
        displayResults(data);
        displayConnectorInfo(data.top_prediction.class);
    })
    .catch(error => {
        console.error('Error durante la predicción:', error);
        alert('Ocurrió un error durante la predicción. Por favor, intenta de nuevo.');
        
        // Ocultar indicador de carga
        document.getElementById('loading').style.display = 'none';
        document.getElementById('result').style.display = 'block';
    });
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
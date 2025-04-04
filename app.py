from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import img_to_array
from PIL import Image
import io
import base64

app = Flask(__name__, static_folder='.')
CORS(app)

# Cargar el modelo
MODEL_PATH = './mejor_modelo_ft.h5'
model = None
class_names = [
    'Conector Lightning (Apple)',
    'Cable Audio Óptico',
    'Adaptador de corriente (clavija redonda)',
    'Clavija US (Americana)',
    'Cable Coaxial',
    'Adaptador de corriente 6 salidas',
    'Adaptador de corriente (clavija redonda)',
    'Conector DisplayPort',
    'Conector HDMI',
    'Adaptador jack de audio de 3.5mm',
    'Cargador magnetico',
    'Conector Micro HDMI',
    'Conector Micro-USB',
    'Adaptador de corriente multicontacto',
    'Conector RCA',
    'Conector RJ-45 (Ethernet)',
    'Adaptador multipuerto USB hub',
    'Conector USB tipo A',
    'Conector USB tipo C',
    'Conector VGA'
]  # Lista actualizada de clases en el orden del entrenamiento

def load_tf_model():
    global model
    print("Cargando modelo desde", MODEL_PATH)
    model = load_model(MODEL_PATH)
    print("Modelo cargado correctamente.")
    return model

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({'error': 'Modelo no cargado'}), 500
    
    try:
        # Recibir imagen en formato base64
        data = request.json
        image_data = data.get('image')
        
        # Decodificar la imagen
        image_bytes = base64.b64decode(image_data.split(',')[1])
        image = Image.open(io.BytesIO(image_bytes))
        
        # Preprocesar imagen
        image = image.resize((224, 224))
        image_array = img_to_array(image)
        image_array = np.expand_dims(image_array, axis=0)
        image_array = image_array / 255.0
        
        # Realizar predicción
        predictions = model.predict(image_array)[0]
        
        # Preparar resultados
        results = []
        for i, pred in enumerate(predictions):
            results.append({
                'class': class_names[i],
                'probability': float(pred)
            })
        
        # Ordenar por probabilidad
        results.sort(key=lambda x: x['probability'], reverse=True)
        
        return jsonify({
            'predictions': results,
            'top_prediction': {
                'class': results[0]['class'],
                'probability': results[0]['probability']
            }
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Cargar modelo al iniciar
    load_tf_model()
    # Iniciar servidor
    print("Iniciando servidor en http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True) 
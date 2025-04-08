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
CORS(app, resources={
    r"/*": {
        "origins": "*",  # En producción, reemplaza con tu dominio
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Cargar el modelo
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'mejor_modelo.h5')

model = None
class_names = [
    'Conector Lightning (Apple)',
    'Cable Audio Óptico',
    'Clavija US (Americana)',
    'Clavija US (Americana) 3 pines',
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
        print("Error: Modelo no cargado")
        return jsonify({'error': 'Modelo no cargado'}), 500
    
    image = None
    image_bytes = None
    
    try:
        # Recibir imagen en formato base64
        data = request.json
        if not data:
            print("Error: No se recibieron datos JSON")
            return jsonify({'error': 'No se recibieron datos JSON'}), 400
            
        image_data = data.get('image')
        source_type = data.get('source', 'unknown')
        
        if not image_data:
            print("Error: No se recibió ninguna imagen")
            return jsonify({'error': 'No se recibió ninguna imagen'}), 400
        
        print(f"Recibiendo imagen base64 (longitud: {len(image_data)}) desde: {source_type}")
        
        try:
            # Decodificar la imagen
            if ',' in image_data:
                content_type, base64_data = image_data.split(',', 1)
                print(f"Tipo de contenido detectado: {content_type}")
                image_bytes = base64.b64decode(base64_data)
            else:
                print("No se detectó formato data URI, intentando como base64 puro")
                image_bytes = base64.b64decode(image_data)
            
            print(f"Tamaño de bytes de imagen: {len(image_bytes)} bytes")
            
            # Verificar que la imagen no esté vacía
            if len(image_bytes) == 0:
                print("Error: Imagen decodificada está vacía")
                return jsonify({'error': 'La imagen está vacía'}), 400
            
            # Intentar abrir la imagen
            image = Image.open(io.BytesIO(image_bytes))
            print(f"Imagen decodificada correctamente: {image.format}, tamaño: {image.size}, modo: {image.mode}")
            
            # Verificar que la imagen sea válida
            if image.size[0] == 0 or image.size[1] == 0:
                print("Error: Dimensiones de imagen inválidas")
                return jsonify({'error': 'Dimensiones de imagen inválidas'}), 400
        
        except Exception as decode_error:
            print(f"Error al decodificar la imagen base64: {str(decode_error)}")
            return jsonify({'error': f'Error al decodificar la imagen: {str(decode_error)}'}), 400
        
        # Preprocesar imagen
        try:
            image = image.resize((224, 224))
            print(f"Imagen redimensionada a 224x224, modo: {image.mode}")
            
            if image.mode != 'RGB':
                print(f"Convirtiendo imagen de {image.mode} a RGB")
                image = image.convert('RGB')
            
            image_array = img_to_array(image)
            
            # Convertir a escala de grises
            print("Convirtiendo imagen a escala de grises")
            r, g, b = image_array[:,:,0], image_array[:,:,1], image_array[:,:,2]
            grayscale = 0.299 * r + 0.587 * g + 0.114 * b
            grayscale_image = np.stack([grayscale, grayscale, grayscale], axis=-1)
            
            # Normalizar
            image_array = np.expand_dims(grayscale_image, axis=0)
            image_array = image_array / 255.0
            
            print("Imagen preprocesada correctamente")
            
        except Exception as preprocess_error:
            print(f"Error en el preprocesamiento: {str(preprocess_error)}")
            return jsonify({'error': f'Error en el preprocesamiento: {str(preprocess_error)}'}), 400
        
        # Realizar predicción
        try:
            predictions = model.predict(image_array)[0]
            print("Predicción realizada correctamente")
            
            # Preparar resultados
            results = []
            for i, pred in enumerate(predictions):
                results.append({
                    'class': class_names[i],
                    'probability': float(pred)
                })
            
            results.sort(key=lambda x: x['probability'], reverse=True)
            
            print(f"Predicción exitosa: {results[0]['class']} con {results[0]['probability']*100:.2f}% de confianza")
            
            response_data = {
                'predictions': results,
                'top_prediction': {
                    'class': results[0]['class'],
                    'probability': results[0]['probability']
                }
            }
            
            return jsonify(response_data)
            
        except Exception as predict_error:
            print(f"Error durante la predicción: {str(predict_error)}")
            return jsonify({'error': f'Error durante la predicción: {str(predict_error)}'}), 500
    
    except Exception as e:
        print(f"Error general: {str(e)}")
        return jsonify({'error': f'Error general: {str(e)}'}), 500
    
    finally:
        # Limpiar recursos
        if image is not None:
            try:
                image.close()
            except:
                pass

if __name__ == '__main__':
    try:
        # Cargar modelo al iniciar
        load_tf_model()
        # Iniciar servidor
        print("Iniciando servidor en http://localhost:5000")
        app.run(host='0.0.0.0', port=5000, debug=True)
    except Exception as e:
        print(f"Error al iniciar el servidor: {str(e)}") 
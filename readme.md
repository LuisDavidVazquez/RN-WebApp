
# 🔌 Clasificador de Conectores Tecnológicos

Este proyecto es una aplicación web construida con **Flask** y **TensorFlow** que permite **clasificar imágenes de conectores eléctricos y computacionales** utilizando un modelo de red neuronal.

## 🚀 Características

- Clasificación automática de conectores mediante imágenes.
- Interfaz web servida con Flask.
- API RESTful para predicciones.
- Compatible con imágenes en formato base64.

---

## 🧰 Requisitos

Antes de comenzar, asegúrate de tener instalado:

- [Python 3.11](https://www.python.org/downloads/)
- Git (opcional, para clonar el repositorio)

---

## 🖥️ Instalación en Windows

Sigue estos pasos para ejecutar el proyecto localmente:

### 1. Clona el repositorio (opcional)

```bash
git clone https://github.com/LuisDavidVazquez/RN-WebApp.git
cd RN-WebApp
```

### (Opcional pero recomendado) Actualiza pip
Antes de instalar las dependencias, asegúrate de que pip esté actualizado para evitar problemas de compatibilidad:

```bash
pip install --upgrade pip
```

Esto garantiza que estás usando la versión más reciente del gestor de paquetes de Python.

### 2. Crea un entorno virtual

```bash
py -3.11 -m venv venv
```

### 3. Activa el entorno virtual

```bash
venv\Scripts\activate
```

Verás que el nombre del entorno (`venv`) aparece al inicio de tu línea de comandos, indicando que está activo.

### 4. Instala las dependencias

```bash
pip install -r requirements.txt
```

Esto instalará Flask, flask-cors, TensorFlow, NumPy y cualquier otra librería necesaria.

### 5. Ejecuta la aplicación

```bash
python app.py
```

La aplicación iniciará un servidor local accesible en:

```
http://localhost:5000
```

---

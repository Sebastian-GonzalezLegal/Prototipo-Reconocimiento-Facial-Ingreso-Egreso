const elVideo = document.getElementById('video');

//reproducir lo que hay en la camara, en el elemento elVideo

navigator.getMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia)

const cargarCamara = () => {
    navigator.getMedia({
        video: true,
        audio: false,
        },

        stream =>  elVideo.srcObject = stream,
        console.error
    )
}

Promise.all([
    //listado de todo lo q puede cargar 
    faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
    faceapi.nets.ageGenderNet.loadFromUri('./models'),
    faceapi.nets.faceExpressionNet.loadFromUri('./models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri('./models'), 
    faceapi.nets.ssdMobilenetv1.loadFromUri('./models'), 
    faceapi.nets.tinyFaceDetector.loadFromUri('./models')
]) .then(cargarCamara)




//cuando la camara se este reproduciendo, se ejecuta el evento play
 elVideo.addEventListener('play', async () => {

    const canvas = faceapi.createCanvasFromMedia(elVideo)
    //se añade el canvas al body
    document.body.append(canvas)
    //refrecamos canvas para q se actualice el video
    const displaySize = { width: elVideo.width, height: elVideo.height }
    faceapi.matchDimensions(canvas, displaySize)

    setInterval(async () => {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 });
    const detections = await faceapi
    .detectSingleFace(elVideo, options)
    .withFaceLandmarks()
    .withFaceExpressions()
    .withAgeAndGender()
    .withFaceDescriptor()

    const resizedDetections = faceapi.resizeResults(detections, displaySize)
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    faceapi.draw.drawDetections(canvas, resizedDetections)
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
    faceapi.draw.drawFaceExpressions(canvas, resizedDetections)
    })
})
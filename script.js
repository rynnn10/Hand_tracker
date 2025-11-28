// ==========================================
// BAGIAN 1: BACKGROUND PARTICLES
// ==========================================
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');
let particlesArray;

function resizeCanvas() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let mouse = { x: null, y: null, radius: 120 }

window.addEventListener('mousemove', (e) => { mouse.x = e.x; mouse.y = e.y; });
window.addEventListener('touchmove', (e) => { 
    mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; 
});
window.addEventListener('touchend', () => { mouse.x = null; mouse.y = null; });

class Particle {
    constructor(x, y, dirX, dirY, size, color) {
        this.x = x; this.y = y;
        this.dirX = dirX; this.dirY = dirY;
        this.size = size; this.color = color;
    }
    draw() {
        bgCtx.beginPath();
        bgCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        bgCtx.fillStyle = this.color;
        bgCtx.shadowBlur = 5;
        bgCtx.shadowColor = this.color;
        bgCtx.fill();
        bgCtx.shadowBlur = 0;
    }
    update() {
        if (this.x > bgCanvas.width || this.x < 0) this.dirX = -this.dirX;
        if (this.y > bgCanvas.height || this.y < 0) this.dirY = -this.dirY;
        
        // Interaksi dengan Mouse/Touch
        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < mouse.radius + this.size) {
            if (mouse.x < this.x && this.x < bgCanvas.width - 10) this.x += 3;
            if (mouse.x > this.x && this.x > 10) this.x -= 3;
            if (mouse.y < this.y && this.y < bgCanvas.height - 10) this.y += 3;
            if (mouse.y > this.y && this.y > 10) this.y -= 3;
        }
        
        this.x += this.dirX;
        this.y += this.dirY;
        this.draw();
    }
}

function initParticles() {
    particlesArray = [];
    let numberOfParticles = (bgCanvas.height * bgCanvas.width) / 12000;
    for (let i = 0; i < numberOfParticles; i++) {
        let size = (Math.random() * 2) + 1;
        let x = Math.random() * innerWidth;
        let y = Math.random() * innerHeight;
        let dirX = (Math.random() * 0.4) - 0.2;
        let dirY = (Math.random() * 0.4) - 0.2;
        particlesArray.push(new Particle(x, y, dirX, dirY, size, '#00f2ff'));
    }
}

function connectParticles() {
    let opacityValue = 1;
    for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a; b < particlesArray.length; b++) {
            let distance = ((particlesArray[a].x - particlesArray[b].x) * (particlesArray[a].x - particlesArray[b].x)) + 
                           ((particlesArray[a].y - particlesArray[b].y) * (particlesArray[a].y - particlesArray[b].y));
            if (distance < (bgCanvas.width/7) * (bgCanvas.height/7)) {
                opacityValue = 1 - (distance/20000);
                bgCtx.strokeStyle = 'rgba(0, 242, 255,' + opacityValue + ')';
                bgCtx.lineWidth = 1;
                bgCtx.beginPath();
                bgCtx.moveTo(particlesArray[a].x, particlesArray[a].y);
                bgCtx.lineTo(particlesArray[b].x, particlesArray[b].y);
                bgCtx.stroke();
            }
        }
    }
}

function animateParticles() {
    requestAnimationFrame(animateParticles);
    bgCtx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
    }
    connectParticles();
}
initParticles();
animateParticles();

// ==========================================
// BAGIAN 2: AI HAND TRACKING
// ==========================================
const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const displayNumber = document.getElementById('display-number');
const displayText = document.getElementById('display-text');
const loadingScreen = document.getElementById('loading');
const camBtn = document.getElementById('cam-btn');
const camOffMsg = document.getElementById('camera-off-msg');
const boxNum = document.getElementById('box-num');

let isCameraOn = true;
let rawPostureSignature = ""; 
let stablePostureSignature = "";
let frameConfidence = 0;

// KONFIGURASI SESUAI PERMINTAAN TERAKHIR
const CONFIDENCE_THRESHOLD = 5; 

const synth = window.speechSynthesis;
function speak(text) {
    if (synth.speaking) synth.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.3; 
    synth.speak(utterance);
}

const numberToText = { 
    0: "Nol", 1: "Satu", 2: "Dua", 3: "Tiga", 4: "Empat", 5: "Lima",
    6: "Enam", 7: "Tujuh", 8: "Delapan", 9: "Sembilan", 10: "Sepuluh"
};

function onResults(results) {
    loadingScreen.style.display = 'none';
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    let currentFrameTotal = 0;
    let currentFramePosture = []; 

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (const [index, landmarks] of results.multiHandLandmarks.entries()) {
            const handedness = results.multiHandedness[index].label; 
            
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00f2ff', lineWidth: 2});
            drawLandmarks(canvasCtx, landmarks, {color: '#ffffff', lineWidth: 1, radius: 4});

            let fingersOnHand = 0;
            
            // Jempol Logic
            let thumbOpen = false;
            if (handedness === 'Right') { 
                if (landmarks[4].x < landmarks[3].x) thumbOpen = true;
            } else {
                if (landmarks[4].x > landmarks[3].x) thumbOpen = true;
            }
            if (thumbOpen) fingersOnHand++;
            currentFramePosture.push(thumbOpen ? 1 : 0); 

            // 4 Jari Lain
            const fingerTips = [8, 12, 16, 20];
            const fingerPips = [6, 10, 14, 18]; 
            for (let i = 0; i < fingerTips.length; i++) {
                let fingerOpen = false;
                if (landmarks[fingerTips[i]].y < landmarks[fingerPips[i]].y) fingerOpen = true;
                
                if (fingerOpen) fingersOnHand++;
                currentFramePosture.push(fingerOpen ? 1 : 0); 
            }
            currentFrameTotal += fingersOnHand;
        }

        // Buat signature unik untuk postur ini
        const currentSignatureString = currentFramePosture.join("");

        if (currentSignatureString === rawPostureSignature) {
            frameConfidence++;
        } else {
            rawPostureSignature = currentSignatureString;
            frameConfidence = 0; 
        }

        if (frameConfidence > CONFIDENCE_THRESHOLD) {
            if (stablePostureSignature !== rawPostureSignature) {
                stablePostureSignature = rawPostureSignature;
                
                displayNumber.innerText = currentFrameTotal;
                let text = numberToText[currentFrameTotal] || currentFrameTotal.toString();
                displayText.innerText = text;
                speak(text);
                
                // Efek Pulse
                boxNum.classList.remove('pulse-active');
                void boxNum.offsetWidth; 
                boxNum.classList.add('pulse-active');
                
                displayNumber.style.color = "#00ff88";
                setTimeout(() => {
                    displayNumber.style.color = "white";
                    boxNum.classList.remove('pulse-active');
                }, 200);
            }
        }
    } else {
        frameConfidence = 0;
        rawPostureSignature = "";
        if (stablePostureSignature !== "") {
            stablePostureSignature = "";
            displayNumber.innerText = "-";
            displayText.innerText = "READY";
        }
    }
    canvasCtx.restore();
}

// SETUP MEDIAPIPE & CAMERA
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});

hands.setOptions({
    maxNumHands: 2, 
    modelComplexity: 1, 
    // OPTIMASI SESUAI REQUEST:
    minDetectionConfidence: 0.4, // Diturunkan agar tidak delay mendeteksi
    minTrackingConfidence: 0.4
});
hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => await hands.send({image: videoElement}),
    width: 640,
    height: 480 
});

camera.start();

function toggleCamera() {
    if (isCameraOn) {
        camera.stop();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.fillStyle = "#000";
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        camBtn.innerText = "ACTIVATE CAMERA";
        camBtn.classList.add('active');
        camOffMsg.style.display = "block";
        isCameraOn = false;
    } else {
        camOffMsg.style.display = "none";
        loadingScreen.style.display = "block";
        camera.start().then(() => loadingScreen.style.display = "none");
        camBtn.innerText = "DEACTIVATE CAMERA";
        camBtn.classList.remove('active');
        isCameraOn = true;
    }
                }

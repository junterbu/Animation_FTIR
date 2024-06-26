// Standard Three.js Setup
const container = document.getElementById('container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.physicallyCorrectLights = true;  // PBR lighting
renderer.toneMapping = THREE.ACESFilmicToneMapping;  // Bessere Tone-Mapping-Option
renderer.toneMappingExposure = 1.5;  // Erhöhte Belichtung
container.appendChild(renderer.domElement);

// OrbitControls hinzufügen
const controls = new THREE.OrbitControls(camera, renderer.domElement);

// PMREM Generator for HDRI
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

// Licht hinzufügen
const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2); // Weiter erhöhte Intensität
hemisphereLight.position.set(0, 20, 0);
scene.add(hemisphereLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2); // Weiter erhöhte Intensität
directionalLight.position.set(0, 20, 10);
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 1); // Weiter erhöhte Intensität
scene.add(ambientLight);

// Load HDRI Environment
const rgbeLoader = new THREE.RGBELoader();
rgbeLoader.setPath('path/to/your/hdri/');  // Pfad zur HDRI-Datei
rgbeLoader.load('your_hdri_file.hdr', function (texture) {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    scene.background = envMap;
    texture.dispose();
    pmremGenerator.dispose();
});

// Animation-Mixer
let mixer, action, duration, gltf;

// GLB Loader
const loader = new THREE.GLTFLoader();
loader.load('assets/FTIR_v3.glb', function (loadedGltf) {
    gltf = loadedGltf;
    scene.add(gltf.scene);

    // Animationen laden und abspielen
    mixer = new THREE.AnimationMixer(gltf.scene);
    action = mixer.clipAction(gltf.animations[0]);
    action.play();

    duration = action.getClip().duration;
    document.getElementById('timeline').max = duration * 100;

    // Traverse the scene to find the material
    gltf.scene.traverse((object) => {
        if (object.isMesh && object.material.name === 'Farbe weiß transparent') {
            // Create a new PhysicalMaterial
            const pbrMaterial = new THREE.MeshPhysicalMaterial({
                color: 0x000000,  // black color
                transparent: true,
                opacity: 1.0,
                roughness: 0.3, // Angepasster Wert
                metalness: 0.1, // Angepasster Wert
                clearcoat: 1.0,
                clearcoatRoughness: 0.1
            });

            // Replace the material
            object.material = pbrMaterial;
            object.userData.pbrMaterial = pbrMaterial; // Store reference for animation
        }
    });

    animate();
}, undefined, function (error) {
    console.error(error);
});

camera.position.set(-150, 100, 200); // X, Z, Y Koordinaten anpassen

controls.update();

// Uhr für Animationen
const clock = new THREE.Clock();
let isPlaying = true;
let currentTime = 0;
let playbackSpeed = 1.0;

// Create AR button and add event listener
const arButton = document.getElementById('arButton');
arButton.addEventListener('click', activateAR);

function activateAR() {
    if (navigator.xr) {
        navigator.xr.requestSession('immersive-ar').then(onSessionStarted);
    } else {
        alert("WebXR is not supported on this browser/device");
    }
}

function onSessionStarted(session) {
    session.addEventListener('end', onSessionEnded);
    renderer.xr.enabled = true;
    renderer.xr.setSession(session);
    animate();
}

function onSessionEnded() {
    renderer.xr.enabled = false;
}
// Existing animate function...
function animate() {
    renderer.setAnimationLoop(() => {
        // If using WebXR session
        if (renderer.xr.isPresenting) {
            renderer.render(scene, camera);
        } else {
            // Normal rendering
            const delta = clock.getDelta() * playbackSpeed;
            if (mixer && isPlaying) {
                mixer.update(delta);
                currentTime = mixer.time % duration;
                document.getElementById('timeline').value = currentTime * 100;
                const totalFrames = 1000;
                const currentFrame = (currentTime / duration) * totalFrames;
                gltf.scene.traverse((object) => {
                    if (object.isMesh && object.userData.pbrMaterial) {
                        const pbrMaterial = object.userData.pbrMaterial;
                        if (currentFrame < 60) {
                            pbrMaterial.opacity = 1.0;
                        } else if (currentFrame >= 60 && currentFrame <= 80) {
                            const alphaValue = 1.0 - (0.5 * ((currentFrame - 60) / 20));
                            pbrMaterial.opacity = alphaValue;
                        } else {
                            pbrMaterial.opacity = 0.5;
                        }
                    }
                });
            }
            controls.update();
            renderer.render(scene, camera);
            if (currentTime >= duration - delta) {
                document.getElementById('timeline').value = 0;
            }
        }
    });
}

// Window resize handler...
window.addEventListener('resize', function () {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
});

// Timeline control...
document.getElementById('timeline').addEventListener('input', function (e) {
    const value = e.target.value / 100;
    mixer.setTime(value);
    currentTime = value * duration;
    if (!isPlaying) {
        action.paused = true;
    }
});

// Play/Pause control...
document.getElementById('playPause').addEventListener('click', function () {
    isPlaying = !isPlaying;
    if (isPlaying) {
        action.paused = false;
        clock.start();
        clock.elapsedTime = currentTime;
        this.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        action.paused = true;
        clock.stop();
        this.innerHTML = '<i class="fas fa-play"></i>';
    }
});

// Speed control...
document.getElementById('speedControl').addEventListener('change', function (e) {
    playbackSpeed = parseFloat(e.target.value);
});
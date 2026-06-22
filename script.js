(() => {
  "use strict";

  const PARTICLE_COUNT = window.innerWidth < 720 ? 5000 : 9000;
  const state = {
    scene: null,
    camera: null,
    renderer: null,
    points: null,
    geometry: null,
    sphere: null,
    target: null,
    morphStart: null,
    morphProgress: 1,
    dragging: false,
    pointerX: 0,
    pointerY: 0,
    recognition: null,
    listening: false,
    handCamera: null,
    handsEnabled: false,
    toastTimer: null
  };

  const $ = (selector) => document.querySelector(selector);
  const canvas = $("#particle-canvas");
  const input = $("#text-input");
  const statusText = $("#status-text");
  const statusPill = $("#status-pill");

  function setStatus(text, busy = false) {
    statusText.textContent = text;
    statusPill.classList.toggle("busy", busy);
  }

  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  function initScene() {
    state.scene = new THREE.Scene();
    state.scene.fog = new THREE.FogExp2(0x050510, 0.012);

    state.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000);
    state.camera.position.set(0, 0, 40);

    state.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    state.renderer.setSize(innerWidth, innerHeight);
    state.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    state.renderer.outputEncoding = THREE.sRGBEncoding;

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    state.sphere = new Float32Array(PARTICLE_COUNT * 3);

    const colorA = new THREE.Color("#5de8ff");
    const colorB = new THREE.Color("#9b6cff");

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const y = 1 - (i / (PARTICLE_COUNT - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = Math.PI * (3 - Math.sqrt(5)) * i;
      const radius = 10 + Math.sin(i * 0.37) * 0.28;
      const idx = i * 3;

      state.sphere[idx] = Math.cos(theta) * radiusAtY * radius;
      state.sphere[idx + 1] = y * radius;
      state.sphere[idx + 2] = Math.sin(theta) * radiusAtY * radius;
      positions.set(state.sphere.subarray(idx, idx + 3), idx);

      const mixed = colorA.clone().lerp(colorB, (y + 1) / 2);
      colors[idx] = mixed.r;
      colors[idx + 1] = mixed.g;
      colors[idx + 2] = mixed.b;
    }

    state.geometry = new THREE.BufferGeometry();
    state.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    state.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: innerWidth < 720 ? 0.12 : 0.105,
      vertexColors: true,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });

    state.points = new THREE.Points(state.geometry, material);
    state.points.position.x = innerWidth > 900 ? 10 : 0;
    state.scene.add(state.points);
    animate();
  }

  function sampleCanvas(sourceCanvas, scale, alphaTest = 30) {
    const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const { width, height } = sourceCanvas;
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const candidates = [];

    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const offset = (y * width + x) * 4;
        const brightness = pixels[offset] + pixels[offset + 1] + pixels[offset + 2];
        if (pixels[offset + 3] > alphaTest && brightness > 120) {
          candidates.push({
            x: (x - width / 2) * scale,
            y: (height / 2 - y) * scale,
            r: pixels[offset] / 255,
            g: pixels[offset + 1] / 255,
            b: pixels[offset + 2] / 255
          });
        }
      }
    }

    if (!candidates.length) return null;
    const targets = new Float32Array(PARTICLE_COUNT * 3);
    const colors = state.geometry.attributes.color.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const point = candidates[Math.floor(i * candidates.length / PARTICLE_COUNT) % candidates.length];
      const idx = i * 3;
      targets[idx] = point.x + (Math.random() - 0.5) * 0.06;
      targets[idx + 1] = point.y + (Math.random() - 0.5) * 0.06;
      targets[idx + 2] = (Math.random() - 0.5) * 1.2;
      colors[idx] = Math.max(0.25, point.r);
      colors[idx + 1] = Math.max(0.25, point.g);
      colors[idx + 2] = Math.max(0.35, point.b);
    }

    state.geometry.attributes.color.needsUpdate = true;
    return targets;
  }

  function morphToText(value) {
    const text = value.trim().slice(0, 60);
    if (!text) {
      toast("Type or say something first");
      input.focus();
      return;
    }

    const offscreen = document.createElement("canvas");
    const ctx = offscreen.getContext("2d");
    const fontSize = text.length > 24 ? 68 : 92;
    ctx.font = `700 ${fontSize}px Arial, sans-serif`;
    const measured = Math.ceil(ctx.measureText(text.toUpperCase()).width);
    offscreen.width = Math.min(1800, Math.max(520, measured + 90));
    offscreen.height = 190;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    const gradient = ctx.createLinearGradient(0, 0, offscreen.width, 0);
    gradient.addColorStop(0, "#61e9ff");
    gradient.addColorStop(1, "#aa76ff");
    ctx.fillStyle = gradient;
    ctx.font = `700 ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text.toUpperCase(), offscreen.width / 2, offscreen.height / 2);

    const scale = Math.min(0.075, 42 / offscreen.width);
    const targets = sampleCanvas(offscreen, scale);
    if (targets) startMorph(targets, "Text created");
  }

  function processImage(file) {
    if (!file || !file.type.startsWith("image/")) {
      toast("Please choose an image file");
      return;
    }

    const image = new Image();
    image.onload = () => {
      const offscreen = document.createElement("canvas");
      const size = 260;
      offscreen.width = size;
      offscreen.height = size;
      const ctx = offscreen.getContext("2d");
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, size, size);

      const ratio = Math.min(size / image.width, size / image.height);
      const w = image.width * ratio;
      const h = image.height * ratio;
      ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
      const targets = sampleCanvas(offscreen, 0.075, 20);
      if (targets) startMorph(targets, "Image transformed");
      else toast("This image is too dark to sample");
      URL.revokeObjectURL(image.src);
    };
    image.src = URL.createObjectURL(file);
  }

  function startMorph(targets, message) {
    state.morphStart = state.geometry.attributes.position.array.slice();
    state.target = targets;
    state.morphProgress = 0;
    state.points.rotation.set(0, 0, 0);
    setStatus("Morphing", true);
    toast(message);
  }

  function resetSphere() {
    const colors = state.geometry.attributes.color.array;
    const a = new THREE.Color("#5de8ff");
    const b = new THREE.Color("#9b6cff");
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const idx = i * 3;
      const t = (state.sphere[idx + 1] / 10 + 1) / 2;
      const c = a.clone().lerp(b, t);
      colors[idx] = c.r;
      colors[idx + 1] = c.g;
      colors[idx + 2] = c.b;
    }
    state.geometry.attributes.color.needsUpdate = true;
    startMorph(state.sphere, "Returned to aura");
    input.value = "";
  }

  function setupSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      $("#mic-btn").disabled = true;
      $("#mic-btn").title = "Voice input requires Chrome or Edge";
      return;
    }

    state.recognition = new SpeechRecognition();
    state.recognition.continuous = false;
    state.recognition.interimResults = true;

    state.recognition.onstart = () => {
      state.listening = true;
      $("#mic-btn").classList.add("listening");
      setStatus("Listening", true);
    };

    state.recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      input.value = transcript;
      if (event.results[event.results.length - 1].isFinal) morphToText(transcript);
    };

    state.recognition.onerror = (event) => {
      if (event.error !== "aborted") toast(`Voice input: ${event.error}`);
    };

    state.recognition.onend = () => {
      state.listening = false;
      $("#mic-btn").classList.remove("listening");
      setStatus("Ready");
    };
  }

  function toggleSpeech() {
    if (!state.recognition) {
      toast("Voice input is not supported in this browser");
      return;
    }
    if (state.listening) state.recognition.stop();
    else {
      state.recognition.lang = $("#language-select").value;
      state.recognition.start();
    }
  }

  async function toggleGestures() {
    const panel = $("#camera-panel");
    if (state.handsEnabled) {
      const stream = $("#webcam").srcObject;
      if (stream) stream.getTracks().forEach((track) => track.stop());
      panel.hidden = true;
      state.handsEnabled = false;
      setStatus("Ready");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.Hands || !window.Camera) {
      toast("Gesture control is not available");
      return;
    }

    try {
      panel.hidden = false;
      const video = $("#webcam");
      const handCanvas = $("#hand-canvas");
      const handCtx = handCanvas.getContext("2d");
      const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.62,
        minTrackingConfidence: 0.58
      });

      hands.onResults((results) => {
        handCanvas.width = video.videoWidth || 320;
        handCanvas.height = video.videoHeight || 240;
        handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
        const landmarks = results.multiHandLandmarks?.[0];
        if (!landmarks) {
          setStatus("Show your hand", true);
          return;
        }

        drawConnectors(handCtx, landmarks, HAND_CONNECTIONS, { color: "#5de8ff", lineWidth: 2 });
        drawLandmarks(handCtx, landmarks, { color: "#ffffff", radius: 2 });
        const pinch = Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y);
        state.points.rotation.y += (0.5 - landmarks[8].x) * 0.035;
        state.camera.position.z += ((pinch < 0.06 ? 28 : 40) - state.camera.position.z) * 0.04;
        setStatus(pinch < 0.06 ? "Pinch: zoom in" : "Hand tracking", true);
      });

      state.handCamera = new Camera(video, {
        width: 320,
        height: 240,
        onFrame: async () => hands.send({ image: video })
      });
      await state.handCamera.start();
      state.handsEnabled = true;
      setStatus("Gesture control", true);
    } catch (error) {
      panel.hidden = true;
      toast("Camera permission was not enabled");
      setStatus("Ready");
    }
  }

  function bindEvents() {
    $("#send-btn").addEventListener("click", () => morphToText(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") morphToText(input.value);
    });
    $("#mic-btn").addEventListener("click", toggleSpeech);
    $("#upload-btn").addEventListener("click", () => $("#file-input").click());
    $("#file-input").addEventListener("change", (event) => processImage(event.target.files[0]));
    $("#reset-btn").addEventListener("click", resetSphere);
    $("#gesture-btn").addEventListener("click", toggleGestures);

    canvas.addEventListener("pointerdown", (event) => {
      state.dragging = true;
      state.pointerX = event.clientX;
      state.pointerY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!state.dragging) return;
      state.points.rotation.y += (event.clientX - state.pointerX) * 0.006;
      state.points.rotation.x += (event.clientY - state.pointerY) * 0.006;
      state.pointerX = event.clientX;
      state.pointerY = event.clientY;
    });
    canvas.addEventListener("pointerup", () => { state.dragging = false; });
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      state.camera.position.z = THREE.MathUtils.clamp(state.camera.position.z + event.deltaY * 0.015, 20, 65);
    }, { passive: false });

    addEventListener("resize", () => {
      state.camera.aspect = innerWidth / innerHeight;
      state.camera.updateProjectionMatrix();
      state.renderer.setSize(innerWidth, innerHeight);
      state.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      state.points.position.x = innerWidth > 900 ? 10 : 0;
    });
  }

  function animate() {
    requestAnimationFrame(animate);
    const positions = state.geometry.attributes.position.array;

    if (state.morphProgress < 1 && state.target && state.morphStart) {
      state.morphProgress = Math.min(1, state.morphProgress + 0.018);
      const t = 1 - Math.pow(1 - state.morphProgress, 4);
      for (let i = 0; i < positions.length; i++) {
        positions[i] = state.morphStart[i] + (state.target[i] - state.morphStart[i]) * t;
      }
      state.geometry.attributes.position.needsUpdate = true;
      if (state.morphProgress === 1) setStatus(state.handsEnabled ? "Gesture control" : "Ready");
    } else if (!state.dragging && !state.handsEnabled) {
      state.points.rotation.y += 0.0014;
    }

    state.renderer.render(state.scene, state.camera);
  }

  try {
    initScene();
    setupSpeech();
    bindEvents();
  } catch (error) {
    console.error(error);
    setStatus("Load error");
    toast("Could not start the particle engine");
  }
})();

// Voice Particle Morph System
class VoiceParticleMorph {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.particles = null;
        this.particleSystem = null;
        this.particleCount = 4000;
        this.originalPositions = null;
        this.targetPositions = null;
        this.isAnimating = false;
        this.speechRecognition = null;
        this.isListening = false;
        
        this.init();
        this.setupSpeechRecognition();
        this.setupEventListeners();
    }

    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x000000, 1, 1000);

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 50;

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('particle-canvas'),
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x000000, 1);

        // Create particle system
        this.createParticleSystem();

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x9333ea, 0.5);
        this.scene.add(ambientLight);

        // Start animation loop
        this.animate();
    }

    createParticleSystem() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const colors = new Float32Array(this.particleCount * 3);
        const sizes = new Float32Array(this.particleCount);

        // Create sphere of particles
        for (let i = 0; i < this.particleCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = 15;

            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            // Purple color with variation
            colors[i * 3] = 0.5 + Math.random() * 0.3; // R
            colors[i * 3 + 1] = 0.2 + Math.random() * 0.2; // G
            colors[i * 3 + 2] = 0.9 + Math.random() * 0.1; // B

            sizes[i] = Math.random() * 2 + 0.5;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        // Store original positions
        this.originalPositions = positions.slice();

        // Material with additive blending for glow effect
        const material = new THREE.PointsMaterial({
            size: 1,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });

        this.particleSystem = new THREE.Points(geometry, material);
        this.scene.add(this.particleSystem);
    }

    setupSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported');
            this.showError('Speech recognition not supported in this browser. Use Chrome or Edge.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.speechRecognition = new SpeechRecognition();
        
        this.speechRecognition.continuous = true;
        this.speechRecognition.interimResults = true;
        this.speechRecognition.lang = 'en-US';

        this.speechRecognition.onstart = () => {
            this.isListening = true;
            this.updateListeningStatus(true);
        };

        this.speechRecognition.onend = () => {
            this.isListening = false;
            this.updateListeningStatus(false);
        };

        this.speechRecognition.onresult = (event) => {
            const last = event.results.length - 1;
            const transcript = event.results[last][0].transcript.trim();
            
            if (event.results[last].isFinal) {
                this.handleSpeechResult(transcript);
            }
        };

        this.speechRecognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.showError(`Speech recognition error: ${event.error}`);
        };
    }

    setupEventListeners() {
        const startBtn = document.getElementById('start-btn');
        const canvas = document.getElementById('particle-canvas');

        startBtn.addEventListener('click', () => {
            this.toggleListening();
        });

        canvas.addEventListener('click', () => {
            if (!this.isListening) {
                this.toggleListening();
            }
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    toggleListening() {
        if (!this.speechRecognition) {
            this.showError('Speech recognition not available');
            return;
        }

        if (this.isListening) {
            this.speechRecognition.stop();
        } else {
            this.speechRecognition.start();
        }
    }

    updateListeningStatus(listening) {
        const status = document.getElementById('listening-status');
        const btn = document.getElementById('start-btn');
        
        if (listening) {
            status.textContent = '🟢 Listening...';
            status.className = 'listening';
            btn.textContent = 'Stop Listening';
            btn.className = 'listening';
        } else {
            status.textContent = '🔴 Not Listening';
            status.className = 'not-listening';
            btn.textContent = 'Start Listening';
            btn.className = '';
        }
    }

    handleSpeechResult(transcript) {
        const textElement = document.getElementById('recognized-text');
        textElement.textContent = `"${transcript}"`;
        
        console.log('Speech detected:', transcript); // Debug log
        
        // Morph particles to text
        this.morphToText(transcript);
    }

    morphToText(text) {
        if (this.isAnimating) return;
        
        console.log('Starting morph to:', text); // Debug log
        this.isAnimating = true;
        
        // Create 3D text geometry
        const loader = new THREE.FontLoader();
        
        // Since we can't load external fonts easily, we'll create a simple text representation
        // using a grid-based approach
        const textPositions = this.createTextPositions(text);
        
        console.log('Text positions created:', textPositions.length); // Debug log
        
        // Animate particles to text positions
        this.animateParticles(textPositions);
    }

    createTextPositions(text) {
        const positions = [];
        const textLength = text.length;
        const gridSize = Math.ceil(Math.sqrt(this.particleCount));
        
        // Simple text representation - create letter patterns
        for (let i = 0; i < this.particleCount; i++) {
            if (i < textLength * 100) { // Distribute particles for text
                const charIndex = Math.floor(i / 100);
                const particleInChar = i % 100;
                
                // Create simple letter patterns
                const char = text[charIndex] || '?';
                const charPositions = this.getCharacterPositions(char, particleInChar);
                
                positions.push(
                    charPositions.x - (textLength * 3) / 2, // Center the text
                    charPositions.y,
                    charPositions.z
                );
            } else {
                // Extra particles go to random positions around text
                positions.push(
                    (Math.random() - 0.5) * 50,
                    (Math.random() - 0.5) * 20,
                    (Math.random() - 0.5) * 10
                );
            }
        }
        
        return positions;
    }

    getCharacterPositions(char, index) {
        // Simple character representation
        const chars = {
            'A': () => this.createLetterA(index),
            'E': () => this.createLetterE(index),
            'H': () => this.createLetterH(index),
            'L': () => this.createLetterL(index),
            'O': () => this.createLetterO(index),
            ' ': () => ({ x: 0, y: 0, z: 0 }),
            'default': () => this.createDefaultChar(index)
        };
        
        const createFunc = chars[char.toUpperCase()] || chars['default'];
        return createFunc();
    }

    createLetterA(index) {
        const t = index / 100;
        if (t < 0.3) {
            return { x: -2, y: 2 - t * 15, z: 0 };
        } else if (t < 0.6) {
            return { x: -2 + (t - 0.3) * 20, y: -2.5, z: 0 };
        } else {
            return { x: 2, y: -2.5 + (t - 0.6) * 15, z: 0 };
        }
    }

    createLetterE(index) {
        const t = index / 100;
        if (t < 0.25) {
            return { x: -2, y: 2 - t * 15, z: 0 };
        } else if (t < 0.5) {
            return { x: -2 + (t - 0.25) * 16, y: 2, z: 0 };
        } else if (t < 0.75) {
            return { x: -2 + (t - 0.5) * 16, y: -0.5, z: 0 };
        } else {
            return { x: -2 + (t - 0.75) * 16, y: -2.5, z: 0 };
        }
    }

    createLetterH(index) {
        const t = index / 100;
        if (t < 0.4) {
            return { x: -2, y: 2 - t * 11.25, z: 0 };
        } else if (t < 0.6) {
            return { x: -2 + (t - 0.4) * 20, y: -0.5, z: 0 };
        } else {
            return { x: 2, y: -0.5 - (t - 0.6) * 11.25, z: 0 };
        }
    }

    createLetterL(index) {
        const t = index / 100;
        if (t < 0.7) {
            return { x: -2, y: 2 - t * 6.43, z: 0 };
        } else {
            return { x: -2 + (t - 0.7) * 6.67, y: -2.5, z: 0 };
        }
    }

    createLetterO(index) {
        const t = index / 100;
        const angle = t * Math.PI * 2;
        return {
            x: Math.cos(angle) * 2,
            y: Math.sin(angle) * 2.5,
            z: 0
        };
    }

    createDefaultChar(index) {
        const t = index / 100;
        return {
            x: (Math.random() - 0.5) * 4,
            y: (Math.random() - 0.5) * 5,
            z: 0
        };
    }

    animateParticles(targetPositions) {
        console.log('Starting particle animation'); // Debug log
        const positions = this.particleSystem.geometry.attributes.position.array;
        
        // Create GSAP timeline for smooth animation
        const tl = gsap.timeline({
            onComplete: () => {
                this.isAnimating = false;
                console.log('Animation completed'); // Debug log
                // Return to sphere after 3 seconds
                setTimeout(() => {
                    this.returnToSphere();
                }, 3000);
            }
        });

        // Animate all particles at once for better performance
        tl.to({}, {
            duration: 2,
            ease: "power2.inOut",
            onUpdate: () => {
                const progress = tl.progress();
                for (let i = 0; i < this.particleCount; i++) {
                    positions[i * 3] = gsap.utils.interpolate(
                        this.originalPositions[i * 3],
                        targetPositions[i].x,
                        progress
                    );
                    positions[i * 3 + 1] = gsap.utils.interpolate(
                        this.originalPositions[i * 3 + 1],
                        targetPositions[i].y,
                        progress
                    );
                    positions[i * 3 + 2] = gsap.utils.interpolate(
                        this.originalPositions[i * 3 + 2],
                        targetPositions[i].z,
                        progress
                    );
                }
                this.particleSystem.geometry.attributes.position.needsUpdate = true;
            }
        });
    }

    returnToSphere() {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        const positions = this.particleSystem.geometry.attributes.position.array;
        
        const tl = gsap.timeline({
            onComplete: () => {
                this.isAnimating = false;
            }
        });

        for (let i = 0; i < this.particleCount; i++) {
            tl.to(positions, {
                duration: 2,
                ease: "power2.inOut",
                onUpdate: function() {
                    const progress = this.progress();
                    positions[i * 3] = gsap.utils.interpolate(
                        positions[i * 3],
                        this.originalPositions[i * 3],
                        progress
                    );
                    positions[i * 3 + 1] = gsap.utils.interpolate(
                        positions[i * 3 + 1],
                        this.originalPositions[i * 3 + 1],
                        progress
                    );
                    positions[i * 3 + 2] = gsap.utils.interpolate(
                        positions[i * 3 + 2],
                        this.originalPositions[i * 3 + 2],
                        progress
                    );
                },
                onUpdateScope: tl
            }, i * 0.001);
        }

        tl.eventCallback("onUpdate", () => {
            this.particleSystem.geometry.attributes.position.needsUpdate = true;
        });
    }

    showError(message) {
        const textElement = document.getElementById('recognized-text');
        textElement.textContent = message;
        textElement.style.color = '#ef4444';
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Rotate particle system slowly
        if (this.particleSystem && !this.isAnimating) {
            this.particleSystem.rotation.x += 0.001;
            this.particleSystem.rotation.y += 0.002;
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new VoiceParticleMorph();
});

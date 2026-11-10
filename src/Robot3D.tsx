import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { ExaminerPhase } from "./Examiner";

/**
 * The examiner as a real-time 3D robot: a glossy ceramic head with a black
 * glass visor, glowing eyes and an LED mouth that follows the examiner's voice.
 * Loaded lazily with three.js, only on the live interview. Without WebGL it
 * renders nothing and the speaking poster behind it stands alone.
 */
export default function Robot3D({ phase, levelRef }: { phase: ExaminerPhase; levelRef: { current: number } }) {
  const host = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      return; // no WebGL: the poster stays on its own
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 3, 4);
    const rim = new THREE.DirectionalLight(0x8a63f0, 2.4);
    rim.position.set(-3, 1.5, -2.5);
    scene.add(key, rim);

    const camera = new THREE.PerspectiveCamera(28, 2 / 3, 0.1, 20);
    camera.position.set(0, 0.12, 4.8);
    camera.lookAt(0, -0.15, 0);

    const robot = build();
    scene.add(robot.root);

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let level = 0, raf = 0;
    const tick = (now: number) => {
      const t = still ? 0 : now / 1000;
      const p = phaseRef.current;
      // Attack faster than release, as a voice does.
      const target = levelRef.current;
      level += (target - level) * (target > level ? 0.45 : 0.14);
      robot.update(p, level, t, still);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        for (const mat of ([] as THREE.Material[]).concat(m.material ?? [])) {
          (mat as THREE.MeshBasicMaterial).map?.dispose();
          mat.dispose();
        }
      });
      scene.environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // dispose() keeps the context; mobile browsers cap how many stay open
      renderer.domElement.remove();
    };
  }, [levelRef]);

  return <div className="examiner-robot" ref={host} aria-hidden="true" />;
}

const LED = "#cdbcff";

/** A soft glowing rounded shape on a transparent canvas, so the eyes and mouth
 *  read as light behind glass without a post-processing bloom pass. The core
 *  runs from a near-white top to `tint`, like an LED behind a lens. */
function glow(coreW: number, coreH: number, pad: number, tint = "#c7b5ff") {
  const s = 600; // canvas px per scene unit
  const c = document.createElement("canvas");
  c.width = Math.round((coreW + pad * 2) * s);
  c.height = Math.round((coreH + pad * 2) * s);
  const g = c.getContext("2d");
  if (g) {
    g.shadowColor = "#8a63f0";
    g.shadowBlur = pad * s * 0.6;
    const fill = g.createLinearGradient(0, pad * s, 0, (pad + coreH) * s);
    fill.addColorStop(0, "#f4f0ff");
    fill.addColorStop(1, tint);
    g.fillStyle = fill;
    g.beginPath();
    g.roundRect(pad * s, pad * s, coreW * s, coreH * s, (Math.min(coreW, coreH) * s) / 2);
    g.fill();
    g.fill(); // second pass deepens the halo
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  return { geo: new THREE.PlaneGeometry(coreW + pad * 2, coreH + pad * 2), mat };
}

function build() {
  const ceramic = new THREE.MeshPhysicalMaterial({ color: "#f3f0fa", roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 });
  const metal = new THREE.MeshStandardMaterial({ color: "#2a1c4a", metalness: 0.85, roughness: 0.28 });
  const glass = new THREE.MeshPhysicalMaterial({ color: "#06030d", metalness: 0.3, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 });
  const light = new THREE.MeshBasicMaterial({ color: LED, transparent: true });

  const root = new THREE.Group();
  const head = new THREE.Group();
  root.add(head);

  const skull = new THREE.Mesh(new RoundedBoxGeometry(1, 0.82, 0.86, 6, 0.26), ceramic);
  const visor = new THREE.Mesh(new RoundedBoxGeometry(0.82, 0.56, 0.2, 6, 0.09), glass);
  visor.position.z = 0.36;
  head.add(skull, visor);

  // Ears: metal drums with a light ring that answers the student's voice.
  const ears: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 40), metal);
    drum.rotation.z = Math.PI / 2;
    drum.position.x = side * 0.53;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 12, 48), light.clone());
    ring.rotation.y = Math.PI / 2;
    ring.position.x = side * 0.585;
    head.add(drum, ring);
    ears.push(ring);
  }

  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 12), metal);
  stalk.position.y = 0.5;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 16), light.clone());
  tip.position.y = 0.63;
  const tipGlow = glow(0.09, 0.09, 0.07);
  const tipHalo = new THREE.Mesh(tipGlow.geo, tipGlow.mat);
  tipHalo.position.y = 0.63;
  head.add(stalk, tip, tipHalo);

  const eyeGlow = glow(0.16, 0.095, 0.045, "#9f82ff");
  const eyes = [-1, 1].map((side) => {
    const eye = new THREE.Mesh(eyeGlow.geo, eyeGlow.mat);
    eye.position.set(side * 0.18, 0.07, 0.465);
    head.add(eye);
    return eye;
  });

  const barGlow = glow(0.036, 0.15, 0.035);
  const bars = BARS.map((_, i) => {
    const bar = new THREE.Mesh(barGlow.geo, barGlow.mat);
    bar.position.set((i - 2) * 0.075, -0.15, 0.466);
    head.add(bar);
    return bar;
  });

  const body = new THREE.Group();
  body.position.y = -0.48;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.16, 32), metal);
  const torso = new THREE.Mesh(new RoundedBoxGeometry(1.12, 0.9, 0.64, 6, 0.26), ceramic);
  torso.position.y = -0.53;
  // Chest: a dark glass port with a light ring, not a bare light on white.
  const port = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 40), glass);
  port.rotation.x = Math.PI / 2;
  port.position.set(0, -0.36, 0.32);
  const chest = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 12, 48), light.clone());
  chest.position.set(0, -0.36, 0.337);
  body.add(neck, torso, port, chest);
  root.add(body);

  const ease = (from: number, to: number, k = 0.08) => from + (to - from) * k;

  function update(phase: ExaminerPhase, level: number, t: number, still: boolean) {
    const speaking = phase === "speaking", listening = phase === "listening";
    const thinking = phase === "thinking", waiting = phase === "connecting";

    // Head: slow look-around shows it is solid; tilts toward the student while listening.
    const sway = still ? 0 : Math.sin(t * 0.55) * 0.16;
    head.rotation.y = ease(head.rotation.y, listening ? 0.22 : thinking ? -0.18 : sway);
    head.rotation.z = ease(head.rotation.z, listening ? -0.12 : 0);
    head.rotation.x = ease(head.rotation.x, thinking ? -0.1 : speaking ? -level * 0.08 : 0, speaking ? 0.3 : 0.08);
    root.position.y = still ? 0 : Math.sin(t * 1.3) * 0.018;

    // Eyes: blink every few seconds, scan while thinking, close when paused.
    const b = t % 4.6;
    const blink = still || b > 0.16 ? 1 : Math.abs(Math.cos((b / 0.16) * Math.PI));
    const open = phase === "paused" ? 0.12 : waiting ? 0.55 + 0.25 * Math.sin(t * 5) : listening ? 1.08 : 1;
    const scan = thinking ? Math.sin(t * 3.2) * 0.05 : 0;
    eyes.forEach((eye, i) => {
      eye.scale.y = ease(eye.scale.y, open * blink, 0.35);
      eye.position.x = (i ? 0.18 : -0.18) + scan;
    });
    eyeGlow.mat.opacity = phase === "paused" ? 0.45 : 1;

    // Mouth: the voice while speaking; a ripple while thinking; a soft smile of dots otherwise.
    bars.forEach((bar, i) => {
      const k = BARS[i];
      const h = speaking ? 0.2 + level * k * 1.1
        : thinking || waiting ? 0.2 + 0.32 * (0.5 + 0.5 * Math.sin(t * 6 - i * 0.8))
        : 0.2;
      bar.scale.y = ease(bar.scale.y, h, speaking ? 0.6 : 0.2);
      const smile = speaking ? 0 : (1 - ((i - 2) / 2) ** 2) * 0.025;
      bar.position.y = ease(bar.position.y, -0.15 - smile, 0.15);
    });

    // Lights: antenna carries the voice, ears and chest carry the student's.
    const tipOn = speaking ? 0.45 + level * 0.55 : thinking || waiting ? (Math.sin(t * 7) > 0 ? 1 : 0.25) : phase === "paused" ? 0.15 : 0.5;
    (tip.material as THREE.MeshBasicMaterial).opacity = tipOn;
    tipGlow.mat.opacity = tipOn;
    for (const ring of ears) (ring.material as THREE.MeshBasicMaterial).opacity = listening ? 0.35 + level * 0.65 : 0.2;
    (chest.material as THREE.MeshBasicMaterial).opacity = listening ? 0.5 + level * 0.5 : speaking ? 0.4 + level * 0.4 : 0.3;
    chest.scale.setScalar(listening ? 1 + level * 0.45 : 1);
  }

  return { root, update };
}

/** Relative height of each mouth bar: tall in the middle, like a voice print. */
const BARS = [0.55, 0.85, 1, 0.8, 0.5];

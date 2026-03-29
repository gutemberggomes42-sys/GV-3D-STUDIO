"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";

type ThreeFileViewerProps = {
  fileUrl: string;
  fileFormat: string;
};

function fitCamera(camera: THREE.PerspectiveCamera, object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  const distance = maxDimension * 1.9;

  camera.position.set(distance, distance * 0.75, distance);
  camera.lookAt(center);
}

export function ThreeFileViewer({ fileUrl, fileFormat }: ThreeFileViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#071018");

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / 280, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, 280);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight("#ffffff", 1.8);
    const keyLight = new THREE.DirectionalLight("#59b9ff", 2.4);
    keyLight.position.set(8, 10, 5);
    const rimLight = new THREE.DirectionalLight("#ff7a18", 1.6);
    rimLight.position.set(-6, 4, -3);
    scene.add(ambient, keyLight, rimLight);

    const grid = new THREE.GridHelper(10, 18, "#1f4355", "#0d2030");
    scene.add(grid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;

    let object: THREE.Object3D | null = null;

    const onLoad = (loadedObject: THREE.Object3D) => {
      object = loadedObject;
      scene.add(loadedObject);
      fitCamera(camera, loadedObject);
    };

    if (fileFormat === "stl") {
      const loader = new STLLoader();
      loader.load(fileUrl, (geometry) => {
        geometry.center();
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            color: "#59b9ff",
            metalness: 0.16,
            roughness: 0.35,
          }),
        );
        onLoad(mesh);
      });
    } else if (fileFormat === "3mf") {
      const loader = new ThreeMFLoader();
      loader.load(fileUrl, (group) => {
        onLoad(group);
      });
    } else {
      const loader = new OBJLoader();
      loader.load(fileUrl, (group) => {
        group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: "#35c8a4",
              metalness: 0.12,
              roughness: 0.4,
            });
          }
        });
        onLoad(group);
      });
    }

    const handleResize = () => {
      if (!containerRef.current) {
        return;
      }

      camera.aspect = containerRef.current.clientWidth / 280;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, 280);
    };

    const animationFrame = () => {
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animationFrame);
    };

    const frameId = requestAnimationFrame(animationFrame);
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      if (object) {
        scene.remove(object);
      }
    };
  }, [fileFormat, fileUrl]);

  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-3">
      <div ref={containerRef} className="h-[280px] overflow-hidden rounded-[20px]" />
    </div>
  );
}

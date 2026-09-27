// Low-res render with crisp pixel-art edges: dark outlines on silhouettes, light rims on convex edges.
// Layer 0 = solid things (outlined). Layer 1 = glass, ghosts, rings (drawn, never outlined).
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

export class PixelPass extends Pass {
  constructor(pixelSize, scene, camera, o = {}) {
    super();
    this.pixelSize = pixelSize; this.scene = scene; this.camera = camera;
    this.resolution = new THREE.Vector2(); this.low = new THREE.Vector2();
    this.normalMat = new THREE.MeshNormalMaterial();
    const rt = () => { const t = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }); t.texture.minFilter = t.texture.magFilter = THREE.NearestFilter; return t; };
    this.beauty = rt(); this.beauty.depthTexture = new THREE.DepthTexture(); this.normals = rt();
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null }, tNormal: { value: null },
        res: { value: new THREE.Vector4() }, near: { value: 1 }, far: { value: 1000 },
        dEdge: { value: o.depthEdge ?? 0.55 }, nEdge: { value: o.normalEdge ?? 0.28 }, dMin: { value: o.depthMin ?? 2.5 },
        outline: { value: new THREE.Color(o.outline || '#05040f') },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse, tDepth, tNormal; uniform vec4 res; uniform float near, far, dEdge, nEdge, dMin; uniform vec3 outline;
        varying vec2 vUv;
        float D(int x, int y){ float d = texture2D(tDepth, vUv + vec2(x,y) * res.zw).r; return near + d * (far - near); }
        vec3 N(int x, int y){ return texture2D(tNormal, vUv + vec2(x,y) * res.zw).rgb * 2.0 - 1.0; }
        float nEdgeAt(int x, int y, float d, vec3 n){
          float dd = D(x,y) - d; vec3 nn = N(x,y);
          float ni = clamp(smoothstep(-.01, .01, dot(n - nn, vec3(1.))), 0., 1.);
          float di = clamp(sign(dd * .25 + .0025), 0., 1.);
          return max(0., 1. - dot(n, nn)) * di * ni;
        }
        void main(){
          vec4 c = texture2D(tDiffuse, vUv);
          if (texture2D(tDepth, vUv).r > .99999) { gl_FragColor = vec4(max(c.rgb, vec3(0.)), 1.); return; }
          float d = D(0,0); vec3 n = N(0,0);
          float dd = 0.;
          dd += step(dMin, D(1,0) - d); dd += step(dMin, D(-1,0) - d); dd += step(dMin, D(0,1) - d); dd += step(dMin, D(0,-1) - d);
          float de = min(1., dd);
          float ne = 0.;
          if (de == 0. && length(n) > .5) { ne += nEdgeAt(0,-1,d,n); ne += nEdgeAt(0,1,d,n); ne += nEdgeAt(-1,0,d,n); ne += nEdgeAt(1,0,d,n); ne = step(.1, ne); }
          vec3 col = c.rgb;
          if (de > 0.) col = mix(col, outline, dEdge);
          else col *= 1. + ne * nEdge;
          gl_FragColor = vec4(max(col, vec3(0.)), 1.);
        }`,
    });
    this.quad = new FullScreenQuad(this.mat);
  }
  setSize(w, h) {
    this.resolution.set(w, h);
    this.low.set(Math.max(1, (w / this.pixelSize) | 0), Math.max(1, (h / this.pixelSize) | 0));
    this.beauty.setSize(this.low.x, this.low.y); this.normals.setSize(this.low.x, this.low.y);
    this.mat.uniforms.res.value.set(this.low.x, this.low.y, 1 / this.low.x, 1 / this.low.y);
  }
  setPixelSize(p) { this.pixelSize = p; this.setSize(this.resolution.x, this.resolution.y); }
  render(renderer, writeBuffer) {
    const cam = this.camera, u = this.mat.uniforms;
    u.near.value = cam.near; u.far.value = cam.far;
    const mask = cam.layers.mask;
    cam.layers.enable(0); cam.layers.enable(1);
    renderer.setRenderTarget(this.beauty); renderer.clear(); renderer.render(this.scene, cam);
    cam.layers.set(0);
    const bg = this.scene.background, fog = this.scene.fog;
    this.scene.background = null; this.scene.overrideMaterial = this.normalMat;
    renderer.setRenderTarget(this.normals); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(this.scene, cam);
    this.scene.overrideMaterial = null; this.scene.background = bg; this.scene.fog = fog;
    cam.layers.mask = mask;
    u.tDiffuse.value = this.beauty.texture; u.tDepth.value = this.beauty.depthTexture; u.tNormal.value = this.normals.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

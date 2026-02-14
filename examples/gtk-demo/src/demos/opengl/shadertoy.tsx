import type * as Gdk from "@gtkx/ffi/gdk";
import * as gl from "@gtkx/ffi/gl";
import * as GLib from "@gtkx/ffi/glib";
import * as Gtk from "@gtkx/ffi/gtk";
import type * as GtkSource from "@gtkx/ffi/gtksource";
import {
    GtkAspectFrame,
    GtkBox,
    GtkButton,
    GtkCenterBox,
    GtkGestureDrag,
    GtkGLArea,
    GtkGraphicsOffload,
    GtkScrolledWindow,
    GtkSourceView,
    x,
} from "@gtkx/react";
import { type RefCallback, useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./shadertoy.tsx?raw";

const VERTEX_SHADER_SOURCE =
    "uniform vec3 iResolution;\n" +
    "\n" +
    "in vec2 position;\n" +
    "out vec2 fragCoord;\n" +
    "\n" +
    "void main() {\n" +
    "    gl_Position = vec4(position, 0.0, 1.0);\n" +
    "    fragCoord = (gl_Position.xy + vec2(1.0)) / vec2(2.0) * iResolution.xy;\n" +
    "}\n";

const FRAGMENT_PREFIX =
    "uniform vec3      iResolution;\n" +
    "uniform float     iTime;\n" +
    "uniform float     iTimeDelta;\n" +
    "uniform int       iFrame;\n" +
    "uniform float     iChannelTime[4];\n" +
    "uniform vec3      iChannelResolution[4];\n" +
    "uniform vec4      iMouse;\n" +
    "uniform sampler2D iChannel0;\n" +
    "uniform sampler2D iChannel1;\n" +
    "uniform sampler2D iChannel2;\n" +
    "uniform sampler2D iChannel3;\n" +
    "uniform vec4      iDate;\n" +
    "uniform float     iSampleRate;\n" +
    "\n" +
    "in vec2 fragCoord;\n" +
    "out vec4 vFragColor;\n";

const FRAGMENT_SUFFIX =
    "    void main() {\n" +
    "        vec4 c;\n" +
    "        mainImage(c, fragCoord);\n" +
    "        vFragColor = c;\n" +
    "    }\n";

const SHADER_PREFIX = "#version 300 es\nprecision highp float;\n\n";

function buildVertexSource(): string {
    return SHADER_PREFIX + VERTEX_SHADER_SOURCE;
}

function buildFragmentSource(imageShader: string): string {
    return SHADER_PREFIX + FRAGMENT_PREFIX + imageShader + FRAGMENT_SUFFIX;
}

// Originally from: https://www.shadertoy.com/view/wsjBD3
// License CC0: A battered alien planet
const ALIEN_PLANET_SHADER = `#define PI  3.141592654
#define TAU (2.0*PI)

#define TOLERANCE       0.00001
#define MAX_ITER        65
#define MIN_DISTANCE    0.01
#define MAX_DISTANCE    9.0

const vec3  skyCol1       = vec3(0.35, 0.45, 0.6);
const vec3  skyCol2       = vec3(0.4, 0.7, 1.0);
const vec3  skyCol3       = pow(skyCol1, vec3(0.25));
const vec3  sunCol1       = vec3(1.0,0.6,0.4);
const vec3  sunCol2       = vec3(1.0,0.9,0.7);
const vec3  smallSunCol1  = vec3(1.0,0.5,0.25)*0.5;
const vec3  smallSunCol2  = vec3(1.0,0.5,0.25)*0.5;
const vec3  mountainColor = 1.0*sqrt(vec3(0.95, 0.65, 0.45));
const float cellWidth     = 1.0;
const vec4  planet        = vec4(80.0, -20.0, 100.0, 50.0)*1000.0;

void rot(inout vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  p = vec2(p.x*c + p.y*s, -p.x*s + p.y*c);
}

vec2 mod2(inout vec2 p, vec2 size) {
  vec2 c = floor((p + size*0.5)/size);
  p = mod(p + size*0.5,size) - size*0.5;
  return c;
}

float circle(vec2 p, float r) {
  return length(p) - r;
}

float egg(vec2 p, float ra, float rb) {
  const float k = sqrt(3.0);
  p.x = abs(p.x);
  float r = ra - rb;
  return ((p.y<0.0)       ? length(vec2(p.x,  p.y    )) - r :
          (k*(p.x+r)<p.y) ? length(vec2(p.x,  p.y-k*r)) :
                              length(vec2(p.x+r,p.y    )) - 2.0*r) - rb;
}

vec2 hash(vec2 p) {
  p = vec2(dot (p, vec2 (127.1, 311.7)), dot (p, vec2 (269.5, 183.3)));
  return -1. + 2.*fract (sin (p)*43758.5453123);
}

vec2 raySphere(vec3 ro, vec3 rd, vec4 sphere) {
  vec3 center = sphere.xyz;
  float radius = sphere.w;
  vec3 m = ro - center.xyz;
  float b = dot(m, rd);
  float c = dot(m, m) - radius*radius;
  if(c > 0.0 && b > 0.0) return vec2(-1.0, -1.0);
  float discr = b * b - c;
  if(discr < 0.0) return vec2(-1.0);
  float s = sqrt(discr);
  float t0 = -b - s;
  float t1 = -b + s;;
  return vec2(t0, t1);
}

float noize1(vec2 p) {
  vec2 n = mod2(p, vec2(cellWidth));
  vec2 hh = hash(sqrt(2.0)*(n+1000.0));
  hh.x *= hh.y;

  float r = 0.225*cellWidth;

  float d = circle(p, 2.0*r);

  float h = hh.x*smoothstep(0.0, r, -d);

  return h*0.25;
}

float noize2(vec2 p) {
  vec2 n = mod2(p, vec2(cellWidth));
  vec2 hh = hash(sqrt(2.0)*(n+1000.0));
  hh.x *= hh.y;

  rot(p, TAU*hh.y);
  float r = 0.45*cellWidth;

  float d = egg(p, 0.75*r, 0.5*r*abs(hh.y));

  float h = (hh.x)*smoothstep(0.0, r, -2.0*d);

  return h*0.275;
}


float height(vec2 p, float dd, int mx) {
  const float aa   = 0.45;
  const float ff   = 2.03;
  const float tt   = 1.2;
  const float oo   = 3.93;
  const float near = 0.25;
  const float far  = 0.65;

  float a = 1.0;
  float o = 0.2;
  float s = 0.0;
  float d = 0.0;

  int i = 0;

  for (; i < 4;++i) {
    float nn = a*noize2(p);
    s += nn;
    d += abs(a);
    p += o;
    a *= aa;
    p *= ff;
    o *= oo;
    rot(p, tt);
  }

  float lod = s/d;

  float rdd = dd/MAX_DISTANCE;
  mx = int(mix(float(4), float(mx), step(rdd, far)));

  for (; i < mx; ++i) {
    float nn = a*noize1(p);
    s += nn;
    d += abs(a);
    p += o;
    a *= aa;
    p *= ff;
    o *= oo;
    rot(p, tt);
  }

  float hid = (s/d);

  return mix(hid, lod, smoothstep(near, far, rdd));
}

float loheight(vec2 p, float d) {
  return height(p, d, 0);
}

float height(vec2 p, float d) {
  return height(p, d, 6);
}

float hiheight(vec2 p, float d) {
  return height(p, d, 8);
}

vec3 normal(vec2 p, float d) {
  vec2 eps = vec2(0.00125, 0.0);

  vec3 n;

  n.x = (hiheight(p - eps.xy, d) - hiheight(p + eps.xy, d));
  n.y = 2.0*eps.x;
  n.z = (hiheight(p - eps.yx, d) - hiheight(p + eps.yx, d));

  return normalize(n);
}

const float stepLength[] = float[](0.9, 0.25);


float march(vec3 ro, vec3 rd, out int max_iter) {
  float dt = 0.1;
  float d = MIN_DISTANCE;
  int currentStep = 0;
  float lastd = d;
  for (int i = 0; i < MAX_ITER; ++i)
  {
    vec3 p = ro + d*rd;
    float h = height(p.xz, d);

    if (d > MAX_DISTANCE) {
      max_iter = i;
      return MAX_DISTANCE;
    }

    float hd = p.y - h;

    if (hd < TOLERANCE) {
      ++currentStep;
      if (currentStep >= stepLength.length()) {
        max_iter = i;
        return d;
      }

      d = lastd;
      continue;
    }

    float sl = stepLength[currentStep];

    dt = max(hd, TOLERANCE)*sl + 0.0025*d;
    lastd = d;
    d += dt;
  }

  max_iter = MAX_ITER;
  return MAX_DISTANCE;
}

vec3 sunDirection() {
  return normalize(vec3(-0.5, 0.085, 1.0));
}

vec3 smallSunDirection() {
  return normalize(vec3(-0.2, -0.05, 1.0));
}

float psin(float f) {
  return 0.5 + 0.5*sin(f);
}

vec3 skyColor(vec3 ro, vec3 rd) {
  vec3 sunDir = sunDirection();
  vec3 smallSunDir = smallSunDirection();

  float sunDot = max(dot(rd, sunDir), 0.0);
  float smallSunDot = max(dot(rd, smallSunDir), 0.0);

  float angle = atan(rd.y, length(rd.xz))*2.0/PI;

  vec3 skyCol = mix(mix(skyCol1, skyCol2, max(0.0, angle)), skyCol3, clamp(-angle*2.0, 0.0, 1.0));

  vec3 sunCol = 0.5*sunCol1*pow(sunDot, 20.0) + 8.0*sunCol2*pow(sunDot, 2000.0);
  vec3 smallSunCol = 0.5*smallSunCol1*pow(smallSunDot, 200.0) + 8.0*smallSunCol2*pow(smallSunDot, 20000.0);

  vec3 dust = pow(sunCol2*mountainColor, vec3(1.75))*smoothstep(0.05, -0.1, rd.y)*0.5;

  vec2 si = raySphere(ro, rd, planet);

  vec3 planetSurface = ro + si.x*rd;
  vec3 planetNormal = normalize(planetSurface - planet.xyz);
  float planetDiff = max(dot(planetNormal, sunDir), 0.0);
  float planetBorder = max(dot(planetNormal, -rd), 0.0);
  float planetLat = (planetSurface.x+planetSurface.y)*0.0005;
  vec3 planetCol = mix(1.3*vec3(0.9, 0.8, 0.7), 0.3*vec3(0.9, 0.8, 0.7), pow(psin(planetLat+1.0)*psin(sqrt(2.0)*planetLat+2.0)*psin(sqrt(3.5)*planetLat+3.0), 0.5));

  vec3 final = vec3(0.0);

  final += step(0.0, si.x)*pow(planetDiff, 0.75)*planetCol*smoothstep(-0.075, 0.0, rd.y)*smoothstep(0.0, 0.1, planetBorder);

  final += skyCol + sunCol + smallSunCol + dust;

  return final;
}

vec3 getColor(vec3 ro, vec3 rd) {
  int max_iter = 0;
  vec3 skyCol = skyColor(ro, rd);
  vec3 col = vec3(0);

  float d = march(ro, rd, max_iter);

  if (d < MAX_DISTANCE)   {
    vec3 sunDir = sunDirection();
    vec3 osunDir = sunDir*vec3(-1.0, .0, -1.0);
    vec3 p = ro + d*rd;

    vec3 normal = normal(p.xz, d);

    float amb = 0.2;

    float dif1 = max(0.0, dot(sunDir, normal));
    vec3 shd1 = sunCol2*mix(amb, 1.0, pow(dif1, 0.75));

    float dif2 = max(0.0, dot(osunDir, normal));
    vec3 shd2 = sunCol1*mix(amb, 1.0, pow(dif2, 0.75));

    vec3 ref = reflect(rd, normal);
    vec3 rcol = skyColor(p, ref);

    col = mountainColor*amb*skyCol3;
    col += mix(shd1, shd2, -0.5)*mountainColor;
    float fre = max(dot(normal, -rd), 0.0);
    fre = pow(1.0 - fre, 5.0);
    col += rcol*fre*0.5;
    col += (1.0*p.y);
    col = tanh(col);
    col = mix(col, skyCol, smoothstep(0.5*MAX_DISTANCE, 1.0*MAX_DISTANCE, d));

  } else {
    col = skyCol;
  }

  return col;
}

vec3 getSample1(vec2 p, float time) {
  float off = 0.5*iTime;

  vec3 ro  = vec3(0.5, 1.0-0.25, -2.0 + off);
  vec3 la  = ro + vec3(0.0, -0.30,  2.0);

  vec3 ww = normalize(la - ro);
  vec3 uu = normalize(cross(vec3(0.0,1.0,0.0), ww));
  vec3 vv = normalize(cross(ww, uu));
  vec3 rd = normalize(p.x*uu + p.y*vv + 2.0*ww);

  vec3 col = getColor(ro, rd)  ;

  return col;
}

vec3 getSample2(vec2 p, float time) {
  p.y-=time*0.25;
  float h = height(p, 0.0);
  vec3 n = normal(p, 0.0);

  vec3 lp = vec3(10.0, -1.2, 0.0);

  vec3 ld = normalize(vec3(p.x, h, p.y)- lp);

  float d = max(dot(ld, n), 0.0);

  vec3 col = vec3(0.0);

  col = vec3(1.0)*(h+0.1);
  col += vec3(1.5)*pow(d, 0.75);

  return col;
}

void mainImage(out vec4 fragColor, vec2 fragCoord) {
  vec2 q = fragCoord.xy/iResolution.xy;
  vec2 p = -1.0 + 2.0*q;
  p.x *= iResolution.x/iResolution.y;

  vec3 col = getSample1(p, iTime);

  fragColor = vec4(col, 1.0);
}
`;

// Originally from: https://www.shadertoy.com/view/wdBfDK
// License: CC0
const MANDELBROT_SHADER = `#define MANDELBROT_ZOOM_START 0.0
#define MANDELBROT_ITER       240

void pR(inout vec2 p, in float a) {
  p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}

vec2 pMod2(inout vec2 p, in vec2 size) {
  vec2 c = floor((p + size*0.5)/size);
  p = mod(p + size*0.5,size) - size*0.5;
  return c;
}


vec3 mandelbrot(float time, vec2 p, out float ii) {
  vec3 col = vec3(0.0);

  float ztime = (time - MANDELBROT_ZOOM_START)*step(MANDELBROT_ZOOM_START, time);

  float zoo = 0.64 + 0.36*cos(.07*ztime);
  float coa = cos(0.15*(1.0-zoo)*ztime);
  float sia = sin(0.15*(1.0-zoo)*ztime);
  zoo = pow(zoo,8.0);
  vec2 xy = vec2( p.x*coa-p.y*sia, p.x*sia+p.y*coa);
  vec2 c = vec2(-.745,.186) + xy*zoo;

  const float B = 10.0;
  float l = 0.0;
  vec2 z  = vec2(0.0);

  vec2 zc = vec2(1.0);

  pR(zc, ztime);

  float d = 1e20;

  int i = 0;

  for(int j = 0; j < MANDELBROT_ITER; ++j) {
    float re2 = z.x*z.x;
    float im2 = z.y*z.y;
    float reim= z.x*z.y;

    if(re2 + im2 > (B*B)) break;

    z = vec2(re2 - im2, 2.0*reim) + c;

    vec2 zm = z;
    vec2 n = pMod2(zm, vec2(4));
    vec2 pp = zm - zc;
    float dd = dot(pp, pp);

    d = min(d, dd);

    l += 1.0;

    i = j;
  }

  ii = float(i)/float(MANDELBROT_ITER);

  float sl = l - log2(log2(dot(z,z))) + 4.0;

  vec3 dc = vec3(pow(max(1.0 - d, 0.0), 20.0));
  vec3 gc = 0.5 + 0.5*cos(3.0 + sl*0.15 + vec3(0.1,0.5,0.9));
  return gc + dc*smoothstep(28.8, 29.0, ztime);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float s = 2.0/iResolution.y;

  vec2 o1 = vec2(1.0/8.0, 3.0/8.0)*s;
  vec2 o2 = vec2(-3.0/8.0, 1.0/8.0)*s;

  vec2 p = (-iResolution.xy + 2.0*fragCoord.xy)/iResolution.y;
  float ii = 0.0;
  vec3 col = mandelbrot(iTime, p+o1, ii);

  vec2 dii2 = vec2(dFdx(ii), dFdy(ii));
  float dii = length(dii2);

  if(abs(dii) > 0.01) {
    col += mandelbrot(iTime, p-o1, ii);
    col += mandelbrot(iTime, p+o2, ii);
    col += mandelbrot(iTime, p-o2, ii);
    col *=0.25;
  }

  fragColor = vec4(col, 1.0);
}
`;

// Originally from: https://www.shadertoy.com/view/WlByzy
// License CC0: Neonwave style road, sun and city
const NEON_SHADER = `#define PI          3.141592654
#define TAU         (2.0*PI)

#define TIME        iTime
#define RESOLUTION  iResolution

vec3 hsv2rgb(vec3 c) {
  const vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float hash(in float co) {
  return fract(sin(co*12.9898) * 13758.5453);
}

float hash(in vec2 co) {
  return fract(sin(dot(co.xy ,vec2(12.9898,58.233))) * 13758.5453);
}

float psin(float a) {
  return 0.5 + 0.5*sin(a);
}

float mod1(inout float p, float size) {
  float halfsize = size*0.5;
  float c = floor((p + halfsize)/size);
  p = mod(p + halfsize, size) - halfsize;
  return c;
}

float circle(vec2 p, float r) {
  return length(p) - r;
}

float box(vec2 p, vec2 b) {
  vec2 d = abs(p)-b;
  return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

float planex(vec2 p, float w) {
  return abs(p.y) - w;
}

float planey(vec2 p, float w) {
  return abs(p.x) - w;
}

float pmin(float a, float b, float k) {
  float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
  return mix( b, a, h ) - k*h*(1.0-h);
}

float pmax(float a, float b, float k) {
  return -pmin(-a, -b, k);
}

float sun(vec2 p) {
  const float ch = 0.0125;
  vec2 sp = p;
  vec2 cp = p;
  mod1(cp.y, ch*6.0);

  float d0 = circle(sp, 0.5);
  float d1 = planex(cp, ch);
  float d2 = p.y+ch*3.0;

  float d = d0;
  d = pmax(d, -max(d1, d2), ch*2.0);

  return d;
}

float city(vec2 p) {
  float sd = circle(p, 0.5);
  float cd = 1E6;

  const float count = 5.0;
  const float width = 0.1;

  for (float i = 0.0; i < count; ++i) {
    vec2 pp = p;
    pp.x += i*width/count;
    float nn = mod1(pp.x, width);
    float rr = hash(nn+sqrt(3.0)*i);
    float dd = box(pp-vec2(0.0, -0.5), vec2(0.02, 0.35*(1.0-smoothstep(0.0, 5.0, abs(nn)))*rr+0.1));
    cd = min(cd, dd);
  }

  return max(sd,cd);
}
vec3 sunEffect(vec2 p) {
  float aa = 4.0 / RESOLUTION.y;

  vec3 col = vec3(0.1);
  vec3 skyCol1 = hsv2rgb(vec3(283.0/360.0, 0.83, 0.16));
  vec3 skyCol2 = hsv2rgb(vec3(297.0/360.0, 0.79, 0.43));
  col = mix(skyCol1, skyCol2, pow(clamp(0.5*(1.0+p.y+0.1*sin(4.0*p.x+TIME*0.5)), 0.0, 1.0), 4.0));

  p.y -= 0.375;
  float ds = sun(p);
  float dc = city(p);

  float dd = circle(p, 0.5);

  vec3 sunCol = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 1.0), clamp(0.5 - 1.0*p.y, 0.0, 1.0));
  vec3 glareCol = sqrt(sunCol);
  vec3 cityCol = sunCol*sunCol;

  col += glareCol*(exp(-30.0*ds))*step(0.0, ds);


  float t1 = smoothstep(0.0, 0.075, -dd);
  float t2 = smoothstep(0.0, 0.3, -dd);
  col = mix(col, sunCol, smoothstep(-aa, 0.0, -ds));
  col = mix(col, glareCol, smoothstep(-aa, 0.0, -dc)*t1);
  col += vec3(0.0, 0.25, 0.0)*(exp(-90.0*dc))*step(0.0, dc)*t2;

  return col;
}

float ground(vec2 p) {
  p.y += TIME*80.0;
  p *= 0.075;
  vec2 gp = p;
  gp = fract(gp) - vec2(0.5);
  float d0 = abs(gp.x);
  float d1 = abs(gp.y);
  float d2 = circle(gp, 0.05);

  const float rw = 2.5;
  const float sw = 0.0125;

  vec2 rp = p;
  mod1(rp.y, 12.0);
  float d3 = abs(rp.x) - rw;
  float d4 = abs(d3) - sw*2.0;
  float d5 = box(rp, vec2(sw*2.0, 2.0));
  vec2 sp = p;
  mod1(sp.y, 4.0);
  sp.x = abs(sp.x);
  sp -= vec2(rw - 0.125, 0.0);
  float d6 = box(sp, vec2(sw, 1.0));

  float d = d0;
  d = pmin(d, d1, 0.1);
  d = max(d, -d3);
  d = min(d, d4);
  d = min(d, d5);
  d = min(d, d6);

  return d;
}

vec3 groundEffect(vec2 p) {
  vec3 ro = vec3(0.0, 20.0, 0.0);
  vec3 ww = normalize(vec3(0.0, -0.025, 1.0));
  vec3 uu = normalize(cross(vec3(0.0,1.0,0.0), ww));
  vec3 vv = normalize(cross(ww,uu));
  vec3 rd = normalize(p.x*uu + p.y*vv + 2.5*ww);

  float distg = (-9.0 - ro.y)/rd.y;

  const vec3 shineCol = 0.75*vec3(0.5, 0.75, 1.0);
  const vec3 gridCol = vec3(1.0);

  vec3 col = vec3(0.0);
  if (distg > 0.0) {
    vec3 pg = ro + rd*distg;
    float aa = length(dFdx(pg))*0.0002*RESOLUTION.x;

    float dg = ground(pg.xz);

    col = mix(col, gridCol, smoothstep(-aa, 0.0, -(dg+0.0175)));
    col += shineCol*(exp(-10.0*clamp(dg, 0.0, 1.0)));
    col = clamp(col, 0.0, 1.0);

    col *= pow(1.0-smoothstep(ro.y*3.0, 220.0+ro.y*2.0, distg), 2.0);
  }

  return col;
}

vec3 postProcess(vec3 col, vec2 q)  {
  col = clamp(col,0.0,1.0);
  col=col*0.6+0.4*col*col*(3.0-2.0*col);
  col=mix(col, vec3(dot(col, vec3(0.33))), -0.4);
  col*=0.5+0.5*pow(19.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.7);
  return col;
}

vec3 effect(vec2 p, vec2 q) {
  vec3 col = vec3(0.0);

  vec2 off = vec2(0.0, 0.0);

  col += sunEffect(p+off);
  col += groundEffect(p+off);

  col = postProcess(col, q);
  return col;
}

void mainImage(out vec4 fragColor, vec2 fragCoord) {
  vec2 q = fragCoord/iResolution.xy;
  vec2 p = -1. + 2. * q;
  p.x *= RESOLUTION.x / RESOLUTION.y;

  vec3 col = effect(p, q);

  fragColor = vec4(col, 1.0);
}
`;

// Originally from: https://www.shadertoy.com/view/3ljyDD
// License CC0: Hexagonal tiling + cog wheels
const COGS_SHADER = `#define PI      3.141592654
#define TAU     (2.0*PI)
#define MROT(a) mat2(cos(a), sin(a), -sin(a), cos(a))

float hash(in vec2 co) {
  return fract(sin(dot(co.xy ,vec2(12.9898,58.233))) * 13758.5453);
}

float pcos(float a) {
  return 0.5 + 0.5*cos(a);
}

void rot(inout vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  p = vec2(c*p.x + s*p.y, -s*p.x + c*p.y);
}

float modPolar(inout vec2 p, float repetitions) {
  float angle = 2.0*PI/repetitions;
  float a = atan(p.y, p.x) + angle/2.;
  float r = length(p);
  float c = floor(a/angle);
  a = mod(a,angle) - angle/2.;
  p = vec2(cos(a), sin(a))*r;
  if (abs(c) >= (repetitions/2.0)) c = abs(c);
  return c;
}

float pmin(float a, float b, float k) {
  float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
  return mix( b, a, h ) - k*h*(1.0-h);
}

const vec2 sz       = vec2(1.0, sqrt(3.0));
const vec2 hsz      = 0.5*sz;
const float smallCount = 16.0;

vec2 hextile(inout vec2 p) {
  vec2 p1 = mod(p, sz)-hsz;
  vec2 p2 = mod(p - hsz*1.0, sz)-hsz;
  vec2 p3 = mix(p2, p1, vec2(length(p1) < length(p2)));
  vec2 n = p3 - p;
  p = p3;

  return n;
}

float circle(vec2 p, float r) {
  return length(p) - r;
}

float box(vec2 p, vec2 b) {
  vec2 d = abs(p)-b;
  return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

float unevenCapsule(vec2 p, float r1, float r2, float h) {
  p.x = abs(p.x);
  float b = (r1-r2)/h;
  float a = sqrt(1.0-b*b);
  float k = dot(p,vec2(-b,a));
  if( k < 0.0 ) return length(p) - r1;
  if( k > a*h ) return length(p-vec2(0.0,h)) - r2;
  return dot(p, vec2(a,b) ) - r1;
}

float cogwheel(vec2 p, float innerRadius, float outerRadius, float cogs, float holes) {
  float cogWidth  = 0.25*innerRadius*TAU/cogs;

  float d0 = circle(p, innerRadius);

  vec2 icp = p;
  modPolar(icp, holes);
  icp -= vec2(innerRadius*0.55, 0.0);
  float d1 = circle(icp, innerRadius*0.25);

  vec2 cp = p;
  modPolar(cp, cogs);
  cp -= vec2(innerRadius, 0.0);
  float d2 = unevenCapsule(cp.yx, cogWidth, cogWidth*0.75, (outerRadius-innerRadius));

  float d3 = circle(p, innerRadius*0.20);

  float d = 1E6;
  d = min(d, d0);
  d = pmin(d, d2, 0.5*cogWidth);
  d = min(d, d2);
  d = max(d, -d1);
  d = max(d, -d3);

  return d;
}

float ccell1(vec2 p, float r) {
  float d = 1E6;
  const float bigCount = 60.0;

  vec2 cp0 = p;
  rot(cp0, -iTime*TAU/bigCount);
  float d0 = cogwheel(cp0, 0.36, 0.38, bigCount, 5.0);

  vec2 cp1 = p;
  float nm = modPolar(cp1, 6.0);

  cp1 -= vec2(0.5, 0.0);
  rot(cp1, 0.2+TAU*nm/2.0 + iTime*TAU/smallCount);
  float d1 = cogwheel(cp1, 0.11, 0.125, smallCount, 5.0);

  d = min(d, d0);
  d = min(d, d1);
  return d;
}

float ccell2(vec2 p, float r) {
  float d = 1E6;
  vec2 cp0 = p;
  float nm = modPolar(cp0, 6.0);
  vec2 cp1 = cp0;
  const float off = 0.275;
  const float count = smallCount + 2.0;
  cp0 -= vec2(off, 0.0);
  rot(cp0, 0.+TAU*nm/2.0 - iTime*TAU/count);
  float d0 = cogwheel(cp0, 0.09, 0.105, count, 5.0);


  cp1 -= vec2(0.5, 0.0);
  rot(cp1, 0.2+TAU*nm/2.0 + iTime*TAU/smallCount);
  float d1 = cogwheel(cp1, 0.11, 0.125, smallCount, 5.0);

  float l = length(p);
  float d2 = l - (off+0.055);
  float d3 = d2 + 0.020;;

  vec2 tp0 = p;
  modPolar(tp0, 60.0);
  tp0.x -= off;
  float d4 = box(tp0, vec2(0.0125, 0.005));

  float ctime = -(iTime*0.05 + r)*TAU;

  vec2 tp1 = p;
  rot(tp1, ctime*12.0);
  tp1.x -= 0.13;
  float d5 = box(tp1, vec2(0.125, 0.005));

  vec2 tp2 = p;
  rot(tp2, ctime);
  tp2.x -= 0.13*0.5;
  float d6 = box(tp2, vec2(0.125*0.5, 0.0075));

  float d7 = l - 0.025;
  float d8 = l - 0.0125;

  d = min(d, d0);
  d = min(d, d1);
  d = min(d, d2);
  d = max(d, -d3);
  d = min(d, d4);
  d = min(d, d5);
  d = min(d, d6);
  d = min(d, d7);
  d = max(d, -d8);

  return d;
}

float df(vec2 p, float scale, inout vec2 nn) {
  p /= scale;
  nn = hextile(p);
  nn = floor(nn + 0.5);
  float r = hash(nn);

  float d;;

  if (r < 0.5) {
    d = ccell1(p, r);
  } else {
    d = ccell2(p, r);
  }

  return d*scale;
}

vec3 postProcess(vec3 col, vec2 q)  {
  col=pow(clamp(col,0.0,1.0),vec3(0.75));
  col=col*0.6+0.4*col*col*(3.0-2.0*col);
  col=mix(col, vec3(dot(col, vec3(0.33))), -0.4);
  col*=0.5+0.5*pow(19.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.7);
  return col;
}

void mainImage(out vec4 fragColor, vec2 fragCoord) {
  vec2 q = fragCoord/iResolution.xy;
  vec2 p = -1.0 + 2.0*q;
  p.x *= iResolution.x/iResolution.y;
  float tm = iTime*0.1;
  p += vec2(cos(tm), sin(tm*sqrt(0.5)));
  float z = mix(0.5, 1.0, pcos(tm*sqrt(0.3)));
  float aa = 4.0 / iResolution.y;

  vec2 nn = vec2(0.0);
  float d = df(p, z, nn);

  vec3 col = vec3(160.0)/vec3(255.0);
  vec3 baseCol = vec3(0.3);
  vec4 logoCol = vec4(baseCol, 1.0)*smoothstep(-aa, 0.0, -d);
  col = mix(col, logoCol.xyz, pow(logoCol.w, 8.0));
  col += 0.4*pow(abs(sin(20.0*d)), 0.6);

  col = postProcess(col, q);

  fragColor = vec4(col, 1.0);
}
`;

// Originally from: https://www.shadertoy.com/view/ttBcRV
// License CC0: Flying through glowing stars
const GLOWING_STARS_SHADER = `#define PI              3.141592654
#define TAU             (2.0*PI)
#define TIME            iTime
#define RESOLUTION      iResolution

#define LESS(a,b,c)     mix(a,b,step(0.,c))
#define SABS(x,k)       LESS((.5/(k))*(x)*(x)+(k)*.5,abs(x),abs(x)-(k))

#define MROT(a) mat2(cos(a), sin(a), -sin(a), cos(a))

vec3 hsv2rgb(vec3 c) {
  const vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float hash(in vec3 co) {
  return fract(sin(dot(co, vec3(12.9898,58.233, 12.9898+58.233))) * 13758.5453);
}

float starn(vec2 p, float r, int n, float m) {
  float an = 3.141593/float(n);
  float en = 3.141593/m;
  vec2  acs = vec2(cos(an),sin(an));
  vec2  ecs = vec2(cos(en),sin(en));

  float bn = mod(atan(p.x,p.y),2.0*an) - an;
  p = length(p)*vec2(cos(bn),SABS(sin(bn), 0.15));
  p -= r*acs;
  p += ecs*clamp( -dot(p,ecs), 0.0, r*acs.y/ecs.y);
  return length(p)*sign(p.x);
}

vec4 alphaBlend(vec4 back, vec4 front) {
  vec3 xyz = mix(back.xyz*back.w, front.xyz, front.w);
  float w = mix(back.w, 1.0, front.w);
  return vec4(xyz, w);
}

void rot(inout vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  p = vec2(c*p.x + s*p.y, -s*p.x + c*p.y);
}

vec3 offset(float z) {
  float a = z;
  vec2 p = -0.075*(vec2(cos(a), sin(a*sqrt(2.0))) + vec2(cos(a*sqrt(0.75)), sin(a*sqrt(0.5))));
  return vec3(p, z);
}

vec3 doffset(float z) {
  float eps = 0.05;
  return 0.5*(offset(z + eps) - offset(z - eps))/eps;
}

vec3 ddoffset(float z) {
  float eps = 0.05;
  return 0.5*(doffset(z + eps) - doffset(z - eps))/eps;
}

vec4 planeCol(vec3 ro, vec3 rd, float n, vec3 pp) {
  const float s = 0.5;

  vec2 p = pp.xy;
  float z = pp.z;
  vec2 dpy = dFdy(p);
  float aa = length(dpy);

  p -= (1.0+5.0*(pp.z - ro.z))*offset(z).xy;

  p *= s;
  float r = hash(vec3(floor(p+0.5), n));
  p = fract(p+0.5)-0.5;
  rot(p, ((TAU*r+n)*0.25));
  float d = starn(p, 0.20, 3 + 2*int(3.0*r), 3.0);
  d -= 0.06;
  d/=s;

  float ds = -d+0.03;
  vec3 cols = hsv2rgb(vec3(337.0/360.0+0.1*sin(n*0.3), 0.8, 0.54+0.2*sin(n*0.3)));
  float ts = 1.0 - smoothstep(-aa, 0.0, ds);
  vec4 cs =  vec4(cols, ts*0.93);

  float db = abs(d) - (0.06);
  db = abs(db) - 0.03;
  db = abs(db) - 0.00;
  db = max(db, -d+0.03);
    vec3 colb = vec3(1.0, 0.7, 0.5);
  float tb = exp(-(db)*30.0*(1.0 - 10.0*aa));
  vec4 cb = vec4(1.5*colb, tb);

  vec4 ct = alphaBlend(cs, cb);

  return ct;
}

vec3 color(vec3 ww, vec3 uu, vec3 vv, vec3 ro, vec2 p) {
  vec3 rd = normalize(p.x*uu + p.y*vv + (2.0-tanh(length(p)))*ww);

  vec4 col = vec4(vec3(0.0), 1.0);

  const float planeDist = 1.0;
  const int furthest = 6;
  const int fadeFrom = furthest-3;

  float nz = floor(ro.z / planeDist);

  for (int i = furthest; i >= 1; --i) {
    float pz = planeDist*nz + planeDist*float(i);

    float pd = (pz - ro.z)/rd.z;

    if (pd > 0.0) {
      vec3 pp = ro + rd*pd;

      vec4 pcol = planeCol(ro, rd, nz+float(i), pp);
      float fadeIn = 1.0-smoothstep(planeDist*float(fadeFrom), planeDist*float(furthest), pp.z-ro.z);
      pcol.xyz *= sqrt(fadeIn);

      col = alphaBlend(col, pcol);
    }
  }

  return col.xyz*col.w;
}

vec3 postProcess(vec3 col, vec2 q)  {
  col=pow(clamp(col,0.0,1.0),vec3(0.75));
  col=col*0.6+0.4*col*col*(3.0-2.0*col);
  col=mix(col, vec3(dot(col, vec3(0.33))), -0.4);
  col*=0.5+0.5*pow(19.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.7);
  return col;
}

vec3 effect(vec2 p, vec2 q) {
  float tm = TIME*0.65;

  vec3 ro   = offset(tm);
  vec3 dro  = doffset(tm);
  vec3 ddro = ddoffset(tm);

  vec3 ww = normalize(dro);
  vec3 uu = normalize(cross(vec3(0.0,1.0,0.0)+1.5*ddro, ww));
  vec3 vv = normalize(cross(ww, uu));

  vec3 col = color(ww, uu, vv, ro, p);
  col = postProcess(col, q);

  const float fadeIn = 2.0;

  return col*smoothstep(0.0, fadeIn, TIME);
}

void mainImage(out vec4 fragColor, vec2 fragCoord) {
  vec2 q = fragCoord/RESOLUTION.xy;
  vec2 p = -1. + 2. * q;
  p.x *= RESOLUTION.x/RESOLUTION.y;

  vec3 col = effect(p, q);

  fragColor = vec4(col, 1.0);
}
`;

const SHADER_PRESETS = [
    { name: "Alien Planet", code: ALIEN_PLANET_SHADER },
    { name: "Mandelbrot", code: MANDELBROT_SHADER },
    { name: "Neon", code: NEON_SHADER },
    { name: "Cogs", code: COGS_SHADER },
    { name: "Glowing Stars", code: GLOWING_STARS_SHADER },
];

const QUAD_VERTICES = [
    -1.0, -1.0, 0.0, 1.0, -1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 0.0, 1.0, -1.0, -1.0, 0.0, 1.0, 1.0, 1.0, 0.0, 1.0, 1.0, -1.0,
    0.0, 1.0,
];

interface GLState {
    program: number;
    vao: number;
    vbo: number;
    uniforms: {
        resolution: number;
        time: number;
        timedelta: number;
        frame: number;
        mouse: number;
    };
}

interface AnimState {
    firstFrameTime: number;
    firstFrame: number;
    time: number;
    timedelta: number;
    frame: number;
    mouse: [number, number, number, number];
}

const ShaderPreview = ({ shaderCode }: { shaderCode: string }) => {
    const glAreaRef = useRef<Gtk.GLArea | null>(null);
    const glStateRef = useRef<GLState | null>(null);
    const animRef = useRef<AnimState>({
        firstFrameTime: 0,
        firstFrame: 0,
        time: 0,
        timedelta: 0,
        frame: 0,
        mouse: [0, 0, 0, 0],
    });
    const tickIdRef = useRef<number | null>(null);
    const resolutionRef = useRef<[number, number, number]>([64, 36, 1.0]);

    const tickCallback = useCallback((_widget: Gtk.Widget, frameClock: Gdk.FrameClock): boolean => {
        const anim = animRef.current;
        const frame = frameClock.getFrameCounter();
        const frameTime = frameClock.getFrameTime();

        if (anim.firstFrameTime === 0) {
            anim.firstFrameTime = frameTime;
            anim.firstFrame = frame;
            anim.time = 0;
            anim.timedelta = 0;
        } else {
            const previousTime = anim.time;
            anim.time = (frameTime - anim.firstFrameTime) / 1_000_000;
            anim.frame = frame - anim.firstFrame;
            anim.timedelta = anim.time - previousTime;
        }

        glAreaRef.current?.queueDraw();
        return true;
    }, []);

    const handleRef: RefCallback<Gtk.GLArea> = useCallback(
        (area: Gtk.GLArea | null) => {
            if (glAreaRef.current && tickIdRef.current !== null) {
                glAreaRef.current.removeTickCallback(tickIdRef.current);
                tickIdRef.current = null;
            }
            glAreaRef.current = area;
            if (area) {
                tickIdRef.current = area.addTickCallback(tickCallback);
            }
        },
        [tickCallback],
    );

    useEffect(() => {
        return () => {
            if (glAreaRef.current && tickIdRef.current !== null) {
                glAreaRef.current.removeTickCallback(tickIdRef.current);
            }
        };
    }, []);

    const handleUnrealize = useCallback((_self: Gtk.Widget) => {
        const state = glStateRef.current;
        if (state) {
            gl.deleteBuffer(state.vbo);
            gl.deleteVertexArray(state.vao);
            gl.deleteProgram(state.program);
            glStateRef.current = null;
        }
    }, []);

    const handleRender = useCallback(
        (_context: Gdk.GLContext, self: Gtk.GLArea) => {
            if (!glStateRef.current) {
                if (self.getError()) return false;

                const vertexShader = gl.createShader(gl.VERTEX_SHADER);
                gl.shaderSource(vertexShader, buildVertexSource());
                gl.compileShader(vertexShader);

                const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
                gl.shaderSource(fragmentShader, buildFragmentSource(shaderCode));
                gl.compileShader(fragmentShader);

                const program = gl.createProgram();
                gl.attachShader(program, vertexShader);
                gl.attachShader(program, fragmentShader);
                gl.linkProgram(program);

                gl.detachShader(program, vertexShader);
                gl.detachShader(program, fragmentShader);
                gl.deleteShader(vertexShader);
                gl.deleteShader(fragmentShader);

                const vao = gl.genVertexArray();
                gl.bindVertexArray(vao);

                const vbo = gl.genBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
                gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);
                gl.bindBuffer(gl.ARRAY_BUFFER, 0);

                gl.bindVertexArray(0);

                glStateRef.current = {
                    program,
                    vao,
                    vbo,
                    uniforms: {
                        resolution: gl.getUniformLocation(program, "iResolution"),
                        time: gl.getUniformLocation(program, "iTime"),
                        timedelta: gl.getUniformLocation(program, "iTimeDelta"),
                        frame: gl.getUniformLocation(program, "iFrame"),
                        mouse: gl.getUniformLocation(program, "iMouse"),
                    },
                };
            }

            const state = glStateRef.current;
            const anim = animRef.current;
            const res = resolutionRef.current;

            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);

            // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
            gl.useProgram(state.program);

            if (state.uniforms.resolution >= 0) gl.uniform3f(state.uniforms.resolution, res[0], res[1], res[2]);
            if (state.uniforms.time >= 0) gl.uniform1f(state.uniforms.time, anim.time);
            if (state.uniforms.timedelta >= 0) gl.uniform1f(state.uniforms.timedelta, anim.timedelta);
            if (state.uniforms.frame >= 0) gl.uniform1i(state.uniforms.frame, anim.frame);
            if (state.uniforms.mouse >= 0) gl.uniform4f(state.uniforms.mouse, 0, 0, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, state.vbo);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.TRIANGLES, 0, 6);

            gl.disableVertexAttribArray(0);
            gl.bindBuffer(gl.ARRAY_BUFFER, 0);
            // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
            gl.useProgram(0);

            return true;
        },
        [shaderCode],
    );

    const handleResize = useCallback((width: number, height: number) => {
        resolutionRef.current = [width, height, 1.0];
        gl.viewport(0, 0, width, height);
    }, []);

    return (
        <GtkGLArea
            ref={handleRef}
            useEs
            onRender={handleRender}
            onResize={handleResize}
            onUnrealize={handleUnrealize}
            widthRequest={64}
            heightRequest={36}
        />
    );
};

const ShadertoyDemo = () => {
    const glAreaRef = useRef<Gtk.GLArea | null>(null);
    const glStateRef = useRef<GLState | null>(null);
    const sourceViewRef = useRef<GtkSource.View | null>(null);
    const [compiledCode, setCompiledCode] = useState(ALIEN_PLANET_SHADER);
    const [resolution, setResolution] = useState<[number, number, number]>([400, 300, 1.0]);
    const animRef = useRef<AnimState>({
        firstFrameTime: 0,
        firstFrame: 0,
        time: 0,
        timedelta: 0,
        frame: 0,
        mouse: [0, 0, 0, 0],
    });
    const tickIdRef = useRef<number | null>(null);

    const tickCallback = useCallback((_widget: Gtk.Widget, frameClock: Gdk.FrameClock): boolean => {
        const anim = animRef.current;
        const frame = frameClock.getFrameCounter();
        const frameTime = frameClock.getFrameTime();

        if (anim.firstFrameTime === 0) {
            anim.firstFrameTime = frameTime;
            anim.firstFrame = frame;
            anim.time = 0;
            anim.timedelta = 0;
        } else {
            const previousTime = anim.time;
            anim.time = (frameTime - anim.firstFrameTime) / 1_000_000;
            anim.frame = frame - anim.firstFrame;
            anim.timedelta = anim.time - previousTime;
        }

        glAreaRef.current?.queueDraw();
        return true;
    }, []);

    const handleUnrealize = useCallback((_self: Gtk.Widget) => {
        const state = glStateRef.current;
        if (state) {
            gl.deleteBuffer(state.vbo);
            gl.deleteVertexArray(state.vao);
            gl.deleteProgram(state.program);
            glStateRef.current = null;
        }
    }, []);

    const handleGLAreaRef: RefCallback<Gtk.GLArea> = useCallback(
        (area: Gtk.GLArea | null) => {
            if (glAreaRef.current && tickIdRef.current !== null) {
                glAreaRef.current.removeTickCallback(tickIdRef.current);
                tickIdRef.current = null;
            }
            glAreaRef.current = area;
            if (area) {
                tickIdRef.current = area.addTickCallback(tickCallback);
            }
        },
        [tickCallback],
    );

    useEffect(() => {
        return () => {
            if (glAreaRef.current && tickIdRef.current !== null) {
                glAreaRef.current.removeTickCallback(tickIdRef.current);
            }
        };
    }, []);

    const compileShader = useCallback((imageShader: string): boolean => {
        const area = glAreaRef.current;
        const state = glStateRef.current;
        if (!area || !state || !area.getRealized()) return false;

        area.makeCurrent();

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, buildFragmentSource(imageShader));
        gl.compileShader(fragmentShader);

        if (gl.getShaderiv(fragmentShader, gl.COMPILE_STATUS) === 0) {
            const log = gl.getShaderInfoLog(fragmentShader);
            area.setError(new GLib.GError(0, 0, `Fragment shader compile error:\n${log}`));
            gl.deleteShader(fragmentShader);
            return false;
        }

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, buildVertexSource());
        gl.compileShader(vertexShader);

        if (gl.getShaderiv(vertexShader, gl.COMPILE_STATUS) === 0) {
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            return false;
        }

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        gl.detachShader(program, vertexShader);
        gl.detachShader(program, fragmentShader);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        if (gl.getProgramiv(program, gl.LINK_STATUS) === 0) {
            const log = gl.getProgramInfoLog(program);
            area.setError(new GLib.GError(0, 0, `Program link error:\n${log}`));
            gl.deleteProgram(program);
            return false;
        }

        if (state.program) gl.deleteProgram(state.program);
        state.program = program;
        state.uniforms = {
            resolution: gl.getUniformLocation(program, "iResolution"),
            time: gl.getUniformLocation(program, "iTime"),
            timedelta: gl.getUniformLocation(program, "iTimeDelta"),
            frame: gl.getUniformLocation(program, "iFrame"),
            mouse: gl.getUniformLocation(program, "iMouse"),
        };

        animRef.current.firstFrameTime = 0;
        animRef.current.firstFrame = 0;

        area.setError(null);
        return true;
    }, []);

    useEffect(() => {
        compileShader(compiledCode);
    }, [compiledCode, compileShader]);

    const handleRender = useCallback(
        (_context: Gdk.GLContext, self: Gtk.GLArea) => {
            if (!glStateRef.current) {
                if (self.getError()) return false;

                const vertexShader = gl.createShader(gl.VERTEX_SHADER);
                gl.shaderSource(vertexShader, buildVertexSource());
                gl.compileShader(vertexShader);

                const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
                gl.shaderSource(fragmentShader, buildFragmentSource(compiledCode));
                gl.compileShader(fragmentShader);

                const program = gl.createProgram();
                gl.attachShader(program, vertexShader);
                gl.attachShader(program, fragmentShader);
                gl.linkProgram(program);

                gl.detachShader(program, vertexShader);
                gl.detachShader(program, fragmentShader);
                gl.deleteShader(vertexShader);
                gl.deleteShader(fragmentShader);

                const vao = gl.genVertexArray();
                gl.bindVertexArray(vao);

                const vbo = gl.genBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
                gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);
                gl.bindBuffer(gl.ARRAY_BUFFER, 0);

                gl.bindVertexArray(0);

                glStateRef.current = {
                    program,
                    vao,
                    vbo,
                    uniforms: {
                        resolution: gl.getUniformLocation(program, "iResolution"),
                        time: gl.getUniformLocation(program, "iTime"),
                        timedelta: gl.getUniformLocation(program, "iTimeDelta"),
                        frame: gl.getUniformLocation(program, "iFrame"),
                        mouse: gl.getUniformLocation(program, "iMouse"),
                    },
                };
            }

            const state = glStateRef.current;
            const anim = animRef.current;

            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);

            // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
            gl.useProgram(state.program);

            if (state.uniforms.resolution >= 0)
                gl.uniform3f(state.uniforms.resolution, resolution[0], resolution[1], resolution[2]);
            if (state.uniforms.time >= 0) gl.uniform1f(state.uniforms.time, anim.time);
            if (state.uniforms.timedelta >= 0) gl.uniform1f(state.uniforms.timedelta, anim.timedelta);
            if (state.uniforms.frame >= 0) gl.uniform1i(state.uniforms.frame, anim.frame);
            if (state.uniforms.mouse >= 0)
                gl.uniform4f(state.uniforms.mouse, anim.mouse[0], anim.mouse[1], anim.mouse[2], anim.mouse[3]);

            gl.bindBuffer(gl.ARRAY_BUFFER, state.vbo);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.TRIANGLES, 0, 6);

            gl.disableVertexAttribArray(0);
            gl.bindBuffer(gl.ARRAY_BUFFER, 0);
            // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
            gl.useProgram(0);

            return true;
        },
        [resolution, compiledCode],
    );

    const handleResize = useCallback((width: number, height: number) => {
        setResolution([width, height, 1.0]);
        gl.viewport(0, 0, width, height);
    }, []);

    const dragStartRef = useRef({ x: 0, y: 0 });

    const handleDragBegin = useCallback((x: number, y: number) => {
        const area = glAreaRef.current;
        if (!area) return;
        dragStartRef.current = { x, y };
        const height = area.getHeight();
        const scale = area.getScaleFactor();
        const anim = animRef.current;
        anim.mouse[0] = x * scale;
        anim.mouse[1] = (height - y) * scale;
        anim.mouse[2] = anim.mouse[0];
        anim.mouse[3] = anim.mouse[1];
    }, []);

    const handleDragUpdate = useCallback((dx: number, dy: number) => {
        const area = glAreaRef.current;
        if (!area) return;
        const sx = dragStartRef.current.x + dx;
        const sy = dragStartRef.current.y + dy;
        const width = area.getWidth();
        const height = area.getHeight();
        const scale = area.getScaleFactor();
        if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
            const anim = animRef.current;
            anim.mouse[0] = sx * scale;
            anim.mouse[1] = (height - sy) * scale;
        }
    }, []);

    const handleDragEnd = useCallback(() => {
        const anim = animRef.current;
        anim.mouse[2] = -anim.mouse[2];
        anim.mouse[3] = -anim.mouse[3];
    }, []);

    const handleRun = useCallback(() => {
        const view = sourceViewRef.current;
        if (!view) return;
        const buffer = view.getBuffer();
        const start = new Gtk.TextIter();
        const end = new Gtk.TextIter();
        buffer.getStartIter(start);
        buffer.getEndIter(end);
        setCompiledCode(buffer.getText(start, end, false));
    }, []);

    const handleClear = useCallback(() => {
        sourceViewRef.current?.getBuffer().setText("", 0);
    }, []);

    const loadPreset = useCallback((code: string) => {
        sourceViewRef.current?.getBuffer().setText(code, -1);
        setCompiledCode(code);
    }, []);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={6}
            marginStart={12}
            marginEnd={12}
            marginTop={12}
            marginBottom={12}
        >
            <GtkAspectFrame xalign={0.5} yalign={0.5} ratio={1.77777} obeyChild={false} hexpand vexpand>
                <GtkGraphicsOffload enabled={Gtk.GraphicsOffloadEnabled.ENABLED}>
                    <GtkGLArea
                        ref={handleGLAreaRef}
                        useEs
                        onRender={handleRender}
                        onResize={handleResize}
                        onUnrealize={handleUnrealize}
                        hexpand
                        vexpand
                    >
                        <GtkGestureDrag
                            onDragBegin={handleDragBegin}
                            onDragUpdate={handleDragUpdate}
                            onDragEnd={handleDragEnd}
                        />
                    </GtkGLArea>
                </GtkGraphicsOffload>
            </GtkAspectFrame>

            <GtkScrolledWindow minContentHeight={250} hasFrame hexpand>
                <GtkSourceView
                    ref={(view: GtkSource.View | null) => {
                        sourceViewRef.current = view;
                        if (view) view.getBuffer().setText(compiledCode, -1);
                    }}
                    showLineNumbers
                    highlightCurrentLine
                    tabWidth={4}
                    leftMargin={20}
                    rightMargin={20}
                    topMargin={20}
                    bottomMargin={20}
                    monospace
                    language="glsl"
                    styleScheme="Adwaita-dark"
                />
            </GtkScrolledWindow>

            <GtkCenterBox>
                <x.Slot for={GtkCenterBox} id="startWidget">
                    <GtkBox spacing={6}>
                        <GtkButton
                            iconName="view-refresh-symbolic"
                            tooltipText="Restart the demo"
                            valign={Gtk.Align.CENTER}
                            onClicked={handleRun}
                        />
                        <GtkButton
                            iconName="edit-clear-all-symbolic"
                            tooltipText="Clear the text view"
                            valign={Gtk.Align.CENTER}
                            onClicked={handleClear}
                        />
                    </GtkBox>
                </x.Slot>
                <x.Slot for={GtkCenterBox} id="endWidget">
                    <GtkBox spacing={6}>
                        {SHADER_PRESETS.map((preset) => (
                            <GtkButton
                                key={preset.name}
                                tooltipText={preset.name}
                                onClicked={() => loadPreset(preset.code)}
                            >
                                <ShaderPreview shaderCode={preset.code} />
                            </GtkButton>
                        ))}
                    </GtkBox>
                </x.Slot>
            </GtkCenterBox>
        </GtkBox>
    );
};

export const shadertoyDemo: Demo = {
    id: "shadertoy",
    title: "OpenGL/Shadertoy",
    description: "Generate pixels using a custom fragment shader.",
    keywords: ["opengl", "gl", "shader", "glsl", "shadertoy", "fragment", "GtkGLArea"],
    component: ShadertoyDemo,
    sourceCode,
    defaultWidth: 690,
    defaultHeight: 740,
};

````md
# WaterOverlay v6 API

WaterOverlay v6 is a React-first UI system for building **interactive water surfaces over HTML content**. It lets teams define a waterline, distort content below the surface, keep content above it crisp, and configure lighting, material, and interaction in a way that feels declarative and easy to ship.

The library is designed for:
- landing pages
- premium dashboards
- storytelling sections
- experimental interfaces
- game-like UI layers
- brand-heavy visual systems

The goal of v6 is not “perfect fluid simulation.” The goal is **usable, semantic, configurable water behavior for real product UI**.

---

## Design principles

### Easy to implement
A developer should be able to wrap a section, set a water level, choose a light preset, and get a coherent result quickly.

### SOLID-oriented
The public API separates responsibilities:
- surface orchestration
- water rendering
- element behavior
- lighting/material configuration
- interaction settings
- performance strategy

### Semantic, not shader-centric
The API uses interface terms like:
- `level`
- `lightPreset`
- `refraction`
- `behavior`
- `buoyancy`
- `surfaceBand`

It should feel like a design system primitive, not raw graphics middleware.

### Progressive complexity
The library must support:
- a simple “works in 30 seconds” setup
- an advanced configuration path for teams that want deep visual control

### Accessible by default
Visual richness must not destroy:
- readability
- pointer usability
- focus visibility
- reduced-motion expectations

---

# Package scope

WaterOverlay v6 exposes a small but expressive surface area.

## Core exports

- `WaterOverlay`
- `WaterItem`
- `Float`
- `Submerged`
- `useWaterOverlay`
- `useWaterItem`
- utility types for presets and configuration objects

---

# Mental model

WaterOverlay classifies content into three spatial zones:

## Above surface
Elements above the waterline remain visually clean and float over the effect.

## Surface band
Elements intersecting the waterline enter the transition zone where clipping, highlights, partial refraction, and wet-edge styling can occur.

## Below surface
Elements below the waterline are treated as submerged and can receive distortion, tint, blur, attenuation, and reduced contrast depending on configuration.

This three-zone model is a central concept in v6.

---

# Public API overview

## `WaterOverlay`

Main container that defines the water system for a region of the UI.

### Responsibilities
- establish the water context
- define the waterline
- render the water layer
- classify registered items
- coordinate interaction and visual settings
- expose state to nested components

### Basic shape

```ts
type WaterOverlayProps = {
  children: React.ReactNode;
  level?: WaterLevel;
  mode?: WaterMode;
  light?: WaterLightConfig;
  material?: WaterMaterialConfig;
  interaction?: WaterInteractionConfig;
  performance?: WaterPerformanceConfig;
  layout?: WaterLayoutConfig;
  debug?: boolean;
  className?: string;
  style?: React.CSSProperties;
};
````

---

## `WaterItem`

Semantic wrapper for content that should participate in water behavior.

### Responsibilities

* register an element with the overlay
* describe how it reacts to the waterline
* opt into floating, submerging, clipping, or being ignored
* allow future extensions without changing the root component

### Basic shape

```ts
type WaterItemProps = {
  children: React.ReactNode;
  behavior?: WaterItemBehavior;
  buoyancy?: WaterBuoyancy;
  distortion?: WaterDistortionLevel;
  occlusion?: WaterOcclusionMode;
  priority?: number;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
};
```

---

## `Float`

Convenience wrapper for items intended to stay visually above or near the surface.

```ts
type FloatProps = Omit<WaterItemProps, 'behavior'>;
```

Equivalent to:

```tsx
<WaterItem behavior="float" />
```

---

## `Submerged`

Convenience wrapper for items intended to live below the water.

```ts
type SubmergedProps = Omit<WaterItemProps, 'behavior'>;
```

Equivalent to:

```tsx
<WaterItem behavior="submerge" />
```

---

# Core types

## `WaterLevel`

Defines the surface height.

```ts
type WaterLevel = number | `${number}%`;
```

### Accepted semantics

#### Normalized number

A value between `0` and `1`.

* `0` = bottom of the container
* `1` = top of the container

Example:

```ts
level={0.42}
```

#### Pixel number

If the library is configured to treat numbers as absolute via layout strategy, numeric values may be interpreted as pixels from the bottom edge.

Example:

```ts
level={280}
```

#### Percentage string

Useful for ergonomics and readability.

Example:

```ts
level="45%"
```

### Recommendation

In v6 docs, normalized values should be the preferred default because they are portable and predictable across responsive layouts.

---

## `WaterMode`

Defines how the overlay behaves over time.

```ts
type WaterMode = 'static' | 'interactive' | 'scroll-linked';
```

### `static`

The waterline and water body remain stable unless props change.

### `interactive`

Pointer or touch interaction can generate ripples and localized visual response.

### `scroll-linked`

The waterline or distortion behavior can react to scroll progress.

---

# Light configuration

## `WaterLightConfig`

Controls reflected light and perceived lighting mood.

```ts
type WaterLightConfig = {
  preset?: WaterLightPreset;
  direction?: WaterLightDirection;
  intensity?: number;
  specular?: number;
  glow?: number;
  color?: string;
};
```

---

## `WaterLightPreset`

```ts
type WaterLightPreset =
  | 'dawn'
  | 'noon'
  | 'neon'
  | 'fluorescent'
  | 'custom';
```

### `dawn`

Warm, soft, angled light. Best for calm storytelling UI, cinematic landing pages, editorial sections.

### `noon`

Bright, neutral-blue daylight. Best for clean product surfaces, dashboards, and general-purpose use.

### `neon`

High-contrast, synthetic, colored highlights. Best for futuristic interfaces, gaming, nightlife visuals, and experimental brand systems.

### `fluorescent`

Cold, artificial, slightly flatter lighting. Best for industrial, medical, lab, utility, or sci-fi control room aesthetics.

### `custom`

Used when the team wants full manual control over light behavior.

---

## `WaterLightDirection`

```ts
type WaterLightDirection =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | { x: number; y: number; z?: number };
```

### Notes

Keyword directions are the fast path for design teams.

Vector directions are the advanced path for product teams that need exact art direction.

---

# Material configuration

## `WaterMaterialConfig`

Defines how the water body looks and how strongly it affects submerged content.

```ts
type WaterMaterialConfig = {
  opacity?: number;
  refraction?: number;
  reflectivity?: number;
  tint?: string;
  blurBelowSurface?: number;
  distortionScale?: number;
  surfaceBand?: number;
  edgeHighlight?: number;
};
```

---

## Material property meanings

### `opacity`

Controls how present the water volume feels over content.

Low values feel airy and glass-like.
Higher values feel denser and more volumetric.

### `refraction`

Controls how much submerged content bends visually beneath the water.

* lower values = subtle distortion
* medium values = natural premium UI feel
* higher values = stylized or dramatic distortion

### `reflectivity`

Controls the visibility of reflected light and highlights on the water surface.

### `tint`

Adds a base color to the water body.

Useful for branding or thematic mood:

* blue for oceanic
* green for chemical
* violet for neon
* amber for dawn

### `blurBelowSurface`

Applies softness to submerged content to sell depth and separation.

### `distortionScale`

Scales local visual deformation under the surface.

### `surfaceBand`

Defines the thickness of the transition region around the waterline.

This is one of the most important concepts in v6. It determines how much room the system has to create a believable crossing between air and water.

### `edgeHighlight`

Controls the brightness/visibility of the waterline edge and wet shimmer.

---

# Interaction configuration

## `WaterInteractionConfig`

Controls input-driven behavior.

```ts
type WaterInteractionConfig = {
  ripples?: boolean;
  rippleStrength?: number;
  rippleRadius?: number;
  followPointer?: boolean;
  touch?: boolean;
};
```

### `ripples`

Enables or disables splash/ripple generation.

### `rippleStrength`

Controls amplitude of perturbations.

### `rippleRadius`

Controls size of disturbances.

### `followPointer`

Allows the water to respond continuously to pointer movement rather than only on click/tap.

### `touch`

Enables touch interaction on supported devices.

---

# Performance configuration

## `WaterPerformanceConfig`

Lets applications choose rendering behavior based on budget and device constraints.

```ts
type WaterPerformanceConfig = {
  quality?: 'auto' | 'low' | 'medium' | 'high';
  reduceMotionFallback?: boolean;
  disableOnLowPower?: boolean;
  staticFallbackTint?: string;
};
```

### `quality`

Main performance preset.

### `reduceMotionFallback`

When true, the system reduces motion-heavy effects if the user prefers reduced motion.

### `disableOnLowPower`

Allows the effect to degrade or disable itself on low-end or constrained devices.

### `staticFallbackTint`

Fallback body tint when dynamic rendering is reduced.

---

# Layout configuration

## `WaterLayoutConfig`

Defines how the overlay behaves in the DOM and how it interprets measurements.

```ts
type WaterLayoutConfig = {
  strategy?: 'contained' | 'viewport';
  numberUnit?: 'normalized' | 'pixels';
  resize?: 'observer' | 'window';
  overflowClip?: boolean;
};
```

### `strategy`

* `contained`: water is measured against the overlay container
* `viewport`: water is measured against the viewport

### `numberUnit`

Controls whether plain numeric `level` values are normalized or pixel-based.

### `resize`

Defines how resizing is tracked.

### `overflowClip`

Clips water visuals to the container boundary.

---

# Item behavior system

## `WaterItemBehavior`

```ts
type WaterItemBehavior = 'auto' | 'float' | 'submerge' | 'fixed';
```

### `auto`

Default. The system decides based on position and overlap with the surface.

### `float`

The item prefers to remain visually above the water and feel buoyant.

### `submerge`

The item embraces underwater rendering and distortion.

### `fixed`

The item is registered but not visually altered by water classification. Good for controls, HUDs, and critical UI layers.

---

## `WaterBuoyancy`

```ts
type WaterBuoyancy = 'none' | 'low' | 'medium' | 'high' | number;
```

### Meaning

Describes how strongly the item should visually “resist” going below the waterline.

This is not intended as a physics engine in v6. It is a visual behavior hint.

---

## `WaterDistortionLevel`

```ts
type WaterDistortionLevel = 'none' | 'low' | 'medium' | 'high';
```

Allows local override of distortion strength per item.

Useful when some submerged items should remain legible while others can become more atmospheric.

---

## `WaterOcclusionMode`

```ts
type WaterOcclusionMode = 'auto' | 'clip' | 'mask' | 'none';
```

### `auto`

The library chooses the best transition strategy.

### `clip`

Harder separation at the surface.

### `mask`

Softer, more premium edge transition.

### `none`

Disables surface occlusion treatment for that item.

---

# Hooks

## `useWaterOverlay()`

Provides contextual access to overlay state.

```ts
type UseWaterOverlayReturn = {
  level: number;
  zoneAt(y: number): 'above' | 'surface' | 'below';
  mode: WaterMode;
  lightPreset: WaterLightPreset;
  isInteractive: boolean;
};
```

### Use cases

* custom indicators
* syncing labels or legends with the waterline
* building custom controls
* debug or editor UIs

---

## `useWaterItem()`

Provides local item state within the overlay.

```ts
type UseWaterItemReturn = {
  zone: 'above' | 'surface' | 'below';
  immersion: number;
  isSubmerged: boolean;
  isIntersecting: boolean;
};
```

### Use cases

* per-item animation
* text color adaptation
* dynamic shadows
* contextual icon swapping

---

# Recommended defaults

A strong default system is critical for npm adoption.

## Default root behavior

```ts
level = 0.5
mode = 'static'
light.preset = 'noon'
light.direction = 'top-left'
material.opacity = 0.72
material.refraction = 1
material.reflectivity = 0.65
material.surfaceBand = 18
interaction.ripples = false
performance.quality = 'auto'
layout.strategy = 'contained'
layout.numberUnit = 'normalized'
```

These defaults should look balanced in a generic product UI.

---

# Example usage patterns

## Minimal setup

```tsx
<WaterOverlay level={0.45}>
  <HeroContent />
</WaterOverlay>
```

Use this when the water is mostly decorative and the system should classify content automatically.

---

## Art-directed setup

```tsx
<WaterOverlay
  level="42%"
  mode="interactive"
  light={{
    preset: 'dawn',
    direction: 'top-right',
  }}
  material={{
    refraction: 1.2,
    opacity: 0.68,
    surfaceBand: 22,
  }}
  interaction={{
    ripples: true,
    rippleStrength: 0.9,
  }}
>
  <WaterItem behavior="float">
    <MainCard />
  </WaterItem>

  <WaterItem behavior="submerge" distortion="medium">
    <BackgroundFigure />
  </WaterItem>
</WaterOverlay>
```

---

## Convenience wrappers

```tsx
<WaterOverlay level={0.55} light={{ preset: 'neon' }}>
  <Float>
    <StatusCard />
  </Float>

  <Submerged distortion="high">
    <DecorativeGrid />
  </Submerged>
</WaterOverlay>
```

---

# UX recommendations

## Keep important UI above water

Critical CTAs, navigation, and small interactive controls should usually be above the waterline or use `behavior="fixed"`.

## Use the surface band intentionally

The most convincing visual storytelling happens near the crossing zone. Avoid treating the waterline as a mathematically thin line.

## Avoid over-distorting text

Submerged large decorative text can work. Small functional text usually should not.

## Use presets first

Most users should start with `dawn`, `noon`, `neon`, or `fluorescent` before manually tweaking light values.

## Prefer restrained refractive settings

In real product UI, medium refraction is usually more premium than extreme distortion.

---

# Accessibility guidelines

WaterOverlay v6 should document and encourage the following:

* preserve semantic HTML structure
* keep pointer targets reliable
* respect `prefers-reduced-motion`
* reduce distortion on small text
* maintain adequate contrast for floating controls
* avoid putting mission-critical content entirely underwater unless readability is intentionally preserved

---

# What v6 explicitly is not

WaterOverlay v6 is not intended to be:

* a full physics simulation engine
* a 3D scene framework
* a general-purpose shader graph system
* a replacement for all layout systems
* a game engine

It is a **UI overlay and classification system for water-like interfaces over HTML**.

---

# Versioning philosophy for v6

The v6 API should prioritize stability in these areas:

* `WaterOverlay` remains the root component
* `WaterItem` remains the primary semantic child wrapper
* `light`, `material`, `interaction`, `performance`, and `layout` remain grouped config objects
* item behavior remains explicit and semantic

Future additions should extend presets and optional configuration rather than breaking core concepts.

---

# Summary

WaterOverlay v6 is built around five main ideas:

1. water level
2. water material
3. light behavior
4. item behavior
5. interaction/performance strategy

Its core strength is the ability to place normal HTML into a system where elements can:

* float above the surface
* intersect the waterline
* become submerged and distorted below it

The public API should feel:

* easy to learn
* visually expressive
* semantically clear
* stable enough for npm distribution
* flexible enough for premium UI systems


# TRIPLE NELSON – Birthday Rave

Festival-grade landing page con diseño visual profesional.

## Sistema Visual

**Layout Grid:**
- Hero: 2 columnas desktop (título izq + countdown der)
- Secciones: bloques centrados con max-width específico
- Todo con `mx-auto` y padding horizontal generoso

**Max-Widths por sección:**
- Hero: `1280px` (7xl)
- About: `1024px` (4xl)
- Timeline: `1152px` (6xl) — grid 4 columnas
- Location: `1280px` (5xl)

**Spacing:**
- Entre secciones: `py-32` (128px)
- Bloques internos: `space-y-12/16` (48px-64px)
- Gap en grids: `gap-6` (24px)

**Tipografía:**
- Hero: 160px → 64px responsive
- Display: 80px → 48px (títulos sección)
- Body: 32px (párrafos destacados)
- Small: 14px (labels)

**Paleta:**
- Black: `#0a0a0a`
- White: `#e8e8e8`
- Gray: `#666666`
- Acid: `#00ff41` (acentos mínimos)

## Estructura Visual

**Hero (100vh):**
```
[TÍTULO + CTA]    [COUNTDOWN 2x2]
```

**Timeline:**
```
[DOORS] [PEAK] [CLOSING] [END]
```

**Location:**
```
Título centrado
[Bloque visual grande]
```

Todos los bloques están centrados, nunca pegados a bordes.

## Editar Contenido

Todo en `content/event.json`:

```json
{
  "date": "2026-06-20T20:00:00",
  "location": "Secret Warehouse, Ciudad",
  "description": "La fiesta que esperabas..."
}
```

## Desarrollo

```bash
npm install
npm run dev
```

Abre [localhost:3000](http://localhost:3000)

## Principios de Diseño

1. **Grid primero**: Todo usa grid/flex, nunca columna vertical por defecto
2. **Centrado religioso**: `mx-auto` en cada contenedor
3. **Bloques visuales**: Secciones son piezas gráficas, no párrafos
4. **Aire generoso**: `py-32` entre secciones, espacios grandes
5. **Jerarquía dramática**: Contraste entre tamaños (160px vs 14px)

---

**Stack:** Next.js 14 + TypeScript + Tailwind CSS

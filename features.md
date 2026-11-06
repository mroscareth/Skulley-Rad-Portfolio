# Features por construir

## Láser de la esfera (reemplaza la explosión de la E)

Pedido de Oscar, 2026-11-05. Todavía no se construye nada: esto es el plan.

### La idea

Skulley dispara un láser desde la esfera de su mano izquierda.

- **Pose:** estira el brazo con la palma al frente, y la esfera queda delante. La otra mano sostiene el brazo que carga.
- **Carga:** mientras se carga, la esfera brilla cada vez más.
- **Puntería:** sale una mira en el piso que sigue al cursor, y Skulley gira siguiéndola.
- **Disparo:** el láser va de la esfera a la mira.

### Lo que ya existe

| Pieza | Dónde |
|---|---|
| Mantener para cargar, soltar para disparar, carga de 0 a 1 | E en `Player.jsx` (`chargeRef`, `triggerManualExplosion`) |
| Barra de poder en el HUD | `PowerBar.jsx`, se conserva tal cual |
| Cursor convertido en un punto del piso | `aimRef` y `aimTools` en `Player.jsx` |
| Skulley gira hacia el cursor | `aimAngle` en `Player.jsx`, usado por la patada |
| Capa de pose encima de la animación | `applyKickPoseRef` en `Player.jsx` |
| Posar a mano y exportar | `?pose=1`, `src/components/dev/PoseStudio.jsx` |
| Dibujo proyectado en el piso | `src/components/fx/KickTrajectory.jsx` |
| Explosión con empujón radial a las esferas | `triggerManualExplosion` + `onPulse` + `HomeOrbs.radialImpulse` |

### Datos medidos del rig

- 152 huesos de Auto-Rig Pro. Cadena del brazo: `shoulderl` → `arm_stretchl` → `forearm_stretchl` → `handl`.
- La esfera es `Egg_EnergyBall`, hija de `handl`, con material emisivo verde (`emissiveIntensity` 4). Sigue a la palma sin código.
- En `handl` los dedos apuntan a +Y y la esfera sale por -Z (0.37, 0.34, -0.86). Palma al frente = -Z de `handl` hacia el blanco.
- La piel del antebrazo depende de `forearm_twistl` y `forearm_twist_2l`, hijos de `forearm_stretchl`. Girar solo `handl` retuerce la muñeca.

### Lo difícil

1. **Palma al frente:** pide doblar la muñeca hacia atrás y girar el antebrazo. El Pose Studio no exporta los huesos de giro.
2. **Mano derecha agarrando el brazo:** el estudio no controla dedos, y sin dedos no se lee como agarre.
3. **Altura del blanco:** cerca pide el brazo hacia abajo y lejos casi horizontal. Girar el cuerpo no lo resuelve.
4. **El rayo sale de un lado:** la esfera va a la izquierda del cuerpo, así que hay que corregir el giro unos grados para que caiga exacto en la mira.
5. **Sin luces nuevas:** agregar una luz recompila todos los materiales, así que el brillo del impacto es falso (decal más bloom).
6. **Primer disparo:** el láser debe quedar montado y precalentado en el preloader, apagado por uniforms, o da un tirón.
7. **Cursor sobre el horizonte:** en tercera persona el rayo del cursor puede no tocar el piso; hay que topar la distancia.

### Fases

**Fase 1: la pose (la de mayor riesgo, va primero)**
- Ampliar el Pose Studio: exportar huesos de giro y dedos, y un botón para cerrar la mano.
- Posar tres claves: carga con blanco cercano, carga con blanco lejano y retroceso al disparar.
- Crear `src/lib/laserPose.js` y reproducirlas en el juego con el mismo patrón de la patada.
- Termina cuando, al mantener E, Skulley se ve bien de frente, de lado y desde arriba.

**Fase 2: apuntar y cargar**
- Mira en el piso que sigue al cursor, con distancia mínima y máxima (`fx/LaserTarget.jsx`, mismo lenguaje que `KickTrajectory`).
- Skulley gira hacia ella, con la corrección del punto 4.
- El brazo se mezcla entre la pose cercana y la lejana según la distancia.
- La esfera crece y brilla con la carga, y un sonido de carga sintetizado en `homeSounds.js`.

**Fase 3: el disparo**
- Rayo toon con bandas duras y centro blanco, siempre montado y apagado cuando no se usa.
- Retroceso, temblor de cámara y sonido.
- Impacto en la mira con marca en el piso. Reutiliza la explosión actual en ese punto; se apaga la onda alrededor de Skulley.

**Fase 4: cierre**
- Precalentado en el warm-up del preloader.
- Puntería con joystick en tablet, donde no hay cursor.
- Textos: `step4` y `power.desc` en `LanguageContext.jsx` (inglés y español) hablan de una "onda de poder", y también el tooltip de `PowerBar.jsx`.
- Pruebas contra patada, modo orbe, Customize y desarme.

### Decisiones pendientes de Oscar

Con recomendación; todavía sin confirmar.

1. **¿Quién posa?** Recomendado: Claude deja una primera versión y Oscar hace la final en el estudio.
2. **¿Qué hace el láser en el juego?** Recomendado: conservar el empujón a las esferas, pero en el punto del impacto.
3. **Tipo de disparo:** recomendado un rayo corto de medio segundo, más largo y grueso con más carga. Un rayo sostenido que barre esferas es otro juego.
4. **¿Se mueve mientras carga?** Recomendado: se queda plantado, como en la patada.

# CMS API - MROSCAR Portfolio

API REST en PHP para gestionar proyectos y contenido del portfolio.

## Requisitos

- PHP 8.0+
- MySQL 5.7+ / MariaDB 10.3+
- Extensiones PHP: `pdo_mysql`, `json`, `gd` (opcional, para optimización de imágenes)

## Instalación en Hostinger

### 1. Base de datos

1. En el panel de Hostinger, ve a **Databases** → **MySQL Databases**
2. Crea una nueva base de datos (ej: `u123456789_mroscar`)
3. Crea un usuario para la base de datos
4. Importa el schema:
   - Ve a **phpMyAdmin**
   - Selecciona tu base de datos
   - Pestaña **Import** → selecciona `schema.sql`
   - Click **Go**

5. **IMPORTANTE**: Edita tu email en la tabla `allowed_emails`:
   ```sql
   UPDATE allowed_emails SET email = 'tu@email.com' WHERE id = 1;
   ```

### 2. Configuración

1. Copia `config.local.example.php` a `config.local.php`
2. Edita `config.local.php` con tus credenciales:
   - Datos de MySQL (host, usuario, contraseña, nombre BD)
   - Credenciales de Google OAuth (ver abajo)
   - URLs de tu sitio

### 3. Google OAuth

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto o selecciona uno existente
3. Ve a **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Tipo: **Web application**
6. Authorized redirect URIs: `https://tudominio.com/api/auth.php?action=callback`
7. Copia el **Client ID** y **Client Secret** a `config.local.php`

### 4. Permisos de carpetas

Asegúrate de que la carpeta `uploads/` tenga permisos de escritura:
```bash
chmod 755 uploads/
chmod 755 uploads/projects/
```

### 5. HTTPS

El OAuth de Google requiere HTTPS. Hostinger lo proporciona automáticamente con Let's Encrypt.

## Estructura de archivos

```
public/api/
├── config.php              # Config por defecto (desarrollo)
├── config.local.php        # Config de producción (no versionar)
├── config.local.example.php # Ejemplo de config
├── db.php                  # Conexión PDO singleton
├── middleware.php          # Autenticación y utilidades
├── auth.php                # Google OAuth login/logout
├── projects.php            # CRUD de proyectos
├── upload.php              # Upload de archivos
├── about.php               # CRUD contenido About
├── contact.php             # Formulario de contacto (existente)
├── schema.sql              # Schema MySQL
└── README.md               # Este archivo
```

## Endpoints

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/auth.php?action=login` | Iniciar login con Google |
| GET | `/api/auth.php?action=callback` | Callback OAuth (interno) |
| POST | `/api/auth.php?action=logout` | Cerrar sesión |
| GET | `/api/auth.php?action=me` | Obtener usuario actual |

### Proyectos

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/projects.php` | Listar todos | No |
| GET | `/api/projects.php?active=1` | Solo activos | No |
| GET | `/api/projects.php?id=X` | Obtener uno | No |
| POST | `/api/projects.php` | Crear | Sí |
| PUT | `/api/projects.php?id=X` | Actualizar | Sí |
| DELETE | `/api/projects.php?id=X` | Eliminar | Sí |
| PUT | `/api/projects.php?reorder=1` | Reordenar | Sí |

### Upload

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/api/upload.php` | Subir archivo | Sí |
| DELETE | `/api/upload.php?id=X` | Eliminar archivo | Sí |
| PUT | `/api/upload.php?reorder=1` | Reordenar archivos | Sí |

### About

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/about.php` | Obtener contenido | No |
| GET | `/api/about.php?lang=es` | Solo un idioma | No |
| PUT | `/api/about.php` | Actualizar | Sí |

## Desarrollo local

Para probar localmente necesitas:

1. XAMPP, MAMP o similar con PHP 8+ y MySQL
2. Crear la base de datos e importar `schema.sql`
3. Copiar `config.local.example.php` a `config.local.php` con datos locales
4. Correr el frontend con `npm run dev`
5. Acceder a `http://localhost:5173/admin`

**Nota**: El login de Google no funcionará en localhost a menos que configures las URIs de redirect en Google Console para incluir `http://localhost:5173/api/auth.php?action=callback`.

## Seguridad

- Solo emails en la tabla `allowed_emails` pueden acceder
- Sesiones expiran en 24 horas
- Rate limiting en uploads (20/minuto)
- Validación de tipos de archivo server-side
- CORS restrictivo

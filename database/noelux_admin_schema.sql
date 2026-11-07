-- ==============================================================================
-- NOELUX™ PARAGUAY — CONFIGURACIÓN DE USUARIO ADMINISTRADOR OFICIAL Y ÚNICO
-- Pegar y ejecutar en: Supabase Dashboard > SQL Editor > New Query > RUN
-- ==============================================================================

-- 1. EXTENSIONES REQUERIDAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLA DE USUARIOS ADMINISTRADORES (admin_users)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(120) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) DEFAULT NULL,
    nombre VARCHAR(100) NOT NULL,
    rol VARCHAR(30) NOT NULL DEFAULT 'superadmin' CHECK (rol IN ('superadmin', 'admin', 'operador', 'reparto')),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    intentos_fallidos INT NOT NULL DEFAULT 0,
    bloqueado_hasta TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ultimo_login TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA DE SESIONES (admin_sesiones)
CREATE TABLE IF NOT EXISTS admin_sesiones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    expira_en TIMESTAMP WITH TIME ZONE NOT NULL,
    revocado BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. ELIMINACIÓN TOTAL DE USUARIOS Y SESIONES PRECARGADAS ANTERIORES
DELETE FROM admin_sesiones;
DELETE FROM admin_users;

-- 5. INSERCIÓN EXCLUSIVA DEL USUARIO ADMINISTRADOR OFICIAL
-- Correo: encuestas977@gmail.com
-- Contraseña: qqwwee112233 (Hash SHA-256: 558c2c904231a3d730dc9214dcae807b25b01ecd7e19f0b9b3a5b20e8b3986ef)
INSERT INTO admin_users (
    username,
    email,
    password_hash,
    nombre,
    rol,
    activo
) VALUES (
    'encuestas977@gmail.com',
    'encuestas977@gmail.com',
    encode(digest('qqwwee112233', 'sha256'), 'hex'),
    'Administrador Oficial',
    'superadmin',
    TRUE
);

-- 6. FUNCIÓN SEGURA DE LOGIN EN BASE DE DATOS (RPC)
-- Verifica correo y contraseña directamente en PostgreSQL sin exponer la tabla admin_users
CREATE OR REPLACE FUNCTION verificar_login_admin(p_email TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_hash TEXT;
BEGIN
    v_hash := encode(digest(trim(p_password), 'sha256'), 'hex');

    SELECT id, username, email, nombre, rol, activo
    INTO v_user
    FROM admin_users
    WHERE (lower(email) = lower(trim(p_email)) OR lower(username) = lower(trim(p_email)))
      AND password_hash = v_hash
      AND activo = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Credenciales inválidas. Acceso denegado.'
        );
    END IF;

    UPDATE admin_users
    SET ultimo_login = CURRENT_TIMESTAMP,
        intentos_fallidos = 0
    WHERE id = v_user.id;

    RETURN jsonb_build_object(
        'success', true,
        'user', jsonb_build_object(
            'id', v_user.id,
            'username', v_user.username,
            'email', v_user.email,
            'nombre', v_user.nombre,
            'rol', v_user.rol
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION verificar_login_admin(TEXT, TEXT) TO anon, authenticated;

-- =================================================================================
-- NOELUX™ PARAGUAY / LANDINGCOD — ESQUEMA MAESTRO OFICIAL PARA SUPABASE (POSTGRESQL)
-- Proyecto Oficial Activo: https://pgpmopannzzubunuhlmb.supabase.co
--
-- Instala y configura de forma idempotente todas las tablas, índices, funciones RPC,
-- credenciales de SuperAdmin y políticas RLS requeridas por:
--   1. Tienda Web & Embudo COD (StoreContext.tsx)
--   2. Panel Administrativo & Constructor AutoAds (AdminView.tsx)
--   3. Motor IA de WhatsApp Baileys + Deepgram Aura-2 (server/whatsappEngine.ts)
--
-- INSTRUCCIONES DE EJECUCIÓN EN SUPABASE:
--   1. Ingresar a https://supabase.com/dashboard -> Proyecto -> SQL Editor -> New Query
--   2. Pegar este script completo y presionar "Run" (Ejecutar).
-- =================================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =================================================================================
-- 1. TABLA CENTRAL KV DE SINCRONIZACIÓN EN TIEMPO REAL: public.codigos
-- Almacena:
--   • ORD-<reservaid>-<ts>     : Snapshots completos de pedidos (web + IA + admin)
--   • DEL-ORD-<reservaid>-<ts> : Tombstones de pedidos eliminados permanentemente
--   • CFG-<ts>-<rand>          : Configuración global y páginas de productos (productPages)
--   • WAVOICE-<ts>-<rand>      : Voz de Deepgram Aura-2 asignada por producto
--   • WAENG-<ts>-<rand>        : Estado en tiempo real del motor WhatsApp Baileys y chats
--   • WACHAT-<telefono>        : Historial atómico de conversación por cliente
--   • WACMD-<ts>-<rand>        : Comandos en tiempo real del Panel Admin hacia Baileys
--   • WAAUTH-<sessionId>-<ts>  : Respaldo GZIP de credenciales Signal/Baileys (persiste en redeploys)
-- =================================================================================
CREATE TABLE IF NOT EXISTS public.codigos (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  dispositivo TEXT NOT NULL,
  creado TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_codigos_code ON public.codigos (code);
CREATE INDEX IF NOT EXISTS idx_codigos_code_prefix ON public.codigos (code text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_codigos_creado_desc ON public.codigos (creado DESC);

-- =================================================================================
-- 2. TABLA ESTRUCTURADA DE PEDIDOS: public.pedidos
-- =================================================================================
CREATE TABLE IF NOT EXISTS public.pedidos (
  id BIGSERIAL PRIMARY KEY,
  reservaid TEXT UNIQUE NOT NULL,
  producto_id TEXT DEFAULT 'prod-noelux-01',
  producto TEXT,
  wa_vendedor TEXT,
  nombre TEXT,
  celular TEXT,
  departamento TEXT,
  ciudad TEXT,
  direccion TEXT,
  detalle TEXT,
  cantidad INTEGER DEFAULT 1,
  monto NUMERIC DEFAULT 189000,
  ref_code TEXT,
  estado TEXT DEFAULT 'reservado',
  acredita BOOLEAN DEFAULT TRUE,
  tipo_vivienda TEXT DEFAULT 'casa',
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  gps_link TEXT,
  gps_confirmado BOOLEAN DEFAULT FALSE,
  referencia_casa TEXT,
  modo_ia TEXT DEFAULT 'automatico',
  conv_step INTEGER DEFAULT 1,
  atendido_por_ia BOOLEAN DEFAULT TRUE,
  datos_confirmados BOOLEAN DEFAULT FALSE,
  agente_completado BOOLEAN DEFAULT FALSE,
  empaquetado BOOLEAN DEFAULT FALSE,
  archivado BOOLEAN DEFAULT FALSE,
  fecha_archivado TIMESTAMPTZ,
  dispositivo JSONB,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS acredita BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_pedidos_reservaid ON public.pedidos (reservaid);
CREATE INDEX IF NOT EXISTS idx_pedidos_celular ON public.pedidos (celular);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_desc ON public.pedidos (fecha DESC);

-- =================================================================================
-- 3. TABLA DE EVENTOS PÚBLICOS Y VIRALIDAD: public.eventos_publicos
-- =================================================================================
CREATE TABLE IF NOT EXISTS public.eventos_publicos (
  id BIGSERIAL PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'reserva',
  ciudad TEXT,
  ref_code TEXT,
  creado TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eventos_publicos_creado_desc ON public.eventos_publicos (creado DESC);

-- =================================================================================
-- 4. TABLAS DE AUTENTICACIÓN Y AUDITORÍA ADMIN:
--    public.admin_users, public.admin_sesiones, public.admin_audit_logs
-- =================================================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre TEXT NOT NULL DEFAULT 'Administrador Oficial',
  rol TEXT NOT NULL DEFAULT 'superadmin',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_acceso TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_sesiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  expira_en TIMESTAMPTZ NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sesiones_token ON public.admin_sesiones(token);
CREATE INDEX IF NOT EXISTS idx_admin_sesiones_user_id ON public.admin_sesiones(user_id);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  accion TEXT NOT NULL,
  detalle JSONB DEFAULT '{}'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =================================================================================
-- 5. CREDENCIALES OFICIALES DE SUPERADMIN (encuestas977@gmail.com / qqwwee112233)
-- =================================================================================
DELETE FROM public.admin_users WHERE email != 'encuestas977@gmail.com';

INSERT INTO public.admin_users (username, email, password_hash, nombre, rol, activo)
VALUES (
  'encuestas977@gmail.com',
  'encuestas977@gmail.com',
  crypt('qqwwee112233', gen_salt('bf', 10)),
  'Administrador Oficial',
  'superadmin',
  TRUE
)
ON CONFLICT (username) DO UPDATE
SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  nombre = EXCLUDED.nombre,
  rol = EXCLUDED.rol,
  activo = TRUE,
  actualizado_en = NOW();

-- =================================================================================
-- 6. FUNCIÓN RPC DE LOGIN: public.verificar_login_admin
-- =================================================================================
CREATE OR REPLACE FUNCTION public.verificar_login_admin(
  p_email TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_token TEXT;
  v_expira TIMESTAMPTZ;
BEGIN
  SELECT id, username, email, password_hash, nombre, rol, activo
  INTO v_user
  FROM public.admin_users
  WHERE (LOWER(email) = LOWER(TRIM(p_email)) OR LOWER(username) = LOWER(TRIM(p_email)))
    AND activo = TRUE
  LIMIT 1;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Credenciales inválidas. Acceso exclusivo para el administrador autorizado.');
  END IF;

  IF v_user.password_hash = crypt(p_password, v_user.password_hash) THEN
    v_token := encode(gen_random_bytes(32), 'hex');
    v_expira := NOW() + INTERVAL '24 hours';

    INSERT INTO public.admin_sesiones (user_id, token, expira_en)
    VALUES (v_user.id, v_token, v_expira);

    UPDATE public.admin_users SET ultimo_acceso = NOW() WHERE id = v_user.id;

    INSERT INTO public.admin_audit_logs (user_id, accion, detalle)
    VALUES (v_user.id, 'LOGIN_SUCCESS', jsonb_build_object('email', v_user.email, 'timestamp', NOW()));

    RETURN jsonb_build_object(
      'success', TRUE,
      'token', v_token,
      'expires_at', v_expira,
      'user', jsonb_build_object(
        'id', v_user.id,
        'username', v_user.username,
        'email', v_user.email,
        'nombre', v_user.nombre,
        'rol', v_user.rol
      )
    );
  ELSE
    INSERT INTO public.admin_audit_logs (user_id, accion, detalle)
    VALUES (v_user.id, 'LOGIN_FAILED', jsonb_build_object('email', p_email, 'timestamp', NOW()));

    RETURN jsonb_build_object('success', FALSE, 'error', 'Contraseña incorrecta.');
  END IF;
END;
$$;

-- =================================================================================
-- 7. POLÍTICAS RLS Y PERMISOS POSTGREST
-- =================================================================================
ALTER TABLE public.codigos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_publicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access on codigos" ON public.codigos;
CREATE POLICY "Allow full access on codigos" ON public.codigos FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access on pedidos" ON public.pedidos;
CREATE POLICY "Allow full access on pedidos" ON public.pedidos FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access on eventos_publicos" ON public.eventos_publicos;
CREATE POLICY "Allow full access on eventos_publicos" ON public.eventos_publicos FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read active admin_users" ON public.admin_users;
CREATE POLICY "Allow public read active admin_users" ON public.admin_users FOR SELECT TO anon, authenticated, service_role USING (activo = true);

DROP POLICY IF EXISTS "Allow full access on admin_sesiones" ON public.admin_sesiones;
CREATE POLICY "Allow full access on admin_sesiones" ON public.admin_sesiones FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access on admin_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "Allow full access on admin_audit_logs" ON public.admin_audit_logs FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verificar_login_admin(TEXT, TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

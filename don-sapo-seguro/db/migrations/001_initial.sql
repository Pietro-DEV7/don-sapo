-- Don Sapo v2 — Neon PostgreSQL (sem Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS services (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  slot_type text NOT NULL CHECK (slot_type IN ('simple','procedure')),
  active boolean NOT NULL DEFAULT true
);
INSERT INTO services (id,name,price_cents,slot_type) VALUES
('corte-simples','Corte simples',4000,'simple'),
('corte-americano','Corte americano',4000,'simple'),
('corte-giletado','Corte giletado',4000,'simple'),
('americano-com-risco','Americano com risco',4500,'simple'),
('cabelo-barba','Cabelo & barba',6500,'procedure'),
('corte-barba-sobrancelhas','Corte, barba e sobrancelhas',7500,'procedure'),
('corte-penteado','Corte com penteado',5500,'procedure'),
('corte-luzes','Corte com luzes',14000,'procedure'),
('corte-platinado','Corte e platinado',18000,'procedure'),
('barboterapia','Barboterapia',4000,'simple')
ON CONFLICT (id) DO UPDATE SET name=excluded.name,price_cents=excluded.price_cents,slot_type=excluded.slot_type,active=true;

CREATE TABLE IF NOT EXISTS admin_users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL UNIQUE,
 password_hash text NOT NULL,
 totp_secret_enc text,
 pending_totp_secret_enc text,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
 session_hash text NOT NULL UNIQUE,
 csrf_hash text NOT NULL,
 mfa_verified boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS bookings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_code text NOT NULL UNIQUE,
 customer_name text NOT NULL CHECK (char_length(customer_name) BETWEEN 2 AND 80),
 customer_phone text NOT NULL CHECK (char_length(customer_phone) BETWEEN 10 AND 24),
 service_ids text[] NOT NULL,
 service_names text[] NOT NULL,
 total_cents integer NOT NULL CHECK (total_cents >= 0),
 slot_type text NOT NULL CHECK (slot_type IN ('simple','procedure')),
 booking_date date NOT NULL,
 booking_time time NOT NULL,
 duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes = 30),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT booking_schedule_rule CHECK (
   booking_time >= TIME '09:00' AND booking_time < TIME '19:00'
   AND ( (slot_type='simple' AND extract(minute FROM booking_time)=0)
      OR (slot_type='procedure' AND extract(minute FROM booking_time)=30) )
 ),
 -- Impede sobreposição de intervalos no banco, mesmo em requisições simultâneas.
 -- Intervalo [início, fim): 09:00-09:30 pode ser seguido por 09:30-10:00.
 CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
   tsrange(booking_date + booking_time, booking_date + booking_time + interval '30 minutes', '[)') WITH &&
 ) WHERE (status <> 'cancelled')
);
CREATE INDEX IF NOT EXISTS bookings_date_status_idx ON bookings(booking_date,status);
CREATE TABLE IF NOT EXISTS security_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_user_id uuid,
 event_type text NOT NULL,
 booking_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

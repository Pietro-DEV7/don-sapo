import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { Pool } from '@neondatabase/serverless';
import argon2 from 'argon2';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express();
const PORT=Number(process.env.PORT||3000);
const ORIGIN=process.env.APP_ORIGIN;
const production=process.env.NODE_ENV==='production';
if(!process.env.DATABASE_URL || !process.env.APP_ENCRYPTION_KEY || !ORIGIN) throw new Error('DATABASE_URL, APP_ENCRYPTION_KEY e APP_ORIGIN são obrigatórios.');
const encryptionKey=Buffer.from(process.env.APP_ENCRYPTION_KEY,'base64');
if(encryptionKey.length!==32) throw new Error('APP_ENCRYPTION_KEY deve ser Base64 de exatamente 32 bytes.');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:true,max:10,idleTimeoutMillis:10000,connectionTimeoutMillis:10000});
const COOKIE='ds_admin'; const CSRF_COOKIE='ds_csrf'; const SESSION_HOURS=8;
app.set('trust proxy',1);
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'","'unsafe-inline'"],styleSrc:["'self'","'unsafe-inline'","https://fonts.googleapis.com"],fontSrc:["'self'","https://fonts.gstatic.com"],imgSrc:["'self'","data:","https://images.unsplash.com"],connectSrc:["'self'"],objectSrc:["'none'"],baseUri:["'self'"],frameAncestors:["'none'"]}},crossOriginEmbedderPolicy:false}));
app.use(express.json({limit:'20kb'})); app.use(cookieParser());
app.use((req,res,next)=>{if(req.path.startsWith('/api') && req.method!=='GET' && req.method!=='HEAD'){const origin=req.get('origin');if(origin!==ORIGIN)return res.status(403).json({error:'FORBIDDEN'});}next()});
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'LOGIN_TEMPORARILY_BLOCKED'}});
const bookingLimiter=rateLimit({windowMs:10*60*1000,limit:12,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'TOO_MANY_REQUESTS'}});
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const randomToken=()=>crypto.randomBytes(32).toString('base64url');
const safeEqual=(a,b)=>{const x=Buffer.from(String(a||''));const y=Buffer.from(String(b||''));return x.length===y.length&&crypto.timingSafeEqual(x,y)};
function encryptSecret(value){const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey,iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join('.')}
function decryptSecret(value){const [iv,tag,data]=String(value).split('.');const decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey,Buffer.from(iv,'base64'));decipher.setAuthTag(Buffer.from(tag,'base64'));return Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()]).toString('utf8')}
function setSessionCookies(res,token,csrf){const base={secure:production,httpOnly:true,sameSite:'strict',path:'/'};res.cookie(COOKIE,token,{...base,maxAge:SESSION_HOURS*3600*1000});res.cookie(CSRF_COOKIE,csrf,{...base,httpOnly:false,maxAge:SESSION_HOURS*3600*1000})}
function clearSessionCookies(res){res.clearCookie(COOKIE,{secure:production,httpOnly:true,sameSite:'strict',path:'/'});res.clearCookie(CSRF_COOKIE,{secure:production,sameSite:'strict',path:'/'})}
async function sessionFrom(req){const token=req.cookies[COOKIE];if(!token)return null;const {rows}=await pool.query(`SELECT s.id AS session_id,s.admin_user_id,s.csrf_hash,s.mfa_verified,s.expires_at,a.email,a.active,a.totp_secret_enc,a.pending_totp_secret_enc FROM admin_sessions s JOIN admin_users a ON a.id=s.admin_user_id WHERE s.session_hash=$1 AND s.expires_at>now() AND a.active=true`,[hash(token)]);return rows[0]||null}
async function requireSession(req,res,next){try{const s=await sessionFrom(req);if(!s)return res.status(401).json({error:'UNAUTHENTICATED'});req.admin=s;req.rawSessionToken=req.cookies[COOKIE];await pool.query('UPDATE admin_sessions SET last_seen_at=now(),expires_at=now()+interval \'8 hours\' WHERE id=$1',[s.session_id]);next()}catch(e){next(e)}}
function requireCsrf(req,res,next){const cookie=req.cookies[CSRF_COOKIE],header=req.get('x-csrf-token');if(!cookie||!header||!req.admin?.csrf_hash||!safeEqual(cookie,header)||!safeEqual(hash(cookie),req.admin.csrf_hash))return res.status(403).json({error:'CSRF_INVALID'});next()}
function requireMfa(req,res,next){if(!req.admin.mfa_verified)return res.status(403).json({error:'MFA_REQUIRED'});next()}
app.get('/api/health',async(_req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true})}catch{res.status(503).json({ok:false})}});
app.get('/api/availability',async(req,res,next)=>{try{const d=String(req.query.date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return res.status(400).json({error:'INVALID_DATE'});const {rows}=await pool.query("SELECT to_char(booking_time,'HH24:MI') AS time FROM bookings WHERE booking_date=$1 AND status<>'cancelled' ORDER BY booking_time",[d]);res.json({booked:rows.map(r=>r.time)})}catch(e){next(e)}});
app.post('/api/bookings',bookingLimiter,async(req,res,next)=>{try{
 const {customerName,customerPhone,serviceIds,date,time}=req.body||{};
 if(typeof customerName!=='string'||customerName.trim().length<2||customerName.trim().length>80||typeof customerPhone!=='string'||customerPhone.length<10||customerPhone.length>24||customerPhone.replace(/\D/g,'').length<10||customerPhone.replace(/\D/g,'').length>13)return res.status(400).json({error:'INVALID_INPUT'});
 if(!Array.isArray(serviceIds)||serviceIds.length<1||serviceIds.length>10||new Set(serviceIds).size!==serviceIds.length||serviceIds.some(x=>typeof x!=='string'||x.length>64))return res.status(400).json({error:'INVALID_SERVICES'});
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||typeof time!=='string'||!/^\d{2}:\d{2}$/.test(time))return res.status(400).json({error:'INVALID_DATE_OR_TIME'});
 const todayKey=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const dateMs=Date.parse(`${date}T12:00:00Z`);const todayMs=Date.parse(`${todayKey}T12:00:00Z`);const delta=(dateMs-todayMs)/86400000;if(!Number.isFinite(delta)||delta<0||delta>30)return res.status(400).json({error:'INVALID_DATE'});
 const client=await pool.connect();try{await client.query('BEGIN');
 const {rows:services}=await client.query('SELECT id,name,price_cents,slot_type FROM services WHERE id=ANY($1::text[]) AND active=true',[serviceIds]);
 if(services.length!==serviceIds.length){await client.query('ROLLBACK');return res.status(400).json({error:'INVALID_SERVICES'})}
 const type=services.some(s=>s.slot_type==='procedure')?'procedure':'simple';
 const match=/^(\d{2}):(00|30)$/.exec(time);const hour=match?Number(match[1]):-1;const minute=match?Number(match[2]):-1;
 if(hour<9||hour>18||(type==='simple'&&minute!==0)||(type==='procedure'&&minute!==30)){await client.query('ROLLBACK');return res.status(400).json({error:'INVALID_SLOT_TYPE'})}
 const total=services.reduce((n,s)=>n+s.price_cents,0);const names=serviceIds.map(id=>services.find(s=>s.id===id).name);const code=crypto.randomBytes(4).toString('hex').toUpperCase();
 const inserted=await client.query(`INSERT INTO bookings(booking_code,customer_name,customer_phone,service_ids,service_names,total_cents,slot_type,booking_date,booking_time,duration_minutes) VALUES($1,$2,$3,$4,$5,$6,$7,$8::date,$9::time,30) RETURNING id`,[code,customerName.trim(),customerPhone.trim(),serviceIds,names,total,type,date,time]);
 await client.query('COMMIT');res.status(201).json({bookingCode:code});
 }catch(e){await client.query('ROLLBACK');if(e.code==='23P01'||e.code==='23505')return res.status(409).json({error:'SLOT_UNAVAILABLE'});throw e}finally{client.release()}
 }catch(e){next(e)}});
app.get('/api/admin/session',async(req,res,next)=>{try{const s=await sessionFrom(req);res.json(s?{authenticated:true,mfaRequired:!s.mfa_verified,csrfToken:req.cookies[CSRF_COOKIE]||''}:{authenticated:false})}catch(e){next(e)}});
app.post('/api/admin/login',loginLimiter,async(req,res,next)=>{try{const email=String(req.body?.email||'').trim().toLowerCase(),password=String(req.body?.password||'');if(email.length>254||password.length>128)return res.status(401).json({error:'INVALID_CREDENTIALS'});const {rows}=await pool.query('SELECT id,email,password_hash,totp_secret_enc,active FROM admin_users WHERE email=$1',[email]);const user=rows[0];const valid=user&&user.active&&await argon2.verify(user.password_hash,password).catch(()=>false);if(!valid){await argon2.hash('timing-safe-invalid-password-'+crypto.randomBytes(8).toString('hex'),{type:argon2.argon2id});return res.status(401).json({error:'INVALID_CREDENTIALS'})}
 const token=randomToken(),csrf=randomToken();await pool.query('DELETE FROM admin_sessions WHERE expires_at<now()');await pool.query('INSERT INTO admin_sessions(admin_user_id,session_hash,csrf_hash,mfa_verified,expires_at) VALUES($1,$2,$3,false,now()+interval \'8 hours\')',[user.id,hash(token),hash(csrf)]);setSessionCookies(res,token,csrf);res.json({authenticated:true,mfaSetup:!user.totp_secret_enc,mfaRequired:!!user.totp_secret_enc,csrfToken:csrf});
 }catch(e){next(e)}});
app.post('/api/admin/mfa/setup',requireSession,requireCsrf,async(req,res,next)=>{try{if(req.admin.totp_secret_enc)return res.status(409).json({error:'MFA_ALREADY_CONFIGURED'});const secret=authenticator.generateSecret();const label=encodeURIComponent(`Don Sapo (${req.admin.email})`);const uri=`otpauth://totp/${label}?secret=${secret}&issuer=Don%20Sapo&algorithm=SHA1&digits=6&period=30`;await pool.query('UPDATE admin_users SET pending_totp_secret_enc=$1,updated_at=now() WHERE id=$2',[encryptSecret(secret),req.admin.admin_user_id]);res.json({secret,qrCodeDataUrl:await QRCode.toDataURL(uri)});}catch(e){next(e)}});
app.post('/api/admin/mfa/verify',requireSession,requireCsrf,async(req,res,next)=>{try{const code=String(req.body?.code||'').replace(/\D/g,'');if(!/^\d{6}$/.test(code))return res.status(400).json({error:'INVALID_CODE'});const secretEnc=req.admin.totp_secret_enc||req.admin.pending_totp_secret_enc;if(!secretEnc)return res.status(400).json({error:'MFA_NOT_CONFIGURED'});const secret=decryptSecret(secretEnc);if(!authenticator.check(code,secret))return res.status(401).json({error:'INVALID_CODE'});if(!req.admin.totp_secret_enc)await pool.query('UPDATE admin_users SET totp_secret_enc=pending_totp_secret_enc,pending_totp_secret_enc=NULL,updated_at=now() WHERE id=$1',[req.admin.admin_user_id]);await pool.query('UPDATE admin_sessions SET mfa_verified=true WHERE id=$1',[req.admin.session_id]);res.json({verified:true,csrfToken:req.cookies[CSRF_COOKIE]||''});}catch(e){next(e)}});
app.get('/api/admin/bookings',requireSession,requireMfa,async(_req,res,next)=>{try{const {rows}=await pool.query("SELECT id,booking_code,customer_name,customer_phone,service_names,total_cents,to_char(booking_date,'YYYY-MM-DD') AS booking_date,to_char(booking_time,'HH24:MI') AS booking_time,status,created_at FROM bookings ORDER BY booking_date,booking_time");res.json({bookings:rows})}catch(e){next(e)}});
app.patch('/api/admin/bookings/:id',requireSession,requireCsrf,requireMfa,async(req,res,next)=>{try{const status=req.body?.status;if(!['confirmed','cancelled'].includes(status))return res.status(400).json({error:'INVALID_STATUS'});const {rows}=await pool.query("UPDATE bookings SET status=$1,updated_at=now() WHERE id=$2 AND ((status='pending' AND $1 IN ('confirmed','cancelled')) OR (status='confirmed' AND $1='cancelled')) RETURNING id",[status,req.params.id]);if(!rows.length)return res.status(404).json({error:'BOOKING_NOT_FOUND_OR_INVALID_TRANSITION'});await pool.query('INSERT INTO security_events(actor_user_id,event_type,booking_id,metadata) VALUES($1,$2,$3,$4::jsonb)',[req.admin.admin_user_id,'booking_status_changed',req.params.id,JSON.stringify({status})]);res.json({updated:true})}catch(e){next(e)}});
app.post('/api/admin/logout',requireSession,requireCsrf,async(req,res,next)=>{try{await pool.query('DELETE FROM admin_sessions WHERE id=$1',[req.admin.session_id]);clearSessionCookies(res);res.json({loggedOut:true})}catch(e){next(e)}});
app.use(express.static(path.join(__dirname,'public'),{extensions:['html'],dotfiles:'deny'}));
app.use((err,req,res,_next)=>{const id=crypto.randomUUID();console.error(JSON.stringify({id,method:req.method,path:req.path,code:err.code||'INTERNAL_ERROR'}));if(res.headersSent)return;res.status(500).json({error:'INTERNAL_ERROR',requestId:id})});
app.listen(PORT,()=>console.log(`Don Sapo rodando na porta ${PORT}`));

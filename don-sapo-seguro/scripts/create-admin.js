import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import argon2 from 'argon2';
const {DATABASE_URL,ADMIN_EMAIL,ADMIN_PASSWORD}=process.env;
if(!DATABASE_URL||!ADMIN_EMAIL||!ADMIN_PASSWORD)throw new Error('Defina DATABASE_URL, ADMIN_EMAIL e ADMIN_PASSWORD no ambiente antes de criar o administrador.');
if(ADMIN_PASSWORD.length<16)throw new Error('Use uma senha inicial com pelo menos 16 caracteres.');
const pool=new Pool({connectionString:DATABASE_URL,ssl:true});
try{const hash=await argon2.hash(ADMIN_PASSWORD,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});await pool.query('INSERT INTO admin_users(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,active=true,updated_at=now()',[ADMIN_EMAIL.trim().toLowerCase(),hash]);console.log('Administrador criado/atualizado. MFA será configurado no primeiro login.');}finally{await pool.end()}

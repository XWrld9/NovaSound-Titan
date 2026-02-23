#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Clé service requise pour créer des buckets

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erreur: VITE_SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis');
  console.log('💡 Créez une clé service dans Supabase Dashboard > Settings > API');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const buckets = [
  {
    name: 'avatars',
    public: true,
    allowedMimeTypes: ['image/*'],
    fileSizeLimit: 5242880, // 5MB
    description: 'Photos de profil des utilisateurs'
  },
  {
    name: 'audio',
    public: true,
    allowedMimeTypes: ['audio/*'],
    fileSizeLimit: 52428800, // 50MB
    description: 'Fichiers audio des chansons'
  },
  {
    name: 'covers',
    public: true,
    allowedMimeTypes: ['image/*'],
    fileSizeLimit: 10485760, // 10MB
    description: 'Pochettes d\'albums'
  }
];

async function createBucket(bucket) {
  try {
    console.log(`📁 Création du bucket "${bucket.name}"...`);
    
    // Créer le bucket
    const { data, error } = await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
      allowedMimeTypes: bucket.allowedMimeTypes,
      fileSizeLimit: bucket.fileSizeLimit
    });

    if (error) {
      if (error.message.includes('already exists')) {
        console.log(`✅ Bucket "${bucket.name}" existe déjà`);
        return true;
      }
      throw error;
    }

    console.log(`✅ Bucket "${bucket.name}" créé avec succès`);
    
    // Créer les politiques RLS pour le bucket
    await createBucketPolicies(bucket);
    
    return true;
  } catch (error) {
    console.error(`❌ Erreur lors de la création du bucket "${bucket.name}":`, error.message);
    return false;
  }
}

async function createBucketPolicies(bucket) {
  try {
    console.log(`🔐 Configuration des politiques pour "${bucket.name}"...`);
    
    // Politique de lecture publique
    const { error: readError } = await supabase
      .from('storage.policies')
      .insert({
        name: `Public Read ${bucket.name}`,
        definition: `bucket_id = '${bucket.name}'`,
        role_name: 'anon',
        allow_read: true,
        allow_insert: false,
        allow_update: false,
        allow_delete: false
      });

    if (readError && !readError.message.includes('already exists')) {
      console.warn(`⚠️ Erreur politique lecture pour "${bucket.name}":`, readError.message);
    }

    // Politique d'écriture pour utilisateurs authentifiés
    const { error: writeError } = await supabase
      .from('storage.policies')
      .insert({
        name: `Authenticated Write ${bucket.name}`,
        definition: `bucket_id = '${bucket.name}'`,
        role_name: 'authenticated',
        allow_read: true,
        allow_insert: true,
        allow_update: true,
        allow_delete: true
      });

    if (writeError && !writeError.message.includes('already exists')) {
      console.warn(`⚠️ Erreur politique écriture pour "${bucket.name}":`, writeError.message);
    }

    console.log(`✅ Politiques configurées pour "${bucket.name}"`);
  } catch (error) {
    console.warn(`⚠️ Erreur configuration politiques pour "${bucket.name}":`, error.message);
  }
}

async function main() {
  console.log('🚀 NovaSound-TITAN - Création automatique des buckets Storage');
  console.log('=' .repeat(60));
  
  let successCount = 0;
  
  for (const bucket of buckets) {
    const success = await createBucket(bucket);
    if (success) successCount++;
    console.log(''); // Ligne vide pour la lisibilité
  }
  
  console.log('=' .repeat(60));
  console.log(`📊 Résultat: ${successCount}/${buckets.length} buckets créés avec succès`);
  
  if (successCount === buckets.length) {
    console.log('🎉 Tous les buckets sont prêts ! NovaSound-TITAN est opérationnel.');
  } else {
    console.log('⚠️ Certains buckets n\'ont pas pu être créés. Vérifiez les erreurs ci-dessus.');
  }
}

main().catch(console.error);

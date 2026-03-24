/**
 * Script para crear índices en MongoDB.
 *
 * Uso:
 *   node scripts/create-indexes.js
 *
 * Requiere la variable de entorno MONGODB_URI.
 */

const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI no está definida.');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection('lores');

    console.log('Creando índices en la colección "lores"...\n');

    // Índice compuesto para deduplicación de chunks
    await collection.createIndex({ sourceUrl: 1, chunkHash: 1 });
    console.log('✓ Índice: { sourceUrl: 1, chunkHash: 1 }');

    // Índice para lookups por sourceUrl
    await collection.createIndex({ sourceUrl: 1 });
    console.log('✓ Índice: { sourceUrl: 1 }');

    // Índice para filtrado por tipo de fuente
    await collection.createIndex({ sourceType: 1 });
    console.log('✓ Índice: { sourceType: 1 }');

    // Índice para búsqueda por tags
    await collection.createIndex({ tags: 1 });
    console.log('✓ Índice: { tags: 1 }');

    // Índice para ordenamiento temporal
    await collection.createIndex({ createdAt: -1 });
    console.log('✓ Índice: { createdAt: -1 }');

    await collection.createIndex({ updatedAt: -1 });
    console.log('✓ Índice: { updatedAt: -1 }');

    console.log('\n--- Índices regulares creados ---\n');

    console.log('NOTA: El índice vectorial "vector_index" debe crearse manualmente');
    console.log('desde MongoDB Atlas UI o Atlas CLI con esta configuración:\n');
    console.log(JSON.stringify({
      name: 'vector_index',
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: 1536,
            similarity: 'cosine',
          },
        ],
      },
    }, null, 2));

    console.log('\nTodos los índices regulares fueron creados correctamente.');
  } catch (err) {
    console.error('Error creando índices:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();

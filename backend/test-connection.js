require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'pos_system'
});

async function testConnection() {
    try {
        console.log('Attempting to connect to database...');
        console.log('Connection details:', {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || '5432',
            user: process.env.DB_USERNAME || 'postgres',
            database: process.env.DB_NAME || 'pos_system'
        });
        
        await client.connect();
        const result = await client.query('SELECT NOW()');
        console.log('✅ Database connection successful!');
        console.log('Current database time:', result.rows[0].now);
    } catch (err) {
        console.error('❌ Error connecting to database:', err.message);
        if (err.code === 'ECONNREFUSED') {
            console.error('Make sure PostgreSQL is running and accessible.');
        }
    } finally {
        await client.end();
    }
}

testConnection(); 
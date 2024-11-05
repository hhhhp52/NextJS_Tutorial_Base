import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { invoices, customers, revenue, users } from '../lib/placeholder-data';

const pool = new Pool({
  user: 'root',
  host: 'localhost',
  database: 'frontend',
  password: '123456',
  port: 5433,
});

async function connectToDatabase() {
  return await pool.connect();
}

async function seedUsers(client: any) {
  console.log('Seeding users');
  await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `);

  const insertedUsers = await Promise.all(
    users.map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      return client.query(`
  INSERT INTO users (id, name, email, password)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (id) DO NOTHING;
`, [user.id, user.name, user.email, hashedPassword]);
    }),
  );

  return insertedUsers;
}

async function seedInvoices(client: any) {
  console.log('Seeding invoices');
  await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      customer_id UUID NOT NULL,
      amount INT NOT NULL,
      status VARCHAR(255) NOT NULL,
      date DATE NOT NULL
    );
  `);

  const insertedInvoices = await Promise.all(
      invoices.map(
          (invoice) => client.query(`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO NOTHING;
      `, [invoice.customer_id, invoice.amount, invoice.status, invoice.date]),
      ),
  );

  return insertedInvoices;
}

async function seedCustomers(client: any) {
  console.log('Seeding customers');
  await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      image_url VARCHAR(255) NOT NULL
    );
  `);

  const insertedCustomers = await Promise.all(
      customers.map(
          (customer) => client.query(`
        INSERT INTO customers (id, name, email, image_url)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO NOTHING;
      `, [customer.id, customer.name, customer.email, customer.image_url]),
      ),
  );

  return insertedCustomers;
}

async function seedRevenue(client: any) {
  console.log('Seeding revenue');
  await client.query(`
    CREATE TABLE IF NOT EXISTS revenue (
      month VARCHAR(4) NOT NULL UNIQUE,
      revenue INT NOT NULL
    );
  `);

  const insertedRevenue = await Promise.all(
      revenue.map(
          (rev) => client.query(`
        INSERT INTO revenue (month, revenue)
        VALUES ($1, $2)
        ON CONFLICT (month) DO NOTHING;
      `, [rev.month, rev.revenue]),
      ),
  );

  return insertedRevenue;
}

export async function GET() {
  const client = await connectToDatabase();
  console.log(client);
  try {
    await client.query('BEGIN');
    await seedUsers(client);
    await seedCustomers(client);
    await seedInvoices(client);
    await seedRevenue(client);
    await client.query('COMMIT');

    return new Response(JSON.stringify({ message: 'Database seeded successfully' }), { status: 200 });
  } catch (error) {
    await client.query('ROLLBACK');
    return new Response(JSON.stringify({ error: error }), { status: 500 });
  } finally {
    client.release();
  }
}
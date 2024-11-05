import {formatCurrency} from './utils';
import {Pool} from 'pg';

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

export async function fetchRevenue() {
    const client = await connectToDatabase();

    try {
        console.log('Fetching revenue data...');
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const data = await client.query(`SELECT * FROM revenue`);

        console.log('Data fetch completed after 3 seconds.');

        return data.rows;
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch revenue data.');
    } finally {
        client.release();
    }
}

export async function fetchLatestInvoices() {
    const client = await connectToDatabase();
    try {
        const data = await client.query(`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5`);

        const latestInvoices = data.rows.map((invoice: any) => ({
            ...invoice,
            amount: formatCurrency(invoice.amount),
        }));
        return latestInvoices;
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch the latest invoices.');
    } finally {
        client.release();
    }
}

export async function fetchCardData() {
    const client = await connectToDatabase();
    try {
        const invoiceCountPromise = client.query(`SELECT COUNT(*) FROM invoices`);
        const customerCountPromise = client.query(`SELECT COUNT(*) FROM customers`);
        const invoiceStatusPromise = client.query(`
      SELECT
      SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
      SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
      FROM invoices`);

        const data = await Promise.all([
            invoiceCountPromise,
            customerCountPromise,
            invoiceStatusPromise,
        ]);

        const numberOfInvoices = Number(data[0].rows[0].count ?? '0');
        const numberOfCustomers = Number(data[1].rows[0].count ?? '0');
        const totalPaidInvoices = formatCurrency(data[2].rows[0].paid ?? '0');
        const totalPendingInvoices = formatCurrency(data[2].rows[0].pending ?? '0');
        return {
            numberOfCustomers,
            numberOfInvoices,
            totalPaidInvoices,
            totalPendingInvoices,
        };
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch card data.');
    } finally {
        client.release();
    }
}

const ITEMS_PER_PAGE = 6;

export async function fetchFilteredInvoices(query: string, currentPage: number) {
    const client = await connectToDatabase();
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;

    try {
        const invoices = await client.query(`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE $1 OR
        customers.email ILIKE $1 OR
        invoices.amount::text ILIKE $1 OR
        invoices.date::text ILIKE $1 OR
        invoices.status ILIKE $1
      ORDER BY invoices.date DESC
      LIMIT $2 OFFSET $3
    `, [`%${query}%`, ITEMS_PER_PAGE, offset]);

        return invoices.rows;
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch invoices.');
    } finally {
        client.release();
    }
}

export async function fetchInvoicesPages(query: string) {
    const client = await connectToDatabase();
    try {
        const count = await client.query(`
      SELECT COUNT(*)
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE $1 OR
        customers.email ILIKE $1 OR
        invoices.amount::text ILIKE $1 OR
        invoices.date::text ILIKE $1 OR
        invoices.status ILIKE $1
    `, [`%${query}%`]);

        const totalPages = Math.ceil(Number(count.rows[0].count) / ITEMS_PER_PAGE);
        return totalPages;
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch total number of invoices.');
    } finally {
        client.release();
    }
}

export async function fetchInvoiceById(id: string) {
    const client = await connectToDatabase();
    try {
        const data = await client.query(`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = $1
    `, [id]);

        const invoice = data.rows.map((invoice: any) => ({
            ...invoice,
            amount: invoice.amount / 100,
        }));
        console.log(invoice); // Invoice is an empty array []
        return invoice[0];
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch invoice.');
    } finally {
        client.release();
    }
}

export async function fetchCustomers() {
    const client = await connectToDatabase();
    try {
        const data = await client.query(`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `);

        const customers = data.rows;
        return customers;
    } catch (err) {
        console.error('Database Error:', err);
        throw new Error('Failed to fetch all customers.');
    } finally {
        client.release();
    }
}

export async function fetchFilteredCustomers(query: string) {
    const client = await connectToDatabase();
    try {
        const data = await client.query(`
      SELECT
        customers.id,
        customers.name,
        customers.email,
        customers.image_url,
        COUNT(invoices.id) AS total_invoices,
        SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
        SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
      FROM customers
      LEFT JOIN invoices ON customers.id = invoices.customer_id
      WHERE
        customers.name ILIKE $1 OR
        customers.email ILIKE $1
      GROUP BY customers.id, customers.name, customers.email, customers.image_url
      ORDER BY customers.name ASC
    `, [`%${query}%`]);

        const customers = data.rows.map((customer: any) => ({
            ...customer,
            total_pending: formatCurrency(customer.total_pending),
            total_paid: formatCurrency(customer.total_paid),
        }));

        return customers;
    } catch (err) {
        console.error('Database Error:', err);
        throw new Error('Failed to fetch customers table.');
    } finally {
        client.release();
    }
}
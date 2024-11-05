'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { z } from 'zod';
import {Pool} from "pg";
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce
        .number()
        .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
    const client = await connectToDatabase();

    try {
        const validatedFields = CreateInvoice.safeParse({
            customerId: formData.get('customerId'),
            amount: formData.get('amount'),
            status: formData.get('status'),
        });

        if (!validatedFields.success) {
            return {
                errors: validatedFields.error.flatten().fieldErrors,
                message: 'Missing Fields. Failed to Create Invoice.',
            };
        }

        // Prepare data for insertion into the database
        const { customerId, amount, status } = validatedFields.data;
        const amountInCents = amount * 100;
        const date = new Date().toISOString().split('T')[0];


        await client.query(
            `INSERT INTO invoices (customer_id, amount, status, date)
         VALUES ($1, $2, $3, $4)`,
            [customerId, amountInCents, status, date]
        );
        revalidatePath('/dashboard/invoices');
        redirect('/dashboard/invoices');
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to create the invoice.');
    } finally {
        client.release();
    }
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(
    id: string,
    prevState: State,
    formData: FormData,
) {
    const client = await connectToDatabase();
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Update Invoice.',
        };
    }

    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    try {
        await client.query(`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
      `);
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to Update Invoice');
    }  finally {
        client.release();
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    const client = await connectToDatabase();
    try {
        await client.query(`DELETE FROM invoices WHERE id = ${id}`);
        revalidatePath('/dashboard/invoices');
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to Delete Invoice');
    } finally {
        client.release();
    }
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }
        throw error;
    }
}
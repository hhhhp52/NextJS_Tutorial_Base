import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { Pool } from 'pg';
import type { User } from '@/app/lib/definitions';
import bcrypt from 'bcrypt';


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

async function getUser(email: string): Promise<User | undefined> {
    const client = await connectToDatabase();
    try {
        const user = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        return user.rows[0];
    } catch (error) {
        console.error('Failed to fetch user:', error);
        throw new Error('Failed to fetch user.');
    } finally {
        client.release();
    }
}

export const { auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;
                    const user = await getUser(email);
                    if (!user) return null;
                    const passwordsMatch = await bcrypt.compare(password, user.password);

                    if (passwordsMatch) return user;
                }

                console.log('Invalid credentials');
                return null;
            },
        }),
    ],
});
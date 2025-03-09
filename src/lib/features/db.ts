// filepath: /Users/markb/dev/blipty-web/src/lib/features/db.ts
import { query } from '$lib/services/db';

export interface TestConnectionResult {
    success: boolean;
    error?: string;
}

export async function testConnectionString(connectionString: string): Promise<TestConnectionResult> {
    try {
        // Try to execute a simple query to test the connection
        await query('SELECT 1');
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
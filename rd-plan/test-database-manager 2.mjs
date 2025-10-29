#!/usr/bin/env node

import { app, BrowserWindow } from 'electron';
import { initializeDatabaseManager, DatabaseConfig } from './src/main/database-manager.js';

// Test configuration
const testConfigs: DatabaseConfig[] = [
    { mode: 'sqlite', multiUser: false },
    { mode: 'central-sqlite', multiUser: true, centralPath: '/tmp/rd-plan-test.db' }
];

async function testDatabaseManager() {
    console.log('Testing RD-Plan Database Manager...\n');
    
    for (const config of testConfigs) {
        console.log(`Testing configuration: ${JSON.stringify(config)}`);
        
        try {
            const adapter = await initializeDatabaseManager(config);
            
            // Test basic operations
            console.log('  ✓ Database initialized successfully');
            
            // Test personnel operations
            const personnel = await adapter.getPersonnel();
            console.log(`  ✓ Retrieved ${personnel.length} personnel records`);
            
            // Test settings operations
            await adapter.setSetting('test_key', 'test_value');
            const value = await adapter.getSetting('test_key');
            if (value === 'test_value') {
                console.log('  ✓ Settings read/write test passed');
            } else {
                console.log('  ✗ Settings test failed');
            }
            
            await adapter.close();
            console.log('  ✓ Database closed successfully\n');
            
        } catch (error) {
            console.error(`  ✗ Error testing configuration: ${error.message}\n`);
        }
    }
    
    console.log('Database Manager tests completed!');
    process.exit(0);
}

// Mock Electron app for testing
const mockApp = {
    getPath: (name: string) => {
        if (name === 'userData') return '/tmp/rd-plan-userdata';
        if (name === 'documents') return '/tmp/rd-plan-documents';
        return '/tmp';
    }
};

// Replace app with mock for testing
(global as any).app = mockApp;

testDatabaseManager().catch(console.error);
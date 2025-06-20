import { exec, ExecOptions } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export const enhancedExecAsync = async (command: string, options: ExecOptions = {}) => {
    
    const enhancedPath = [
        process.env.PATH || '',
        '/usr/local/bin', 
        '/opt/homebrew/bin', 
        '/usr/bin',
        '/bin'
    ].filter(Boolean).join(':');

    return await execAsync(command, {
        env: {
            ...process.env,
            PATH: enhancedPath
        }, 
        ...options
    });
    
};
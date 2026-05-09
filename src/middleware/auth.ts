import { Context, Next } from 'koa';
import { config } from '../config';

export async function basicAuth(ctx: Context, next: Next): Promise<void> {
  const authHeader = ctx.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    ctx.status = 401;
    ctx.set('WWW-Authenticate', 'Basic');
    ctx.body = { error: 'Unauthorized' };
    return;
  }
  
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  
  if (username !== config.admin.username || password !== config.admin.password) {
    ctx.status = 401;
    ctx.set('WWW-Authenticate', 'Basic');
    ctx.body = { error: 'Unauthorized' };
    return;
  }
  
  await next();
}

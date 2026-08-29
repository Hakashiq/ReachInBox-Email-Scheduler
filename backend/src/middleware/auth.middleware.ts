import { Request, Response, NextFunction } from 'express';

export function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Please login first.' });
}

export function adminBasicAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Queues"');
    return res.status(401).send('Authentication required.');
  }

  try {
    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || 'reachinbox-admin-password';

    if (user === adminUser && pass === adminPass) {
      return next();
    }
  } catch (err) {
    // Fail to 401 on parsing error
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Admin Queues"');
  return res.status(401).send('Authentication required.');
}

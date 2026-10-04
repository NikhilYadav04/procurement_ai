import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export interface SessionUser {
  userId: string;
  email: string;
  name: string | null;
}

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

function signingSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AuthError('The server has no JWT_SECRET configured, so no session can be trusted.', 500);
  }
  return secret;
}

function sessionTokenFrom(req: NextApiRequest): string | null {
  const raw = req.cookies?.session;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return typeof parsed?.token === 'string' ? parsed.token : null;
  } catch {
    return null;
  }
}

export function requireUser(req: NextApiRequest): SessionUser {
  const token = sessionTokenFrom(req);
  if (!token) {
    throw new AuthError('You are not signed in.');
  }

  let payload: any;
  try {
    payload = jwt.verify(token, signingSecret());
  } catch {
    throw new AuthError('Your session is invalid or has expired. Sign in again.');
  }

  const user = payload?.user;
  if (!user?.id || !user?.email) {
    throw new AuthError('Your session does not identify a user.');
  }

  return {
    userId: String(user.id),
    email: String(user.email).toLowerCase(),
    name: user.name ? String(user.name) : null,
  };
}

export type AuthedHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
  user: SessionUser
) => unknown | Promise<unknown>;

export function withUser(handler: AuthedHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    let user: SessionUser;

    try {
      user = requireUser(req);
    } catch (error) {
      const status = error instanceof AuthError ? error.status : 401;
      const message = error instanceof Error ? error.message : 'Not authorised.';
      return res.status(status).json({ success: false, error: message });
    }

    return handler(req, res, user);
  };
}

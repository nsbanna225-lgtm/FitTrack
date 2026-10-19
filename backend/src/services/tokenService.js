import jwt from 'jsonwebtoken';
import { readAuthEnv } from '../config/env.js';

export const tokenOptions = { algorithm: 'HS256', issuer: 'fittrack-api', audience: 'fittrack-web', expiresIn: '15m' };
export function issueToken(user) {
  return jwt.sign({ ver: user.tokenVersion }, readAuthEnv().jwtSecret, { ...tokenOptions, subject: String(user._id) });
}
export function verifyToken(token) {
  return jwt.verify(token, readAuthEnv().jwtSecret, { algorithms: ['HS256'], issuer: 'fittrack-api', audience: 'fittrack-web' });
}

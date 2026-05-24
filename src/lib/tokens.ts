import { customAlphabet } from 'nanoid';

const alphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// 48-char token → 286 bits of entropy, effectively unguessable
export const generateToken = customAlphabet(alphabet, 48);
